"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getUser, clearToken, clearUser, getTheme, setTheme,
  apiMyBooks, apiUploadBook, apiDeleteBook, apiToggleVisibility,
  apiGetBookStructured, apiUpdateChapter, apiDownloadVblite,
  apiCreateSeries, apiListSeries, apiDeleteSeries, apiAssignToSeries,
  apiUploadCover, apiUpdateMetadata, apiGetComments, apiCreateComment, apiDeleteComment,
  apiPreviewBook,
} from "@/lib/api";

interface Book {
  id: number;
  title: string;
  filename: string;
  sha256: string;
  is_public: boolean;
  owner_id: number;
  owner_username: string;
  has_structure: boolean;
  series_name: string;
  series_id: number | null;
  cover_image: string | null;
  genres: string | null;
  description: string | null;
  comment_count: number;
}

interface Chapter {
  id: number;
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
  const [editChapters, setEditChapters] = useState<Chapter[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    setUserState(u);
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const files = fileRef.current?.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    let uploaded = 0;
    const errors: string[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const book = await apiUploadBook(files[i], false);
        if (activeTab === "series" && selectedSeries !== null) {
          await apiAssignToSeries(book.id, selectedSeries);
        }
        uploaded++;
      } catch (err: any) {
        errors.push(`${files[i].name}: ${err.message}`);
      }
    }
    await loadBooks();
    await loadSeries();
    if (fileRef.current) fileRef.current.value = "";
    setUploading(false);
    if (errors.length > 0) setError(`${uploaded} uploaded, ${errors.length} failed: ${errors.join("; ")}`);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this book?")) return;
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

  const handleAssignSeries = async (bookId: number, seriesId: number | null) => {
    try {
      await apiAssignToSeries(bookId, seriesId);
      await loadBooks();
      await loadSeries();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateSeries = async () => {
    const name = prompt("Название серии:");
    if (!name) return;
    try {
      await apiCreateSeries(name);
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
      setEditChapters(data.chapters || []);
    } catch (err: any) {
      setError(err.message);
      setEditBook(null);
    }
    setEditLoading(false);
  };

  const closeEditor = () => { setEditBook(null); setEditChapters([]); setExpandedChapters(new Set()); };

  const toggleChapterExpand = (chapterId: number) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      next.has(chapterId) ? next.delete(chapterId) : next.add(chapterId);
      return next;
    });
  };

  const updateChapterTitle = (chapterId: number, title: string) => {
    setEditChapters((prev) => prev.map((ch) => (ch.id === chapterId ? { ...ch, title } : ch)));
  };

  const updateParagraph = (chapterId: number, index: number, text: string) => {
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
        await apiUpdateChapter(editBook.id, i, { title: ch.title, paragraphs: ch.paragraphs });
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
      result = result.filter((b) => b.series_id === selectedSeries);
    }
    if (filter) {
      const q = filter.toLowerCase();
      result = result.filter((b) =>
        b.title.toLowerCase().includes(q) ||
        b.filename.toLowerCase().includes(q) ||
        (b.series_name && b.series_name.toLowerCase().includes(q))
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
        Loading...
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
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>My Library</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{user?.username} ({user?.role})</span>
          <Link href="/public" style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", textDecoration: "none", fontSize: 13 }}>Public</Link>
           <button onClick={toggleTheme} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
             {theme === "light" ? "🌙" : "☀"}
           </button>
           <button onClick={handleOpenLocal} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>
             Open Local
           </button>
           <button onClick={logout} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Logout</button>
        </div>
      </nav>

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
        <form onSubmit={handleUpload} style={{ marginBottom: 24, padding: 24, borderRadius: 14, border: "2px dashed var(--border)", background: "var(--bg-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <input ref={fileRef} type="file" accept=".txt,.fb2,.epub,.vb,.vblite" multiple style={{ fontSize: 14, color: "var(--text-secondary)" }} />
            <button type="submit" disabled={uploading} style={btn("var(--accent)", "#fff", { padding: "10px 20px", fontSize: 14, fontWeight: 600, opacity: uploading ? 0.7 : 1, cursor: uploading ? "wait" : "pointer" })}>
              {uploading ? "Uploading..." : "Upload Books"}
            </button>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>.txt, .fb2, .epub, .vb, .vblite</span>
            {activeTab === "series" && selectedSeries !== null && (
              <span style={{ fontSize: 12, color: "var(--accent)" }}>
                → будет добавлено в «{seriesList.find((s) => s.id === selectedSeries)?.name}»
              </span>
            )}
          </div>
        </form>

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
              <option value="filename-asc">По имени файла A-Z</option>
              <option value="filename-desc">По имени файла Z-A</option>
            </select>
          </div>
        )}

        {/* Books list */}
        {displayBooks.length === 0 && books.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
            <p style={{ fontSize: 16 }}>No books yet</p>
            <p style={{ fontSize: 14 }}>Upload your first book above</p>
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
                      <span>{book.filename}</span>
                      {book.series_name && (
                        <span style={{ color: "var(--accent)", fontWeight: 500 }}>{book.series_name}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginLeft: 16, alignItems: "center", flexWrap: "wrap" }}>
                    {/* В серию */}
                    <select
                      value={book.series_id ?? ""}
                      onChange={(e) => handleAssignSeries(book.id, e.target.value ? Number(e.target.value) : null)}
                      style={{
                        padding: "3px 6px", borderRadius: 6, border: "1px solid var(--border)",
                        background: "var(--bg-secondary)", color: "var(--text-secondary)",
                        fontSize: 11, cursor: "pointer", outline: "none",
                      }}
                    >
                      <option value="">— без серии —</option>
                      {seriesList.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button onClick={() => handleToggle(book.id, book.is_public)}
                      style={btn(book.is_public ? "rgba(34,197,94,0.1)" : "var(--bg-tertiary)", book.is_public ? "var(--success)" : "var(--text-muted)", { fontSize: 12 })}>
                      {book.is_public ? "Public" : "Private"}
                    </button>
                     <Link href={`/book/${book.id}`} style={{ padding: "4px 12px", borderRadius: 6, background: "var(--accent-light)", color: "var(--accent)", textDecoration: "none", fontSize: 12, fontWeight: 500 }}>
                       Read
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
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Edit Chapters</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{editBook.title}</div>
              </div>
              <button onClick={closeEditor} style={{ background: "none", border: "none", fontSize: 20, color: "var(--text-muted)", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {editLoading ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading chapters...</div>
              ) : editChapters.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No chapters found</div>
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
                          {expandedChapters.has(chapter.id) ? "Hide" : "Edit"}
                        </button>
                      </div>
                      {expandedChapters.has(chapter.id) && (
                        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--border)" }}>
                          {chapter.paragraphs.map((para, idx) => (
                            <textarea key={idx} value={para} onChange={(e) => updateParagraph(chapter.id, idx, e.target.value)} rows={3}
                              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                          ))}
          <input
            ref={localFileInputRef}
            type="file"
            accept=".txt,.fb2,.epub,.vb,.vblite"
            style={{ display: "none" }}
            onChange={handleLocalFileChange}
          />
        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 24px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
              <button onClick={closeEditor} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 14, cursor: "pointer" }}>Close</button>
              <button onClick={handleSaveChapters} disabled={editSaving}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: editSaving ? "wait" : "pointer", opacity: editSaving ? 0.7 : 1 }}>
                {editSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
