"use client";

import { useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function sendMessage(message: string, fileToSend?: File | null) {
    const formData = new FormData();
    formData.append("message", message);
    if (fileToSend) {
      formData.append("file", fileToSend);
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Unknown error");
    }

    return data.reply as string;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input && !file) return;

    setLoading(true);
    setErrorMsg("");

    // show user message right away
    setMessages((prev) => [
      ...prev,
      { role: "user", content: input || (file ? "(sent file)" : "") },
    ]);

    try {
      const reply = await sendMessage(input, file);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Sorry, there has been an error.");
      // remove the last user message if you want, but we can leave it
    } finally {
      setLoading(false);
      setInput("");
      setFile(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col gap-4 p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Chat</h1>

      <div className="flex-1 border rounded p-3 space-y-2 overflow-auto bg-white">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-sm">Start a conversation…</p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "text-right flex justify-end"
                  : "text-left flex justify-start"
              }
            >
              <div
                className={
                  m.role === "user"
                    ? "bg-blue-100 px-3 py-2 rounded-lg inline-block max-w-[80%]"
                    : "bg-gray-100 px-3 py-2 rounded-lg inline-block max-w-[80%]"
                }
              >
                {m.content}
              </div>
            </div>
          ))
        )}

        {errorMsg ? (
          <p className="text-red-500 text-sm mt-2">{errorMsg}</p>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 border rounded px-3 py-2"
          placeholder="Type your message…"
          disabled={loading}
        />
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded"
        >
          {loading ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
