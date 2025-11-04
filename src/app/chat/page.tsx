"use client";
import React, { useState, useEffect, useRef } from "react";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ── load previous thread from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("jcil.chat.history");
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
  }, []);

  // ── persist messages
  useEffect(() => {
    try {
      localStorage.setItem("jcil.chat.history", JSON.stringify(messages));
    } catch {}
  }, [messages]);

  async function send() {
    if (busy) return;
    const text = input.trim();
    if (!text && !file) return;
    setBusy(true);

    const newMsgs = [...messages, { role: "user", content: text || "[image]" }];
    setMessages(newMsgs);
    setInput("");

    try {
      let res: Response;

      if (file) {
        const form = new FormData();
        form.append("message", text);
        form.append("file", file);
        form.append("history", JSON.stringify(newMsgs.slice(-10)));
        res = await fetch("/api/chat", { method: "POST", body: form });
      } else {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history: newMsgs.slice(-10) }),
        });
      }

      const data = await res.json().catch(() => ({}));
      const reply = data?.reply || data?.error || "(no response)";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setBusy(false);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
      <h1 className="text-xl font-semibold text-center">New Chat</h1>

      <div className="space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">Hello! How can I assist you today?</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
              m.role === "user"
                ? "bg-blue-600 text-white ml-auto max-w-[80%]"
                : "bg-gray-100 text-gray-900 mr-auto max-w-[80%]"
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type your message…"
          className="flex-1 rounded border p-3 text-sm"
          rows={1}
        />
        <button
          onClick={send}
          disabled={busy}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
        >
          {busy ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
