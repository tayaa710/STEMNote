import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Animated,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import type {Citation} from '../types/ai';
import {askRegion} from '../ai/apiClient';
import MathText from './MathText';

interface AskSheetProps {
  visible: boolean;
  onClose: () => void;
  pageId: string;
  regionImageBase64: string | null;
}

const AskSheet: React.FC<AskSheetProps> = ({visible, onClose, pageId, regionImageBase64}) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);

  const slideAnim = useRef(new Animated.Value(1000)).current;
  const screenHeight = Dimensions.get('window').height;

  // Animate panel in/out
  useEffect(() => {
    if (visible) {
      console.log('[AskSheet] Opening panel');
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else {
      console.log('[AskSheet] Closing panel');
      Animated.timing(slideAnim, {
        toValue: 1000,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // Reset answer/citations when question is cleared
  useEffect(() => {
    if (question.trim() === '') {
      setAnswer(null);
      setCitations([]);
    }
  }, [question]);

  const handleSubmit = async () => {
    console.log('[AskSheet] Submit pressed, question length:', question.length, 'trimmed:', question.trim().length);
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || loading || !regionImageBase64) {
      console.log('[AskSheet] Submit blocked - empty question, loading, or no image');
      return;
    }

    console.log('[AskSheet] Calling askRegion API');
    setLoading(true);
    setAnswer(null);
    setCitations([]);

    try {
      const result = await askRegion({
        pageId,
        regionImageBase64,
        question: trimmedQuestion,
      });

      if (result.ok) {
        console.log('[AskSheet] API success');
        setAnswer(result.data.answer);
        // Map API citations to component Citation type
        setCitations(
          result.data.citations.map(c => ({
            id: c.id,
            title: c.title,
            snippet: c.snippet,
            source: 'page' as const,
          }))
        );
      } else {
        console.error('[AskSheet] API error:', result.code, result.error);
        // User-friendly error messages based on error code
        let errorMessage = 'Something went wrong. Please try again.';
        if (result.status === 429) {
          errorMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (result.code === 'NETWORK_ERROR') {
          errorMessage = 'Network error. Please check your connection.';
        } else if (result.status === 504) {
          errorMessage = 'Request timed out. Please try again.';
        }
        setAnswer(errorMessage);
      }
    } catch (error) {
      console.error('[AskSheet] Unexpected error:', error);
      setAnswer('An unexpected error occurred. Please try again.');
    } finally {
      console.log('[AskSheet] Clearing loading state');
      setLoading(false);
    }
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 1000,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 1000],
    outputRange: [0.5, 0],
  });

  const isSubmitDisabled = question.trim() === '' || loading || !regionImageBase64;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}>
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, {opacity: backdropOpacity}]}
        pointerEvents={visible ? 'auto' : 'none'}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
        />
      </Animated.View>

      {/* Panel */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}>
        <Animated.View
          style={[
            styles.panel,
            {
              transform: [{translateY: slideAnim}],
              height: screenHeight * 0.6,
            },
          ]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Ask About This Page</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Question Input */}
          <View style={styles.inputSection}>
            <TextInput
              style={styles.questionInput}
              placeholder="Ask a question about this page..."
              placeholderTextColor="#999"
              value={question}
              onChangeText={setQuestion}
              multiline
              maxLength={500}
              returnKeyType="done"
              blurOnSubmit={true}
              enablesReturnKeyAutomatically={true}
              editable={!loading}
            />
            <Text style={styles.charCount}>
              {question.length}/500
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              isSubmitDisabled && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitDisabled}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Ask</Text>
            )}
          </TouchableOpacity>

          {/* Warning when no image */}
          {!regionImageBase64 && !loading && (
            <Text style={styles.noImageWarning}>
              Unable to capture page content. Please try again.
            </Text>
          )}

          {/* Answer Section */}
          {(loading || answer) && (
            <ScrollView
              style={styles.answerSection}
              contentContainerStyle={styles.answerContentContainer}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.loadingText}>Thinking...</Text>
                </View>
              ) : (
                <>
                  {/* Answer */}
                  {answer && (
                    <View style={styles.answerContainer}>
                      <Text style={styles.answerLabel}>Answer:</Text>
                      <MathText content={answer} />
                    </View>
                  )}

                  {/* Citations */}
                  {citations.length > 0 && (
                    <View style={styles.citationsContainer}>
                      <Text style={styles.citationsLabel}>Sources:</Text>
                      {citations.map(citation => (
                        <View key={citation.id} style={styles.citationItem}>
                          <Text style={styles.citationTitle}>
                            {citation.title}
                            {citation.pageNumber
                              ? ` (Page ${citation.pageNumber})`
                              : ''}
                          </Text>
                          <Text style={styles.citationSnippet}>
                            {citation.snippet}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 28,
    color: '#666',
    fontWeight: '300',
  },
  inputSection: {
    marginBottom: 12,
  },
  questionInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    maxHeight: 120,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  submitButtonDisabled: {
    backgroundColor: '#c7c7cc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noImageWarning: {
    marginTop: 12,
    fontSize: 14,
    color: '#ff6b6b',
    textAlign: 'center',
  },
  answerSection: {
    marginTop: 16,
    flex: 1,
  },
  answerContentContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  answerContainer: {
    marginBottom: 20,
  },
  answerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  answerText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  citationsContainer: {
    marginTop: 12,
  },
  citationsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  citationItem: {
    backgroundColor: '#f5f5f5',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
    padding: 12,
    marginBottom: 8,
    borderRadius: 6,
  },
  citationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  citationSnippet: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
});

export default AskSheet;
