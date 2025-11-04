"use client";
import * as React from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [lastJson, setLastJson] = React.useState<any>(null);

  async function sendMessage(text: string) {
    const userText = text.trim();
    if (!userText || loading) return;

    setLoading(true);
    setMessages((m) => [...m, { role: "user", content: userText }]);
    setInput("");

    try {
      const res = await fetch("/api/chat?" + Date.now(), {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });

      const data = await res.json().catch(() => ({} as any));
      setLastJson(data);

      if (!res.ok || data?.ok === false) {
        const err = data?.error || data?.details || `HTTP ${res.status}`;
        setMessages((m) => [...m, { role: "assistant", content: `Sorry, an error occurred: ${err}` }]);
        return;
      }

      const reply =
        (typeof data?.answer === "string" && data.answer) ||
        (typeof data?.output === "string" && data.output) ||
        (typeof data?.choices?.[0]?.message?.content === "string" && data.choices[0].message.content) ||
        (typeof data?.choices?.[0]?.text === "string" && data.choices[0].text) ||
        "(no response)";

      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Network error: ${e?.message || e}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>New Chat</h1>
      <p style={{ color: "#6b7280", marginBottom: 16 }}>Plain Chat</p>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, minHeight: 360, background: "#fff" }}>
        {messages.length === 0 ? (
          <p style={{ color: "#9ca3af" }}>Start by typing a message below.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {messages.map((m, i) => (
              <li key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
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

      {/* Always show the raw JSON we got back so nothing is "invisible" */}
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
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Last API JSON</div>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(lastJson, null, 2)}</pre>
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
          autoComplete="off"
          id="chat-input"
          name="chat-input"
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
