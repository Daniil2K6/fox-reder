"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUser, clearToken, clearUser, getTheme, setTheme, apiPublicSeries, apiGetCoverUrl, apiPublicBooksPaginated, apiPublicBooksCount, apiLikeBook, apiUnlikeBook, apiUnreadCount, apiNotifications, apiAuthors, apiSubscribe, apiUnsubscribe, apiGetAvatarUrl, apiHotBooks, apiGetSeriesCoverUrl } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
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
  like_count: number;
  is_liked: boolean;
  view_count: number;
  owner_avatar: string | null;
  series_ids?: number[];
  series_names?: string[];
}

export default function PublicLibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [authors, setAuthors] = useState<any[]>([]);
  const [hotBooks, setHotBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUserState] = useState<any>(null);
  const [theme, setThemeState] = useState("light");
  const [activeTab, setActiveTab] = useState<"books" | "series" | "authors">("books");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalBooks, setTotalBooks] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [subscribedAuthors, setSubscribedAuthors] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState("created_at");
  const [genre, setGenre] = useState("");
  const [extension, setExtension] = useState("");
  const limit = 20;
  const router = useRouter();

  useEffect(() => {
    setUserState(getUser());
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    
    const params = new URLSearchParams(window.location.search);
    const genreParam = params.get("genre");
    if (genreParam) {
      setGenre(genreParam);
    }
    
    loadData();
  }, []);

  useEffect(() => {
    if (user) {
      apiUnreadCount().then(d => setUnreadCount(d.count)).catch(() => {});
    }
  }, [user]);

  const loadData = async () => {
    try {
      if (activeTab === "books") {
        const [booksData, countData, hotData] = await Promise.all([
          apiPublicBooksPaginated(page, limit, search || undefined, sortBy, genre || undefined, extension || undefined),
          apiPublicBooksCount(search || undefined),
          apiHotBooks()
        ]);
        setBooks(booksData);
        setTotalBooks(countData.total);
        setHotBooks(hotData);
      } else if (activeTab === "series") {
        const seriesData = await apiPublicSeries();
        setSeries(seriesData);
      } else if (activeTab === "authors") {
        const authorsData = await apiAuthors();
        setAuthors(authorsData);
        const subs = new Set<number>();
        authorsData.forEach((a: any) => { if (a.is_subscribed) subs.add(a.id); });
        setSubscribedAuthors(subs);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [activeTab, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      setPage(1);
      loadData();
    }, 500);
    return () => clearTimeout(timer);
  }, [search, sortBy, genre, extension]);

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

  const handleLike = async (bookId: number, isLiked: boolean) => {
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      if (isLiked) {
        await apiUnlikeBook(bookId);
      } else {
        await apiLikeBook(bookId);
      }
      setBooks(books.map(b => b.id === bookId ? { ...b, is_liked: !isLiked, like_count: isLiked ? b.like_count - 1 : b.like_count + 1 } : b));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAuthorSubscribe = async (authorId: number) => {
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      const newSubscribed = new Set(subscribedAuthors);
      if (subscribedAuthors.has(authorId)) {
        await apiUnsubscribe(authorId);
        newSubscribed.delete(authorId);
      } else {
        await apiSubscribe(authorId);
        newSubscribed.add(authorId);
      }
      setSubscribedAuthors(newSubscribed);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const totalPages = Math.ceil(totalBooks / limit);

  const getAuthorSubscribeStatus = (authorId: number) => subscribedAuthors.has(authorId);

  if (loading && books.length === 0) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>Loading...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <Navbar activeTab="public" />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button onClick={() => setActiveTab("books")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: activeTab === "books" ? "var(--accent)" : "var(--bg-secondary)", color: activeTab === "books" ? "#fff" : "var(--text-secondary)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Книги</button>
          <button onClick={() => setActiveTab("series")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: activeTab === "series" ? "var(--accent)" : "var(--bg-secondary)", color: activeTab === "series" ? "#fff" : "var(--text-secondary)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Серии</button>
          <button onClick={() => setActiveTab("authors")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: activeTab === "authors" ? "var(--accent)" : "var(--bg-secondary)", color: activeTab === "authors" ? "#fff" : "var(--text-secondary)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Авторы</button>
        </div>

        {activeTab === "books" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск книг..." style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }} />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}>
                <option value="created_at">Новинки</option>
                <option value="likes">По лайкам</option>
                <option value="views">По просмотрам</option>
              </select>
              <input type="text" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Жанр" style={{ width: 100, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }} />
              <select value={extension} onChange={(e) => setExtension(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}>
                <option value="">Все форматы</option>
                <option value="fb2">FB2</option>
                <option value="epub">EPUB</option>
                <option value="txt">TXT</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
          </>
        )}

        {error && <div style={{ background: "var(--accent-light)", border: "1px solid var(--error)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, color: "var(--error)", fontSize: 14 }}>{error}</div>}

        {activeTab === "books" && books.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
            <p style={{ fontSize: 16 }}>Ничего не найдено</p>
          </div>
        ) : activeTab === "books" ? (
          <>
            {hotBooks.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 20 }}>🔥</span>
                  <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Hot Books</h2>
                  <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 10, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff", fontWeight: 600 }}>PLUS</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
                  {hotBooks.map((book) => (
                    <Link key={book.id} href={`/book/${book.id}`} style={{ textDecoration: "none" }}>
                      <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-secondary)", transition: "transform 0.15s", padding: "8px" }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                      >
                        <div style={{ aspectRatio: "2/3", background: "var(--bg-tertiary)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {book.cover_image ? <img src={apiGetCoverUrl(book.id)} alt={book.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 32 }}>📖</span>}
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.title}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Найдено книг: {totalBooks}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 20 }}>
              {books.map((book) => (
                <div key={book.id} style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-secondary)", transition: "transform 0.15s, box-shadow 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <Link href={`/book/${book.id}`} style={{ textDecoration: "none" }}>
                    <div style={{ aspectRatio: "2/3", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {book.cover_image ? <img src={apiGetCoverUrl(book.id)} alt={book.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 40 }}>📖</span>}
                    </div>
                    <div style={{ padding: "10px 12px" }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.title}</p>
                      {book.series_names && book.series_names.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          {book.series_names.map((s: string, idx: number) => (
                            <Link key={idx} href={`/series/${book.series_ids![idx]}`} onClick={(e) => e.stopPropagation()} style={{ display: "inline-block", fontSize: 10, color: "var(--accent)", background: "var(--accent-light)", padding: "2px 6px", borderRadius: 4, marginRight: 4, textDecoration: "none" }}>
                              📚 {s}
                            </Link>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        {book.owner_avatar ? (
                          <img src={apiGetAvatarUrl(book.owner_id)} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "orange", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#fff" }}>
                            {book.owner_username[0].toUpperCase()}
                          </div>
                        )}
                        <p style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.owner_username}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                        {book.has_structure && <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 3, background: "var(--accent-light)", color: "var(--accent)", fontWeight: 600 }}>VOXBOOK</span>}
                        <button onClick={(e) => { e.preventDefault(); handleLike(book.id, book.is_liked); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: book.is_liked ? "red" : "var(--text-muted)", display: "flex", alignItems: "center", gap: 2 }}>
                          {book.is_liked ? "❤️" : "🤍"} {book.like_count}
                        </button>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>👁 {book.view_count || 0}</span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>💬 {book.comment_count || 0}</span>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 32 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.5 : 1 }}>← Назад</button>
                <span style={{ padding: "8px 16px", color: "var(--text-secondary)" }}>{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.5 : 1 }}>Вперёд →</button>
              </div>
            )}
          </>
        ) : activeTab === "series" && series.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
            <p style={{ fontSize: 16 }}>Пока нет серий</p>
          </div>
        ) : activeTab === "series" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {series.map((s) => (
              <Link key={s.id} href={`/series/${s.id}`} style={{ textDecoration: "none", display: "block" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", transition: "transform 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateX(4px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateX(0)"; }}
                >
                  <div style={{ width: 50, height: 70, borderRadius: 6, overflow: "hidden", background: "var(--bg-tertiary)", flexShrink: 0 }}>
                    {s.cover_image ? (
                      <img src={apiGetSeriesCoverUrl(s.id)} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>📚</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 15 }}>{s.name}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-tertiary)", padding: "2px 8px", borderRadius: 10 }}>{s.book_count} книг</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>❤️ {s.total_likes || 0}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>💬 {s.total_comments || 0}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>👁 {s.total_views || 0}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>•</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {s.owner_avatar ? (
                          <img src={apiGetAvatarUrl(s.owner_id)} alt="" style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "orange", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 600, color: "#fff" }}>
                            {s.owner_username[0].toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.owner_username}</span>
                      </div>
                    </div>
                  </div>
                  <span style={{ color: "var(--text-muted)" }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        ) : activeTab === "authors" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {authors.map((a) => (
              <Link key={a.id} href={`/author/${a.id}`} style={{ textDecoration: "none", display: "block" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", transition: "transform 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateX(4px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateX(0)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {a.avatar_url ? (
                      <img src={apiGetAvatarUrl(a.id)} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "orange", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, color: "#fff" }}>
                        {a.username[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <span style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 15 }}>{a.username}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>{a.book_count} книг</span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>• {a.subscriber_count || 0} подписчиков</span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>• 👁 {a.total_views || 0}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>• 💬 {a.total_comments || 0}</span>
                    </div>
                  </div>
                  {user && user.id !== a.id && (
                    <button onClick={(e) => { e.preventDefault(); handleAuthorSubscribe(a.id); }} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: subscribedAuthors.has(a.id) ? "var(--accent)" : "transparent", color: subscribedAuthors.has(a.id) ? "#fff" : "var(--text-secondary)", cursor: "pointer", fontSize: 13 }}>
                      {subscribedAuthors.has(a.id) ? "✓ Подписан" : "Подписаться"}
                    </button>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}