'use client';

import { useState, useEffect, useCallback } from 'react';

type ResponseTone = 'concise' | 'balanced' | 'detailed';
type DocumentTheme = 'corporate_blue' | 'modern_dark' | 'warm_earth' | 'clean_minimal' | 'bold_red';

interface UserPreferences {
  response_tone: ResponseTone;
  document_theme: DocumentTheme;
  custom_instructions: string;
}

const TONE_OPTIONS: { value: ResponseTone; label: string; description: string }[] = [
  { value: 'concise', label: 'Concise', description: 'Short, direct answers. No fluff.' },
  { value: 'balanced', label: 'Balanced', description: 'Clear explanations with context.' },
  { value: 'detailed', label: 'Detailed', description: 'Thorough answers with examples.' },
];

const THEME_OPTIONS: { value: DocumentTheme; label: string; colors: string }[] = [
  { value: 'corporate_blue', label: 'Corporate Blue', colors: '#1e3a5f / #4472c4' },
  { value: 'modern_dark', label: 'Modern Dark', colors: '#2d2d2d / #00b4d8' },
  { value: 'warm_earth', label: 'Warm Earth', colors: '#5c3d2e / #d4a373' },
  { value: 'clean_minimal', label: 'Clean Minimal', colors: '#4a4a4a / #22c55e' },
  { value: 'bold_red', label: 'Bold Red', colors: '#b91c1c / #d97706' },
];

export default function PreferencesSection() {
  const [preferences, setPreferences] = useState<UserPreferences>({
    response_tone: 'balanced',
    document_theme: 'corporate_blue',
    custom_instructions: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load preferences from API
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/user/settings');
        if (res.ok) {
          const data = await res.json();
          const settings = data.settings || {};
          const prefs = settings.preferences || {};
          setPreferences({
            response_tone: prefs.response_tone || 'balanced',
            document_theme: prefs.document_theme || 'corporate_blue',
            custom_instructions: settings.custom_instructions || '',
          });
        }
      } catch {
        // Ignore — use defaults
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const save = useCallback(async (newPrefs: UserPreferences) => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: {
            response_tone: newPrefs.response_tone,
            document_theme: newPrefs.document_theme,
          },
          custom_instructions: newPrefs.custom_instructions || null,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Ignore
    } finally {
      setSaving(false);
    }
  }, []);

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    save(updated);
  };

  if (loading) {
    return (
      <section className="glass-morphism rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 rounded bg-glass" />
          <div className="h-4 w-full rounded bg-glass opacity-60" />
          <div className="h-32 rounded bg-glass opacity-30" />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Response Tone */}
      <div className="glass-morphism rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-1">Response Tone</h3>
        <p className="text-sm text-text-secondary mb-4">How should the AI respond to you?</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TONE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updatePreference('response_tone', opt.value)}
              className={`rounded-xl border-2 p-4 text-left transition ${
                preferences.response_tone === opt.value
                  ? 'border-primary bg-primary/10'
                  : 'border-theme hover:border-primary/50'
              }`}
            >
              <div className="font-medium text-text-primary">{opt.label}</div>
              <div className="text-xs text-text-secondary mt-1">{opt.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Document Theme */}
      <div className="glass-morphism rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-1">Default Document Theme</h3>
        <p className="text-sm text-text-secondary mb-4">
          Color scheme for generated PDFs, DOCX, XLSX, and PPTX files.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {THEME_OPTIONS.map((opt) => {
            const [primary, accent] = opt.colors.split(' / ');
            return (
              <button
                key={opt.value}
                onClick={() => updatePreference('document_theme', opt.value)}
                className={`rounded-xl border-2 p-4 text-left transition flex items-center gap-3 ${
                  preferences.document_theme === opt.value
                    ? 'border-primary bg-primary/10'
                    : 'border-theme hover:border-primary/50'
                }`}
              >
                <div className="flex gap-1.5 shrink-0">
                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: primary }} />
                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: accent }} />
                </div>
                <div className="font-medium text-text-primary text-sm">{opt.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Instructions */}
      <div className="glass-morphism rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-1">Custom Instructions</h3>
        <p className="text-sm text-text-secondary mb-4">
          Tell the AI about yourself. This context is included in every conversation.
        </p>
        <textarea
          value={preferences.custom_instructions}
          onChange={(e) =>
            setPreferences((prev) => ({ ...prev, custom_instructions: e.target.value }))
          }
          onBlur={() => save(preferences)}
          placeholder="e.g., I'm a software engineer who prefers TypeScript examples. Keep responses practical."
          rows={4}
          maxLength={2000}
          className="w-full rounded-xl border border-theme bg-surface p-4 text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <div className="flex justify-between mt-2 text-xs text-text-muted">
          <span>{preferences.custom_instructions.length}/2000</span>
          {saving && <span>Saving...</span>}
          {saved && <span className="text-green-500">Saved</span>}
        </div>
      </div>
    </section>
  );
}
