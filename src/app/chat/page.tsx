"use client";

import * as React from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // always-visible debug so nothing is “invisible”
  const [lastApi, setLastApi] = React.useState<{
    ok?: boolean;
    status?: number;
    json?: any;
    error?: string;
  } | null>(null);

  async function sendMessage(text: string) {
    const userText = text.trim();
    if (!userText || loading) return;

    setLoading(true);
    setLastApi(null);

    // show user + placeholder “…” that we replace
    setMessages((m) => [...m, { role: "user", content: userText }, { role: "assistant", content: "…" }]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // server accepts: message | input | text | prompt | q
        body: JSON.stringify({ message: userText }),
      });

      const data = await res.json().catch(() => ({} as any));
      setLastApi({ ok: data?.ok ?? res.ok, status: res.status, json: data });

      // treat both {ok:true, answer/output} and {output} as success
      const success = (data?.ok ?? res.ok) === true;
      if (!success) {
        const msg = data?.error || data?.details || `HTTP ${res.status}`;
        replaceAssistant(`Sorry, an error occurred: ${msg}`);
        return;
      }

      const reply =
        (typeof data?.answer === "string" && data.answer) ||
        (typeof data?.output === "string" && data.output) ||
        "(no response)";

      replaceAssistant(reply);
    } catch (e: any) {
      setLastApi({ ok: false, error: e?.message || "Network error" });
      replaceAssistant(`Sorry, an error occurred: ${e?.message || "Network error"}`);
    } finally {
      setLoading(false);
    }
  }

  function replaceAssistant(text: string) {
    setMessages((m) => {
      const copy = m.slice();
      const i = copy.length - 1;
      if (i >= 0 && copy[i].role === "assistant") copy[i] = { role: "assistant", content: text };
      else copy.push({ role: "assistant", content: text });
      return copy;
    });
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

      {/* Always-visible debug so replies aren't “invisible” */}
      <div
        style={{
          marginTop: 12,
          background: "#f9fafb",
          border: "1px dashed #d1d5db",
          borderRadius: 8,
          padding: 10,
          fontSize: 12,
          color: "#374151",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Last API</div>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
{JSON.stringify(lastApi ?? { ok: null, status: null, json: null }, null, 2)}
        </pre>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || loading) return;
          sendMessage(input);
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
