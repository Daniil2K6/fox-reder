"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser, clearToken, clearUser, getTheme, setTheme, apiGetAvatarUrl, apiUnreadCount } from "@/lib/api";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface NavbarProps {
  activeTab?: "home" | "public" | "profile" | "admin" | "notifications" | "converter";
  hideTabs?: boolean;
  breadcrumbs?: Breadcrumb[];
}

export function Navbar({ activeTab, hideTabs, breadcrumbs }: NavbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [theme, setThemeState] = useState("light");
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    if (u) {
      apiUnreadCount().then(d => setUnreadCount(d.count)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      const u = getUser();
      setUser(u);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const logout = () => {
    clearToken();
    clearUser();
    router.push("/");
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    setThemeState(next);
  };

  return (
    <nav style={{ 
      display: "flex", 
      justifyContent: "space-between", 
      alignItems: "center", 
      padding: "12px 32px", 
      borderBottom: "1px solid var(--border)", 
      background: "var(--bg-secondary)",
      minHeight: 56,
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/" style={{ 
          fontSize: 18, 
          fontWeight: 700, 
          color: "var(--accent)", 
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{ fontSize: 22 }}>🦊</span>
          <span style={{ letterSpacing: "-0.02em" }}>FoxBooks</span>
        </Link>
        
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            {breadcrumbs.map((crumb, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {crumb.href ? (
                  <Link href={crumb.href} style={{ 
                    fontSize: 12, 
                    color: "var(--text-secondary)", 
                    textDecoration: "none",
                    padding: "4px 6px",
                    borderRadius: 4,
                    transition: "background 0.15s",
                  }}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span style={{ 
                    fontSize: 12, 
                    color: "var(--text-primary)", 
                    fontWeight: 500,
                    padding: "4px 6px",
                  }}>
                    {crumb.label}
                  </span>
                )}
                {idx < breadcrumbs.length - 1 && (
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>›</span>
                )}
              </div>
            ))}
          </div>
        )}
        
        {!hideTabs && !breadcrumbs && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Link href="/" style={{ 
              padding: "6px 12px", 
              borderRadius: 8, 
              textDecoration: "none", 
              fontSize: 13,
              background: activeTab === "home" ? "var(--accent)" : "transparent",
              color: activeTab === "home" ? "#fff" : "var(--text-secondary)",
              fontWeight: 500,
            }}>Главная</Link>
            <Link href="/public" style={{ 
              padding: "6px 12px", 
              borderRadius: 8, 
              textDecoration: "none", 
              fontSize: 13,
              background: activeTab === "public" ? "var(--accent)" : "transparent",
              color: activeTab === "public" ? "#fff" : "var(--text-secondary)",
              fontWeight: 500,
            }}>Библиотека</Link>
            <Link href="/converter" style={{ 
              padding: "6px 12px", 
              borderRadius: 8, 
              textDecoration: "none", 
              fontSize: 13,
              background: activeTab === "converter" ? "var(--accent)" : "transparent",
              color: activeTab === "converter" ? "#fff" : "var(--text-secondary)",
              fontWeight: 500,
            }}>Конвертер</Link>
            {user && (
              <>
                <Link href="/profile" style={{ 
                  padding: "6px 12px", 
                  borderRadius: 8, 
                  textDecoration: "none", 
                  fontSize: 13,
                  background: activeTab === "profile" ? "var(--accent)" : "transparent",
                  color: activeTab === "profile" ? "#fff" : "var(--text-secondary)",
                  fontWeight: 500,
                }}>Профиль</Link>
                {user.role === "admin" && (
                  <Link href="/admin" style={{ 
                    padding: "6px 12px", 
                    borderRadius: 8, 
                    textDecoration: "none", 
                    fontSize: 13,
                    fontWeight: 500,
                    background: activeTab === "admin" ? "var(--accent)" : "transparent",
                    border: activeTab !== "admin" ? "1px solid var(--accent)" : "none",
                    color: activeTab === "admin" ? "#fff" : "var(--accent)",
                  }}>Админ</Link>
                )}
              </>
            )}
          </div>
        )}
      </div>
      
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={toggleTheme} style={{ 
          width: 32, 
          height: 32, 
          borderRadius: 8, 
          border: "1px solid var(--border)", 
          background: "var(--bg-primary)", 
          cursor: "pointer", 
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>{theme === "light" ? "🌙" : "☀"}</button>
        
        {user && user.username ? (
          <>
            <Link href="/notifications" style={{ 
              position: "relative", 
              padding: "6px 10px", 
              borderRadius: 8, 
              border: "1px solid var(--border)", 
              background: "transparent", 
              color: "var(--text-secondary)", 
              textDecoration: "none", 
              fontSize: 14,
              display: "flex",
              alignItems: "center",
            }}>
              🔔
              {unreadCount > 0 && (
                <span style={{ 
                  position: "absolute", 
                  top: -2, 
                  right: -2, 
                  background: "#ef4444", 
                  color: "white", 
                  borderRadius: "50%", 
                  fontSize: 9, 
                  minWidth: 16, 
                  height: 16, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  fontWeight: 600,
                }}>{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </Link>
            <Link href="/profile" style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 6, 
              textDecoration: "none",
              padding: "4px 8px",
              borderRadius: 8,
              transition: "background 0.15s",
            }}>
              {user.avatar_url ? (
                <img src={apiGetAvatarUrl(user.id)} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ 
                  width: 26, 
                  height: 26, 
                  borderRadius: "50%", 
                  background: "linear-gradient(135deg, #f97316, #ea580c)", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  fontSize: 11, 
                  fontWeight: 600, 
                  color: "#fff" 
                }}>
                  {user.username?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                {user.username}
              </span>
            </Link>
            <button onClick={logout} style={{ 
              padding: "6px 12px", 
              borderRadius: 8, 
              border: "1px solid var(--border)", 
              background: "transparent", 
              color: "var(--text-muted)", 
              fontSize: 12, 
              cursor: "pointer",
            }}>Выход</button>
          </>
        ) : (
          <>
            <Link href="/login" style={{ 
              padding: "6px 12px", 
              borderRadius: 8, 
              border: "1px solid var(--border)", 
              background: "var(--bg-primary)", 
              color: "var(--text-secondary)", 
              textDecoration: "none", 
              fontSize: 13,
              fontWeight: 500,
            }}>Вход</Link>
            <Link href="/register" style={{ 
              padding: "6px 12px", 
              borderRadius: 8, 
              background: "var(--accent)", 
              color: "#fff", 
              textDecoration: "none", 
              fontSize: 13,
              fontWeight: 500,
            }}>Регистрация</Link>
          </>
        )}
      </div>
    </nav>
  );
}