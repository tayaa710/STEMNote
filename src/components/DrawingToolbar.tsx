import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { DrawingTool } from '../types/models';

interface DrawingToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saving?: boolean;
  loading?: boolean;
  hasSelection?: boolean;
  onClearSelection?: () => void;
  onExportSelection?: () => void;
}

const DrawingToolbar = ({
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  saving = false,
  loading = false,
  hasSelection = false,
  onClearSelection,
  onExportSelection,
}: DrawingToolbarProps) => {
  const handleClear = () => {
    Alert.alert(
      'Clear canvas?',
      'This will remove all strokes on this page.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: onClear },
      ],
    );
  };

  return (
    <View style={styles.toolbar}>
      <View style={styles.group}>
        <TouchableOpacity
          style={[
            styles.toolButton,
            activeTool === 'pen' && styles.toolButtonActive,
          ]}
          onPress={() => onToolChange('pen')}
        >
          <Text
            style={[
              styles.toolButtonText,
              activeTool === 'pen' && styles.toolButtonTextActive,
            ]}
          >
            Pen
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toolButton,
            activeTool === 'eraser' && styles.toolButtonActive,
          ]}
          onPress={() => onToolChange('eraser')}
        >
          <Text
            style={[
              styles.toolButtonText,
              activeTool === 'eraser' && styles.toolButtonTextActive,
            ]}
          >
            Eraser
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toolButton,
            activeTool === 'select' && styles.toolButtonActive,
          ]}
          onPress={() => onToolChange('select')}
        >
          <Text
            style={[
              styles.toolButtonText,
              activeTool === 'select' && styles.toolButtonTextActive,
            ]}
          >
            Select
          </Text>
        </TouchableOpacity>
      </View>

      {hasSelection && (
        <View style={styles.group}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onClearSelection}
          >
            <Text style={styles.actionButtonText}>Clear Sel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exportSelectionButton}
            onPress={onExportSelection}
          >
            <Text style={styles.actionButtonText}>Export Sel</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.group}>
        <TouchableOpacity
          style={[styles.actionButton, !canUndo && styles.actionButtonDisabled]}
          onPress={onUndo}
          disabled={!canUndo}
        >
          <Text
            style={[styles.actionButtonText, !canUndo && styles.disabledText]}
          >
            Undo
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, !canRedo && styles.actionButtonDisabled]}
          onPress={onRedo}
          disabled={!canRedo}
        >
          <Text
            style={[styles.actionButtonText, !canRedo && styles.disabledText]}
          >
            Redo
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.status}>
        {loading ? (
          <>
            <ActivityIndicator size="small" color="#666" />
            <Text style={styles.statusText}>Loading...</Text>
          </>
        ) : saving ? (
          <Text style={styles.statusText}>Saving...</Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    marginRight: 8,
    backgroundColor: '#f7f7f7',
  },
  toolButtonActive: {
    backgroundColor: '#1f6feb',
    borderColor: '#1f6feb',
  },
  toolButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  toolButtonTextActive: {
    color: '#fff',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    marginRight: 8,
  },
  actionButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledText: {
    color: '#999',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ff3b30',
  },
  exportSelectionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#34C759',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 90,
    justifyContent: 'flex-end',
  },
  statusText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#666',
  },
});

export default DrawingToolbar;
