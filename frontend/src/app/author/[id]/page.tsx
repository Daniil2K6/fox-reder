"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getUser, clearToken, clearUser, getTheme, setTheme, apiAuthor, apiGetCoverUrl, apiGetSeriesCoverUrl, apiSubscribe, apiUnsubscribe, apiGetAvatarUrl } from "@/lib/api";

export default function AuthorPage() {
  const params = useParams();
  const authorId = Number(params.id);
  const router = useRouter();
  const [author, setAuthor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUserState] = useState<any>(null);
  const [theme, setThemeState] = useState("light");

  useEffect(() => {
    setUserState(getUser());
    const t = getTheme();
    setThemeState(t);
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

  const logout = () => {
    clearToken();
    clearUser();
    setUserState(null);
    router.push("/");
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    setThemeState(next);
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

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>🦊 FoxBooks</Link>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <Link href="/public" style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", textDecoration: "none" }}>Публичная библиотека</Link>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{author.username}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {user ? (
            <>
              <Link href="/notifications" style={{ position: "relative", padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", textDecoration: "none", fontSize: 13 }}>🔔</Link>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {user.avatar_url ? (
                  <img src={apiGetAvatarUrl(user.id)} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "orange", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff" }}>
                    {user.username[0].toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{user.username}</span>
              </div>
              <Link href="/profile" style={{ padding: "6px 14px", borderRadius: 8, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>Мой профиль</Link>
            </>
          ) : (
            <Link href="/login" style={{ padding: "6px 14px", borderRadius: 8, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>Вход</Link>
          )}
          <button onClick={toggleTheme} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", fontSize: 16 }}>{theme === "light" ? "🌙" : "☀"}</button>
          {user && <button onClick={logout} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Выход</button>}
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", gap: 24, marginBottom: 32, alignItems: "flex-start" }}>
          <div style={{ width: 120, height: 120, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
            {author.avatar_url ? (
              <img src={apiGetAvatarUrl(author.id)} alt={author.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, background: "orange", color: "#fff" }}>
                {author.username[0].toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{author.username}</h1>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>📚 {author.book_count} книг</span>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>📖 {author.series_count} серий</span>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>👥 {author.subscriber_count} подписчиков</span>
            </div>
            <button onClick={handleSubscribe} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: author.is_subscribed ? "var(--bg-tertiary)" : "var(--accent)", color: author.is_subscribed ? "var(--text-primary)" : "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
              {author.is_subscribed ? "Отписаться" : "Подписаться"}
            </button>
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
    </div>
  );
}