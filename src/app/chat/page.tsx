"use client";
import { useState, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  // scroll to bottom when new message arrives
  useEffect(() => {
    const el = document.getElementById("chat-window");
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        cache: "no-store",
      });

      let reply = "Sorry, no reply.";
      if (r.ok) {
        const j = await r.json();
        reply =
          j.output ??
          j.answer ??
          j.content ??
          j.text ??
          (Array.isArray(j.choices) && j.choices[0]?.message?.content) ??
          j.message?.content ??
          JSON.stringify(j);
      } else {
        reply = `Error from /api/chat: ${r.status}`;
      }

      // always create new array reference to trigger re-render
      setMessages((prev) => [...prev, { role: "assistant", content: String(reply) }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Network error: ${String(err?.message || err)}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>New Chat</h1>

      <div
        id="chat-window"
        style={{
          minHeight: 320,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 12,
          overflowY: "auto",
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "#9ca3af", fontSize: 14 }}>Start by asking a question…</div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "8px 12px",
                borderRadius: 12,
                background: m.role === "user" ? "#1f2937" : "#e5e7eb",
                color: m.role === "user" ? "#fff" : "#111827",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={send} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message…"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            outline: "none",
          }}
        />
        <button
          disabled={loading}
          type="submit"
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #111827",
            background: loading ? "#6b7280" : "#111827",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
