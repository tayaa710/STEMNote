import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'PageEditor'>;

const PageEditorScreen = ({ route }: Props) => {
  const { folderId, noteId, pageIndex } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Drawing canvas will go here</Text>
      <Text style={styles.subtitle}>Folder ID: {folderId}</Text>
      <Text style={styles.subtitle}>Note ID: {noteId}</Text>
      <Text style={styles.subtitle}>Page Index: {pageIndex}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    fontSize: 18,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
});

export default PageEditorScreen;
