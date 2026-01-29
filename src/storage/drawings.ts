import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrawingData } from '../types/models';

const PAGE_DRAWINGS_KEY = '@pageDrawings';

type PageDrawingsMap = Record<string, string>;

async function loadAllDrawings(): Promise<PageDrawingsMap> {
  try {
    const json = await AsyncStorage.getItem(PAGE_DRAWINGS_KEY);
    if (!json) {
      return {};
    }
    return JSON.parse(json) as PageDrawingsMap;
  } catch (error) {
    console.error('Failed to load page drawings:', error);
    return {};
  }
}

async function saveAllDrawings(drawings: PageDrawingsMap): Promise<void> {
  await AsyncStorage.setItem(PAGE_DRAWINGS_KEY, JSON.stringify(drawings));
}

export async function loadDrawingData(
  pageId: string,
): Promise<DrawingData | null> {
  try {
    const drawings = await loadAllDrawings();
    const serialized = drawings[pageId];
    if (!serialized) {
      return null;
    }
    return JSON.parse(serialized) as DrawingData;
  } catch (error) {
    console.error('Failed to load drawing data for page:', pageId, error);
    return null;
  }
}

export async function saveDrawingData(
  pageId: string,
  drawingData: DrawingData,
): Promise<void> {
  try {
    const drawings = await loadAllDrawings();
    drawings[pageId] = JSON.stringify(drawingData);
    await saveAllDrawings(drawings);
  } catch (error) {
    console.error('Failed to save drawing data for page:', pageId, error);
    throw error;
  }
}
