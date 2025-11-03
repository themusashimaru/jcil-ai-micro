"use client";

import { useState } from "react";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [fileToSend, setFileToSend] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendMessage(message: string, file?: File | null): Promise<string> {
    const formData = new FormData();
    formData.append("message", message);
    if (file) formData.append("file", file);

    const res = await fetch("/api/chat", { method: "POST", body: formData });

    // ——— Explicit moderation handling (403) ———
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      const text =
        data?.error ||
        "This message violates policy and cannot be processed.";

      // show a red policy bubble
      const warn: ChatMessage = {
        id: `warn_${Date.now()}`,
        role: "assistant",
        content: text,
      };
      setMessages((prev) => [...prev, warn]);
      return "";
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "Unknown error");
    }

    return (data.reply as string) || "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() && !fileToSend) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim() || (fileToSend ? "[sent image]" : ""),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const reply = await sendMessage(userMessage.content, fileToSend);
      if (reply) {
        const bot: ChatMessage = {
          id: `reply_${Date.now()}`,
          role: "assistant",
          content: reply,
        };
        setMessages((prev) => [...prev, bot]);
      }
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: `Sorry, an error occurred: ${err.message}`,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setFileToSend(null);
    }
  }

  return (
    <main className="flex flex-col items-center justify-between w-full h-full">
      <div className="max-w-3xl w-full flex flex-col p-6 space-y-3">
        <h1 className="text-center text-2xl font-semibold mb-4">New Chat</h1>

        <div className="flex flex-col space-y-2 border rounded-md p-4 min-h-[400px] overflow-y-auto bg-white">
          {messages.map((m) => {
            const isPolicy = m.content.toLowerCase().includes("violates policy");
            const bubbleClass =
              m.role === "user"
                ? "self-end bg-blue-600 text-white"
                : isPolicy
                ? "self-start bg-red-100 text-red-700 border border-red-300"
                : "self-start bg-gray-100 text-gray-800";

            return (
              <div
                key={m.id}
                className={`${bubbleClass} px-3 py-2 rounded-lg max-w-[80%] whitespace-pre-wrap`}
              >
                {m.content}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mt-4 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
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
      </div>
    </main>
  );
}
