/**
 * QUICK DATA ANALYSIS MODAL
 *
 * PURPOSE:
 * - Upload files for data analysis
 * - Provide URLs to Google Sheets/Docs for analysis
 * - Get insights, visualizations, and summaries
 */

'use client';

import { useState, useRef } from 'react';

interface QuickDataAnalysisProps {
  onAnalysisComplete?: (response: string, source: string, type: 'file' | 'url') => void;
}

export function QuickDataAnalysis({ onAnalysisComplete }: QuickDataAnalysisProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      // Check file type
      const validTypes = [
        'text/csv',
        'application/json',
        'text/plain',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/pdf',
      ];

      if (!validTypes.includes(selectedFile.type)) {
        setError('Please upload CSV, JSON, TXT, Excel, or PDF files');
        return;
      }

      setFile(selectedFile);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!url.trim() && !file) {
      setError('Please provide a URL or upload a file');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      let analysisPrompt = '';
      let sourceType: 'file' | 'url' = 'url';
      let sourceName = '';

      if (url.trim()) {
        // URL-based analysis
        sourceType = 'url';
        sourceName = url;
        analysisPrompt = `Analyze the data at this URL: ${url}

Please:
1. Access and examine the data using web search
2. Identify the data structure, columns, and data types
3. Calculate key statistics (mean, median, min, max, count, etc.)
4. Identify trends, patterns, and anomalies
5. Provide actionable insights and recommendations
6. If it's a Google Sheet/Doc, make sure to access the public sharing link

Format your response with:
- **Data Overview**: Brief description of the dataset
- **Key Statistics**: Important metrics and numbers
- **Insights**: 3-5 key findings
- **Recommendations**: Actionable next steps`;
      } else if (file) {
        // File-based analysis
        sourceType = 'file';
        sourceName = file.name;

        // Read file content
        const fileContent = await readFileContent(file);

        analysisPrompt = `Analyze this ${file.type} file named "${file.name}":

File Content (first 5000 characters):
${fileContent.substring(0, 5000)}

Please:
1. Examine the data structure and format
2. Calculate key statistics
3. Identify trends, patterns, and anomalies
4. Provide actionable insights and recommendations

Format your response with:
- **Data Overview**: Brief description of the dataset
- **Key Statistics**: Important metrics and numbers
- **Insights**: 3-5 key findings
- **Recommendations**: Actionable next steps`;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: analysisPrompt,
            },
          ],
          tool: 'data', // Use data analysis tool with web search
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze data');
      }

      const data = await response.json();
      const analysisResult = data.content as string;

      if (onAnalysisComplete) {
        onAnalysisComplete(analysisResult, sourceName, sourceType);
      }

      // Close modal after successful analysis
      setIsOpen(false);

      // Reset form
      setUrl('');
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    }

    setIsAnalyzing(false);
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  return (
    <>
      {/* Data Analysis Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800 border border-white/20 whitespace-nowrap"
        title="Analyze data from files or URLs"
      >
        Data
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl -mt-20 md:-mt-32 max-h-[90vh]">
            <div className="flex max-h-full flex-col overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-6 pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="hidden h-1.5 w-16 rounded-full bg-white/10 sm:block"
                      aria-hidden="true"
                    />
                    <h2 className="text-lg font-semibold sm:text-xl">📊 Data Analysis</h2>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
                  <div className="space-y-4">
                    {/* URL Input */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">
                        Google Sheets/Docs URL or Public Link
                      </label>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none"
                      />
                      <p className="text-xs text-gray-500">
                        Make sure the link is publicly accessible
                      </p>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 border-t border-white/10" />
                      <span className="text-sm text-gray-500">OR</span>
                      <div className="flex-1 border-t border-white/10" />
                    </div>

                    {/* File Upload */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">Upload File</label>
                      <div
                        className="relative rounded-xl border-2 border-dashed border-white/10 bg-white/5 p-6 text-center transition hover:border-white/20 hover:bg-white/10 cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv,.json,.txt,.xls,.xlsx,.pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <svg
                          className="mx-auto h-10 w-10 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        {file ? (
                          <p className="mt-2 text-sm text-white">{file.name}</p>
                        ) : (
                          <p className="mt-2 text-sm text-gray-400">
                            Click to upload CSV, JSON, Excel, or PDF
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">Max 10MB</p>
                      </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                        {error}
                      </div>
                    )}

                    {/* Analyze Button */}
                    <button
                      onClick={handleAnalyze}
                      disabled={(!url.trim() && !file) || isAnalyzing}
                      className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-gray-200 disabled:opacity-50"
                    >
                      {isAnalyzing ? 'Analyzing...' : 'Analyze Data'}
                    </button>

                    {/* Help Text */}
                    <div className="rounded-xl bg-white/5 p-4 text-xs text-gray-400">
                      <p className="font-semibold text-gray-300 mb-2">What you&apos;ll get:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>Data structure and overview</li>
                        <li>Key statistics and metrics</li>
                        <li>Trends and patterns</li>
                        <li>Actionable insights</li>
                        <li>Recommendations</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      )}
    </>
  );
}
