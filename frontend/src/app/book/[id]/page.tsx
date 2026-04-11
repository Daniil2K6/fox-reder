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
} from "@/lib/api";

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
  const [editGenres, setEditGenres] = useState("");
  const [editDescription, setEditDescription] = useState("");

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
      setEditGenres(b.genres || "");
      setEditDescription(b.description || "");
      const c = await apiGetComments(bookId);
      setComments(c);
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
      const c = await apiCreateComment(bookId, newComment);
      setComments((prev) => [...prev, c]);
      setNewComment("");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm("Delete comment?")) return;
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
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMetadataUpdate = async () => {
    try {
      await apiUpdateMetadata(bookId, { genres: editGenres, description: editDescription });
      await loadData();
      setEditMode(false);
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
        <div style={{ flex: 1, maxWidth: 300 }}>
          {book?.cover_image ? (
            <img src={apiGetCoverUrl(bookId)} alt={book.title} style={{ width: "100%", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
          ) : (
            <div style={{ width: "100%", height: 300, background: "var(--bg-secondary)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
              No cover
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{book?.title}</h1>
            <p style={{ color: "var(--text-secondary)", marginBottom: 4 }}>Format: {book?.filename.split('.').pop()?.toLowerCase() ? '.' + book?.filename.split('.').pop()?.toLowerCase() : ''}</p>
            <p style={{ color: "var(--text-secondary)", marginBottom: 4 }}>Owner: {book?.owner_username}</p>
            <p style={{ color: "var(--text-secondary)", marginBottom: 4 }}>Access: {book?.is_public ? "Public" : "Private"}</p>
            <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>Chapters: {book?.has_structure ? "Yes" : "No"}</p>
          </div>

          {isOwner && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 16 }}>
              <h3 style={{ marginBottom: 8 }}>Manage Book</h3>
              <div style={{ marginBottom: 8 }}>
                <button onClick={() => coverInputRef.current?.click()} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer" }}>
                  Upload Cover
                </button>
                <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverUpload} />
              </div>
              {editMode ? (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)" }}>Genres (comma separated)</label>
                    <input value={editGenres} onChange={(e) => setEditGenres(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }} />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)" }}>Description</label>
                    <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }} />
                  </div>
                  <button onClick={handleMetadataUpdate} style={{ padding: "6px 12px", borderRadius: 6, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>Save</button>
                  <button onClick={() => { setEditMode(false); setEditGenres(book?.genres || ""); setEditDescription(book?.description || ""); }} style={{ marginLeft: 8, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer" }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setEditMode(true)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer" }}>Edit Metadata</button>
              )}
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Genres</h2>
            <p style={{ color: book?.genres ? "var(--text-primary)" : "var(--text-muted)" }}>{book?.genres || "отсутствует"}</p>
          </div>

          <div style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Description</h2>
            <p style={{ color: book?.description ? "var(--text-primary)" : "var(--text-muted)", whiteSpace: "pre-wrap" }}>{book?.description || "отсутствует"}</p>
          </div>

          <div style={{ marginTop: 24 }}>
            <Link href={`/reader/${bookId}`} style={{ display: "block", padding: "10px 0", textAlign: "center", background: "var(--accent)", color: "#fff", textDecoration: "none", borderRadius: 8, fontWeight: 600 }}>
              Read Book
            </Link>
          </div>
        </div>

        {/* Right: Comments */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Comments ({comments.length})</h2>

          {user && (
            <form onSubmit={handleSubmitComment} style={{ marginBottom: 24 }}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", marginBottom: 8 }}
              />
              <button type="submit" disabled={!newComment.trim()} style={{ padding: "8px 16px", borderRadius: 6, background: "var(--accent)", color: "#fff", border: "none", cursor: newComment.trim() ? "pointer" : "not-allowed" }}>
                Post Comment
              </button>
            </form>
          )}

          {!user && (
            <p style={{ marginBottom: 24, color: "var(--text-muted)" }}>Please <Link href="/login" style={{ color: "var(--accent)" }}>log in</Link> to comment.</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {comments.map((comment) => (
              <div key={comment.id} style={{ padding: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <strong style={{ color: "var(--text-primary)" }}>{comment.user_username}</strong>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(comment.created_at).toLocaleString()}</span>
                </div>
                <p style={{ color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{comment.content}</p>
                {(user?.id === comment.user_id || user?.role === "admin") && (
                  <button onClick={() => handleDeleteComment(comment.id)} style={{ marginTop: 8, fontSize: 12, color: "var(--error)", background: "none", border: "none", cursor: "pointer" }}>
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
