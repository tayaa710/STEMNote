# Context Notes (iPad)

Context Notes is an iPad-first note-taking app for handwritten math/derivations.
Users draw on pages inside folders. They can select a region (lasso/circle) and ask an AI
to explain or debug their work using context from the entire folder (other pages + PDFs).

## MVP Scope (NO login/sync)
- Local-only storage on device
- Folders -> Notes -> Pages
- Drawing on pages
- Manual selection mode (lasso) to choose a region
- "Ask" panel that returns an AI answer
- Folder context (RAG) using indexed pages + PDFs
- Citations in answers (which page(s) were used)

## Non-goals (for MVP)
- No accounts / auth
- No cloud sync
- No collaboration
- No fancy templates or infinite canvas
- No stroke-level math parsing (we rely on image+text indexing)

## Tech Stack
App:
- React Native + TypeScript
- iPad-first navigation
- Drawing surface: RN Skia (MVP), PencilKit bridge later if needed
- Local persistence: SQLite (recommended) or equivalent

Backend (MVP):
- Supabase Edge Functions (TypeScript) for AI calls and indexing endpoints
- Supabase Postgres for chunk storage + vector search
- Supabase Storage for optional PDFs/images (can be deferred; local files OK initially)

AI Providers:
- Anthropic:
  - Claude Code for building the repo
  - Claude API optionally for reasoning answers
- OpenAI:
  - GPT-4o for vision-based question answering (askRegion)
  - GPT-4o for text extraction from page images (indexPage)
  - text-embedding-3-small for chunk embeddings (RAG)

Database:
- PostgreSQL with pgvector extension for vector similarity search
- `chunks` table stores indexed text chunks with 1536-dimensional embeddings

## Local Development Setup

### Prerequisites
- Node.js 18+
- Xcode (for iOS)
- Supabase CLI (`npm install -g supabase`)
- OpenAI API key

### 1. Install dependencies
```bash
npm install
cd ios && pod install && cd ..
```

### 2. Configure environment
```bash
# Copy and edit the app config
cp .env.example .env
# Edit .env with your Supabase URL

# Copy and edit the Edge Functions config
cp supabase/.env.example supabase/.env.local
# Edit supabase/.env.local with your OPENAI_API_KEY
```

### 3. Start Supabase locally
```bash
supabase start
```

### 4. Start Edge Functions
```bash
supabase functions serve --no-verify-jwt --env-file ./supabase/.env.local
```

### 5. Run the app
```bash
# iOS Simulator
npx react-native run-ios

# Physical device (update .env with your Mac's IP first)
npx react-native run-ios --device
```

## Edge Functions

### askRegion
Answers questions about selected page regions using OpenAI GPT-4o vision.

**Endpoint:** `POST /functions/v1/askRegion`

**Request:**
```json
{
  "pageId": "string",
  "regionImageBase64": "string",
  "question": "string"
}
```

**Response:**
```json
{
  "answer": "string",
  "citations": [{ "id": "string", "title": "string", "snippet": "string" }]
}
```

### indexPage
Index a page for RAG retrieval. Extracts text from page image, chunks it, generates embeddings, and stores in the database.

**Endpoint:** `POST /functions/v1/indexPage`

**Request:**
```json
{
  "folderId": "string",
  "noteId": "string",
  "pageId": "string",
  "pageIndex": 0,
  "pageImageBase64": "string (PNG base64)"
}
```

**Response:**
```json
{
  "ok": true,
  "chunksUpserted": 3,
  "extractedTextLength": 450
}
```

### health
Health check endpoint.

**Endpoint:** `POST /functions/v1/health`

**Response:**
```json
{
  "ok": true,
  "time": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}

## Database Schema

### chunks table
Stores indexed text chunks with embeddings for RAG retrieval.

```sql
CREATE TABLE chunks (
  id UUID PRIMARY KEY,
  folder_id TEXT NOT NULL,
  source_type TEXT NOT NULL,  -- 'page' or 'pdf'
  source_id TEXT NOT NULL,    -- pageId or pdfId
  page_index INTEGER,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536),     -- OpenAI text-embedding-3-small
  metadata JSONB,
  created_at TIMESTAMPTZ
);
```

Apply migrations:
```bash
supabase db reset  # Reset and apply all migrations
# or
supabase migration up  # Apply new migrations only
```

## Page Indexing

Indexing extracts text from your handwritten notes and stores it for RAG (Retrieval-Augmented Generation). This enables the AI to reference content from other pages when answering questions.

### How to Index

1. Open any note in the PageEditor
2. Tap the purple **"Index Note"** button
3. Wait for indexing to complete (shows progress like "2/5")
4. Results show: indexed count, skipped count, failed count

### Indexing Behavior

- **Manual only**: Indexing only happens when you tap the button (to control costs)
- **Skips empty pages**: Pages with no drawings are automatically skipped
- **Smart change detection**: Uses content hashing to detect changes—unchanged pages are skipped
- **5-minute cooldown**: Recently indexed, unchanged pages are skipped to avoid redundant API calls
- **Re-index on change**: If you modify a page, it will be re-indexed immediately regardless of cooldown
- **Sequential processing**: Pages are indexed one at a time with 500ms delays to avoid rate limits

### Cost Considerations

Each page indexing call uses:
- **GPT-4o Vision**: ~$0.01-0.05 per page (for text extraction)
- **Embeddings**: ~$0.0001 per page (negligible)

For a 10-page note, expect ~$0.10-0.50 per full index.