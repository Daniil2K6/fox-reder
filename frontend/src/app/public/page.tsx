"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUser, clearToken, clearUser, getTheme, setTheme, apiPublicBooks } from "@/lib/api";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUserState] = useState<any>(null);
  const [theme, setThemeState] = useState("light");
  const router = useRouter();

  useEffect(() => {
    setUserState(getUser());
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      const data = await apiPublicBooks();
      setBooks(data);
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

        {books.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 0",
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
            <p style={{ fontSize: 16 }}>No public books yet</p>
            <p style={{ fontSize: 14 }}>Be the first to share a book!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {books.map((book) => (
              <div
                key={book.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 20px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--bg-secondary)",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "var(--accent)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    href={`/book/${book.id}`}
                    style={{
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      textDecoration: "none",
                      fontSize: 15,
                    }}
                  >
                    {book.title}
                    {book.has_structure && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "var(--accent-light)",
                          color: "var(--accent)",
                          fontWeight: 600,
                        }}
                      >
                        VOXBOOK
                      </span>
                    )}
                  </Link>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    by {book.owner_username} · {book.filename.split('.').pop()?.toLowerCase() ? '.' + book.filename.split('.').pop()?.toLowerCase() : ''}
                  </p>
                </div>
                <Link
                  href={`/book/${book.id}`}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 8,
                    background: "var(--accent-light)",
                    color: "var(--accent)",
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 500,
                    marginLeft: 16,
                  }}
                >
                  Read
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
