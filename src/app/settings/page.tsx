// /src/app/settings/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Eye, EyeOff, Trash2, Key, User, LogOut, CheckCircle, AlertTriangle, CreditCard, Zap } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Subscription State
  const [subscriptionTier, setSubscriptionTier] = useState('free');
  const [dailyLimit, setDailyLimit] = useState(5);
  const [usageToday, setUsageToday] = useState(0);
  const [subscriptionStatus, setSubscriptionStatus] = useState('inactive');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  
  // Delete Account State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    getUser();
  }, []);

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUser(user);

    // Get subscription info
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_tier, daily_message_limit, subscription_status')
      .eq('id', user.id)
      .single();

    if (profile) {
      setSubscriptionTier(profile.subscription_tier || 'free');
      setDailyLimit(profile.daily_message_limit || 5);
      setSubscriptionStatus(profile.subscription_status || 'inactive');
    }

    // Get today's usage
    const { data: usage } = await supabase
      .from('daily_usage')
      .select('message_count')
      .eq('user_id', user.id)
      .eq('usage_date', new Date().toISOString().split('T')[0])
      .single();

    if (usage) {
      setUsageToday(usage.message_count || 0);
    }

    setLoading(false);
  };

  const handleUpgrade = async (tier: 'basic' | 'pro' | 'executive') => {
    setCheckoutLoading(true);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Failed to create checkout session');
        setCheckoutLoading(false);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout');
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setCheckoutLoading(true);

    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Failed to open customer portal');
        setCheckoutLoading(false);
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert('Failed to open customer portal');
      setCheckoutLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    // Validation
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setPasswordError(error.message);
      setPasswordLoading(false);
    } else {
      setPasswordSuccess(true);
      setPasswordLoading(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Hide success message after 3 seconds
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm');
      return;
    }

    setDeleteLoading(true);
    setDeleteError('');

    // Delete user's data from your database first (conversations, etc.)
    // Then delete the auth user
    
    const { error } = await supabase.rpc('delete_user_and_data');
    
    if (error) {
      // If RPC doesn't exist, just sign out (you'll need to create this function in Supabase)
      setDeleteError('Account deletion not fully configured. Please contact support.');
      setDeleteLoading(false);
    } else {
      // Sign out and redirect
      await supabase.auth.signOut();
      router.push('/');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="space-y-3">
            <Link
              href="/"
              className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Chat
            </Link>
            <h1 className="text-3xl font-bold text-slate-900">Account Settings</h1>
          </div>
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="border-slate-300 hover:bg-slate-100 mt-0 sm:mt-8"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Account Info Card */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription className="text-slate-600">Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <p className="text-base text-slate-900 mt-1">{user?.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Account Created</label>
              <p className="text-base text-slate-900 mt-1">
                {new Date(user?.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            {user?.app_metadata?.provider && (
              <div>
                <label className="text-sm font-medium text-slate-700">Sign In Method</label>
                <p className="text-base text-slate-900 mt-1 capitalize">
                  {user.app_metadata.provider === 'email' ? 'Email & Password' : user.app_metadata.provider}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription Card */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <CreditCard className="h-5 w-5" />
              Subscription & Usage
            </CardTitle>
            <CardDescription className="text-slate-600">
              Manage your subscription plan and view usage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Plan */}
            <div>
              <label className="text-sm font-medium text-slate-700">Current Plan</label>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-2xl font-bold text-blue-900 capitalize">
                  {subscriptionTier}
                </span>
                {subscriptionTier !== 'free' && (
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' :
                    subscriptionStatus === 'past_due' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {subscriptionStatus}
                  </span>
                )}
              </div>
            </div>

            {/* Usage Stats */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-slate-700">Daily Messages</label>
                <span className="text-sm text-slate-600">
                  {usageToday} / {dailyLimit} used today
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    (usageToday / dailyLimit) * 100 >= 90 ? 'bg-red-500' :
                    (usageToday / dailyLimit) * 100 >= 70 ? 'bg-yellow-500' :
                    'bg-blue-900'
                  }`}
                  style={{ width: `${Math.min((usageToday / dailyLimit) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Pricing Plans */}
            {subscriptionTier === 'free' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Upgrade Your Plan</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Basic */}
                  <div className="border border-slate-200 rounded-lg p-4 space-y-2 hover:border-blue-900 transition-all">
                    <div className="font-bold text-slate-900">Basic</div>
                    <div className="text-2xl font-bold text-blue-900">$20<span className="text-sm text-slate-600">/mo</span></div>
                    <div className="text-sm text-slate-600">30 messages/day</div>
                    <Button
                      onClick={() => handleUpgrade('basic')}
                      disabled={checkoutLoading}
                      className="w-full bg-blue-900 hover:bg-blue-950 text-white rounded-lg"
                      size="sm"
                    >
                      {checkoutLoading ? 'Loading...' : 'Upgrade'}
                    </Button>
                  </div>

                  {/* Pro */}
                  <div className="border-2 border-blue-900 rounded-lg p-4 space-y-2 relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-900 text-white px-3 py-1 rounded-full text-xs font-semibold">
                      Popular
                    </div>
                    <div className="font-bold text-slate-900">Pro</div>
                    <div className="text-2xl font-bold text-blue-900">$60<span className="text-sm text-slate-600">/mo</span></div>
                    <div className="text-sm text-slate-600">100 messages/day</div>
                    <Button
                      onClick={() => handleUpgrade('pro')}
                      disabled={checkoutLoading}
                      className="w-full bg-blue-900 hover:bg-blue-950 text-white rounded-lg"
                      size="sm"
                    >
                      {checkoutLoading ? 'Loading...' : 'Upgrade'}
                    </Button>
                  </div>

                  {/* Executive */}
                  <div className="border border-slate-200 rounded-lg p-4 space-y-2 hover:border-blue-900 transition-all">
                    <div className="font-bold text-slate-900 flex items-center gap-1">
                      Executive <Zap className="h-4 w-4 text-yellow-500" />
                    </div>
                    <div className="text-2xl font-bold text-blue-900">$99<span className="text-sm text-slate-600">/mo</span></div>
                    <div className="text-sm text-slate-600">200 messages/day</div>
                    <Button
                      onClick={() => handleUpgrade('executive')}
                      disabled={checkoutLoading}
                      className="w-full bg-blue-900 hover:bg-blue-950 text-white rounded-lg"
                      size="sm"
                    >
                      {checkoutLoading ? 'Loading...' : 'Upgrade'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Manage Subscription */}
            {subscriptionTier !== 'free' && (
              <div>
                <Button
                  onClick={handleManageSubscription}
                  disabled={checkoutLoading}
                  variant="outline"
                  className="w-full border-slate-300 hover:bg-slate-100"
                >
                  {checkoutLoading ? 'Loading...' : 'Manage Subscription'}
                </Button>
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Update payment method, cancel subscription, or view billing history
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change Password Card */}
        {user?.app_metadata?.provider === 'email' && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Key className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription className="text-slate-600">Update your password to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                {/* New Password */}
                <div className="space-y-2">
                  <label htmlFor="newPassword" className="text-sm font-medium text-slate-900">
                    New Password
                  </label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="h-11 border-slate-300 focus:border-blue-900 rounded-lg pr-12"
                      disabled={passwordLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    >
                      {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-900">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="h-11 border-slate-300 focus:border-blue-900 rounded-lg pr-12"
                      disabled={passwordLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Password Strength */}
                {newPassword && (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      <div className={`h-1 flex-1 rounded ${newPassword.length >= 6 ? 'bg-green-500' : 'bg-slate-200'}`}></div>
                      <div className={`h-1 flex-1 rounded ${newPassword.length >= 8 ? 'bg-green-500' : 'bg-slate-200'}`}></div>
                      <div className={`h-1 flex-1 rounded ${newPassword.length >= 12 ? 'bg-green-500' : 'bg-slate-200'}`}></div>
                    </div>
                    <p className="text-xs text-slate-600">
                      {newPassword.length < 6 && 'Weak - At least 6 characters required'}
                      {newPassword.length >= 6 && newPassword.length < 8 && 'Fair - 8+ characters recommended'}
                      {newPassword.length >= 8 && newPassword.length < 12 && 'Good - Strong password'}
                      {newPassword.length >= 12 && 'Excellent - Very strong password'}
                    </p>
                  </div>
                )}

                {/* Success Message */}
                {passwordSuccess && (
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <p className="text-sm text-green-700">Password updated successfully!</p>
                  </div>
                )}

                {/* Error Message */}
                {passwordError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm text-red-600">{passwordError}</p>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={passwordLoading || !newPassword || !confirmPassword}
                  className="w-full bg-blue-900 hover:bg-blue-950 text-white rounded-lg font-medium transition-all"
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Danger Zone - Delete Account */}
        <Card className="border-red-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-slate-600">Permanently delete your account and all data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showDeleteConfirm ? (
              <div>
                <p className="text-sm text-slate-600 mb-4">
                  Once you delete your account, there is no going back. This action cannot be undone.
                  All your conversations and data will be permanently deleted.
                </p>
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-red-800 font-medium mb-2">⚠️ This action cannot be undone!</p>
                  <p className="text-sm text-red-700">
                    All your conversations, settings, and account data will be permanently deleted.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">
                    Type <span className="font-bold text-red-600">DELETE</span> to confirm
                  </label>
                  <Input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE"
                    className="h-11 border-slate-300 rounded-lg"
                    disabled={deleteLoading}
                  />
                </div>

                {deleteError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm text-red-600">{deleteError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                      setDeleteError('');
                    }}
                    variant="outline"
                    className="flex-1 border-slate-300"
                    disabled={deleteLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'DELETE' || deleteLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {deleteLoading ? 'Deleting...' : 'Permanently Delete Account'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}