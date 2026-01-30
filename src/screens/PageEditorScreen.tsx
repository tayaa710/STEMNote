import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  Alert,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import RNFS from 'react-native-fs';
import { RootStackParamList } from '../types/navigation';
import { DrawingData, DrawingTool, Page, SelectionRect } from '../types/models';
import {
  loadPagesByNote,
  createPage,
  ensurePageExists,
} from '../storage/pages';
import { loadDrawingData, saveDrawingData } from '../storage/drawings';
import DrawingCanvas, { DrawingCanvasHandle } from '../components/DrawingCanvas';
import DrawingToolbar from '../components/DrawingToolbar';
import {
  getExportSizeForLogicalSize,
  renderDrawingToPngBase64,
  renderRegionToPngBase64,
} from '../utils/exportDrawing';

type Props = NativeStackScreenProps<RootStackParamList, 'PageEditor'>;

const DRAWING_SAVE_DEBOUNCE_MS = 500;
const EMPTY_DRAWING: DrawingData = { version: 1, strokes: [] };

const PageEditorScreen = ({ route, navigation }: Props) => {
  const { folderId, noteId, pageIndex } = route.params;

  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [drawingData, setDrawingData] = useState<DrawingData | null>(null);
  const [activeTool, setActiveTool] = useState<DrawingTool>('pen');
  const [savingDrawing, setSavingDrawing] = useState(false);
  const [loadingDrawing, setLoadingDrawing] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);

  // Track last processed pageIndex to avoid setParams loops
  const lastProcessedIndex = useRef<number | null>(null);
  const initialLoadRef = useRef(true);
  const lastNoteIdRef = useRef<string | null>(null);
  const drawingDataRef = useRef<DrawingData | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPageIdRef = useRef<string | null>(null);
  const previousPageIdRef = useRef<string | null>(null);
  const canvasRef = useRef<DrawingCanvasHandle | null>(null);
  const canvasSizeRef = useRef<{ width: number; height: number } | null>(null);
  const headerHeight = useHeaderHeight();

  // Load and initialize pages
  useEffect(() => {
    const initializePages = async () => {
      const shouldShowLoading = initialLoadRef.current || lastNoteIdRef.current !== noteId;
      if (shouldShowLoading) {
        setLoading(true);
      }
      try {
        let loadedPages = await loadPagesByNote(noteId);

        // Handle invalid pageIndex
        let targetIndex = pageIndex;

        if (loadedPages.length === 0) {
          // No pages exist
          if (pageIndex === 0) {
            // Auto-create first page
            loadedPages = await ensurePageExists(noteId, 0);
            targetIndex = 0;
          } else {
            // Invalid index, set to 0 and auto-create
            targetIndex = 0;
            loadedPages = await ensurePageExists(noteId, 0);
            // Update navigation params only if changed
            if (pageIndex !== targetIndex && lastProcessedIndex.current !== targetIndex) {
              lastProcessedIndex.current = targetIndex;
              navigation.setParams({ pageIndex: targetIndex });
            }
          }
        } else {
          // Pages exist - clamp to valid range
          const maxValidIndex = loadedPages.length - 1;
          if (pageIndex > maxValidIndex) {
            // Clamp to last valid page
            targetIndex = maxValidIndex;
            // Update navigation params only if changed
            if (pageIndex !== targetIndex && lastProcessedIndex.current !== targetIndex) {
              lastProcessedIndex.current = targetIndex;
              navigation.setParams({ pageIndex: targetIndex });
            }
          }
        }

        setPages(loadedPages);

        // Find current page by index
        const page = loadedPages.find(p => p.pageIndex === targetIndex);
        setCurrentPage(page || null);
      } catch (error) {
        console.error('Failed to initialize pages:', error);
      } finally {
        if (shouldShowLoading) {
          setLoading(false);
        }
        initialLoadRef.current = false;
        lastNoteIdRef.current = noteId;
      }
    };

    initializePages();
  }, [noteId, pageIndex, navigation]);

  const persistDrawing = useCallback(async (pageId: string, data: DrawingData) => {
    setSavingDrawing(true);
    try {
      await saveDrawingData(pageId, data);
    } catch (error) {
      console.error('Failed to save drawing data:', error);
    } finally {
      setSavingDrawing(false);
    }
  }, []);

  const flushSave = useCallback(
    async (pageId: string | null) => {
      if (!pageId) {
        return;
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      const dataToSave = drawingDataRef.current ?? EMPTY_DRAWING;
      await persistDrawing(pageId, dataToSave);
    },
    [persistDrawing],
  );

  const handleDrawingChange = useCallback(
    (updatedData: DrawingData) => {
      const pageId = currentPageIdRef.current;
      if (!pageId) {
        return;
      }
      drawingDataRef.current = updatedData;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        void persistDrawing(pageId, updatedData);
      }, DRAWING_SAVE_DEBOUNCE_MS);
    },
    [persistDrawing],
  );

  const handleHistoryChange = useCallback((undoAvailable: boolean, redoAvailable: boolean) => {
    setCanUndo(undoAvailable);
    setCanRedo(redoAvailable);
  }, []);

  const handleUndo = useCallback(() => {
    canvasRef.current?.undo();
  }, []);

  const handleRedo = useCallback(() => {
    canvasRef.current?.redo();
  }, []);

  const handleClear = useCallback(() => {
    canvasRef.current?.clear();
  }, []);

  const handleCanvasLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) {
      return;
    }
    const nextSize = { width, height };
    const currentSize = canvasSizeRef.current;
    if (!currentSize || currentSize.width !== width || currentSize.height !== height) {
      canvasSizeRef.current = nextSize;
      setCanvasSize(nextSize);
    }
  }, []);

  const handleSelectionChange = useCallback((rect: SelectionRect | null) => {
    setSelectionRect(rect);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectionRect(null);
  }, []);

  const handleExportPng = useCallback(async () => {
    if (exporting) {
      return;
    }
    const pageId = currentPageIdRef.current;
    const logicalSize = canvasSizeRef.current;
    if (!pageId || !logicalSize) {
      Alert.alert('Export unavailable', 'Canvas is not ready yet.');
      return;
    }

    setExporting(true);
    try {
      const latestData =
        canvasRef.current?.getDrawingData() ??
        drawingDataRef.current ??
        EMPTY_DRAWING;
      drawingDataRef.current = latestData;
      await flushSave(pageId);

      const outputSize = getExportSizeForLogicalSize(logicalSize);
      const base64 = renderDrawingToPngBase64(latestData, logicalSize, outputSize);

      const exportDir = `${RNFS.DocumentDirectoryPath}/exports`;
      await RNFS.mkdir(exportDir);
      const filename = `note_${noteId}_page_${pageIndex + 1}_${Date.now()}.png`;
      const filePath = `${exportDir}/${filename}`;
      await RNFS.writeFile(filePath, base64, 'base64');

      Alert.alert('Exported PNG', `Saved to:\n${filePath}`);
    } catch (error) {
      console.error('Failed to export PNG:', error);
      Alert.alert('Export failed', 'Unable to export PNG. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [exporting, flushSave, noteId, pageIndex]);

  const handleExportSelection = useCallback(async () => {
    if (exporting || !selectionRect) {
      return;
    }
    const pageId = currentPageIdRef.current;
    const logicalSize = canvasSizeRef.current;
    if (!pageId || !logicalSize) {
      Alert.alert('Export unavailable', 'Canvas is not ready yet.');
      return;
    }

    setExporting(true);
    try {
      const latestData =
        canvasRef.current?.getDrawingData() ??
        drawingDataRef.current ??
        EMPTY_DRAWING;
      drawingDataRef.current = latestData;
      await flushSave(pageId);

      const base64 = renderRegionToPngBase64(latestData, logicalSize, selectionRect);

      const exportDir = `${RNFS.DocumentDirectoryPath}/exports`;
      await RNFS.mkdir(exportDir);
      const filename = `note_${noteId}_page_${pageIndex + 1}_region_${Date.now()}.png`;
      const filePath = `${exportDir}/${filename}`;
      await RNFS.writeFile(filePath, base64, 'base64');

      Alert.alert('Exported Selection', `Saved to:\n${filePath}`);
      setSelectionRect(null); // Clear selection after successful export
    } catch (error) {
      console.error('Failed to export selection:', error);
      Alert.alert('Export failed', 'Unable to export selection. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [exporting, selectionRect, flushSave, noteId, pageIndex]);

  useEffect(() => {
    const previousPageId = previousPageIdRef.current;
    if (previousPageId && previousPageId !== currentPage?.id) {
      void flushSave(previousPageId);
    }
    previousPageIdRef.current = currentPage?.id ?? null;
  }, [currentPage?.id, flushSave]);

  useEffect(() => {
    const pageId = currentPage?.id;
    if (!pageId) {
      setDrawingData(null);
      drawingDataRef.current = null;
      return;
    }

    currentPageIdRef.current = pageId;
    setLoadingDrawing(true);
    setCanUndo(false);
    setCanRedo(false);

    let isActive = true;
    const loadDrawing = async () => {
      try {
        const data = await loadDrawingData(pageId);
        if (!isActive) {
          return;
        }
        const resolved = data ?? EMPTY_DRAWING;
        setDrawingData(resolved);
        drawingDataRef.current = resolved;
      } catch (error) {
        console.error('Failed to load drawing data:', error);
        if (isActive) {
          setDrawingData(EMPTY_DRAWING);
          drawingDataRef.current = EMPTY_DRAWING;
        }
      } finally {
        if (isActive) {
          setLoadingDrawing(false);
        }
      }
    };

    loadDrawing();

    return () => {
      isActive = false;
    };
  }, [currentPage?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'inactive' || nextState === 'background') {
        void flushSave(currentPageIdRef.current);
      }
    });
    return () => {
      subscription.remove();
    };
  }, [flushSave]);

  useEffect(() => {
    return () => {
      void flushSave(currentPageIdRef.current);
    };
  }, [flushSave]);

  // Clear selection when switching tools away from select, or when page changes
  useEffect(() => {
    if (activeTool !== 'select') {
      setSelectionRect(null);
    }
  }, [activeTool]);

  useEffect(() => {
    setSelectionRect(null);
  }, [currentPage?.id]);

  const handlePreviousPage = () => {
    if (pageIndex > 0) {
      const newIndex = pageIndex - 1;
      lastProcessedIndex.current = newIndex;
      navigation.setParams({ pageIndex: newIndex });
    }
  };

  const handleNextPage = () => {
    const maxIndex = pages.length - 1;
    if (pageIndex < maxIndex) {
      const newIndex = pageIndex + 1;
      lastProcessedIndex.current = newIndex;
      navigation.setParams({ pageIndex: newIndex });
    }
  };

  const handleCreateNewPage = async () => {
    setCreating(true);
    try {
      const updatedPages = await createPage(noteId);
      setPages(updatedPages);

      // Navigate to the new page (last one)
      const newPageIndex = updatedPages.length - 1;
      lastProcessedIndex.current = newPageIndex;
      navigation.setParams({ pageIndex: newPageIndex });
    } catch (error) {
      console.error('Failed to create new page:', error);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={[styles.loadingContainer, { paddingTop: headerHeight }]}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading page...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalPages = pages.length;
  const displayPageNumber = pageIndex + 1;

  const isPreviousDisabled = pageIndex === 0;
  const isNextDisabled = pageIndex >= totalPages - 1;
  const isExportDisabled = exporting || loadingDrawing || !canvasSize || !currentPage?.id;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={[styles.container, { paddingTop: headerHeight }]}>
      {/* Page info section */}
      <View style={styles.pageInfoSection}>
        <View style={styles.pageInfoRow}>
          <Text style={styles.pageInfoText}>
            Page {displayPageNumber} of {totalPages}
          </Text>
          <TouchableOpacity
            style={[
              styles.exportButton,
              isExportDisabled && styles.exportButtonDisabled,
            ]}
            onPress={handleExportPng}
            disabled={isExportDisabled}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.exportButtonText}>Export PNG</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <DrawingToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        canUndo={canUndo}
        canRedo={canRedo}
        saving={savingDrawing}
        loading={loadingDrawing}
        hasSelection={selectionRect !== null}
        onClearSelection={handleClearSelection}
        onExportSelection={handleExportSelection}
      />

      <View style={styles.canvasContainer} onLayout={handleCanvasLayout}>
        <DrawingCanvas
          ref={canvasRef}
          pageId={currentPage?.id ?? ''}
          drawingData={drawingData}
          activeTool={activeTool}
          onDrawingChange={handleDrawingChange}
          onHistoryChange={handleHistoryChange}
          isInteractive={!loadingDrawing}
          selectionRect={selectionRect}
          onSelectionChange={handleSelectionChange}
        />
      </View>

      {/* Navigation controls */}
      <View style={styles.navigationBar}>
        <TouchableOpacity
          style={[styles.navButton, isPreviousDisabled && styles.navButtonDisabled]}
          onPress={handlePreviousPage}
          disabled={isPreviousDisabled}
        >
          <Text style={[styles.navButtonText, isPreviousDisabled && styles.navButtonTextDisabled]}>
            ← Previous
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.createButton, creating && styles.createButtonDisabled]}
          onPress={handleCreateNewPage}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>+ New Page</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, isNextDisabled && styles.navButtonDisabled]}
          onPress={handleNextPage}
          disabled={isNextDisabled}
        >
          <Text style={[styles.navButtonText, isNextDisabled && styles.navButtonTextDisabled]}>
            Next →
          </Text>
        </TouchableOpacity>
      </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  pageInfoSection: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pageInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageInfoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  exportButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonDisabled: {
    backgroundColor: '#c7c7cc',
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  navigationBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonTextDisabled: {
    color: '#999',
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#34C759',
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PageEditorScreen;
