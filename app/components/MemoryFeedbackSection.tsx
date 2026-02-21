'use client';

/**
 * MEMORY FEEDBACK SECTION
 *
 * Shows users what the AI has learned about them and allows:
 * - Viewing all stored memory (name, preferences, topics, goals)
 * - Deleting individual facts or topics
 * - Clearing all memory
 * - GDPR data export
 */

import { useState, useEffect, useCallback } from 'react';

interface UserPreferences {
  name?: string;
  preferred_name?: string;
  occupation?: string;
  location?: string;
  communication_style?: string;
  interests?: string[];
  faith_context?: string;
  family_members?: Array<{ relation: string; name?: string; notes?: string }>;
  goals?: string[];
  important_dates?: Array<{ label: string; date?: string }>;
  interaction_preferences?: string[];
  custom?: Record<string, string>;
}

interface UserMemory {
  id: string;
  summary: string;
  key_topics: string[];
  topic_timestamps?: Record<string, string>;
  preferences: UserPreferences;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: string }> = {
  name: { label: 'Name', icon: '👤' },
  preferred_name: { label: 'Preferred Name', icon: '💬' },
  occupation: { label: 'Occupation', icon: '💼' },
  location: { label: 'Location', icon: '📍' },
  communication_style: { label: 'Communication Style', icon: '🗣️' },
  faith_context: { label: 'Faith Context', icon: '🙏' },
};

export default function MemoryFeedbackSection() {
  const [memory, setMemory] = useState<UserMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deletingTopic, setDeletingTopic] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchMemory = useCallback(async () => {
    try {
      const response = await fetch('/api/memory');
      if (response.ok) {
        const data = await response.json();
        setMemory(data.memory || null);
      }
    } catch (err) {
      console.error('Failed to fetch memory:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemory();
  }, [fetchMemory]);

  const deletePreferenceKey = async (key: string) => {
    setDeletingKey(key);
    try {
      // Update preferences by removing the key
      const updated = { ...memory?.preferences };
      delete (updated as Record<string, unknown>)[key];

      const response = await fetch('/api/memory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `Removed "${CATEGORY_CONFIG[key]?.label || key}"` });
        await fetchMemory();
      } else {
        setMessage({ type: 'error', text: 'Failed to update memory' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update memory' });
    } finally {
      setDeletingKey(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const deleteTopic = async (topic: string) => {
    setDeletingTopic(topic);
    try {
      // Remove topic from key_topics array
      const updatedTopics = memory?.key_topics.filter((t) => t !== topic) || [];
      const updatedTimestamps = { ...memory?.topic_timestamps };
      delete updatedTimestamps[topic];

      const response = await fetch('/api/memory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...memory?.preferences,
          _topics: updatedTopics,
          _topic_timestamps: updatedTimestamps,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `Removed topic "${topic}"` });
        await fetchMemory();
      } else {
        setMessage({ type: 'error', text: 'Failed to remove topic' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove topic' });
    } finally {
      setDeletingTopic(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const clearAllMemory = async () => {
    if (!confirm('Are you sure you want to clear all memory? This cannot be undone.')) return;

    setClearing(true);
    try {
      const response = await fetch('/api/memory', { method: 'DELETE' });
      if (response.ok) {
        setMemory(null);
        setMessage({ type: 'success', text: 'All memory cleared successfully' });
      } else {
        setMessage({ type: 'error', text: 'Failed to clear memory' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to clear memory' });
    } finally {
      setClearing(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const exportMemory = async () => {
    try {
      const response = await fetch('/api/memory?export=true');
      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `memory-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: 'Memory exported' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Export failed' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <section className="glass-morphism rounded-2xl p-4 sm:p-6">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          AI Memory
        </h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg animate-pulse"
              style={{ backgroundColor: 'var(--glass-bg)' }}
            />
          ))}
        </div>
      </section>
    );
  }

  const prefs = memory?.preferences;
  const hasProfile = prefs && Object.keys(prefs).some((k) => (prefs as Record<string, unknown>)[k]);

  return (
    <section className="glass-morphism rounded-2xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          AI Memory
        </h2>
        <div className="flex gap-2">
          {memory && (
            <>
              <button
                onClick={exportMemory}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                style={{
                  backgroundColor: 'var(--glass-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                Export
              </button>
              <button
                onClick={clearAllMemory}
                disabled={clearing}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                style={{ border: '1px solid rgba(239,68,68,0.3)' }}
              >
                {clearing ? 'Clearing...' : 'Clear All'}
              </button>
            </>
          )}
        </div>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        What the AI has learned about you from conversations. Remove anything incorrect.
      </p>

      {/* Status message */}
      {message && (
        <div
          className={`mb-4 px-3 py-2 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {message.text}
        </div>
      )}

      {!memory ? (
        <div
          className="text-center py-8 rounded-xl"
          style={{ backgroundColor: 'var(--glass-bg)', color: 'var(--text-muted)' }}
        >
          <p className="text-sm">No memory yet. The AI will learn about you as you chat.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Profile Facts */}
          {hasProfile && (
            <div>
              <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Profile
              </h3>
              <div className="space-y-1.5">
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                  const value = (prefs as Record<string, unknown>)?.[key];
                  if (!value) return null;

                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between px-3 py-2 rounded-lg group"
                      style={{ backgroundColor: 'var(--glass-bg)' }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span aria-hidden="true">{config.icon}</span>
                        <span
                          className="text-xs font-medium"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {config.label}:
                        </span>
                        <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                          {String(value)}
                        </span>
                      </div>
                      <button
                        onClick={() => deletePreferenceKey(key)}
                        disabled={deletingKey === key}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 transition-all"
                        aria-label={`Remove ${config.label}`}
                      >
                        <svg
                          className="h-3.5 w-3.5 text-red-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  );
                })}

                {/* Interests */}
                {prefs?.interests && prefs.interests.length > 0 && (
                  <div
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--glass-bg)' }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span aria-hidden="true">🎯</span>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Interests
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {prefs.interests.map((interest) => (
                        <span
                          key={interest}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                          style={{
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            opacity: 0.8,
                          }}
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Goals */}
                {prefs?.goals && prefs.goals.length > 0 && (
                  <div
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--glass-bg)' }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span aria-hidden="true">🎯</span>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Goals
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {prefs.goals.map((goal, i) => (
                        <li
                          key={i}
                          className="text-sm flex items-start gap-2"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            •
                          </span>
                          {goal}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Family Members */}
                {prefs?.family_members && prefs.family_members.length > 0 && (
                  <div
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--glass-bg)' }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span aria-hidden="true">👨‍👩‍👧‍👦</span>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Family
                      </span>
                    </div>
                    <div className="space-y-1">
                      {prefs.family_members.map((member, i) => (
                        <div key={i} className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          <span className="capitalize">{member.relation}</span>
                          {member.name && (
                            <span style={{ color: 'var(--text-muted)' }}> — {member.name}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Topics */}
          {memory.key_topics && memory.key_topics.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Topics Discussed ({memory.key_topics.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {memory.key_topics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs group cursor-default"
                    style={{
                      backgroundColor: 'var(--glass-bg)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {topic}
                    <button
                      onClick={() => deleteTopic(topic)}
                      disabled={deletingTopic === topic}
                      className="opacity-0 group-hover:opacity-100 ml-0.5 p-0.5 rounded-full hover:bg-red-500/20 transition-opacity"
                      aria-label={`Remove topic "${topic}"`}
                    >
                      <svg
                        className="h-2.5 w-2.5 text-red-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Last Updated */}
          <div className="text-xs pt-2" style={{ color: 'var(--text-muted)' }}>
            Last updated:{' '}
            {new Date(memory.updated_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      )}
    </section>
  );
}
