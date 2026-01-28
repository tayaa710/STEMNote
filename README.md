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
  - embeddings for retrieval
  - multimodal for interpreting region/page images (if needed)