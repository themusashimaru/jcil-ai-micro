export interface Ticket {
  id: string;
  source: 'internal' | 'external';
  user_id: string | null;
  sender_email: string;
  sender_name: string | null;
  category: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    full_name: string | null;
    subscription_tier: string;
  };
}

export interface Reply {
  id: string;
  admin_email: string;
  message: string;
  is_internal_note: boolean;
  delivery_method: string | null;
  created_at: string;
}

export interface Counts {
  all: number;
  unread: number;
  starred: number;
  archived: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  bySource: { internal: number; external: number };
}

export const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  technical_support: 'Support',
  bug_report: 'Bug Report',
  feature_request: 'Feature Request',
  billing: 'Billing',
  content_moderation: 'Moderation',
  account_issue: 'Account',
  partnership: 'Partnership',
  feedback: 'Feedback',
  other: 'Other',
};

export const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  awaiting_reply: 'Awaiting Reply',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-500',
  normal: 'text-blue-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
};
