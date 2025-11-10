/**
 * TOOL LAUNCHER COMPONENT
 *
 * PURPOSE:
 * - Reusable component for all tool launcher pages
 * - Displays tool icon, title, description
 * - Renders dynamic form based on tool configuration
 * - Submits form and opens new chat with tool context
 *
 * BEHAVIOR:
 * - Form validation before submission
 * - Creates new chat with tool parameters as initial prompt
 * - Redirects to chat page with prefilled context
 * - Glassmorphism styling matching app theme
 *
 * TODO:
 * - [ ] Add form validation with error messages
 * - [ ] Add save as template functionality
 * - [ ] Add recent tool uses
 * - [ ] Add keyboard shortcuts
 *
 * TEST PLAN:
 * - Verify form fields render correctly
 * - Test form submission creates chat
 * - Check validation prevents empty submissions
 * - Verify mobile responsive layout
 */

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export interface ToolField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'file';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  min?: number;
  max?: number;
  rows?: number;
}

export interface ToolConfig {
  id: string;
  icon: string;
  title: string;
  description: string;
  fields: ToolField[];
  examples?: string[];
}

interface ToolLauncherProps {
  config: ToolConfig;
}

export function ToolLauncher({ config }: ToolLauncherProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Build prompt from form data
    const prompt = buildPromptFromFormData(config, formData);

    // TODO: Create new chat with API
    // For now, redirect to chat with query params
    const params = new URLSearchParams({
      tool: config.id,
      prompt: prompt,
    });

    router.push(`/chat?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="glass-morphism rounded-2xl p-6 md:p-8 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="text-5xl flex-shrink-0">{config.icon}</div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">{config.title}</h1>
              <p className="text-white/70">{config.description}</p>
            </div>
          </div>

          {/* Examples */}
          {config.examples && config.examples.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-sm font-medium text-white/50 mb-2">Example uses:</p>
              <div className="flex flex-wrap gap-2">
                {config.examples.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      // Prefill first field with example
                      const firstField = config.fields[0];
                      if (firstField) {
                        handleInputChange(firstField.name, example);
                      }
                    }}
                    className="px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass-morphism rounded-2xl p-6 md:p-8">
          <div className="space-y-6">
            {config.fields.map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-white mb-2">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    rows={field.rows || 4}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                ) : field.type === 'select' ? (
                  <select
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    required={field.required}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value} className="bg-black">
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'number' ? (
                  <input
                    type="number"
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    min={field.min}
                    max={field.max}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : field.type === 'file' ? (
                  <input
                    type="file"
                    name={field.name}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleInputChange(field.name, file.name);
                      }
                    }}
                    required={field.required}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-500 file:text-white file:cursor-pointer hover:file:bg-blue-600"
                  />
                ) : (
                  <input
                    type="text"
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Submit Button */}
          <div className="mt-8 flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Starting...' : `Start ${config.title}`}
            </button>
            <button
              type="button"
              onClick={() => router.push('/chat')}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/chat')}
            className="text-white/50 hover:text-white/70 text-sm transition-colors"
          >
            ← Back to Chat
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Build a natural language prompt from form data
 */
function buildPromptFromFormData(config: ToolConfig, formData: Record<string, string>): string {
  const parts: string[] = [];

  config.fields.forEach((field) => {
    const value = formData[field.name];
    if (value) {
      parts.push(`${field.label}: ${value}`);
    }
  });

  return `Using the ${config.title} tool:\n\n${parts.join('\n')}`;
}
