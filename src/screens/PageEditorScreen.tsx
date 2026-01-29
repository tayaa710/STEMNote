import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { Page } from '../types/models';
import {
  loadPagesByNote,
  createPage,
  ensurePageExists,
} from '../storage/pages';

type Props = NativeStackScreenProps<RootStackParamList, 'PageEditor'>;

const PageEditorScreen = ({ route, navigation }: Props) => {
  const { folderId, noteId, pageIndex } = route.params;

  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Track last processed pageIndex to avoid setParams loops
  const lastProcessedIndex = useRef<number | null>(null);

  // Load and initialize pages
  useEffect(() => {
    const initializePages = async () => {
      setLoading(true);
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
        setLoading(false);
      }
    };

    initializePages();
  }, [noteId, pageIndex, navigation]);

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading page...</Text>
      </View>
    );
  }

  const totalPages = pages.length;
  const displayPageNumber = pageIndex + 1;

  const isPreviousDisabled = pageIndex === 0;
  const isNextDisabled = pageIndex >= totalPages - 1;

  return (
    <View style={styles.container}>
      {/* Page info section */}
      <View style={styles.pageInfoSection}>
        <Text style={styles.pageInfoText}>
          Page {displayPageNumber} of {totalPages}
        </Text>
      </View>

      {/* Content area - placeholder for future drawing canvas */}
      <View style={styles.contentArea}>
        <Text style={styles.placeholderText}>Page content will appear here</Text>
        {currentPage && (
          <Text style={styles.pageIdText}>Page ID: {currentPage.id.slice(0, 8)}...</Text>
        )}
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
  );
};

const styles = StyleSheet.create({
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
    alignItems: 'center',
  },
  pageInfoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  contentArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    padding: 20,
  },
  placeholderText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 12,
  },
  pageIdText: {
    fontSize: 12,
    color: '#ccc',
    fontFamily: 'Menlo, monospace',
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
