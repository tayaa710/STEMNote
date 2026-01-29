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
