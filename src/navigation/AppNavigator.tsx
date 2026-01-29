import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import FolderListScreen from '../screens/FolderListScreen';
import NoteListScreen from '../screens/NoteListScreen';
import PageEditorScreen from '../screens/PageEditorScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="FolderList"
      screenOptions={{
        headerLargeTitle: true,
      }}
    >
      <Stack.Screen
        name="FolderList"
        component={FolderListScreen}
        options={{ title: 'Folders' }}
      />
      <Stack.Screen
        name="NoteList"
        component={NoteListScreen}
        options={{ title: 'Notes' }}
      />
      <Stack.Screen
        name="PageEditor"
        component={PageEditorScreen}
        options={{ title: 'Page Editor' }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;
