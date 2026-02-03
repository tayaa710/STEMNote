-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create chunks table for RAG storage
-- Stores text chunks extracted from pages and PDFs with their embeddings
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('page', 'pdf')),
  source_id TEXT NOT NULL,
  page_index INTEGER,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for filtering by folder (most queries will filter by folder_id)
CREATE INDEX chunks_folder_id_idx ON chunks(folder_id);

-- Index for finding existing chunks by source (for upsert/delete operations)
CREATE INDEX chunks_source_idx ON chunks(source_type, source_id);

-- Vector similarity search index using IVFFlat
-- Note: IVFFlat works best with existing data; for small datasets exact search is used
CREATE INDEX chunks_embedding_idx ON chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
