"use client";

import React, { useEffect, useRef, useState } from "react";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ── load / save simple session memory (localStorage) ─────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("jcil.chat.history");
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("jcil.chat.history", JSON.stringify(messages));
    } catch {}
  }, [messages]);

  async function send() {
    if (loading) return;
    const text = input.trim();
    if (!text && !file) return;

    // push user message locally first
    const nextHistory: Msg[] = [...messages, { role: "user", content: text || "[image]" }];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const headers: Record<string, string> = {};
      let body: BodyInit;

      if (file) {
        const form = new FormData();
        form.append("message", text);
        form.append("history", JSON.stringify(nextHistory.slice(-10))); // send last 10 turns
        form.append("file", file);
        body = form;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify({
          message: text,
          history: nextHistory.slice(-10),
        });
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages(h => [...h, { role: "assistant", content: data?.error || "Error" }]);
      } else {
        setMessages(h => [...h, { role: "assistant", content: data?.reply || "(no response)" }]);
      }
    } catch (err: any) {
      setMessages(h => [...h, { role: "assistant", content: err?.message || "Network error" }]);
    } finally {
      setLoading(false);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-center text-xl font-semibold mb-6">New Chat</h1>

      <div className="space-y-4">
        {messages.length === 0 && (
          <div className="text-sm text-gray-500">Hello! How can I assist you today?</div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              "rounded-lg p-3 text-sm " +
              (m.role === "user"
                ? "bg-blue-600 text-white ml-auto max-w-[80%]"
                : "bg-gray-100 text-gray-900 mr-auto max-w-[80%]")
            }
          >
            {m.content}
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
      </div>

      <div className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your message…"
          className="flex-1 rounded-lg border p-3 text-sm min-h-[48px]"
        />
        <button
          onClick={send}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
