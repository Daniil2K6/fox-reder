"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getUser, setUser, clearToken, clearUser, getTheme, setTheme, mergeUser, getToken,
  apiMyBooks, apiUploadBook, apiDeleteBook, apiToggleVisibility,
  apiGetBookStructured, apiUpdateChapter, apiDownloadVblite,
  apiCreateSeries, apiListSeries, apiDeleteSeries, apiAssignToSeries,
  apiPreviewBook, apiGetMe, apiUploadCover, apiUploadAvatar, apiGetAvatarUrl,
  apiGetSeries, apiUpdateSeries, apiReorderSeriesBooks, apiUploadSeriesCover,
  apiGetSeriesCoverUrl, apiGetBookVersions, apiDownloadBook, apiDeleteBookVersion, apiSetPreferredFormat,
  apiRenameBook,
} from "@/lib/api";
import { GENRES, getGenresByLetter, searchGenres } from "@/lib/genres";
import { Navbar } from "@/components/Navbar";
import { BookEditModal } from "@/components/BookEditModal";

const ITEMS_PER_PAGE = 30;
const RUSSIAN_ALPHABET = "АБВГДЕЁЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ".split("");
const ENGLISH_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface Book {
  id: number;
  title: string;
  filename: string;
  sha256: string;
  is_public: boolean;
  owner_id: number;
  owner_username: string;
  has_structure: boolean;
  series_ids: number[];
  series_names: string[];
  cover_image: string | null;
  genres: string | null;
  description: string | null;
  comment_count: number;
  formats?: string[];
  preferred_format?: string | null;
}

interface Chapter {
  id: number | string;
  title: string;
  paragraphs: string[];
  order_index?: number;
}

interface Series {
  id: number;
  name: string;
  book_count: number;
  cover_image: string | null;
}

const btn = (bg: string, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  padding: "6px 14px",
  borderRadius: 8,
  border: "none",
  background: bg,
  color,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  ...extra,
});

const pill = (active: boolean): React.CSSProperties => ({
  padding: "5px 14px",
  borderRadius: 16,
  border: "1px solid var(--border)",
  background: active ? "var(--accent)" : "transparent",
  color: active ? "#fff" : "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

function GenreModal({ selectedGenres, onSave, onClose }: { selectedGenres: string[]; onSave: (g: string[]) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState("А");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedGenres));
  const [showPageInput, setShowPageInput] = useState(false);
  const [pageInput, setPageInput] = useState("");

  const filteredGenres = search ? searchGenres(search) : getGenresByLetter(activeLetter);
  const totalPages = Math.max(1, Math.ceil(filteredGenres.length / ITEMS_PER_PAGE));
  const pagedGenres = filteredGenres.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleGenre = (g: string) => {
    const next = new Set(selected);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    setSelected(next);
  };

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) setCurrentPage(p);
  };

  const handlePageInput = () => {
    const p = parseInt(pageInput, 10);
    if (!isNaN(p)) goToPage(p);
    setShowPageInput(false);
    setPageInput("");
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ background: "var(--bg-secondary)", borderRadius: 12, width: "95%", maxWidth: 800, maxHeight: "85vh", display: "flex", flexDirection: "column", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Выбор жанров</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
        </div>

        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="Поиск по названию..."
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, marginBottom: 12, boxSizing: "border-box" }}
        />

        {!search && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {RUSSIAN_ALPHABET.map(l => (
              <button key={l} onClick={() => { setActiveLetter(l); setCurrentPage(1); }}
                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: activeLetter === l ? "var(--accent)" : "var(--bg-primary)", color: activeLetter === l ? "#fff" : "var(--text-primary)", fontSize: 12, cursor: "pointer" }}>
                {l}
              </button>
            ))}
            <button onClick={() => { setActiveLetter("ABC"); setCurrentPage(1); }}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: activeLetter === "ABC" ? "var(--accent)" : "var(--bg-primary)", color: activeLetter === "ABC" ? "#fff" : "var(--text-primary)", fontSize: 12, cursor: "pointer" }}>
              ABC
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 12, padding: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {pagedGenres.map(g => (
              <button key={g} onClick={() => toggleGenre(g)}
                style={{ padding: "6px 12px", borderRadius: 16, border: "1px solid var(--border)", background: selected.has(g) ? "var(--accent)" : "var(--bg-primary)", color: selected.has(g) ? "#fff" : "var(--text-primary)", fontSize: 13, cursor: "pointer" }}>
                {g}
              </button>
            ))}
          </div>
          {pagedGenres.length === 0 && <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 20 }}>Нет жанров</p>}
        </div>

        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
            <button onClick={() => goToPage(1)} disabled={currentPage === 1} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-primary)", cursor: "pointer", fontSize: 12 }}>««</button>
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-primary)", cursor: "pointer", fontSize: 12 }}>«</button>
            {getPageNumbers().map((p, i) => typeof p === "number" ? (
              <button key={i} onClick={() => goToPage(p)} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--border)", background: currentPage === p ? "orange" : "var(--bg-primary)", color: currentPage === p ? "#fff" : "var(--text-primary)", cursor: "pointer", fontSize: 12 }}>{p}</button>
            ) : (
              <span key={i} style={{ color: "var(--text-muted)" }}>{p}</span>
            ))}
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-primary)", cursor: "pointer", fontSize: 12 }}>»</button>
            <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-primary)", cursor: "pointer", fontSize: 12 }}>»»</button>
            {showPageInput ? (
              <input type="number" value={pageInput} onChange={(e) => setPageInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handlePageInput()} onBlur={handlePageInput} autoFocus min={1} max={totalPages}
                style={{ width: 50, padding: 4, borderRadius: 4, border: "1px solid var(--accent)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12 }} />
            ) : (
              <button onClick={() => setShowPageInput(true)} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-primary)", cursor: "pointer", fontSize: 12 }}>[ ]</button>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Выбрано: {selected.size}</span>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)", cursor: "pointer" }}>Отмена</button>
            <button onClick={() => onSave(Array.from(selected))} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Сохранить</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUserState] = useState<any>(null);
  const [theme, setThemeState] = useState("light");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const localFileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"all" | "series" | "settings">("all");
  const [settingsUsername, setSettingsUsername] = useState("");
  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState("");
  const [settingsNewPassword, setSettingsNewPassword] = useState("");
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<number | null>(null);
  const [seriesDetails, setSeriesDetails] = useState<any>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesDescription, setSeriesDescription] = useState("");
  const [draggedBook, setDraggedBook] = useState<number | null>(null);
  const [dragOverBook, setDragOverBook] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"title" | "date" | "filename">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [editBook, setEditBook] = useState<Book | null>(null);
  const [editBookMeta, setEditBookMeta] = useState<any>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [editSeriesName, setEditSeriesName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadGenres, setUploadGenres] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [genreSnapshot, setGenreSnapshot] = useState("");
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [showCreateSeriesModal, setShowCreateSeriesModal] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState("");
  const [newSeriesGenres, setNewSeriesGenres] = useState("");
  const [newSeriesCoverFile, setNewSeriesCoverFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [editChapters, setEditChapters] = useState<Chapter[]>([]);
  const [editChaptersRaw, setEditChaptersRaw] = useState<any[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<number | string>>(new Set());
  const [showFormatModal, setShowFormatModal] = useState<number | null>(null);
  const [editingSeriesName, setEditingSeriesName] = useState("");
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [coverImgKey, setCoverImgKey] = useState(0);
  const [formatModalBook, setFormatModalBook] = useState<any>(null);
  const [availableFormats, setAvailableFormats] = useState<string[]>([]);
  const [formatFile, setFormatFile] = useState<File | null>(null);
  const [formatUploading, setFormatUploading] = useState(false);
  const formatFileRef = useRef<HTMLInputElement>(null);

  const openFormatModal = async (book: Book) => {
    setFormatModalBook(book);
    setShowFormatModal(book.id);
    setFormatFile(null);
    try {
      const v = await apiGetBookVersions(book.id);
      const ext = book.filename.split('.').pop() || 'fb2';
      setAvailableFormats(v.versions?.map((x: any) => x.format) || [ext]);
    } catch {
      setAvailableFormats([book.filename.split('.').pop() || 'fb2']);
    }
  };

  const handleSetPreferredFormat = async (format: string) => {
    if (!formatModalBook) return;
    try {
      await apiSetPreferredFormat(formatModalBook.id, format);
      setFormatModalBook((prev: any) => prev ? { ...prev, preferred_format: format } : null);
      setBooks((prev: Book[]) => prev.map(b => b.id === formatModalBook.id ? { ...b, preferred_format: format } : b));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddFormat = async () => {
    if (!formatFile || !formatModalBook) return;
    setFormatUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", formatFile);
      formData.append("title", formatModalBook.title);
      formData.append("group_id", String(formatModalBook.id));
      
      const token = getToken();
      console.log("Token:", token ? "exists" : "none");
      console.log("Book ID:", formatModalBook.id);
      console.log("Title:", formatModalBook.title);
      
      const res = await fetch("/api/books/upload", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}` 
        },
        body: formData,
      });
      
      const data = await res.json();
      console.log("Response:", res.status, data);
      
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      
      const v = await apiGetBookVersions(formatModalBook.id);
      setAvailableFormats(v.versions?.map((x: any) => x.format) || [formatModalBook.filename.split('.').pop()]);
      setFormatFile(null);
      alert("Формат добавлен!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFormatUploading(false);
    }
  };

  const handleDeleteFormat = async (fmt: string) => {
    if (!confirm(`Удалить формат .${fmt}?`)) return;
    try {
      await apiDeleteBookVersion(formatModalBook.id, fmt);
      setAvailableFormats(availableFormats.filter((f: string) => f !== fmt));
    } catch (err: any) {
      alert(err.message);
    }
  };

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    setUserState(u);
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    if (getToken() && (u as any).id == null) {
      apiGetMe()
        .then((me) => {
          mergeUser({
            id: me.id,
            username: me.username,
            role: me.role,
            preferred_voice: me.preferred_voice,
            preferred_language: me.preferred_language,
          });
          setUserState(getUser());
          loadSeries(me.id);
        })
        .catch(() => {});
    } else {
      loadSeries();
    }
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      setBooks(await apiMyBooks());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSeries = async (ownerId?: number) => {
    try {
      const id = ownerId ?? getUser()?.id;
      setSeriesList(await apiListSeries(id));
    } catch {}
  };

  const loadSeriesDetails = async (seriesId: number) => {
    setSeriesLoading(true);
    try {
      const data = await apiGetSeries(seriesId);
      setSeriesDetails(data);
      setEditingSeriesName(data.name || "");
      setSeriesDescription(data.description || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSeriesLoading(false);
    }
  };

  const handleSelectSeries = async (seriesId: number) => {
    if (selectedSeries === seriesId) {
      setSelectedSeries(null);
      setSeriesDetails(null);
    } else {
      setSelectedSeries(seriesId);
      await loadSeriesDetails(seriesId);
    }
  };

  const handleSeriesCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedSeries) return;
    setPendingCoverFile(e.target.files[0]);
  };

  const handleSaveCover = async () => {
    if (!pendingCoverFile || !selectedSeries) return;
    setSaveFeedback("saving");
    try {
      await apiUploadSeriesCover(selectedSeries, pendingCoverFile);
      setPendingCoverFile(null);
      setCoverImgKey(k => k + 1);
      await loadSeriesDetails(selectedSeries);
      await loadSeries();
      setSaveFeedback("saved");
      setTimeout(() => setSaveFeedback(null), 2000);
    } catch (err: any) {
      setError(err.message);
      setSaveFeedback(null);
    }
  };

  const handleCancelCover = () => setPendingCoverFile(null);

  const handleSaveDescription = async () => {
    if (!selectedSeries) return;
    setSaveFeedback("saving");
    try {
      await apiUpdateSeries(selectedSeries, { description: seriesDescription });
      await loadSeriesDetails(selectedSeries);
      await loadSeries();
      setSaveFeedback("saved");
      setTimeout(() => setSaveFeedback(null), 2000);
    } catch (err: any) {
      setError(err.message);
      setSaveFeedback(null);
    }
  };

  const handleSaveSeriesName = async () => {
    if (!selectedSeries || !editingSeriesName.trim()) return;
    setSaveFeedback("saving");
    try {
      await apiUpdateSeries(selectedSeries, { name: editingSeriesName.trim() });
      await loadSeriesDetails(selectedSeries);
      await loadSeries();
      setSaveFeedback("saved");
      setTimeout(() => setSaveFeedback(null), 2000);
    } catch (err: any) {
      setError(err.message);
      setSaveFeedback(null);
    }
  };

  const handleDragStart = (bookId: number) => {
    setDraggedBook(bookId);
  };

  const handleDragOver = (e: React.DragEvent, bookId: number) => {
    e.preventDefault();
    if (bookId !== draggedBook) {
      setDragOverBook(bookId);
    }
  };

  const handleDragLeave = () => {
    setDragOverBook(null);
  };

  const handleDrop = async (targetBookId: number) => {
    if (!selectedSeries || !seriesDetails?.books || draggedBook === null) return;
    
    const books = [...seriesDetails.books];
    const fromIdx = books.findIndex((b: any) => b.id === draggedBook);
    const toIdx = books.findIndex((b: any) => b.id === targetBookId);
    
    if (fromIdx === -1 || toIdx === -1) return;
    
    const [moved] = books.splice(fromIdx, 1);
    books.splice(toIdx, 0, moved);
    
    const bookIds = books.map((b: any) => b.id);
    try {
      await apiReorderSeriesBooks(selectedSeries, bookIds);
      await loadSeriesDetails(selectedSeries);
    } catch (err: any) {
      setError(err.message);
    }
    setDraggedBook(null);
    setDragOverBook(null);
  };

  const handleUploadClick = () => {
    fileRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
      setShowUploadModal(true);
      e.target.value = "";
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError("");
    try {
      const book = await apiUploadBook(selectedFile, editSeriesName || undefined, uploadTitle || undefined, uploadGenres || undefined, uploadDescription || undefined);
      if (coverFile) {
        try {
          await apiUploadCover(book.id, coverFile);
        } catch {}
      }
      await loadBooks();
      await loadSeries();
      setShowUploadModal(false);
      setSelectedFile(null);
      setEditSeriesName("");
      setUploadTitle("");
      setCoverFile(null);
      setUploadGenres("");
      setUploadDescription("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить эту книгу?")) return;
    try {
      await apiDeleteBook(id);
      setBooks((prev) => prev.filter((b) => b.id !== id));
      await loadSeries();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggle = async (id: number, current: boolean) => {
    try {
      await apiToggleVisibility(id, !current);
      setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, is_public: !current } : b)));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateSeries = () => {
    setNewSeriesName("");
    setNewSeriesGenres("");
    setNewSeriesCoverFile(null);
    setShowCreateSeriesModal(true);
  };

  const handleAssignSeries = async (bookId: number, seriesIds: number[]) => {
    try {
      await apiAssignToSeries(bookId, seriesIds);
      await loadBooks();
      await loadSeries();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteSeries = async (id: number, name: string) => {
    if (!confirm(`Удалить серию «${name}»?`)) return;
    try {
      await apiDeleteSeries(id);
      if (selectedSeries === id) setSelectedSeries(null);
      await loadSeries();
      await loadBooks();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const logout = () => { clearToken(); clearUser(); window.location.href = "/"; };
  const toggleTheme = () => { const n = theme === "light" ? "dark" : "light"; setTheme(n); setThemeState(n); };

  const handleOpenLocal = () => {
    localFileInputRef.current?.click();
  };

  const handleLocalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      const preview = await apiPreviewBook(file);
      sessionStorage.setItem("localBook", JSON.stringify(preview));
      router.push("/reader/local");
    } catch (err: any) {
      alert(err.message || "Failed to preview book");
    } finally {
      if (localFileInputRef.current) localFileInputRef.current.value = "";
    }
  };

  const openEditor = async (book: Book) => {
    setEditBook(book);
    setEditLoading(true);
    setExpandedChapters(new Set());
    try {
      const data = await apiGetBookStructured(book.id);
      const raw = data.chapters || [];
      setEditChaptersRaw(raw);
      setEditChapters(
        raw.map((ch: any) => ({
          id: ch.id,
          title: ch.title,
          paragraphs: (ch.paragraphs || []).map((p: any) =>
            typeof p === "string" ? p : p?.text ?? ""
          ),
        }))
      );
    } catch (err: any) {
      setError(err.message);
      setEditBook(null);
    }
    setEditLoading(false);
  };

  const closeEditor = () => {
    setEditBook(null);
    setEditChapters([]);
    setEditChaptersRaw([]);
    setExpandedChapters(new Set());
  };

  const toggleChapterExpand = (chapterId: number | string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      next.has(chapterId) ? next.delete(chapterId) : next.add(chapterId);
      return next;
    });
  };

  const updateChapterTitle = (chapterId: number | string, title: string) => {
    setEditChapters((prev) => prev.map((ch) => (ch.id === chapterId ? { ...ch, title } : ch)));
  };

  const updateParagraph = (chapterId: number | string, index: number, text: string) => {
    setEditChapters((prev) =>
      prev.map((ch) => {
        if (ch.id !== chapterId) return ch;
        const paragraphs = [...ch.paragraphs];
        paragraphs[index] = text;
        return { ...ch, paragraphs };
      })
    );
  };

  const handleSaveChapters = async () => {
    if (!editBook) return;
    setEditSaving(true);
    try {
      for (let i = 0; i < editChapters.length; i++) {
        const ch = editChapters[i];
        const raw = editChaptersRaw[i];
        const paragraphsOut = ch.paragraphs.map((text, j) => {
          const o = raw?.paragraphs?.[j];
          if (o && typeof o === "object" && o !== null && "text" in o) {
            return { ...o, text };
          }
          return {
            id: `ch-${i}-p-${j}`,
            text,
            character: null,
            emotion: null,
            bold: false,
            italic: false,
            color: null,
          };
        });
        await apiUpdateChapter(editBook.id, i, { title: ch.title, paragraphs: paragraphsOut });
      }
      closeEditor();
    } catch (err: any) {
      setError(err.message);
    }
    setEditSaving(false);
  };

  const displayBooks = useMemo(() => {
    let result = books;
    if (activeTab === "series" && selectedSeries !== null) {
      result = result.filter((b) => b.series_ids.includes(selectedSeries));
    }
    if (filter) {
      const q = filter.toLowerCase();
      result = result.filter((b) =>
        b.title.toLowerCase().includes(q) ||
        b.filename.toLowerCase().includes(q) ||
        (b.series_names && b.series_names.some(s => s.toLowerCase().includes(q)))
      );
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "title") cmp = a.title.localeCompare(b.title);
      else if (sortBy === "filename") cmp = a.filename.localeCompare(b.filename);
      else cmp = 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [books, activeTab, selectedSeries, filter, sortBy, sortDir]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
        Загрузка…
      </div>
    );
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    try {
      await apiUploadAvatar(e.target.files[0]);
      setAvatarUrl(apiGetAvatarUrl(user.id) + "?t=" + Date.now());
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
      <Navbar activeTab="profile" />
      
      <input
        ref={localFileInputRef}
        type="file"
        accept=".txt,.fb2,.epub,.vb,.vblite"
        style={{ display: "none" }}
        onChange={handleLocalFileChange}
      />

      {/* Tabs */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px 0" }}>
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
          <button
            onClick={() => { setActiveTab("all"); setSelectedSeries(null); setFilter(""); }}
            style={{
              padding: "12px 24px", border: "none", borderRadius: "10px 10px 0 0",
              background: activeTab === "all" ? "var(--accent)" : "transparent",
              color: activeTab === "all" ? "#fff" : "var(--text-secondary)",
              fontSize: 15, fontWeight: 500, cursor: "pointer",
            }}
          >
            Все книги
          </button>
          <button
            onClick={() => { setActiveTab("series"); setFilter(""); }}
            style={{
              padding: "12px 24px", border: "none", borderRadius: "10px 10px 0 0",
              background: activeTab === "series" ? "var(--accent)" : "transparent",
              color: activeTab === "series" ? "#fff" : "var(--text-secondary)",
              fontSize: 15, fontWeight: 500, cursor: "pointer",
            }}
          >
            Серии
          </button>
          <button
            onClick={() => { setActiveTab("settings"); }}
            style={{
              padding: "12px 24px", border: "none", borderRadius: "10px 10px 0 0",
              background: activeTab === "settings" ? "var(--accent)" : "transparent",
              color: activeTab === "settings" ? "#fff" : "var(--text-secondary)",
              fontSize: 15, fontWeight: 500, cursor: "pointer",
            }}
          >
            ⚙ Настройки
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px 32px", flex: 1 }}>
        {error && (
          <div style={{ background: "var(--accent-light)", border: "1px solid var(--error)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, color: "var(--error)", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              {error === "Not authenticated" ? (
                <>
                  <strong>Ошибка авторизации</strong>
                  <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.4 }}>
                    Ваша сессия устарела. Нажмите <strong>«Выйти»</strong> в навигационной панели и зайдите снова.
                  </div>
                </>
              ) : error.startsWith("Сервер временно недоступен") ? (
                <div>
                  <strong>Сервер недоступен</strong>
                  <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.4 }}>
                    {error}
                  </div>
                </div>
              ) : error}
            </div>
            <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", fontSize: 18, flexShrink: 0 }}>×</button>
          </div>
        )}

        {/* Series sub-tabs */}
        {activeTab === "series" && !selectedSeries && (
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <button onClick={handleCreateSeries} style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>+ Создать серию</button>
          </div>
        )}

        {activeTab === "series" && !selectedSeries && seriesList.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
            {seriesList.map((s) => (
              <div key={s.id} onClick={() => handleSelectSeries(s.id)} style={{ cursor: "pointer", borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-secondary)", transition: "transform 0.15s, box-shadow 0.15s", display: "flex", flexDirection: "column", height: "100%" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ aspectRatio: "2/3", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {s.cover_image ? (
                    <img src={`${apiGetSeriesCoverUrl(s.id)}?t=${coverImgKey}`} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 48 }}>📚</span>
                  )}
                </div>
                <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
                  <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 32 }}>{s.name}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.book_count} книг</p>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteSeries(s.id, s.name); }} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--error)", transition: "background 0.15s, opacity 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-light)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    title="Удалить серию">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "series" && seriesList.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
            <p style={{ fontSize: 16 }}>Пока нет серий</p>
            <p style={{ fontSize: 14, marginTop: 8 }}>Создайте серию для группировки книг</p>
          </div>
        )}

        {/* Back to series list button */}
        {activeTab === "series" && selectedSeries && (
            <button onClick={() => { setSelectedSeries(null); setSeriesDetails(null); }} style={{ marginBottom: 20, padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14 }}>
            ← К списку серий
          </button>
        )}

        {/* Series Details Panel */}
        {activeTab === "series" && selectedSeries && seriesDetails && (
          <div style={{ marginBottom: 24, padding: 28, borderRadius: 14, border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
            <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
              <div style={{ width: 160, flexShrink: 0, position: "relative" }}>
                <div style={{ aspectRatio: "2/3", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {pendingCoverFile ? (
                    <img src={URL.createObjectURL(pendingCoverFile)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : seriesDetails.cover_image ? (
                    <img key={coverImgKey} src={`/api/books/series/${selectedSeries}/cover?t=${coverImgKey}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 32 }}>📚</span>
                  )}
                </div>
                <label style={{ position: "absolute", bottom: 4, right: 4, background: "var(--accent)", color: "#fff", padding: "4px 8px", borderRadius: 4, fontSize: 10, cursor: "pointer" }}>
                  📷
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleSeriesCoverUpload} />
                </label>
                <span style={{ position: "absolute", bottom: -2, right: 4, fontSize: 8, color: user?.is_plus ? "var(--accent)" : "var(--text-muted)", whiteSpace: "nowrap" }}>{user?.is_plus ? "GIF/WEBP" : "статич."}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <input value={editingSeriesName} onChange={(e) => setEditingSeriesName(e.target.value)}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 16, fontWeight: 600 }} />
                  <button onClick={handleSaveSeriesName} disabled={!editingSeriesName.trim() || editingSeriesName.trim() === seriesDetails.name || saveFeedback === "saving"}
                    style={{ padding: "8px 16px", borderRadius: 6, background: saveFeedback === "saved" ? "var(--success)" : editingSeriesName.trim() && editingSeriesName.trim() !== seriesDetails.name ? "var(--accent)" : "var(--bg-tertiary)", color: saveFeedback === "saved" || (editingSeriesName.trim() && editingSeriesName.trim() !== seriesDetails.name) ? "#fff" : "var(--text-muted)", border: "none", fontSize: 12, cursor: saveFeedback === "saving" ? "wait" : editingSeriesName.trim() && editingSeriesName.trim() !== seriesDetails.name ? "pointer" : "not-allowed", transition: "background 0.2s" }}>
                    {saveFeedback === "saving" ? "…" : saveFeedback === "saved" ? "✓ Сохранено" : "Сохранить"}</button>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>{seriesDetails.books?.length || 0} книг</p>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Описание серии</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <textarea value={seriesDescription} onChange={(e) => setSeriesDescription(e.target.value)}
                      placeholder="Введите описание серии..."
                      rows={3}
                      style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
                    <button onClick={handleSaveDescription} disabled={saveFeedback === "saving"}
                      style={{ padding: "8px 16px", borderRadius: 6, background: saveFeedback === "saved" ? "var(--success)" : "var(--accent)", color: "#fff", border: "none", fontSize: 12, cursor: saveFeedback === "saving" ? "wait" : "pointer", alignSelf: "flex-start", transition: "background 0.2s" }}>
                      {saveFeedback === "saving" ? "…" : saveFeedback === "saved" ? "✓ Сохранено" : "Сохранить"}
                    </button>
                  </div>
                </div>
                {pendingCoverFile && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={handleSaveCover} disabled={saveFeedback === "saving"} style={{ padding: "8px 16px", borderRadius: 6, background: saveFeedback === "saving" ? "var(--bg-tertiary)" : "var(--accent)", color: "#fff", border: "none", fontSize: 12, cursor: saveFeedback === "saving" ? "wait" : "pointer", transition: "background 0.2s" }}>
                      {saveFeedback === "saving" ? "…" : "Сохранить обложку"}
                    </button>
                    <button onClick={handleCancelCover} disabled={saveFeedback === "saving"} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>Отмена</button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>Перетащите книги для изменения порядка:</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {seriesDetails.books?.map((book: any, idx: number) => {
                const isDragging = draggedBook === book.id;
                const isDragOver = dragOverBook === book.id;
                return (
                <div
                  key={book.id}
                  draggable
                  onDragStart={() => handleDragStart(book.id)}
                  onDragOver={(e) => handleDragOver(e, book.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(book.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "8px 12px", borderRadius: 8,
                    border: isDragging ? "2px solid var(--accent)" : isDragOver ? "2px dashed var(--accent)" : "1px solid var(--border)",
                    background: isDragOver ? "var(--accent-light)" : "var(--bg-primary)",
                    cursor: "grab",
                    opacity: isDragging ? 0.5 : 1,
                    transition: "border 0.15s, background 0.15s",
                    position: "relative",
                  }}
                >
                  {isDragOver && !isDragging && (
                    <div style={{ position: "absolute", left: 0, right: 0, top: -2, height: 2, background: "var(--accent)", borderRadius: 1 }} />
                  )}
                  {isDragOver && !isDragging && (
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: -2, height: 2, background: "var(--accent)", borderRadius: 1 }} />
                  )}
                  <span style={{ width: 24, textAlign: "center", fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>{idx + 1}</span>
                  <div style={{ width: 40, height: 56, borderRadius: 4, overflow: "hidden", background: "var(--bg-tertiary)", flexShrink: 0 }}>
                    {book.cover_image ? (
                      <img src={`/api/books/${book.id}/cover`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>📖</div>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{book.title}</span>
                  {book.formats && book.formats.length > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 500, color: "var(--text-secondary)" }}>{book.formats.map((f: string) => f.toUpperCase()).join(", ")}</span>
                  )}
                </div>
              )})}
            </div>

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => handleDeleteSeries(selectedSeries, seriesDetails.name)}
                style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "var(--error)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Удалить серию
              </button>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div style={{ padding: 28, borderRadius: 14, border: "1px solid var(--border)", background: "var(--bg-secondary)", marginBottom: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Настройки профиля</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Новый логин</label>
              <input value={settingsUsername} onChange={(e) => setSettingsUsername(e.target.value)} placeholder={user?.username || "Логин"}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Новый пароль</label>
              <input type="password" value={settingsNewPassword} onChange={(e) => setSettingsNewPassword(e.target.value)} placeholder="Оставьте пустым если не меняете"
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Текущий пароль <span style={{ color: "var(--error)" }}>*</span></label>
              <input type="password" value={settingsCurrentPassword} onChange={(e) => setSettingsCurrentPassword(e.target.value)} placeholder="Введите текущий пароль"
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <button onClick={async () => {
              if (!settingsCurrentPassword) { alert("Введите текущий пароль"); return; }
              try {
                const { apiUpdateProfile, setToken } = await import("@/lib/api");
                const result = await apiUpdateProfile(settingsCurrentPassword, settingsUsername || undefined, settingsNewPassword || undefined);
                if (result.username) {
                  const u = getUser();
                  if (u) { u.username = result.username; mergeUser({ username: result.username }); setUserState(getUser()); }
                }
                setSettingsUsername("");
                setSettingsCurrentPassword("");
                setSettingsNewPassword("");
                alert("Профиль обновлён!");
              } catch (err: any) { alert(err.message); }
            }}             style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              Сохранить
            </button>
          </div>
        )}

        {activeTab === "all" && (
        <div style={{ marginBottom: 24, padding: 32, borderRadius: 14, border: "2px dashed var(--border)", background: "var(--bg-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <input ref={fileRef} type="file" accept=".txt,.fb2,.epub,.vb,.vblite" style={{ display: "none" }} onChange={handleFileSelect} />
            <button type="button" onClick={handleUploadClick} disabled={uploading} style={btn("var(--accent)", "#fff", { padding: "14px 28px", fontSize: 15, fontWeight: 600, opacity: uploading ? 0.7 : 1, cursor: uploading ? "wait" : "pointer" })}>
              {uploading ? "Загрузка…" : "Загрузить книгу"}
            </button>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>.txt, .fb2, .epub, .vb, .vblite</span>
          </div>
        </div>
        )}

        {showUploadModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "var(--bg-secondary)", padding: 24, borderRadius: 12, width: "90%", maxWidth: 600 }}>
              <h2 style={{ marginBottom: 16, fontSize: 20, fontWeight: 600 }}>Загрузка книги</h2>
              <p style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 14 }}>Файл: <strong>{selectedFile?.name}</strong></p>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>Название книги</label>
                <input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Введите название (необязательно)"
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>Обложка</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  style={{ fontSize: 14, color: "var(--text-primary)" }}
                />
                {coverFile && <span style={{ marginLeft: 8, fontSize: 13, color: "var(--accent)" }}>{coverFile.name}</span>}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>Серия</label>
                <button
                  onClick={() => setShowSeriesModal(true)}
                  style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", width: "100%", textAlign: "left", fontSize: 14 }}
                >
                  {editSeriesName ? editSeriesName : "Выбрать серию"}
                </button>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>Жанры</label>
                <button
                  onClick={() => { setGenreSnapshot(uploadGenres); setShowGenreModal(true); }}
                  style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", width: "100%", textAlign: "left", fontSize: 14 }}
                >
                  {uploadGenres ? uploadGenres.split(",").length + " выбрано" : "Выбрать жанры"}
                </button>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>Описание</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={4}
                  placeholder="Краткое описание книги..."
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button onClick={() => { setShowUploadModal(false); setSelectedFile(null); setEditSeriesName(""); setUploadTitle(""); setUploadGenres(""); setUploadDescription(""); setShowSeriesModal(false); setShowCreateSeriesModal(false); setNewSeriesName(""); }} style={{ ...btn("var(--bg-tertiary)", "var(--text-primary)"), padding: "12px 24px", borderRadius: 10, fontSize: 14 }}>Отмена</button>
                <button onClick={handleUploadSubmit} disabled={uploading} style={{ ...btn("var(--accent)", "#fff"), padding: "12px 24px", borderRadius: 10, fontSize: 14 }}>Загрузить</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "all" && (<>
        {/* Search + Sort */}
        {books.length > 0 && (
          <div style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Поиск по названию, файлу или серии..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                flex: 1, minWidth: 200, padding: "10px 14px", borderRadius: 10,
                border: "1px solid var(--border)", background: "var(--bg-secondary)",
                color: "var(--text-primary)", fontSize: 14, outline: "none",
              }}
            />
            <select
              value={`${sortBy}-${sortDir}`}
              onChange={(e) => {
                const [s, d] = e.target.value.split("-");
                setSortBy(s as any);
                setSortDir(d as any);
              }}
              style={{
                padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)",
                background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, outline: "none", cursor: "pointer",
              }}
            >
              <option value="date-desc">По дате ↓</option>
              <option value="date-asc">По дате ↑</option>
              <option value="title-asc">По названию A-Z</option>
              <option value="title-desc">По названию Z-A</option>
              <option value="filename-asc">По расширению A-Z</option>
              <option value="filename-desc">По расширению Z-A</option>
            </select>
          </div>
        )}

        {/* Books list */}
        {displayBooks.length === 0 && books.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
            <p style={{ fontSize: 16 }}>Пока нет книг</p>
            <p style={{ fontSize: 14 }}>Загрузите файл выше — поддерживаются txt, fb2, epub, vb, vblite</p>
          </div>
        ) : displayBooks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 14 }}>
            Нет книг{filter ? ` по запросу "${filter}"` : selectedSeries !== null ? " в этой серии" : ""}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {displayBooks.map((book) => {
              const isVox = book.filename.endsWith(".vb") || book.filename.endsWith(".vblite");
              return (
                <div
                  key={book.id}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "16px 24px", borderRadius: 14, border: "1px solid var(--border)",
                    background: "var(--bg-secondary)", transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
<div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16, alignItems: "center" }}>
                     <div style={{ width: 58, height: 82, borderRadius: 8, overflow: "hidden", background: "var(--bg-tertiary)", flexShrink: 0 }}>
                       {book.cover_image ? (
                         <img src={`/api/books/${book.id}/cover`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                       ) : (
                         <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>📖</div>
                       )}
                     </div>
                     <div style={{ flex: 1, minWidth: 0 }}>
                       <Link href={`/book/${book.id}`} style={{ fontWeight: 500, color: "var(--text-primary)", textDecoration: "none", fontSize: 15 }}>
                         {book.title}
                         {isVox && (
                           <span style={{ marginLeft: 8, fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--accent-light)", color: "var(--accent)", fontWeight: 600 }}>
                             VOXBOOK
                           </span>
                         )}
                       </Link>
<div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 500 }}>{book.formats?.map((f: string) => f.toUpperCase()).join(", ") || book.filename.split('.').pop()?.toUpperCase()}</span>
                         {book.series_names.length > 0 && (
                           <span style={{ color: "var(--accent)", fontWeight: 500 }}>{book.series_names.join(", ")}</span>
                         )}
                       </div>
                     </div>
                   </div>
<div style={{ display: "flex", gap: 6, marginLeft: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <Link href={`/reader/${book.id}`} style={{ padding: "6px 14px", borderRadius: 6, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
                        Читать
                      </Link>
                      <button onClick={() => setEditBookMeta({ id: book.id, title: book.title, genres: book.genres || "", description: book.description || "", series_ids: book.series_ids || [] })} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>
                        ✏️
                      </button>
                      <button onClick={() => openFormatModal(book)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>
                        📥 Форматы
                      </button>
                      <button onClick={() => handleDelete(book.id)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "var(--error)", color: "#fff", fontSize: 12, cursor: "pointer" }}>
                        🗑
                      </button>
                    </div>
                 </div>
              );
            })}
          </div>
        )}
      </>)}
      </div>

      {/* Edit Modal */}
      {editBook && (
        <div onClick={closeEditor} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-primary)", borderRadius: 16, border: "1px solid var(--border)", width: "100%", maxWidth: 1000, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Редактор глав</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{editBook.title}</div>
              </div>
              <button onClick={closeEditor} style={{ background: "none", border: "none", fontSize: 20, color: "var(--text-muted)", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {editLoading ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Загрузка глав…</div>
              ) : editChapters.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Главы не найдены</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {editChapters.map((chapter) => (
                    <div key={chapter.id} style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--bg-secondary)" }}>
                        <input type="text" value={chapter.title} onChange={(e) => updateChapterTitle(chapter.id, e.target.value)}
                          style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }} />
                        <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{chapter.paragraphs.length} ¶</span>
                        <button onClick={() => toggleChapterExpand(chapter.id)}
                          style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: expandedChapters.has(chapter.id) ? "var(--accent-light)" : "transparent", color: expandedChapters.has(chapter.id) ? "var(--accent)" : "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
                          {expandedChapters.has(chapter.id) ? "Свернуть" : "Текст"}
                        </button>
                      </div>
                      {expandedChapters.has(chapter.id) && (
                        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--border)" }}>
                          {chapter.paragraphs.map((para, idx) => (
                            <textarea key={idx} value={para} onChange={(e) => updateParagraph(chapter.id, idx, e.target.value)} rows={3}
                              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                          ))}
        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 24px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
              <button onClick={closeEditor} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 14, cursor: "pointer" }}>Закрыть</button>
              <button onClick={handleSaveChapters} disabled={editSaving}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: editSaving ? "wait" : "pointer", opacity: editSaving ? 0.7 : 1 }}>
                {editSaving ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editBookMeta && (
        <BookEditModal
          book={editBookMeta}
          onClose={() => setEditBookMeta(null)}
          onSave={() => { loadBooks(); }}
        />
      )}

        {/* Genre Modal */}
        {showGenreModal && (
          <GenreModal selectedGenres={genreSnapshot ? genreSnapshot.split(",") : []} onSave={(g) => { setUploadGenres(g.join(",")); setShowGenreModal(false); }} onClose={() => { setUploadGenres(genreSnapshot); setShowGenreModal(false); }} />
        )}

        {/* Series Modal */}
        {showSeriesModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, width: "90%", maxWidth: 600, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: 24, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: 20, fontWeight: 600 }}>Выбор серии</h2>
                <button onClick={() => setShowSeriesModal(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
                {seriesList.length === 0 ? (
                  <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>Нет серий</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {seriesList.map((s) => (
                      <button key={s.id} onClick={() => { setEditSeriesName(s.name); setShowSeriesModal(false); }}
                        style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", background: editSeriesName === s.name ? "var(--accent)" : "var(--bg-primary)", color: editSeriesName === s.name ? "#fff" : "var(--text-primary)", cursor: "pointer", textAlign: "left", fontSize: 14 }}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: 20, borderTop: "1px solid var(--border)" }}>
                <button onClick={() => { setShowSeriesModal(false); setShowCreateSeriesModal(true); }}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px dashed var(--border)", background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: 14 }}>
                  + Создать новую серию
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Series Modal */}
        {showCreateSeriesModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2001 }} onClick={() => { setShowCreateSeriesModal(false); }}>
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, width: "90%", maxWidth: 600, padding: 24 }} onClick={(e) => e.stopPropagation()}>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Создать серию</h2>
              <input value={newSeriesName} onChange={(e) => setNewSeriesName(e.target.value)} placeholder="Название серии"
                style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", marginBottom: 16, boxSizing: "border-box", fontSize: 14 }} />
              <input value={newSeriesGenres} onChange={(e) => setNewSeriesGenres(e.target.value)} placeholder="Описание серии"
                style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", marginBottom: 16, boxSizing: "border-box", fontSize: 14 }} />
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 10, border: "1px dashed var(--border)", background: "var(--bg-primary)", cursor: "pointer", marginBottom: 20, fontSize: 14, color: "var(--text-secondary)" }}>
                {newSeriesCoverFile ? newSeriesCoverFile.name : "➕ Загрузить обложку"}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setNewSeriesCoverFile(e.target.files?.[0] || null)} />
              </label>
              <div style={{ display: "flex", gap: 14, justifyContent: "flex-end" }}>
                <button onClick={() => { setShowCreateSeriesModal(false); setNewSeriesName(""); setNewSeriesGenres(""); setNewSeriesCoverFile(null); }} style={{ padding: "12px 24px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-tertiary)", cursor: "pointer", color: "var(--text-primary)", fontSize: 14 }}>Отмена</button>
                <button onClick={async () => {
                  if (!newSeriesName.trim()) return;
                  try {
                    const created = await apiCreateSeries(newSeriesName.trim(), newSeriesGenres.trim() || undefined);
                    if (newSeriesCoverFile) {
                      await apiUploadSeriesCover(created.id, newSeriesCoverFile);
                    }
                    await loadSeries();
                    setEditSeriesName(newSeriesName.trim());
                    setShowCreateSeriesModal(false);
                    setShowSeriesModal(true);
                    setNewSeriesName("");
                    setNewSeriesGenres("");
                    setNewSeriesCoverFile(null);
                  } catch (err: any) { alert(err.message); }
                }} disabled={!newSeriesName.trim()} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", cursor: newSeriesName.trim() ? "pointer" : "not-allowed", fontSize: 14 }}>Создать</button>
              </div>
            </div>
          </div>
        )}

        {/* Format Download Modal */}
        {showFormatModal && formatModalBook && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowFormatModal(null)}>
            <div style={{ background: "var(--bg-secondary)", padding: 24, borderRadius: 12, width: "90%", maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginBottom: 20, fontSize: 20, fontWeight: 600 }}>Форматы "{formatModalBook.title}"</h3>
              
              {/* Скачать */}
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>Скачать:</p>
              {formatModalBook?.formats?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {formatModalBook.formats.includes("fb2") && (
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <button onClick={() => apiDownloadBook(formatModalBook.id, "fb2")} style={{ flex: 1, padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", textAlign: "left", fontSize: 14 }}>
                        📖 .fb2
                      </button>
                      {formatModalBook.formats.length > 1 && (
                        <button onClick={() => handleDeleteFormat("fb2")} style={{ padding: "10px", borderRadius: 6, border: "none", background: "var(--error-light)", color: "var(--error)", cursor: "pointer", fontSize: 13 }}>🗑</button>
                      )}
                    </div>
                  )}
                  {formatModalBook.formats.includes("epub") && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button onClick={() => apiDownloadBook(formatModalBook.id, "epub")} style={{ flex: 1, padding: "10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", textAlign: "left" }}>
                        📖 .epub
                      </button>
                      {formatModalBook.formats.length > 1 && (
                        <button onClick={() => handleDeleteFormat("epub")} style={{ padding: "8px", borderRadius: 4, border: "none", background: "var(--error-light)", color: "var(--error)", cursor: "pointer", fontSize: 12 }}>🗑</button>
                      )}
                    </div>
                  )}
                  {formatModalBook.formats.includes("txt") && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button onClick={() => apiDownloadBook(formatModalBook.id, "txt")} style={{ flex: 1, padding: "10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", textAlign: "left" }}>
                        📖 .txt
                      </button>
                      {formatModalBook.formats.length > 1 && (
                        <button onClick={() => handleDeleteFormat("txt")} style={{ padding: "8px", borderRadius: 4, border: "none", background: "var(--error-light)", color: "var(--error)", cursor: "pointer", fontSize: 12 }}>🗑</button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", marginBottom: 16 }}>Нет форматов</div>
              )}

              {/* Формат по умолчанию */}
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, marginTop: 16 }}>Формат по умолчанию:</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {formatModalBook?.formats?.map((format: string) => (
                  <button
                    key={format}
                    onClick={() => handleSetPreferredFormat(format)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: formatModalBook?.preferred_format === format ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: formatModalBook?.preferred_format === format ? "var(--accent-light)" : "var(--bg-primary)",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ color: formatModalBook?.preferred_format === format ? "var(--accent)" : "var(--text-muted)" }}>
                      {formatModalBook?.preferred_format === format ? "✓" : "○"}
                    </span>
                    <span style={{ textTransform: "uppercase" }}>{format}</span>
                    {formatModalBook?.preferred_format === format && (
                      <span style={{ fontSize: 11, color: "var(--accent)", marginLeft: "auto" }}>по умолчанию</span>
                    )}
                  </button>
                ))}
              </div>
              
              {/* Добавить формат */}
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Добавить формат:</p>
              <input
                type="file"
                accept=".fb2,.epub,.txt"
                ref={formatFileRef}
                onChange={(e) => setFormatFile(e.target.files?.[0] || null)}
                style={{ display: "none" }}
              />
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button
                  onClick={() => formatFileRef.current?.click()}
                  style={{ flex: 1, padding: "10px", borderRadius: 6, border: "1px dashed var(--border)", background: "var(--bg-primary)", color: "var(--text-secondary)", cursor: "pointer", textAlign: "center" }}
                >
                  {formatFile ? formatFile.name : "Выбрать файл..."}
                </button>
                {formatFile && (
                  <button onClick={handleAddFormat} disabled={formatUploading} style={{ padding: "10px 16px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: formatUploading ? "wait" : "pointer" }}>
                    {formatUploading ? "..." : "Загрузить"}
                  </button>
                )}
              </div>
              
              <button onClick={() => setShowFormatModal(null)} style={{ width: "100%", padding: "10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-secondary)", cursor: "pointer", marginTop: 12 }}>Закрыть</button>
            </div>
          </div>
        )}
    </div>
  );
}
