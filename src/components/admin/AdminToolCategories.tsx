'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Save,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface ToolCategory {
  id: string;
  category_key: string;
  category_name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  allowed_tiers: string[];
  created_at: string;
  updated_at: string;
}

const TIERS = ['free', 'basic', 'pro', 'executive'];

export default function AdminToolCategories() {
  const [categories, setCategories] = useState<ToolCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    category_key: '',
    category_name: '',
    description: '',
    display_order: 0,
    is_active: true,
    allowed_tiers: TIERS,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tool-categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const url = '/api/admin/tool-categories';
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
        throw new Error(data.error || 'Failed to save category');
      }

      setSuccess(editingId ? 'Category updated successfully!' : 'Category created successfully!');
      resetForm();
      await fetchCategories();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category: ToolCategory) => {
    setEditingId(category.id);
    setFormData({
      category_key: category.category_key,
      category_name: category.category_name,
      description: category.description || '',
      display_order: category.display_order,
      is_active: category.is_active,
      allowed_tiers: category.allowed_tiers,
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? This will also delete all tools in this category.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/tool-categories?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete category');
      }

      setSuccess('Category deleted successfully!');
      await fetchCategories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      category_key: '',
      category_name: '',
      description: '',
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              {editingId ? 'Edit Category' : 'Add New Category'}
            </CardTitle>
            <CardDescription className="text-gray-600">
              Create and manage tool categories with tier-based access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Category Key *
                </label>
                <Input
                  value={formData.category_key}
                  onChange={(e) => setFormData({ ...formData, category_key: e.target.value })}
                  placeholder="e.g., writing, professional"
                  required
                  disabled={!!editingId}
                  className="text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">Unique identifier (no spaces, lowercase)</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Category Name *
                </label>
                <Input
                  value={formData.category_name}
                  onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                  placeholder="e.g., Writing Tools"
                  required
                  className="text-gray-900"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Description
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this category..."
                  rows={3}
                  className="text-gray-900"
                />
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

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-3">
                  Allowed Subscription Tiers *
                </label>
                <div className="space-y-2">
                  {TIERS.map((tier) => (
                    <div key={tier} className="flex items-center gap-2">
                      <Checkbox
                        id={`tier-${tier}`}
                        checked={formData.allowed_tiers.includes(tier)}
                        onCheckedChange={() => handleTierToggle(tier)}
                      />
                      <label htmlFor={`tier-${tier}`} className="text-sm text-gray-700 capitalize cursor-pointer">
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
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: !!checked })}
                />
                <label htmlFor="is_active" className="text-sm text-gray-700 cursor-pointer">
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
                      {editingId ? 'Update' : 'Create'} Category
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

        {/* Categories List */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900">Existing Categories</CardTitle>
              <Button
                onClick={fetchCategories}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500 text-center py-4">Loading categories...</p>
            ) : categories.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No categories yet</p>
            ) : (
              <div className="space-y-3">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="border border-gray-200 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{category.category_name}</h4>
                        <p className="text-xs text-gray-500">Key: {category.category_key}</p>
                        {category.description && (
                          <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            Order: {category.display_order}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${category.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {category.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {category.allowed_tiers.map(tier => (
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
                          onClick={() => handleEdit(category)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(category.id)}
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
    </div>
  );
}
