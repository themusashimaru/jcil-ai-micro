/**
 * ACCOUNT SECTION COMPONENT
 *
 * PURPOSE:
 * - Display current email
 * - Allow users to change email
 * - Allow users to change password
 * - Handle email confirmation flow
 */

'use client';

import { useState, useEffect } from 'react';
import { getUser, updateEmail, updatePassword } from '@/lib/supabase/auth';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

export default function AccountSection() {
  const [currentEmail, setCurrentEmail] = useState('');
  const [loading, setLoading] = useState(true);

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    fetchUserEmail();
  }, []);

  const fetchUserEmail = async () => {
    try {
      setLoading(true);
      const user = await getUser();
      if (user?.email) {
        setCurrentEmail(user.email);
      }
    } catch (err) {
      console.error('[Account] Error fetching user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess(false);

    // Validation
    if (!newEmail) {
      setEmailError('Please enter a new email address');
      return;
    }

    if (newEmail === currentEmail) {
      setEmailError('New email must be different from current email');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    try {
      setEmailLoading(true);
      await updateEmail(newEmail);
      setEmailSuccess(true);
      setNewEmail('');

      // Success persists, user can see the message
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to update email');
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    // Validation
    if (!newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      setPasswordLoading(true);
      await updatePassword(newPassword);
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');

      // Clear success message after 5 seconds
      setTimeout(() => {
        setPasswordSuccess(false);
      }, 5000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Email Display */}
      <div className="glass-morphism rounded-2xl p-6">
        <h3 className="text-xl font-semibold mb-4">Account Information</h3>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Current Email
          </label>
          <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-300">
            {currentEmail}
          </div>
        </div>
      </div>

      {/* Change Email Section */}
      <div className="glass-morphism rounded-2xl p-6">
        <h3 className="text-xl font-semibold mb-2">Change Email</h3>
        <p className="text-sm text-gray-400 mb-4">
          You&apos;ll receive confirmation emails at both your current and new email addresses.
        </p>

        {emailSuccess && (
          <div className="mb-4 rounded-xl bg-green-900/20 border border-green-500 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="h-6 w-6 text-green-400 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h4 className="font-semibold text-green-400">Confirmation Sent!</h4>
                <p className="text-sm text-green-200 mt-1">
                  Please check both email addresses and click the confirmation links to complete the change.
                </p>
              </div>
            </div>
          </div>
        )}

        {emailError && (
          <div className="mb-4 rounded-xl bg-red-900/20 border border-red-500 p-4 text-red-400">
            {emailError}
          </div>
        )}

        <form onSubmit={handleEmailChange} className="space-y-4">
          <div>
            <label htmlFor="newEmail" className="block text-sm font-medium text-gray-300 mb-2">
              New Email Address
            </label>
            <input
              id="newEmail"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
              disabled={emailLoading}
              required
            />
          </div>

          <button
            type="submit"
            disabled={emailLoading}
            className="w-full rounded-lg bg-blue-500 px-4 py-3 font-semibold hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {emailLoading ? 'Sending Confirmation...' : 'Change Email'}
          </button>
        </form>
      </div>

      {/* Change Password Section */}
      <div className="glass-morphism rounded-2xl p-6">
        <h3 className="text-xl font-semibold mb-2">Change Password</h3>
        <p className="text-sm text-gray-400 mb-4">
          Enter a new password to update your account security.
        </p>

        {passwordSuccess && (
          <div className="mb-4 rounded-xl bg-green-900/20 border border-green-500 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="h-6 w-6 text-green-400 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h4 className="font-semibold text-green-400">Password Updated!</h4>
                <p className="text-sm text-green-200 mt-1">
                  Your password has been successfully changed.
                </p>
              </div>
            </div>
          </div>
        )}

        {passwordError && (
          <div className="mb-4 rounded-xl bg-red-900/20 border border-red-500 p-4 text-red-400">
            {passwordError}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-2">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
              disabled={passwordLoading}
              required
              minLength={8}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
              disabled={passwordLoading}
              required
              minLength={8}
            />
          </div>

          {/* Password Strength Indicator */}
          {(newPassword || confirmPassword) && (
            <div className="-mt-2">
              <PasswordStrengthIndicator
                password={newPassword}
                confirmPassword={confirmPassword}
                showMatchStatus={true}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={passwordLoading}
            className="w-full rounded-lg bg-blue-500 px-4 py-3 font-semibold hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {passwordLoading ? 'Updating...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
