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
import { useRouter } from 'next/navigation';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { profile, updateProfile } = useUserProfile();
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
      console.log('[ProfileModal] Calling logout API...');
      // Call the API route to handle logout with proper cookie management
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      console.log('[ProfileModal] Logout successful, redirecting...');
      // Force a hard redirect to clear all state
      window.location.href = '/login';
    } catch (error) {
      console.error('[ProfileModal] Logout error:', error);
      setIsLoggingOut(false);
      alert('Failed to logout. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">User Profile</h2>
            <p className="text-sm text-gray-400 mt-1">
              Personalize your AI experience
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white transition"
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
            <label className="block text-sm font-medium text-gray-300">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter your name"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none"
            />
            <p className="text-xs text-gray-500">
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
                <div className="w-11 h-6 bg-white/10 rounded-full peer-checked:bg-blue-500 transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-300 group-hover:text-white transition">
                  I&apos;m a Student
                </span>
                <p className="text-xs text-gray-500">
                  Enable student-focused assistance
                </p>
              </div>
            </label>
          </div>

          {/* Job Title / Field of Study */}
          {!formData.isStudent && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Job Title / Profession
              </label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                placeholder="e.g., Software Engineer, Pastor, Teacher"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none"
              />
            </div>
          )}

          {formData.isStudent && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Field of Study
              </label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                placeholder="e.g., Computer Science, Theology, Business"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none"
              />
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
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
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none resize-none"
            />
            <p className="text-xs text-gray-500">
              This helps the AI tailor responses to your specific needs and context
            </p>
          </div>

          {/* Email Signature */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              Email Signature (Optional)
            </label>
            <textarea
              value={formData.emailSignature || ''}
              onChange={(e) => setFormData({ ...formData, emailSignature: e.target.value })}
              placeholder="Best regards,&#10;John Smith&#10;**Software Engineer**&#10;*Company Name*&#10;(555) 123-4567"
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none resize-none"
            />
            <p className="text-xs text-gray-500">
              Use **text** for bold and *text* for italic. Example: **John Smith** makes &quot;John Smith&quot; bold.
            </p>

            {/* Signature Color Picker */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-300">Signature Color:</label>
              <input
                type="color"
                value={formData.signatureColor || '#FFFFFF'}
                onChange={(e) => setFormData({ ...formData, signatureColor: e.target.value })}
                className="w-12 h-10 rounded border border-white/10 bg-transparent cursor-pointer"
              />
              <span className="text-xs text-gray-500">{formData.signatureColor || '#FFFFFF'}</span>
            </div>

            {/* Signature Preview */}
            {formData.emailSignature && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold text-gray-400 mb-2">PREVIEW</p>
                <div
                  className="whitespace-pre-wrap text-sm"
                  style={{ color: formData.signatureColor || '#FFFFFF' }}
                  dangerouslySetInnerHTML={{
                    __html: formData.emailSignature
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                      .replace(/\n/g, '<br/>'),
                  }}
                />
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
            <div className="flex gap-3">
              <svg
                className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5"
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
              <div className="text-xs text-blue-200">
                <p className="font-medium mb-1">Why we need this information:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Personalize AI responses to your background and goals</li>
                  <li>Adjust complexity and terminology to your level</li>
                  <li>Provide relevant examples from your field</li>
                  <li>Better understand your use cases and preferences</li>
                </ul>
                <p className="mt-2 text-blue-300">
                  Your data is stored locally and never shared.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4 bg-white/5">
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
              className="rounded-xl px-6 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!formData.name.trim() || isSaving}
              className="rounded-xl bg-blue-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
