"use client";

import * as React from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastApiJson, setLastApiJson] = React.useState<any>(null);

  async function sendMessage(text: string) {
    const userText = text.trim();
    if (!userText || loading) return;

    setLoading(true);
    setError(null);

    // 1) append user, then an assistant placeholder we will replace
    setMessages((m) => [...m, { role: "user", content: userText }, { role: "assistant", content: "…" }]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // API accepts: message | input | text | prompt | q (we send "message")
        body: JSON.stringify({ message: userText }),
      });

      const data = await res.json().catch(() => ({} as any));
      setLastApiJson(data);

      if (!res.ok || data?.ok === false) {
        const msg = data?.error || data?.details || `HTTP ${res.status}`;
        setError(msg);

        // replace the last assistant placeholder with error text
        setMessages((m) => {
          const copy = m.slice();
          const last = copy.length - 1;
          if (last >= 0 && copy[last].role === "assistant") {
            copy[last] = { role: "assistant", content: `Sorry, an error occurred: ${msg}` };
          }
          return copy;
        });
        return;
      }

      const reply: string =
        (typeof data?.answer === "string" && data.answer) ||
        (typeof data?.output === "string" && data.output) ||
        "(no response)";

      // 2) replace assistant placeholder with real reply
      setMessages((m) => {
        const copy = m.slice();
        const last = copy.length - 1;
        if (last >= 0 && copy[last].role === "assistant") {
          copy[last] = { role: "assistant", content: reply };
        } else {
          copy.push({ role: "assistant", content: reply });
        }
        return copy;
      });
    } catch (e: any) {
      const msg = e?.message || "Network error";
      setError(msg);
      setMessages((m) => {
        const copy = m.slice();
        const last = copy.length - 1;
        if (last >= 0 && copy[last].role === "assistant") {
          copy[last] = { role: "assistant", content: `Sorry, an error occurred: ${msg}` };
        } else {
          copy.push({ role: "assistant", content: `Sorry, an error occurred: ${msg}` });
        }
        return copy;
      });
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
          minHeight: 360,
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
                    color: "#111827",
                    lineHeight: 1.4,
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

      {/* Debug peek to confirm what API returns */}
      {lastApiJson && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", color: "#4b5563" }}>Show last API JSON</summary>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              overflowX: "auto",
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 10,
              fontSize: 12,
              marginTop: 8,
            }}
          >
            {JSON.stringify(lastApiJson, null, 2)}
          </pre>
        </details>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const text = input;
          if (!text.trim() || loading) return;
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
