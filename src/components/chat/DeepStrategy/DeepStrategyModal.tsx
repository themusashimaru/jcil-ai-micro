'use client';

/**
 * DEEP STRATEGY MODAL
 *
 * Two-step modal for launching the Deep Strategy Agent.
 * Step 1: Upload documents (resume, contracts, photos, etc.)
 * Step 2: Technical overview and confirmation
 */

import { useState, useEffect, useRef, ChangeEvent, DragEvent } from 'react';
import {
  X,
  Zap,
  Brain,
  Search,
  Shield,
  Sparkles,
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Paperclip,
  Globe,
  Code,
  Camera,
  AlertTriangle,
  Bot,
  Network,
} from 'lucide-react';

export interface StrategyAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string; // base64
  preview?: string; // for images
}

interface DeepStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (attachments: StrategyAttachment[]) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export function DeepStrategyModal({ isOpen, onClose, onStart }: DeepStrategyModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [step, setStep] = useState<1 | 2>(1);
  const [attachments, setAttachments] = useState<StrategyAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setUploadError(null);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // File processing
  const processFile = async (file: File): Promise<StrategyAttachment | null> => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError(`File type not supported: ${file.type}`);
      return null;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`File too large: ${file.name} (max 10MB)`);
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const attachment: StrategyAttachment = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          content: base64,
        };

        // Create preview for images
        if (file.type.startsWith('image/')) {
          attachment.preview = base64;
        }

        resolve(attachment);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    setUploadError(null);

    const newAttachments: StrategyAttachment[] = [];
    for (const file of Array.from(files)) {
      const attachment = await processFile(file);
      if (attachment) {
        newAttachments.push(attachment);
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    return FileText;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={modalRef}
        className="relative w-full max-w-lg mx-4 bg-gray-900 rounded-2xl shadow-2xl border border-purple-500/30 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Header - Always visible */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Brain className="w-16 h-16 text-purple-400" />
                <Zap className="absolute -top-1 -right-1 w-6 h-6 text-yellow-400 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Deep Strategy Mode</h2>
            <p className="text-gray-400 text-sm">
              {step === 1
                ? 'Upload any relevant documents to give context'
                : 'Ready to deploy the most advanced AI strategy system'}
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step === 1 ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'
              }`}
            >
              1
            </div>
            <div className="w-8 h-0.5 bg-gray-700" />
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step === 2 ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'
              }`}
            >
              2
            </div>
          </div>

          {/* Step 1: Upload documents */}
          {step === 1 && (
            <>
              {/* Upload area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-xl p-6 mb-4 cursor-pointer
                  transition-all duration-200 text-center
                  ${
                    isDragging
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ALLOWED_TYPES.join(',')}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleFileSelect(e.target.files)}
                  className="hidden"
                />
                <Upload
                  className={`w-8 h-8 mx-auto mb-3 ${isDragging ? 'text-purple-400' : 'text-gray-500'}`}
                />
                <p className="text-sm text-gray-300 mb-1">
                  Drop files here or <span className="text-purple-400">browse</span>
                </p>
                <p className="text-xs text-gray-500">
                  Resume, contracts, photos, spreadsheets, PDFs (max 10MB each)
                </p>
              </div>

              {/* Error message */}
              {uploadError && (
                <p className="text-red-400 text-sm mb-4 text-center">{uploadError}</p>
              )}

              {/* Uploaded files list */}
              {attachments.length > 0 && (
                <div className="space-y-2 mb-6 max-h-40 overflow-y-auto">
                  {attachments.map((attachment) => {
                    const FileIcon = getFileIcon(attachment.type);
                    return (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg"
                      >
                        {attachment.preview ? (
                          <img
                            src={attachment.preview}
                            alt={attachment.name}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center">
                            <FileIcon className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{attachment.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(attachment.size)}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAttachment(attachment.id);
                          }}
                          className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Skip / Continue buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-4 py-3 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors font-medium"
                >
                  Skip
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {attachments.length > 0 && (
                <p className="text-xs text-gray-500 text-center mt-3">
                  <Paperclip className="w-3 h-3 inline mr-1" />
                  {attachments.length} file{attachments.length !== 1 ? 's' : ''} ready
                </p>
              )}
            </>
          )}

          {/* Step 2: Technical overview and confirm launch */}
          {step === 2 && (
            <>
              {/* Premium Feature Badge */}
              <div className="bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Premium Member Feature</p>
                    <p className="text-xs text-gray-400">
                      This is an extremely powerful tool. Please use responsibly.
                    </p>
                  </div>
                </div>
              </div>

              {/* Technical Architecture */}
              <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
                <h3 className="text-xs font-semibold uppercase text-gray-400 mb-3 flex items-center gap-2">
                  <Network className="w-3.5 h-3.5" />
                  Self-Replicating Agent Architecture
                </h3>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <Brain className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <span className="text-white font-medium">Opus 4.5 Master Architect</span>
                      <p className="text-xs text-gray-500">
                        Designs and spawns specialized agent army
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <span className="text-white font-medium">Sonnet 4.5 Project Managers</span>
                      <p className="text-xs text-gray-500">Coordinate domain research teams</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <span className="text-white font-medium">Up to 100 Haiku 4.5 Scouts</span>
                      <p className="text-xs text-gray-500">
                        Parallel research army, self-replicating as needed
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Research Capabilities */}
              <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
                <h3 className="text-xs font-semibold uppercase text-gray-400 mb-3 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" />
                  Research Capabilities
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-900/50 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Search className="w-3.5 h-3.5 text-yellow-400" />
                      <span className="text-xs font-medium text-white">Brave Search</span>
                    </div>
                    <p className="text-xs text-gray-500">Hundreds of real-time web searches</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-xs font-medium text-white">Puppeteer Browser</span>
                    </div>
                    <p className="text-xs text-gray-500">Visits actual websites, extracts data</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Camera className="w-3.5 h-3.5 text-pink-400" />
                      <span className="text-xs font-medium text-white">Screenshots</span>
                    </div>
                    <p className="text-xs text-gray-500">Visual analysis of web pages</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Code className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-medium text-white">Code Execution</span>
                    </div>
                    <p className="text-xs text-gray-500">Python/JS data analysis in sandbox</p>
                  </div>
                </div>
              </div>

              {/* Attachments summary */}
              {attachments.length > 0 && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mb-4">
                  <p className="text-sm text-purple-300">
                    <Paperclip className="w-4 h-4 inline mr-2" />
                    {attachments.length} document{attachments.length !== 1 ? 's' : ''} attached
                    <button
                      onClick={() => setStep(1)}
                      className="ml-2 text-purple-400 hover:text-purple-300 underline"
                    >
                      edit
                    </button>
                  </p>
                </div>
              )}

              {/* Responsible Use Warning */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200/80">
                    <p className="font-medium text-amber-300 mb-1">Responsible Use Only</p>
                    <p>
                      This tool is for legitimate research and decision-making. Do not use for
                      illegal activities, harassment, fraud, or any harmful purposes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Important notes */}
              <div className="bg-gray-800/30 rounded-lg p-3 mb-4 text-xs text-gray-400 space-y-1">
                <p>• The AI will ask clarifying questions first — tell it everything</p>
                <p>• Runs in background if you leave — results will be waiting</p>
                <p>• You can add context anytime during execution</p>
                <p>
                  • Estimated: <span className="text-white">2-10 min</span> |{' '}
                  <span className="text-white">$5-20</span> depending on complexity
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-3 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors font-medium flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={() => onStart(attachments)}
                  className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25"
                >
                  <Zap className="w-5 h-5" />
                  Launch Strategy Agent
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
