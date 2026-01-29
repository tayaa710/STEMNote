# Task 7 Implementation Plan: Drawing Canvas MVP (Skia)

**Status:** Planning Only - Awaiting Approval
**Created:** 2026-01-29

---

## 1. Technology Choice

### Selected: React Native Skia (@shopify/react-native-skia)

**Justification:**

**Why Skia?**
- **Performance:** Native GPU acceleration, essential for smooth 60fps drawing on iPad
- **Proven:** Built on Google's Skia engine (powers Chrome, Android, Flutter)
- **React Native Integration:** Excellent support from Shopify with active maintenance
- **Gesture Support:** Built-in touch/gesture handling optimized for drawing
- **Future-proof:** Supports advanced features (filters, effects, animations) for future tasks
- **iPad Optimized:** Handles high-resolution displays and Apple Pencil pressure/tilt

**Alternatives Considered & Rejected:**

1. **React Native SVG + Gesture Handler**
   - ❌ Poor performance with >100 strokes
   - ❌ Re-rendering entire SVG tree on each stroke is slow
   - ❌ Not suitable for real-time drawing at 60fps

2. **react-native-canvas**
   - ❌ Limited native acceleration
   - ❌ Canvas API is less performant than Skia
   - ❌ Smaller community, less maintained

3. **WebView + HTML5 Canvas**
   - ❌ Bridge overhead kills performance
   - ❌ Poor integration with React Native
   - ❌ Not native

**Decision:** Use Skia for MVP. It's the industry-standard solution for high-performance 2D drawing.

---

## 2. Drawing Data Format & Persistence Strategy

### Data Model

#### Update Page interface in [src/types/models.ts](src/types/models.ts)

```typescript
export interface Page {
  id: string;
  noteId: string;
  pageIndex: number;
  createdAt: number;
  updatedAt: number;
  drawingData?: string;  // NEW: JSON string of DrawingData
}

// NEW interfaces for drawing
export interface DrawingData {
  strokes: Stroke[];
  version: number;  // Format version for future migrations
}

export interface Stroke {
  id: string;           // UUID for undo/redo tracking
  points: Point[];      // Path coordinates
  color: string;        // Hex color (e.g., "#000000")
  width: number;        // Stroke width in pixels
  tool: 'pen' | 'eraser';
  timestamp: number;    // For debugging/analytics
}

export interface Point {
  x: number;
  y: number;
  // Future: pressure?: number;  // Apple Pencil pressure (0-1)
}
```

### Storage Format Decision

**Chosen: Raw Point Array Format**

**Rationale:**
1. **Portable:** Not tied to Skia's internal format
2. **Debuggable:** Easy to inspect in AsyncStorage
3. **Future-proof:** Can add pressure, tilt, etc. later
4. **Interoperable:** Can export to SVG/PNG in Task 8 without conversion

**Alternative (Rejected): Skia Path Commands**
- More compact (~30% smaller)
- But: Tied to Skia format, harder to debug, less portable

**Optimization: Stroke Simplification**
- Apply Douglas-Peucker algorithm to reduce points while preserving shape
- Target: ~50-70% point reduction with minimal visual loss
- Implement during autosave, not during drawing (keep 60fps)

### Persistence Strategy: AsyncStorage (for MVP)

**Decision:** Use AsyncStorage with optimizations

**Why AsyncStorage (not SQLite yet)?**

| Factor | AsyncStorage | SQLite |
|--------|--------------|--------|
| **Setup Complexity** | ✅ Already in use | ❌ New dependency + native setup |
| **API Simplicity** | ✅ Simple key-value | ❌ SQL queries |
| **Performance (small data)** | ✅ Fast for <1MB | ✅ Fast |
| **Performance (large data)** | ⚠️ Slower for >5MB | ✅ Better scaling |
| **Data Size Limit** | ⚠️ ~6-10MB practical | ✅ No practical limit |
| **Consistency** | ✅ Matches folders/notes | ❌ Different pattern |

**MVP Recommendation: AsyncStorage**

**Conditions for Success:**
1. **Stroke Simplification:** Reduce point count by 50-70%
2. **Practical Limits:**
   - Max 1000 strokes per page (plenty for handwritten notes)
   - Max 5MB drawing data per page (~10,000 points)
   - Warn user if approaching limits
3. **Lazy Loading:** Only load drawing data for current page, not all pages
4. **Compression:** JSON.stringify is reasonably compact

**When to Migrate to SQLite (Future):**
- User hits storage limits
- App has 100+ pages with drawings
- Need to query across drawings
- Performance monitoring shows AsyncStorage bottleneck

**SQLite Migration Path (Not for Task 7):**
- Add `react-native-sqlite-storage` dependency
- Create `drawings` table: `(pageId, drawingData, updatedAt)`
- Migrate existing AsyncStorage data to SQLite
- Update storage API to use SQLite (same interface)

**For Task 7: Stick with AsyncStorage, monitor performance.**

### Storage API Updates

Update [src/storage/pages.ts](src/storage/pages.ts) to handle drawing data:

```typescript
// Add new function
export async function saveDrawingData(
  pageId: string,
  drawingData: DrawingData
): Promise<void>;

// Add new function
export async function loadDrawingData(
  pageId: string
): Promise<DrawingData | null>;
```

Implementation: Serialize DrawingData to JSON, store in `Page.drawingData` field.

---

## 3. Integration with PageEditorScreen

### UI Layout Changes

**Before (Task 6):**
```
┌─────────────────────────────────┐
│ Page X of Y                     │ ← Page info
├─────────────────────────────────┤
│                                 │
│   Placeholder content area      │
│   (Page ID: xxx...)             │
│                                 │
├─────────────────────────────────┤
│ [← Prev] [+ New] [Next →]      │ ← Navigation
└─────────────────────────────────┘
```

**After (Task 7):**
```
┌─────────────────────────────────┐
│ Page X of Y                     │ ← Page info (unchanged)
├─────────────────────────────────┤
│ [🖊 Pen] [🧹 Eraser] [↶] [↷] [✕] │ ← Drawing toolbar
├─────────────────────────────────┤
│                                 │
│                                 │
│    Drawing Canvas (Skia)        │ ← Replace placeholder
│                                 │
│                                 │
├─────────────────────────────────┤
│ [← Prev] [+ New] [Next →]      │ ← Navigation (unchanged)
└─────────────────────────────────┘
```

### Component Structure

**New Component: DrawingCanvas**
- File: [src/components/DrawingCanvas.tsx](src/components/DrawingCanvas.tsx)
- Renders Skia canvas
- Handles touch gestures (pen/eraser)
- Manages drawing state (strokes, undo/redo stacks)
- Emits events for autosave

**New Component: DrawingToolbar**
- File: [src/components/DrawingToolbar.tsx](src/components/DrawingToolbar.tsx)
- Tool buttons: Pen, Eraser
- Action buttons: Undo, Redo, Clear
- Active tool indicator
- Disabled states (undo/redo when stacks empty)

**Modified: PageEditorScreen**
- Import DrawingCanvas and DrawingToolbar
- Replace placeholder content area with DrawingCanvas
- Add toolbar above canvas
- Load drawing data on page change
- Save drawing data on stroke end (via callback)
- Handle loading states

### State Management

**DrawingCanvas State:**
```typescript
const [currentStrokes, setCurrentStrokes] = useState<Stroke[]>([]);
const [undoStack, setUndoStack] = useState<Stroke[][]>([]);
const [redoStack, setRedoStack] = useState<Stroke[][]>([]);
const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen');
const [currentPath, setCurrentPath] = useState<Point[]>([]);
```

**PageEditorScreen State (additions):**
```typescript
const [drawingData, setDrawingData] = useState<DrawingData | null>(null);
const [savingDrawing, setSavingDrawing] = useState(false);
```

### Drawing Flow

**1. User touches screen → Start stroke**
- Create new stroke with tool, color, width
- Capture initial point

**2. User drags → Add points**
- Capture points at ~60fps
- Render path in real-time using Skia

**3. User lifts finger → End stroke**
- Finalize stroke
- Apply stroke simplification (Douglas-Peucker)
- Add to currentStrokes
- Push snapshot to undoStack
- Clear redoStack
- Trigger autosave (debounced)

**4. Autosave → Save to AsyncStorage**
- Serialize currentStrokes to DrawingData JSON
- Update Page.drawingData in storage
- Update Page.updatedAt timestamp
- Show brief "Saving..." indicator (optional)

**5. Navigate to different page → Load drawing**
- Load Page data for new pageIndex
- Parse Page.drawingData JSON
- Set currentStrokes
- Clear undo/redo stacks (or save/restore per page?)
- Render strokes on canvas

### Undo/Redo Logic

**Undo:**
```typescript
const handleUndo = () => {
  if (undoStack.length === 0) return;
  const previousState = undoStack[undoStack.length - 1];
  setRedoStack([...redoStack, currentStrokes]);
  setCurrentStrokes(previousState);
  setUndoStack(undoStack.slice(0, -1));
  triggerAutosave();
};
```

**Redo:**
```typescript
const handleRedo = () => {
  if (redoStack.length === 0) return;
  const nextState = redoStack[redoStack.length - 1];
  setUndoStack([...undoStack, currentStrokes]);
  setCurrentStrokes(nextState);
  setRedoStack(redoStack.slice(0, -1));
  triggerAutosave();
};
```

**Clear:**
```typescript
const handleClear = () => {
  if (currentStrokes.length === 0) return;
  setUndoStack([...undoStack, currentStrokes]);
  setCurrentStrokes([]);
  setRedoStack([]);
  triggerAutosave();
};
```

### Eraser Implementation

**Option A: True Eraser (Cut Paths)**
- Complex: Split strokes at intersection points
- Computationally expensive
- Better UX (selective erasing)

**Option B: Stroke-level Eraser**
- Simple: Detect tap on stroke, remove entire stroke
- Fast and easy to implement
- Good enough for MVP

**Option C: Eraser as White Pen**
- Simplest: Draw white strokes over black
- But: Not truly erasing (increases file size)
- Not recommended

**Decision for MVP: Option B (Stroke-level Eraser)**
- Tap on stroke → highlight stroke → confirm delete
- Or: Drag over strokes → auto-remove touched strokes
- Simple to implement with Skia's hit testing
- Can upgrade to Option A post-MVP if needed

---

## 4. Files to Create/Modify

### Files to CREATE

#### 4.1. [src/components/DrawingCanvas.tsx](src/components/DrawingCanvas.tsx) (NEW)
**Purpose:** Skia-based drawing canvas

**Key Exports:**
- `DrawingCanvas` component

**Props:**
```typescript
interface DrawingCanvasProps {
  drawingData: DrawingData | null;
  activeTool: 'pen' | 'eraser';
  onStrokeEnd: (updatedData: DrawingData) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  width: number;
  height: number;
}
```

**Responsibilities:**
- Render Skia Canvas
- Handle touch gestures (PanGestureHandler)
- Draw strokes in real-time
- Apply stroke simplification on stroke end
- Emit onStrokeEnd event for autosave
- Support undo/redo callbacks

**Lines:** ~200-250 lines

---

#### 4.2. [src/components/DrawingToolbar.tsx](src/components/DrawingToolbar.tsx) (NEW)
**Purpose:** Toolbar with drawing tools and actions

**Key Exports:**
- `DrawingToolbar` component

**Props:**
```typescript
interface DrawingToolbarProps {
  activeTool: 'pen' | 'eraser';
  onToolChange: (tool: 'pen' | 'eraser') => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}
```

**Responsibilities:**
- Render tool buttons (Pen, Eraser)
- Render action buttons (Undo, Redo, Clear)
- Highlight active tool
- Disable undo/redo when stacks empty
- Confirm before Clear (Alert)

**Lines:** ~120-150 lines

---

#### 4.3. [src/utils/strokeSimplification.ts](src/utils/strokeSimplification.ts) (NEW)
**Purpose:** Reduce point count while preserving shape

**Key Exports:**
- `simplifyStroke(points: Point[], tolerance: number): Point[]`

**Implementation:**
- Douglas-Peucker algorithm
- Default tolerance: 2-3 pixels (tunable)
- Returns simplified point array

**Lines:** ~50-80 lines (algorithm implementation)

---

### Files to MODIFY

#### 4.4. [src/types/models.ts](src/types/models.ts)
**Changes:**
- Update `Page` interface: Add `drawingData?: string`
- Add `DrawingData` interface
- Add `Stroke` interface
- Add `Point` interface

**Lines affected:** ~30 new lines (total file: ~52 lines)

---

#### 4.5. [src/storage/pages.ts](src/storage/pages.ts)
**Changes:**
- Add `saveDrawingData(pageId: string, drawingData: DrawingData): Promise<void>`
- Add `loadDrawingData(pageId: string): Promise<DrawingData | null>`
- Modify internal `saveAll()` to handle drawingData field

**Implementation:**
```typescript
export async function saveDrawingData(
  pageId: string,
  drawingData: DrawingData,
): Promise<void> {
  try {
    const allPages = await loadAll();
    const updated = allPages.map(page =>
      page.id === pageId
        ? { ...page, drawingData: JSON.stringify(drawingData), updatedAt: Date.now() }
        : page
    );
    await saveAll(updated);
  } catch (error) {
    console.error('Failed to save drawing data:', error);
    throw error;
  }
}

export async function loadDrawingData(
  pageId: string,
): Promise<DrawingData | null> {
  try {
    const allPages = await loadAll();
    const page = allPages.find(p => p.id === pageId);
    if (!page || !page.drawingData) {
      return null;
    }
    return JSON.parse(page.drawingData) as DrawingData;
  } catch (error) {
    console.error('Failed to load drawing data:', error);
    return null;
  }
}
```

**Lines affected:** ~40 new lines (total file: ~160 lines)

---

#### 4.6. [src/screens/PageEditorScreen.tsx](src/screens/PageEditorScreen.tsx)
**Changes:**
- Import `DrawingCanvas` and `DrawingToolbar`
- Replace placeholder content area with canvas
- Add toolbar above canvas
- Add state for `drawingData`, `activeTool`, `savingDrawing`
- Load drawing data when page changes (useEffect)
- Save drawing data on stroke end (debounced)
- Handle tool changes
- Handle undo/redo/clear

**New useEffect:**
```typescript
// Load drawing data when pageIndex changes
useEffect(() => {
  if (!currentPage) return;

  loadDrawingData(currentPage.id)
    .then(setDrawingData)
    .catch(err => console.error('Failed to load drawing:', err));
}, [currentPage?.id]);
```

**New handler:**
```typescript
const handleStrokeEnd = useCallback(
  debounce(async (updatedData: DrawingData) => {
    if (!currentPage) return;
    setSavingDrawing(true);
    try {
      await saveDrawingData(currentPage.id, updatedData);
      setDrawingData(updatedData);
    } catch (error) {
      Alert.alert('Error', 'Failed to save drawing');
    } finally {
      setSavingDrawing(false);
    }
  }, 500),
  [currentPage?.id]
);
```

**Lines affected:** ~150 new lines (total file: ~430 lines)

---

## 5. Performance Considerations

### Target Performance Metrics

- **Frame Rate:** 60fps during drawing (no dropped frames)
- **Touch Latency:** <16ms (one frame at 60fps)
- **Stroke Simplification:** <50ms per stroke (imperceptible)
- **Autosave:** <200ms (background, non-blocking)
- **Load Time:** <500ms for typical page (100 strokes)

### Optimization Strategies

#### 5.1. Drawing Performance
- **Use Skia's GPU acceleration** (default)
- **Batch renders:** Don't re-render entire canvas on every point
- **Use SkPath for strokes:** Native rendering, very fast
- **Limit point capture rate:** Max 60 points/second (every frame)

#### 5.2. Storage Performance
- **Stroke simplification:** Reduce points by 50-70%
- **Debounce autosave:** Wait 500ms after stroke ends
- **Lazy loading:** Only load current page's drawing
- **JSON compression:** Use compact format (no whitespace)

#### 5.3. Memory Management
- **Clear undo/redo on page change:** Prevent memory leaks
- **Limit undo stack:** Max 50 actions (plenty for drawing session)
- **Use object pooling:** Reuse Point objects (if profiling shows GC pressure)

#### 5.4. Storage Limits & Warnings

**Practical Limits:**
- Max 1000 strokes per page (estimate: 100-200 typical)
- Max 5MB drawing data per page (very generous)

**Implementation:**
```typescript
const MAX_STROKES = 1000;
const MAX_DRAWING_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function checkLimits(drawingData: DrawingData): boolean {
  if (drawingData.strokes.length > MAX_STROKES) {
    Alert.alert('Limit Reached', 'Maximum 1000 strokes per page.');
    return false;
  }

  const size = JSON.stringify(drawingData).length;
  if (size > MAX_DRAWING_SIZE_BYTES) {
    Alert.alert('Page Full', 'Drawing data exceeds 5MB. Consider clearing or using a new page.');
    return false;
  }

  return true;
}
```

---

## 6. Definition of Done

### Functional Requirements
- ✅ Can draw with finger on canvas (pen tool)
- ✅ Can draw with Apple Pencil on canvas (pen tool)
- ✅ Can switch to eraser tool
- ✅ Eraser removes touched strokes
- ✅ Undo button works (reverses last stroke)
- ✅ Redo button works (restores undone stroke)
- ✅ Clear button works (clears canvas after confirmation)
- ✅ Drawing persists when navigating to different page
- ✅ Drawing persists after app restart
- ✅ Autosave works (saves on stroke end)
- ✅ Previous/Next/New Page buttons still work
- ✅ Loading state shows when loading drawing

### Technical Requirements
- ✅ No TypeScript errors (`npx tsc --noEmit`)
- ✅ App builds and runs on iPad
- ✅ No red box errors in runtime
- ✅ Drawing feels smooth (60fps subjective test)
- ✅ Stroke simplification reduces points by >50%
- ✅ AsyncStorage key `@pages` contains serialized drawings
- ✅ Drawing data format is version 1 (for future migrations)

### UX Requirements
- ✅ Active tool is visually highlighted
- ✅ Undo/Redo buttons disabled when stacks empty
- ✅ Clear button shows confirmation alert
- ✅ Canvas fills available space (responsive)
- ✅ Toolbar doesn't obstruct drawing area
- ✅ No noticeable lag when drawing

### Code Quality
- ✅ Follows existing code patterns
- ✅ Components are reasonably sized (<300 lines)
- ✅ Error handling for storage failures
- ✅ Console logs for debugging (can be removed later)

---

## 7. Manual Test Checklist

### For AI Agent (During Implementation)

#### Basic Drawing Tests
- [ ] TC1: Draw stroke with finger → stroke appears
- [ ] TC2: Draw multiple strokes → all strokes visible
- [ ] TC3: Switch to eraser → tool switches
- [ ] TC4: Erase stroke → stroke disappears
- [ ] TC5: Undo after drawing → last stroke removed
- [ ] TC6: Redo after undo → stroke reappears
- [ ] TC7: Clear canvas → all strokes removed (after confirmation)
- [ ] TC8: Clear canvas → cancel confirmation → strokes remain

#### Persistence Tests
- [ ] TC9: Draw strokes → navigate to next page → navigate back → strokes remain
- [ ] TC10: Draw strokes → force quit app → relaunch → strokes remain
- [ ] TC11: Create 3 pages → draw different things on each → navigate between → each page has correct drawing

#### Edge Cases
- [ ] TC12: Undo when canvas empty → nothing happens, button disabled
- [ ] TC13: Redo when redo stack empty → nothing happens, button disabled
- [ ] TC14: Draw on page 1 → create page 2 → page 2 starts empty
- [ ] TC15: Rapid strokes (10 strokes/second) → all strokes render correctly

#### Navigation Integration
- [ ] TC16: Draw strokes → tap Previous → drawing on new page (if exists)
- [ ] TC17: Draw strokes → tap Next → drawing on new page (if exists)
- [ ] TC18: Draw strokes → tap + New Page → navigate to empty page
- [ ] TC19: Previous/Next/New Page buttons still work as in Task 6

#### Performance Tests
- [ ] TC20: Draw 50 strokes → still smooth 60fps
- [ ] TC21: Draw 100 strokes → check for lag (should be minimal)
- [ ] TC22: Autosave (watch console) → saves within 1 second of stroke end

---

### For User (After Implementation)

#### Basic Functionality
- [ ] **UC1: First Drawing**
  - Open a note
  - Draw a simple shape (square, circle)
  - Verify shape appears as you draw
  - Close app and reopen
  - Verify drawing is still there

- [ ] **UC2: Eraser**
  - Draw 3-4 strokes
  - Switch to Eraser tool (button highlights)
  - Tap on a stroke
  - Verify stroke disappears

- [ ] **UC3: Undo/Redo**
  - Draw 5 strokes
  - Tap Undo 3 times
  - Verify last 3 strokes disappear
  - Tap Redo 2 times
  - Verify 2 strokes reappear

- [ ] **UC4: Clear Canvas**
  - Draw several strokes
  - Tap Clear button
  - Confirm in alert
  - Verify all strokes disappear

#### Multi-Page Testing
- [ ] **UC5: Drawings Per Page**
  - Create 3 pages
  - Draw a "1" on page 1
  - Draw a "2" on page 2
  - Draw a "3" on page 3
  - Navigate back and forth
  - Verify each page shows correct drawing

- [ ] **UC6: Persistence Across Restart**
  - Draw on page 1
  - Navigate to page 2, draw
  - Force quit app
  - Relaunch app
  - Check both pages
  - Verify drawings persisted

#### Apple Pencil Testing (if available)
- [ ] **UC7: Apple Pencil**
  - Draw with Apple Pencil
  - Verify drawing works smoothly
  - Compare to finger drawing (should feel similar or better)

#### Performance Testing
- [ ] **UC8: Heavy Drawing**
  - Draw 50+ strokes continuously
  - Check for lag or dropped frames
  - Verify app doesn't freeze
  - Verify autosave still works

#### Stress Testing
- [ ] **UC9: Storage Limits**
  - Draw 200+ strokes on one page
  - Verify app doesn't crash
  - Check if limit warning appears (if implemented)

---

## 8. Dependencies

### New Dependency: @shopify/react-native-skia

**Package:** `@shopify/react-native-skia`
**Version:** ^1.0.0 (latest stable)
**Size:** ~5MB (native binaries included)
**License:** MIT

**Why:**
- Industry-standard 2D graphics engine
- Native performance (GPU accelerated)
- Excellent React Native support
- Active maintenance (Shopify)
- Used by major apps (Shopify, Coinbase, etc.)

**Installation:**
```bash
npm install @shopify/react-native-skia
cd ios && pod install && cd ..
```

**Platform Support:**
- iOS: ✅ Full support
- Android: ✅ Full support (not needed yet)

---

## 9. Implementation Sequence

### Phase 1: Setup & Basic Drawing (Core)
1. Install @shopify/react-native-skia
2. Update [src/types/models.ts](src/types/models.ts) with drawing interfaces
3. Create [src/components/DrawingCanvas.tsx](src/components/DrawingCanvas.tsx)
   - Basic Skia canvas setup
   - Pen tool (black, medium stroke)
   - Render strokes in real-time
4. Integrate DrawingCanvas into PageEditorScreen
5. Test basic drawing works

### Phase 2: Storage & Persistence
6. Create [src/utils/strokeSimplification.ts](src/utils/strokeSimplification.ts)
7. Update [src/storage/pages.ts](src/storage/pages.ts) with drawing functions
8. Implement autosave in PageEditorScreen
9. Implement load drawing on page change
10. Test persistence across page navigation and app restarts

### Phase 3: Tools & Actions
11. Create [src/components/DrawingToolbar.tsx](src/components/DrawingToolbar.tsx)
12. Implement eraser tool in DrawingCanvas
13. Implement undo/redo logic
14. Implement clear canvas
15. Test all tools and actions

### Phase 4: Polish & Testing
16. Add loading states
17. Add autosave indicator (optional)
18. Performance testing and optimization
19. Run full test checklist
20. Update PROJECT_STATE.md

---

## 10. Risks & Mitigations

### Risk 1: Skia Native Module Installation Issues
**Impact:** High (blocker)
**Probability:** Low (Skia is well-maintained)
**Mitigation:**
- Follow official installation guide carefully
- Test on physical iPad (not just simulator)
- If issues arise, check CocoaPods cache

### Risk 2: Performance Issues with Large Drawings
**Impact:** Medium
**Probability:** Low (Skia is very fast)
**Mitigation:**
- Implement stroke limits (1000 strokes/page)
- Monitor performance with 100+ strokes
- If needed, implement canvas virtualization (only render visible area)

### Risk 3: AsyncStorage Size Limits
**Impact:** Medium
**Probability:** Medium (depends on usage)
**Mitigation:**
- Stroke simplification (reduces size by 50-70%)
- Storage limits (max 5MB/page)
- Migration path to SQLite documented

### Risk 4: Eraser UX Not Intuitive
**Impact:** Low
**Probability:** Medium (stroke-level eraser may feel clunky)
**Mitigation:**
- Implement stroke-level eraser for MVP (simple)
- If user feedback is negative, upgrade to path-splitting eraser post-MVP

---

## 11. Future Enhancements (Not for Task 7)

These features are explicitly **out of scope** for Task 7:

- ❌ Export to PNG (Task 8)
- ❌ Selection mode (Task 9)
- ❌ AI integration (Task 10+)
- ❌ Color picker (multiple pen colors)
- ❌ Stroke width slider
- ❌ Apple Pencil pressure sensitivity
- ❌ Shape recognition (convert scribbles to shapes)
- ❌ Layers
- ❌ Text tool
- ❌ Image import

---

## 12. Open Questions

**None** - All requirements are clear. Ready for approval.

---

## 13. Estimated Complexity

**Code Changes:**
- New files: 3 (DrawingCanvas, DrawingToolbar, strokeSimplification)
- Modified files: 3 (models.ts, pages.ts, PageEditorScreen.tsx)
- Total new lines: ~600-700 lines

**Risk Assessment:** **Medium**
- New dependency (Skia) adds complexity
- Drawing state management is non-trivial
- Undo/redo logic requires careful handling
- Performance is critical (but Skia should handle it)

**Testing Effort:** **High**
- Many edge cases (undo/redo, persistence, tools)
- Performance testing required
- Cross-device testing (finger vs Apple Pencil)

**Estimated Time:** Moderate complexity, but well-scoped.

---

## 14. Success Criteria

**MVP is successful if:**
1. ✅ User can draw handwritten notes on iPad
2. ✅ Drawing feels smooth (60fps subjective)
3. ✅ Drawings persist across app restarts
4. ✅ Undo/Redo/Clear work reliably
5. ✅ No breaking changes to Task 6 (page navigation)
6. ✅ AsyncStorage handles typical usage (100 strokes/page)
7. ✅ No crashes or red boxes

---

**End of Plan - Ready for Review**
