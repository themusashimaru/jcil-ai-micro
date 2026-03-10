export interface Folder {
  id: string;
  name: string;
  color: string;
  parent_folder_id: string | null;
}

export interface Document {
  id: string;
  name: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  folder_id: string | null;
  created_at: string;
}

export interface UserStats {
  total_documents: number;
  total_folders: number;
  total_size_bytes: number;
  total_chunks: number;
}

export const FOLDER_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
