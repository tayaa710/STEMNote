import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { Folder } from '../types/models';

const FOLDERS_KEY = '@folders';

/**
 * Load all folders from AsyncStorage
 */
export async function loadFolders(): Promise<Folder[]> {
  try {
    const json = await AsyncStorage.getItem(FOLDERS_KEY);
    if (!json) {
      return [];
    }
    const folders = JSON.parse(json) as Folder[];
    return folders;
  } catch (error) {
    console.error('Failed to load folders:', error);
    return [];
  }
}

/**
 * Save a new folder and return the updated folder list
 */
export async function createFolder(name: string): Promise<Folder[]> {
  try {
    const folders = await loadFolders();
    const now = Date.now();
    const newFolder: Folder = {
      id: uuidv4(),
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...folders, newFolder];
    await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to create folder:', error);
    throw error;
  }
}

/**
 * Update an existing folder and return the updated folder list
 */
export async function updateFolder(
  id: string,
  updates: Partial<Pick<Folder, 'name'>>,
): Promise<Folder[]> {
  try {
    const folders = await loadFolders();
    const updated = folders.map(folder =>
      folder.id === id
        ? { ...folder, ...updates, updatedAt: Date.now() }
        : folder,
    );
    await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to update folder:', error);
    throw error;
  }
}

/**
 * Delete a folder and return the updated folder list
 */
export async function deleteFolder(id: string): Promise<Folder[]> {
  try {
    const folders = await loadFolders();
    const updated = folders.filter(folder => folder.id !== id);
    await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to delete folder:', error);
    throw error;
  }
}
