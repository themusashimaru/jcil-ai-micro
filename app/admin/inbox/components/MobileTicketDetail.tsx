'use client';

import { Ticket, Reply, STATUS_LABELS } from './types';

interface MobileTicketDetailProps {
  selectedTicket: Ticket;
  detailLoading: boolean;
  replies: Reply[];
  replyText: string;
  isInternalNote: boolean;
  replySending: boolean;
  setSelectedTicket: (ticket: Ticket | null) => void;
  setReplyText: (text: string) => void;
  setIsInternalNote: (value: boolean) => void;
  updateTicket: (ticketId: string, updates: Partial<Ticket>) => void;
  sendReply: () => void;
}

export function MobileTicketDetail({
  selectedTicket,
  detailLoading,
  replies,
  replyText,
  isInternalNote,
  replySending,
  setSelectedTicket,
  setReplyText,
  setIsInternalNote,
  updateTicket,
  sendReply,
}: MobileTicketDetailProps) {
  return (
    <div className="lg:hidden fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="p-4">
        <button onClick={() => setSelectedTicket(null)} className="mb-4 text-primary">
          Back to list
        </button>

        {detailLoading ? (
          <div className="text-center py-8 text-text-muted">Loading...</div>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-2">{selectedTicket.subject}</h2>
            <div className="text-sm mb-4 text-text-secondary">
              From: {selectedTicket.sender_name || selectedTicket.sender_email}
            </div>

            <div className="flex gap-2 mb-4">
              <select
                value={selectedTicket.status}
                onChange={(e) => updateTicket(selectedTicket.id, { status: e.target.value })}
                className="rounded px-3 py-2 text-sm flex-1 bg-glass border border-theme text-text-primary"
              >
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                onClick={() =>
                  updateTicket(selectedTicket.id, { is_starred: !selectedTicket.is_starred })
                }
                className={`px-4 py-2 rounded border border-theme ${selectedTicket.is_starred ? 'bg-yellow-500 text-white' : 'bg-glass text-text-primary'}`}
              >
                Star
              </button>
            </div>

            {/* Messages */}
            <div className="space-y-4 mb-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="text-sm mb-2 text-text-secondary">
                  {new Date(selectedTicket.created_at).toLocaleString()}
                </div>
                <div className="whitespace-pre-wrap">{selectedTicket.message}</div>
              </div>

              {replies.map((reply) => (
                <div
                  key={reply.id}
                  className={`rounded-lg p-4 ${
                    reply.is_internal_note
                      ? 'bg-yellow-500/10 border border-yellow-500/20'
                      : 'bg-green-500/10 border border-green-500/20'
                  }`}
                >
                  <div className="text-sm mb-2 text-text-secondary">
                    {reply.admin_email} - {new Date(reply.created_at).toLocaleString()}
                    {reply.is_internal_note && (
                      <span className="ml-2 text-yellow-600">(Internal)</span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap">{reply.message}</div>
                </div>
              ))}
            </div>

            {/* Reply */}
            <div className="sticky bottom-0 pt-4 bg-background">
              <label className="flex items-center gap-2 text-sm mb-2">
                <input
                  type="checkbox"
                  checked={isInternalNote}
                  onChange={(e) => setIsInternalNote(e.target.checked)}
                />
                Internal note
              </label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                rows={3}
                className="w-full rounded-lg p-3 resize-none bg-glass border border-theme text-text-primary"
              />
              <button
                onClick={sendReply}
                disabled={!replyText.trim() || replySending}
                className="w-full mt-2 px-4 py-3 rounded-lg font-medium text-white disabled:opacity-50 bg-primary"
              >
                {replySending
                  ? 'Sending...'
                  : selectedTicket.source === 'external' && !isInternalNote
                    ? 'Open Email to Reply'
                    : 'Send Reply'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
