export interface Citation {
  id: string;
  title: string;
  snippet: string;
  source: 'page' | 'region' | 'external'; // 'page' = from indexed content, 'region' = current selection
  noteId?: string; // For navigation to source page
  pageIndex?: number; // 0-based index for navigation
}
