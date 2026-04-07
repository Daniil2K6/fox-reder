const API_BASE = "";

function getToken(): string | null {
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
  setUser({ username: data.username, role: data.role });
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
  setUser({ username: data.username, role: data.role });
  return data;
}

export async function apiGetMe() {
  const res = await request("/api/auth/me");
  return res.json();
}

export async function apiUploadBook(file: File, isPublic: boolean = false) {
  const form = new FormData();
  form.append("file", file);
  const res = await request(`/api/books/upload?is_public=${isPublic}`, {
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

export async function apiDeleteSeries(seriesId: number) {
  const res = await request(`/api/books/series/${seriesId}`, { method: "DELETE" });
  return res.json();
}

export async function apiAssignToSeries(bookId: number, seriesId: number | null) {
  const res = await request(`/api/books/${bookId}/series`, {
    method: "PUT",
    body: JSON.stringify({ series_id: seriesId }),
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
