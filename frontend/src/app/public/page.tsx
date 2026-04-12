"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUser, clearToken, clearUser, getTheme, setTheme, apiPublicBooks, apiPublicSeries, apiGetCoverUrl } from "@/lib/api";
import { useRouter } from "next/navigation";

interface Book {
  id: number;
  title: string;
  filename: string;
  is_public: boolean;
  owner_id: number;
  owner_username: string;
  has_structure: boolean;
  cover_image: string | null;
  genres: string | null;
  description: string | null;
  comment_count: number;
}

export default function PublicLibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUserState] = useState<any>(null);
  const [theme, setThemeState] = useState("light");
  const [activeTab, setActiveTab] = useState<"books" | "series">("books");
  const router = useRouter();

  useEffect(() => {
    setUserState(getUser());
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [booksData, seriesData] = await Promise.all([
        apiPublicBooks(),
        activeTab === "series" ? apiPublicSeries() : Promise.resolve([])
      ]);
      setBooks(booksData);
      setSeries(seriesData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "series") {
      apiPublicSeries().then(setSeries).catch(() => {});
    }
  }, [activeTab]);

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
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-primary)",
          color: "var(--text-secondary)",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Nav */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 32px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-secondary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link
            href="/"
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--accent)",
              textDecoration: "none",
            }}
          >
            🦊 FoxBooks
          </Link>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
            Public Library
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {user ? (
            <>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {user.username}
              </span>
               <Link
                 href="/profile"
                 style={{
                   padding: "6px 14px",
                   borderRadius: 8,
                   background: "var(--accent)",
                   color: "#fff",
                   textDecoration: "none",
                   fontSize: 13,
                   fontWeight: 500,
                 }}
               >
                 My Profile
               </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: "var(--accent)",
                  color: "#fff",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Login
              </Link>
              <Link
                href="/register"
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                  fontSize: 13,
                }}
              >
                Register
              </Link>
            </>
          )}
          <button
            onClick={toggleTheme}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {theme === "light" ? "🌙" : "☀"}
          </button>
          {user && (
            <button
              onClick={logout}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => setActiveTab("books")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: activeTab === "books" ? "var(--accent)" : "var(--bg-secondary)",
              color: activeTab === "books" ? "#fff" : "var(--text-secondary)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Книги
          </button>
          <button
            onClick={() => setActiveTab("series")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: activeTab === "series" ? "var(--accent)" : "var(--bg-secondary)",
              color: activeTab === "series" ? "#fff" : "var(--text-secondary)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Серии
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "var(--accent-light)",
              border: "1px solid var(--error)",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 20,
              color: "var(--error)",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {activeTab === "books" && books.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 0",
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
            <p style={{ fontSize: 16 }}>Пока нет книг</p>
            <p style={{ fontSize: 14 }}>Будьте первым, кто загрузит книгу!</p>
          </div>
        ) : activeTab === "books" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 20 }}>
            {books.map((book) => (
              <Link key={book.id} href={`/book/${book.id}`} style={{ textDecoration: "none" }}>
                <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-secondary)", transition: "transform 0.15s, box-shadow 0.15s", cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ aspectRatio: "2/3", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {book.cover_image ? (
                      <img src={apiGetCoverUrl(book.id)} alt={book.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 40 }}>📖</span>
                    )}
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.title}</p>
                    {book.has_structure && (
                      <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 3, background: "var(--accent-light)", color: "var(--accent)", fontWeight: 600 }}>VOXBOOK</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : activeTab === "series" && series.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
            <p style={{ fontSize: 16 }}>Пока нет серий</p>
          </div>
        ) : activeTab === "series" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {series.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 20px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--bg-secondary)",
                }}
              >
                <div>
                  <span style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 15 }}>{s.name}</span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>{s.book_count} книг</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
