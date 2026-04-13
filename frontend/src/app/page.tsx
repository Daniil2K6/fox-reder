"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUser, clearToken, clearUser, getTheme, setTheme, apiPreviewBook } from "@/lib/api";
import { Navbar } from "@/components/Navbar";

export default function Home() {
  const router = useRouter();
  const [user, setUserState] = useState<any>(null);
  const [theme, setThemeState] = useState("light");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUserState(getUser());
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  const logout = () => {
    clearToken();
    clearUser();
    setUserState(null);
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    setThemeState(next);
  };

  const handleOpenLocal = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      const preview = await apiPreviewBook(file);
      sessionStorage.setItem("localBook", JSON.stringify(preview));
      router.push("/reader/local");
    } catch (err: any) {
      alert(err.message || "Не удалось открыть файл");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Navbar activeTab="home" />

      {/* Hero */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 20px",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 600 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🦊</div>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 12,
              letterSpacing: "-0.03em",
            }}
          >
            FoxBooks
          </h1>
          <p
            style={{
              fontSize: 18,
              color: "var(--text-secondary)",
              marginBottom: 40,
              lineHeight: 1.6,
            }}
          >
            Читалка с озвучкой и поддержкой FB2, EPUB и VoxBook
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
              marginBottom: 60,
            }}
          >
            {user && user.username ? (
              <>
                 <Link
                  href="/profile"
                  style={{
                    padding: "12px 28px",
                    borderRadius: 10,
                    background: "var(--accent)",
                    color: "#fff",
                    textDecoration: "none",
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  Профиль
                </Link>
                <Link
                  href="/public"
                  style={{
                    padding: "12px 28px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    textDecoration: "none",
                    fontSize: 15,
                    fontWeight: 500,
                  }}
                >
                  Публичная библиотека
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  style={{
                    padding: "12px 28px",
                    borderRadius: 10,
                    background: "var(--accent)",
                    color: "#fff",
                    textDecoration: "none",
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  Вход
                </Link>
                <Link
                  href="/register"
                  style={{
                    padding: "12px 28px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    textDecoration: "none",
                    fontSize: 15,
                    fontWeight: 500,
                  }}
                >
                  Регистрация
                </Link>
                <Link
                  href="/public"
                  style={{
                    padding: "12px 28px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    textDecoration: "none",
                    fontSize: 15,
                  }}
                >
                  Смотреть без входа
                </Link>
              </>
            )}
            <button
              onClick={handleOpenLocal}
              style={{
                padding: "12px 28px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-primary)",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Открыть файл локально
            </button>
          </div>

          {/* Features */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 16,
              textAlign: "left",
            }}
          >
            {[
              {
                icon: "📖",
                title: "Форматы",
                desc: "FB2, EPUB, TXT, VoxBook; дубликаты по хэшу не загружаются повторно",
              },
              {
                icon: "🔊",
                title: "Озвучка",
                desc: "Edge TTS — несколько языков и стилей голоса",
              },
              {
                icon: "🎭",
                title: "VoxBook",
                desc: "Главы, персонажи и оформление текста",
              },
              {
                icon: "🔒",
                title: "Приватность",
                desc: "Книги по умолчанию только у вас; можно сделать публичными",
              },
            ].map((f) => (
              <div
                key={f.title}
                style={{
                  padding: 20,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--bg-secondary)",
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: 4,
                  }}
                >
                  {f.title}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.fb2,.epub,.vb,.vblite"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>
      </div>
    </div>
  );
}