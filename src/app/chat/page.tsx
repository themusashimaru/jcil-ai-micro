// src/app/chat/page.tsx
"use client";
import React, { useState } from "react";

type Bubble = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [msg, setMsg] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [chat, setChat] = useState<Bubble[]>([]);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (busy) return;
    const text = msg.trim();
    if (!text && !file) return;

    setBusy(true);

    let res: Response;
    try {
      if (file) {
        const form = new FormData();
        form.append("message", text);
        form.append("file", file);
        res = await fetch("/api/chat", { method: "POST", body: form });
      } else {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
      }

      const data = await res.json().catch(() => ({}));
      const userBubble: Bubble = { role: "user", content: text || "(image)" };

      if (!res.ok || !data?.ok) {
        setChat((c) => [...c, userBubble, { role: "assistant", content: `Error: ${data?.error || "API error"}` }]);
      } else {
        setChat((c) => [...c, userBubble, { role: "assistant", content: data.reply || "(no response)" }]);
      }
    } finally {
      setMsg("");
      setFile(null);
      setBusy(false);
      const f = document.getElementById("chat-file") as HTMLInputElement | null;
      if (f) f.value = "";
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">New Chat</h1>

      <div className="space-y-3">
        {chat.map((b, i) => (
          <div key={i} className={b.role === "user" ? "text-right" : "text-left"}>
            <div className={`inline-block rounded px-3 py-2 ${b.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100"}`}>
              {b.content}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <input
          id="chat-file"
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        <label htmlFor="chat-file" className="cursor-pointer rounded border px-3 py-2" title="Attach image">
          📎
        </label>

        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Type your message…"
          className="flex-1 rounded border px-3 py-2"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          onClick={send}
          disabled={busy}
          className="rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
