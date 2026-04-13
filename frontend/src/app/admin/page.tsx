"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getUser, clearToken, clearUser, getTheme, setTheme,
  apiAdminUsers, apiAdminBooks, apiAdminSeries,
  apiAdminDeleteBook, apiAdminDeleteSeries,
  apiAdminBanUser, apiAdminDeleteUser, apiAdminToggleBookVisibility,
  apiGetCoverUrl, apiGetSeriesCoverUrl, apiGetAvatarUrl,
} from "@/lib/api";
import { Navbar } from "@/components/Navbar";

type Tab = "users" | "books" | "series";

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
  const [confirmDelete, setConfirmDelete] = useState<{type: string; id: number; name: string} | null>(null);

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
        setUsers(await apiAdminUsers());
      } else if (activeTab === "books") {
        const data = await apiAdminBooks(bookPage, 20, bookSearch || undefined);
        setBooks(data.books);
        setBookTotalPages(data.pages);
      } else if (activeTab === "series") {
        setSeries(await apiAdminSeries());
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

  const handleBanUser = async (userId: number, isPlus: boolean, role: string, isBanned: boolean) => {
    try {
      await apiAdminBanUser(userId, isPlus, role, isBanned);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!user || user.role !== "admin") {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>Access denied</div>;
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
          {(["users", "books", "series"] as Tab[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "12px 24px", border: "none", borderRadius: "8px 8px 0 0",
              background: activeTab === tab ? "var(--accent)" : "transparent",
              color: activeTab === tab ? "#fff" : "var(--text-secondary)",
              fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}>
              {tab === "users" && "👥 Пользователи"}
              {tab === "books" && "📚 Книги"}
              {tab === "series" && "📖 Серии"}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Загрузка...</div>
        ) : activeTab === "users" && (
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
                    <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 15 }}>{u.username}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: u.role === "admin" ? "purple" : "var(--bg-tertiary)", color: u.role === "admin" ? "#fff" : "var(--text-secondary)" }}>{u.role}</span>
                    {u.is_plus && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff", fontWeight: 600 }}>PLUS</span>}
                    {u.is_banned && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "var(--error)", color: "#fff", fontWeight: 600 }}>ЗАБЛОКИРОВАН</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    ID: {u.id} • Книг: {u.book_count} • Серий: {u.series_count} • Регистрация: {u.created_at?.split("T")[0] || "N/A"}
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
                  {u.id !== user.id && (
                    <button onClick={() => setConfirmDelete({ type: "user", id: u.id, name: u.username })} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--error)", background: "var(--accent-light)", color: "var(--error)", fontSize: 12, cursor: "pointer" }}>
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            ))}
            {users.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Нет пользователей</div>}
          </div>
        )}

        {activeTab === "books" && (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <input type="text" value={bookSearch} onChange={(e) => setBookSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setBookPage(1) || loadData()} placeholder="Поиск по названию..." style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }} />
              <button onClick={() => { setBookPage(1); loadData(); }} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, cursor: "pointer" }}>Поиск</button>
            </div>
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
                      {b.owner_username} (ID: {b.owner_id}) • {b.genres?.split(",").slice(0, 2).join(", ") || "Нет жанров"} • 👁 {b.view_count} • ❤️ {b.like_count} • 💬 {b.comment_count}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, background: b.is_public ? "var(--accent-light)" : "var(--bg-tertiary)", color: b.is_public ? "var(--accent)" : "var(--text-muted)" }}>
                    {b.is_public ? "Публичная" : "Скрытая"}
                  </span>
                  <button onClick={() => handleToggleBookVisibility(b.id, b.is_public)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>
                    {b.is_public ? "Скрыть" : "Показать"}
                  </button>
                  <button onClick={() => setConfirmDelete({ type: "book", id: b.id, name: b.title })} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--error)", background: "var(--accent-light)", color: "var(--error)", fontSize: 12, cursor: "pointer" }}>
                    Удалить
                  </button>
                </div>
              ))}
            </div>
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
                    {s.owner_username} (ID: {s.owner_id}) • {s.book_count} книг
                  </div>
                </div>
                <button onClick={() => setConfirmDelete({ type: "series", id: s.id, name: s.name })} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--error)", background: "var(--accent-light)", color: "var(--error)", fontSize: 12, cursor: "pointer" }}>
                  Удалить
                </button>
              </div>
            ))}
            {series.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Нет серий</div>}
          </div>
        )}
      </div>

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