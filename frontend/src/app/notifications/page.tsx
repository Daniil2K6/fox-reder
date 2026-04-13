"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUser, clearToken, clearUser, getTheme, setTheme, apiNotifications, apiMarkRead, apiMarkAllRead, apiUnreadCount } from "@/lib/api";
import { useRouter } from "next/navigation";

interface Notification {
  id: number;
  type: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUserState] = useState<any>(null);
  const [theme, setThemeState] = useState("light");
  const router = useRouter();

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.push("/login");
      return;
    }
    setUserState(u);
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await apiNotifications();
      setNotifications(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearToken();
    clearUser();
    setUserState(null);
    router.push("/");
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    setThemeState(next);
  };

  const handleMarkRead = async (id: number) => {
    try {
      await apiMarkRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiMarkAllRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Только что";
    if (hours < 24) return `${hours} ч. назад`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} дн. назад`;
    return date.toLocaleDateString("ru");
  };

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>Loading...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>🦊 FoxBooks</Link>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>Уведомления</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{user?.username}</span>
          <Link href="/profile" style={{ padding: "6px 14px", borderRadius: 8, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>Мой профиль</Link>
          <button onClick={toggleTheme} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{theme === "light" ? "🌙" : "☀"}</button>
          <button onClick={logout} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Выход</button>
        </div>
      </nav>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Уведомления</h1>
          {notifications.some(n => !n.is_read) && (
            <button onClick={handleMarkAllRead} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Отметить все прочитанными</button>
          )}
        </div>

        {error && <div style={{ background: "var(--accent-light)", border: "1px solid var(--error)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, color: "var(--error)", fontSize: 14 }}>{error}</div>}

        {notifications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
            <p style={{ fontSize: 16 }}>Нет уведомлений</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifications.map((n) => (
              <div key={n.id} onClick={() => !n.is_read && handleMarkRead(n.id)} style={{ padding: "16px 20px", borderRadius: 12, border: "1px solid var(--border)", background: n.is_read ? "var(--bg-secondary)" : "var(--bg-tertiary)", cursor: "pointer", transition: "background 0.15s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>{n.type === "like" ? "❤️" : n.type === "comment" ? "💬" : n.type === "subscribe" ? "👤" : "📢"}</span>
                  <div style={{ flex: 1 }}>
                    {n.link ? (
                      <Link href={n.link} style={{ color: "var(--text-primary)", textDecoration: "none", fontSize: 14 }}>{String(n.message)}</Link>
                    ) : (
                      <p style={{ margin: 0, color: "var(--text-primary)", fontSize: 14 }}>{String(n.message)}</p>
                    )}
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{formatDate(n.created_at)}</p>
                  </div>
                  {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}