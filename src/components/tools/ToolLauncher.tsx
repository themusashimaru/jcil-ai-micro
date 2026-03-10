/**
 * TOOL LAUNCHER COMPONENT
 *
 * PURPOSE:
 * - Reusable component for all tool launcher pages
 * - Displays tool title, description
 * - Renders dynamic form based on tool configuration
 * - Submits form and opens new chat with tool context
 *
 * BEHAVIOR:
 * - Form validation before submission
 * - Creates new chat with tool parameters as initial prompt
 * - Redirects to chat page with prefilled context
 */

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

const inputBase =
  'w-full px-4 py-3 bg-card/50 border border-border/40 font-mono text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-accent/60 transition-colors';

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

    const prompt = buildPromptFromFormData(config, formData);

    const params = new URLSearchParams({
      tool: config.id,
      prompt: prompt,
    });

    router.push(`/chat?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/capabilities" className="font-mono text-[10px] text-muted-foreground hover:text-accent transition-colors uppercase tracking-widest">
            &larr; All Tools
          </Link>
        </div>

        <div className="border border-border/40 bg-card/50 p-6 md:p-8 mb-6">
          <div className="mb-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">{config.id}</span>
            <h1 className="mt-2 font-bebas text-3xl md:text-4xl tracking-tight text-foreground">{config.title.toUpperCase()}</h1>
            <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">{config.description}</p>
          </div>

          {/* Examples */}
          {config.examples && config.examples.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border/30">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-3">Example uses</p>
              <div className="flex flex-wrap gap-2">
                {config.examples.map((example) => (
                  <button
                    key={example}
                    onClick={() => {
                      const firstField = config.fields[0];
                      if (firstField) {
                        handleInputChange(firstField.name, example);
                      }
                    }}
                    className="border border-border/30 px-3 py-1.5 font-mono text-[10px] text-muted-foreground hover:text-accent hover:border-accent/30 transition-all"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="border border-border/40 bg-card/50 p-6 md:p-8">
          <div className="space-y-6">
            {config.fields.map((field) => (
              <div key={field.name}>
                <label className="block font-mono text-xs text-foreground mb-2 uppercase tracking-widest">
                  {field.label}
                  {field.required && <span className="text-accent ml-1">*</span>}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    rows={field.rows || 4}
                    className={`${inputBase} resize-none`}
                  />
                ) : field.type === 'select' ? (
                  <select
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    required={field.required}
                    className={inputBase}
                  >
                    <option value="">Select...</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value} className="bg-background">
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
                    className={inputBase}
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
                    className={`${inputBase} file:mr-4 file:py-1 file:px-3 file:border file:border-accent/30 file:bg-accent/10 file:text-accent file:font-mono file:text-[10px] file:uppercase file:tracking-widest file:cursor-pointer`}
                  />
                ) : (
                  <input
                    type="text"
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    className={inputBase}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Submit */}
          <div className="mt-8 flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 border border-accent bg-accent/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Starting...' : `Start ${config.title}`}
            </button>
            <button
              type="button"
              onClick={() => router.push('/chat')}
              className="border border-border/40 px-6 py-3 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link
            href="/chat"
            className="font-mono text-[10px] text-muted-foreground hover:text-accent transition-colors uppercase tracking-widest"
          >
            &larr; Back to Chat
          </Link>
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
