'use client';

import { useState } from 'react';
import type { MCPServer } from './CodeLabMCPSettings';

export function AddServerModal({
  onAdd,
  onClose,
}: {
  onAdd: (server: Omit<MCPServer, 'status' | 'tools' | 'builtIn'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('npx');
  const [args, setArgs] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;

    onAdd({
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || undefined,
      command: command.trim(),
      args: args.trim() ? args.split(' ') : undefined,
      enabled: false,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Add MCP Server</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Server"
              required
            />
          </div>
          <div className="form-group">
            <label>Command *</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="npx"
              required
            />
          </div>
          <div className="form-group">
            <label>Arguments</label>
            <input
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="-y @modelcontextprotocol/server-name"
            />
            <span className="form-hint">Space-separated arguments</span>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this server do?"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!name.trim() || !command.trim()}
            >
              Add Server
            </button>
          </div>
        </form>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadeIn 0.15s ease;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          .modal-content {
            background: var(--cl-bg-primary, #ffffff);
            border-radius: 16px;
            padding: 1.5rem;
            width: 90%;
            max-width: 400px;
            box-shadow:
              0 20px 40px rgba(0, 0, 0, 0.15),
              0 10px 20px rgba(0, 0, 0, 0.1);
            animation: slideUp 0.2s ease;
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          h3 {
            margin: 0 0 1.25rem 0;
            font-size: 1.125rem;
            font-weight: 600;
            color: var(--cl-text-primary, #1a1f36);
          }

          .form-group {
            margin-bottom: 1rem;
          }

          label {
            display: block;
            font-size: 0.8125rem;
            font-weight: 500;
            color: var(--cl-text-secondary, #374151);
            margin-bottom: 0.375rem;
          }

          input {
            width: 100%;
            padding: 0.625rem 0.75rem;
            border: 1px solid var(--cl-border-primary, #e5e7eb);
            border-radius: 8px;
            font-size: 0.875rem;
            color: var(--cl-text-primary, #1a1f36);
            transition: border-color 0.15s ease;
          }

          input:focus {
            outline: none;
            border-color: var(--cl-accent-primary, #1e3a5f);
          }

          input::placeholder {
            color: var(--cl-text-tertiary, #9ca3af);
          }

          .form-hint {
            display: block;
            font-size: 0.75rem;
            color: var(--cl-text-tertiary, #6b7280);
            margin-top: 0.25rem;
          }

          .modal-actions {
            display: flex;
            gap: 0.75rem;
            margin-top: 1.5rem;
          }

          .btn-secondary,
          .btn-primary {
            flex: 1;
            padding: 0.625rem 1rem;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .btn-secondary {
            background: var(--cl-bg-secondary, #f9fafb);
            border: 1px solid var(--cl-border-primary, #e5e7eb);
            color: var(--cl-text-secondary, #374151);
          }

          .btn-secondary:hover {
            background: var(--cl-bg-tertiary, #f3f4f6);
          }

          .btn-primary {
            background: var(--cl-accent-primary, #1e3a5f);
            border: none;
            color: white;
          }

          .btn-primary:hover:not(:disabled) {
            background: var(--cl-accent-secondary, #2d4a6f);
          }

          .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        `}</style>
      </div>
    </div>
  );
}
