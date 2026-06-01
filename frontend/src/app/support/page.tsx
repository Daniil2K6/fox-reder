"use client";

import { useEffect, useState } from "react";
import { getUser, getTheme, apiMySupportTickets, apiSupportTicket, apiCreateSupportTicket } from "@/lib/api";
import { Navbar } from "@/components/Navbar";

export default function SupportPage() {
  const [user, setUser] = useState<any>(null);
  const [theme, setThemeState] = useState("light");
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) { window.location.href = "/login"; return; }
    setUser(u);
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const data = await apiMySupportTickets();
      setTickets(data || []);
    } catch {}
    setLoading(false);
  };

  const openTicket = async (id: number) => {
    try {
      const data = await apiSupportTicket(id);
      setSelectedTicket(data);
    } catch {}
  };

  const createTicket = async () => {
    if (!subject.trim() || !content.trim()) return;
    setSending(true);
    try {
      await apiCreateSupportTicket(subject, content);
      setSubject("");
      setContent("");
      setSent(true);
      setTimeout(() => setSent(false), 3000);
      await loadTickets();
    } catch {}
    setSending(false);
  };

  const statusLabel = (s: string) => s === "open" ? "Рассматривается" : s === "answered" ? "Получен ответ" : "Закрыто";
  const statusColor = (s: string) => s === "open" ? "var(--accent)" : s === "answered" ? "var(--success)" : "var(--text-muted)";

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>Загрузка...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <Navbar activeTab="support" />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 24px 60px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", marginBottom: 20 }}>Техническая поддержка</h1>

        {selectedTicket ? (
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-secondary)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <button onClick={() => setSelectedTicket(null)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13, marginBottom: 8 }}>← Назад к списку</button>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{selectedTicket.subject}</h3>
              <span style={{ fontSize: 11, color: statusColor(selectedTicket.status) }}>{statusLabel(selectedTicket.status)}</span>
            </div>
            <div style={{ padding: 20, maxHeight: 500, overflowY: "auto" }}>
              {(selectedTicket.replies || []).map((r: any) => (
                <div key={r.id} style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 10, background: r.is_admin ? "rgba(249,115,22,0.06)" : "var(--bg-primary)", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: r.is_admin ? "var(--accent)" : "var(--text-primary)" }}>
                      {r.is_admin ? "🛡 Администратор" : "Вы"}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {new Date(r.created_at).toLocaleString("ru-RU")}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0, whiteSpace: "pre-wrap" }}>{r.content}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* New ticket form */}
            <div style={{ padding: 20, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-secondary)", marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Сообщить об ошибке</h3>
              {sent && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(34,197,94,0.1)", border: "1px solid var(--success)", color: "var(--success)", fontSize: 13, marginBottom: 12 }}>
                  Сообщение отправлено! Администратор получит уведомление.
                </div>
              )}
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Кратко опишите проблему"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", fontSize: 14, color: "var(--text-primary)", outline: "none", marginBottom: 10 }}
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Подробно опишите ошибку: что произошло, что ожидали увидеть, шаги для воспроизведения..."
                rows={5}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", fontSize: 14, color: "var(--text-primary)", outline: "none", resize: "vertical", marginBottom: 10, fontFamily: "inherit" }}
              />
              <button
                onClick={createTicket}
                disabled={sending || !subject.trim() || !content.trim()}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: sending || !subject.trim() || !content.trim() ? "var(--text-muted)" : "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 500, cursor: sending ? "default" : "pointer" }}
              >
                {sending ? "Отправка..." : "Отправить"}
              </button>
            </div>

            {/* Previous tickets */}
            {tickets.length > 0 && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Мои обращения</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => openTicket(t.id)}
                      style={{ padding: "14px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", transition: "transform 0.15s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateX(4px)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateX(0)"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t.subject}</h4>
                        <span style={{ fontSize: 11, color: statusColor(t.status), fontWeight: 500 }}>{statusLabel(t.status)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                        <span>{new Date(t.updated_at || t.created_at).toLocaleDateString("ru-RU")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
