import { useState } from "react";

const ITEMS_PER_PAGE = 30;
const RUSSIAN_ALPHABET = "АБВГДЕЁЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ".split("");

const GENRES = [
  "Автобиография",
  "Авторская проза",
  "Ангелы",
  "Боевая фантастика",
  "Боевик",
  "Вампиры",
  "Вестерн",
  "Военная проза",
  "Волшебство",
  "Детектив",
  "Детская литература",
  "Драма",
  "Историческая проза",
  "Исторический роман",
  "Киберпанк",
  "Классика",
  "Космическая опера",
  "Космическая фантастика",
  "Криминальный триллер",
  "Любовный роман",
  "Мистика",
  "Научная фантастика",
  "Приключения",
  "Психологический триллер",
  "Роман",
  "Сказка",
  "Тёмное фэнтези",
  "Триллер",
  "Ужасы",
  "Фантастика",
  "Фэнтези",
  "Юмористическая проза",
  "Adult",
  "Adventure",
  "Alternive History",
  "Anime",
  "Anthology",
  "Apocalypse",
  "Arts",
  "BDSM",
  "Biography",
  "Business",
  "Cartoon",
  "Chick Lit",
  "Children",
  "Chronicles",
  "Classic",
  "Comedy",
  "Coming of Age",
  "Comics",
  "Contemporary",
  "Crime",
  "Culinary",
  "Cyberpunk",
  "Dark Fantasy",
  "Detective",
  "Drama",
  "Dystopia",
  "Education",
  "Epic Fantasy",
  "Espionage",
  "Fairytale",
  "Family",
  "Fantasy",
  "Fiction",
  "Food",
  "Friendship",
  "Gore",
  "Gothic",
  "Graphic Novel",
  "Harem",
  "Health",
  "Historical",
  "Historical Fiction",
  "Horror",
  "Humor",
  "Hunting",
  "Isekai",
  "Kids",
  "Literature",
  "Love",
  "Mafia",
  "Manga",
  "Martial Arts",
  "Mature",
  "Medical",
  "Medieval",
  "Memoir",
  "Military",
  "Mystery",
  "Mythology",
  "Non-fiction",
  "Novel",
  "Occult",
  "Paranormal",
  "Parenting",
  "Politics",
  "Post-apocalyptic",
  "Pow",
  "Psychological",
  "Religion",
  "Romance",
  "Satire",
  "School",
  "Sci-fi",
  "Science Fiction",
  "Seinen",
  "Self-help",
  "Sexuality",
  "Shoujo",
  "Shounen",
  "Slice of Life",
  "Social",
  "Society",
  "Speculative Fiction",
  "Sports",
  "Steampunk",
  "Superhero",
  "Supernatural",
  "Suspense",
  "Terror",
  "Thriller",
  "Time Travel",
  "Tragedy",
  "Urban Fantasy",
  "Vampire",
  "Victory",
  "War",
  "Western",
  "Witches",
  "Xianxia",
  "Xuanhuan",
  "Yaoi",
  "Yuri",
];

function getGenresByLetter(letter: string): string[] {
  if (letter === "ABC") {
    return GENRES.filter(g => /^[A-Z]/.test(g));
  }
  const upper = letter.toUpperCase();
  return GENRES.filter(g => g.toUpperCase().startsWith(upper));
}

function searchGenres(query: string): string[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return GENRES.filter(g => g.toLowerCase().includes(q)).slice(0, 50);
}

export function GenreSelector({ selectedGenres, onSave, onClose }: { selectedGenres: string[]; onSave: (g: string[]) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState("А");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedGenres));

  const filteredGenres = search ? searchGenres(search) : getGenresByLetter(activeLetter);
  const totalPages = Math.max(1, Math.ceil(filteredGenres.length / ITEMS_PER_PAGE));
  const pagedGenres = filteredGenres.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleGenre = (g: string) => {
    const next = new Set(selected);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    setSelected(next);
  };

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) setCurrentPage(p);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ background: "var(--bg-secondary)", borderRadius: 12, width: "95%", maxWidth: 600, maxHeight: "85vh", display: "flex", flexDirection: "column", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Выбор жанров</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
        </div>

        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="Поиск..."
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", marginBottom: 12 }}
        />

        {!search && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
            {RUSSIAN_ALPHABET.slice(0, 12).map(l => (
              <button key={l} onClick={() => { setActiveLetter(l); setCurrentPage(1); }}
                style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: activeLetter === l ? "var(--accent)" : "var(--bg-primary)", color: activeLetter === l ? "#fff" : "var(--text-primary)", fontSize: 11, cursor: "pointer" }}>
                {l}
              </button>
            ))}
            <button onClick={() => { setActiveLetter("ABC"); setCurrentPage(1); }}
              style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: activeLetter === "ABC" ? "var(--accent)" : "var(--bg-primary)", color: activeLetter === "ABC" ? "#fff" : "var(--text-primary)", fontSize: 11, cursor: "pointer" }}>
              ABC
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 12, padding: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {pagedGenres.map(g => (
              <button key={g} onClick={() => toggleGenre(g)}
                style={{ padding: "6px 10px", borderRadius: 12, border: "1px solid var(--border)", background: selected.has(g) ? "var(--accent)" : "var(--bg-primary)", color: selected.has(g) ? "#fff" : "var(--text-primary)", fontSize: 12, cursor: "pointer" }}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-primary)", cursor: "pointer" }}>«</button>
            <span style={{ fontSize: 12 }}>{currentPage} / {totalPages}</span>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-primary)", cursor: "pointer" }}>»</button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Выбрано: {selected.size}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", cursor: "pointer" }}>Отмена</button>
            <button onClick={() => onSave(Array.from(selected))} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Сохранить</button>
          </div>
        </div>
      </div>
    </div>
  );
}