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
  - Embeddings for retrieval (future)

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