"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getUser, clearToken, clearUser, getTheme, setTheme, mergeUser, getToken,
  apiMyBooks, apiUploadBook, apiDeleteBook, apiToggleVisibility,
  apiGetBookStructured, apiUpdateChapter, apiDownloadVblite,
  apiCreateSeries, apiListSeries, apiDeleteSeries, apiAssignToSeries,
  apiPreviewBook, apiGetMe, apiUploadCover,
} from "@/lib/api";
import { GENRES, getGenresByLetter, searchGenres } from "@/lib/genres";

const ITEMS_PER_PAGE = 30;
const RUSSIAN_ALPHABET = "АБВГДЕЁЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ".split("");
const ENGLISH_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

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

export const dynamic = "force-dynamic";

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

export default function ProfilePage() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUserState] = useState<any>(null);
  const [theme, setThemeState] = useState("light");
  const [filter, setFilter] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const localFileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"all" | "series">("all");
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"title" | "date" | "filename">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [editBook, setEditBook] = useState<Book | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [editSeriesName, setEditSeriesName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadGenres, setUploadGenres] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [showCreateSeriesModal, setShowCreateSeriesModal] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [editChapters, setEditChapters] = useState<Chapter[]>([]);
  const [editChaptersRaw, setEditChaptersRaw] = useState<any[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<number | string>>(new Set());

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
        })
        .catch(() => {});
    }
    loadBooks();
    loadSeries();
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

  const loadSeries = async () => {
    try {
      setSeriesList(await apiListSeries());
    } catch {}
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

  const handleCreateSeries = async () => {
    const name = prompt("Название новой серии:");
    if (!name) return;
    const clean = name.replace(/[.,;:!?'"()[\]{}~`@#$%^&*+=<>]/g, "").trim();
    if (!clean) {
      alert("Название не может состоять только из спецсимволов");
      return;
    }
    if (name !== clean) {
      alert(`Название серии не должно содержать спецсимволы. Используйте: ${clean}`);
      return;
    }
    try {
      await apiCreateSeries(name);
      await loadSeries();
    } catch (err: any) {
      alert(err.message);
    }
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

  const logout = () => { clearToken(); clearUser(); router.push("/"); };
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

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Nav */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>🦊 FoxBooks</Link>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>Мои книги</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{user?.username} ({user?.role})</span>
          <Link href="/public" style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", textDecoration: "none", fontSize: 13 }}>Публичная библиотека</Link>
           <button onClick={toggleTheme} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
             {theme === "light" ? "🌙" : "☀"}
           </button>
           <button onClick={handleOpenLocal} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>
             Локальная книга
           </button>
           <button onClick={logout} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Выход</button>
        </div>
      </nav>
      <input
        ref={localFileInputRef}
        type="file"
        accept=".txt,.fb2,.epub,.vb,.vblite"
        style={{ display: "none" }}
        onChange={handleLocalFileChange}
      />

      {/* Tabs */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 24px 0" }}>
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
          <button
            onClick={() => { setActiveTab("all"); setSelectedSeries(null); setFilter(""); }}
            style={{
              padding: "10px 20px", border: "none", borderRadius: "8px 8px 0 0",
              background: activeTab === "all" ? "var(--accent)" : "transparent",
              color: activeTab === "all" ? "#fff" : "var(--text-secondary)",
              fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}
          >
            Все книги
          </button>
          <button
            onClick={() => { setActiveTab("series"); setFilter(""); }}
            style={{
              padding: "10px 20px", border: "none", borderRadius: "8px 8px 0 0",
              background: activeTab === "series" ? "var(--accent)" : "transparent",
              color: activeTab === "series" ? "#fff" : "var(--text-secondary)",
              fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}
          >
            Серии
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 24px 32px" }}>
        {error && (
          <div style={{ background: "var(--accent-light)", border: "1px solid var(--error)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, color: "var(--error)", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {error}
            <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", fontSize: 18 }}>×</button>
          </div>
        )}

        {/* Series sub-tabs */}
        {activeTab === "series" && (
          <div style={{ marginBottom: 16, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={handleCreateSeries} style={pill(false)}>+ Создать серию</button>
            {seriesList.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setSelectedSeries(selectedSeries === s.id ? null : s.id)}
                  style={pill(selectedSeries === s.id)}
                >
                  {s.name} ({s.book_count})
                </button>
                <button
                  onClick={() => handleDeleteSeries(s.id, s.name)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12, padding: "2px 4px" }}
                  title="Удалить серию"
                >
                  ×
                </button>
              </div>
            ))}
            {seriesList.length === 0 && (
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Нет серий</span>
            )}
          </div>
        )}

        {/* Upload */}
        <div style={{ marginBottom: 24, padding: 24, borderRadius: 14, border: "2px dashed var(--border)", background: "var(--bg-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <input ref={fileRef} type="file" accept=".txt,.fb2,.epub,.vb,.vblite" style={{ display: "none" }} onChange={handleFileSelect} />
            <button type="button" onClick={handleUploadClick} disabled={uploading} style={btn("var(--accent)", "#fff", { padding: "10px 20px", fontSize: 14, fontWeight: 600, opacity: uploading ? 0.7 : 1, cursor: uploading ? "wait" : "pointer" })}>
              {uploading ? "Загрузка…" : "Загрузить книгу"}
            </button>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>.txt, .fb2, .epub, .vb, .vblite</span>
          </div>
        </div>

        {showUploadModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "var(--bg-secondary)", padding: 24, borderRadius: 12, width: "90%", maxWidth: 400 }}>
              <h2 style={{ marginBottom: 16, fontSize: 20, fontWeight: 600 }}>Загрузка книги</h2>
              <p style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 14 }}>Файл: <strong>{selectedFile?.name}</strong></p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Название книги</label>
                <input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Введите название (необязательно)"
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Обложка</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  style={{ fontSize: 13, color: "var(--text-primary)" }}
                />
                {coverFile && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--accent)" }}>{coverFile.name}</span>}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Серия</label>
                <button
                  onClick={() => setShowSeriesModal(true)}
                  style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", width: "100%", textAlign: "left" }}
                >
                  {editSeriesName ? editSeriesName : "Выбрать серию"}
                </button>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Жанры</label>
                <button
                  onClick={() => setShowGenreModal(true)}
                  style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", width: "100%", textAlign: "left" }}
                >
                  {uploadGenres ? uploadGenres.split(",").length + " выбрано" : "Выбрать жанры"}
                </button>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Описание</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                  placeholder="Краткое описание книги..."
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                />
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button onClick={() => { setShowUploadModal(false); setSelectedFile(null); setEditSeriesName(""); setUploadTitle(""); setUploadGenres(""); setUploadDescription(""); setShowSeriesModal(false); setShowCreateSeriesModal(false); setNewSeriesName(""); }} style={btn("var(--bg-tertiary)", "var(--text-primary)")}>Отмена</button>
                <button onClick={handleUploadSubmit} disabled={uploading} style={btn("var(--accent)", "#fff")}>Загрузить</button>
              </div>
            </div>
          </div>
        )}

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
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {displayBooks.map((book) => {
              const isVox = book.filename.endsWith(".vb") || book.filename.endsWith(".vblite");
              return (
                <div
                  key={book.id}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 20px", borderRadius: 12, border: "1px solid var(--border)",
                    background: "var(--bg-secondary)", transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
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
                        <span>{book.filename.split('.').pop()?.toLowerCase() ? '.' + book.filename.split('.').pop()?.toLowerCase() : ''}</span>
                       {book.series_names.length > 0 && (
                         <span style={{ color: "var(--accent)", fontWeight: 500 }}>{book.series_names.join(", ")}</span>
                       )}
                     </div>
                  </div>
                   <div style={{ display: "flex", gap: 6, marginLeft: 16, alignItems: "center", flexWrap: "wrap" }}>
                     {/* В серию */}
                     <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                       <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Серии:</label>
                       <select
                         multiple
                         value={book.series_ids.map(String)}
                         onChange={(e) => {
                           const selected = Array.from(e.target.selectedOptions).map(opt => Number(opt.value));
                           handleAssignSeries(book.id, selected);
                         }}
                         style={{
                           padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)",
                           background: "var(--bg-secondary)", color: "var(--text-secondary)",
                           fontSize: 13, cursor: "pointer", outline: "none", minWidth: 140, minHeight: 36
                         }}
                       >
                         {seriesList.map((s) => (
                           <option key={s.id} value={s.id}>{s.name}</option>
                         ))}
                       </select>
                      </div>
                      <Link href={`/reader/${book.id}`} style={{ padding: "4px 12px", borderRadius: 6, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
                       Читать
                     </Link>
                     <Link href={`/book/${book.id}`} style={{ padding: "4px 12px", borderRadius: 6, background: "var(--accent-light)", color: "var(--accent)", textDecoration: "none", fontSize: 12, fontWeight: 500 }}>
                       Карточка
                     </Link>
                    {book.has_structure && (
                      <button onClick={() => openEditor(book)} style={btn("transparent", "var(--text-muted)", { fontSize: 12 })}>✏️</button>
                    )}
                    {book.has_structure && (
                      <button onClick={() => apiDownloadVblite(book.id)} title="Скачать vblite" style={btn("transparent", "var(--text-muted)", { fontSize: 12 })}>💾</button>
                    )}
                    <button onClick={() => handleDelete(book.id)} style={btn("transparent", "var(--text-muted)", { fontSize: 12 })}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editBook && (
        <div onClick={closeEditor} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-primary)", borderRadius: 16, border: "1px solid var(--border)", width: "100%", maxWidth: 800, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
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

        {/* Genre Modal */}
        {showGenreModal && (
          <GenreModal
            selectedGenres={uploadGenres ? uploadGenres.split(",").map(g => g.trim()).filter(g => g) : []}
            onSave={(selected) => setUploadGenres(selected.join(", "))}
            onClose={() => setShowGenreModal(false)}
          />
        )}

        {/* Series Modal */}
        {showSeriesModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, width: "90%", maxWidth: 400, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: 20, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: 18, fontWeight: 600 }}>Выбор серии</h2>
                <button onClick={() => setShowSeriesModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
                {seriesList.length === 0 ? (
                  <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>Нет серий</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {seriesList.map((s) => (
                      <button key={s.id} onClick={() => { setEditSeriesName(s.name); setShowSeriesModal(false); }}
                        style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: editSeriesName === s.name ? "var(--accent)" : "var(--bg-primary)", color: editSeriesName === s.name ? "#fff" : "var(--text-primary)", cursor: "pointer", textAlign: "left" }}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
                <button onClick={() => { setShowSeriesModal(false); setShowCreateSeriesModal(true); }}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px dashed var(--border)", background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: 14 }}>
                  + Создать новую серию
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Series Modal */}
        {showCreateSeriesModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2001 }}>
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, width: "90%", maxWidth: 350, padding: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Создать серию</h2>
              <input value={newSeriesName} onChange={(e) => setNewSeriesName(e.target.value)} placeholder="Название серии"
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", marginBottom: 16, boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button onClick={() => { setShowCreateSeriesModal(false); setNewSeriesName(""); }} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-tertiary)", cursor: "pointer" }}>Отмена</button>
                <button onClick={async () => {
                  if (!newSeriesName.trim()) return;
                  try {
                    await apiCreateSeries(newSeriesName.trim());
                    await loadSeries();
                    setEditSeriesName(newSeriesName.trim());
                    setShowCreateSeriesModal(false);
                    setNewSeriesName("");
                  } catch (err: any) { alert(err.message); }
                }} disabled={!newSeriesName.trim()} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: newSeriesName.trim() ? "pointer" : "not-allowed" }}>Создать</button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
