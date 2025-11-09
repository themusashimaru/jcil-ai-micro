'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Settings,
  MessageSquare,
  Save,
  RotateCcw,
  History,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Code,
  Wrench
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SectionType = 'prompt-editor' | 'tools' | 'config';

interface SystemPrompt {
  id: string;
  prompt_type: string;
  prompt_name: string;
  prompt_content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

interface AuditEntry {
  id: string;
  prompt_type: string;
  old_content: string;
  new_content: string;
  changed_by: string | null;
  changed_at: string;
  changed_by_user?: {
    id: string;
    full_name: string | null;
  };
}

export default function AdminSystems() {
  const [activeSection, setActiveSection] = useState<SectionType>('prompt-editor');
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPrompts();
  }, []);

  useEffect(() => {
    if (selectedPrompt) {
      fetchAuditLog(selectedPrompt.prompt_type);
    }
  }, [selectedPrompt]);

  useEffect(() => {
    if (selectedPrompt && editedContent !== selectedPrompt.prompt_content) {
      setHasChanges(true);
    } else {
      setHasChanges(false);
    }
  }, [editedContent, selectedPrompt]);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/system-prompts');
      if (!response.ok) throw new Error('Failed to fetch prompts');
      const data = await response.json();
      setPrompts(data.prompts || []);

      // Auto-select main chat prompt
      const mainPrompt = data.prompts?.find((p: SystemPrompt) => p.prompt_type === 'main_chat');
      if (mainPrompt) {
        setSelectedPrompt(mainPrompt);
        setEditedContent(mainPrompt.prompt_content);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLog = async (promptType: string) => {
    try {
      const response = await fetch(`/api/admin/system-prompts/audit?type=${promptType}&limit=10`);
      if (!response.ok) throw new Error('Failed to fetch audit log');
      const data = await response.json();
      setAuditLog(data.auditLog || []);
    } catch (err: any) {
      console.error('Failed to fetch audit log:', err);
    }
  };

  const handleSave = async () => {
    if (!selectedPrompt) return;

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/admin/system-prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptType: selectedPrompt.prompt_type,
          promptContent: editedContent,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save prompt');
      }

      setSuccess(true);
      setHasChanges(false);
      await fetchPrompts();
      await fetchAuditLog(selectedPrompt.prompt_type);

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    if (selectedPrompt) {
      setEditedContent(selectedPrompt.prompt_content);
      setHasChanges(false);
    }
  };

  const handlePromptSelect = (promptType: string) => {
    const prompt = prompts.find(p => p.prompt_type === promptType);
    if (prompt) {
      setSelectedPrompt(prompt);
      setEditedContent(prompt.prompt_content);
      setHasChanges(false);
      setSuccess(false);
      setError('');
    }
  };

  const sections = [
    { id: 'prompt-editor' as SectionType, label: 'System Prompt Editor', icon: MessageSquare },
    { id: 'tools' as SectionType, label: 'Tool Prompts', icon: Wrench },
    { id: 'config' as SectionType, label: 'Configuration', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Systems Configuration
        </h2>
        <p className="text-sm text-gray-700 mt-1">
          Manage system prompts, tools, and configuration settings
        </p>
      </div>

      {/* Section Navigation */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-2 flex-wrap">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <Button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  variant={isActive ? 'default' : 'outline'}
                  className={isActive ? 'bg-blue-600 hover:bg-blue-700' : ''}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {section.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* System Prompt Editor Section */}
      {activeSection === 'prompt-editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Editor */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-gray-900 flex items-center gap-2">
                      <Code className="h-5 w-5" />
                      {selectedPrompt?.prompt_name || 'System Prompt Editor'}
                    </CardTitle>
                    <CardDescription className="text-gray-600 mt-1">
                      Edit the main system prompt that controls AI behavior and personality
                    </CardDescription>
                  </div>
                  <Button
                    onClick={fetchPrompts}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Prompt Selector */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Select Prompt to Edit
                  </label>
                  <Select
                    value={selectedPrompt?.prompt_type || ''}
                    onValueChange={handlePromptSelect}
                  >
                    <SelectTrigger className="text-gray-900 font-medium">
                      <SelectValue placeholder="Select a prompt" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-gray-900 border border-gray-200 shadow-lg">
                      {prompts.map((prompt) => (
                        <SelectItem
                          key={prompt.id}
                          value={prompt.prompt_type}
                          className="text-gray-900"
                        >
                          {prompt.prompt_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Editor */}
                {selectedPrompt && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">
                          Prompt Content
                        </label>
                        <span className="text-xs text-gray-500">
                          {editedContent.length} characters
                        </span>
                      </div>
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        rows={25}
                        className="font-mono text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Enter system prompt..."
                      />
                    </div>

                    {/* Status Messages */}
                    {error && (
                      <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">{error}</span>
                      </div>
                    )}

                    {success && (
                      <div className="bg-green-50 text-green-700 p-3 rounded-lg flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">System prompt saved successfully!</span>
                      </div>
                    )}

                    {hasChanges && !success && (
                      <div className="bg-yellow-50 text-yellow-700 p-3 rounded-lg flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">You have unsaved changes</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        {saving ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleRevert}
                        disabled={!hasChanges}
                        variant="outline"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Revert
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Audit Log */}
          <div className="space-y-4">
            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Change History
                </CardTitle>
                <CardDescription className="text-gray-600 text-xs">
                  Recent edits to this prompt
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditLog.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No changes recorded yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {auditLog.map((entry) => (
                      <div
                        key={entry.id}
                        className="border-l-2 border-blue-300 pl-3 py-2 text-xs"
                      >
                        <div className="text-gray-900 font-medium">
                          {entry.changed_by_user?.full_name || 'Admin'}
                        </div>
                        <div className="text-gray-500">
                          {new Date(entry.changed_at).toLocaleString()}
                        </div>
                        <div className="text-gray-600 mt-1">
                          Updated prompt content
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-blue-900">
                  Important Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-blue-800 space-y-2">
                <p>• Changes take effect immediately for new conversations</p>
                <p>• Existing conversations continue with previous prompt</p>
                <p>• All changes are logged for audit purposes</p>
                <p>• Test changes carefully before deploying</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tool Prompts Section - Placeholder */}
      {activeSection === 'tools' && (
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900">Tool Prompts</CardTitle>
            <CardDescription className="text-gray-600">
              Manage prompts for specialized tools (coming soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Tool prompt editing will be available in a future update.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Configuration Section - Placeholder */}
      {activeSection === 'config' && (
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900">System Configuration</CardTitle>
            <CardDescription className="text-gray-600">
              Configure system-wide settings (coming soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              System configuration options will be available in a future update.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
