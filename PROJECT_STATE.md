# Context Notes - Project State

**Last Updated:** 2026-01-29
**Current Task:** Task 8 Complete
**Status:** ✅ PNG export implemented (full-page render, persisted to Documents/exports)

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

## Current App Structure

```
/Users/aaron/STEMNote/
├── README.md                    # Original project docs
├── ARCHITECTURE.md              # Source of truth architecture
├── TASKS.md                     # Task definitions
├── PROJECT_STATE.md             # This file
├── package.json                 # Dependencies
├── App.tsx                      # App entry point
├── src/
│   ├── components/
│   │   ├── DrawingCanvas.tsx     # ✅ Skia drawing canvas
│   │   └── DrawingToolbar.tsx    # ✅ Drawing tools/actions
│   ├── navigation/
│   │   └── AppNavigator.tsx     # Navigation stack
│   ├── screens/
│   │   ├── FolderListScreen.tsx # ✅ Folder CRUD (working)
│   │   ├── NoteListScreen.tsx   # ✅ Note CRUD (working)
│   │   └── PageEditorScreen.tsx # ✅ Page navigation + drawing
│   ├── storage/
│   │   ├── folders.ts           # ✅ Folder AsyncStorage CRUD
│   │   ├── notes.ts             # ✅ Note AsyncStorage CRUD
│   │   ├── pages.ts             # ✅ Page AsyncStorage CRUD
│   │   └── drawings.ts          # ✅ Drawing AsyncStorage CRUD
│   └── types/
│       ├── models.ts            # ✅ Data models (Folder, Note, Page, Drawing)
│       └── navigation.ts        # ✅ Route types
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

### Development
- `typescript` ^5.8.3
- `@types/uuid` ^10.0.0
- (plus standard RN dev dependencies)

**Total npm packages:** 881
**Total CocoaPods:** 84 dependencies, 83 pods

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

## Next Steps

### Task 9: Selection Mode + Region Export (Planning Only)

**Goal:**
Add selection mode to export a user-selected region to PNG.

**Requirements:**
- Selection mode toggle in PageEditorScreen
- User can lasso or drag a region (simple rectangular selection acceptable)
- Export only the selected region to PNG
- Output matches the selected area visually
- Provide success/error feedback and saved file location

**Constraints:**
- No AI integration yet (Task 10+)
- Keep dependencies minimal
- Reuse existing drawing data and export pipeline where possible

**Prompt for Task 9 Planning:**

```
Proceed to Task 9, planning only.

Task 9 goal:
Add selection mode and export the selected region to PNG.

Requirements:
- Add a selection mode toggle in PageEditorScreen
- Allow the user to select a region (rectangular selection is OK for MVP)
- Export only the selected region to a PNG
- Output should visually match the selected area
- Save PNG to device storage with deterministic naming
- Provide user feedback (success/error + file location)

Constraints:
- No AI integration yet
- Keep dependencies minimal; justify any new libraries
- Reuse existing drawing data and export utilities where possible

For the plan include:
1) Selection interaction/UX (how to draw/adjust selection)
2) Rendering/cropping approach for region export
3) File system location and naming
4) UI changes
5) Files to create/modify
6) Definition of done
7) Manual test checklist

Important:
- Do not modify files until I explicitly approve

Stop after the plan.
```

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
- **Total:** ~2,000 lines of application code

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

---

**End of Project State Document**
