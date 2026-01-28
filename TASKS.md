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

## Task 1 — Project bootstrap (RN + TypeScript + iPad simulator)
Goal:
- Create a React Native TypeScript app and run it on iOS simulator.

Constraints:
- No extra libs beyond what RN template provides.
- Provide exact commands to run.

DoD:
- `npm run ios` launches app in iPad simulator successfully.

## Task 2 — Repo structure + basic navigation
Goal:
- Add folder structure under app/src (screens/components/storage/etc.)
- Add basic navigation between screens with placeholders.

Allowed:
- Add a navigation library if necessary (must explain choice).
- No persistence yet.

DoD:
- Can navigate: FolderList -> NoteList -> PageEditor.

## Task 3 — Local SQLite storage layer
Goal:
- Add SQLite database initialization and repos (folders/notes/pages).
- Provide CRUD for folders and notes.

Constraints:
- No cloud, no Supabase.
- Keep schema minimal.

DoD:
- Create folder, restart app, folder still exists.

## Task 4 — FolderListScreen (real UI + persistence)
Goal:
- Implement list/create/rename/delete folders with persistence.

DoD:
- Folder CRUD works reliably.

## Task 5 — NoteListScreen (real UI + persistence)
Goal:
- Notes inside a folder; CRUD notes.

DoD:
- Notes persist and are scoped to folderId.

## Task 6 — Page model + Page list
Goal:
- Each note has pages (pageIndex).
- Create/open pages.

DoD:
- Create page 1, page 2, reopen later.

## Task 7 — DrawingCanvas MVP (Skia)
Goal:
- Implement basic drawing: pen, eraser, undo/redo, clear.
- Save/load drawing data to SQLite.

Constraints:
- No AI, no export yet.

DoD:
- Draw, close page, reopen, drawing remains.

## Task 8 — Render/export full page to PNG
Goal:
- Render the page to an image file at stable resolution.

DoD:
- Exported PNG exists on device and visually matches page.

## Task 9 — Selection mode + region export
Goal:
- Add selection mode:
  - user lassos a region (simple bounding box is acceptable)
  - export region PNG

DoD:
- Region export works and matches selected area.

## Task 10 — AskSheet UI (no backend yet)
Goal:
- UI panel with question input and answer view.
- For now, return a mocked answer.

DoD:
- Can ask and see response; citations UI present (mocked).

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