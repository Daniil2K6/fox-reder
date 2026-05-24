import { useState, useEffect, useRef } from "react";
import { GenreSelector } from "./GenreSelector";
import {
  apiRenameBook, apiUpdateMetadata, apiUploadCover,
  apiAssignToSeries, apiListSeries, apiCreateSeries,
} from "@/lib/api";

export function BookEditModal({
  book,
  onClose,
  onSave,
}: {
  book: { id: number; title: string; genres?: string; description?: string; series_ids?: number[] };
  onClose: () => void;
  onSave: () => void;
}) {
  const [title, setTitle] = useState(book.title);
  const [genres, setGenres] = useState(book.genres || "");
  const [description, setDescription] = useState(book.description || "");
  const [selectedSeries, setSelectedSeries] = useState<number[]>(book.series_ids || []);
  const [allSeries, setAllSeries] = useState<any[]>([]);
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seriesSearch, setSeriesSearch] = useState("");
  const [newSeriesName, setNewSeriesName] = useState("");
  const coverRef = useRef<HTMLInputElement>(null);

  const loadSeries = () => {
    apiListSeries().then(setAllSeries).catch(() => {});
  };

  useEffect(() => {
    loadSeries();
  }, []);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    try {
      await apiUploadCover(book.id, e.target.files[0]);
      onSave();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateSeries = async () => {
    const name = newSeriesName.trim();
    if (!name) return;
    try {
      const result = await apiCreateSeries(name);
      setSelectedSeries(prev => [...prev, result.id]);
      setNewSeriesName("");
      loadSeries();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (title.trim() && title !== book.title) {
        await apiRenameBook(book.id, title);
      }
      const meta: { genres?: string; description?: string } = {};
      if (genres !== (book.genres || "")) meta.genres = genres;
      if (description !== (book.description || "")) meta.description = description;
      if (Object.keys(meta).length > 0) {
        await apiUpdateMetadata(book.id, meta);
      }
      const oldIds = book.series_ids || [];
      if (JSON.stringify(selectedSeries.sort()) !== JSON.stringify([...oldIds].sort())) {
        await apiAssignToSeries(book.id, selectedSeries);
      }
      onSave();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredSeries = allSeries.filter((s: any) => {
    if (!seriesSearch) return true;
    const q = seriesSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.owner_username && s.owner_username.toLowerCase().includes(q));
  });

  const isAdmin = () => {
    try {
      const u = JSON.parse(localStorage.getItem("fox_user") || "{}");
      return u.role === "admin";
    } catch { return false; }
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-primary)", borderRadius: 16, border: "1px solid var(--border)", width: "100%", maxWidth: 500, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Редактировать книгу</h2>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "var(--text-muted)", cursor: "pointer" }}>×</button>
          </div>
          <div style={{ padding: "16px 24px", overflow: "auto", flex: 1 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Название</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Обложка</label>
              <button onClick={() => coverRef.current?.click()}
                style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", cursor: "pointer", fontSize: 13 }}>
                Загрузить обложку
              </button>
              <input ref={coverRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverUpload} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Серия</label>
              <input value={seriesSearch} onChange={(e) => setSeriesSearch(e.target.value)} placeholder="Поиск серии..."
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box", marginBottom: 6 }} />
              <div style={{ maxHeight: 140, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 6 }}>
                {filteredSeries.length === 0 && <div style={{ padding: 8, fontSize: 13, color: "var(--text-muted)" }}>Нет серий по запросу</div>}
                {filteredSeries.map((s: any) => (
                  <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, cursor: "pointer", background: selectedSeries.includes(s.id) ? "var(--accent-light)" : "transparent" }}>
                    <input type="checkbox" checked={selectedSeries.includes(s.id)}
                      onChange={(e) => {
                        const next = new Set(selectedSeries);
                        e.target.checked ? next.add(s.id) : next.delete(s.id);
                        setSelectedSeries(Array.from(next));
                      }} />
                    <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{s.name}</span>
                    {isAdmin() && s.owner_username && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>{s.owner_username}</span>
                    )}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input value={newSeriesName} onChange={(e) => setNewSeriesName(e.target.value)} placeholder="Новая серия..."
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box" }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateSeries(); }} />
                <button onClick={handleCreateSeries} style={{ padding: "8px 12px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                  + Создать
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Жанры</label>
              <button onClick={() => setShowGenreModal(true)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, cursor: "pointer", textAlign: "left" }}>
                {genres ? genres.split(",").filter(Boolean).length + " выбрано" : "Выбрать жанры"}
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Описание</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "12px 24px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
            <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)", cursor: "pointer", fontSize: 13 }}>Отмена</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: saving ? "var(--text-muted)" : "var(--accent)", color: "#fff", cursor: saving ? "wait" : "pointer", fontSize: 13, fontWeight: 600 }}>
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
      {showGenreModal && (
        <GenreSelector
          selectedGenres={genres ? genres.split(",").map((g: string) => g.trim()).filter(Boolean) : []}
          onSave={(g) => { setGenres(g.join(", ")); setShowGenreModal(false); }}
          onClose={() => setShowGenreModal(false)}
        />
      )}
    </>
  );
}
