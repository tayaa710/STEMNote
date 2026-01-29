# Context Notes - Project State

**Last Updated:** 2026-01-29
**Current Task:** Task 3 Complete
**Status:** ✅ Fully functional with folder persistence

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
│   ├── navigation/
│   │   └── AppNavigator.tsx     # Navigation stack
│   ├── screens/
│   │   ├── FolderListScreen.tsx # ✅ Folder CRUD (working)
│   │   ├── NoteListScreen.tsx   # 🚧 Placeholder (shows folderId)
│   │   └── PageEditorScreen.tsx # 🚧 Placeholder (shows params)
│   ├── storage/
│   │   └── folders.ts           # ✅ AsyncStorage CRUD
│   └── types/
│       ├── models.ts            # ✅ Data models
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
- `uuid` ^13.0.0
- `react-native-get-random-values` ^2.0.0

### Development
- `typescript` ^5.8.3
- `@types/uuid` ^10.0.0
- (plus standard RN dev dependencies)

**Total npm packages:** 876
**Total CocoaPods:** 83 dependencies, 82 pods

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

## Next Steps

### Task 4: NoteListScreen with Persistence (Planning Only)

**Goal:**
Implement NoteListScreen to display and manage notes within a folder.

**Requirements:**
- List notes in a folder (by folderId from navigation params)
- Create note with title
- Delete note (optional: rename note)
- Navigate to PageEditorScreen with (folderId, noteId, pageIndex: 0)
- Persist notes across app restarts

**Constraints:**
- Continue using AsyncStorage (no SQLite yet)
- Notes scoped to folderId
- No page content yet (pages come in later task)
- Keep dependencies minimal
- No AI, no drawing, no Supabase

**Data Model Proposal:**
```typescript
interface Note {
  id: string;           // UUID v4
  folderId: string;     // Parent folder
  title: string;        // Note title
  createdAt: number;    // Unix timestamp
  updatedAt: number;    // Unix timestamp
}
```

**Storage Approach:**
- AsyncStorage key: `@notes`
- JSON array of all notes
- Filter by folderId in UI
- CRUD similar to folders pattern

**Prompt for Task 4 Planning:**

```
Proceed to Task 4, planning only.

Task 4 goal:
Implement NoteListScreen with local persistence and CRUD:
- List notes in the current folder (folderId from route params)
- Create note with title input
- Delete note with confirmation
- Rename note (optional if too much)
- Navigate to PageEditorScreen with (folderId, noteId, pageIndex: 0)
- Persist across app restarts

Constraints:
- Continue using AsyncStorage (defer SQLite until pages need it)
- Notes must be scoped to folderId
- No page content/drawing yet
- Keep dependencies minimal
- No Supabase, no AI

For the plan include:
1) Data model for notes (id, folderId, title, timestamps)
2) Storage approach (AsyncStorage strategy)
3) Files to create/modify
4) Definition of done + manual test checklist

Do not modify files until I approve.
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
- **Total:** ~506 lines of application code

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
