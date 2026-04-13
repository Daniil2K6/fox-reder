"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getUser, clearToken, clearUser, getTheme, setTheme, apiGetSeries, apiGetCoverUrl } from "@/lib/api";

interface SeriesBook {
  id: number;
  title: string;
  cover_image: string | null;
}

export default function SeriesPage() {
  const params = useParams();
  const seriesId = Number(params.id);
  const router = useRouter();
  const [series, setSeries] = useState<any>(null);
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
      const data = await apiGetSeries(seriesId);
      setSeries(data);
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

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>Loading...</div>;
  }

  if (!series) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>Серия не найдена</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>🦊 FoxBooks</Link>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <Link href="/public" style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", textDecoration: "none" }}>Публичная библиотека</Link>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{series.name}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {user ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "orange", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff" }}>
                  {user.username[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{user.username}</span>
              </div>
              <Link href="/profile" style={{ padding: "6px 14px", borderRadius: 8, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>Мой профиль</Link>
            </>
          ) : (
            <Link href="/login" style={{ padding: "6px 14px", borderRadius: 8, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>Вход</Link>
          )}
          <button onClick={toggleTheme} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{theme === "light" ? "🌙" : "☀"}</button>
          {user && <button onClick={logout} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Выход</button>}
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", gap: 24, marginBottom: 32 }}>
          <div style={{ width: 180, flexShrink: 0 }}>
            <div style={{ aspectRatio: "2/3", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {series.cover_image ? (
                <img src={`/api/books/series/${series.id}/cover`} alt={series.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 48 }}>📚</span>
              )}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{series.name}</h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>{series.books?.length || 0} книг</p>
            {series.common_genres && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {series.common_genres.split(",").map((g: string, i: number) => (
                  <span key={i} style={{ padding: "4px 10px", borderRadius: 12, background: "var(--accent-light)", color: "var(--accent)", fontSize: 12 }}>{g.trim()}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Книги серии</h2>
        {series.books?.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>Нет книг в этой серии</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {series.books.map((book: SeriesBook, index: number) => (
              <Link key={book.id} href={`/book/${book.id}`} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-secondary)", textDecoration: "none" }}>
                <span style={{ width: 30, textAlign: "center", fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>{index + 1}</span>
                <div style={{ width: 50, height: 70, borderRadius: 6, overflow: "hidden", background: "var(--bg-tertiary)", flexShrink: 0 }}>
                  {book.cover_image ? (
                    <img src={apiGetCoverUrl(book.id)} alt={book.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>📖</div>
                  )}
                </div>
                <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>{book.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}