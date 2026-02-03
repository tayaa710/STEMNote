# Context Notes - Project State

**Last Updated:** 2026-02-03
**Current Task:** Task 13 Complete
**Status:** ✅ Page Indexing Pipeline with RAG + Change Detection

---

## Completed Tasks

### Task 1: Project Bootstrap ✅
**Goal:** Create React Native TypeScript app for iPad simulator

**Key Decisions:**
- Used React Native CLI (not Expo) for full native control
- Initialized at repo root (not `app/` subdirectory)
- TypeScript enabled by default (RN 0.83+)
- Target: iPad Pro 11-inch (M4) simulator

**Result:**
- React Native 0.83.1
- TypeScript 5.8.3
- Hermes engine enabled
- App launches successfully on iPad

---

### Task 2: Repo Structure + Basic Navigation ✅
**Goal:** Establish navigation structure with placeholder screens

**Key Decisions:**
- **Navigation library:** React Navigation (native stack)
  - Industry standard, TypeScript-first
  - iPad-friendly, minimal footprint
- **Route parameters:** Type-safe navigation with `RootStackParamList`
- **PageEditor params:** Includes `folderId`, `noteId`, `pageIndex`

**Structure:**
```
src/
├── navigation/
│   └── AppNavigator.tsx       # Stack navigator
├── screens/
│   ├── FolderListScreen.tsx   # Folders list
│   ├── NoteListScreen.tsx     # Notes in folder
│   └── PageEditorScreen.tsx   # Page drawing
└── types/
    └── navigation.ts          # Route types
```

**Dependencies Added:**
- `@react-navigation/native` ^7.1.1
- `@react-navigation/native-stack` ^7.2.1
- `react-native-screens` ^4.5.0

**Result:**
- Three navigable placeholder screens
- Type-safe navigation with params
- iPad-appropriate navigation headers

---

### Task 3: FolderListScreen with Persistence ✅
**Goal:** Implement folder CRUD with local persistence

**Key Decisions:**
- **Storage:** AsyncStorage (not SQLite yet)
  - Sufficient for folder list (simple key-value)
  - Defer SQLite until notes/pages need relational queries
- **ID generation:** `uuid` package (v4) instead of custom implementation
- **CRUD pattern:** Functions always return updated `Folder[]` for single source of truth
- **UI:** FlatList with create input, delete confirmation, navigation on tap

**Data Model:**
```typescript
interface Folder {
  id: string;        // UUID v4
  name: string;      // User-provided, max 100 chars
  createdAt: number; // Unix timestamp (ms)
  updatedAt: number; // Unix timestamp (ms)
}
```

**Storage Strategy:**
- Single AsyncStorage key: `@folders`
- JSON array of all folders
- CRUD operations: load all → modify → save all

**Structure Added:**
```
src/
├── types/
│   └── models.ts              # Data models (Folder)
├── storage/
│   └── folders.ts             # CRUD: create, load, update, delete
└── screens/
    └── FolderListScreen.tsx   # ✅ Refactored with ListHeaderComponent pattern
```

**Key Implementation Details:**
- Input section moved into `FlatList.ListHeaderComponent` (not sibling)
- `CreateFolderHeader` extracted as separate component for clarity
- Polyfill imported at app entry point ([App.tsx](App.tsx:1))

**Dependencies Added:**
- `@react-native-async-storage/async-storage` ^2.2.0
- `uuid` ^13.0.0
- `@types/uuid` ^10.0.0
- `react-native-get-random-values` ^2.0.0 (polyfill for uuid)

**Issues Encountered and Fixed:**

1. **UUID crypto.getRandomValues() Error**
   - **Problem:** `uuid` package requires `crypto.getRandomValues()` which is not available in React Native/Hermes
   - **Solution:** Added `react-native-get-random-values` polyfill
   - **Implementation:** Import polyfill at top of [App.tsx](App.tsx:1) before all other imports
   - **Status:** ✅ Fixed

2. **TextInput Touch/Tap Not Working**
   - **Problem:** TextInput had tiny tappable area, Add button often unresponsive
   - **Root Cause:** Input section as sibling of FlatList caused touch event interference
   - **Solution:** Moved input into FlatList's `ListHeaderComponent`
   - **Implementation:**
     - Created `CreateFolderHeader` component
     - Set as `ListHeaderComponent` prop on FlatList
     - Added `keyboardShouldPersistTaps="handled"`
   - **Status:** ✅ Fixed

3. **Header/Title Overlapping Input Row**
   - **Problem:** "Folders" large title overlapped with input row, making it hard to tap
   - **Root Cause:** FlatList not adjusting content insets for navigation bar with large title
   - **Solution:** Added `contentInsetAdjustmentBehavior="automatic"` to FlatList
   - **Implementation:** Single prop addition in [FolderListScreen.tsx](src/screens/FolderListScreen.tsx:140)
   - **Status:** ✅ Fixed

**Result:**
- Working folder list with persistence
- Create, delete folders (full touch area works)
- Navigate to NoteList with folderId
- Folders persist across app restarts
- Rename functionality skipped (optional)

---

### Task 4: NoteListScreen with Persistence ✅
**Goal:** Implement note CRUD with local persistence scoped to folders

**Key Decisions:**
- **Storage:** AsyncStorage with single `@notes` key (consistent with folder pattern)
- **API Design:** Folder-scoped functions to avoid UI double-filtering
  - `loadNotesByFolder(folderId)` → returns `Note[]` for that folder
  - `createNote(folderId, title)` → returns `Note[]` for that folder
  - `deleteNote(folderId, noteId)` → returns `Note[]` for that folder
- **Internal pattern:** Load all → filter → modify → save all
- **UUID polyfill:** Relies on existing `react-native-get-random-values` from Task 3
- **Cascade deletion:** Deferred to future task (folders can be deleted independently)

**Data Model:**
```typescript
interface Note {
  id: string;        // UUID v4
  folderId: string;  // Parent folder reference
  title: string;     // User-provided, max 200 chars
  createdAt: number; // Unix timestamp (ms)
  updatedAt: number; // Unix timestamp (ms)
}
```

**Storage Strategy:**
- Single AsyncStorage key: `@notes`
- JSON array of all notes
- CRUD operations: load all → filter by folderId → modify → save all → return filtered
- Public API returns folder-scoped results (no UI filtering needed)

**Structure Added:**
```
src/
├── types/
│   └── models.ts              # Added Note interface
├── storage/
│   └── notes.ts               # ✅ NEW: CRUD with folder-scoped API
└── screens/
    └── NoteListScreen.tsx     # ✅ Complete implementation
```

**Implementation Details:**
- NoteListScreen follows FolderListScreen pattern (consistent UI/UX)
- Create note with validation (not empty, max 200 chars)
- Delete note with confirmation alert
- Navigate to PageEditor with `(folderId, noteId, pageIndex: 0)`
- Loading state with ActivityIndicator
- Empty state: "No notes yet. Create one to get started."
- UI matches folder screen (same colors, spacing, card design)

**Dependencies Added:**
- None (reused existing packages)

**Manual Testing:**
- ✅ TC1: Empty state displays correctly
- ✅ TC2: Create note with title
- ✅ TC3: Validation (empty title, 201-char title)
- ✅ TC4: Multiple notes creation
- ✅ TC5: Delete note with cancel/confirm
- ✅ TC6: Navigate to PageEditor with correct params
- ✅ TC7: Notes scoped by folder (no cross-folder leakage)
- ✅ TC8: Persistence across app restarts
- ✅ TC10: Special characters (emojis, symbols) display correctly

**Result:**
- Working note list with folder-scoped persistence
- Create, delete notes within folders
- Navigate to PageEditor with correct route params
- Notes persist across app restarts
- All manual tests passed successfully
- No TypeScript errors
- Rename functionality skipped (optional)
- Cascade deletion deferred to future task

---

### Task 6: Pages inside a Note with Persistence ✅
**Goal:** Implement page model with local persistence and basic page navigation

**Key Decisions:**
- **Storage:** AsyncStorage with single `@pages` key (consistent with folders/notes pattern)
- **API Design:** Minimal API with only essential functions:
  - `loadPagesByNote(noteId)` → returns `Page[]` for that note, sorted by pageIndex
  - `createPage(noteId)` → creates new page with next pageIndex
  - `ensurePageExists(noteId, pageIndex)` → auto-creates page if missing
- **pageIndex handling:** 0-based indexing with automatic clamping to valid range
- **Auto-creation:** First page (pageIndex = 0) auto-creates when opening a note
- **Invalid pageIndex:** Clamps to last valid page, updates navigation params
- **useEffect loop prevention:** Uses `useRef` to track last processed pageIndex

**Data Model:**
```typescript
interface Page {
  id: string;           // UUID v4
  noteId: string;       // Parent note reference
  pageIndex: number;    // 0-based order within note
  createdAt: number;    // Unix timestamp (ms)
  updatedAt: number;    // Unix timestamp (ms)
  // No content field yet - drawing will be Task 7
}
```

**Storage Strategy:**
- Single AsyncStorage key: `@pages`
- JSON array of all pages across all notes
- CRUD operations: load all → filter by noteId → modify → save all → return filtered
- Pages sorted by pageIndex when returned
- Orphaned pages acceptable (cascade deletion deferred)

**Structure Added:**
```
src/
├── types/
│   └── models.ts              # Added Page interface
├── storage/
│   └── pages.ts               # ✅ NEW: Page CRUD with minimal API
└── screens/
    └── PageEditorScreen.tsx   # ✅ Fully implemented with navigation
```

**Implementation Details:**

**PageEditorScreen Features:**
1. **Page counter display**: "Page X of Y" at top
2. **Navigation controls**: Previous / Next buttons (disable at boundaries)
3. **Create button**: "+ New Page" (always enabled, shows spinner during creation)
4. **Content area**: Placeholder for future drawing canvas (Task 7)
5. **Loading states**: Spinner with "Loading page..." text
6. **Smart initialization**:
   - No pages + pageIndex 0: Auto-create first page
   - No pages + pageIndex > 0: Set to 0, then auto-create
   - Pages exist + invalid pageIndex: Clamp to last valid page
7. **Loop prevention**: Uses `lastProcessedIndex` ref to avoid setParams loops

**Dependencies Added:**
- None (reused existing packages)

**Manual Testing:**
- ✅ TC1: First page auto-creation
- ✅ TC2: Create multiple pages (tested up to 4 pages)
- ✅ TC3: Navigate between pages (Previous/Next)
- ✅ TC4: Button disable states at boundaries
- ✅ TC5: Persistence across app restarts
- ✅ TC6: Multiple notes isolation (tested 3 notes with different page counts)
- ✅ TC7: Create page at end
- ✅ TC8: Empty note → new note → first page
- ✅ TC9: Delete note with pages (orphaned pages expected)
- ✅ TC10: Loading states
- ✅ Edge cases: Invalid pageIndex clamping, rapid taps, no loops

**Result:**
- Working page system with full navigation
- Create, navigate between pages (Previous/Next/New)
- Pages persist across app restarts
- Auto-create first page when opening note
- All 10+ manual tests passed
- No TypeScript errors
- No runtime errors or crashes
- UI/UX consistent with folder/note screens
- Foundation for Task 7 drawing features

---

### Task 7: Drawing Canvas MVP (Skia) ✅
**Goal:** Implement drawing with pen/eraser, undo/redo, clear, and persistence.

**Key Decisions:**
- **Rendering:** Skia Canvas for strokes, React Native PanResponder for touch capture
- **Storage:** Separate AsyncStorage key `@pageDrawings` (pageId → JSON string of DrawingData)
- **Point Sampling:** Ignore points closer than ~2px (no Douglas–Peucker yet)
- **Eraser MVP:** Tap-to-delete stroke only (no drag erase, no path splitting)
- **Undo/Redo:** History capped at 20; stacks cleared on page change
- **Autosave:** Debounce on stroke end (500ms), plus flush on page change and app background

**Data Model:**
```typescript
interface DrawingData {
  version: number;
  strokes: Stroke[];
}

interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  tool: 'pen';
  timestamp: number;
}

interface Point {
  x: number;
  y: number;
}
```

**Storage Strategy:**
- AsyncStorage key: `@pageDrawings`
- Value: `{ [pageId: string]: string }` where string = JSON.stringify(DrawingData)

**Structure Added:**
```
src/
├── components/
│   ├── DrawingCanvas.tsx        # ✅ Skia canvas + drawing logic
│   └── DrawingToolbar.tsx       # ✅ Pen/Eraser/Undo/Redo/Clear
├── storage/
│   └── drawings.ts              # ✅ Drawing persistence helpers
└── types/
    └── models.ts                # ✅ Drawing types added
```

**Implementation Details:**
- PageEditorScreen integrates toolbar + canvas and loads/saves per-page drawings
- Autosave debounced on stroke end, with explicit flush on page change/background
- Eraser uses stroke hit-testing to remove the top-most stroke under a tap

**Dependencies Updated:**
- `@shopify/react-native-skia` ^2.4.16

**Manual Testing:**
- Not run (iOS simulator unavailable in CLI: CoreSimulatorService connection invalid)

**Result:**
- Drawing canvas MVP implemented with persistence, undo/redo, clear, and eraser

---

### Task 8: Export Full Page to PNG ✅
**Goal:** Render/export the full page drawing to a PNG at a stable resolution.

**Key Decisions:**
- **Rendering:** Reused `src/utils/exportDrawing.ts` to render strokes to an offscreen Skia surface.
- **Sizing:** Logical canvas size captured via `onLayout` and mapped to fixed export sizes.
- **Storage:** Saved PNGs to `DocumentDirectoryPath/exports` via `react-native-fs`.
- **UX:** Added `Export PNG` button with disabled/loading states and success/error alerts.

**Implementation Details:**
- `PageEditorScreen` tracks canvas size via `onLayout` and stores it in a ref/state.
- Export uses `canvasRef.getDrawingData()` (latest in-memory strokes) and flushes pending save.
- Output size uses `getExportSizeForLogicalSize` for stable portrait/landscape dimensions.
- File naming: `note_${noteId}_page_${pageIndex+1}_${timestamp}.png`

**Files Modified:**
- [src/screens/PageEditorScreen.tsx](src/screens/PageEditorScreen.tsx)

**Dependencies Added:**
- None (used existing `react-native-fs`)

**Manual Testing:**
- Not run (iOS simulator unavailable in CLI: CoreSimulatorService connection invalid)

**Result:**
- Export button saves full-page PNG to Documents/exports with stable size

---

### Task 9: Selection Mode + Region Export ✅
**Goal:** Add selection mode and export only the selected region to PNG.

**Key Decisions:**
- **Selection UX:** Rectangle selection via drag (any direction supported)
- **Tool Toggle:** Added "Select" button to DrawingToolbar alongside Pen/Eraser
- **Overlay:** Blue border (#1E90FF) + light blue fill (15% opacity)
- **Minimum Size:** 5×5 pixel threshold to avoid accidental tiny selections
- **Region Export:** Reused Skia offscreen rendering with coordinate transforms

**Data Model:**
```typescript
interface SelectionRect {
  x: number;      // top-left x (logical canvas coords)
  y: number;      // top-left y (logical canvas coords)
  width: number;  // always positive (normalized)
  height: number; // always positive (normalized)
}

type DrawingTool = 'pen' | 'eraser' | 'select';
```

**Implementation Details:**
- Selection state lifted to PageEditorScreen (not internal to DrawingCanvas)
- DrawingCanvas handles overlay rendering and drag input, calls `onSelectionChange`
- `renderRegionToPngBase64()` added to exportDrawing.ts for region cropping
- Auto-clear selection when switching tools or changing pages
- Export clears selection on success

**Files Modified:**
- `src/types/models.ts` - Added `SelectionRect`, extended `DrawingTool`
- `src/components/DrawingCanvas.tsx` - Selection overlay + input handling
- `src/components/DrawingToolbar.tsx` - Select button + Clear Sel / Export Sel buttons
- `src/screens/PageEditorScreen.tsx` - Selection state + `handleExportSelection`
- `src/utils/exportDrawing.ts` - Added `renderRegionToPngBase64()`

**Dependencies Added:**
- None (used existing @shopify/react-native-skia and react-native-fs)

**Manual Testing:**
- ✅ Select tool toggles correctly
- ✅ Drawing disabled in select mode
- ✅ Rectangle drag works in all directions (reverse drag normalized)
- ✅ Selection overlay visible (border + fill)
- ✅ Clear Selection clears overlay
- ✅ Export Selection produces correct region PNG
- ✅ Exported PNG matches visual selection
- ✅ File saved with `_region_` in filename
- ✅ Selection clears on tool/page change
- ✅ No TypeScript errors
- ✅ iOS build succeeds

**Result:**
- Selection mode works with rectangle selection
- Region export saves cropped PNG to Documents/exports
- Filename format: `note_${noteId}_page_${pageIndex+1}_region_${timestamp}.png`

---

### Task 10: AskSheet UI with Mocked Backend ✅
**Goal:** Implement UI panel for asking questions about the current page with mocked AI responses.

**Key Decisions:**
- **UX Pattern:** Slide-up bottom panel (not modal) for iPad-friendly keyboard handling
- **Animation:** React Native Animated API with spring animation (no new dependencies)
- **Keyboard Handling:** Modal + KeyboardAvoidingView for reliable iPad keyboard positioning
- **Component Structure:** Separate AskSheet.tsx component for clean separation
- **Mock Delay:** 500-800ms to simulate realistic AI response time
- **Citations:** Mock page references with title, snippet, and page number

**Data Model:**
```typescript
interface Citation {
  id: string;
  title: string;
  snippet: string;
  source: 'page' | 'external';
  pageNumber?: number;
}
```

**Implementation Details:**
- AskSheet component with question input, submit button, loading state, answer display
- Green "Ask" button in page info section (next to Export PNG)
- Panel slides up from bottom with semi-transparent backdrop
- Tap outside or X button to dismiss
- State persists when reopening (until question cleared)
- Character limit: 500 chars with counter
- Mock answer templates with realistic multi-sentence responses
- Citations display with blue left border and gray background

**Files Created:**
- `src/types/ai.ts` - Citation interface
- `src/components/AskSheet.tsx` - AskSheet component (~400 lines)

**Files Modified:**
- `src/screens/PageEditorScreen.tsx` - Added Ask button, state, and AskSheet render

**Dependencies Added:**
- None (used existing React Native Animated, Modal, KeyboardAvoidingView)

**Manual Testing:**
- Manual testing required in Xcode/Simulator (CLI build unavailable)
- TypeScript compilation: ✅ PASSED (0 errors)
- Build readiness: ✅ Code ready for iOS build

**Test Checklist:**
- Basic flow: Open → Type → Submit → Loading → Answer + Citations
- State: Clear question resets, reopen preserves state
- Keyboard: Panel adjusts above iPad keyboard
- Edge cases: Empty submit disabled, 500 char limit, orientation changes
- Integration: Drawing/export unchanged, panel doesn't interfere

**Result:**
- AskSheet UI fully implemented with mocked backend
- Green "Ask" button in PageEditorScreen
- Smooth slide-up animation with backdrop
- Realistic mock responses with citations
- iPad keyboard handling with KeyboardAvoidingView
- Zero new dependencies
- TypeScript compilation successful

---

### Task 11: Supabase Wiring + Backend Skeleton ✅
**Goal:** Add minimal Supabase wiring so the app can call Supabase Edge Functions.

**Key Decisions:**
- **Environment Variables:** `react-native-config` for build-time env injection
- **API Client Pattern:** Discriminated union responses (`ApiResponse<T>`) - no throwing
- **Error Handling:** Network, HTTP, Parse, and Config errors with typed codes
- **Debug UI:** Test button visible only in dev mode (`__DEV__`)
- **Edge Function:** Minimal `health` endpoint returning `{ok, time, version}`

**Data Model:**
```typescript
// API Response types (discriminated union)
interface ApiResult<T> { ok: true; data: T; }
interface ApiError { ok: false; error: string; code: ErrorCode; status?: number; }
type ApiResponse<T> = ApiResult<T> | ApiError;

// Health response
interface HealthResponse { ok: boolean; time: string; version: string; }
```

**Local Supabase URL Rules (IMPORTANT):**
| Environment | SUPABASE_URL | Notes |
|-------------|--------------|-------|
| iOS Simulator | `http://localhost:54321` | Simulator shares Mac's localhost |
| Physical iOS Device | `http://<Mac-LAN-IP>:54321` | Must be on same Wi-Fi |
| Android Emulator | `http://10.0.2.2:54321` | Special alias for host machine |
| Physical Android | `http://<Mac-LAN-IP>:54321` | Must be on same Wi-Fi |
| Production | `https://<project-ref>.supabase.co` | Deployed Supabase project |

**How to find Mac's LAN IP:**
```bash
ipconfig getifaddr en0
# Example: 192.168.1.42
```

**Files Created:**
- `src/ai/apiClient.ts` - Typed Supabase Edge Function client
- `src/types/env.d.ts` - TypeScript declarations for react-native-config
- `.env.example` - Template with URL configuration examples
- `supabase/functions/health/index.ts` - Health check Edge Function

**Files Modified:**
- `.gitignore` - Added `.env*` patterns (excluding `.env.example`)
- `src/screens/PageEditorScreen.tsx` - Added purple "Test" button (dev only)
- `package.json` - Added `react-native-config` dependency

**Dependencies Added:**
- `react-native-config` ^1.6.1 (build-time env variables)

**API Client Functions:**
- `checkHealth()` - Test backend connectivity
- `askRegion(request)` - (stub) Ask question about selected region
- `indexPage(request)` - (stub) Index page for RAG
- `indexPdf(request)` - (stub) Index PDF for RAG

**Manual Testing Checklist:**
1. **Supabase Local:**
   ```bash
   supabase start
   supabase functions serve --no-verify-jwt  # Required for local dev
   curl -X POST http://localhost:54321/functions/v1/health \
     -H "Authorization: Bearer <anon-key>" \
     -H "Content-Type: application/json"
   # Expected: {"ok":true,"time":"...","version":"1.0.0"}
   ```

   **Note:** Use `--no-verify-jwt` for local development. Newer Supabase CLI uses ES256 keys locally which causes JWT verification errors without this flag.

2. **iOS Simulator + Local Supabase:**
   - Set `.env`: `SUPABASE_URL=http://localhost:54321`
   - Rebuild app, tap Test button
   - Expected: Alert "Backend OK" with time/version

3. **Physical Device + Local Supabase:**
   - Get Mac LAN IP: `ipconfig getifaddr en0`
   - Set `.env`: `SUPABASE_URL=http://<LAN-IP>:54321`
   - Ensure device on same Wi-Fi
   - Rebuild app, tap Test button
   - Expected: Alert "Backend OK" with time/version

4. **Config Error Test:**
   - Remove `.env` or leave values empty
   - Rebuild app, tap Test button
   - Expected: Alert "CONFIG_ERROR: Supabase not configured"

5. **Deployed Supabase:**
   ```bash
   supabase functions deploy health
   ```
   - Set `.env` to production URL
   - Tap Test button
   - Expected: Alert "Backend OK"

**Result:**
- Supabase Edge Function client with typed responses
- Health check endpoint deployed and testable
- Purple "Test" button in dev mode for connectivity testing
- Environment variable handling via react-native-config
- Local URL rules documented for simulator vs physical device
- No AI logic yet (stubs only for future endpoints)

---

### Task 12: AI Integration - askRegion Edge Function ✅
**Goal:** Implement the askRegion Edge Function and connect AskSheet to real AI backend.

**Key Decisions:**
- **AI Model:** OpenAI GPT-4o (user preference over Claude)
- **LaTeX Rendering:** KaTeX via WebView for math expressions
- **Edge Function Pattern:** Same CORS/error handling as health function
- **Environment Variables:** `OPENAI_API_KEY` in `supabase/.env.local`

**Data Model:**
```typescript
// Request
interface AskRegionRequest {
  pageId: string;
  regionImageBase64: string;
  question: string;
}

// Response
interface AskRegionResponse {
  answer: string;
  citations: Array<{ id: string; title: string; snippet: string }>;
}

// Error codes: MISSING_PARAMS, IMAGE_TOO_LARGE, QUESTION_TOO_LONG,
//              RATE_LIMITED, API_KEY_MISSING, AI_ERROR, TIMEOUT
```

**Implementation Details:**
- Edge Function calls OpenAI GPT-4o with vision capabilities
- System prompt tuned for STEM note analysis
- 55s timeout (buffer for Supabase 60s limit)
- 4MB max image size, 1000 char max question
- Mock citations returned (real RAG deferred)
- MathText component renders LaTeX via KaTeX CDN in WebView
- Supports `$...$`, `$$...$$`, `\[...\]`, `\(...\)` delimiters

**Files Created:**
- `supabase/functions/askRegion/index.ts` - Edge Function with OpenAI integration
- `supabase/functions/askRegion/deno.json` - Deno configuration
- `supabase/.env.example` - Template for Edge Function secrets
- `src/components/MathText.tsx` - LaTeX rendering component

**Files Modified:**
- `supabase/config.toml` - Added `[functions.askRegion]` config
- `src/components/AskSheet.tsx` - Replaced mock with real API, added MathText
- `src/screens/PageEditorScreen.tsx` - Capture region image on Ask button tap
- `.env.example` - Cleaned up template
- `README.md` - Added local dev setup and API docs

**Dependencies Added:**
- `react-native-webview` ^13.x (for MathText LaTeX rendering)

**Manual Testing:**
- ✅ Edge Function responds to curl requests
- ✅ AskSheet calls real API successfully
- ✅ Region capture works (selection or full page)
- ✅ LaTeX expressions render correctly (inline and display)
- ✅ Error handling (network, rate limit, timeout)
- ✅ Works on iOS Simulator
- ✅ Works on physical iOS device (with Mac IP in .env)

**Result:**
- Real AI-powered answers for handwritten STEM notes
- LaTeX/math rendering with KaTeX
- Full error handling with user-friendly messages
- Works on both simulator and physical devices

---

### Task 13: Page Indexing Pipeline ✅
**Goal:** Implement page indexing for RAG retrieval with text extraction, chunking, and embeddings.

**Key Decisions:**
- **Manual indexing:** "Index Note" button to control costs (no auto-indexing)
- **Text extraction:** GPT-4o Vision with STEM-focused prompt
- **Chunking:** ~250 tokens per chunk with 50-token overlap
- **Embeddings:** OpenAI text-embedding-3-small (1536 dimensions)
- **Storage:** PostgreSQL with pgvector extension
- **Change detection:** Content hash to skip unchanged pages

**Data Model:**
```typescript
// Page model extended with indexing fields
interface Page {
  // ... existing fields
  indexStatus: IndexStatus;      // 'none' | 'queued' | 'running' | 'done' | 'error'
  indexedAt: number | null;      // Timestamp of last successful index
  indexError: string | null;     // Error message if failed
  lastIndexedHash: string | null; // Content hash for change detection
}
```

```sql
-- Database schema for chunks
CREATE TABLE chunks (
  id UUID PRIMARY KEY,
  folder_id TEXT NOT NULL,
  source_type TEXT NOT NULL,  -- 'page' or 'pdf'
  source_id TEXT NOT NULL,    -- pageId
  page_index INTEGER,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ
);
```

**Implementation Details:**
- Edge Function extracts text → chunks it → generates embeddings → stores in DB
- Client-side indexingService orchestrates the manual indexing flow
- Hash computed from drawing data (stroke IDs, point samples) using djb2 algorithm
- Pages skipped only if: hash unchanged AND within 5-minute cooldown
- Modified pages re-indexed immediately regardless of cooldown
- Progress UI shows "2/5" during sequential processing
- 500ms delay between pages to avoid rate limits

**Files Created:**
- `supabase/migrations/20250203000000_create_chunks_table.sql` - Database migration
- `supabase/functions/indexPage/index.ts` - Edge Function (~350 lines)
- `supabase/functions/indexPage/deno.json` - Deno configuration
- `src/ai/indexingService.ts` - Client indexing orchestration (~280 lines)

**Files Modified:**
- `src/types/models.ts` - IndexStatus type, Page indexing fields
- `src/storage/pages.ts` - updatePageIndexStatus, getPageById functions
- `src/ai/apiClient.ts` - IndexPageRequest/Response types
- `src/screens/PageEditorScreen.tsx` - Index Note button, progress UI
- `supabase/config.toml` - indexPage function config
- `README.md` - Indexing documentation

**Dependencies Added:**
- None (uses existing packages)

**Manual Testing:**
- ✅ Index Note button shows progress "2/5"
- ✅ Chunks appear in database after indexing
- ✅ Empty pages skipped (marked as done)
- ✅ Re-indexing skips unchanged pages
- ✅ Modified pages re-indexed immediately
- ✅ Results alert shows indexed/skipped/failed counts
- ✅ Error handling for API failures

**Cost Considerations:**
- GPT-4o Vision: ~$0.01-0.05 per page
- Embeddings: ~$0.0001 per page (negligible)
- 10-page note: ~$0.10-0.50 per full index

**Result:**
- Complete page indexing pipeline for RAG
- Manual indexing to control costs
- Smart change detection for efficient re-indexing
- Chunks stored with embeddings ready for similarity search

---

## Current App Structure

```
/Users/aaron/STEMNote/
├── README.md                    # Original project docs
├── ARCHITECTURE.md              # Source of truth architecture
├── TASKS.md                     # Task definitions
├── PROJECT_STATE.md             # This file
├── package.json                 # Dependencies
├── .env.example                 # ✅ Environment variable template
├── .env                         # Environment variables (gitignored)
├── App.tsx                      # App entry point
├── src/
│   ├── ai/
│   │   ├── apiClient.ts         # ✅ Supabase Edge Function client
│   │   └── indexingService.ts   # ✅ Page indexing orchestration
│   ├── components/
│   │   ├── DrawingCanvas.tsx     # ✅ Skia drawing canvas
│   │   ├── DrawingToolbar.tsx    # ✅ Drawing tools/actions
│   │   ├── AskSheet.tsx          # ✅ Ask question panel with real AI
│   │   └── MathText.tsx          # ✅ LaTeX rendering via KaTeX WebView
│   ├── navigation/
│   │   └── AppNavigator.tsx     # Navigation stack
│   ├── screens/
│   │   ├── FolderListScreen.tsx # ✅ Folder CRUD (working)
│   │   ├── NoteListScreen.tsx   # ✅ Note CRUD (working)
│   │   └── PageEditorScreen.tsx # ✅ Page navigation + drawing + Ask + Test
│   ├── storage/
│   │   ├── folders.ts           # ✅ Folder AsyncStorage CRUD
│   │   ├── notes.ts             # ✅ Note AsyncStorage CRUD
│   │   ├── pages.ts             # ✅ Page AsyncStorage CRUD
│   │   └── drawings.ts          # ✅ Drawing AsyncStorage CRUD
│   ├── utils/
│   │   └── exportDrawing.ts     # ✅ PNG export utilities
│   └── types/
│       ├── models.ts            # ✅ Data models (Folder, Note, Page, Drawing)
│       ├── navigation.ts        # ✅ Route types
│       ├── ai.ts                # ✅ AI types (Citation)
│       └── env.d.ts             # ✅ Environment variable types
├── supabase/
│   ├── .env.example             # ✅ Edge Function secrets template
│   ├── config.toml              # ✅ Supabase local config
│   ├── migrations/
│   │   └── 20250203000000_create_chunks_table.sql  # ✅ pgvector + chunks table
│   └── functions/
│       ├── health/
│       │   └── index.ts         # ✅ Health check Edge Function
│       ├── askRegion/
│       │   ├── index.ts         # ✅ AI question answering Edge Function
│       │   └── deno.json        # ✅ Deno configuration
│       └── indexPage/
│           ├── index.ts         # ✅ Page indexing Edge Function
│           └── deno.json        # ✅ Deno configuration
├── ios/                         # Native iOS project
└── android/                     # Native Android project
```

**Legend:**
- ✅ Fully implemented
- 🚧 Placeholder/partial implementation

---

## How to Run

### Prerequisites
- Node.js >= 20
- Xcode 26.2+ (macOS only)
- iPad simulator installed
- CocoaPods installed

### Commands

**Install dependencies:**
```bash
npm install
```

**Install iOS native modules:**
```bash
cd ios && pod install && cd ..
```

**Start Metro bundler:**
```bash
npm start

# If dependencies don't load, reset cache:
npm start -- --reset-cache
```

**Run on iPad simulator:**
```bash
npm run ios -- --simulator="iPad Pro 11-inch (M4)"

# Or just:
npm run ios
```

**TypeScript check:**
```bash
npx tsc --noEmit
```

**Lint:**
```bash
npm run lint
```

---

## Current Dependencies

### Production
- `react` 19.2.0
- `react-native` 0.83.1
- `@react-native/new-app-screen` 0.83.1
- `react-native-safe-area-context` ^5.5.2
- `@react-navigation/native` ^7.1.1
- `@react-navigation/native-stack` ^7.2.1
- `react-native-screens` ^4.5.0
- `@react-native-async-storage/async-storage` ^2.2.0
- `@shopify/react-native-skia` ^2.4.16
- `uuid` ^13.0.0
- `react-native-get-random-values` ^2.0.0
- `react-native-fs` ^2.20.0
- `react-native-config` ^1.6.1
- `react-native-webview` ^13.x (for LaTeX rendering)

### Development
- `typescript` ^5.8.3
- `@types/uuid` ^10.0.0
- (plus standard RN dev dependencies)

**Total npm packages:** 899
**Total CocoaPods:** 87 dependencies, 86 pods

---

## Known Issues & Workarounds

### Metro Bundler Cache Issue (Tasks 2-3)
**Issue:** After installing new dependencies, Metro may not find modules.

**Symptoms:**
- Error: "Unable to resolve module @react-navigation/native"
- Bundle loading stalls at 0%

**Workaround:**
```bash
# Stop Metro (Ctrl+C)
npm start -- --reset-cache

# Or if Metro won't stop:
lsof -ti:8081 | xargs kill -9
npm start -- --reset-cache
```

**Status:** Workaround reliable, no permanent fix needed.

---

### DevTools Launch Errors (Cosmetic)
**Issue:** Console shows errors about DevTools shell options.

**Symptoms:**
```
bad option: --frontendUrl=...
bad option: --windowKey=...
```

**Impact:** None - UI debugger feature, doesn't affect app functionality.

**Status:** Harmless, can be ignored.

---

### iOS Simulator Unavailable (Task 7)
**Issue:** `npm run ios` failed because CoreSimulatorService could not be reached.

**Symptoms:**
- `xcrun simctl list --json devices` failed with "Connection refused"
- "CoreSimulatorService connection became invalid"
- "Cannot start server in new windows because no terminal app was specified"

**Impact:** iOS run could not be completed from this CLI session.

**Workaround:**
- Launch Simulator.app or Xcode to restart CoreSimulatorService
- Start Metro manually (`npm start`) then rerun `npm run ios -- --simulator="iPad Pro 11-inch (M4)"`

---

### Local Supabase JWT Verification Error (Task 11)
**Issue:** `supabase functions serve` fails with ES256 key type error when verifying JWTs.

**Symptoms:**
```
TypeError: Key for the ES256 algorithm must be of type CryptoKey. Received an instance of Uint8Array
```

**Cause:** Newer Supabase CLI uses ES256 keys (`sb_publishable_*`) locally instead of HS256 JWTs. The local runtime has compatibility issues verifying these keys.

**Workaround:**
```bash
supabase functions serve --no-verify-jwt
```

**Note:** This only affects local development. Production deployments work correctly with standard JWT verification.

---

## Next Steps

### Task 14: RAG-Powered Answers

**Goal:**
Enhance askRegion to retrieve relevant context from indexed pages.

**Requirements:**
- Vector similarity search across folder's indexed pages
- Include retrieved chunks in AI prompt
- Return real citations (not mock)
- Maintain reasonable response times

### Task 15: PDF Ingestion

**Goal:**
Allow users to import PDFs into folders and index them for RAG.

**Requirements:**
- PDF import UI with document picker
- PDF text extraction (client or server-side)
- Index PDF text using /indexPdf endpoint
- Citations link to PDF with page number

---

## Development Guidelines

### Architecture Principles (from ARCHITECTURE.md)
1. **MVP is local-only** - No login, no sync, no cloud
2. **iPad-first** - Design for large screen, touch targets
3. **RAG for AI** - Retrieval augmented generation (future)
4. **TypeScript everywhere** - Type safety required
5. **Minimal dependencies** - Only add when justified

### Task Workflow
1. **Planning only** - No implementation until approved
2. **Small incremental changes** - One task per branch/PR
3. **Stop after major steps** - Report errors/warnings
4. **Test checklist** - Manual testing required
5. **Update PROJECT_STATE.md** - After each task completion

### Code Quality Standards
- TypeScript must compile without errors (`npx tsc --noEmit`)
- No red box errors in app
- All navigation properly typed
- Storage operations handle errors gracefully
- UI responsive on iPad (touch targets ≥44pt)

---

## Useful Development Tips

### Clear AsyncStorage (for testing)
```bash
# In app code (dev only):
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.clear();

# Or manually delete app from simulator and reinstall
```

### View AsyncStorage Contents (debugging)
```bash
# In app code:
import AsyncStorage from '@react-native-async-storage/async-storage';
const folders = await AsyncStorage.getItem('@folders');
console.log(JSON.parse(folders));
```

### Kill and Restart App
```bash
# Kill app from iOS simulator:
# Cmd+Shift+H → Swipe up on app

# Relaunch:
xcrun simctl launch booted org.reactjs.native.example.ContextNotes
```

### Reset Metro Cache (if dependencies not found)
```bash
# Stop Metro (Ctrl+C)
npm start -- --reset-cache
```

### Check Simulator Status
```bash
# List booted devices:
xcrun simctl list devices booted

# List all iPad simulators:
xcrun simctl list devices | grep -i ipad
```

---

## Project Metrics

**Lines of Code (TypeScript):**
- Task 1: ~46 lines (App.tsx)
- Task 2: ~180 lines (navigation + screens)
- Task 3: ~280 lines (FolderListScreen + storage)
- Task 4: ~390 lines (NoteListScreen + note storage + Note model)
- Task 6: ~395 lines (PageEditorScreen + page storage + Page model)
- Task 7: ~700 lines (DrawingCanvas + toolbar + drawing storage + PageEditor updates)
- Task 10-11: ~600 lines (AskSheet + apiClient + health function)
- Task 12: ~400 lines (askRegion function + MathText + AskSheet updates)
- Task 13: ~650 lines (indexPage function + indexingService + migrations + UI updates)
- **Total:** ~3,650 lines of application code

**Build Time:**
- Clean build: ~3-4 minutes
- Incremental: ~30-60 seconds

**App Size:**
- Debug build: ~120 MB (includes dev tools)
- Release build: Not yet measured

---

## Contact & Resources

- **Architecture:** See [ARCHITECTURE.md](ARCHITECTURE.md)
- **Tasks:** See [TASKS.md](TASKS.md)
- **React Native:** https://reactnative.dev/
- **React Navigation:** https://reactnavigation.org/
- **AsyncStorage:** https://react-native-async-storage.github.io/async-storage/
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **OpenAI Vision API:** https://platform.openai.com/docs/guides/vision
- **KaTeX:** https://katex.org/

---

**End of Project State Document**
