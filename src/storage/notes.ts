import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { Note } from '../types/models';

const NOTES_KEY = '@notes';

/**
 * Internal helper: Load all notes from AsyncStorage
 */
async function loadAll(): Promise<Note[]> {
  try {
    const json = await AsyncStorage.getItem(NOTES_KEY);
    if (!json) {
      return [];
    }
    const notes = JSON.parse(json) as Note[];
    return notes;
  } catch (error) {
    console.error('Failed to load notes:', error);
    return [];
  }
}

/**
 * Internal helper: Save all notes to AsyncStorage
 */
async function saveAll(notes: Note[]): Promise<void> {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

/**
 * Load notes for a specific folder
 */
export async function loadNotesByFolder(folderId: string): Promise<Note[]> {
  try {
    const allNotes = await loadAll();
    return allNotes.filter(note => note.folderId === folderId);
  } catch (error) {
    console.error('Failed to load notes for folder:', folderId, error);
    return [];
  }
}

/**
 * Create a new note in the specified folder and return notes for that folder
 */
export async function createNote(
  folderId: string,
  title: string,
): Promise<Note[]> {
  try {
    const allNotes = await loadAll();
    const now = Date.now();
    const newNote: Note = {
      id: uuidv4(),
      folderId,
      title: title.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...allNotes, newNote];
    await saveAll(updated);
    // Return only notes for this folder
    return updated.filter(note => note.folderId === folderId);
  } catch (error) {
    console.error('Failed to create note:', error);
    throw error;
  }
}

/**
 * Delete a note and return remaining notes for that folder
 */
export async function deleteNote(
  folderId: string,
  noteId: string,
): Promise<Note[]> {
  try {
    const allNotes = await loadAll();
    const updated = allNotes.filter(note => note.id !== noteId);
    await saveAll(updated);
    // Return only notes for this folder
    return updated.filter(note => note.folderId === folderId);
  } catch (error) {
    console.error('Failed to delete note:', error);
    throw error;
  }
}
