'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Save,
  Trash2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Wrench,
  Edit
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Tool {
  id: string;
  tool_key: string;
  tool_name: string;
  category_key: string;
  description: string;
  welcome_message: string;
  system_prompt: string;
  display_order: number;
  is_active: boolean;
  allowed_tiers: string[];
}

interface ToolCategory {
  id: string;
  category_key: string;
  category_name: string;
}

const TIERS = ['free', 'basic', 'pro', 'executive'];

export default function AdminTools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<ToolCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [formData, setFormData] = useState({
    tool_key: '',
    tool_name: '',
    category_key: '',
    description: '',
    welcome_message: '',
    system_prompt: '',
    display_order: 0,
    is_active: true,
    allowed_tiers: TIERS,
  });

  useEffect(() => {
    fetchCategories();
    fetchTools();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/admin/tool-categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchTools = async () => {
    setLoading(true);
    try {
      const url = selectedCategory === 'all'
        ? '/api/admin/tools'
        : `/api/admin/tools?category=${selectedCategory}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch tools');
      const data = await response.json();
      setTools(data.tools || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, [selectedCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const url = '/api/admin/tools';
      const method = editingId ? 'PATCH' : 'POST';
      const body = editingId
        ? { id: editingId, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save tool');
      }

      setSuccess(editingId ? 'Tool updated successfully!' : 'Tool created successfully!');
      resetForm();
      await fetchTools();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (tool: Tool) => {
    setEditingId(tool.id);
    setFormData({
      tool_key: tool.tool_key,
      tool_name: tool.tool_name,
      category_key: tool.category_key,
      description: tool.description,
      welcome_message: tool.welcome_message,
      system_prompt: tool.system_prompt,
      display_order: tool.display_order,
      is_active: tool.is_active,
      allowed_tiers: tool.allowed_tiers,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tool?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/tools?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete tool');
      }

      setSuccess('Tool deleted successfully!');
      await fetchTools();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      tool_key: '',
      tool_name: '',
      category_key: '',
      description: '',
      welcome_message: '',
      system_prompt: '',
      display_order: 0,
      is_active: true,
      allowed_tiers: TIERS,
    });
  };

  const handleTierToggle = (tier: string) => {
    setFormData(prev => ({
      ...prev,
      allowed_tiers: prev.allowed_tiers.includes(tier)
        ? prev.allowed_tiers.filter(t => t !== tier)
        : [...prev.allowed_tiers, tier]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {editingId ? 'Edit Tool' : 'Add New Tool'}
          </CardTitle>
          <CardDescription className="text-gray-600">
            Create and manage AI tools with custom prompts and tier-based access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Tool Key *
                </label>
                <Input
                  value={formData.tool_key}
                  onChange={(e) => setFormData({ ...formData, tool_key: e.target.value })}
                  placeholder="e.g., email-high-school"
                  required
                  disabled={!!editingId}
                  className="text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">Unique identifier (kebab-case)</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Tool Name *
                </label>
                <Input
                  value={formData.tool_name}
                  onChange={(e) => setFormData({ ...formData, tool_name: e.target.value })}
                  placeholder="e.g., Email Writer - High School"
                  required
                  className="text-gray-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Category *
                </label>
                <Select
                  value={formData.category_key}
                  onValueChange={(value) => setFormData({ ...formData, category_key: value })}
                  required
                >
                  <SelectTrigger className="text-gray-900 font-medium">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white text-gray-900 border border-gray-200 shadow-lg">
                    {categories.map((category) => (
                      <SelectItem
                        key={category.id}
                        value={category.category_key}
                        className="text-gray-900"
                      >
                        {category.category_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Display Order
                </label>
                <Input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                  className="text-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Description *
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description shown in tool selector..."
                rows={2}
                required
                className="text-gray-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Welcome Message *
              </label>
              <Textarea
                value={formData.welcome_message}
                onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                placeholder="Message shown when user starts using this tool..."
                rows={3}
                required
                className="text-gray-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                System Prompt *
              </label>
              <Textarea
                value={formData.system_prompt}
                onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                placeholder="Detailed system prompt that defines tool behavior..."
                rows={15}
                required
                className="font-mono text-sm text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">{formData.system_prompt.length} characters</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-3">
                Allowed Subscription Tiers *
              </label>
              <div className="flex gap-4">
                {TIERS.map((tier) => (
                  <div key={tier} className="flex items-center gap-2">
                    <Checkbox
                      id={`tool-tier-${tier}`}
                      checked={formData.allowed_tiers.includes(tier)}
                      onCheckedChange={() => handleTierToggle(tier)}
                    />
                    <label htmlFor={`tool-tier-${tier}`} className="text-sm text-gray-700 capitalize cursor-pointer">
                      {tier === 'free' && '🆓 '}
                      {tier === 'basic' && '📘 '}
                      {tier === 'pro' && '🚀 '}
                      {tier === 'executive' && '💼 '}
                      {tier}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="tool_is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: !!checked })}
              />
              <label htmlFor="tool_is_active" className="text-sm text-gray-700 cursor-pointer">
                Active (visible to users)
              </label>
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
                <span className="text-sm">{success}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={saving}
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
                    {editingId ? 'Update' : 'Create'} Tool
                  </>
                )}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  onClick={resetForm}
                  variant="outline"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Tools List */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-900">Existing Tools</CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-[200px] text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white text-gray-900">
                  <SelectItem value="all" className="text-gray-900">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem
                      key={category.id}
                      value={category.category_key}
                      className="text-gray-900"
                    >
                      {category.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={fetchTools}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-4">Loading tools...</p>
          ) : tools.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No tools found</p>
          ) : (
            <div className="space-y-3">
              {tools.map((tool) => (
                <div
                  key={tool.id}
                  className="border border-gray-200 rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{tool.tool_name}</h4>
                      <p className="text-xs text-gray-500">Key: {tool.tool_key} | Category: {tool.category_key}</p>
                      <p className="text-sm text-gray-600 mt-1">{tool.description}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          Order: {tool.display_order}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${tool.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {tool.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {tool.allowed_tiers.map(tier => (
                          <span key={tier} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded capitalize">
                            {tier}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(tool)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(tool.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
