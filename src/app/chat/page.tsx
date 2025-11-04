"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant" | "system";
type Msg = { role: Role; content: string };

const STORAGE_KEY = "conversation_id";

/** Minimal fetch wrapper */
async function jfetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  let data: any = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const err = (data?.error || `HTTP ${res.status}`);
    throw new Error(typeof err === "string" ? err : JSON.stringify(err));
  }
  return data as T;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const convIdRef = useRef<string | null>(null);

  // load conversation id from localStorage once
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) convIdRef.current = saved;
    } catch {}
  }, []);

  // load history if we have a conversation id
  useEffect(() => {
    const cid = convIdRef.current;
    if (!cid) return;
    (async () => {
      try {
        const data = await jfetch<{ ok: boolean; messages: Msg[] }>(
          `/api/messages?conversation_id=${encodeURIComponent(cid)}`
        );
        if (data?.ok && Array.isArray(data.messages)) {
          // filter to valid roles
          const safe = data.messages
            .map((m: any) => ({ role: m.role as Role, content: String(m.content ?? "") }))
            .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "system");
          setMessages(safe);
        }
      } catch {
        // ignore load errors (empty thread is fine)
      }
    })();
  }, []);

  async function ensureConversationId(): Promise<string> {
    if (convIdRef.current) return convIdRef.current;
    const data = await jfetch<{ ok: boolean; conversationId: string }>(
      "/api/conversations",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "New Chat" }) }
    );
    const cid = data.conversationId;
    convIdRef.current = cid;
    try { localStorage.setItem(STORAGE_KEY, cid); } catch {}
    return cid;
  }

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);

    const userMsg: Msg = { role: "user", content: text.trim() };
    const pending = [...messages, userMsg];
    setMessages(pending);
    setInput("");

    try {
      const cid = await ensureConversationId();

      // persist user message
      jfetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversation_id: cid, role: "user", content: userMsg.content }),
      }).catch(() => {});

      // call your existing chat API (keeps your Christian system prompt)
      const chatRes = await jfetch<{ ok: boolean; reply: string; model?: string }>(
        "/api/chat",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            conversation_id: cid,
            messages: pending, // history-first; your route may ignore or use it
          }),
        }
      );

      const assistant: Msg = { role: "assistant", content: chatRes.reply || "(no response)" };
      const next = [...pending, assistant];
      setMessages(next);

      // persist assistant message
      jfetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversation_id: cid, role: "assistant", content: assistant.content }),
      }).catch(() => {});
    } catch (err: any) {
      const fail: Msg = { role: "assistant", content: `Error: ${err?.message || "Unknown error"}` };
      setMessages((cur) => [...cur, fail]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h2 className="text-center text-xl font-semibold mb-6">New Chat</h2>

      <div className="space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                "inline-block rounded-xl px-4 py-2 " +
                (m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100")
              }
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message…"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
