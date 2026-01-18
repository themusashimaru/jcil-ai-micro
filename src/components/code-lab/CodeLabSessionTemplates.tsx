'use client';

/**
 * CODE LAB SESSION TEMPLATES
 *
 * Quick-start templates for common coding workflows.
 * Features:
 * - Pre-configured session starters
 * - Category organization
 * - One-click session creation
 * - Popular templates
 */

interface SessionTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'build' | 'debug' | 'learn' | 'refactor' | 'deploy';
  prompt: string;
  popular?: boolean;
}

const SESSION_TEMPLATES: SessionTemplate[] = [
  // Build category
  {
    id: 'new-feature',
    title: 'Build New Feature',
    description: 'Plan and implement a new feature from scratch',
    icon: '🚀',
    category: 'build',
    popular: true,
    prompt: 'Help me build a new feature. I want to implement:',
  },
  {
    id: 'api-endpoint',
    title: 'Create API Endpoint',
    description: 'Design and build a REST or GraphQL API endpoint',
    icon: '🔌',
    category: 'build',
    prompt: 'I need to create a new API endpoint that:',
  },
  {
    id: 'component',
    title: 'Build React Component',
    description: 'Create a reusable React component with best practices',
    icon: '⚛️',
    category: 'build',
    prompt: 'Help me build a React component for:',
  },
  {
    id: 'database-schema',
    title: 'Design Database Schema',
    description: 'Design database tables, relationships, and migrations',
    icon: '🗄️',
    category: 'build',
    prompt: 'I need to design a database schema for:',
  },
  {
    id: 'cli-tool',
    title: 'Build CLI Tool',
    description: 'Create a command-line interface tool',
    icon: '💻',
    category: 'build',
    prompt: 'Help me build a CLI tool that:',
  },

  // Debug category
  {
    id: 'fix-bug',
    title: 'Fix a Bug',
    description: 'Debug and fix an issue in the codebase',
    icon: '🐛',
    category: 'debug',
    popular: true,
    prompt: '/fix',
  },
  {
    id: 'performance',
    title: 'Fix Performance Issue',
    description: 'Identify and resolve performance bottlenecks',
    icon: '⚡',
    category: 'debug',
    prompt: 'I have a performance issue where:',
  },
  {
    id: 'error-trace',
    title: 'Debug Error Trace',
    description: 'Analyze an error stack trace and find the root cause',
    icon: '🔍',
    category: 'debug',
    prompt: 'Help me debug this error:',
  },
  {
    id: 'memory-leak',
    title: 'Find Memory Leak',
    description: 'Identify and fix memory leaks',
    icon: '💧',
    category: 'debug',
    prompt: 'I suspect there is a memory leak in:',
  },

  // Learn category
  {
    id: 'explain-code',
    title: 'Explain This Code',
    description: 'Get a detailed explanation of how code works',
    icon: '📖',
    category: 'learn',
    popular: true,
    prompt: '/explain',
  },
  {
    id: 'architecture',
    title: 'Understand Architecture',
    description: 'Learn about the project structure and design patterns',
    icon: '🏗️',
    category: 'learn',
    prompt:
      'Explain the architecture of this codebase, including the main components and how they interact.',
  },
  {
    id: 'best-practices',
    title: 'Learn Best Practices',
    description: 'Discover best practices for a specific technology',
    icon: '✨',
    category: 'learn',
    prompt: 'What are the best practices for:',
  },
  {
    id: 'compare-approaches',
    title: 'Compare Approaches',
    description: 'Evaluate different ways to solve a problem',
    icon: '⚖️',
    category: 'learn',
    prompt: 'Compare different approaches to:',
  },

  // Refactor category
  {
    id: 'code-review',
    title: 'Code Review',
    description: 'Get a thorough review of recent changes',
    icon: '👀',
    category: 'refactor',
    popular: true,
    prompt: '/review',
  },
  {
    id: 'refactor-code',
    title: 'Refactor Code',
    description: 'Improve code quality and maintainability',
    icon: '♻️',
    category: 'refactor',
    prompt: '/refactor',
  },
  {
    id: 'add-types',
    title: 'Add TypeScript Types',
    description: 'Add proper type annotations to JavaScript code',
    icon: '📘',
    category: 'refactor',
    prompt: 'Add TypeScript types to this code:',
  },
  {
    id: 'add-tests',
    title: 'Write Unit Tests',
    description: 'Generate comprehensive tests for your code',
    icon: '🧪',
    category: 'refactor',
    prompt: '/test',
  },
  {
    id: 'cleanup',
    title: 'Code Cleanup',
    description: 'Remove dead code, fix linting, organize imports',
    icon: '🧹',
    category: 'refactor',
    prompt:
      'Clean up this codebase by removing dead code, fixing linting issues, and organizing imports.',
  },

  // Deploy category
  {
    id: 'commit-changes',
    title: 'Commit Changes',
    description: 'Stage and commit current changes',
    icon: '✅',
    category: 'deploy',
    popular: true,
    prompt: '/commit',
  },
  {
    id: 'deploy-setup',
    title: 'Setup Deployment',
    description: 'Configure CI/CD and deployment pipelines',
    icon: '🚢',
    category: 'deploy',
    prompt: 'Help me set up deployment for this project using:',
  },
  {
    id: 'docker',
    title: 'Dockerize App',
    description: 'Create Docker configuration for the project',
    icon: '🐳',
    category: 'deploy',
    prompt: 'Help me dockerize this application with optimal settings.',
  },
  {
    id: 'env-setup',
    title: 'Environment Setup',
    description: 'Configure environment variables and secrets',
    icon: '🔐',
    category: 'deploy',
    prompt: 'Help me set up environment variables and configuration for:',
  },
];

const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
  build: { label: 'Build', color: 'var(--cl-success)' },
  debug: { label: 'Debug', color: 'var(--cl-error)' },
  learn: { label: 'Learn', color: 'var(--cl-info)' },
  refactor: { label: 'Refactor', color: 'var(--cl-warning)' },
  deploy: { label: 'Deploy', color: 'var(--cl-purple)' },
};

interface CodeLabSessionTemplatesProps {
  onSelectTemplate: (template: SessionTemplate) => void;
  className?: string;
}

export function CodeLabSessionTemplates({
  onSelectTemplate,
  className = '',
}: CodeLabSessionTemplatesProps) {
  const popularTemplates = SESSION_TEMPLATES.filter((t) => t.popular);

  // Group by category
  const byCategory: Record<string, SessionTemplate[]> = {};
  SESSION_TEMPLATES.forEach((t) => {
    if (!byCategory[t.category]) {
      byCategory[t.category] = [];
    }
    byCategory[t.category].push(t);
  });

  return (
    <div className={`session-templates ${className}`}>
      {/* Popular section */}
      <div className="templates-section">
        <h3 className="section-title">
          <span className="section-icon">⭐</span>
          Popular
        </h3>
        <div className="templates-grid popular">
          {popularTemplates.map((template) => (
            <button
              key={template.id}
              className="template-card popular"
              onClick={() => onSelectTemplate(template)}
            >
              <span className="template-icon">{template.icon}</span>
              <div className="template-content">
                <span className="template-title">{template.title}</span>
                <span className="template-desc">{template.description}</span>
              </div>
              <span
                className="category-badge"
                style={{ backgroundColor: CATEGORY_INFO[template.category].color }}
              >
                {CATEGORY_INFO[template.category].label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Category sections */}
      {Object.entries(byCategory).map(([category, templates]) => (
        <div key={category} className="templates-section">
          <h3 className="section-title">
            <span
              className="section-dot"
              style={{ backgroundColor: CATEGORY_INFO[category].color }}
            />
            {CATEGORY_INFO[category].label}
          </h3>
          <div className="templates-grid">
            {templates.map((template) => (
              <button
                key={template.id}
                className="template-card"
                onClick={() => onSelectTemplate(template)}
              >
                <span className="template-icon">{template.icon}</span>
                <div className="template-content">
                  <span className="template-title">{template.title}</span>
                  <span className="template-desc">{template.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      <style jsx>{`
        .session-templates {
          padding: 1.5rem;
          max-width: 900px;
          margin: 0 auto;
        }

        .templates-section {
          margin-bottom: 2rem;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0 0 1rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--cl-text-secondary, #4b5563);
        }

        .section-icon {
          font-size: 1rem;
        }

        .section-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .templates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0.75rem;
        }

        .templates-grid.popular {
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        }

        .template-card {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--cl-bg-primary, white);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 12px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
          position: relative;
        }

        .template-card:hover {
          border-color: var(--cl-accent-primary, #1e3a5f);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
          transform: translateY(-2px);
        }

        .template-card.popular {
          background: linear-gradient(135deg, #f9fafb 0%, #eef2ff 100%);
        }

        .template-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .template-content {
          flex: 1;
          min-width: 0;
        }

        .template-title {
          display: block;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
          margin-bottom: 0.25rem;
        }

        .template-desc {
          display: block;
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #6b7280);
          line-height: 1.4;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .category-badge {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          padding: 0.125rem 0.5rem;
          border-radius: 999px;
          font-size: 0.625rem;
          font-weight: 600;
          color: white;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        @media (max-width: 640px) {
          .session-templates {
            padding: 1rem;
          }

          .templates-grid,
          .templates-grid.popular {
            grid-template-columns: 1fr;
          }

          .template-card {
            padding: 0.875rem;
          }
        }
      `}</style>
    </div>
  );
}

export { SESSION_TEMPLATES };
export type { SessionTemplate };
