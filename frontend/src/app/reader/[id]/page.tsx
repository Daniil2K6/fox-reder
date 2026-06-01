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
  apiGetMe,
} from "@/lib/api";

/* ── types ─────────────────────────────────────────────────────────── */

interface Book {
  id: number;
  title: string;
  filename: string;
  is_public: boolean;
  owner_username: string;
  has_structure: boolean;
  preferred_format?: string | null;
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
  image?: string;
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
  images?: Record<string, string>;
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
  /^(глава|chapter|часть|part|section|пролог|prologue|эпилог|epilogue|интерлюдия|interlude|книга|book|interlude|вступление|введение|introduction)\s*[.\d]*/i;

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
  const [currentChapter, setCurrentChapter] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const PARAGRAPHS_PER_PAGE = 15;

const navBtnStyle = (enabled: boolean) => ({
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: enabled ? "var(--bg-secondary)" : "var(--bg-tertiary)",
  color: enabled ? "var(--text-primary)" : "var(--text-muted)",
  fontSize: 14,
  fontFamily: "Georgia, serif",
  cursor: enabled ? "pointer" : "default",
  opacity: enabled ? 1 : 0.5,
});

/* ── TTS state ── */
    const [ttsState, setTtsState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
    const [language, setLanguage] = useState("ru");
    const [voiceType, setVoiceType] = useState<"default" | "male" | "female" | "soft" | "custom">("default");
    const [pitch, setPitch] = useState(0);
    const [rate, setRate] = useState(0);
    const [volume, setVolume] = useState(0);
    const [highlightPara, setHighlightPara] = useState(-1);
    const [showCharacterLabels, setShowCharacterLabels] = useState(false);
    const [showCharacterGender, setShowCharacterGender] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    type TtsQueueItem = { text: string; paraIdx: number; character?: string | { name?: string; }; voiceType: string; pitch: number; rate: number; volume: number };
    const ttsQueueRef = useRef<TtsQueueItem[]>([]);
    const ttsActiveRef = useRef(false);
    const playGenRef = useRef(0);

   const contentRef = useRef<HTMLDivElement>(null);
   const ttsAdvanceRef = useRef(false);

  /* ── derived ── */

  const chapters: Chapter[] = useMemo(() => {
    let chs: Chapter[];
    if (structured) chs = structured.chapters;
    else if (plainText) chs = detectChapters(plainText);
    else chs = [];
    if (chs.length === 0) {
      chs = [{ id: "ch-0", index: 0, title: "Обложка", paragraphs: [] }];
    }
    return chs;
  }, [structured, plainText]);

  const tocItems: TocItem[] = useMemo(() => {
    if (structured) return structured.toc;
    return chapters.map((ch) => ({ id: ch.id, title: ch.title, index: ch.index }));
  }, [structured, chapters]);

  const pages = useMemo(() => {
    const result: Array<{ chapterIdx: number; startPara: number; count: number }> = [];
    for (let ci = 0; ci < chapters.length; ci++) {
      const ch = chapters[ci];
      const totalParas = ch.paragraphs.length;
      for (let start = 0; start < totalParas; start += PARAGRAPHS_PER_PAGE) {
        result.push({ chapterIdx: ci, startPara: start, count: Math.min(PARAGRAPHS_PER_PAGE, totalParas - start) });
      }
    }
    return result;
  }, [chapters]);

  const totalPages = useMemo(() => pages.length, [pages]);

  const currentChapterForPage = useMemo(() => {
    if (viewMode !== "pages" || pages.length === 0) return 0;
    const idx = Math.min(currentPage, pages.length - 1);
    return pages[idx]?.chapterIdx ?? 0;
  }, [viewMode, pages, currentPage]);

  const visibleParagraphs = useMemo(() => {
    const chTitle = (ch: typeof chapters[0], ci: number) => ch.title || (ci === 0 ? "Обложка" : `Глава ${ci}`);
    if (viewMode === "continuous") {
      return chapters.flatMap((ch, ci) =>
        ch.paragraphs.map((p) => ({
          ...p,
          chapterTitle: chTitle(ch, ci),
          chapterId: ch.id,
        }))
      );
    }
    if (viewMode === "pages") {
      const page = pages[currentPage];
      if (!page) return [];
      const ch = chapters[page.chapterIdx];
      const slice = ch.paragraphs.slice(page.startPara, page.startPara + page.count);
      return slice.map(p => ({ ...p, chapterTitle: chTitle(ch, page.chapterIdx), chapterId: ch.id }));
    }
    const ch = chapters[currentChapter];
    if (!ch) return [];
    return ch.paragraphs.map((p) => ({
      ...p,
      chapterTitle: chTitle(ch, currentChapter),
      chapterId: ch.id,
    }));
  }, [viewMode, chapters, currentChapter, currentPage, pages]);

  const currentChapterTitle = useMemo(() => {
    if (viewMode === "continuous") return null;
    return chapters[currentChapter]?.title || (currentChapter === 0 ? "Обложка" : `Глава ${currentChapter}`);
  }, [viewMode, chapters, currentChapter]);

  const canGoPrev = viewMode === "chapter" && currentChapter > 0 ||
    viewMode === "pages" && currentPage > 0;
  const canGoNext = viewMode === "chapter" && currentChapter < chapters.length - 1 ||
    viewMode === "pages" && currentPage < totalPages - 1;
  const canGoPrevChapter = viewMode === "pages" && currentChapterForPage > 0;
  const canGoNextChapter = viewMode === "pages" && currentChapterForPage < chapters.length - 1;
  const canGoBeginning = viewMode === "pages" && currentPage > 0;
  const canGoEnd = viewMode === "pages" && currentPage < totalPages - 1;
  const isVbBook = structured?.format_version?.startsWith('vb') ?? false;

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
     apiGetMe().then((me: any) => {
       if (me.preferred_voice) {
         setVoiceType(me.preferred_voice as any);
       }
       if (me.preferred_language) {
         setLanguage(me.preferred_language);
       }
       if (me.voice_pitch !== undefined) {
         setPitch(me.voice_pitch);
       }
       if (me.voice_rate !== undefined) {
         setRate(me.voice_rate);
       }
       if (me.voice_volume !== undefined) {
         setVolume(me.voice_volume);
       }
     }).catch(() => {});
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

   /* ── TTS auto-advance in pages mode ── */
   useEffect(() => {
     if (!ttsAdvanceRef.current || viewMode !== "pages" || !ttsActiveRef.current) return;
     ttsAdvanceRef.current = false;

     const paras = visibleParagraphs.filter(p => p.text.length > 0);
     if (paras.length === 0) { stopSpeaking(); return; }

     playGenRef.current++;
      ttsActiveRef.current = true;
      const queue: typeof ttsQueueRef.current = [];
      let lastChId: string | undefined;
      for (let i = 0; i < paras.length; i++) {
        const p = paras[i];
        if (lastChId !== undefined && lastChId !== p.chapterId) {
          queue.push({ text: `— ${p.chapterTitle} —`, paraIdx: i, character: undefined, voiceType, pitch, rate, volume });
        }
        lastChId = p.chapterId;
        queue.push({ text: p.text, paraIdx: i, character: p.character || undefined, voiceType, pitch, rate, volume });
      }
      ttsQueueRef.current = queue;
      setHighlightPara(-1);
      setTtsState("idle");
      playQueueItem();
    }, [currentPage, currentChapter, totalPages]);

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
    stopSpeaking();
    if (viewMode === "pages") {
      const targetChIdx = chapters.findIndex(ch => ch.index === idx);
      if (targetChIdx >= 0) {
        const firstPage = pages.findIndex(p => p.chapterIdx === targetChIdx);
        if (firstPage >= 0) setCurrentPage(firstPage);
      }
      return;
    }
    const chIdx = chapters.findIndex(ch => ch.index === idx);
    const targetIdx = chIdx >= 0 ? chIdx : idx;
    setCurrentChapter(targetIdx);
    setCurrentPage(0);
    setTimeout(() => {
      if (viewMode === "continuous") {
        const ch = chapters[targetIdx];
        if (ch && ch.paragraphs.length > 0) {
          const el = document.getElementById(ch.paragraphs[0].id);
          if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
        }
      }
      contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  };

  const goNext = () => {
    stopSpeaking();
    if (viewMode === "chapter" && currentChapter < chapters.length - 1) {
      goToChapter(currentChapter + 1);
    }
    if (viewMode === "pages" && currentPage < totalPages - 1) {
      setCurrentPage(p => p + 1);
      contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  const goPrev = () => {
    stopSpeaking();
    if (viewMode === "chapter" && currentChapter > 0) {
      goToChapter(currentChapter - 1);
    }
    if (viewMode === "pages" && currentPage > 0) {
      setCurrentPage(p => p - 1);
      contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  const goPrevChapter = () => {
    if (!canGoPrevChapter) return;
    stopSpeaking();
    const firstPage = pages.findIndex(p => p.chapterIdx === currentChapterForPage - 1);
    if (firstPage >= 0) setCurrentPage(firstPage);
  };

  const goNextChapter = () => {
    if (!canGoNextChapter) return;
    stopSpeaking();
    const firstPage = pages.findIndex(p => p.chapterIdx === currentChapterForPage + 1);
    if (firstPage >= 0) setCurrentPage(firstPage);
  };

  const goBeginning = () => { stopSpeaking(); setCurrentPage(0); };

  const goEnd = () => { stopSpeaking(); setCurrentPage(totalPages - 1); };

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
    const gen = playGenRef.current;
    if (!ttsActiveRef.current || ttsQueueRef.current.length === 0) {
      // ══ pages auto-advance ══
      if (viewMode === "pages" && ttsActiveRef.current) {
        if (currentPage < totalPages - 1) {
          ttsAdvanceRef.current = true;
          setCurrentPage(p => p + 1);
          return;
        }
        stopSpeaking();
        return;
      }
      stopSpeaking();
      return;
    }

    const item = ttsQueueRef.current.shift()!;
    if (gen !== playGenRef.current) return;
    setHighlightPara(item.paraIdx);
    setTtsState("loading");

try {
        const charName = typeof item.character === 'string' ? item.character : (item.character as any)?.name || undefined;
        const charGender = typeof item.character === 'object' ? (item.character as any)?.gender || undefined : undefined;
        const blob = await apiTTSChunkWithCharacter(
          item.text,
          language,
          charName,
          charGender,
          item.voiceType,
          item.pitch,
          item.rate,
          item.volume
        );
      if (gen !== playGenRef.current) return;
      const url = URL.createObjectURL(blob);
      const audio = audioRef.current!;
      audio.src = url;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (gen !== playGenRef.current) return;
        playQueueItem();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (gen !== playGenRef.current) return;
        playQueueItem();
      };

      setTtsState("playing");
      await audio.play();
    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'NotAllowedError') {
        playQueueItem();
        return;
      }
      console.error("TTS error:", err);
      setError(`TTS: ${err.message || err}`);
      stopSpeaking();
    }
  }, [language, stopSpeaking, viewMode, currentPage, currentChapter, totalPages, chapters.length]);

  const handleReadFromParagraph = useCallback(
    (paraIdx: number) => {
      if (ttsState === "playing" || ttsState === "loading") {
        stopSpeaking();
      } else if (ttsState === "paused" && audioRef.current) {
        audioRef.current.play();
        setTtsState("playing");
        return;
      }

const paras = visibleParagraphs.slice(paraIdx).filter((p) => p.text.length > 0);
       if (paras.length === 0) return;

        playGenRef.current++;
        ttsActiveRef.current = true;
        const queue: typeof ttsQueueRef.current = [];
        let lastChId: string | undefined;
        for (let i = 0; i < paras.length; i++) {
          const p = paras[i];
          if (lastChId !== undefined && lastChId !== p.chapterId) {
            queue.push({
              text: `— ${p.chapterTitle} —`, paraIdx: paraIdx + i,
              character: undefined, voiceType, pitch, rate, volume,
            });
          }
          lastChId = p.chapterId;
          queue.push({
            text: p.text, paraIdx: paraIdx + i,
            character: p.character || undefined, voiceType, pitch, rate, volume,
          });
        }
       ttsQueueRef.current = queue;

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

  const handleVoiceTypeChange = async (newVoice: typeof voiceType, newPitch?: number, newRate?: number, newVolume?: number) => {
    setVoiceType(newVoice);
    if (newPitch !== undefined) setPitch(newPitch);
    if (newRate !== undefined) setRate(newRate);
    if (newVolume !== undefined) setVolume(newVolume);
    await apiSetVoicePreference(newVoice, language, newPitch ?? pitch, newRate ?? rate, newVolume ?? volume).catch(() => {});
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
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {book?.title}
            {book?.preferred_format && (
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--accent-light)", color: "var(--accent)", fontWeight: 600, fontFamily: "sans-serif" }}>
                {book.preferred_format.toUpperCase()}
              </span>
            )}
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
            onClick={() => { stopSpeaking(); setViewMode("chapter"); }}
            title="По главам"
          >
            📖
          </button>
          <button
            style={viewMode === "pages" ? activeIconStyle : iconBtnStyle}
            onClick={() => { stopSpeaking(); setViewMode("pages"); }}
            title="По страницам"
          >
            📄
          </button>

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
                const isActive = viewMode !== "continuous" && currentChapter === chapters.findIndex(ch => ch.index === item.index);
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
            {viewMode === "pages" ? (
              <div style={{ marginBottom: 28, paddingBottom: 16, borderBottom: "2px solid var(--border)" }}>
                <h2 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", fontFamily: "Georgia, serif", lineHeight: 1.3, textAlign: "center" }}>
                  {structured?.title || book?.title}
                </h2>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, fontFamily: "Georgia, serif", textAlign: "center" }}>
                  Страница {currentPage + 1} из {totalPages}
                </div>
              </div>
            ) : viewMode !== "continuous" && (currentChapterTitle || currentChapter === 0) ? (
              <div style={{ marginBottom: 28, paddingBottom: 16, borderBottom: "2px solid var(--border)" }}>
                <h2 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", fontFamily: "Georgia, serif", lineHeight: 1.3, textAlign: "center" }}>
                  {currentChapterTitle || structured?.title || book?.title}
                </h2>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, fontFamily: "Georgia, serif" }}>
                  {`Глава ${currentChapter + 1} из ${chapters.length}`}
                </div>
                {currentChapter === 0 && structured?.author && structured.author !== "Unknown" && (
                  <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 13, fontFamily: "Georgia, serif", marginTop: 8 }}>
                    {structured.author}
                  </p>
                )}
              </div>
            ) : null}

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
                    (idx === 0 || para.chapterId !== visibleParagraphs[idx - 1]?.chapterId) && (
                      <div
                        style={{
                          textAlign: "center",
                          margin: "32px 0 24px",
                          color: "var(--text-primary)",
                          fontSize: 18,
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                        }}
                      >
                        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                        <span style={{ fontWeight: 700, fontFamily: "Georgia, serif", fontSize: 20 }}>
                          {para.chapterTitle}
                        </span>
                        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                      {isSpeaking && highlightPara === idx && (
                       <>
                         <button
                           onClick={(e) => { e.stopPropagation(); handleReadFromParagraph(Math.max(0, idx - 1)); }}
                           title="Предыдущий абзац"
                           style={{
                             background: "var(--bg-tertiary)", border: "1px solid var(--border)",
                             cursor: "pointer", fontSize: 11, padding: "2px 6px", borderRadius: 4,
                             color: "var(--text-secondary)", flexShrink: 0, marginTop: 8,
                           }}
                         >◀</button>
                         <button
                           onClick={(e) => { e.stopPropagation(); handleReadFromParagraph(idx + 1); }}
                           title="Следующий абзац"
                           style={{
                             background: "var(--bg-tertiary)", border: "1px solid var(--border)",
                             cursor: "pointer", fontSize: 11, padding: "2px 6px", borderRadius: 4,
                             color: "var(--text-secondary)", flexShrink: 0, marginTop: 8,
                           }}
                         >▶</button>
                       </>
                     )}
                     <div
                       id={para.id}
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
                         flex: 1,
                       }}
                     >
                         {showCharacterLabels && para.character && (
                           <span style={{
                             fontWeight: 600,
                             color: (typeof para.character === 'object' && (para.character as any).name === 'действие')
                               ? 'var(--text-muted)' : '#f59e0b',
                             fontSize: "0.85em", marginRight: 6,
                           }}>
                             [{typeof para.character === 'string' ? para.character : (para.character as any).name}
                             {showCharacterGender && typeof para.character === 'object' && (para.character as any).gender && (
                               <> {(para.character as any).gender === 'female' ? 'Ж' : 'М'}</>
                             )}]
                           </span>
                         )}
                       {/* Embedded image in paragraph */}
                       {(para as any).image && (
                         <img
                           src={`/api/books/${bookId}/image/${(para as any).image}`}
                           alt=""
                           style={{
                             maxWidth: "100%",
                             height: "auto",
                             display: "block",
                             margin: "8px 0",
                             borderRadius: 8,
                           }}
                         />
                       )}
                       {para.text}
                      </div>
                    </div>
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
                {viewMode === "pages" ? (
                  <>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={goBeginning} disabled={!canGoBeginning} style={navBtnStyle(canGoBeginning)}>⏮</button>
                      <button onClick={goPrevChapter} disabled={!canGoPrevChapter} style={navBtnStyle(canGoPrevChapter)}>⏪</button>
                      <button onClick={goPrev} disabled={!canGoPrev} style={navBtnStyle(canGoPrev)}>◀</button>
                    </div>
                    <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "Georgia, serif" }}>
                      {currentPage + 1} / {totalPages}
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={goNext} disabled={!canGoNext} style={navBtnStyle(canGoNext)}>▶</button>
                      <button onClick={goNextChapter} disabled={!canGoNextChapter} style={navBtnStyle(canGoNextChapter)}>⏩</button>
                      <button onClick={goEnd} disabled={!canGoEnd} style={navBtnStyle(canGoEnd)}>⏭</button>
                    </div>
                  </>
                ) : (
                  <>
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
                      {currentChapter + 1} / {chapters.length}
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
                  </>
                )}
              </div>
            )}
          </div>
        </main>

        {/* ── right: settings ── */}
         <aside
           style={{
             width: rightOpen ? 240 : 0,
             overflow: rightOpen ? "hidden auto" : "hidden",
             transition: "width 0.2s",
             background: "var(--sidebar-bg)",
             borderLeft: rightOpen ? "1px solid var(--border)" : "none",
             flexShrink: 0,
           }}
         >
           <div style={{ width: 240, padding: "16px 16px 32px" }}>
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
                  apiSetVoicePreference(voiceType, lang, pitch, rate, volume).catch(() => {});
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
                Тон голоса
              </label>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {([
                  { id: "default", label: "Обычный", pitch: 0, rate: 0, volume: 0 },
                  { id: "male", label: "Мужской", pitch: -2, rate: 0, volume: 0 },
                  { id: "female", label: "Женский", pitch: 2, rate: 0, volume: 0 },
                  { id: "soft", label: "Мягкий", pitch: 0, rate: -1, volume: 1 },
                ] as const).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleVoiceTypeChange(v.id as any, v.pitch, v.rate, v.volume)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: voiceType === v.id ? "var(--accent)" : "var(--bg-secondary)",
                      color: voiceType === v.id ? "#fff" : "var(--text-primary)",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* pitch slider */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                Тон: {pitch > 0 ? "+" : ""}{pitch}
              </label>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.5"
                value={pitch}
                onChange={(e) => { setPitch(parseFloat(e.target.value)); setVoiceType("custom" as any); }}
                style={{ width: "100%", cursor: "pointer" }}
              />
            </div>

            {/* rate slider */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                Скорость: {rate > 0 ? "+" : ""}{rate}
              </label>
              <input
                type="range"
                min="-3"
                max="3"
                step="0.5"
                value={rate}
                onChange={(e) => { setRate(parseFloat(e.target.value)); setVoiceType("custom" as any); }}
                style={{ width: "100%", cursor: "pointer" }}
              />
            </div>

            {/* volume slider */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                Громкость: {volume > 0 ? "+" : ""}{volume}
              </label>
              <input
                type="range"
                min="-3"
                max="3"
                step="0.5"
                value={volume}
                onChange={(e) => { setVolume(parseFloat(e.target.value)); setVoiceType("custom" as any); }}
                style={{ width: "100%", cursor: "pointer" }}
              />
            </div>

            {/* save button */}
            <button
              onClick={async () => {
                try {
                  await apiSetVoicePreference(voiceType, language, pitch, rate, volume);
                  alert("Настройки сохранены!");
                } catch (err: any) {
                  alert(err.message);
                }
              }}
              style={{
                width: "100%",
                padding: "8px 0",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                marginBottom: 20,
              }}
            >
              Сохранить настройки
            </button>

            {/* character labels */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
                Метки для формата (VB)
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
              <button onClick={() => setShowCharacterGender(!showCharacterGender)} style={{
                width: "100%", padding: "7px 0", borderRadius: 8, marginTop: 6,
                border: "1px solid var(--border)",
                background: showCharacterGender ? "var(--accent)" : "var(--bg-secondary)",
                color: showCharacterGender ? "#fff" : "var(--text-primary)",
                fontSize: 12, cursor: "pointer",
              }}>
                {showCharacterGender ? "Скрыть пол" : "Пол (М/Ж)"}
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
