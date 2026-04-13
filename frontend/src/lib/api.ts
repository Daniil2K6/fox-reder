const API_BASE = "";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("fox_token");
}

export function setToken(token: string) {
  localStorage.setItem("fox_token", token);
}

export function clearToken() {
  localStorage.removeItem("fox_token");
}

export function getUser() {
  if (typeof window === "undefined") return null;
  const u = localStorage.getItem("fox_user");
  return u ? JSON.parse(u) : null;
}

export function setUser(user: any) {
  localStorage.setItem("fox_user", JSON.stringify(user));
}

/** Merge fields into stored user (e.g. after /api/auth/me). */
export function mergeUser(partial: Record<string, unknown>) {
  const cur = getUser() || {};
  setUser({ ...cur, ...partial });
}

export function clearUser() {
  localStorage.removeItem("fox_user");
}

export function getTheme(): string {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem("fox_theme") || "light";
}

export function setTheme(theme: string) {
  localStorage.setItem("fox_theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || err.error || "Request failed");
  }
  return res;
}

export async function apiLogin(username: string, password: string) {
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Login failed");
  }
  const data = await res.json();
  setToken(data.access_token);
  setUser({
    id: data.id,
    username: data.username,
    role: data.role,
  });
  return data;
}

export async function apiRegister(username: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(err.detail || "Registration failed");
  }
  const data = await res.json();
  setToken(data.access_token);
  setUser({
    id: data.id,
    username: data.username,
    role: data.role,
  });
  return data;
}

export async function apiGetMe() {
  const res = await request("/api/auth/me");
  return res.json();
}

export async function apiUploadBook(file: File, seriesName?: string, title?: string, genres?: string, description?: string) {
  const form = new FormData();
  form.append("file", file);
  let url = "/api/books/upload";
  const params = [];
  if (seriesName) params.push(`series_name=${encodeURIComponent(seriesName)}`);
  if (title) params.push(`title=${encodeURIComponent(title)}`);
  if (genres) params.push(`genres=${encodeURIComponent(genres)}`);
  if (description) params.push(`description=${encodeURIComponent(description)}`);
  if (params.length > 0) url += "?" + params.join("&");
  const res = await request(url, {
    method: "POST",
    body: form,
  });
  return res.json();
}

export async function apiPreviewBook(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await request(`/api/books/preview`, {
    method: "POST",
    body: form,
  });
  return res.json();
}

export async function apiMyBooks() {
  const res = await request("/api/books/my");
  return res.json();
}

export async function apiPublicBooks() {
  const res = await request("/api/books/public");
  return res.json();
}

export async function apiSearchBooks(query: string) {
  const res = await request(`/api/books/search?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function apiGetBook(id: number) {
  const res = await request(`/api/books/${id}`);
  return res.json();
}

export async function apiGetBookText(id: number) {
  const res = await request(`/api/books/${id}/text`);
  return res.json();
}

export async function apiGetBookStructured(id: number) {
  const res = await request(`/api/books/${id}/structured`);
  return res.json();
}

export async function apiDeleteBook(id: number) {
  const res = await request(`/api/books/${id}`, { method: "DELETE" });
  return res.json();
}

export async function apiToggleVisibility(id: number, isPublic: boolean) {
  const res = await request(`/api/books/${id}/visibility?is_public=${isPublic}`, {
    method: "PUT",
  });
  return res.json();
}

export async function apiTTS(text: string, language: string = "en"): Promise<Blob> {
  const res = await request("/api/tts", {
    method: "POST",
    body: JSON.stringify({ text, language }),
  });
  return res.blob();
}

export async function apiTTSChunk(text: string, language: string = "en"): Promise<Blob> {
  const res = await request("/api/tts/chunk", {
    method: "POST",
    body: JSON.stringify({ text, language }),
  });
  return res.blob();
}

export async function apiUpdateChapter(bookId: number, chapterIndex: number, data: { title?: string; paragraphs?: any[] }) {
  const res = await request(`/api/books/${bookId}/chapter/${chapterIndex}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiDownloadVblite(bookId: number) {
  const res = await request(`/api/books/${bookId}/convert/vblite`);
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `book_${bookId}.vblite`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function apiCreateSeries(name: string) {
  const res = await request("/api/books/series", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function apiListSeries() {
  const res = await request("/api/books/series/list");
  return res.json();
}

export async function apiPublicSeries() {
  const res = await request("/api/books/series/public");
  return res.json();
}

export async function apiDeleteSeries(seriesId: number) {
  const res = await request(`/api/books/series/${seriesId}`, { method: "DELETE" });
  return res.json();
}

export async function apiAssignToSeries(bookId: number, seriesIds: number[]) {
  const res = await request(`/api/books/${bookId}/series`, {
    method: "PUT",
    body: JSON.stringify({ series_ids: seriesIds }),
  });
  return res.json();
}

export async function apiUploadCover(bookId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await request(`/api/books/${bookId}/cover`, {
    method: "POST",
    body: form,
  });
  return res.json();
}

export function apiGetCoverUrl(bookId: number): string {
  return `/api/books/${bookId}/cover`;
}

export function apiGetSeriesCoverUrl(seriesId: number): string {
  return `/api/books/series/${seriesId}/cover`;
}

export async function apiUpdateMetadata(bookId: number, data: { genres?: string; description?: string }) {
  const res = await request(`/api/books/${bookId}/metadata`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiGetComments(bookId: number) {
  const res = await request(`/api/books/${bookId}/comments`);
  return res.json();
}

export async function apiCreateComment(bookId: number, content: string) {
  const res = await request(`/api/books/${bookId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  return res.json();
}

export async function apiDeleteComment(bookId: number, commentId: number) {
  const res = await request(`/api/books/${bookId}/comments/${commentId}`, {
    method: "DELETE",
  });
  return res.json();
}

export async function apiSetVoicePreference(voice: string, language: string) {
  const res = await request("/api/auth/voice", {
    method: "PUT",
    body: JSON.stringify({ voice, language }),
  });
  return res.json();
}

export async function apiTTSChunkWithCharacter(text: string, language: string = "en", character?: string, voiceType?: string): Promise<Blob> {
  const body: any = { text, language };
  if (character) body.character = character;
  if (voiceType) body.voice_type = voiceType;
  const res = await request("/api/tts/chunk", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.blob();
}

export async function apiPublicBooksCount(search?: string) {
  let url = "/api/books/public/count";
  if (search) url += `?search=${encodeURIComponent(search)}`;
  const res = await request(url);
  return res.json();
}

export async function apiLikeBook(bookId: number) {
  const res = await request(`/api/books/${bookId}/like`, { method: "POST" });
  return res.json();
}

export async function apiUnlikeBook(bookId: number) {
  const res = await request(`/api/books/${bookId}/like`, { method: "DELETE" });
  return res.json();
}

export async function apiSubscribe(authorId: number) {
  const res = await request(`/api/books/subscribe/${authorId}`, { method: "POST" });
  return res.json();
}

export async function apiUnsubscribe(authorId: number) {
  const res = await request(`/api/books/subscribe/${authorId}`, { method: "DELETE" });
  return res.json();
}

export async function apiMySubscriptions() {
  const res = await request("/api/books/subscriptions");
  return res.json();
}

export async function apiNotifications() {
  const res = await request("/api/books/notifications");
  return res.json();
}

export async function apiUnreadCount() {
  const res = await request("/api/books/notifications/unread-count");
  return res.json();
}

export async function apiMarkRead(notifId: number) {
  const res = await request(`/api/books/notifications/${notifId}/read`, { method: "POST" });
  return res.json();
}

export async function apiMarkAllRead() {
  const res = await request("/api/books/notifications/read-all", { method: "POST" });
  return res.json();
}

export async function apiAuthors() {
  const res = await request("/api/books/users-with-books");
  return res.json();
}

export async function apiIncrementView(bookId: number) {
  const res = await request(`/api/books/${bookId}/view`, { method: "POST" });
  return res.json();
}

export async function apiUploadAvatar(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await request("/api/books/user/avatar", {
    method: "POST",
    body: form,
  });
  return res.json();
}

export function apiGetAvatarUrl(userId: number): string {
  return `/api/books/user/avatar/${userId}`;
}

export async function apiPublicBooksPaginated(page: number = 1, limit: number = 20, search?: string, sortBy?: string, genre?: string, extension?: string) {
  let url = `/api/books/public?page=${page}&limit=${limit}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (sortBy) url += `&sort_by=${sortBy}`;
  if (genre) url += `&genre=${encodeURIComponent(genre)}`;
  if (extension) url += `&extension=${encodeURIComponent(extension)}`;
  const res = await request(url);
  return res.json();
}

export async function apiHotBooks() {
  const res = await request("/api/books/public/hot");
  return res.json();
}

export async function apiAuthor(userId: number) {
  const res = await request(`/api/books/author/${userId}`);
  return res.json();
}

export async function apiGetSeries(seriesId: number) {
  const res = await request(`/api/books/series/${seriesId}`);
  return res.json();
}

export async function apiUpdateSeries(seriesId: number, data: { name?: string; cover_image?: string; common_genres?: string }) {
  const res = await request(`/api/books/series/${seriesId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiReorderSeriesBooks(seriesId: number, bookIds: number[]) {
  const res = await request(`/api/books/series/${seriesId}/order`, {
    method: "PUT",
    body: JSON.stringify({ book_ids: bookIds }),
  });
  return res.json();
}

export async function apiUploadSeriesCover(seriesId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await request(`/api/books/series/${seriesId}/cover`, {
    method: "POST",
    body: form,
  });
  return res.json();
}

