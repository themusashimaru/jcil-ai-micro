"use client";

import * as React from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function sendMessage(text: string) {
    setLoading(true);
    setError(null);

    // show user message immediately
    setMessages((m) => [...m, { role: "user", content: text }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // our API accepts: message | input | text | prompt | q
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || (data && data.ok === false)) {
        const msg = (data && (data.error || data.details)) || `HTTP ${res.status}`;
        setError(msg);
        setMessages((m) => [...m, { role: "assistant", content: `Sorry, an error occurred: ${msg}` }]);
        return;
      }

      // API may return { ok: true, answer, output } OR just { output }
      const reply: string =
        (data && (data.answer || data.output)) ||
        "(no response)";

      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e: any) {
      const msg = e?.message || "Network error";
      setError(msg);
      setMessages((m) => [...m, { role: "assistant", content: `Sorry, an error occurred: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "1.25rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>New Chat</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>Plain Chat</p>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          minHeight: 320,
          background: "#fff",
        }}
      >
        {messages.length === 0 ? (
          <p style={{ color: "#9ca3af" }}>Start by typing a message below.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {messages.map((m, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    whiteSpace: "pre-wrap",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: m.role === "user" ? "#eef2ff" : "#f9fafb",
                  }}
                >
                  {m.content}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p
          style={{
            marginTop: 12,
            color: "#b91c1c",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            padding: "8px 10px",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || loading) return;
          const text = input.trim();
          setInput("");
          sendMessage(text);
        }}
        style={{ display: "flex", gap: 8, marginTop: 16 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          aria-label="message"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            outline: "none",
          }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
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
