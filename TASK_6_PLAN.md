# Task 6 Implementation Plan: Pages inside a Note

**Status:** Planning Only - Awaiting Approval
**Created:** 2026-01-29

---

## 1. Page Data Model

### Interface Definition
Add to [src/types/models.ts](src/types/models.ts):

```typescript
export interface Page {
  id: string;           // UUID v4
  noteId: string;       // Parent note reference
  pageIndex: number;    // 0-based order within note
  createdAt: number;    // Unix timestamp (ms)
  updatedAt: number;    // Unix timestamp (ms)
  // No content field yet - drawing will be added in Task 7
}
```

### Key Design Decisions

1. **No content field yet**: Task 6 is foundation only, no drawing data
2. **pageIndex is 0-based**: First page = 0, matches navigation convention
3. **UUID for id**: Consistent with Folder and Note patterns
4. **Timestamps only**: No user-editable metadata for pages yet

---

## 2. Storage Strategy

### AsyncStorage Key
- **Key:** `@pages`
- **Format:** JSON array of all pages across all notes
- **Consistency:** Matches `@folders` and `@notes` pattern

### Storage Functions
Create new file: [src/storage/pages.ts](src/storage/pages.ts)

#### Function Signatures

```typescript
// Internal helpers (private)
async function loadAll(): Promise<Page[]>
async function saveAll(pages: Page[]): Promise<void>

// Public API (note-scoped)
async function loadPagesByNote(noteId: string): Promise<Page[]>
async function createPage(noteId: string): Promise<Page[]>
async function deletePage(noteId: string, pageId: string): Promise<Page[]>

// Utility
async function getPage(noteId: string, pageIndex: number): Promise<Page | null>
async function getMaxPageIndex(noteId: string): Promise<number>
```

#### Implementation Details

**Pattern:** Load all → filter by noteId → modify → save all → return filtered

**pageIndex Assignment:**
- When creating a new page: `pageIndex = maxExistingPageIndex + 1`
- First page in a note: `pageIndex = 0`
- Pages are sorted by pageIndex when returned

**Auto-creation Logic:**
- When navigating to a note's pageIndex 0, auto-create page if it doesn't exist
- This ensures every note has at least one page when first opened
- Other pageIndices require explicit "Create New Page" button

**Error Handling:**
- Storage failures return empty arrays (consistent with existing pattern)
- Console.error for debugging
- Throw on create/delete failures (caught by UI)

---

## 3. Files to Create/Modify

### Files to CREATE

#### 3.1. [src/storage/pages.ts](src/storage/pages.ts) (NEW)
**Purpose:** AsyncStorage CRUD for pages

**Key Functions:**
- `loadPagesByNote(noteId)` - Load all pages for a note, sorted by pageIndex
- `createPage(noteId)` - Create new page with next pageIndex
- `deletePage(noteId, pageId)` - Delete a page
- `getPage(noteId, pageIndex)` - Get specific page by index (for navigation)
- `getMaxPageIndex(noteId)` - Get highest pageIndex in note

**Pattern:** Follow [src/storage/notes.ts](src/storage/notes.ts) closely

---

### Files to MODIFY

#### 3.2. [src/types/models.ts](src/types/models.ts)
**Changes:**
- Add `Page` interface (see data model above)

**Lines affected:** ~6 new lines (total file: ~21 lines)

---

#### 3.3. [src/screens/PageEditorScreen.tsx](src/screens/PageEditorScreen.tsx)
**Current state:** Placeholder showing route params

**New implementation:**

**UI Components:**
1. **Page info section** (top):
   - Display: "Page {currentPageIndex + 1} of {totalPages}"
   - Small text, centered

2. **Navigation controls** (bottom toolbar):
   - Button: "← Previous" (disabled if pageIndex = 0)
   - Button: "Next →" (disabled if at last page)
   - Button: "+ New Page" (always enabled)

3. **Content area** (center):
   - Placeholder text: "Page content will appear here"
   - Light gray background
   - Eventually replaced by drawing canvas (Task 7)

**State Management:**
```typescript
const [pages, setPages] = useState<Page[]>([]);
const [currentPage, setCurrentPage] = useState<Page | null>(null);
const [loading, setLoading] = useState(true);
```

**Initialization Logic:**
1. On mount, load pages for noteId: `loadPagesByNote(noteId)`
2. Check if page exists at route.params.pageIndex
3. If pageIndex = 0 and no pages exist, auto-create first page
4. If pageIndex > 0 and page doesn't exist, show error or navigate to last page
5. Set currentPage from loaded pages

**Navigation Functions:**
```typescript
const handlePreviousPage = () => {
  // Navigate to pageIndex - 1
  navigation.setParams({ pageIndex: pageIndex - 1 });
};

const handleNextPage = () => {
  // Navigate to pageIndex + 1
  navigation.setParams({ pageIndex: pageIndex + 1 });
};

const handleCreateNewPage = async () => {
  // Create page with pageIndex = maxPageIndex + 1
  const updatedPages = await createPage(noteId);
  setPages(updatedPages);
  const newPageIndex = updatedPages.length - 1;
  navigation.setParams({ pageIndex: newPageIndex });
};
```

**useEffect for pageIndex changes:**
- Watch `route.params.pageIndex`
- When it changes, load/create page at that index
- Update currentPage state
- This allows Previous/Next buttons to work via navigation.setParams

**Lines affected:** ~200 new lines (total file: ~240 lines)

---

## 4. Implementation Sequence

**Step 1:** Update data model
- Modify [src/types/models.ts](src/types/models.ts)
- Add Page interface

**Step 2:** Create storage layer
- Create [src/storage/pages.ts](src/storage/pages.ts)
- Implement all CRUD functions
- Test manually with console logs

**Step 3:** Implement PageEditorScreen
- Modify [src/screens/PageEditorScreen.tsx](src/screens/PageEditorScreen.tsx)
- Add state management
- Add navigation controls
- Add auto-creation logic for first page
- Add loading states

**Step 4:** Manual testing (see test checklist below)

**Step 5:** Update PROJECT_STATE.md with Task 6 summary

---

## 5. Definition of Done

**Functional Requirements:**
- ✅ Can create multiple pages in a note
- ✅ Can navigate between pages (Previous/Next buttons work)
- ✅ Pages persist across app restarts
- ✅ Opening a note from NoteList navigates to pageIndex = 0
- ✅ First page (pageIndex = 0) auto-creates if it doesn't exist
- ✅ Page counter displays correctly (e.g., "Page 2 of 5")
- ✅ Previous button disabled on first page
- ✅ Next button disabled on last page
- ✅ Create New Page button always enabled

**Technical Requirements:**
- ✅ No TypeScript errors (`npx tsc --noEmit`)
- ✅ App builds and runs on iPad simulator
- ✅ No red box errors in runtime
- ✅ AsyncStorage key `@pages` contains correct data structure
- ✅ Pages scoped to noteId (no cross-note leakage)
- ✅ pageIndex ordering maintained correctly

**Code Quality:**
- ✅ Follows existing patterns from folders.ts and notes.ts
- ✅ Consistent error handling
- ✅ Clear function names and comments
- ✅ UI consistent with NoteListScreen styling

---

## 6. Manual Test Checklist

### TC1: First Page Auto-Creation
**Steps:**
1. Open a note that has no pages yet
2. App should navigate to pageIndex = 0
3. Verify page auto-creates

**Expected:**
- Page counter shows "Page 1 of 1"
- Previous and Next buttons both disabled
- No errors in console

---

### TC2: Create Multiple Pages
**Steps:**
1. Open a note at page 0
2. Tap "+ New Page" button 3 times
3. Verify page counter updates each time

**Expected:**
- Counter shows: "Page 1 of 1" → "Page 2 of 2" → "Page 3 of 3" → "Page 4 of 4"
- Navigation buttons enable/disable correctly

---

### TC3: Navigate Between Pages
**Steps:**
1. In a note with 3 pages, start at page 0
2. Tap "Next →" button twice
3. Tap "← Previous" button once
4. Verify navigation updates pageIndex

**Expected:**
- Page counter updates: "Page 1 of 3" → "Page 2 of 3" → "Page 3 of 3" → "Page 2 of 3"
- Button states update correctly
- route.params.pageIndex matches displayed page

---

### TC4: Button Disable States
**Steps:**
1. Navigate to first page (pageIndex = 0)
2. Verify "← Previous" button is disabled
3. Navigate to last page
4. Verify "Next →" button is disabled

**Expected:**
- Buttons have visual disabled state (opacity/color change)
- Tapping disabled buttons has no effect

---

### TC5: Persistence Across App Restarts
**Steps:**
1. Create a note with 3 pages
2. Navigate to page 1 (middle page)
3. Force quit app (Cmd+Shift+H, swipe up)
4. Relaunch app
5. Navigate back to the same note

**Expected:**
- Note still opens at pageIndex = 0
- All 3 pages still exist
- Page counter shows "Page 1 of 3"
- Can navigate to pages 0, 1, 2

---

### TC6: Multiple Notes Isolation
**Steps:**
1. Create Note A with 2 pages
2. Create Note B with 3 pages
3. Open Note A, verify 2 pages
4. Open Note B, verify 3 pages
5. Check AsyncStorage key `@pages` in console

**Expected:**
- Note A shows "Page X of 2"
- Note B shows "Page X of 3"
- No cross-note contamination
- AsyncStorage contains 5 total pages (2 + 3) with correct noteIds

---

### TC7: Create Page at End
**Steps:**
1. Open a note with 2 pages
2. Navigate to page 1 (last page, "Page 2 of 2")
3. Tap "+ New Page"
4. Verify navigation to new page

**Expected:**
- Counter updates to "Page 3 of 3"
- Automatically navigates to new page (pageIndex = 2)
- Next button becomes disabled

---

### TC8: Empty Note List → New Note → First Page
**Steps:**
1. Create a new folder
2. Create a new note in that folder
3. Tap on the note to open PageEditor

**Expected:**
- Automatically creates first page (pageIndex = 0)
- Counter shows "Page 1 of 1"
- Both nav buttons disabled
- Placeholder text visible

---

### TC9: Delete Note with Pages (Edge Case)
**Steps:**
1. Create a note with 3 pages
2. Go back to NoteList
3. Delete the note
4. Check AsyncStorage `@pages` key (via console log)

**Expected:**
- Note deletes successfully
- Pages remain in AsyncStorage (orphaned - OK for now)
- No crashes or errors
- **Note:** Cascade deletion deferred to future task

---

### TC10: Loading States
**Steps:**
1. Open PageEditor with slow network simulation (if possible)
2. Observe loading indicator while pages load

**Expected:**
- Loading spinner or text appears
- UI doesn't freeze
- Transitions smoothly to loaded state

---

## 7. Edge Cases & Constraints

### Edge Cases Handled
1. **No pages exist, navigate to pageIndex = 0**: Auto-create first page
2. **Navigate to invalid pageIndex (e.g., 99)**: Navigate to last available page or show error
3. **Orphaned pages after note deletion**: Acceptable for MVP (cleanup deferred)

### Edge Cases NOT Handled (Future)
1. **Cascade deletion**: Deleting a note doesn't delete its pages (deferred)
2. **Page reordering**: Cannot reorder pages (not required for Task 6)
3. **Page deletion**: No UI to delete individual pages yet (optional)
4. **Page titles/names**: Pages are identified by index only

### Constraints Respected
- ✅ AsyncStorage only (no SQLite)
- ✅ No new dependencies
- ✅ No drawing implementation (Task 7)
- ✅ No AI, no Supabase
- ✅ No schema migrations

---

## 8. Estimated Complexity

**Code Changes:**
- New files: 1 ([src/storage/pages.ts](src/storage/pages.ts))
- Modified files: 2 ([src/types/models.ts](src/types/models.ts), [src/screens/PageEditorScreen.tsx](src/screens/PageEditorScreen.tsx))
- Total new lines: ~250 lines

**Risk Assessment:** **Low**
- Follows established patterns (folders, notes)
- No new dependencies
- No complex state management
- Incremental addition to existing architecture

**Testing Effort:** **Medium**
- 10 manual test cases
- Requires app restart testing
- Multi-note/page persistence validation

---

## 9. Open Questions (None)

All requirements are clear from the task specification. No user input required before implementation.

---

## 10. Next Steps After Task 6

After Task 6 is complete and verified, update PROJECT_STATE.md with:
1. Task 6 completion summary
2. Any new dependencies (expected: none)
3. Any issues/workarounds encountered
4. The exact planning-only prompt for Task 7

**Task 7 Preview:** Implement drawing canvas with Skia
- Will add drawing data persistence to Page model
- May require SQLite migration if AsyncStorage becomes inefficient
- Will add new dependencies (react-native-skia or similar)

---

**End of Plan - Ready for Review**
