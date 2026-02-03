SELECT 
  source_id,
  LEFT(chunk_text, 30) as preview,
  (embedding::text)[1:100] as embedding_preview
FROM chunks 
LIMIT 5;