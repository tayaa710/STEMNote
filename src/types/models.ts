export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  folderId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Page {
  id: string;
  noteId: string;
  pageIndex: number;
  createdAt: number;
  updatedAt: number;
}

export type DrawingTool = 'pen' | 'eraser' | 'select';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawingData {
  version: number;
  strokes: Stroke[];
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  tool: 'pen';
  timestamp: number;
}

export interface Point {
  x: number;
  y: number;
}
