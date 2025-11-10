/**
 * CHAT INTERFACE
 * PURPOSE: Main chat UI with live search integration
 */

'use client';

import { useState } from 'react';
import { LiveSearchButton } from './LiveSearchButton';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'live-search';
  timestamp: Date;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  const handleLiveSearchComplete = (content: string, query: string) => {
    // Add user query
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    // Add assistant response with live search result
    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content,
      type: 'live-search',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // TODO: Send to chat API
  };

  return (
    <div className="flex h-screen flex-col bg-black">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <h1 className="text-xl font-semibold">Delta-2 Chat</h1>
      </header>

      {/* Main chat area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <div className="mb-4">
            <button className="w-full rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200">
              + New Chat
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-400">No chats yet</p>
          </div>
        </aside>

        {/* Chat thread */}
        <main className="flex flex-1 flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.length === 0 ? (
                <div className="text-center">
                  <p className="mb-4 text-gray-400">Start a conversation</p>
                  <p className="text-sm text-gray-500">
                    Try using Live Search for real-time information!
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-2xl p-4 ${
                      message.role === 'user'
                        ? 'ml-auto max-w-[80%] bg-white text-black'
                        : 'mr-auto max-w-[80%] bg-white/10 text-white'
                    }`}
                  >
                    {message.type === 'live-search' && (
                      <div className="mb-2 flex items-center gap-2 text-xs text-white/70">
                        <span>🔍</span>
                        <span>Live Search Result</span>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    <div
                      className={`mt-2 text-xs ${
                        message.role === 'user' ? 'text-black/50' : 'text-white/50'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="border-t border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <div className="mx-auto max-w-3xl">
              <div className="mb-2 flex gap-2">
                <LiveSearchButton onSearchComplete={handleLiveSearchComplete} />
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="w-full resize-none rounded-lg bg-white/5 p-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="Type your message... (Press Enter to send)"
                rows={3}
              />
              <div className="mt-2 flex justify-between">
                <button className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white">
                  Attach
                </button>
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="rounded-lg bg-white px-6 py-2 text-sm font-semibold text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
