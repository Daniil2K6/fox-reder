"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  getUser,
  getTheme,
  setTheme,
  apiGetBook,
  apiGetBookText,
  apiGetBookStructured,
  apiTTSChunk,
  apiTTSChunkWithCharacter,
  apiSetVoicePreference,
} from "@/lib/api";

/* ── types ─────────────────────────────────────────────────────────── */

interface Book {
  id: number;
  title: string;
  filename: string;
  is_public: boolean;
  owner_username: string;
  has_structure: boolean;
}

interface TocItem {
  id: string;
  title: string;
  index: number;
}

interface Paragraph {
  id: string;
  text: string;
  character: string | null;
  bold: boolean;
  italic: boolean;
  color: string | null;
}

interface Chapter {
  id: string;
  title: string;
  index: number;
  paragraphs: Paragraph[];
}

interface StructuredData {
  format_version: string;
  title: string;
  author: string;
  toc: TocItem[];
  chapters: Chapter[];
}

type ViewMode = "continuous" | "chapter" | "pages";

/* ── constants ─────────────────────────────────────────────────────── */

const VOICE_OPTIONS = [
  { id: "ru", label: "Русский" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
  { id: "ja", label: "日本語" },
];

const VOICE_TYPES = [
  { id: "default", label: "Обычный" },
  { id: "male", label: "Мужской" },
  { id: "female", label: "Женский" },
  { id: "soft", label: "Мягкий" },
];

const CHAPTER_RE =
  /^(глава|chapter|часть|part|section|пролог|prologue|эпilogue|книга|book|interlude)\s*[.\d]*/i;

/* ── chapter detection from plain text ─────────────────────────────── */

function detectChapters(text: string): Chapter[] {
  const lines = text.split("\n");
  const chapters: Chapter[] = [];
  let currentLines: string[] = [];
  let currentTitle = "Начало";
  let chapIdx = 0;

  const flush = () => {
    const content = currentLines.join("\n").trim();
    const paragraphs = content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p, pi) => ({
        id: `ch-${chapIdx}-p-${pi}`,
        text: p,
        character: null as string | null,
        bold: false,
        italic: false,
        color: null as string | null,
      }));

    if (paragraphs.length > 0 || chapIdx === 0) {
      chapters.push({
        id: `ch-${chapIdx}`,
        title: currentTitle,
        index: chapIdx,
        paragraphs,
      });
      chapIdx++;
    }
    currentLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (CHAPTER_RE.test(trimmed) && trimmed.length < 120) {
      flush();
      currentTitle = trimmed;
    } else {
      currentLines.push(line);
    }
  }
  flush();

  if (chapters.length === 0) {
    chapters.push({
      id: "ch-0",
      title: "Текст",
      index: 0,
      paragraphs: text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .map((p, pi) => ({
          id: `ch-0-p-${pi}`,
          text: p,
          character: null as string | null,
          bold: false,
          italic: false,
          color: null as string | null,
        })),
    });
  }

  return chapters;
}

/* ── component ─────────────────────────────────────────────────────── */

export default function ReaderPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = Number(params.id);

  /* ── data state ── */
  const [book, setBook] = useState<Book | null>(null);
  const [plainText, setPlainText] = useState("");
  const [structured, setStructured] = useState<StructuredData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ── UI state ── */
  const [theme, setThemeState] = useState("dark");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);

  /* ── pagination state ── */
  const [viewMode, setViewMode] = useState<ViewMode>("continuous");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentChapter, setCurrentChapter] = useState(0);

  /* ── TTS state ── */
  const [ttsState, setTtsState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [language, setLanguage] = useState("ru");
  const [voiceType, setVoiceType] = useState<"default" | "male" | "female" | "soft">("default");
  const [highlightPara, setHighlightPara] = useState(-1);
  const [showCharacterLabels, setShowCharacterLabels] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
   const ttsQueueRef = useRef<{ text: string; paraIdx: number; character?: string; voiceType: string }[]>([]);
  const ttsActiveRef = useRef(false);

  const contentRef = useRef<HTMLDivElement>(null);

  /* ── derived ── */

  const chapters: Chapter[] = useMemo(() => {
    if (structured) return structured.chapters;
    if (plainText) return detectChapters(plainText);
    return [];
  }, [structured, plainText]);

  const tocItems: TocItem[] = useMemo(() => {
    if (structured) return structured.toc;
    return chapters.map((ch) => ({ id: ch.id, title: ch.title, index: ch.index }));
  }, [structured, chapters]);

  const totalPages = useMemo(() => {
    if (viewMode === "chapter") return chapters.length;
    if (viewMode === "pages") {
      let total = 0;
      for (const ch of chapters) {
        total += Math.max(1, Math.ceil(ch.paragraphs.length / pageSize));
      }
      return Math.max(total, 1);
    }
    return 1;
  }, [viewMode, chapters, pageSize]);

  const visibleParagraphs = useMemo(() => {
    if (viewMode === "continuous") {
      return chapters.flatMap((ch) =>
        ch.paragraphs.map((p) => ({
          ...p,
          chapterTitle: ch.title,
          chapterId: ch.id,
        }))
      );
    }
    if (viewMode === "chapter") {
      const ch = chapters[currentChapter];
      if (!ch) return [];
      return ch.paragraphs.map((p) => ({
        ...p,
        chapterTitle: ch.title,
        chapterId: ch.id,
      }));
    }
    /* pages mode */
    let skip = 0;
    for (const ch of chapters) {
      const chPages = Math.max(1, Math.ceil(ch.paragraphs.length / pageSize));
      if (currentPage < skip + chPages) {
        const pageInChapter = currentPage - skip;
        const start = pageInChapter * pageSize;
        const slice = ch.paragraphs.slice(start, start + pageSize);
        return slice.map((p) => ({
          ...p,
          chapterTitle: ch.title,
          chapterId: ch.id,
        }));
      }
      skip += chPages;
    }
    return [];
  }, [viewMode, chapters, currentChapter, currentPage, pageSize]);

  const currentChapterTitle = useMemo(() => {
    if (viewMode === "continuous") return null;
    if (viewMode === "chapter") return chapters[currentChapter]?.title ?? null;
    if (visibleParagraphs.length > 0) return visibleParagraphs[0].chapterTitle;
    return null;
  }, [viewMode, chapters, currentChapter, visibleParagraphs]);

  const canGoPrev =
    (viewMode === "chapter" && currentChapter > 0) ||
    (viewMode === "pages" && currentPage > 0);
  const canGoNext =
    (viewMode === "chapter" && currentChapter < chapters.length - 1) ||
    (viewMode === "pages" && currentPage < totalPages - 1);

  /* ── effects ────────────────────────────────────────────────────── */

  useEffect(() => {
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  useEffect(() => {
    loadBook();
  }, [bookId]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

   useEffect(() => {
     const user = getUser();
     if (user?.preferred_language) {
       setLanguage(user.preferred_language);
     }
   }, []);

   useEffect(() => {
     const user = getUser();
     if (user) {
       const vt = (user as any).preferred_voice as any;
       if (vt && ["default", "male", "female", "soft"].includes(vt)) {
         setVoiceType(vt);
       }
       const lang = (user as any).preferred_language;
       if (lang && ["ru", "en", "es", "fr", "de", "ja"].includes(lang)) {
         setLanguage(lang);
       }
     }
   }, []);

   useEffect(() => {
     if (ttsState === "playing" || ttsState === "paused") {
       const currentIdx = highlightPara;
       if (currentIdx >= 0) {
         stopSpeaking();
         setTimeout(() => {
           handleReadFromParagraph(currentIdx);
         }, 100);
       }
     }
   }, [voiceType]);

  /* ── data loading ───────────────────────────────────────────────── */

  const loadBook = async () => {
    setLoading(true);
    setError("");
    try {
      const bookData = await apiGetBook(bookId);
      setBook(bookData);
      if (bookData.has_structure) {
        try {
          const s = await apiGetBookStructured(bookId);
          setStructured(s);
        } catch {
          const td = await apiGetBookText(bookId);
          setPlainText(td.text ?? td);
        }
      } else {
        const td = await apiGetBookText(bookId);
        setPlainText(td.text ?? td);
      }
    } catch (err: any) {
      setError(err.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  /* ── navigation ─────────────────────────────────────────────────── */

  const goToChapter = (idx: number) => {
    setCurrentChapter(idx);
    setCurrentPage(0);
    if (viewMode === "pages") {
      let page = 0;
      for (let i = 0; i < idx && i < chapters.length; i++) {
        page += Math.max(1, Math.ceil(chapters[i].paragraphs.length / pageSize));
      }
      setCurrentPage(page);
    }
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    stopSpeaking();
  };

  const goNext = () => {
    stopSpeaking();
    if (viewMode === "chapter" && currentChapter < chapters.length - 1) {
      goToChapter(currentChapter + 1);
    } else if (viewMode === "pages" && currentPage < totalPages - 1) {
      setCurrentPage((p) => p + 1);
      contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goPrev = () => {
    stopSpeaking();
    if (viewMode === "chapter" && currentChapter > 0) {
      goToChapter(currentChapter - 1);
    } else if (viewMode === "pages" && currentPage > 0) {
      setCurrentPage((p) => p - 1);
      contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /* ── TTS with edge-tts ─────────────────────────────────────────────── */

  const stopSpeaking = useCallback(() => {
    ttsActiveRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    ttsQueueRef.current = [];
    setTtsState("idle");
    setHighlightPara(-1);
  }, []);

  const playQueueItem = useCallback(async () => {
    if (!ttsActiveRef.current || ttsQueueRef.current.length === 0) {
      stopSpeaking();
      return;
    }

    const item = ttsQueueRef.current.shift()!;
    setHighlightPara(item.paraIdx);
    setTtsState("loading");

     try {
       const blob = await apiTTSChunkWithCharacter(
         item.text,
         language,
         item.character,
         item.voiceType
       );
      const url = URL.createObjectURL(blob);
      const audio = audioRef.current!;
      audio.src = url;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        playQueueItem();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        playQueueItem();
      };

      setTtsState("playing");
      await audio.play();
    } catch (err: any) {
      setError(`TTS: ${err.message}`);
      playQueueItem();
    }
  }, [language, stopSpeaking]);

  const handleReadFromParagraph = useCallback(
    (paraIdx: number) => {
      if (ttsState === "playing" || ttsState === "loading") {
        stopSpeaking();
        return;
      }

      if (ttsState === "paused" && audioRef.current) {
        // Resume
        audioRef.current.play();
        setTtsState("playing");
        return;
      }

      const paras = visibleParagraphs.slice(paraIdx).filter((p) => p.text.length > 0);
      if (paras.length === 0) return;

      ttsActiveRef.current = true;
       ttsQueueRef.current = paras.map((p, i) => ({
         text: p.text,
         paraIdx: paraIdx + i,
         character: p.character || undefined,
         voiceType: voiceType,
       }));

      playQueueItem();
    },
    [ttsState, stopSpeaking, visibleParagraphs, playQueueItem]
  );

  const handlePlayPause = () => {
    if (ttsState === "playing") {
      // Pause
      audioRef.current?.pause();
      setTtsState("paused");
      return;
    }
    if (ttsState === "paused" && audioRef.current) {
      // Resume
      audioRef.current.play();
      setTtsState("playing");
      return;
    }
    handleReadFromParagraph(0);
  };

  const handleVoiceTypeChange = (newVoice: typeof voiceType) => {
    setVoiceType(newVoice);
    apiSetVoicePreference(newVoice, language).catch(() => {});
  };

  const isSpeaking = ttsState === "playing" || ttsState === "loading" || ttsState === "paused";

  /* ── toggle theme ── */

  const toggleTheme = (t: string) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    setTheme(t);
  };

  /* ── loading / error states ─────────────────────────────────────── */

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
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid var(--border)",
              borderTopColor: "var(--accent)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Загрузка книги...
        </div>
      </div>
    );
  }

  if (error && !book) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-primary)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--error)", marginBottom: 16 }}>{error}</p>
          <button
            onClick={() => router.push("/")}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg-tertiary)",
              color: "var(--accent)",
              cursor: "pointer",
            }}
          >
            На главную
          </button>
        </div>
      </div>
    );
  }

  /* ── main render ────────────────────────────────────────────────── */

  const iconBtnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    color: "var(--text-secondary)",
    padding: "5px 9px",
    borderRadius: 6,
    transition: "background 0.15s",
  };

  const activeIconStyle: React.CSSProperties = {
    ...iconBtnStyle,
    color: "var(--accent)",
    background: "var(--accent-light)",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--bg-primary)",
      }}
    >
      {/* ── header ── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          height: 52,
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.push("/")}
            style={{ ...iconBtnStyle, fontSize: 14 }}
          >
            ← Назад
          </button>
          <div style={{ width: 1, height: 24, background: "var(--border)" }} />
          <h1
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-primary)",
              fontFamily: "Georgia, serif",
              maxWidth: 300,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {book?.title}
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* TTS play/stop */}
          <button
            onClick={handlePlayPause}
            style={{
              ...iconBtnStyle,
              color: ttsState === "playing" ? "var(--error)" : ttsState === "loading" ? "var(--text-muted)" : "var(--accent)",
              fontSize: 14,
            }}
            title={
              ttsState === "loading"
                ? "Загрузка..."
                : ttsState === "playing"
                ? "Пауза"
                : ttsState === "paused"
                ? "Продолжить"
                : "Читать вслух"
            }
          >
            {ttsState === "loading" ? "⏳" : ttsState === "playing" ? "⏸" : "▶"}
          </button>

          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />

          {/* View mode buttons */}
          <button
            style={viewMode === "continuous" ? activeIconStyle : iconBtnStyle}
            onClick={() => { stopSpeaking(); setViewMode("continuous"); }}
            title="Непрерывно"
          >
            📜
          </button>
          <button
            style={viewMode === "chapter" ? activeIconStyle : iconBtnStyle}
            onClick={() => { stopSpeaking(); setViewMode("chapter"); setCurrentPage(0); }}
            title="По главам"
          >
            📖
          </button>
          <button
            style={viewMode === "pages" ? activeIconStyle : iconBtnStyle}
            onClick={() => { stopSpeaking(); setViewMode("pages"); setCurrentPage(0); }}
            title="По страницам"
          >
            📄
          </button>

          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />

          {/* Voice type quick buttons */}
          {VOICE_TYPES.map((vt) => (
            <button
              key={vt.id}
              style={voiceType === vt.id ? activeIconStyle : iconBtnStyle}
              onClick={() => handleVoiceTypeChange(vt.id as typeof voiceType)}
              title={vt.label}
            >
              {vt.id === "default" ? "🔊" : vt.id === "male" ? "🧑" : vt.id === "female" ? "👩" : "🎵"}
            </button>
          ))}

          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />

          {/* TOC toggle */}
          <button
            style={leftOpen ? activeIconStyle : iconBtnStyle}
            onClick={() => { setLeftOpen(!leftOpen); if (rightOpen) setRightOpen(false); }}
            title="Оглавление"
          >
            ☰
          </button>

          {/* Settings toggle */}
          <button
            style={rightOpen ? activeIconStyle : iconBtnStyle}
            onClick={() => { setRightOpen(!rightOpen); if (leftOpen) setLeftOpen(false); }}
            title="Настройки"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* ── body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── left: TOC ── */}
        <aside
          style={{
            width: leftOpen ? 260 : 0,
            overflow: "hidden",
            transition: "width 0.2s",
            background: "var(--sidebar-bg)",
            borderRight: leftOpen ? "1px solid var(--border)" : "none",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ width: 260, display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
              <h2
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontFamily: "Georgia, serif",
                }}
              >
                Оглавление ({chapters.length})
              </h2>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
              {tocItems.map((item) => {
                const isActive =
                  viewMode === "chapter"
                    ? currentChapter === item.index
                    : viewMode === "pages"
                    ? visibleParagraphs[0]?.chapterId === item.id
                    : false;
                return (
                  <button
                    key={item.id}
                    onClick={() => goToChapter(item.index)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 16px",
                      border: "none",
                      borderLeft: isActive
                        ? "3px solid var(--accent)"
                        : "3px solid transparent",
                      background: isActive ? "var(--accent-light)" : "transparent",
                      color: isActive ? "var(--accent)" : "var(--text-primary)",
                      fontSize: 13,
                      fontFamily: "Georgia, serif",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = "var(--bg-tertiary)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {item.title}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ── center: content ── */}
        <main
          ref={contentRef}
          style={{ flex: 1, overflowY: "auto", background: "var(--reader-bg)" }}
        >
          <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 28px 80px" }}>
            {/* error banner */}
            {error && (
              <div
                style={{
                  background: "var(--accent-light)",
                  border: "1px solid var(--error)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 20,
                  color: "var(--error)",
                  fontSize: 14,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                {error}
                <button
                  onClick={() => setError("")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--error)",
                    cursor: "pointer",
                    fontSize: 18,
                  }}
                >
                  ×
                </button>
              </div>
            )}

            {/* book header for continuous mode */}
            {viewMode === "continuous" && (
              <div
                style={{
                  textAlign: "center",
                  marginBottom: 40,
                  paddingBottom: 32,
                  borderBottom: "2px solid var(--border)",
                }}
              >
                <h1
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    fontFamily: "Georgia, serif",
                    marginBottom: 8,
                  }}
                >
                  {structured?.title || book?.title}
                </h1>
                {structured?.author && structured.author !== "Unknown" && (
                  <p style={{ color: "var(--text-secondary)", fontSize: 15, fontFamily: "Georgia, serif" }}>
                    {structured.author}
                  </p>
                )}
              </div>
            )}

            {/* chapter title for non-continuous modes */}
            {viewMode !== "continuous" && currentChapterTitle && (
              <div
                style={{
                  marginBottom: 28,
                  paddingBottom: 16,
                  borderBottom: "2px solid var(--border)",
                }}
              >
                <h2
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    fontFamily: "Georgia, serif",
                    lineHeight: 1.3,
                  }}
                >
                  {currentChapterTitle}
                </h2>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 6,
                    fontFamily: "Georgia, serif",
                  }}
                >
                  {viewMode === "chapter"
                    ? `Глава ${currentChapter + 1} из ${chapters.length}`
                    : `Страница ${currentPage + 1} из ${totalPages}`}
                </div>
              </div>
            )}

            {/* paragraphs */}
            {visibleParagraphs.length === 0 ? (
              <p
                style={{
                  color: "var(--text-muted)",
                  textAlign: "center",
                  padding: "60px 0",
                  fontFamily: "Georgia, serif",
                }}
              >
                Нет содержимого
              </p>
            ) : (
              visibleParagraphs.map((para, idx) => (
                <div key={para.id} style={{ position: "relative", marginBottom: 4 }}>
                  {/* chapter divider in continuous mode */}
                  {viewMode === "continuous" &&
                    idx > 0 &&
                    para.chapterId !== visibleParagraphs[idx - 1]?.chapterId && (
                      <div
                        style={{
                          textAlign: "center",
                          margin: "28px 0 20px",
                          color: "var(--text-muted)",
                          fontSize: 13,
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                        <span style={{ fontWeight: 600, fontFamily: "Georgia, serif" }}>
                          {para.chapterTitle}
                        </span>
                        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                      </div>
                    )}

                  <p
                    onClick={() => {
                      if (ttsState === "playing" || ttsState === "loading") { stopSpeaking(); return; }
                      handleReadFromParagraph(idx);
                    }}
                    title="Нажмите чтобы начать чтение отсюда"
                    style={{
                      fontFamily: "Georgia, serif",
                      fontSize: 17,
                      lineHeight: 1.85,
                      color: para.color || "var(--text-primary)",
                      fontWeight: para.bold ? 700 : 400,
                      fontStyle: para.italic ? "italic" : "normal",
                      textIndent: (para.bold || para.character) ? 0 : "1.5em",
                      margin: "0 0 0.6em",
                      padding: "8px 12px",
                      borderRadius: 6,
                      background: highlightPara === idx ? "rgba(59,130,246,0.15)" : "transparent",
                      borderLeft: highlightPara === idx ? "3px solid rgba(59,130,246,0.6)" : "3px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {showCharacterLabels && para.character && (
                      <span style={{ fontWeight: 600, color: "var(--accent)", fontSize: "0.85em", marginRight: 6 }}>
                        [{para.character}]
                      </span>
                    )}
                    {para.text}
                  </p>
                </div>
              ))
            )}

            {/* navigation */}
            {viewMode !== "continuous" && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 40,
                  paddingTop: 20,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <button
                  onClick={goPrev}
                  disabled={!canGoPrev}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: canGoPrev ? "var(--bg-secondary)" : "var(--bg-tertiary)",
                    color: canGoPrev ? "var(--text-primary)" : "var(--text-muted)",
                    fontSize: 14,
                    fontFamily: "Georgia, serif",
                    cursor: canGoPrev ? "pointer" : "default",
                    opacity: canGoPrev ? 1 : 0.5,
                  }}
                >
                  ← Назад
                </button>

                <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "Georgia, serif" }}>
                  {viewMode === "chapter"
                    ? `${currentChapter + 1} / ${chapters.length}`
                    : `${currentPage + 1} / ${totalPages}`}
                </span>

                <button
                  onClick={goNext}
                  disabled={!canGoNext}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: canGoNext ? "var(--bg-secondary)" : "var(--bg-tertiary)",
                    color: canGoNext ? "var(--text-primary)" : "var(--text-muted)",
                    fontSize: 14,
                    fontFamily: "Georgia, serif",
                    cursor: canGoNext ? "pointer" : "default",
                    opacity: canGoNext ? 1 : 0.5,
                  }}
                >
                  Далее →
                </button>
              </div>
            )}
          </div>
        </main>

        {/* ── right: settings ── */}
        <aside
          style={{
            width: rightOpen ? 240 : 0,
            overflow: "hidden",
            transition: "width 0.2s",
            background: "var(--sidebar-bg)",
            borderLeft: rightOpen ? "1px solid var(--border)" : "none",
            flexShrink: 0,
          }}
        >
          <div style={{ width: 240, padding: 16 }}>
            <h2
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 16,
                fontFamily: "Georgia, serif",
              }}
            >
              Настройки
            </h2>

            {/* theme */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                }}
              >
                Тема
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["light", "dark"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => toggleTheme(m)}
                    style={{
                      flex: 1,
                      padding: "7px 0",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: theme === m ? "var(--accent)" : "var(--bg-secondary)",
                      color: theme === m ? "#fff" : "var(--text-primary)",
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: "Georgia, serif",
                    }}
                  >
                    {m === "light" ? "☀ Светлая" : "🌙 Тёмная"}
                  </button>
                ))}
              </div>
            </div>

            {/* view mode */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                }}
              >
                Режим чтения
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {(
                  [
                    ["continuous", "📜 Сплошной текст"],
                    ["chapter", "📖 По главам"],
                    ["pages", "📄 По страницам"],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => {
                      stopSpeaking();
                      setViewMode(m);
                      setCurrentPage(0);
                    }}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: viewMode === m ? "var(--accent)" : "var(--bg-secondary)",
                      color: viewMode === m ? "#fff" : "var(--text-primary)",
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "Georgia, serif",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* page size */}
            {viewMode === "pages" && (
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    marginBottom: 6,
                  }}
                >
                  Абзацев на странице
                </label>
                <div style={{ display: "flex", gap: 4 }}>
                  {[5, 10, 20, 50].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setPageSize(s);
                        setCurrentPage(0);
                      }}
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: pageSize === s ? "var(--accent)" : "var(--bg-secondary)",
                        color: pageSize === s ? "#fff" : "var(--text-primary)",
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "Georgia, serif",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* voice language */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                }}
              >
                Язык
              </label>
              <select
                value={language}
                onChange={(e) => {
                  const lang = e.target.value;
                  setLanguage(lang);
                  apiSetVoicePreference(voiceType, lang).catch(() => {});
                }}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  fontFamily: "Georgia, serif",
                  cursor: "pointer",
                }}
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            {/* voice type */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                }}
              >
                Диктор
              </label>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {(["default", "male", "female", "soft"] as const).map((vt) => (
                  <button
                    key={vt}
                    onClick={() => handleVoiceTypeChange(vt)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: voiceType === vt ? "var(--accent)" : "var(--bg-secondary)",
                      color: voiceType === vt ? "#fff" : "var(--text-primary)",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {vt === "default" ? "Обычный" : vt === "male" ? "Мужской" : vt === "female" ? "Женский" : "Мягкий"}
                  </button>
                ))}
              </div>
            </div>

            {/* character labels */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
                Персонажи
              </label>
              <button onClick={() => setShowCharacterLabels(!showCharacterLabels)} style={{
                width: "100%", padding: "7px 0", borderRadius: 8,
                border: "1px solid var(--border)",
                background: showCharacterLabels ? "var(--accent)" : "var(--bg-secondary)",
                color: showCharacterLabels ? "#fff" : "var(--text-primary)",
                fontSize: 12, cursor: "pointer",
              }}>
                {showCharacterLabels ? "Скрыть метки" : "Показать метки"}
              </button>
            </div>

            {/* TTS actions */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                }}
              >
                Озвучка
              </label>
              <button
                onClick={handlePlayPause}
                style={{
                  width: "100%",
                  padding: "9px 0",
                  borderRadius: 8,
                  border: "none",
                  background:
                    ttsState === "playing"
                      ? "var(--error)"
                      : ttsState === "loading"
                      ? "var(--bg-tertiary)"
                      : "var(--accent)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  marginBottom: 6,
                  fontFamily: "Georgia, serif",
                }}
              >
                {ttsState === "loading"
                  ? "⏳ Загрузка..."
                  : ttsState === "playing"
                  ? "⏸ Пауза"
                  : ttsState === "paused"
                  ? "▶ Продолжить"
                  : "▶ Слушать"}
              </button>
              <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
                Нажмите на абзац чтобы начать чтение с него. Нажмите повторно — чтение остановится.
              </p>
            </div>

            {/* book info */}
            {book && (
              <div
                style={{
                  background: "var(--bg-tertiary)",
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  fontFamily: "Georgia, serif",
                }}
              >
                <div>
                  <strong>{book.title}</strong>
                </div>
                <div>Формат: {book.filename.split('.').pop()?.toLowerCase() ? '.' + book.filename.split('.').pop()?.toLowerCase() : ''}</div>
                <div>Автор: {book.owner_username}</div>
                <div>Глав: {chapters.length}</div>
                <div>Абзацев: {visibleParagraphs.length}</div>
                <div>Доступ: {book.is_public ? "Публичная" : "Приватная"}</div>
              </div>
            )}
          </div>
        </aside>
      </div>
      <audio ref={audioRef} />
    </div>
  );
}
