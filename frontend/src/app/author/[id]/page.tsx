"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getUser, clearToken, clearUser, getTheme, setTheme, apiAuthor, apiGetCoverUrl, apiGetSeriesCoverUrl, apiSubscribe, apiUnsubscribe, apiGetAvatarUrl, apiAdminBanUser, apiAdminDeleteUser, apiAdminUpdateUser } from "@/lib/api";
import { Navbar } from "@/components/Navbar";

export default function AuthorPage() {
  const params = useParams();
  const authorId = Number(params.id);
  const router = useRouter();
  const [author, setAuthor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUserState] = useState<any>(null);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");

  useEffect(() => {
    setUserState(getUser());
    const t = getTheme();
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await apiAuthor(authorId);
      setAuthor(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async () => {
    if (!user || user.role !== "admin") return;
    if (!confirm(`Забанить пользователя ${author.username}?`)) return;
    try {
      await apiAdminBanUser(author.id, author.is_plus || false, author.role || "user", !author.is_banned);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async () => {
    if (!user || user.role !== "admin") return;
    if (!confirm(`Удалить пользователя ${author.username} и все его книги?`)) return;
    try {
      await apiAdminDeleteUser(author.id);
      router.push("/public");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEditUserOpen = () => {
    setEditUsername(author.username);
    setEditPassword("");
    setEditUserOpen(true);
  };

  const handleSaveUserEdit = async () => {
    try {
      const data: any = {};
      if (editUsername !== author.username) data.username = editUsername;
      if (editPassword) data.password = editPassword;
      if (Object.keys(data).length === 0) { setEditUserOpen(false); return; }
      await apiAdminUpdateUser(author.id, data);
      setEditUserOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      if (author.is_subscribed) {
        await apiUnsubscribe(author.id);
      } else {
        await apiSubscribe(author.id);
      }
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>Loading...</div>;
  }

  if (!author) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>Автор не найден</div>;
  }

  const isAdmin = user?.role === "admin";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
      <Navbar 
        breadcrumbs={[
          { label: "Библиотека", href: "/public" },
          { label: author.username },
        ]}
      />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", flex: 1 }}>
        <div style={{ display: "flex", gap: 24, marginBottom: 32, alignItems: "flex-start" }}>
          <div style={{ width: 120, height: 120, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
            {author.avatar_url ? (
              <img src={apiGetAvatarUrl(author.id)} alt={author.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff" }}>
                {author.username[0].toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{author.username}</h1>
              {author.is_banned && (
                <span style={{ padding: "4px 10px", borderRadius: 6, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 600 }}>ЗАБЛОКИРОВАН</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>📚 {author.book_count} книг</span>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>📖 {author.series_count} серий</span>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>👥 {author.subscriber_count} подписчиков</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={handleSubscribe} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: author.is_subscribed ? "var(--bg-tertiary)" : "var(--accent)", color: author.is_subscribed ? "var(--text-primary)" : "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                {author.is_subscribed ? "Отписаться" : "Подписаться"}
              </button>
              
              {isAdmin && (
                <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
                  {user.id !== author.id && (
                    <>
                      <button onClick={handleBanUser} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid", borderColor: author.is_banned ? "#22c55e" : "#ef4444", background: "transparent", color: author.is_banned ? "#22c55e" : "#ef4444", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                        {author.is_banned ? "Разбанить" : "Забанить"}
                      </button>
                      <button onClick={handleDeleteUser} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                        Удалить
                      </button>
                    </>
                  )}
                  <button onClick={handleEditUserOpen} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                    ✏️ Редактировать
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {author.series && author.series.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Серии</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
              {author.series.map((s: any) => (
                <Link key={s.id} href={`/series/${s.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-secondary)", transition: "transform 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    <div style={{ aspectRatio: "2/3", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {s.cover_image ? (
                        <img src={apiGetSeriesCoverUrl(s.id)} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 32 }}>📚</span>
                      )}
                    </div>
                    <div style={{ padding: "10px" }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{s.book_count} книг</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Все книги</h2>
          {author.books && author.books.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
              {author.books.map((book: any) => (
                <Link key={book.id} href={`/book/${book.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-secondary)", transition: "transform 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    <div style={{ aspectRatio: "2/3", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {book.cover_image ? (
                        <img src={apiGetCoverUrl(book.id)} alt={book.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 32 }}>📖</span>
                      )}
                    </div>
                    <div style={{ padding: "10px" }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.title}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>👁 {book.view_count || 0}</span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>❤️ {book.like_count || 0}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>Нет книг</p>
          )}
        </div>
      </div>

      {editUserOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-secondary)", padding: 24, borderRadius: 12, width: "90%", maxWidth: 400 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Редактировать пользователя</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>Имя пользователя</label>
              <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>Новый пароль (оставьте пустым, чтобы не менять)</label>
              <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Новый пароль"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setEditUserOpen(false)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", cursor: "pointer" }}>Отмена</button>
              <button onClick={handleSaveUserEdit} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}