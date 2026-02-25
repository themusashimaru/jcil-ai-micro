/** Document download section — preview/download for PDFs, Excel, Word */

'use client';

import type { Message } from '@/app/chat/types';

function getDocInfo(mimeType: string, filename: string) {
  if (mimeType.includes('spreadsheet') || mimeType.includes('xlsx') || filename.endsWith('.xlsx')) {
    return { icon: '📊', label: 'Excel Spreadsheet', color: 'from-green-600 to-green-700' };
  }
  if (mimeType.includes('document') || mimeType.includes('docx') || filename.endsWith('.docx')) {
    return { icon: '📄', label: 'Word Document', color: 'from-blue-600 to-blue-700' };
  }
  if (mimeType.includes('pdf') || filename.endsWith('.pdf')) {
    return { icon: '📑', label: 'PDF Document', color: 'from-red-600 to-red-700' };
  }
  return { icon: '📁', label: 'Document', color: 'from-gray-600 to-gray-700' };
}

interface MessageDocumentDownloadProps {
  documentDownload: NonNullable<Message['documentDownload']>;
}

export function MessageDocumentDownload({ documentDownload: doc }: MessageDocumentDownloadProps) {
  const { icon, label, color } = getDocInfo(doc.mimeType, doc.filename);

  return (
    <div className="mt-3 pt-3 border-t border-theme">
      <div className="text-xs font-medium mb-2 text-text-muted">📎 Your document is ready:</div>
      <div className="flex flex-col gap-2">
        {/* Preview Button — PDFs only */}
        {doc.canPreview && (
          <button
            className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] cursor-pointer w-full text-left bg-gradient-to-r ${color} text-white`}
            title={`Preview ${doc.filename}`}
            onClick={() => {
              const newWindow = window.open('', '_blank');
              if (newWindow) {
                newWindow.document.write(`
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <title>${doc.filename}</title>
                    <style>
                      body { margin: 0; padding: 0; background: #1a1a2e; display: flex; flex-direction: column; height: 100vh; }
                      .header { background: #16213e; color: white; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; }
                      .title { font-family: system-ui, sans-serif; font-size: 14px; }
                      .download-btn { background: #4ade80; color: #000; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; }
                      .download-btn:hover { background: #22c55e; }
                      iframe { flex: 1; border: none; }
                    </style>
                  </head>
                  <body>
                    <div class="header">
                      <span class="title">📑 ${doc.filename}</span>
                      <button class="download-btn" onclick="downloadFile()">⬇️ Download</button>
                    </div>
                    <iframe src="${doc.dataUrl}"></iframe>
                    <script>
                      function downloadFile() {
                        const link = document.createElement('a');
                        link.href = '${doc.dataUrl}';
                        link.download = '${doc.filename}';
                        link.click();
                      }
                    </script>
                  </body>
                  </html>
                `);
                newWindow.document.close();
              }
            }}
          >
            <span className="text-lg">{icon}</span>
            <div className="flex-1">
              <div className="font-semibold">Preview {label}</div>
              <div className="text-xs opacity-80 truncate max-w-[200px]">{doc.filename}</div>
            </div>
            <svg
              className="h-5 w-5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </button>
        )}

        {/* Download Button */}
        <button
          className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] cursor-pointer w-full text-left ${
            doc.canPreview
              ? 'bg-white/10 text-white border border-white/20'
              : `bg-gradient-to-r ${color} text-white`
          }`}
          title={`Download ${doc.filename}`}
          onClick={() => {
            if (doc.dataUrl.startsWith('http://') || doc.dataUrl.startsWith('https://')) {
              window.open(doc.dataUrl, '_blank');
            } else {
              const link = document.createElement('a');
              link.href = doc.dataUrl;
              link.download = doc.filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }}
        >
          <span className="text-lg">{icon}</span>
          <div className="flex-1">
            <div className="font-semibold">Download {label}</div>
            <div className="text-xs opacity-80 truncate max-w-[200px]">{doc.filename}</div>
          </div>
          <svg
            className="h-5 w-5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
