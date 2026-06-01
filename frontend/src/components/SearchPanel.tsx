import { useState, useEffect, useRef } from "react";

const SORT_OPTIONS = [
  { value: "relevance", label: "По релевантности" },
  { value: "created_at", label: "По дате" },
  { value: "likes", label: "По популярности" },
  { value: "views", label: "По просмотрам" },
];

export interface SearchState {
  search: string;
  matchMode: "strict" | "soft";
  searchFields: "title" | "description" | "all";
  sortBy: string;
  whitelist: string[];
  blacklist: string[];
}

interface SearchPanelProps {
  state: SearchState;
  activeTab: "all" | "books" | "series" | "authors";
  onSearch: (state: SearchState) => void;
}

export function SearchPanel({ state, activeTab, onSearch }: SearchPanelProps) {
  const [localSearch, setLocalSearch] = useState(state.search);
  const [matchMode, setMatchMode] = useState(state.matchMode);
  const [searchFields, setSearchFields] = useState(state.searchFields);
  const [sortBy, setSortBy] = useState(state.sortBy);
  const [whitelist, setWhitelist] = useState(state.whitelist);
  const [blacklist, setBlacklist] = useState(state.blacklist);
  const [showFilters, setShowFilters] = useState(false);
  const [showGenrePicker, setShowGenrePicker] = useState<"whitelist" | "blacklist" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showGenreFilters = activeTab === "all" || activeTab === "books";
  const showSortOptions = activeTab === "all" || activeTab === "books";

  const handleSearch = () => {
    onSearch({
      search: localSearch,
      matchMode,
      searchFields,
      sortBy,
      whitelist: showGenreFilters ? whitelist : [],
      blacklist: showGenreFilters ? blacklist : [],
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const hasActiveFilters =
    (showGenreFilters && (whitelist.length > 0 || blacklist.length > 0)) ||
    matchMode === "strict" ||
    searchFields !== "all" ||
    sortBy !== "relevance";

  const hasChips = showGenreFilters && (whitelist.length > 0 || blacklist.length > 0);

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Search input */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-secondary)",
          }}
        >
          <span style={{ fontSize: 16, color: "var(--text-muted)", flexShrink: 0 }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeTab === "authors" ? "Поиск по авторам..."
              : activeTab === "series" ? "Поиск по сериям..."
              : "Поиск по книгам..."
            }
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 14,
              color: "var(--text-primary)",
              minWidth: 0,
            }}
          />
          {localSearch && (
            <button
              onClick={() => { setLocalSearch(""); inputRef.current?.focus(); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text-muted)", padding: "0 2px", lineHeight: 1 }}
            >
              ✕
            </button>
          )}
        </div>

        {showSortOptions && (
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              fontSize: 13,
              cursor: "pointer",
              outline: "none",
              minWidth: 140,
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}

        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid",
            borderColor: hasActiveFilters ? "var(--accent)" : "var(--border)",
            background: hasActiveFilters ? "var(--accent-light)" : "var(--bg-secondary)",
            color: hasActiveFilters ? "var(--accent)" : "var(--text-secondary)",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          Фильтры{hasActiveFilters ? " ●" : ""}
        </button>

        <button
          onClick={handleSearch}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Найти
        </button>
      </div>

      {/* Active chips — genres */}
      {hasChips && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {showGenreFilters && whitelist.map((g) => (
            <span key={`gw-${g}`} style={chipStyle("success")}>
              🎭 {g}
              <button onClick={() => setWhitelist(whitelist.filter((x) => x !== g))} style={removeBtnStyle}>✕</button>
            </span>
          ))}
          {showGenreFilters && blacklist.map((g) => (
            <span key={`gb-${g}`} style={chipStyle("error")}>
              🎭 {g}
              <button onClick={() => setBlacklist(blacklist.filter((x) => x !== g))} style={removeBtnStyle}>✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Expanded filters panel */}
      {showFilters && (
        <div style={{ marginTop: 10, padding: 14, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>

          {/* Match mode — only for books tabs */}
          {(activeTab === "all" || activeTab === "books") && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Режим поиска</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {(["soft", "strict"] as const).map((mode) => (
                  <button key={mode} onClick={() => setMatchMode(mode)} style={toggleBtnStyle(matchMode === mode)}>
                    {mode === "soft" ? "Мягкий" : "Строгий"}
                  </button>
                ))}
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>
                  {matchMode === "soft" ? "Нечёткий поиск с транслитерацией" : "Только точные совпадения"}
                </span>
              </div>
            </div>
          )}

          {/* Search fields — only for books tabs */}
          {(activeTab === "all" || activeTab === "books") && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Где искать</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {([
                  { value: "all", label: "Везде" },
                  { value: "title", label: "Название" },
                  { value: "description", label: "Описание" },
                ] as const).map((opt) => (
                  <button key={opt.value} onClick={() => setSearchFields(opt.value)} style={toggleBtnStyle(searchFields === opt.value)}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Genre filters — only for books tabs */}
          {showGenreFilters && (
            <div>
              <label style={labelStyle}>Жанровые фильтры</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowGenrePicker("whitelist")} style={dashedBtnStyle(!!whitelist.length, "success")}>
                  + Добавить жанр{whitelist.length ? ` (${whitelist.length})` : ""}
                </button>
                <button onClick={() => setShowGenrePicker("blacklist")} style={dashedBtnStyle(!!blacklist.length, "error")}>
                  + Исключить жанр{blacklist.length ? ` (${blacklist.length})` : ""}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showGenrePicker && (
        <GenrePickerModal
          type={showGenrePicker}
          selected={showGenrePicker === "whitelist" ? whitelist : blacklist}
          onSelect={(genre) => {
            if (showGenrePicker === "whitelist" && !whitelist.includes(genre)) setWhitelist([...whitelist, genre]);
            else if (showGenrePicker === "blacklist" && !blacklist.includes(genre)) setBlacklist([...blacklist, genre]);
          }}
          onRemove={(genre) => {
            if (showGenrePicker === "whitelist") setWhitelist(whitelist.filter((g) => g !== genre));
            else setBlacklist(blacklist.filter((g) => g !== genre));
          }}
          onClose={() => setShowGenrePicker(null)}
        />
      )}
    </div>
  );
}

/* ---- Shared styles ---- */

const chipStyle = (variant: "success" | "error"): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "4px 8px", borderRadius: 12,
  background: variant === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
  color: variant === "success" ? "var(--success)" : "var(--error)",
  fontSize: 12, fontWeight: 500,
});

const removeBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "inherit", padding: 0, lineHeight: 1,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6, display: "block",
};

const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 14px", borderRadius: 8,
  border: "1px solid", borderColor: active ? "var(--accent)" : "var(--border)",
  background: active ? "var(--accent)" : "transparent",
  color: active ? "#fff" : "var(--text-secondary)",
  fontSize: 12, fontWeight: 500, cursor: "pointer",
});

const dashedBtnStyle = (hasItems: boolean, variant: "success" | "error"): React.CSSProperties => ({
  padding: "6px 14px", borderRadius: 8, border: "1px dashed",
  borderColor: hasItems ? (variant === "success" ? "var(--success)" : "var(--error)") : "var(--border)",
  background: hasItems ? (variant === "success" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)") : "transparent",
  color: hasItems ? (variant === "success" ? "var(--success)" : "var(--error)") : "var(--text-secondary)",
  fontSize: 12, cursor: "pointer",
});

/* ---- Genre Picker Modal ---- */

const GENRES = [
  "Автобиография","Авторская проза","Ангелы","Боевая фантастика","Боевик","Вампиры","Вестерн",
  "Военная проза","Волшебство","Детектив","Детская литература","Драма","Историческая проза",
  "Исторический роман","Киберпанк","Классика","Космическая опера","Космическая фантастика",
  "Криминальный триллер","Любовный роман","Мистика","Научная фантастика","Приключения",
  "Психологический триллер","Роман","Сказка","Тёмное фэнтези","Триллер","Ужасы","Фантастика",
  "Фэнтези","Юмористическая проза",
  "Adult","Adventure","Alternate History","Anime","Anthology","Apocalypse","Arts","BDSM",
  "Biography","Business","Cartoon","Chick Lit","Children","Comedy","Comic","Coming of Age",
  "Cultivation","Dark Fantasy","Detective","Dystopia","Eastern","Economics","Epic","Fan Fiction",
  "Fantasy","Folklore","Gender Bender","Gothic","Harem","Historical","Horror","Isekai","Jutsu",
  "LitRPG","Magical Realism","Martial Arts","Mecha","Military","Modern","Mystery","Mythology",
  "Non-Fiction","Occult","Paranormal","Philosophy","Poetry","Post-Apocalyptic","Psychological",
  "Realistic Fiction","Reincarnation","Religion","Romance","Satire","School Life","Science Fiction",
  "Slice of Life","Space Opera","Sports","Steampunk","Super Power","Supernatural","System",
  "Thriller","Tragedy","Vampire","Virtual Reality","Wuxia","Xianxia","Xuanhuan","Yaoi",
];

const ALPHABET = "АБВГДЕЁЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ".split("");
const ITEMS_PER_PAGE = 30;

function GenrePickerModal({
  type, selected, onSelect, onRemove, onClose,
}: {
  type: "whitelist" | "blacklist";
  selected: string[];
  onSelect: (g: string) => void;
  onRemove: (g: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filtered = GENRES.filter((g) => {
    const matchQuery = !query || g.toLowerCase().includes(query.toLowerCase());
    const matchLetter = !letter || g.toUpperCase().startsWith(letter);
    return matchQuery && matchLetter;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [query, letter]);

  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ width: 440, maxWidth: "90vw", maxHeight: "80vh", borderRadius: 14, border: "1px solid var(--border)", background: "var(--bg-secondary)", display: "flex", flexDirection: "column", padding: 18, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>
          {type === "whitelist" ? "Добавить жанр (обязательные)" : "Исключить жанр"}
        </div>

        <input
          type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск жанра..."
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", fontSize: 13, color: "var(--text-primary)", outline: "none", marginBottom: 8 }}
          autoFocus
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          <button onClick={() => setLetter(null)} style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid var(--border)", background: !letter ? "var(--accent)" : "var(--bg-primary)", color: !letter ? "#fff" : "var(--text-primary)", fontSize: 10, cursor: "pointer" }}>Все</button>
          {ALPHABET.map((l) => (
            <button key={l} onClick={() => setLetter(l)} style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid var(--border)", background: letter === l ? "var(--accent)" : "var(--bg-primary)", color: letter === l ? "#fff" : "var(--text-primary)", fontSize: 10, cursor: "pointer" }}>{l}</button>
          ))}
          <button onClick={() => setLetter("A")} style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid var(--border)", background: letter === "A" ? "var(--accent)" : "var(--bg-primary)", color: letter === "A" ? "#fff" : "var(--text-primary)", fontSize: 10, cursor: "pointer" }}>ABC</button>
        </div>

        <div style={{ flex: 1, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8, marginBottom: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {paged.map((g) => {
              const isSelected = selected.includes(g);
              return (
                <button key={g} onClick={() => (isSelected ? onRemove(g) : onSelect(g))}
                  style={{
                    padding: "6px 10px", borderRadius: 12, border: "1px solid",
                    borderColor: isSelected ? (type === "whitelist" ? "var(--success)" : "var(--error)") : "var(--border)",
                    background: isSelected ? (type === "whitelist" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)") : "var(--bg-primary)",
                    color: isSelected ? (type === "whitelist" ? "var(--success)" : "var(--error)") : "var(--text-primary)",
                    fontSize: 12, cursor: "pointer", fontWeight: isSelected ? 500 : 400,
                  }}
                >{isSelected ? "✓ " : ""}{g}</button>
              );
            })}
          </div>
        </div>

        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-primary)", cursor: "pointer", fontSize: 12 }}>«</button>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-primary)", cursor: "pointer", fontSize: 12 }}>»</button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>Готово</button>
        </div>
      </div>
    </div>
  );
}
