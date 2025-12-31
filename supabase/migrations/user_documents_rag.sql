-- =============================================
-- USER DOCUMENTS RAG SYSTEM
-- Personal document storage with vector search
-- =============================================

-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================
-- 1. DOCUMENT FOLDERS
-- User-created folders for organization
-- =============================================
CREATE TABLE IF NOT EXISTS user_document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_folder_id UUID REFERENCES user_document_folders(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#3b82f6', -- Folder color for UI
  icon TEXT DEFAULT 'folder', -- Icon name
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique folder names within same parent for same user
  UNIQUE(user_id, parent_folder_id, name)
);

-- Index for fast folder lookups
CREATE INDEX IF NOT EXISTS idx_user_document_folders_user_id ON user_document_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_user_document_folders_parent ON user_document_folders(parent_folder_id);

-- =============================================
-- 2. USER DOCUMENTS
-- Metadata for uploaded files
-- =============================================
CREATE TABLE IF NOT EXISTS user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES user_document_folders(id) ON DELETE SET NULL,

  -- File info
  name TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'pdf', 'docx', 'xlsx', 'txt'
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL, -- bytes
  storage_path TEXT NOT NULL, -- Path in Supabase Storage

  -- Processing status
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'ready', 'error'
  error_message TEXT,
  chunk_count INTEGER DEFAULT 0,

  -- Metadata
  page_count INTEGER, -- For PDFs
  word_count INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_folder_id ON user_documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_status ON user_documents(status);

-- =============================================
-- 3. DOCUMENT CHUNKS
-- Chunked text with vector embeddings for RAG
-- =============================================
CREATE TABLE IF NOT EXISTS user_document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES user_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Chunk content
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL, -- Order within document

  -- Location info (for citations)
  page_number INTEGER, -- For PDFs
  section_title TEXT, -- If detected

  -- Vector embedding (1536 dimensions for OpenAI text-embedding-3-small)
  embedding vector(1536),

  -- Token count for context management
  token_count INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups and vector search
CREATE INDEX IF NOT EXISTS idx_user_document_chunks_document_id ON user_document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_user_document_chunks_user_id ON user_document_chunks(user_id);

-- HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_user_document_chunks_embedding ON user_document_chunks
  USING hnsw (embedding vector_cosine_ops);

-- =============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- Users can only access their own documents
-- =============================================

-- Enable RLS
ALTER TABLE user_document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_document_chunks ENABLE ROW LEVEL SECURITY;

-- Folders policies
CREATE POLICY "Users can view own folders" ON user_document_folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own folders" ON user_document_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders" ON user_document_folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders" ON user_document_folders
  FOR DELETE USING (auth.uid() = user_id);

-- Documents policies
CREATE POLICY "Users can view own documents" ON user_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own documents" ON user_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents" ON user_documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" ON user_documents
  FOR DELETE USING (auth.uid() = user_id);

-- Chunks policies
CREATE POLICY "Users can view own chunks" ON user_document_chunks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own chunks" ON user_document_chunks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chunks" ON user_document_chunks
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 5. HELPER FUNCTIONS
-- =============================================

-- Function to search user's documents by semantic similarity
CREATE OR REPLACE FUNCTION search_user_documents(
  p_user_id UUID,
  p_query_embedding vector(1536),
  p_match_count INTEGER DEFAULT 5,
  p_match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  document_name TEXT,
  folder_name TEXT,
  content TEXT,
  page_number INTEGER,
  section_title TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.document_id,
    d.name AS document_name,
    f.name AS folder_name,
    c.content,
    c.page_number,
    c.section_title,
    1 - (c.embedding <=> p_query_embedding) AS similarity
  FROM user_document_chunks c
  JOIN user_documents d ON c.document_id = d.id
  LEFT JOIN user_document_folders f ON d.folder_id = f.id
  WHERE c.user_id = p_user_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- Function to get user's document storage usage
CREATE OR REPLACE FUNCTION get_user_document_stats(p_user_id UUID)
RETURNS TABLE (
  total_documents INTEGER,
  total_folders INTEGER,
  total_size_bytes BIGINT,
  total_chunks INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM user_documents WHERE user_id = p_user_id),
    (SELECT COUNT(*)::INTEGER FROM user_document_folders WHERE user_id = p_user_id),
    (SELECT COALESCE(SUM(file_size), 0)::BIGINT FROM user_documents WHERE user_id = p_user_id),
    (SELECT COUNT(*)::INTEGER FROM user_document_chunks WHERE user_id = p_user_id);
END;
$$;

-- =============================================
-- 6. UPDATED_AT TRIGGERS
-- =============================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_user_document_folders_updated_at
  BEFORE UPDATE ON user_document_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_documents_updated_at
  BEFORE UPDATE ON user_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 7. STORAGE BUCKET (run separately in Storage settings)
-- =============================================
-- Create a bucket called 'user-documents' in Supabase Storage
-- with the following policy:
--
-- Policy name: "Users can manage own documents"
-- Allowed operations: SELECT, INSERT, UPDATE, DELETE
-- Policy: (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1])
--
-- This ensures files are stored as: {user_id}/{document_id}/{filename}
