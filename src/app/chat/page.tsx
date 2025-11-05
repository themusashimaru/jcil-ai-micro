"use client";

import { useEffect, useState } from "react";

type Msg = { role: "user" | "assistant" | "system"; content: string };

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // Create or load a conversation id before chat starts
  useEffect(() => {
    (async () => {
      const existing = localStorage.getItem("conversation_id");
      if (existing) {
        setConversationId(existing);
        return;
      }
      try {
        const res = await fetch("/api/conversations", { method: "POST" });
        const data = await res.json();
        if (data?.ok && data?.conversationId) {
          localStorage.setItem("conversation_id", data.conversationId);
          setConversationId(data.conversationId);
        }
      } catch (err) {
        console.error("Failed to create conversation", err);
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !conversationId || busy) return; // block until ready

    setBusy(true);
    const userMsg: Msg = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, text }),
      });
      const data = await res.json();
      const replyText =
        data?.reply ??
        data?.choices?.[0]?.message?.content ??
        data?.error ??
        "(no response)";
      setMessages((m) => [...m, { role: "assistant", content: replyText }]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Error reaching server." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold mb-4">New Chat</h1>

      <div className="space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div
              className={
                "inline-block rounded px-3 py-2 " +
                (m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900")
              }
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {!conversationId && (
        <div className="text-gray-500 mt-4 text-sm">
          Initializing chat session…
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            conversationId ? "Type your message…" : "Setting up chat…"
          }
          disabled={busy || !conversationId}
        />
        <button
          type="submit"
          disabled={busy || !conversationId}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
