/**
 * API BUILDER DEMO COMPONENT
 *
 * PURPOSE:
 * - Landing page showcase for API Builder
 * - Show CRUD endpoint generation
 * - Validation and documentation
 */

'use client';

import { useState, useEffect } from 'react';

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/users', desc: 'Get all users', status: 200 },
  { method: 'POST', path: '/api/users', desc: 'Create user', status: 201 },
  { method: 'GET', path: '/api/users/[id]', desc: 'Get user by ID', status: 200 },
  { method: 'PUT', path: '/api/users/[id]', desc: 'Update user', status: 200 },
  { method: 'DELETE', path: '/api/users/[id]', desc: 'Delete user', status: 204 },
];

const CODE_SAMPLE = `// Generated API with Zod validation

import { z } from 'zod';

export const UserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const validation = UserSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({
      error: validation.error.errors
    }, { status: 400 });
  }

  const user = await db.users.create(body);
  return NextResponse.json(user, { status: 201 });
}`;

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-500/20 text-green-400 border-green-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function ApiBuilderDemo() {
  const [visibleEndpoints, setVisibleEndpoints] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const [codeTyped, setCodeTyped] = useState('');
  const [activeEndpoint, setActiveEndpoint] = useState<number | null>(null);

  // Animate endpoint appearance
  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleEndpoints((prev) => {
        if (prev >= API_ENDPOINTS.length) {
          clearInterval(timer);
          setTimeout(() => setShowCode(true), 500);
          return prev;
        }
        return prev + 1;
      });
    }, 400);

    return () => clearInterval(timer);
  }, []);

  // Type code output
  useEffect(() => {
    if (!showCode) return;

    let index = 0;
    const typeInterval = setInterval(() => {
      if (index <= CODE_SAMPLE.length) {
        setCodeTyped(CODE_SAMPLE.slice(0, index));
        index += 4;
      } else {
        clearInterval(typeInterval);
        // Reset after pause
        setTimeout(() => {
          setVisibleEndpoints(0);
          setShowCode(false);
          setCodeTyped('');
          setActiveEndpoint(null);
        }, 4000);
      }
    }, 20);

    return () => clearInterval(typeInterval);
  }, [showCode]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 mb-4">
          <span className="text-blue-400">🔌</span>
          <span className="text-sm font-medium text-blue-300">API Builder</span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
          REST APIs in Minutes, Not Hours
        </h3>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Describe your data model and get fully-typed REST endpoints with Zod validation,
          error handling, and OpenAPI documentation - all generated automatically.
        </p>
      </div>

      {/* Demo Window */}
      <div className="rounded-2xl overflow-hidden shadow-2xl shadow-blue-500/10 border border-slate-700/50">
        {/* Window Chrome */}
        <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-sm font-medium text-white">API Builder</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
              REST
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
              TypeScript
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="bg-slate-900 p-6">
          {/* Split View */}
          <div className="grid grid-cols-2 gap-6">
            {/* Endpoints List */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">Generated Endpoints</h4>
              <div className="space-y-2">
                {API_ENDPOINTS.slice(0, visibleEndpoints).map((endpoint, i) => (
                  <div
                    key={i}
                    onMouseEnter={() => setActiveEndpoint(i)}
                    onMouseLeave={() => setActiveEndpoint(null)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      activeEndpoint === i
                        ? 'bg-slate-700/50 border-slate-600'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold border ${
                          METHOD_COLORS[endpoint.method]
                        }`}
                      >
                        {endpoint.method}
                      </span>
                      <span className="text-sm text-slate-300 font-mono">{endpoint.path}</span>
                    </div>
                    <span className="text-xs text-slate-500">{endpoint.status}</span>
                  </div>
                ))}

                {visibleEndpoints < API_ENDPOINTS.length && (
                  <div className="flex items-center justify-center py-4">
                    <span className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* OpenAPI Badge */}
              {visibleEndpoints >= API_ENDPOINTS.length && (
                <div className="mt-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center">
                  <p className="text-sm text-purple-300">
                    📚 OpenAPI 3.0 spec generated
                  </p>
                </div>
              )}
            </div>

            {/* Code Preview */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">Generated Code</h4>
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 h-[280px] overflow-y-auto">
                <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap">
                  {codeTyped}
                  {showCode && codeTyped.length < CODE_SAMPLE.length && (
                    <span className="inline-block w-2 h-3 bg-blue-400 animate-pulse" />
                  )}
                </pre>
              </div>
            </div>
          </div>

          {/* Features List */}
          <div className="mt-6 grid grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
              <span className="text-lg">🔒</span>
              <p className="text-xs text-slate-400 mt-1">Auth Ready</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
              <span className="text-lg">✅</span>
              <p className="text-xs text-slate-400 mt-1">Zod Validation</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
              <span className="text-lg">📚</span>
              <p className="text-xs text-slate-400 mt-1">OpenAPI Docs</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
              <span className="text-lg">🎯</span>
              <p className="text-xs text-slate-400 mt-1">Type Safety</p>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800 border-t border-slate-700/50 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>{visibleEndpoints} endpoints</span>
            <span>CRUD</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Next.js</span>
            <span>Supabase</span>
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="text-center p-4">
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-white font-medium text-sm">Instant CRUD</div>
          <div className="text-slate-500 text-xs">5 endpoints in seconds</div>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl mb-2">🛡️</div>
          <div className="text-white font-medium text-sm">Built-in Validation</div>
          <div className="text-slate-500 text-xs">Zod schema generation</div>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl mb-2">📖</div>
          <div className="text-white font-medium text-sm">Auto Documentation</div>
          <div className="text-slate-500 text-xs">OpenAPI 3.0 spec</div>
        </div>
      </div>
    </div>
  );
}
