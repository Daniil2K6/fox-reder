"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getUser, clearToken, clearUser, getTheme, setTheme,
  apiAdminUsers, apiAdminBooks, apiAdminSeries,
  apiAdminDeleteBook, apiAdminDeleteSeries,
  apiAdminBanUser, apiAdminDeleteUser, apiAdminToggleBookVisibility,
  apiAdminUpdateUser, apiAdminCreateUser,
  apiRenameBook, apiUpdateMetadata, apiUpdateSeries,
  apiGetCoverUrl, apiGetSeriesCoverUrl, apiGetAvatarUrl,
  apiAdminSupportTickets, apiSupportTicket, apiReplySupportTicket, apiAdminUpdateTicketStatus,
} from "@/lib/api";
import { GenreSelector } from "@/components/GenreSelector";
import { BookEditModal } from "@/components/BookEditModal";
import { Navbar } from "@/components/Navbar";

type Tab = "users" | "books" | "series" | "support";

export default function AdminPage() {
  const router = useRouter();
  const [user, setUserState] = useState<any>(null);
  const [theme, setThemeState] = useState("light");
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [users, setUsers] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookPage, setBookPage] = useState(1);
  const [bookTotalPages, setBookTotalPages] = useState(1);
  const [bookSearch, setBookSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [seriesSearch, setSeriesSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{type: string; id: number; name: string} | null>(null);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [selectedSupportTicket, setSelectedSupportTicket] = useState<any>(null);
  const [supportReply, setSupportReply] = useState("");
  const [supportSearch, setSupportSearch] = useState("");
  const [supportTab, setSupportTab] = useState<"open" | "closed">("open");
  const [editBookData, setEditBookData] = useState<any>(null);
  const [editSeriesId, setEditSeriesId] = useState<number | null>(null);
  const [editSeriesName, setEditSeriesName] = useState("");
  const [editUserData, setEditUserData] = useState<{id: number; username: string} | null>(null);
  const [editUserUsername, setEditUserUsername] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== "admin") {
      router.push("/");
      return;
    }
    setUserState(u);
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "users") {
        setUsers(await apiAdminUsers(userSearch || undefined));
      } else if (activeTab === "books") {
        const data = await apiAdminBooks(bookPage, 20, bookSearch || undefined);
        setBooks(data.books);
        setBookTotalPages(data.pages);
      } else if (activeTab === "series") {
        setSeries(await apiAdminSeries(seriesSearch || undefined));
      } else if (activeTab === "support") {
        setSupportTickets(await apiAdminSupportTickets());
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, bookPage]);

  const logout = () => {
    clearToken();
    clearUser();
    router.push("/");
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    setThemeState(next);
  };

  const handleDeleteBook = async (bookId: number) => {
    try {
      await apiAdminDeleteBook(bookId);
      setConfirmDelete(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteSeries = async (seriesId: number) => {
    try {
      await apiAdminDeleteSeries(seriesId);
      setConfirmDelete(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await apiAdminDeleteUser(userId);
      setConfirmDelete(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleBookVisibility = async (bookId: number, currentVisibility: boolean) => {
    try {
      await apiAdminToggleBookVisibility(bookId, !currentVisibility);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditBookClick = (b: any) => {
    setEditBookData({ id: b.id, title: b.title, genres: b.genres || "", description: b.description || "", series_ids: b.series_ids || [] });
  };

  const handleEditSeriesClick = (s: any) => {
    setEditSeriesId(s.id);
    setEditSeriesName(s.name);
  };

  const handleSaveSeriesEdit = async () => {
    if (!editSeriesId) return;
    try {
      await apiUpdateSeries(editSeriesId, { name: editSeriesName });
      setEditSeriesId(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleBanUser = async (userId: number, isPlus: boolean, role: string, isBanned: boolean) => {
    try {
      await apiAdminBanUser(userId, isPlus, role, isBanned);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditUserClick = (u: any) => {
    setEditUserData({ id: u.id, username: u.username });
    setEditUserUsername(u.username);
    setEditUserPassword("");
  };

  const handleSaveUserEdit = async () => {
    if (!editUserData) return;
    try {
      const data: any = {};
      if (editUserUsername !== editUserData.username) data.username = editUserUsername;
      if (editUserPassword) data.password = editUserPassword;
      if (Object.keys(data).length === 0) { setEditUserData(null); return; }
      await apiAdminUpdateUser(editUserData.id, data);
      setEditUserData(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateUser = async () => {
    try {
      await apiAdminCreateUser(createUsername, createPassword);
      setCreateUserOpen(false);
      setCreateUsername("");
      setCreatePassword("");
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!user || user.role !== "admin") {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>Доступ запрещён</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <Navbar activeTab="admin" />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        {error && (
          <div style={{ background: "var(--accent-light)", border: "1px solid var(--error)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "var(--error)", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {error}
            <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", fontSize: 18 }}>×</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
          {(["users", "books", "series", "support"] as Tab[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "12px 24px", border: "none", borderRadius: "8px 8px 0 0",
              background: activeTab === tab ? "var(--accent)" : "transparent",
              color: activeTab === tab ? "#fff" : "var(--text-secondary)",
              fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}>
              {tab === "users" && "👥 Пользователи"}
              {tab === "books" && "📚 Книги"}
              {tab === "series" && "📖 Серии"}
              {tab === "support" && "💬 Поддержка"}
            </button>
          ))}
        </div>

        {activeTab === "users" && (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <input type="text" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") loadData(); }} placeholder="Поиск по имени..." style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }} />
              <button onClick={() => loadData()} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, cursor: "pointer" }}>Поиск</button>
              <button onClick={() => setCreateUserOpen(true)} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, cursor: "pointer" }}>+ Создать</button>
            </div>
            {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Загрузка...</div>}
            {!loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {users.map((u) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "orange", flexShrink: 0 }}>
                    {u.avatar_url ? (
                      <img src={apiGetAvatarUrl(u.id)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600 }}>{u.username[0].toUpperCase()}</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Link href={`/author/${u.id}`} style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 15, textDecoration: "none" }}>{u.username}</Link>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: u.role === "admin" ? "purple" : "var(--bg-tertiary)", color: u.role === "admin" ? "#fff" : "var(--text-secondary)" }}>{u.role === "admin" ? "админ" : "пользователь"}</span>
                      {u.is_plus && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff", fontWeight: 600 }}>PLUS</span>}
                      {u.is_banned && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "var(--error)", color: "#fff", fontWeight: 600 }}>ЗАБЛОКИРОВАН</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      ID: {u.id} • Книг: {u.book_count} • Серий: {u.series_count} • Регистрация: {u.created_at?.split("T")[0] || "Н/Д"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleBanUser(u.id, !u.is_plus, u.role === "admin" ? "user" : "admin", u.is_banned)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: u.role === "admin" ? "var(--bg-tertiary)" : "purple", color: u.role === "admin" ? "var(--text-primary)" : "#fff", fontSize: 12, cursor: "pointer" }}>
                      {u.role === "admin" ? "Разжаловать" : "Сделать админом"}
                    </button>
                    <button onClick={() => handleBanUser(u.id, !u.is_plus, u.role, u.is_banned)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: u.is_plus ? "var(--bg-tertiary)" : "var(--accent)", color: u.is_plus ? "var(--text-primary)" : "#fff", fontSize: 12, cursor: "pointer" }}>
                      {u.is_plus ? "Убрать Plus" : "Дать Plus"}
                    </button>
                    <button onClick={() => handleBanUser(u.id, u.is_plus, u.role, !u.is_banned)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: u.is_banned ? "var(--accent)" : "var(--error)", color: u.is_banned ? "#fff" : "#fff", fontSize: 12, cursor: "pointer" }}>
                      {u.is_banned ? "Разбанить" : "Забанить"}
                    </button>
                    <button onClick={() => handleEditUserClick(u)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>
                      ✏️
                    </button>
                    {u.id !== user.id && (
                      <button onClick={() => setConfirmDelete({ type: "user", id: u.id, name: u.username })} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--error)", background: "transparent", color: "var(--error)", fontSize: 14, cursor: "pointer", lineHeight: 1 }}>
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {users.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Нет пользователей</div>}
            </div>
            )}
          </>
        )}

        {activeTab === "books" && (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <input type="text" value={bookSearch} onChange={(e) => setBookSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setBookPage(1); loadData(); } }} placeholder="Поиск по названию..." style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }} />
              <button onClick={() => { setBookPage(1); loadData(); }} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, cursor: "pointer" }}>Поиск</button>
            </div>
            {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Загрузка...</div>}
            {!loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {books.map((b) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                  <div style={{ width: 40, height: 56, borderRadius: 4, overflow: "hidden", background: "var(--bg-tertiary)", flexShrink: 0 }}>
                    {b.cover_image ? (
                      <img src={apiGetCoverUrl(b.id)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>📖</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <Link href={`/book/${b.id}`} style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 14, textDecoration: "none" }}>{b.title}</Link>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      <Link href={`/book/${b.id}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{b.owner_username}</Link> (ID кн: {b.id}) • <Link href={`/author/${b.owner_id}`} style={{ color: "var(--accent)", textDecoration: "none" }}>автор ID: {b.owner_id}</Link> • {b.genres?.split(",").slice(0, 2).join(", ") || "Нет жанров"} • 👁 {b.view_count} • ❤️ {b.like_count} • 💬 {b.comment_count}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, background: b.is_public ? "var(--accent-light)" : "var(--bg-tertiary)", color: b.is_public ? "var(--accent)" : "var(--text-muted)" }}>
                    {b.is_public ? "Публичная" : "Скрытая"}
                  </span>
                  <button onClick={() => handleEditBookClick(b)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>
                    ✏️
                  </button>
                  <button onClick={() => handleToggleBookVisibility(b.id, b.is_public)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>
                    {b.is_public ? "Скрыть" : "Показать"}
                  </button>
                  <button onClick={() => setConfirmDelete({ type: "book", id: b.id, name: b.title })} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--error)", background: "transparent", color: "var(--error)", fontSize: 14, cursor: "pointer", lineHeight: 1 }}>
                    🗑
                  </button>
                </div>
              ))}
            </div>
            )}
            {bookTotalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
                <button onClick={() => setBookPage(p => Math.max(1, p - 1))} disabled={bookPage === 1} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer" }}>←</button>
                <span style={{ padding: "8px 14px", color: "var(--text-secondary)" }}>{bookPage} / {bookTotalPages}</span>
                <button onClick={() => setBookPage(p => Math.min(bookTotalPages, p + 1))} disabled={bookPage === bookTotalPages} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer" }}>→</button>
              </div>
            )}
          </>
        )}

        {activeTab === "series" && (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <input type="text" value={seriesSearch} onChange={(e) => setSeriesSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") loadData(); }} placeholder="Поиск по названию..." style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }} />
              <button onClick={() => loadData()} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, cursor: "pointer" }}>Поиск</button>
            </div>
            {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Загрузка...</div>}
            {!loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {series.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                  <div style={{ width: 40, height: 56, borderRadius: 4, overflow: "hidden", background: "var(--bg-tertiary)", flexShrink: 0 }}>
                    {s.cover_image ? (
                      <img src={apiGetSeriesCoverUrl(s.id)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>📚</div>
                    )}
                  </div>
                    <div style={{ flex: 1 }}>
                      <Link href={`/series/${s.id}`} style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 14, textDecoration: "none" }}>{s.name}</Link>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        ID серии: {s.id} • <Link href={`/author/${s.owner_id}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{s.owner_username}</Link> (ID: {s.owner_id}) • {s.book_count} книг
                      </div>
                    </div>
                  {editSeriesId === s.id ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input value={editSeriesName} onChange={(e) => setEditSeriesName(e.target.value)}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--accent)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, width: 150 }} />
                      <button onClick={handleSaveSeriesEdit} style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, cursor: "pointer" }}>💾</button>
                      <button onClick={() => setEditSeriesId(null)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => handleEditSeriesClick(s)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>
                      ✏️
                    </button>
                  )}
                  <button onClick={() => setConfirmDelete({ type: "series", id: s.id, name: s.name })} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--error)", background: "transparent", color: "var(--error)", fontSize: 14, cursor: "pointer", lineHeight: 1 }}>
                    🗑
                  </button>
                </div>
              ))}
              {series.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Нет серий</div>}
            </div>
            )}
          </>
        )}
      </div>

      {editBookData && (
        <BookEditModal
          book={editBookData}
          onClose={() => setEditBookData(null)}
          onSave={() => { loadData(); }}
        />
      )}

      {editUserData && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-secondary)", padding: 24, borderRadius: 12, width: "90%", maxWidth: 400 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Редактировать пользователя</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>Имя пользователя</label>
              <input value={editUserUsername} onChange={(e) => setEditUserUsername(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>Новый пароль (оставьте пустым, чтобы не менять)</label>
              <input type="password" value={editUserPassword} onChange={(e) => setEditUserPassword(e.target.value)} placeholder="Новый пароль"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setEditUserData(null)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", cursor: "pointer" }}>Отмена</button>
              <button onClick={handleSaveUserEdit} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {createUserOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-secondary)", padding: 24, borderRadius: 12, width: "90%", maxWidth: 400 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Создать пользователя</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>Имя пользователя</label>
              <input value={createUsername} onChange={(e) => setCreateUsername(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>Пароль</label>
              <input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setCreateUserOpen(false)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", cursor: "pointer" }}>Отмена</button>
              <button onClick={handleCreateUser} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Создать</button>
            </div>
          </div>
        </div>
      )}

      {/* SUPPORT TAB */}
      {activeTab === "support" && (
        <div>
          {selectedSupportTicket ? (
            <div>
              <button onClick={() => { setSelectedSupportTicket(null); setSupportReply(""); }} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13, marginBottom: 12 }}>← Назад к списку</button>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{selectedSupportTicket.subject}</h3>
              <span style={{ fontSize: 11, color: selectedSupportTicket.status === "open" ? "var(--accent)" : "var(--text-muted)" }}>
                {selectedSupportTicket.status === "open" ? "Открыт" : "Закрыт"}
              </span>
              <div style={{ marginTop: 14, maxHeight: 400, overflowY: "auto" }}>
                {(selectedSupportTicket.replies || []).map((r: any) => (
                  <div key={r.id} style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 10, background: r.is_admin ? "rgba(249,115,22,0.06)" : "var(--bg-primary)", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: r.is_admin ? "var(--accent)" : "var(--text-primary)" }}>{r.is_admin ? "🛡 Админ" : r.username}</span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{new Date(r.created_at).toLocaleString("ru-RU")}</span>
                    </div>
                    <p style={{ fontSize: 13, margin: 0, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>{r.content}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <input
                  type="text"
                  value={supportReply}
                  onChange={(e) => setSupportReply(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && supportReply.trim()) {
                      await apiReplySupportTicket(selectedSupportTicket.id, supportReply);
                      setSupportReply("");
                      const updated = await apiSupportTicket(selectedSupportTicket.id);
                      setSelectedSupportTicket(updated);
                    }
                  }}
                  placeholder="Ответ пользователю..."
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", fontSize: 13, color: "var(--text-primary)", outline: "none" }}
                />
                <button
                  onClick={async () => {
                    if (!supportReply.trim()) return;
                    await apiReplySupportTicket(selectedSupportTicket.id, supportReply);
                    setSupportReply("");
                    const updated = await apiSupportTicket(selectedSupportTicket.id);
                    setSelectedSupportTicket(updated);
                  }}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                >Отправить</button>
                <button
                  onClick={async () => {
                    await apiAdminUpdateTicketStatus(selectedSupportTicket.id, selectedSupportTicket.status === "closed" ? "open" : "closed");
                    const updated = await apiSupportTicket(selectedSupportTicket.id);
                    setSelectedSupportTicket(updated);
                  }}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}
                >{selectedSupportTicket.status === "closed" ? "Переоткрыть" : "Закрыть"}</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 4, marginBottom: 12, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
                <button onClick={() => setSupportTab("open")} style={{ padding: "8px 16px", border: "none", borderRadius: "8px 8px 0 0", background: supportTab === "open" ? "var(--accent)" : "transparent", color: supportTab === "open" ? "#fff" : "var(--text-secondary)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                  Открытые ({supportTickets.filter(t => t.status === "open").length})
                </button>
                <button onClick={() => setSupportTab("closed")} style={{ padding: "8px 16px", border: "none", borderRadius: "8px 8px 0 0", background: supportTab === "closed" ? "var(--accent)" : "transparent", color: supportTab === "closed" ? "#fff" : "var(--text-secondary)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                  Закрытые ({supportTickets.filter(t => t.status === "closed").length})
                </button>
              </div>
              <input
                type="text"
                value={supportSearch}
                onChange={(e) => setSupportSearch(e.target.value)}
                placeholder="Поиск по обращениям..."
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none", marginBottom: 16 }}
              />
              {supportTickets.filter(t => t.status === supportTab).length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                  {supportTab === "open" ? "Нет открытых обращений" : "Нет закрытых обращений"}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {supportTickets.filter(t => t.status === supportTab && (!supportSearch || t.subject.toLowerCase().includes(supportSearch.toLowerCase()) || t.username.toLowerCase().includes(supportSearch.toLowerCase()) || (t.content && t.content.toLowerCase().includes(supportSearch.toLowerCase())))).map((t) => (
                    <div
                      key={t.id}
                      onClick={async () => {
                        const ticket = await apiSupportTicket(t.id);
                        setSelectedSupportTicket(ticket);
                      }}
                      style={{ padding: "14px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", transition: "transform 0.15s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateX(4px)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateX(0)"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t.subject}</h4>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>от {t.username}</span>
                          {t.content && (
                            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.content}</p>
                          )}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{t.reply_count} ответов</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-secondary)", padding: 24, borderRadius: 12, width: "90%", maxWidth: 400 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Подтверждение удаления</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Вы уверены, что хотите удалить {confirmDelete.type === "user" ? "пользователя" : confirmDelete.type === "book" ? "книгу" : "серию"} <strong>{confirmDelete.name}</strong>? Это действие необратимо.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", cursor: "pointer" }}>Отмена</button>
              <button onClick={() => {
                if (confirmDelete.type === "book") handleDeleteBook(confirmDelete.id);
                else if (confirmDelete.type === "series") handleDeleteSeries(confirmDelete.id);
                else if (confirmDelete.type === "user") handleDeleteUser(confirmDelete.id);
              }} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--error)", color: "#fff", cursor: "pointer" }}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}