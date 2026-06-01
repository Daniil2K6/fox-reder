"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { getUser, clearToken, clearUser, getTheme, setTheme, apiGetCoverUrl, apiGetAvatarUrl, apiGetSeriesCoverUrl, apiPublicBooksPaginated, apiPublicBooksCount, apiPublicSeries, apiAuthors, apiHotBooks, apiLikeBook, apiUnlikeBook, apiSubscribe, apiUnsubscribe } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { SearchPanel } from "@/components/SearchPanel";
import type { SearchState } from "@/components/SearchPanel";
import { useRouter } from "next/navigation";

interface Book {
  id: number; title: string; filename: string; is_public: boolean;
  owner_id: number; owner_username: string; has_structure: boolean;
  cover_image: string | null; genres: string | null; description: string | null;
  comment_count: number; like_count: number; is_liked: boolean;
  view_count: number; owner_avatar: string | null;
  series_ids?: number[]; series_names?: string[]; formats?: string[];
}

const EMPTY_SEARCH: SearchState = {
  search: "",
  matchMode: "soft",
  searchFields: "all",
  sortBy: "created_at",
  whitelist: [],
  blacklist: [],
};

export default function PublicLibraryPage() {
  const [user, setUserState] = useState<any>(null);
  const [theme, setThemeState] = useState("light");
  const [activeTab, setActiveTab] = useState<"all" | "books" | "series" | "authors">("all");
  const [books, setBooks] = useState<Book[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [allSeries, setAllSeries] = useState<any[]>([]);
  const [authors, setAuthors] = useState<any[]>([]);
  const [allAuthors, setAllAuthors] = useState<any[]>([]);
  const [hotBooks, setHotBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalBooks, setTotalBooks] = useState(0);
  const [subscribedAuthors, setSubscribedAuthors] = useState<Set<number>>(new Set());
  const [failedCovers, setFailedCovers] = useState<Set<number>>(new Set());
  const [screenSize, setScreenSize] = useState<"xl" | "lg" | "md" | "sm">("xl");
  const seriesRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [searchInitiated, setSearchInitiated] = useState(false);
  const [contentKey, setContentKey] = useState(0);

  // Committed search state (only changes when user clicks "Найти")
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);

  // URL sync
  const syncUrl = useCallback(() => {
    const url = new URL(window.location.href);
    if (page > 1) url.searchParams.set("page", String(page));
    else url.searchParams.delete("page");
    if (search.search) url.searchParams.set("q", search.search);
    else url.searchParams.delete("q");
    if (search.matchMode !== "soft") url.searchParams.set("match_mode", search.matchMode);
    else url.searchParams.delete("match_mode");
    if (search.searchFields !== "all") url.searchParams.set("search_fields", search.searchFields);
    else url.searchParams.delete("search_fields");
    if (search.sortBy !== "created_at") url.searchParams.set("sort_by", search.sortBy);
    else url.searchParams.delete("sort_by");
    if (search.whitelist.length) url.searchParams.set("whitelist", search.whitelist.join(","));
    else url.searchParams.delete("whitelist");
    if (search.blacklist.length) url.searchParams.set("blacklist", search.blacklist.join(","));
    else url.searchParams.delete("blacklist");
    window.history.replaceState({}, "", url.toString());
  }, [page, search]);

  // Read URL params on mount + listen for back/forward
  const readUrlAndLoad = () => {
    const params = new URLSearchParams(window.location.search);
    const p = parseInt(params.get("page") || "1", 10);
    const q = params.get("q") || "";
    const mm = params.get("match_mode");
    const sf = params.get("search_fields");
    const sb = params.get("sort_by") || "created_at";
    const wl = params.get("whitelist");
    const bl = params.get("blacklist");

    const nextSearch: SearchState = {
      search: q,
      matchMode: mm === "strict" ? "strict" : "soft",
      searchFields: sf === "title" || sf === "description" ? sf : "all",
      sortBy: sb,
      whitelist: wl ? wl.split(",").filter(Boolean) : [],
      blacklist: bl ? bl.split(",").filter(Boolean) : [],
    };
    setPage(p > 1 ? p : 1);
    setSearch(nextSearch);

    const hasFilters = q || wl || bl || mm || sf || (sb && sb !== "created_at");
    if (hasFilters) {
      setSearchInitiated(true);
      // Reload everything with filters
      const genreWl = wl ? wl.split(",").filter(Boolean) : undefined;
      const genreBl = bl ? bl.split(",").filter(Boolean) : undefined;
      const hasGenreFilter = (genreWl && genreWl.length > 0) || (genreBl && genreBl.length > 0);
      Promise.all([
        apiHotBooks(hasGenreFilter ? genreWl : undefined, hasGenreFilter ? genreBl : undefined),
        apiAuthors(hasGenreFilter ? genreWl : undefined, hasGenreFilter ? genreBl : undefined),
        apiPublicSeries(hasGenreFilter ? genreWl : undefined, hasGenreFilter ? genreBl : undefined),
      ]).then(([hot, auth, ser]) => {
        setHotBooks(hot?.slice(0, 4) || []);
        setAllAuthors(auth || []);
        setAuthors(auth || []);
        setAllSeries(ser || []);
        setSeries(ser || []);
      }).catch(() => {});
      loadBooks(nextSearch, p > 1 ? p : 1);
    }
  };

  useEffect(() => {
    setUserState(getUser());
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    loadInitial();
    const onPopState = () => readUrlAndLoad();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Resize listener
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

  const loadInitial = async () => {
    try {
      const hasUrlFilters = !!window.location.search && window.location.search !== "?";
      // Read genre filters from URL for initial load
      const params = new URLSearchParams(window.location.search);
      const wlParam = params.get("whitelist");
      const blParam = params.get("blacklist");
      const wl = wlParam ? wlParam.split(",").filter(Boolean) : undefined;
      const bl = blParam ? blParam.split(",").filter(Boolean) : undefined;
      const hasGenreFilter = (wl && wl.length > 0) || (bl && bl.length > 0);
      const genreWl = hasGenreFilter ? wl : undefined;
      const genreBl = hasGenreFilter ? bl : undefined;

      const [hot, auth, ser] = await Promise.all([
        apiHotBooks(genreWl, genreBl),
        apiAuthors(genreWl, genreBl),
        apiPublicSeries(genreWl, genreBl),
      ]);
      setHotBooks(hot?.slice(0, 4) || []);
      setAllAuthors(auth || []);
      setAuthors(auth || []);
      setAllSeries(ser || []);
      setSeries(ser || []);
      const subs = new Set<number>();
      (auth || []).forEach((a: any) => { if (a.is_subscribed) subs.add(a.id); });
      setSubscribedAuthors(subs);

      if (hasUrlFilters) {
        setSearchInitiated(true);
        await loadBooks();
      } else {
        const [booksData, countData] = await Promise.all([
          apiPublicBooksPaginated(1, PAGE_LIMIT),
          apiPublicBooksCount(),
        ]);
        setBooks(booksData || []);
        setTotalBooks(countData?.total || 0);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  };

  // Reload books when tab or page changes
  useEffect(() => {
    if (!initialLoaded || !searchInitiated) return;
    loadBooks();
  }, [activeTab, page]);

  // Reload hot/authors/series when genre filters change
  const genreFilterKey = JSON.stringify({ wl: search.whitelist, bl: search.blacklist });
  useEffect(() => {
    if (!initialLoaded) return;
    const hasGenreFilter = search.whitelist.length > 0 || search.blacklist.length > 0;
    const wl = hasGenreFilter ? search.whitelist : undefined;
    const bl = hasGenreFilter ? search.blacklist : undefined;
    Promise.all([
      apiHotBooks(wl, bl),
      apiAuthors(wl, bl),
      apiPublicSeries(wl, bl),
    ]).then(([hot, auth, ser]) => {
      setHotBooks(hot?.slice(0, 4) || []);
      setAllAuthors(auth || []);
      setAuthors(auth || []);
      setAllSeries(ser || []);
      setSeries(ser || []);
    }).catch(() => {});
  }, [genreFilterKey]);

  const loadBooks = async (searchOverride?: SearchState, pageOverride?: number) => {
    if (activeTab === "series" || activeTab === "authors") return;
    const s = searchOverride || search;
    const p = pageOverride ?? page;
    try {
      const hasSearch = !!s.search;
      const hasFilters = s.whitelist.length > 0 || s.blacklist.length > 0;
      const [booksData, countData] = await Promise.all([
        apiPublicBooksPaginated(
          p, PAGE_LIMIT,
          hasSearch ? s.search : undefined,
          hasSearch ? s.sortBy : "created_at",
          undefined, undefined,
          hasFilters ? { mode: "strict", whitelist: s.whitelist, blacklist: s.blacklist } : undefined,
          s.matchMode,
          s.searchFields,
        ),
        apiPublicBooksCount(
          hasSearch ? s.search : undefined,
          s.whitelist.length ? s.whitelist : undefined,
          s.blacklist.length ? s.blacklist : undefined,
        ),
      ]);
      setBooks(booksData || []);
      setTotalBooks(countData?.total || 0);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Client-side filtering for authors and series
  const filteredAuthors = search.search
    ? allAuthors.filter((a: any) => a.username.toLowerCase().includes(search.search.toLowerCase()))
    : allAuthors;

  const filteredSeries = search.search
    ? allSeries.filter((s: any) => s.name.toLowerCase().includes(search.search.toLowerCase()))
    : allSeries;

  const handleSearch = (newState: SearchState) => {
    setSearch(newState);
    setPage(1);
    setSearchInitiated(true);
    syncUrl();
    loadBooks(newState);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTabChange = (tab: "all" | "books" | "series" | "authors") => {
    setActiveTab(tab);
    setPage(1);
    if (searchInitiated) loadBooks();
    setContentKey(k => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const PAGE_LIMIT = 36;
  const totalPages = Math.ceil(totalBooks / PAGE_LIMIT);

  const paginate = (p: number) => {
    const next = Math.max(1, Math.min(totalPages, p));
    setPage(next);
    syncUrl();
    loadBooks(undefined, next);
    setContentKey(k => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>Loading...</div>;
  }

  const isSearching = !!search.search;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <Navbar activeTab="public" />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 60px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {(["all", "books", "series", "authors"] as const).map(t => (
            <button key={t} onClick={() => handleTabChange(t)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: activeTab === t ? "var(--accent)" : "var(--bg-secondary)", color: activeTab === t ? "#fff" : "var(--text-secondary)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
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

        {/* Search Panel */}
        <SearchPanel state={search} activeTab={activeTab} onSearch={handleSearch} />

        {/* ===== Content with animation ===== */}
        <div key={`content-${contentKey}`} className="page-transition">
        {activeTab === "all" && (
          <>
            {/* When NOT searching: show hot, series, authors sidebar, books grid (original layout) */}
            {!isSearching && page <= 1 && (() => {
              const activeAuthors = filteredAuthors.filter((a: any) => a.is_active);
              const inactiveAuthors = filteredAuthors.filter((a: any) => !a.is_active);
              const displayAuthors = [...activeAuthors, ...inactiveAuthors];
              const plusIds = new Set(displayAuthors.filter((a: any) => a.is_plus).slice(0, 3).map((a: any) => a.id));
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
                    {hotBooks.map((b: any) => (
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
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Серии</h3>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${seriesCols}, 1fr)`, gap: seriesGap }}>
                    {filteredSeries.slice(0, seriesCount).map((s: any) => (
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
                  {filteredSeries.length > seriesCount && (
                    <button onClick={() => handleTabChange("series")} style={{ marginTop: 10, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12 }}>Все серии →</button>
                  )}
                </div>
              );

              const authorsList = (
                <div style={{ display: "flex", flexDirection: "column", gap: authorGap }}>
                  {displayAuthors.slice(0, 50).map((a: any, index: number) => (
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
                    <div style={{ marginBottom: 28 }}>{seriesBlock}</div>
                    <div style={{ marginBottom: 28 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Авторы</h3>
                      {authorsList}
                      <button onClick={() => handleTabChange("authors")} style={{ marginTop: 8, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12 }}>Все авторы →</button>
                    </div>
                  </>
                );
              }

              return (
                <>
                  {hotBlock}
                  <div style={{ position: "relative", marginBottom: 28, overflow: "hidden" }}>
                    <div ref={seriesRef} style={{ paddingRight: 304, minWidth: 0 }}>{seriesBlock}</div>
                    <div style={{
                      position: "absolute", top: 0, right: 0, bottom: 0, width: 280, borderRadius: 12,
                      border: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--bg-secondary)",
                    }}>
                      <div style={{ padding: "14px 14px 0 14px" }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Авторы</h3>
                      </div>
                      <div style={{
                        overflowY: "auto", flex: 1, minHeight: 0, padding: "10px 14px 0 14px",
                        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 12px, black calc(100% - 12px), transparent 100%)",
                        maskImage: "linear-gradient(to bottom, transparent 0%, black 12px, black calc(100% - 12px), transparent 100%)",
                      }}>
                        {authorsList}
                      </div>
                      <div style={{ padding: "12px 14px 14px 14px" }}>
                        <button onClick={() => handleTabChange("authors")} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12 }}>Все авторы →</button>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* When searching on "all" tab: show matched authors, series only on page 1 */}
            {isSearching && page <= 1 && (
              <>
                {filteredAuthors.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Авторы</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {filteredAuthors.slice(0, 10).map((a: any) => (
                        <Link key={a.id} href={`/author/${a.id}`} style={{ textDecoration: "none", display: "block" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", transition: "transform 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "translateX(4px)"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "translateX(0)"; }}>
                            {a.avatar_url ? <img src={apiGetAvatarUrl(a.id)} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                              : <div style={{ width: 36, height: 36, borderRadius: "50%", background: "orange", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: "#fff", flexShrink: 0 }}>{a.username[0]}</div>}
                            <div style={{ flex: 1 }}>
                              <span style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 14 }}>{a.username}</span>
                              <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>{a.book_count} книг</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {filteredSeries.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Серии</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {filteredSeries.slice(0, 10).map((s: any) => (
                        <Link key={s.id} href={`/series/${s.id}`} style={{ textDecoration: "none", display: "block" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", transition: "transform 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "translateX(4px)"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "translateX(0)"; }}>
                            <div style={{ width: 40, height: 56, borderRadius: 6, overflow: "hidden", background: "var(--bg-tertiary)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {s.cover_image ? <img src={apiGetSeriesCoverUrl(s.id)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "📚"}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 14 }}>{s.name}</div>
                              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{s.book_count} книг</div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Books grid */}
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10, paddingTop: 8 }}>
              {isSearching ? `Книги (${totalBooks})` : "Все книги"}
            </h3>
            {books.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                {isSearching ? "Ничего не найдено" : "Нет книг"}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {books.map(book => (
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

            {/* Pagination for ALL tab */}
            {totalPages > 1 && (
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
          </>
        )}

        {/* ===== BOOKS TAB ===== */}
        {activeTab === "books" && (
          <>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>
              {isSearching ? `Результаты (${totalBooks})` : "Все книги"}
            </h3>
            {books.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                {isSearching ? "Ничего не найдено" : "Нет книг"}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {books.map(book => (
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

            {/* Pagination */}
            {totalPages > 1 && (
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
          </>
        )}

        {/* ===== SERIES TAB ===== */}
        {activeTab === "series" && (
          filteredSeries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
              {isSearching ? "Серии не найдены" : "Пока нет серий"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredSeries.map((s: any) => (
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

        {/* ===== AUTHORS TAB ===== */}
        {activeTab === "authors" && (
          filteredAuthors.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
              {isSearching ? "Авторы не найдены" : "Нет авторов"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredAuthors.map((a: any) => (
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
    </div>
  );
}
