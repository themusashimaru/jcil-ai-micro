'use client';

import { Ticket, Reply, STATUS_LABELS } from './types';

interface TicketDetailProps {
  selectedTicket: Ticket | null;
  detailLoading: boolean;
  replies: Reply[];
  replyText: string;
  isInternalNote: boolean;
  replySending: boolean;
  setReplyText: (text: string) => void;
  setIsInternalNote: (value: boolean) => void;
  updateTicket: (ticketId: string, updates: Partial<Ticket>) => void;
  sendReply: () => void;
}

export function TicketDetail({
  selectedTicket,
  detailLoading,
  replies,
  replyText,
  isInternalNote,
  replySending,
  setReplyText,
  setIsInternalNote,
  updateTicket,
  sendReply,
}: TicketDetailProps) {
  return (
    <div className="hidden lg:flex flex-1 rounded-xl overflow-hidden flex-col bg-glass border border-theme">
      {!selectedTicket ? (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          Select a ticket to view details
        </div>
      ) : detailLoading ? (
        <div className="flex-1 flex items-center justify-center text-text-muted">Loading...</div>
      ) : (
        <>
          {/* Header */}
          <div className="p-4 border-b border-theme">
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-lg font-semibold">{selectedTicket.subject}</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    updateTicket(selectedTicket.id, { is_starred: !selectedTicket.is_starred })
                  }
                  className={`p-2 rounded transition ${selectedTicket.is_starred ? 'text-yellow-500' : 'text-text-muted'}`}
                >
                  {selectedTicket.is_starred ? '*' : 'Star'}
                </button>
                <button
                  onClick={() => updateTicket(selectedTicket.id, { is_archived: true })}
                  className="p-2 rounded transition text-text-muted"
                >
                  Archive
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-text-secondary">
                From: {selectedTicket.sender_name || selectedTicket.sender_email}
                {selectedTicket.sender_name && (
                  <span className="text-text-muted"> ({selectedTicket.sender_email})</span>
                )}
              </span>
              <select
                value={selectedTicket.status}
                onChange={(e) => updateTicket(selectedTicket.id, { status: e.target.value })}
                className="rounded px-2 py-1 text-sm bg-glass border border-theme text-text-primary"
              >
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={selectedTicket.priority}
                onChange={(e) => updateTicket(selectedTicket.id, { priority: e.target.value })}
                className="rounded px-2 py-1 text-sm bg-glass border border-theme text-text-primary"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            {selectedTicket.user && (
              <div className="mt-2 p-2 rounded text-xs bg-primary-hover">
                <span className="text-text-secondary">User: </span>
                <span>{selectedTicket.user.full_name || selectedTicket.user.email}</span>
                <span className="text-text-muted"> ({selectedTicket.user.subscription_tier})</span>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Original Message */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2 text-sm text-text-secondary">
                <span>{selectedTicket.sender_name || selectedTicket.sender_email}</span>
                <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
              </div>
              <div className="whitespace-pre-wrap">{selectedTicket.message}</div>
            </div>

            {/* Replies */}
            {replies.map((reply) => (
              <div
                key={reply.id}
                className={`rounded-lg p-4 ${
                  reply.is_internal_note
                    ? 'bg-yellow-500/10 border border-yellow-500/20'
                    : 'bg-green-500/10 border border-green-500/20'
                }`}
              >
                <div className="flex justify-between items-center mb-2 text-sm text-text-secondary">
                  <span>
                    {reply.admin_email}
                    {reply.is_internal_note && (
                      <span className="ml-2 text-yellow-600">(Internal Note)</span>
                    )}
                  </span>
                  <span>{new Date(reply.created_at).toLocaleString()}</span>
                </div>
                <div className="whitespace-pre-wrap">{reply.message}</div>
              </div>
            ))}
          </div>

          {/* Reply Box */}
          <div className="p-4 border-t border-theme">
            <div className="flex items-center gap-2 mb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isInternalNote}
                  onChange={(e) => setIsInternalNote(e.target.checked)}
                  className="rounded"
                />
                Internal note (not visible to user)
              </label>
            </div>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={isInternalNote ? 'Add an internal note...' : 'Type your reply...'}
              rows={3}
              className="w-full rounded-lg p-3 resize-none focus:outline-none bg-glass border border-theme text-text-primary"
            />
            <div className="flex justify-between items-center mt-2">
              {selectedTicket.source === 'external' && !isInternalNote ? (
                <p className="text-xs text-text-muted">
                  Reply will open your email client with the message pre-filled
                </p>
              ) : (
                <p className="text-xs text-text-muted">
                  {isInternalNote
                    ? 'Note will be saved but not sent to user'
                    : 'Reply will be sent in-app'}
                </p>
              )}
              <button
                onClick={sendReply}
                disabled={!replyText.trim() || replySending}
                className="px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50 bg-primary"
              >
                {replySending
                  ? 'Sending...'
                  : selectedTicket.source === 'external' && !isInternalNote
                    ? 'Open Email'
                    : 'Send Reply'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
