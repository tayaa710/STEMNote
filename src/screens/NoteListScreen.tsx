import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { Note } from '../types/models';
import {
  loadNotesByFolder,
  createNote,
  deleteNote,
} from '../storage/notes';

type Props = NativeStackScreenProps<RootStackParamList, 'NoteList'>;

const CreateNoteHeader = ({
  newNoteTitle,
  setNewNoteTitle,
  handleCreateNote,
  creating,
}: {
  newNoteTitle: string;
  setNewNoteTitle: (text: string) => void;
  handleCreateNote: () => void;
  creating: boolean;
}) => (
  <View style={styles.createSection}>
    <TextInput
      style={styles.input}
      placeholder="New note title..."
      value={newNoteTitle}
      onChangeText={setNewNoteTitle}
      onSubmitEditing={handleCreateNote}
      returnKeyType="done"
      editable={!creating}
    />
    <TouchableOpacity
      style={[styles.addButton, creating && styles.addButtonDisabled]}
      onPress={handleCreateNote}
      disabled={creating}
    >
      {creating ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={styles.addButtonText}>Add</Text>
      )}
    </TouchableOpacity>
  </View>
);

const NoteListScreen = ({ route, navigation }: Props) => {
  const { folderId } = route.params;
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadNotesByFolder(folderId)
      .then(setNotes)
      .finally(() => setLoading(false));
  }, [folderId]);

  const handleCreateNote = async () => {
    const trimmedTitle = newNoteTitle.trim();

    if (!trimmedTitle) {
      Alert.alert('Invalid Title', 'Please enter a note title.');
      return;
    }

    if (trimmedTitle.length > 200) {
      Alert.alert('Title Too Long', 'Note title must be 200 characters or less.');
      return;
    }

    setCreating(true);
    try {
      const updated = await createNote(folderId, trimmedTitle);
      setNotes(updated);
      setNewNoteTitle('');
    } catch (error) {
      Alert.alert('Error', 'Failed to create note. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteNote = (note: Note) => {
    Alert.alert(
      'Delete Note',
      `Are you sure you want to delete "${note.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await deleteNote(folderId, note.id);
              setNotes(updated);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete note. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleNotePress = (note: Note) => {
    navigation.navigate('PageEditor', {
      folderId: note.folderId,
      noteId: note.id,
      pageIndex: 0,
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderNote = ({ item }: { item: Note }) => (
    <TouchableOpacity
      style={styles.noteItem}
      onPress={() => handleNotePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.noteContent}>
        <Text style={styles.noteTitle}>{item.title}</Text>
        <Text style={styles.noteDate}>Created {formatDate(item.createdAt)}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteNote(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>No notes yet.</Text>
      <Text style={styles.emptyStateSubtext}>Create one to get started.</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading notes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notes}
        renderItem={renderNote}
        keyExtractor={item => item.id}
        contentContainerStyle={notes.length === 0 ? styles.emptyListContainer : styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={
          <CreateNoteHeader
            newNoteTitle={newNoteTitle}
            setNewNoteTitle={setNewNoteTitle}
            handleCreateNote={handleCreateNote}
            creating={creating}
          />
        }
      />
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
  createSection: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  addButton: {
    marginLeft: 12,
    paddingHorizontal: 20,
    height: 44,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#999',
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  noteContent: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  noteDate: {
    fontSize: 14,
    color: '#666',
  },
  deleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default NoteListScreen;
