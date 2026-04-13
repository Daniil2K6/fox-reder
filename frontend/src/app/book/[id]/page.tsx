"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  apiGetBook,
  apiGetComments,
  apiCreateComment,
  apiDeleteComment,
  apiUploadCover,
  apiUpdateMetadata,
  apiGetCoverUrl,
  getUser,
  getToken,
  mergeUser,
  apiGetMe,
  apiLikeBook,
  apiUnlikeBook,
  apiSubscribe,
  apiUnsubscribe,
  apiMySubscriptions,
  apiIncrementView,
  apiAssignToSeries,
  apiListSeries,
} from "@/lib/api";
import { GenreSelector } from "@/components/GenreSelector";

export default function BookPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const bookId = Number(params.id);
  const [book, setBook] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [userEpoch, setUserEpoch] = useState(0);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [editDescription, setEditDescription] = useState("");
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [subscribedAuthors, setSubscribedAuthors] = useState<Set<number>>(new Set());
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [bookSeries, setBookSeries] = useState<number[]>([]);
  const [allSeries, setAllSeries] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [bookId]);

  useEffect(() => {
    if (!getToken()) return;
    const u = getUser();
    if (u && u.id != null) return;
    apiGetMe()
      .then((me) => {
        mergeUser({
          id: me.id,
          username: me.username,
          role: me.role,
          preferred_voice: me.preferred_voice,
          preferred_language: me.preferred_language,
        });
        setUserEpoch((e) => e + 1);
      })
      .catch(() => {});
  }, []);

  const loadData = async () => {
    try {
      const b = await apiGetBook(bookId);
      setBook(b);
      setEditGenres(b.genres ? b.genres.split(",").map((g: string) => g.trim()).filter((g: string) => g) : []);
      setEditDescription(b.description || "");
      setBookSeries(b.series_ids || []);
      const c = await apiGetComments(bookId);
      setComments(c);
      
      const u = getUser();
      if (u) {
        const subs = await apiMySubscriptions();
        const subSet = new Set<number>();
        subs.forEach((s: any) => subSet.add(s.author_id));
        setSubscribedAuthors(subSet);
        
        if (u.id === b.owner_id) {
          const seriesList = await apiListSeries();
          setAllSeries(seriesList);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await apiCreateComment(bookId, newComment);
      setNewComment("");
      const c = await apiGetComments(bookId);
      setComments(c);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await apiDeleteComment(bookId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    try {
      await apiUploadCover(bookId, e.target.files[0]);
      setBook((prev: any) => prev ? { ...prev, cover_image: null } : null);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMetadataUpdate = async () => {
    try {
      await apiUpdateMetadata(bookId, { genres: editGenres.join(", "), description: editDescription });
      await loadData();
      setEditMode(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLike = async () => {
    const u = getUser();
    if (!u) {
      router.push("/login");
      return;
    }
    try {
      if (book.is_liked) {
        await apiUnlikeBook(bookId);
        setBook((prev: any) => prev ? { ...prev, is_liked: false, like_count: Math.max(0, (prev.like_count || 0) - 1) } : null);
      } else {
        await apiLikeBook(bookId);
        setBook((prev: any) => prev ? { ...prev, is_liked: true, like_count: (prev.like_count || 0) + 1 } : null);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubscribe = async () => {
    const u = getUser();
    if (!u) {
      router.push("/login");
      return;
    }
    if (book.owner_id === u.id) return;
    try {
      const newSubscribed = new Set(subscribedAuthors);
      if (subscribedAuthors.has(book.owner_id)) {
        await apiUnsubscribe(book.owner_id);
        newSubscribed.delete(book.owner_id);
      } else {
        await apiSubscribe(book.owner_id);
        newSubscribed.add(book.owner_id);
      }
      setSubscribedAuthors(newSubscribed);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const user = useMemo(() => getUser(), [userEpoch]);
  const uid = user?.id != null ? Number(user.id) : null;
  const isOwner = uid !== null && book != null && uid === Number(book.owner_id);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
        Loading...
      </div>
    );
  }

  if (error && !book) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", color: "var(--error)" }}>
        <p>{error}</p>
        <button onClick={() => router.back()} style={{ marginLeft: 16, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer" }}>Back</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", padding: 24 }}>
      <button onClick={() => router.back()} style={{ marginBottom: 16, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer" }}>← Back</button>

      <div style={{ display: "flex", gap: 24, maxWidth: 1000, margin: "0 auto" }}>
        {/* Left: Cover and metadata */}
        <div style={{ flex: 1, maxWidth: 400 }}>
          {book?.cover_image ? (
            <img src={apiGetCoverUrl(bookId) + "?t=" + new Date().getTime()} alt={book.title} style={{ width: "100%", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
          ) : (
            <div style={{ width: "100%", height: 300, background: "var(--bg-secondary)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
              Нет обложки
            </div>
          )}
          {isOwner && (
            <div style={{ marginTop: 12 }}>
              <button onClick={() => coverInputRef.current?.click()} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", width: "100%" }}>
                Загрузить обложку
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverUpload} />
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{book?.title}</h1>
            {isOwner && (
              <div style={{ marginBottom: 12 }}>
                <button onClick={() => setShowSeriesModal(true)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>
                  📚 Изменить серию
                </button>
              </div>
            )}
            {book?.series_names && book.series_names.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {book.series_names.map((s: string, idx: number) => (
                  <Link key={idx} href={`/series/${book.series_ids[idx]}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent)", background: "var(--accent-light)", padding: "4px 10px", borderRadius: 12, marginRight: 8, textDecoration: "none" }}>
                    📚 {s}
                  </Link>
                ))}
              </div>
            )}
            <p style={{ color: "var(--text-secondary)", marginBottom: 4 }}>Формат: {book?.filename.split('.').pop()?.toLowerCase() ? '.' + book?.filename.split('.').pop()?.toLowerCase() : ''}</p>
            <p style={{ color: "var(--text-secondary)", marginBottom: 4 }}>Владелец: {book?.owner_username}</p>
            <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>Главы: {book?.has_structure ? "Да" : "Нет"}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <button onClick={handleLike} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", fontSize: 14, color: book?.is_liked ? "red" : "var(--text-secondary)" }}>
                {book?.is_liked ? "❤️" : "🤍"} {book?.like_count || 0}
              </button>
              {user && user.id !== book?.owner_id && (
                <button onClick={handleSubscribe} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: subscribedAuthors.has(book?.owner_id) ? "var(--accent)" : "var(--bg-secondary)", color: subscribedAuthors.has(book?.owner_id) ? "#fff" : "var(--text-secondary)", cursor: "pointer", fontSize: 13 }}>
                  {subscribedAuthors.has(book?.owner_id) ? "✓ Подписан" : "Подписаться"}
                </button>
              )}
            </div>
          </div>

          {/* Comments in left column */}
          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Комментарии ({comments.length})</h2>
            {user && (
              <form onSubmit={handleSubmitComment} style={{ marginBottom: 16 }}>
                <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Добавить комментарий..." rows={3} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", marginBottom: 8 }} />
                <button type="submit" disabled={!newComment.trim()} style={{ padding: "8px 16px", borderRadius: 6, background: "var(--accent)", color: "#fff", border: "none", cursor: newComment.trim() ? "pointer" : "not-allowed" }}>Отправить</button>
              </form>
            )}
            {!user && <p style={{ marginBottom: 16, color: "var(--text-muted)" }}>Пожалуйста, <Link href="/login" style={{ color: "var(--accent)" }}>войдите</Link>, чтобы оставить комментарий.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {comments.map((comment) => (
                <div key={comment.id} style={{ padding: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    {comment.user_avatar ? (
                      <img src={`/api/books/user/avatar/${comment.user_id}`} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "orange", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#fff" }}>
                        {comment.user_username[0].toUpperCase()}
                      </div>
                    )}
                    <strong style={{ color: "var(--text-primary)" }}>{comment.user_username}</strong>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>{new Date(comment.created_at).toLocaleString()}</span>
                  </div>
                  <p style={{ color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{comment.content}</p>
                  {(user?.id === comment.user_id || user?.role === "admin") && <button onClick={() => handleDeleteComment(comment.id)} style={{ marginTop: 8, fontSize: 12, color: "var(--error)", background: "none", border: "none", cursor: "pointer" }}>Удалить</button>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Content */}
        <div style={{ flex: 1 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Жанры</h2>
            {book?.genres ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {book.genres.split(",").map((g: string, i: number) => (
                  <span key={i} style={{ padding: "4px 10px", borderRadius: 12, background: "var(--accent-light)", color: "var(--accent)", fontSize: 12 }}>{g.trim()}</span>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)" }}>отсутствует</p>
            )}
            {isOwner && <button onClick={() => setShowGenreModal(true)} style={{ marginTop: 8, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer" }}>Изменить жанры</button>}
          </div>

          {isOwner && editMode && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Описание</label>
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", marginBottom: 8 }} />
              <button onClick={handleMetadataUpdate} style={{ padding: "6px 12px", borderRadius: 6, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>Сохранить</button>
              <button onClick={() => { setEditMode(false); setEditGenres(book?.genres ? book.genres.split(",").map((g: string) => g.trim()).filter((g: string) => g) : []); setEditDescription(book?.description || ""); }} style={{ marginLeft: 8, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer" }}>Отмена</button>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Описание</h2>
            <p style={{ color: book?.description ? "var(--text-primary)" : "var(--text-muted)", whiteSpace: "pre-wrap" }}>{book?.description || "отсутствует"}</p>
          </div>

          {isOwner && !editMode && <button onClick={() => setEditMode(true)} style={{ marginTop: 8, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer" }}>Изменить описание</button>}

          <div style={{ marginTop: 24 }}>
            <Link href={`/reader/${bookId}`} onClick={() => apiIncrementView(bookId).catch(() => {})} style={{ display: "block", padding: "10px 0", textAlign: "center", background: "var(--accent)", color: "#fff", textDecoration: "none", borderRadius: 8, fontWeight: 600 }}>Читать книгу</Link>
          </div>
        </div>
      </div>

      {showGenreModal && (
        <GenreSelector selectedGenres={editGenres} onSave={(g) => { setEditGenres(g); setShowGenreModal(false); }} onClose={() => setShowGenreModal(false)} />
      )}

      {showSeriesModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-secondary)", padding: 24, borderRadius: 12, width: "90%", maxWidth: 400 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Выбрать серию</h2>
              <button onClick={() => setShowSeriesModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {allSeries.map((s) => (
                <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: bookSeries.includes(s.id) ? "1px solid var(--accent)" : "1px solid var(--border)", background: bookSeries.includes(s.id) ? "var(--accent-light)" : "transparent", cursor: "pointer", marginBottom: 4 }}>
                  <input type="checkbox" checked={bookSeries.includes(s.id)} onChange={(e) => {
                    const next = new Set(bookSeries);
                    if (e.target.checked) next.add(s.id);
                    else next.delete(s.id);
                    setBookSeries(Array.from(next));
                  }} />
                  <span style={{ fontSize: 14, color: "var(--text-primary)" }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>{s.book_count} книг</span>
                </label>
              ))}
              {allSeries.length === 0 && <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Нет серий</p>}
            </div>
            <button onClick={async () => { await apiAssignToSeries(bookId, bookSeries); loadData(); setShowSeriesModal(false); }} style={{ marginTop: 16, width: "100%", padding: "10px", borderRadius: 8, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>Сохранить</button>
          </div>
        </div>
      )}
    </div>
  );
}