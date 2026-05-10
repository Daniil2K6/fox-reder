"use client";

import { useEffect, useState } from "react";
import { getUser, getTheme, setTheme } from "@/lib/api";
import { Navbar } from "@/components/Navbar";

export default function InDevelopmentPage() {
  const [theme, setThemeState] = useState("light");

  useEffect(() => {
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <Navbar />
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 80, marginBottom: 24 }}>🚧</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>В разработке</h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 32 }}>
          Этот раздел находится в разработке. Скоро здесь появится что-то интересное!
        </p>
        <button
          onClick={() => window.history.back()}
          style={{
            padding: "12px 24px",
            borderRadius: 8,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ← Назад
        </button>
      </div>
    </div>
  );
}