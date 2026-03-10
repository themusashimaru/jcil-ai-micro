'use client';

import React, { useState } from 'react';

export interface InvitePanelProps {
  onInvite: (email: string) => void;
  sessionId: string;
}

export const InvitePanel = React.memo(function InvitePanel({
  onInvite,
  sessionId,
}: InvitePanelProps) {
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const inviteLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/code-lab/join/${sessionId}`;

  const handleInvite = () => {
    if (email.trim() && email.includes('@')) {
      onInvite(email.trim());
      setEmail('');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="invite-panel">
      <div className="invite-email">
        <input
          type="email"
          className="invite-input"
          placeholder="Enter email to invite..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
        />
        <button className="invite-btn" onClick={handleInvite}>
          Invite
        </button>
      </div>
      <div className="invite-link">
        <input type="text" className="link-input" value={inviteLink} readOnly />
        <button className="copy-btn" onClick={handleCopyLink}>
          {copied ? '\u2713 Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
});

export default InvitePanel;
