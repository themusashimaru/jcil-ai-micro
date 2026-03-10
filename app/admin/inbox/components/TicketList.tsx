'use client';

import { Ticket, CATEGORY_LABELS, STATUS_LABELS, PRIORITY_COLORS } from './types';

interface TicketListProps {
  tickets: Ticket[];
  selectedTicket: Ticket | null;
  loading: boolean;
  isAllFilter: boolean;
  currentFilter: string;
  currentCategory: string | null;
  currentStatus: string | null;
  currentSource: string | null;
  fetchTicketDetail: (ticketId: string) => void;
  formatDate: (dateStr: string) => string;
}

export function TicketList({
  tickets,
  selectedTicket,
  loading,
  isAllFilter,
  currentFilter,
  currentCategory,
  currentStatus,
  currentSource,
  fetchTicketDetail,
  formatDate,
}: TicketListProps) {
  return (
    <div className="flex-1 lg:w-1/3 rounded-xl overflow-hidden flex flex-col bg-glass border border-theme">
      <div className="p-4 border-b border-theme">
        <h2 className="font-semibold">
          {isAllFilter
            ? 'All Messages'
            : currentFilter === 'unread'
              ? 'Unread'
              : currentFilter === 'starred'
                ? 'Starred'
                : currentFilter === 'archived'
                  ? 'Archived'
                  : currentCategory
                    ? CATEGORY_LABELS[currentCategory]
                    : currentStatus
                      ? STATUS_LABELS[currentStatus]
                      : currentSource === 'internal'
                        ? 'Internal (Users)'
                        : 'External (Contact)'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-text-muted">Loading...</div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center text-text-muted">No tickets found</div>
        ) : (
          <div>
            {tickets.map((ticket, index) => (
              <button
                key={ticket.id}
                onClick={() => fetchTicketDetail(ticket.id)}
                className={`w-full p-4 text-left transition border-l-[3px] ${
                  selectedTicket?.id === ticket.id ? 'bg-primary-hover' : 'bg-transparent'
                } ${index < tickets.length - 1 ? 'border-b border-b-theme' : ''} ${
                  !ticket.is_read ? 'border-l-primary' : 'border-l-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {ticket.is_starred && <span className="text-yellow-500">*</span>}
                    <span
                      className={`font-medium truncate ${!ticket.is_read ? 'text-text-primary' : 'text-text-secondary'}`}
                    >
                      {ticket.sender_name || ticket.sender_email}
                    </span>
                  </div>
                  <span className="text-xs whitespace-nowrap text-text-muted">
                    {formatDate(ticket.created_at)}
                  </span>
                </div>
                <div
                  className={`text-sm truncate ${!ticket.is_read ? 'text-text-primary' : 'text-text-secondary'}`}
                >
                  {ticket.subject}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      ticket.source === 'internal'
                        ? 'bg-green-500/20 text-green-600'
                        : 'bg-purple-500/20 text-purple-600'
                    }`}
                  >
                    {ticket.source === 'internal' ? 'User' : 'Contact'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-glass text-text-secondary">
                    {CATEGORY_LABELS[ticket.category] || ticket.category}
                  </span>
                  <span className={`text-xs ${PRIORITY_COLORS[ticket.priority]}`}>
                    {ticket.priority !== 'normal' && ticket.priority}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
