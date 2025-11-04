'use client';

import React, { useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [fileToSend, setFileToSend] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function fileToBase64(f: File): Promise<string> {
    // Browser-safe: FileReader → data URL
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(f);
    });
    return dataUrl;
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const text = input.trim();
    if (!text && !fileToSend) return;

    // optimistic user bubble
    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: "user", content: text || "[image]" };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      let image_base64: string | undefined;
      if (fileToSend) {
        image_base64 = await fileToBase64(fileToSend);
        setFileToSend(null);
      }

      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, image_base64 }),
      });

      if (resp.status === 403) {
        // Moderation blocked
        const data = await resp.json().catch(() => ({}));
        const primary = data?.error || "This message violates policy.";
        const tip = data?.tip ? `\nTip: ${data.tip}` : "";
        const warn: ChatMessage = {
          id: `w_${Date.now()}`,
          role: "assistant",
          content: `Policy: ${primary}${tip}`,
        };
        setMessages((prev) => [...prev, warn]);
        setLoading(false);
        return;
      }

      const data = await resp.json();
      if (!resp.ok || !data?.ok) {
        const err = data?.error || "Unknown error from /api/chat";
        const warn: ChatMessage = {
          id: `e_${Date.now()}`,
          role: "assistant",
          content: `Error: ${err}`,
        };
        setMessages((prev) => [...prev, warn]);
        setLoading(false);
        return;
      }

      const assistant: ChatMessage = {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: data.reply || "",
      };
      setMessages((prev) => [...prev, assistant]);
    } catch (err: any) {
      const warn: ChatMessage = {
        id: `e_${Date.now()}`,
        role: "assistant",
        content: `Error: ${err?.message || "Failed to send."}`,
      };
      setMessages((prev) => [...prev, warn]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">Chat</h1>

      <div className="space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                "inline-block rounded-md px-3 py-2 " +
                (m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900")
              }
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSend} className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 min-w-[240px] border rounded-md px-3 py-2"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFileToSend(e.target.files?.[0] || null)}
          className="text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white rounded-md px-4 py-2 disabled:opacity-50"
        >
          {loading ? "..." : "Send"}
        </button>
      </form>
    </main>
  );
}
