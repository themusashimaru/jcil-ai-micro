/**
 * USER PROFILE MODAL
 *
 * PURPOSE:
 * - Allow users to create/edit their profile
 * - Collect name, job title, student status, and description
 * - Enable personalized AI responses
 */

'use client';

import { useState, useEffect } from 'react';
import { useUserProfile, type UserProfile } from '@/contexts/UserProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import PasskeySettings from '@/components/auth/PasskeySettings';
import DOMPurify from 'dompurify';
import { logger } from '@/lib/logger';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const log = logger('UserProfileModal');

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { profile, updateProfile } = useUserProfile();
  const { theme } = useTheme();
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Theme-aware default signature color
  const defaultSignatureColor = theme === 'light' ? '#1e3a5f' : '#FFFFFF';

  // Update form when profile changes
  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  const handleSave = () => {
    setIsSaving(true);
    updateProfile(formData);
    setTimeout(() => {
      setIsSaving(false);
      onClose();
    }, 300);
  };

  const handleCancel = () => {
    setFormData(profile);
    onClose();
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      log.info('Calling logout API...');
      // Call the API route to handle logout with proper cookie management
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      log.info('Logout successful, redirecting...');
      // Force a hard redirect to clear all state
      window.location.href = '/login';
    } catch (error) {
      log.error('Logout error:', error instanceof Error ? error : { error });
      setIsLoggingOut(false);
      alert('Failed to logout. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl"
        style={{
          backgroundColor: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              User Profile
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Personalize your AI experience
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="rounded-lg p-2 transition hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter your name"
              className="w-full rounded-xl px-4 py-3 focus:outline-none"
              style={{
                backgroundColor: 'var(--glass-bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              This helps the AI address you personally
            </p>
          </div>

          {/* Student Toggle */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={formData.isStudent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isStudent: e.target.checked,
                      jobTitle: e.target.checked ? '' : formData.jobTitle,
                    })
                  }
                  className="sr-only peer"
                />
                <div
                  className="w-11 h-6 rounded-full transition-colors"
                  style={{
                    backgroundColor: formData.isStudent ? 'var(--primary)' : 'var(--glass-bg)',
                  }}
                ></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
              <div>
                <span
                  className="text-sm font-medium transition"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  I&apos;m a Student
                </span>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Enable student-focused assistance
                </p>
              </div>
            </label>
          </div>

          {/* Job Title / Field of Study */}
          {!formData.isStudent && (
            <div className="space-y-2">
              <label
                className="block text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Job Title / Profession
              </label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                placeholder="e.g., Software Engineer, Pastor, Teacher"
                className="w-full rounded-xl px-4 py-3 focus:outline-none"
                style={{
                  backgroundColor: 'var(--glass-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          )}

          {formData.isStudent && (
            <div className="space-y-2">
              <label
                className="block text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Field of Study
              </label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                placeholder="e.g., Computer Science, Theology, Business"
                className="w-full rounded-xl px-4 py-3 focus:outline-none"
                style={{
                  backgroundColor: 'var(--glass-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              How will you use JCIL.ai?
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={
                formData.isStudent
                  ? 'e.g., Research papers, study assistance, exam prep, project help...'
                  : 'e.g., Writing emails, research, content creation, problem-solving...'
              }
              rows={4}
              className="w-full rounded-xl px-4 py-3 focus:outline-none resize-none"
              style={{
                backgroundColor: 'var(--glass-bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              This helps the AI tailor responses to your specific needs and context
            </p>
          </div>

          {/* Email Signature */}
          <div className="space-y-3">
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Email Signature (Optional)
            </label>
            <textarea
              value={formData.emailSignature || ''}
              onChange={(e) => setFormData({ ...formData, emailSignature: e.target.value })}
              placeholder="Best regards,&#10;John Smith&#10;**Software Engineer**&#10;*Company Name*&#10;(555) 123-4567"
              rows={4}
              className="w-full rounded-xl px-4 py-3 focus:outline-none resize-none"
              style={{
                backgroundColor: 'var(--glass-bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Use **text** for bold and *text* for italic. Example: **John Smith** makes &quot;John
              Smith&quot; bold.
            </p>

            {/* Signature Color Picker */}
            <div className="flex items-center gap-3">
              <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Signature Color:
              </label>
              <input
                type="color"
                value={formData.signatureColor || defaultSignatureColor}
                onChange={(e) => setFormData({ ...formData, signatureColor: e.target.value })}
                className="w-12 h-10 rounded cursor-pointer"
                style={{ border: '1px solid var(--border)', backgroundColor: 'transparent' }}
              />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {formData.signatureColor || defaultSignatureColor}
              </span>
            </div>

            {/* Signature Preview */}
            {formData.emailSignature && (
              <div
                className="rounded-xl p-3"
                style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border)' }}
              >
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                  PREVIEW
                </p>
                <div
                  className="whitespace-pre-wrap text-sm"
                  style={{ color: formData.signatureColor || defaultSignatureColor }}
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(
                      formData.emailSignature
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/\n/g, '<br/>')
                    ),
                  }}
                />
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border)' }} />

          {/* Passkey / Biometric Login Settings */}
          <div className="space-y-3">
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Security Settings
            </label>
            <PasskeySettings />
          </div>

          {/* Info Box */}
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: 'var(--primary-hover)',
              border: '1px solid var(--primary)',
            }}
          >
            <div className="flex gap-3">
              <svg
                className="h-5 w-5 flex-shrink-0 mt-0.5"
                style={{ color: 'var(--primary)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  Why we need this information:
                </p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Personalize AI responses to your background and goals</li>
                  <li>Adjust complexity and terminology to your level</li>
                  <li>Provide relevant examples from your field</li>
                  <li>Better understand your use cases and preferences</li>
                </ul>
                <p className="mt-2" style={{ color: 'var(--primary)' }}>
                  Your data is stored locally and never shared.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{
            borderTop: '1px solid var(--border)',
            backgroundColor: 'var(--glass-bg)',
          }}
        >
          {/* Logout button on the left */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-xl px-6 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>

          {/* Save/Cancel buttons on the right */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="rounded-xl px-6 py-2.5 text-sm font-medium transition hover:opacity-70"
              style={{ color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!formData.name.trim() || isSaving}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
