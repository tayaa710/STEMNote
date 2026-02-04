# Tasks (One at a time)

Operating rules:
- Do one task per branch/PR.
- Keep diffs small and reviewable.
- Do not add dependencies without listing them and reason.
- Do not implement future tasks early.
- Keep MVP local-only: no login, no sync.

Definition of Done (DoD) for any task:
- App builds on iOS simulator.
- No TypeScript errors.
- Basic happy-path works.

## Task 1 — Project bootstrap (RN + TypeScript + iPad simulator) ✅ DONE
Goal:
- Create a React Native TypeScript app and run it on iOS simulator.

Constraints:
- No extra libs beyond what RN template provides.
- Provide exact commands to run.

DoD:
- `npm run ios` launches app in iPad simulator successfully.

## Task 2 — Repo structure + basic navigation ✅ DONE
Goal:
- Add folder structure under app/src (screens/components/storage/etc.)
- Add basic navigation between screens with placeholders.

Allowed:
- Add a navigation library if necessary (must explain choice).
- No persistence yet.

DoD:
- Can navigate: FolderList -> NoteList -> PageEditor.

## Task 3 — Local storage with AsyncStorage ✅ DONE
Goal:
- Add AsyncStorage for local persistence.
- Implement storage layer for folders.

Constraints:
- No cloud, no Supabase.
- Start with AsyncStorage (defer SQLite for later).

DoD:
- Create folder, restart app, folder still exists.

## Task 4 — FolderListScreen with Persistence ✅ DONE
Goal:
- Implement folder CRUD (create/delete) with AsyncStorage persistence.
- Full UI with FlatList, input, delete confirmations.

DoD:
- Folder CRUD works reliably.
- Folders persist across app restarts.

## Task 5 — NoteListScreen with Persistence ✅ DONE
Goal:
- Notes inside a folder; CRUD notes.
- Implement note CRUD (create/delete) with AsyncStorage persistence.
- Notes scoped to folders.

DoD:
- Notes persist and are scoped to folderId.
- Navigate to PageEditor with (folderId, noteId, pageIndex).

## Task 6 — Pages inside a Note (no drawing) ✅ DONE
Goal:
- Implement page model with local persistence (AsyncStorage).
- PageEditorScreen displays current page and supports navigation.
- Each note can have multiple pages (pageIndex: 0, 1, 2...).
- Page navigation: Previous/Next/Create New Page.
- NO drawing yet (placeholder page content).

Constraints:
- Continue using AsyncStorage (no SQLite yet).
- No canvas/drawing implementation.
- No AI, no Supabase.

DoD:
- Create page 1, page 2, reopen later.
- Pages persist and are scoped to noteId.
- Page navigation works (prev/next/add).

## Task 7 — DrawingCanvas MVP (Skia) ✅ DONE
Goal:
- Implement basic drawing: pen, eraser, undo/redo, clear.
- Save/load drawing data to AsyncStorage (or migrate to SQLite if needed).

Constraints:
- No AI, no export yet.

DoD:
- Draw, close page, reopen, drawing remains.

## Task 8 — Render/export full page to PNG ✅ DONE
Goal:
- Render the page to an image file at stable resolution.

DoD:
- Exported PNG exists on device and visually matches page.
New deps:
- None (used existing react-native-fs)

## Task 9 — Selection mode + region export ✅ DONE
Goal:
- Add selection mode:
  - user lassos a region (simple bounding box is acceptable)
  - export region PNG

DoD:
- Region export works and matches selected area.

New deps:
- None (used existing @shopify/react-native-skia and react-native-fs)

## Task 10 — AskSheet UI (no backend yet) ✅ DONE
Goal:
- UI panel with question input and answer view.
- For now, return a mocked answer.

DoD:
- Can ask and see response; citations UI present (mocked).

Implementation:
- AskSheet component with slide-up bottom panel
- Green "Ask" button in PageEditorScreen
- Mock answer generation with 500-800ms delay
- Citations display with page references
- iPad keyboard handling with KeyboardAvoidingView
- Zero new dependencies (used React Native Animated, Modal)

Files created:
- src/types/ai.ts (Citation interface)
- src/components/AskSheet.tsx (~400 lines)

Files modified:
- src/screens/PageEditorScreen.tsx (Ask button + integration)

New deps:
- None

## Task 11 — Supabase project wiring (backend skeleton) ✅ DONE
Goal:
- Add `ai/apiClient.ts` that calls Supabase Edge Functions.
- Add placeholders for endpoints:
  - /askRegion
  - /indexPage
  - /indexPdf

DoD:
- App can hit a test endpoint and display response.

Implementation:
- Created ai/apiClient.ts with typed API client
- Implemented discriminated union error handling (ApiResponse<T>)
- Created health Edge Function for connectivity testing
- Environment configuration via react-native-config
- CORS headers pattern for Edge Functions

Files created:
- src/ai/apiClient.ts (~100 lines)
- supabase/functions/health/index.ts
- supabase/functions/health/deno.json

New deps:
- react-native-config (environment variables)

## Task 12 — /askRegion minimal (no RAG yet) ✅ DONE
Goal:
- Implement /askRegion to answer using region image only.

DoD:
- Real answer returned for region+question.

Implementation:
- OpenAI GPT-4o Vision API for image analysis
- STEM-focused system prompt for handwritten notes/equations
- LaTeX rendering with KaTeX via WebView (MathText component)
- Supports inline ($...$) and display ($$...$$, \[...\]) math
- Region capture on Ask button tap (selection or full page fallback)
- Proper error handling with typed responses
- 55-second timeout for long AI responses

Files created:
- supabase/functions/askRegion/index.ts (~150 lines)
- supabase/functions/askRegion/deno.json
- src/components/MathText.tsx (~130 lines)

Files modified:
- src/components/AskSheet.tsx (real API integration + MathText)
- src/screens/PageEditorScreen.tsx (region capture on Ask)
- supabase/config.toml (askRegion function config)
- supabase/.env.example (OPENAI_API_KEY template)
- README.md (setup instructions)

New deps:
- react-native-webview (for KaTeX rendering)

Environment setup required:
- OPENAI_API_KEY in supabase/.env.local for local dev
- Set via `supabase secrets set` for production

## Task 13 — Indexing pages into chunks (server) ✅ DONE
Goal:
- Implement /indexPage pipeline to enable RAG in future tasks.
- Extract text from page images using OCR/multimodal.
- Split text into chunks suitable for embedding.
- Compute embeddings and store in Supabase chunks table.

Detailed requirements:
1. Create Supabase migration for chunks table:
   ```sql
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
   CREATE INDEX chunks_folder_id_idx ON chunks(folder_id);
   CREATE INDEX chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops);
   ```

2. Implement /indexPage Edge Function:
   - Input: { folderId, noteId, pageId, pageImageBase64 }
   - Use GPT-4o to extract text from page image
   - Split into ~200-400 token chunks with overlap
   - Generate embeddings using OpenAI text-embedding-3-small
   - Upsert chunks (delete old chunks for pageId first)
   - Output: { ok: boolean, chunksUpserted: number }

3. Trigger indexing on page save in app:
   - Add indexing status to page model (queued|running|done|error)
   - Call /indexPage after page is saved
   - Show indexing indicator in UI

DoD:
- After saving a page, chunks exist in database.
- Re-indexing a page replaces old chunks.
- Indexing status visible in UI.

Implementation:
- Database migration with pgvector extension and chunks table
- GPT-4o extracts text from page images with STEM-focused prompt
- Text chunked at ~250 tokens with 50-token overlap
- Embeddings generated via OpenAI text-embedding-3-small (1536 dimensions)
- **Manual indexing via "Index Note" button** (not auto-indexing, to control costs)
- Sequential page processing with 500ms delays to avoid rate limits
- **Smart change detection**: Content hash tracks drawing changes
- Pages skipped only if: hash unchanged AND within 5-minute cooldown
- Modified pages re-indexed immediately regardless of cooldown
- Progress indicator shows "2/5" during indexing
- Results alert shows indexed/skipped/failed counts

Files created:
- supabase/migrations/20250203000000_create_chunks_table.sql
- supabase/functions/indexPage/index.ts (~350 lines)
- supabase/functions/indexPage/deno.json
- src/ai/indexingService.ts (~230 lines, includes indexNote function)

Files modified:
- src/types/models.ts (IndexStatus type, Page interface with indexing fields)
- src/storage/pages.ts (updatePageIndexStatus, getPageById functions)
- src/ai/apiClient.ts (IndexPageRequest/Response types)
- src/screens/PageEditorScreen.tsx (Index Note button, progress UI)
- supabase/config.toml (indexPage function config)
- README.md (indexPage docs, database schema docs, indexing guide)

New deps:
- None (uses existing packages)

Cost considerations:
- GPT-4o Vision: ~$0.01-0.05 per page
- Embeddings: ~$0.0001 per page (negligible)
- Manual indexing prevents unexpected costs

## Task 14 — Folder RAG (retrieve + answer) ✅ DONE
Goal:
- Enhance /askRegion to retrieve relevant context from indexed pages.
- Return real citations pointing to source pages.

Detailed requirements:
1. Update /askRegion to perform RAG:
   - Extract query from question + optional region transcription
   - Embed query using same embedding model
   - Vector search: find top-K (K=8) chunks in same folder
   - Include retrieved chunks in GPT-4o context
   - Ask model to cite sources in response

2. Citation format in response:
   ```json
   {
     "citations": [
       {
         "id": "chunk-uuid",
         "sourceType": "page",
         "sourceId": "page-uuid",
         "noteId": "note-uuid",
         "pageIndex": 2,
         "title": "Note Name - Page 3",
         "snippet": "relevant text from chunk..."
       }
     ]
   }
   ```

3. App integration:
   - Pass folderId to askRegion API
   - Display real citations in AskSheet
   - Make citations tappable to navigate to source page

DoD:
- Answers reference content from other pages in folder.
- Citations point to real pages with correct navigation.
- Works with 0 indexed pages (falls back to image-only).

Implementation:
- **Hybrid RAG retrieval**: Small folders (≤30 chunks) include ALL chunks; large folders use similarity search
- **Model**: Switched to gpt-4o-mini for 94% cost savings
- **match_chunks()**: Database function for vector similarity search
- **Tappable citations**: Navigate to source page on tap (same note = setParams, different note = push)
- **Gesture fix**: Disabled swipe-back on PageEditorScreen to prevent interference with drawing

Files created:
- supabase/migrations/20250204000000_add_match_chunks_function.sql

Files modified:
- supabase/functions/askRegion/index.ts (RAG retrieval, hybrid approach, gpt-4o-mini)
- supabase/functions/indexPage/index.ts (switched to gpt-4o-mini)
- src/ai/apiClient.ts (updated request/response types)
- src/types/ai.ts (updated Citation type)
- src/components/AskSheet.tsx (folderId, tappable citations)
- src/screens/PageEditorScreen.tsx (pass folderId, navigation callback)
- src/navigation/AppNavigator.tsx (disable swipe-back gesture)

## Task 15 — PDF ingestion
Goal:
- Allow users to import PDFs into folders.
- Index PDF text for RAG retrieval.

Detailed requirements:
1. PDF import UI:
   - Add "Import PDF" button to NoteListScreen
   - Use document picker to select PDF file
   - Store PDF in app documents directory
   - Create PDF entry in local storage

2. PDF storage model:
   ```typescript
   interface PdfDocument {
     id: string;
     folderId: string;
     fileName: string;
     filePath: string;
     pageCount: number;
     createdAt: number;
     indexedAt: number | null;
   }
   ```

3. PDF text extraction:
   - Option A: Extract text client-side using react-native-pdf
   - Option B: Upload to Supabase Storage, extract server-side
   - Send text by page to /indexPdf endpoint

4. Implement /indexPdf Edge Function:
   - Input: { folderId, pdfId, pdfTextByPage: [{pageIndex, text}] }
   - Chunk and embed each page's text
   - Store with source_type='pdf'
   - Output: { ok: boolean, chunksUpserted: number }

5. PDF viewer (optional for MVP):
   - Simple PDF viewer screen
   - Navigate from citation to specific PDF page

DoD:
- Can import PDF into folder.
- Asking questions can reference PDF content.
- Citations link to PDF with page number.

New deps (estimated):
- react-native-document-picker
- react-native-pdf or similar

## Task 16 — Quality and guardrails
Goal:
- Improve reliability, error handling, and user experience.
- Add safeguards against abuse and failures.

Detailed requirements:
1. Rate limiting:
   - Server-side: Track requests per device/IP
   - Client-side: Debounce rapid submissions
   - Show "Please wait..." message when rate limited

2. Error handling improvements:
   - Network connectivity detection
   - Retry logic with exponential backoff
   - Graceful degradation (show cached answers if available)
   - User-friendly error messages for all failure modes

3. Input validation:
   - Question length limit (1000 chars)
   - Image size limit (4MB)
   - Sanitize inputs before sending to API

4. Loading states:
   - Skeleton loading for long operations
   - Cancel button for in-flight requests
   - Progress indicator for indexing

5. Caching:
   - Cache recent answers locally
   - Cache embeddings to avoid re-indexing unchanged pages
   - Implement cache invalidation strategy

6. Accessibility:
   - VoiceOver support for key interactions
   - Dynamic type support
   - Sufficient color contrast

DoD:
- Failures show clear, actionable UI messages.
- No app crashes from API errors.
- Rate limiting prevents abuse.
- Basic accessibility requirements met.

---

## Future Tasks (Post-MVP)

### Task 17 — Drawing improvements
- PencilKit bridge for Apple Pencil optimization
- Pressure sensitivity
- More pen/brush options
- Zoom and pan canvas

### Task 18 — User accounts and sync
- Supabase Auth integration
- Cloud sync for folders/notes/pages
- Conflict resolution for offline edits

### Task 19 — Collaboration
- Share folders with other users
- Real-time collaboration on pages
- Comments and annotations

### Task 20 — Advanced AI features
- Claude integration for reasoning-heavy answers
- Multi-turn conversations about a region
- Suggested follow-up questions
- Answer history per page
