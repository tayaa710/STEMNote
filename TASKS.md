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

## Task 11 — Supabase project wiring (backend skeleton)
Goal:
- Add `ai/apiClient.ts` that calls Supabase Edge Functions.
- Add placeholders for endpoints:
  - /askRegion
  - /indexPage
  - /indexPdf

DoD:
- App can hit a test endpoint and display response.

## Task 12 — /askRegion minimal (no RAG yet)
Goal:
- Implement /askRegion to answer using region image only.

DoD:
- Real answer returned for region+question.

## Task 13 — Indexing pages into chunks (server)
Goal:
- Implement /indexPage pipeline:
  - extract text (simple approach)
  - chunk
  - embed
  - store in chunks table

DoD:
- After indexing, chunks exist for that page.

## Task 14 — Folder RAG (retrieve + answer)
Goal:
- /askRegion performs retrieval within folder and answers with citations.

DoD:
- Answers reference earlier pages when relevant.

## Task 15 — PDF ingestion
Goal:
- Import PDF into folder and index its text.

DoD:
- Asking questions can reference PDF content.

## Task 16 — Quality and guardrails
Goal:
- Add rate limiting, error handling, and citations reliability.

DoD:
- Failures show clear UI messages; no crashes.
