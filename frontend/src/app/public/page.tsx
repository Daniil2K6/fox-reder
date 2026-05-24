"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { getUser, clearToken, clearUser, getTheme, setTheme, apiGetCoverUrl, apiGetAvatarUrl, apiGetSeriesCoverUrl, apiPublicBooksPaginated, apiPublicBooksCount, apiPublicSeries, apiAuthors, apiHotBooks, apiLikeBook, apiUnlikeBook, apiSubscribe, apiUnsubscribe, apiUnreadCount } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { useRouter } from "next/navigation";

interface Book {
  id: number; title: string; filename: string; is_public: boolean;
  owner_id: number; owner_username: string; has_structure: boolean;
  cover_image: string | null; genres: string | null; description: string | null;
  comment_count: number; like_count: number; is_liked: boolean;
  view_count: number; owner_avatar: string | null;
  series_ids?: number[]; series_names?: string[]; formats?: string[];
}

export default function PublicLibraryPage() {
  const [user, setUserState] = useState<any>(null);
  const [theme, setThemeState] = useState("light");
  const [activeTab, setActiveTab] = useState<"all" | "books" | "series" | "authors">("all");
  const [books, setBooks] = useState<Book[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [authors, setAuthors] = useState<any[]>([]);
  const [hotBooks, setHotBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const syncPageToUrl = (p: number) => {
    const url = new URL(window.location.href);
    if (p > 1) url.searchParams.set("page", String(p));
    else url.searchParams.delete("page");
    window.history.replaceState({}, "", url.toString());
  };
  const [totalBooks, setTotalBooks] = useState(0);
  const limit = 36;
  const [subscribedAuthors, setSubscribedAuthors] = useState<Set<number>>(new Set());
  const [failedCovers, setFailedCovers] = useState<Set<number>>(new Set());
  const [screenSize, setScreenSize] = useState<"xl" | "lg" | "md" | "sm">("xl");
  const seriesRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setUserState(getUser());
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    loadAll();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = parseInt(params.get("page") || "1", 10);
    if (p > 1) setPage(p);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w >= 1400) setScreenSize("xl");
      else if (w >= 1024) setScreenSize("lg");
      else if (w >= 640) setScreenSize("md");
      else setScreenSize("sm");
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadAll();
  }, [activeTab, page]);

  const loadAll = async () => {
    try {
      const [hot, auth, ser, booksData, countData] = await Promise.all([
        apiHotBooks(),
        apiAuthors(),
        apiPublicSeries(),
        activeTab === "all" || activeTab === "books" ? apiPublicBooksPaginated(page, limit) : Promise.resolve([]),
        activeTab === "all" || activeTab === "books" ? apiPublicBooksCount() : Promise.resolve({ total: 0 }),
      ]);
      setHotBooks(hot?.slice(0, 4) || []);
      setAuthors(auth || []);
      setSeries(ser || []);
      setBooks(booksData || []);
      setTotalBooks(countData?.total || 0);
      const subs = new Set<number>();
      (auth || []).forEach((a: any) => { if (a.is_subscribed) subs.add(a.id); });
      setSubscribedAuthors(subs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (bookId: number, isLiked: boolean) => {
    if (!user) { router.push("/login"); return; }
    try {
      if (isLiked) { await apiUnlikeBook(bookId); } else { await apiLikeBook(bookId); }
      setBooks(books.map(b => b.id === bookId ? { ...b, is_liked: !isLiked, like_count: isLiked ? b.like_count - 1 : b.like_count + 1 } : b));
    } catch {}
  };

  const handleAuthorSubscribe = async (authorId: number) => {
    if (!user) { router.push("/login"); return; }
    try {
      const ns = new Set(subscribedAuthors);
      if (ns.has(authorId)) { await apiUnsubscribe(authorId); ns.delete(authorId); }
      else { await apiSubscribe(authorId); ns.add(authorId); }
      setSubscribedAuthors(ns);
    } catch {}
  };

  const totalPages = Math.ceil(totalBooks / limit);

  const paginate = (p: number) => {
    const next = Math.max(1, Math.min(totalPages, p));
    setPage(next);
    syncPageToUrl(next);
  };

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>Loading...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <Navbar activeTab="public" />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 60px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {(["all", "books", "series", "authors"] as const).map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setPage(1); syncPageToUrl(1); }} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: activeTab === t ? "var(--accent)" : "var(--bg-secondary)", color: activeTab === t ? "#fff" : "var(--text-secondary)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
              {t === "all" ? "Все" : t === "books" ? "Книги" : t === "series" ? "Серии" : "Авторы"}
            </button>
          ))}
        </div>

        {error && (
  <div style={{ background: "var(--accent-light)", border: "1px solid var(--error)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, color: "var(--error)", fontSize: 14 }}>
    {error === "Not authenticated" ? "Ошибка авторизации: нажмите «Выйти» в навигационной панели и зайдите снова"
    : error.startsWith("Сервер временно недоступен") ? "Сервер временно недоступен. Попробуйте обновить страницу позже."
    : error}
  </div>
)}

        {/* ALL TAB */}
        {activeTab === "all" && (
          <>
            {page <= 1 && (() => {
              const activeAuthors = authors.filter(a => a.is_active);
              const inactiveAuthors = authors.filter(a => !a.is_active);
              const displayAuthors = [...activeAuthors, ...inactiveAuthors];
              const plusIds = new Set(
                displayAuthors.filter(a => a.is_plus).slice(0, 3).map(a => a.id)
              );
              const seriesCols = screenSize === "xl" ? 5 : screenSize === "lg" ? 4 : screenSize === "md" ? 3 : 2;
              const seriesCount = screenSize === "xl" ? 20 : screenSize === "lg" ? 12 : screenSize === "md" ? 6 : 4;
              const seriesGap = screenSize === "xl" ? 14 : screenSize === "lg" ? 12 : 10;
              const authorPad = screenSize === "xl" ? "14px 16px" : screenSize === "lg" ? "12px 14px" : screenSize === "md" ? "10px 12px" : "8px 10px";
              const authorAvatar = screenSize === "xl" ? 40 : screenSize === "lg" ? 36 : screenSize === "md" ? 32 : 28;
              const authorFont = screenSize === "xl" ? 15 : screenSize === "lg" ? 14 : 13;
              const authorGap = screenSize === "xl" ? 12 : screenSize === "lg" ? 10 : screenSize === "md" ? 8 : 6;
              const stacked = screenSize === "sm";

              const hotBlock = hotBooks.length > 0 ? (
                <div style={{ marginBottom: 28 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Горячее</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                    {hotBooks.map(b => (
                      <div key={b.id} style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-secondary)", transition: "transform 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                        <Link href={`/book/${b.id}`} style={{ textDecoration: "none", display: "block" }}>
                          <div style={{ aspectRatio: "2/3", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {b.cover_image && !failedCovers.has(b.id) ? <img src={apiGetCoverUrl(b.id)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setFailedCovers(prev => new Set(prev).add(b.id))} /> : <span style={{ fontSize: 36 }}>📖</span>}
                          </div>
                          <div style={{ padding: "8px 10px" }}>
                            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{b.title}</p>
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;

              const seriesBlock = (
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Популярные серии</h3>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${seriesCols}, 1fr)`, gap: seriesGap }}>
                    {series.slice(0, seriesCount).map(s => (
                      <Link key={s.id} href={`/series/${s.id}`} style={{ textDecoration: "none", display: "block", height: "100%", overflow: "hidden" }}>
                        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-secondary)", display: "flex", flexDirection: "column", height: "100%" }}>
                          <div style={{ aspectRatio: "2/3", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {s.cover_image ? <img src={apiGetSeriesCoverUrl(s.id)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 24 }}>📚</span>}
                          </div>
                          <div style={{ padding: "6px 8px", flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{s.book_count} книг</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  {series.length > seriesCount && (
                    <button onClick={() => setActiveTab("series")} style={{ marginTop: 10, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12 }}>Все серии →</button>
                  )}
                </div>
              );

              const authorsList = (
                      <div style={{ display: "flex", flexDirection: "column", gap: authorGap }}>
                        {displayAuthors.slice(0, 10).map((a, index) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: authorGap, padding: authorPad, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                      <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 18, textAlign: "right", flexShrink: 0 }}>{index + 1}</span>
                      <Link href={`/author/${a.id}`} style={{ display: "flex", alignItems: "center", gap: authorGap, textDecoration: "none", flex: 1, minWidth: 0 }}>
                        {a.avatar_url ? <img src={apiGetAvatarUrl(a.id)} alt="" style={{ width: authorAvatar, height: authorAvatar, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                          : <div style={{ width: authorAvatar, height: authorAvatar, borderRadius: "50%", flexShrink: 0, background: "orange", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: "#fff" }}>{a.username[0]}</div>}
                        <span style={{ fontSize: authorFont, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.username}</span>
                        {plusIds.has(a.id) && (
                          <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "var(--accent)", color: "#fff", fontWeight: 600, lineHeight: "16px" }}>+</span>
                        )}
                      </Link>
                      {user && user.id !== a.id && (
                        <button onClick={e => { e.preventDefault(); handleAuthorSubscribe(a.id); }} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: subscribedAuthors.has(a.id) ? "var(--accent)" : "transparent", color: subscribedAuthors.has(a.id) ? "#fff" : "var(--text-secondary)", cursor: "pointer", fontSize: 11 }}>
                          {subscribedAuthors.has(a.id) ? "✓" : "+"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );

              if (stacked) {
                return (
                  <>
                    {hotBlock}
                    <div style={{ marginBottom: 28 }}>
                      {seriesBlock}
                    </div>
                    <div style={{ marginBottom: 28 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Популярные авторы</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: authorGap }}>
                        {authorsList}
                      </div>
                      <button onClick={() => setActiveTab("authors")} style={{ marginTop: 8, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12 }}>Все авторы →</button>
                    </div>
                  </>
                );
              }

              return (
                <>
                  {hotBlock}
                  <div style={{ position: "relative", marginBottom: 28, overflow: "hidden" }}>
                    <div ref={seriesRef} style={{ paddingRight: 304, minWidth: 0 }}>
                      {seriesBlock}
                    </div>
                    <div style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bottom: 0,
                      width: 280,
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      background: "var(--bg-secondary)",
                    }}>
                      <div style={{ padding: "14px 14px 0 14px" }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Популярные авторы</h3>
                      </div>
                      <div style={{
                        overflowY: "auto",
                        flex: 1,
                        minHeight: 0,
                        padding: "10px 14px 0 14px",
                        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 12px, black calc(100% - 12px), transparent 100%)",
                        maskImage: "linear-gradient(to bottom, transparent 0%, black 12px, black calc(100% - 12px), transparent 100%)",
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: authorGap }}>
                          {displayAuthors.map((a, index) => (
                            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: authorGap, padding: authorPad, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                              <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 18, textAlign: "right", flexShrink: 0 }}>{index + 1}</span>
                              <Link href={`/author/${a.id}`} style={{ display: "flex", alignItems: "center", gap: authorGap, textDecoration: "none", flex: 1, minWidth: 0 }}>
                                {a.avatar_url ? <img src={apiGetAvatarUrl(a.id)} alt="" style={{ width: authorAvatar, height: authorAvatar, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                                  : <div style={{ width: authorAvatar, height: authorAvatar, borderRadius: "50%", flexShrink: 0, background: "orange", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: "#fff" }}>{a.username[0]}</div>}
                                <span style={{ fontSize: authorFont, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.username}</span>
                                {plusIds.has(a.id) && (
                                  <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "var(--accent)", color: "#fff", fontWeight: 600, lineHeight: "16px" }}>+</span>
                                )}
                              </Link>
                              {user && user.id !== a.id && (
                                <button onClick={e => { e.preventDefault(); handleAuthorSubscribe(a.id); }} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: subscribedAuthors.has(a.id) ? "var(--accent)" : "transparent", color: subscribedAuthors.has(a.id) ? "#fff" : "var(--text-secondary)", cursor: "pointer", fontSize: 11 }}>
                                  {subscribedAuthors.has(a.id) ? "✓" : "+"}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ padding: "12px 14px 14px 14px" }}>
                        <button onClick={() => setActiveTab("authors")} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12 }}>Все авторы →</button>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10, paddingTop: 8 }}>Все книги</h3>
            {books.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>Нет книг</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {books.slice(0, page === 1 ? 20 : limit).map(book => (
                  <div key={book.id} style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-secondary)", transition: "transform 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                    <Link href={`/book/${book.id}`} style={{ textDecoration: "none" }}>
                      <div style={{ aspectRatio: "2/3", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {book.cover_image && !failedCovers.has(book.id) ? <img src={apiGetCoverUrl(book.id)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setFailedCovers(prev => new Set(prev).add(book.id))} /> : <span style={{ fontSize: 36 }}>📖</span>}
                      </div>
                      <div style={{ padding: "8px 10px" }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{book.title}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{book.owner_username}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                          {book.formats && <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>{book.formats.map((f: string) => f.toUpperCase()).join(" ")}</span>}
                          <button onClick={e => { e.preventDefault(); handleLike(book.id, book.is_liked); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: book.is_liked ? "red" : "var(--text-muted)", display: "flex", alignItems: "center", gap: 2, padding: 0 }}>
                            {book.is_liked ? "❤️" : "🤍"} {book.like_count}
                          </button>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Pagination */}
        {(activeTab === "all" || activeTab === "books") && totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 28, flexWrap: "wrap" }}>
            <button onClick={() => paginate(1)} disabled={page === 1} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: page === 1 ? "var(--text-muted)" : "var(--text-primary)", cursor: page === 1 ? "default" : "pointer", fontSize: 13 }}>{'<<'}</button>
            <button onClick={() => paginate(page - 1)} disabled={page === 1} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: page === 1 ? "var(--text-muted)" : "var(--text-primary)", cursor: page === 1 ? "default" : "pointer", fontSize: 13 }}>{'<'}</button>
            {(() => {
              const pages: any[] = [];
              const s = Math.max(1, page - 2);
              const e = Math.min(totalPages, page + 2);
              if (s > 1) { pages.push(1); if (s > 2) pages.push("..."); }
              for (let i = s; i <= e; i++) pages.push(i);
              if (e < totalPages) { if (e < totalPages - 1) pages.push("..."); pages.push(totalPages); }
              return pages.map((p, i) =>
                typeof p === "string" ? <span key={`e${i}`} style={{ fontSize: 13, color: "var(--text-muted)" }}>…</span>
                  : <button key={p} onClick={() => paginate(p)} style={{ padding: "8px 12px", borderRadius: 6, border: "none", background: p === page ? "var(--accent)" : "var(--bg-secondary)", color: p === page ? "#fff" : "var(--text-primary)", cursor: "pointer", fontSize: 13, fontWeight: p === page ? 600 : 400 }}>{p}</button>
              );
            })()}
            <button onClick={() => paginate(page + 1)} disabled={page === totalPages} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: page === totalPages ? "var(--text-muted)" : "var(--text-primary)", cursor: page === totalPages ? "default" : "pointer", fontSize: 13 }}>{'>'}</button>
            <button onClick={() => paginate(totalPages)} disabled={page === totalPages} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: page === totalPages ? "var(--text-muted)" : "var(--text-primary)", cursor: page === totalPages ? "default" : "pointer", fontSize: 13 }}>{'>>'}</button>
            <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 8 }}>{page} / {totalPages}</span>
          </div>
        )}

        {/* SERIES TAB */}
        {activeTab === "series" && (
          series.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>Пока нет серий</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {series.map(s => (
                <Link key={s.id} href={`/series/${s.id}`} style={{ textDecoration: "none", display: "block" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-secondary)", transition: "transform 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateX(4px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateX(0)"; }}>
                    <div style={{ width: 50, height: 70, borderRadius: 6, overflow: "hidden", background: "var(--bg-tertiary)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {s.cover_image ? <img src={apiGetSeriesCoverUrl(s.id)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "📚"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 15 }}>{s.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, flexWrap: "wrap", fontSize: 11, color: "var(--text-muted)" }}>
                        <span>{s.book_count} книг</span>
                        <span>❤️ {s.total_likes || 0}</span>
                        <span>👁 {s.total_views || 0}</span>
                        <span>• {s.owner_username}</span>
                      </div>
                    </div>
                    <span style={{ color: "var(--text-muted)" }}>→</span>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* AUTHORS TAB */}
        {activeTab === "authors" && (
          authors.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>Нет авторов</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {authors.map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-secondary)", transition: "transform 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateX(4px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateX(0)"; }}>
                  <Link href={`/author/${a.id}`} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", flex: 1 }}>
                    {a.avatar_url ? <img src={apiGetAvatarUrl(a.id)} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                      : <div style={{ width: 40, height: 40, borderRadius: "50%", background: "orange", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, color: "#fff" }}>{a.username[0]}</div>}
                    <div>
                      <span style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 15 }}>{a.username}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>{a.book_count} книг</span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>• {a.subscriber_count || 0} подписчиков</span>
                    </div>
                  </Link>
                  {user && user.id !== a.id && (
                    <button onClick={() => handleAuthorSubscribe(a.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: subscribedAuthors.has(a.id) ? "var(--accent)" : "transparent", color: subscribedAuthors.has(a.id) ? "#fff" : "var(--text-secondary)", cursor: "pointer", fontSize: 13 }}>
                      {subscribedAuthors.has(a.id) ? "✓ Подписан" : "Подписаться"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
