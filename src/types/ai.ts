export interface Citation {
  id: string;
  title: string;
  snippet: string;
  source: 'page' | 'external';
  pageNumber?: number;
}
