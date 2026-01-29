import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'NoteList'>;

const NoteListScreen = ({ route, navigation }: Props) => {
  const { folderId } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Note list will go here</Text>
      <Text style={styles.subtitle}>Folder ID: {folderId}</Text>
      <Button
        title="Edit Page (Mock)"
        onPress={() =>
          navigation.navigate('PageEditor', {
            folderId,
            noteId: 'note-1',
            pageIndex: 0,
          })
        }
      />
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
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
});

export default NoteListScreen;
