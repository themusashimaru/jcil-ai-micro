'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Shield, AlertTriangle, Activity, Lock, Zap, Globe,
  ArrowLeft, RefreshCw, Search, Clock, TrendingUp,
  Ban, CheckCircle, XCircle, AlertCircle, FileText
} from 'lucide-react';
import { Input } from '@/components/ui/input';

type TabType = 'dashboard' | 'events' | 'auth' | 'api' | 'injections' | 'ips';

interface SecurityStats {
  total_events: number;
  critical_events: number;
  high_events: number;
  failed_logins: number;
  rate_violations: number;
  prompt_injections: number;
  suspicious_ips: number;
  blocked_ips: number;
  events_today: number;
  events_this_week: number;
}

export default function SecurityDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Security Events state
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [eventSeverityFilter, setEventSeverityFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [eventSearchQuery, setEventSearchQuery] = useState('');

  // Failed Logins state
  const [failedLogins, setFailedLogins] = useState<any[]>([]);
  const [selectedLogin, setSelectedLogin] = useState<any>(null);

  // Prompt Injections state
  const [promptInjections, setPromptInjections] = useState<any[]>([]);
  const [selectedInjection, setSelectedInjection] = useState<any>(null);

  // Suspicious IPs state
  const [suspiciousIps, setSuspiciousIps] = useState<any[]>([]);
  const [selectedIp, setSelectedIp] = useState<any>(null);

  // Rate Violations state
  const [rateViolations, setRateViolations] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/security/stats');

      if (response.status === 403) {
        setError('Access denied - Admin privileges required');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch security stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load security stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSecurityEvents = async () => {
    try {
      const response = await fetch('/api/security/events');
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      setSecurityEvents(data.events || []);
      setFilteredEvents(data.events || []);
    } catch (err: any) {
      console.error('Failed to fetch security events:', err);
    }
  };

  const fetchFailedLogins = async () => {
    try {
      const response = await fetch('/api/security/failed-logins');
      if (!response.ok) throw new Error('Failed to fetch failed logins');
      const data = await response.json();
      setFailedLogins(data.logins || []);
    } catch (err: any) {
      console.error('Failed to fetch failed logins:', err);
    }
  };

  const fetchPromptInjections = async () => {
    try {
      const response = await fetch('/api/security/prompt-injections');
      if (!response.ok) throw new Error('Failed to fetch prompt injections');
      const data = await response.json();
      setPromptInjections(data.injections || []);
    } catch (err: any) {
      console.error('Failed to fetch prompt injections:', err);
    }
  };

  const fetchSuspiciousIps = async () => {
    try {
      const response = await fetch('/api/security/suspicious-ips');
      if (!response.ok) throw new Error('Failed to fetch suspicious IPs');
      const data = await response.json();
      setSuspiciousIps(data.ips || []);
    } catch (err: any) {
      console.error('Failed to fetch suspicious IPs:', err);
    }
  };

  const fetchRateViolations = async () => {
    try {
      const response = await fetch('/api/security/rate-violations');
      if (!response.ok) throw new Error('Failed to fetch rate violations');
      const data = await response.json();
      setRateViolations(data.violations || []);
    } catch (err: any) {
      console.error('Failed to fetch rate violations:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchSecurityEvents();
  }, []);

  useEffect(() => {
    if (activeTab === 'auth') {
      fetchFailedLogins();
    } else if (activeTab === 'injections') {
      fetchPromptInjections();
    } else if (activeTab === 'ips') {
      fetchSuspiciousIps();
    } else if (activeTab === 'api') {
      fetchRateViolations();
    }
  }, [activeTab]);

  // Filter security events
  useEffect(() => {
    let filtered = securityEvents;

    if (eventSeverityFilter !== 'all') {
      filtered = filtered.filter(e => e.severity === eventSeverityFilter);
    }

    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(e => e.event_type === eventTypeFilter);
    }

    if (eventSearchQuery.trim()) {
      const query = eventSearchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.description?.toLowerCase().includes(query) ||
        e.ip_address?.toLowerCase().includes(query) ||
        e.user_email?.toLowerCase().includes(query)
      );
    }

    setFilteredEvents(filtered);
  }, [eventSeverityFilter, eventTypeFilter, eventSearchQuery, securityEvents]);

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading Security Command Center...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Access Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">{error}</p>
            <Button onClick={() => router.push('/')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  const severityColors = {
    critical: 'from-red-500 to-red-600',
    high: 'from-orange-500 to-orange-600',
    medium: 'from-yellow-500 to-yellow-600',
    low: 'from-blue-500 to-blue-600',
    info: 'from-gray-500 to-gray-600',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-600 rounded-lg shadow-lg">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Security Command Center</h1>
                <p className="text-slate-300 mt-1">🛡️ JCIL.AI Cybersecurity Monitoring</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => router.push('/admin')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Admin Panel
              </Button>
              <Button
                onClick={() => router.push('/')}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Chat
              </Button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mt-6 border-b border-slate-700">
            <div className="flex space-x-8">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
                { id: 'events', label: 'Security Events', icon: Activity },
                { id: 'auth', label: 'Authentication', icon: Lock },
                { id: 'api', label: 'API Security', icon: Zap },
                { id: 'injections', label: 'Prompt Injections', icon: AlertTriangle },
                { id: 'ips', label: 'IP Intelligence', icon: Globe },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`
                      flex items-center gap-2 pb-3 px-1 border-b-2 font-medium text-sm transition-colors
                      ${isActive
                        ? 'border-red-500 text-red-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="border-l-4 border-l-red-600">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Total Events</CardTitle>
                  <Activity className="h-5 w-5 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{stats.total_events}</div>
                  <p className="text-xs text-slate-500 mt-1">
                    {stats.events_today} today
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-600">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Critical Threats</CardTitle>
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">{stats.critical_events}</div>
                  <p className="text-xs text-slate-500 mt-1">Require immediate attention</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-yellow-600">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Failed Logins</CardTitle>
                  <Lock className="h-5 w-5 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{stats.failed_logins}</div>
                  <p className="text-xs text-slate-500 mt-1">Authentication failures</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-600">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Blocked IPs</CardTitle>
                  <Ban className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{stats.blocked_ips}</div>
                  <p className="text-xs text-slate-500 mt-1">Out of {stats.suspicious_ips} suspicious</p>
                </CardContent>
              </Card>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-600" />
                    API Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Rate Violations:</span>
                      <span className="font-semibold text-slate-900">{stats.rate_violations}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    AI Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Prompt Injections:</span>
                      <span className="font-semibold text-slate-900">{stats.prompt_injections}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-600" />
                    Activity This Week
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Total Events:</span>
                      <span className="font-semibold text-slate-900">{stats.events_this_week}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* System Status */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-900">AI Moderation</span>
                    </div>
                    <span className="text-sm text-green-700">Active & Monitoring</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-900">Rate Limiting</span>
                    </div>
                    <span className="text-sm text-green-700">Active & Enforcing</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-900">Threat Detection</span>
                    </div>
                    <span className="text-sm text-green-700">Operational</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Security Events Tab */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-orange-900 mb-1">Security Events Log</h3>
                  <p className="text-sm text-orange-800">
                    All security incidents are logged here for review and analysis. Critical events require immediate attention.
                  </p>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900">All Security Events</CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  Showing {filteredEvents.length} of {securityEvents.length} total events
                </p>
              </CardHeader>
              <CardContent>
                {securityEvents.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-slate-600 mb-2">No security events recorded</p>
                    <p className="text-sm text-slate-500">Your system is secure!</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                    <p className="text-slate-600">Security events will appear here</p>
                    <p className="text-sm text-slate-500 mt-2">Run the SQL migration to start logging</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Authentication Tab */}
        {activeTab === 'auth' && (
          <div className="space-y-6">
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-yellow-900 mb-1">Authentication Monitoring</h3>
                  <p className="text-sm text-yellow-800">
                    Track failed login attempts, brute force attacks, and account takeover attempts.
                  </p>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900">Failed Login Attempts</CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  Showing {failedLogins.length} failed login attempts
                </p>
              </CardHeader>
              <CardContent>
                {failedLogins.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-slate-600 mb-2">No failed login attempts</p>
                    <p className="text-sm text-slate-500">All authentication attempts successful!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Email</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">IP Address</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Attempts</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Location</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Last Attempt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {failedLogins.map((login) => (
                          <tr key={login.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 text-sm text-slate-900">{login.email}</td>
                            <td className="py-3 px-4 text-sm font-mono text-slate-700">{login.ip_address}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                login.attempt_count > 5 ? 'bg-red-100 text-red-800' :
                                login.attempt_count > 2 ? 'bg-orange-100 text-orange-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {login.attempt_count}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600">
                              {login.city ? `${login.city}, ${login.country}` : login.country || 'Unknown'}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600">
                              {new Date(login.last_attempt_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* API Security Tab */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-purple-900 mb-1">API Security & Rate Limits</h3>
                  <p className="text-sm text-purple-800">
                    Monitor rate limit violations, API abuse, and potential DDoS attempts.
                  </p>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900">Rate Limit Violations</CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  Showing {rateViolations.length} rate limit violations
                </p>
              </CardHeader>
              <CardContent>
                {rateViolations.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-slate-600 mb-2">No rate limit violations</p>
                    <p className="text-sm text-slate-500">API usage is within normal limits!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">IP Address</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Endpoint</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Requests</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Limit</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Type</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Blocked</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rateViolations.map((violation) => (
                          <tr key={violation.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 text-sm font-mono text-slate-700">{violation.ip_address}</td>
                            <td className="py-3 px-4 text-sm text-slate-600">{violation.endpoint || 'All endpoints'}</td>
                            <td className="py-3 px-4 text-sm font-semibold text-red-600">{violation.request_count}</td>
                            <td className="py-3 px-4 text-sm text-slate-600">{violation.limit_threshold}</td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {violation.limit_type}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {violation.was_blocked ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600">
                              {new Date(violation.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Prompt Injections Tab */}
        {activeTab === 'injections' && (
          <div className="space-y-6">
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-red-900 mb-1">Prompt Injection Detection</h3>
                  <p className="text-sm text-red-800">
                    AI security monitoring - attempts to manipulate or bypass AI guardrails.
                  </p>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900">Detected Prompt Injections</CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  Showing {promptInjections.length} injection attempts
                </p>
              </CardHeader>
              <CardContent>
                {promptInjections.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-slate-600 mb-2">No prompt injection attempts</p>
                    <p className="text-sm text-slate-500">AI guardrails are holding strong!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {promptInjections.map((injection) => (
                      <div key={injection.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className={`h-5 w-5 ${
                              injection.confidence_score > 80 ? 'text-red-600' :
                              injection.confidence_score > 50 ? 'text-orange-600' :
                              'text-yellow-600'
                            }`} />
                            <div>
                              <div className="font-medium text-slate-900">
                                {injection.injection_type || 'Unknown Type'}
                              </div>
                              <div className="text-sm text-slate-600">
                                Confidence: {injection.confidence_score}%
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-slate-600">
                              {new Date(injection.created_at).toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              IP: {injection.ip_address}
                            </div>
                          </div>
                        </div>
                        <div className="bg-slate-100 rounded p-3 mb-3">
                          <div className="text-xs text-slate-600 mb-1">Prompt Text:</div>
                          <div className="text-sm text-slate-800 font-mono break-all">
                            {injection.prompt_text.substring(0, 200)}
                            {injection.prompt_text.length > 200 && '...'}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            injection.was_blocked ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {injection.was_blocked ? 'Blocked' : 'Not Blocked'}
                          </span>
                          {injection.matched_patterns && injection.matched_patterns.length > 0 && (
                            <span className="text-slate-600">
                              Patterns: {injection.matched_patterns.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* IP Intelligence Tab */}
        {activeTab === 'ips' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-blue-900 mb-1">IP Intelligence & Blocklist</h3>
                  <p className="text-sm text-blue-800">
                    Monitor suspicious IPs, manage blocklist, and track threat scores.
                  </p>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900">Suspicious IP Addresses</CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  Showing {suspiciousIps.length} suspicious IPs
                </p>
              </CardHeader>
              <CardContent>
                {suspiciousIps.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-slate-600 mb-2">No suspicious IPs detected</p>
                    <p className="text-sm text-slate-500">All traffic appears legitimate!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">IP Address</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Threat Score</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Detections</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Location</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Type</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Last Seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suspiciousIps.map((ip) => (
                          <tr key={ip.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 text-sm font-mono text-slate-900">{ip.ip_address}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className={`text-sm font-bold ${
                                  ip.threat_score > 70 ? 'text-red-600' :
                                  ip.threat_score > 40 ? 'text-orange-600' :
                                  'text-yellow-600'
                                }`}>
                                  {ip.threat_score}
                                </div>
                                <div className="w-20 bg-slate-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      ip.threat_score > 70 ? 'bg-red-600' :
                                      ip.threat_score > 40 ? 'bg-orange-600' :
                                      'bg-yellow-600'
                                    }`}
                                    style={{ width: `${ip.threat_score}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-700">{ip.detection_count}</td>
                            <td className="py-3 px-4 text-sm text-slate-600">
                              {ip.city ? `${ip.city}, ${ip.country}` : ip.country || 'Unknown'}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-1">
                                {ip.is_vpn && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                    VPN
                                  </span>
                                )}
                                {ip.is_tor && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                    TOR
                                  </span>
                                )}
                                {ip.is_proxy && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                    Proxy
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {ip.is_blocked ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  <Ban className="h-3 w-3 mr-1" />
                                  Blocked
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600">
                              {new Date(ip.last_seen).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
