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
import { Folder } from '../types/models';
import {
  loadFolders,
  createFolder,
  deleteFolder,
} from '../storage/folders';

type Props = NativeStackScreenProps<RootStackParamList, 'FolderList'>;

const CreateFolderHeader = ({
  newFolderName,
  setNewFolderName,
  handleCreateFolder,
  creating,
}: {
  newFolderName: string;
  setNewFolderName: (text: string) => void;
  handleCreateFolder: () => void;
  creating: boolean;
}) => (
  <View style={styles.createSection}>
    <TextInput
      style={styles.input}
      placeholder="New folder name..."
      value={newFolderName}
      onChangeText={setNewFolderName}
      onSubmitEditing={handleCreateFolder}
      returnKeyType="done"
      editable={!creating}
    />
    <TouchableOpacity
      style={[styles.addButton, creating && styles.addButtonDisabled]}
      onPress={handleCreateFolder}
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

const FolderListScreen = ({ navigation }: Props) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadFolders()
      .then(setFolders)
      .finally(() => setLoading(false));
  }, []);

  const handleCreateFolder = async () => {
    const trimmedName = newFolderName.trim();

    if (!trimmedName) {
      Alert.alert('Invalid Name', 'Please enter a folder name.');
      return;
    }

    if (trimmedName.length > 100) {
      Alert.alert('Name Too Long', 'Folder name must be 100 characters or less.');
      return;
    }

    setCreating(true);
    try {
      const updated = await createFolder(trimmedName);
      setFolders(updated);
      setNewFolderName('');
    } catch (error) {
      Alert.alert('Error', 'Failed to create folder. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteFolder = (folder: Folder) => {
    Alert.alert(
      'Delete Folder',
      `Are you sure you want to delete "${folder.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await deleteFolder(folder.id);
              setFolders(updated);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete folder. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleFolderPress = (folder: Folder) => {
    navigation.navigate('NoteList', { folderId: folder.id });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderFolder = ({ item }: { item: Folder }) => (
    <TouchableOpacity
      style={styles.folderItem}
      onPress={() => handleFolderPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.folderContent}>
        <Text style={styles.folderName}>{item.name}</Text>
        <Text style={styles.folderDate}>Created {formatDate(item.createdAt)}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteFolder(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>No folders yet.</Text>
      <Text style={styles.emptyStateSubtext}>Create one to get started.</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading folders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={folders}
        renderItem={renderFolder}
        keyExtractor={item => item.id}
        contentContainerStyle={folders.length === 0 ? styles.emptyListContainer : styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={
          <CreateFolderHeader
            newFolderName={newFolderName}
            setNewFolderName={setNewFolderName}
            handleCreateFolder={handleCreateFolder}
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
  folderItem: {
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
  folderContent: {
    flex: 1,
  },
  folderName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  folderDate: {
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

export default FolderListScreen;
