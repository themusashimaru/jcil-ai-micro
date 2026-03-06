'use client';

/**
 * MY FILES PANEL
 *
 * Collapsible panel in sidebar for managing user's RAG documents.
 * Upload PDFs, Word docs, Excel files - AI can reference them in chat.
 *
 * Admin-only for now (testing phase).
 */

import { formatFileSize } from './my-files-types';
import { useMyFiles } from './useMyFiles';
import FileItem from './FileItem';
import FolderItem from './FolderItem';
import MyFilesContextMenu from './MyFilesContextMenu';
import FolderModal from './FolderModal';

export default function MyFilesPanel() {
  const {
    isExpanded,
    setIsExpanded,
    showInfoTooltip,
    setShowInfoTooltip,
    folders,
    documents,
    stats,
    isLoading,
    isUploading,
    uploadProgress,
    error,
    setError,
    expandedFolders,
    fileInputRef,
    showFolderModal,
    setShowFolderModal,
    editingFolder,
    folderName,
    setFolderName,
    folderColor,
    setFolderColor,
    isSavingFolder,
    contextMenu,
    showMoveMenu,
    setShowMoveMenu,
    handleFileSelect,
    handleDeleteFile,
    handleCreateFolder,
    handleEditFolder,
    handleSaveFolder,
    handleDeleteFolder,
    handleMoveFile,
    toggleFolder,
    handleContextMenu,
    rootDocs,
    folderDocs,
  } = useMyFiles();

  return (
    <div className="relative border-b border-theme">
      {/* Header Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full p-3 flex items-center justify-between hover:bg-opacity-50 transition-colors ${isExpanded ? 'bg-glass' : 'bg-transparent'}`}
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
            />
          </svg>
          <span className="text-sm font-medium text-text-primary">My Files</span>
          {stats && stats.total_documents > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary text-white">
              {stats.total_documents}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Info icon */}
          <div
            className="p-1 rounded-full hover:bg-opacity-20 bg-glass"
            onClick={(e) => {
              e.stopPropagation();
              setShowInfoTooltip(!showInfoTooltip);
            }}
          >
            <svg
              className="w-4 h-4 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          {/* Chevron */}
          <svg
            className={`w-4 h-4 transition-transform text-text-muted ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Info Tooltip */}
      {showInfoTooltip && (
        <div
          className="absolute left-3 right-3 z-50 p-3 rounded-lg shadow-lg text-sm bg-background border border-theme text-text-primary"
          style={{
            top: '100%',
          }}
        >
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <div>
              <p className="font-medium mb-1">Your Personal Knowledge Base</p>
              <p className="text-text-secondary">
                Upload PDFs, Word docs, or Excel files. The AI can then search and reference your
                documents when answering questions!
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInfoTooltip(false);
                }}
                className="mt-2 text-xs underline text-primary"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-2">
          {/* Action Buttons Row */}
          <div className="flex gap-2 mb-3">
            {/* Upload Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv"
              multiple
              onChange={(e) => handleFileSelect(e)}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors bg-glass text-text-primary border border-dashed border-theme ${
                isUploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isUploading ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="text-xs truncate max-w-[120px]">
                    {uploadProgress || 'Uploading...'}
                  </span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  <span className="text-xs">Upload</span>
                </>
              )}
            </label>

            {/* New Folder Button */}
            <button
              onClick={handleCreateFolder}
              className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg transition-colors bg-glass border border-theme text-text-primary"
              title="New Folder"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                />
              </svg>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="mb-3 p-2 rounded-lg text-xs text-red-500"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
            >
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">
                Dismiss
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <svg className="w-5 h-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && documents.length === 0 && folders.length === 0 && (
            <div className="text-center py-4">
              <svg
                className="w-8 h-8 mx-auto mb-2 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-sm text-text-muted">No files yet</p>
              <p className="text-xs mt-1 text-text-muted">Upload PDFs, Word, or Excel</p>
            </div>
          )}

          {/* Files & Folders List */}
          {!isLoading && (documents.length > 0 || folders.length > 0) && (
            <div
              className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin"
              style={{ scrollbarWidth: 'thin' }}
            >
              {/* Folders */}
              {folders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  isExpanded={expandedFolders.has(folder.id)}
                  docs={folderDocs(folder.id)}
                  allFolders={folders}
                  showMoveMenu={showMoveMenu}
                  setShowMoveMenu={setShowMoveMenu}
                  onToggle={toggleFolder}
                  onEdit={handleEditFolder}
                  onContextMenu={handleContextMenu}
                  onMoveFile={handleMoveFile}
                  onDeleteFile={handleDeleteFile}
                  onFileContextMenu={handleContextMenu}
                />
              ))}

              {/* Root Documents (no folder) */}
              {rootDocs.length > 0 && folders.length > 0 && (
                <div className="pt-2 mt-2 border-t border-theme">
                  <p className="text-xs px-2 mb-1 text-text-muted">Unfiled</p>
                </div>
              )}
              {rootDocs.map((doc) => (
                <FileItem
                  key={doc.id}
                  doc={doc}
                  folders={folders}
                  currentFolderId={null}
                  showMoveMenu={showMoveMenu}
                  setShowMoveMenu={setShowMoveMenu}
                  onMove={handleMoveFile}
                  onDelete={handleDeleteFile}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </div>
          )}

          {/* Stats */}
          {stats && stats.total_documents > 0 && (
            <div className="mt-3 pt-2 text-xs border-t border-theme text-text-muted">
              {stats.total_documents} file{stats.total_documents !== 1 ? 's' : ''} ·{' '}
              {formatFileSize(stats.total_size_bytes)}
            </div>
          )}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <MyFilesContextMenu
          contextMenu={contextMenu}
          folders={folders}
          onEditFolder={handleEditFolder}
          onDeleteFolder={handleDeleteFolder}
          onMoveFile={handleMoveFile}
          onDeleteFile={handleDeleteFile}
        />
      )}

      {/* Folder Modal */}
      {showFolderModal && (
        <FolderModal
          editingFolder={editingFolder}
          folderName={folderName}
          setFolderName={setFolderName}
          folderColor={folderColor}
          setFolderColor={setFolderColor}
          isSavingFolder={isSavingFolder}
          onSave={handleSaveFolder}
          onClose={() => setShowFolderModal(false)}
        />
      )}
    </div>
  );
}
