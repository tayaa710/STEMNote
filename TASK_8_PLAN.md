# Task 8 Plan (Final) - Export Full Page to PNG

**Status:** Implemented (verification pending iOS run)
**Created:** 2026-01-29

---

## 1. Rendering Approach

- Use the existing Skia offscreen renderer in `src/utils/exportDrawing.ts`:
  - `renderDrawingToPngBase64(drawingData, logicalSize, outputSize)`
  - `getExportSizeForLogicalSize(logicalSize)` for fixed portrait/landscape output.
- Capture the logical canvas size via `onLayout` in `PageEditorScreen` and store it in a ref/state.
- Use the latest in-memory drawing data via `canvasRef.getDrawingData()`.
- Flush any pending debounced save before export so the persisted data stays in sync.

## 2. File Storage (iOS)

- Use existing dependency `react-native-fs`.
- Export directory: `${RNFS.DocumentDirectoryPath}/exports` (created if missing).
- File name format:
  - `note_${noteId}_page_${pageIndex+1}_${timestamp}.png`
- Save with `RNFS.writeFile(filePath, base64, 'base64')`.
- Files persist across app restarts because they are stored in the Documents directory.

## 3. UI Changes

- Add an `Export PNG` button in the PageEditorScreen header row.
- Disable the button while exporting, while drawing is loading, or before canvas size is known.
- Show a subtle loading indicator (ActivityIndicator) inside the button while exporting.
- Show success/error alerts with the file location on success.

## 4. Files Modified

- `src/screens/PageEditorScreen.tsx`
  - Track canvas logical size via `onLayout`.
  - Add export handler and button UI.
  - Use Skia export + RNFS write.

## 5. Definition of Done

- Export button is available on PageEditorScreen.
- PNG represents the full page drawing and matches the on-screen canvas.
- Output size is stable (fixed portrait/landscape dimensions).
- PNG is saved to `Documents/exports` and persists across restarts.
- TypeScript compiles with no errors.

## 6. Manual Test Checklist

- [ ] Export blank page → PNG saved and opens correctly.
- [ ] Draw strokes, export → PNG matches canvas visually.
- [ ] Export multiple pages → unique filenames and correct page content.
- [ ] Restart app → previously exported file still exists.
- [ ] Export while autosave debounce pending → latest strokes included.
- [ ] Export while loading drawing → button disabled.

## 7. Implementation Notes

- Logical canvas size is captured from the canvas container `onLayout`.
- Export uses `canvasRef.getDrawingData()` as the authoritative in-memory source.
- `flushSave(pageId)` is called before export to sync persisted drawing data.

## 8. Verification

- `npm run ios` failed: CoreSimulatorService connection invalid (simctl device list failed).
- `npx tsc --noEmit` passed.

---

**End of Task 8 Plan (Final)**
