'use client';

import React, { useState, useMemo } from 'react';
import type { CodeAnnotation, CollabUser } from './CodeLabCollaboration';
import { UserAvatar } from './CodeLabCollabUserAvatar';

export interface AnnotationsPanelProps {
  annotations: CodeAnnotation[];
  currentUser: CollabUser;
  onResolve: (id: string) => void;
  onReply: (id: string, content: string) => void;
}

export const AnnotationsPanel = React.memo(function AnnotationsPanel({
  annotations,
  currentUser: _currentUser,
  onResolve,
  onReply,
}: AnnotationsPanelProps) {
  void _currentUser; // Reserved for future use
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  const filteredAnnotations = useMemo(() => {
    return annotations.filter((a) => {
      if (filter === 'open') return !a.resolved;
      if (filter === 'resolved') return a.resolved;
      return true;
    });
  }, [annotations, filter]);

  const handleReply = (id: string) => {
    if (replyContent.trim()) {
      onReply(id, replyContent.trim());
      setReplyContent('');
      setReplyingTo(null);
    }
  };

  return (
    <div className="annotations-panel">
      <div className="annotations-filter">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          All ({annotations.length})
        </button>
        <button className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>
          Open ({annotations.filter((a) => !a.resolved).length})
        </button>
        <button
          className={filter === 'resolved' ? 'active' : ''}
          onClick={() => setFilter('resolved')}
        >
          Resolved ({annotations.filter((a) => a.resolved).length})
        </button>
      </div>

      {filteredAnnotations.length === 0 ? (
        <div className="annotations-empty">No annotations</div>
      ) : (
        <div className="annotations-list">
          {filteredAnnotations.map((annotation) => (
            <div
              key={annotation.id}
              className={`annotation-card ${annotation.resolved ? 'resolved' : ''}`}
            >
              <div className="annotation-header">
                <UserAvatar user={annotation.user} size="sm" showStatus={false} />
                <div className="annotation-meta">
                  <span className="annotation-user">{annotation.user.name}</span>
                  <span className="annotation-location">
                    {annotation.file.split('/').pop()}:{annotation.line}
                  </span>
                </div>
                {!annotation.resolved && (
                  <button className="resolve-btn" onClick={() => onResolve(annotation.id)}>
                    \u2713 Resolve
                  </button>
                )}
              </div>
              <div className="annotation-content">{annotation.content}</div>

              {annotation.replies.length > 0 && (
                <div className="annotation-replies">
                  {annotation.replies.map((reply) => (
                    <div key={reply.id} className="reply">
                      <span className="reply-user" style={{ color: reply.user.color }}>
                        {reply.user.name}:
                      </span>
                      <span className="reply-content">{reply.content}</span>
                    </div>
                  ))}
                </div>
              )}

              {replyingTo === annotation.id ? (
                <div className="reply-input-row">
                  <input
                    type="text"
                    className="reply-input"
                    placeholder="Type your reply..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleReply(annotation.id)}
                    autoFocus
                  />
                  <button className="reply-send" onClick={() => handleReply(annotation.id)}>
                    Send
                  </button>
                  <button className="reply-cancel" onClick={() => setReplyingTo(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button className="add-reply-btn" onClick={() => setReplyingTo(annotation.id)}>
                  Reply
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default AnnotationsPanel;
