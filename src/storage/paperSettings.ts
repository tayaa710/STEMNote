import AsyncStorage from '@react-native-async-storage/async-storage';
import { PaperSettings } from '../types/models';

const PAPER_SETTINGS_KEY = '@paperSettings';

type PaperSettingsMap = Record<string, PaperSettings>;

const DEFAULT_PAPER_SETTINGS: PaperSettings = {
  background: 'blank',
  lineSpacing: 'medium',
};

async function loadAllPaperSettings(): Promise<PaperSettingsMap> {
  try {
    const json = await AsyncStorage.getItem(PAPER_SETTINGS_KEY);
    if (!json) {
      return {};
    }
    return JSON.parse(json) as PaperSettingsMap;
  } catch (error) {
    console.error('Failed to load paper settings:', error);
    return {};
  }
}

async function saveAllPaperSettings(settings: PaperSettingsMap): Promise<void> {
  await AsyncStorage.setItem(PAPER_SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadPaperSettings(
  pageId: string,
): Promise<PaperSettings> {
  try {
    const allSettings = await loadAllPaperSettings();
    return allSettings[pageId] ?? DEFAULT_PAPER_SETTINGS;
  } catch (error) {
    console.error('Failed to load paper settings for page:', pageId, error);
    return DEFAULT_PAPER_SETTINGS;
  }
}

export async function savePaperSettings(
  pageId: string,
  settings: PaperSettings,
): Promise<void> {
  try {
    const allSettings = await loadAllPaperSettings();
    allSettings[pageId] = settings;
    await saveAllPaperSettings(allSettings);
  } catch (error) {
    console.error('Failed to save paper settings for page:', pageId, error);
    throw error;
  }
}
