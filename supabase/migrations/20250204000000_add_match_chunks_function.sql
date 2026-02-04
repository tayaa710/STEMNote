-- Function to match chunks by embedding similarity
-- Used by askRegion for RAG retrieval
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding VECTOR(1536),
  match_folder_id TEXT,
  match_count INT DEFAULT 8,
  min_similarity FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  source_id TEXT,
  page_index INTEGER,
  chunk_text TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.source_id,
    c.page_index,
    c.chunk_text,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM chunks c
  WHERE c.folder_id = match_folder_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) >= min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
