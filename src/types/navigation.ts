export type RootStackParamList = {
  FolderList: undefined;
  NoteList: { folderId: string };
  PageEditor: { folderId: string; noteId: string; pageIndex: number };
};
