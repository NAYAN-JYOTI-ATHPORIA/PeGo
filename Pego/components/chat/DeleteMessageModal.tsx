// components/chat/DeleteMessageModal.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../../src/services/firebase/chatService';

interface DeleteMessageModalProps {
  visible: boolean;
  message: ChatMessage | null;
  isMyMessage: boolean;
  onClose: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
}

export function DeleteMessageModal({
  visible,
  message,
  isMyMessage,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
}: DeleteMessageModalProps) {
  if (!visible || !message) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.popupCard} onPress={(e) => e.stopPropagation()}>
          {/* Trash Icon Circle */}
          <View style={styles.iconCircle}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </View>

          {/* Dialog Title */}
          <Text style={styles.title}>Delete message?</Text>

          {/* Subtitle / Description */}
          <Text style={styles.subtitle}>
            {isMyMessage
              ? 'Delete for everyone or for yourself only.'
              : 'This message will be removed from your chat history.'}
          </Text>

          {/* Stack of Roundy Action Buttons */}
          <View style={styles.buttonStack}>
            {/* Delete for Everyone (if sender) */}
            {isMyMessage && (
              <TouchableOpacity
                style={styles.deleteEveryoneBtn}
                onPress={onDeleteForEveryone}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteEveryoneText}>Delete for everyone</Text>
              </TouchableOpacity>
            )}

            {/* Delete for Me */}
            <TouchableOpacity
              style={styles.deleteForMeBtn}
              onPress={onDeleteForMe}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteForMeText}>Delete for me</Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  popupCard: {
    width: '100%',
    maxWidth: 285,
    backgroundColor: '#FFFFFF',
    borderRadius: 20, // smooth roundy shape
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16.5,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  buttonStack: {
    width: '100%',
    gap: 6,
  },
  deleteEveryoneBtn: {
    width: '100%',
    height: 38,
    borderRadius: 19, // roundy pill shape
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteEveryoneText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  deleteForMeBtn: {
    width: '100%',
    height: 38,
    borderRadius: 19, // roundy pill shape
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteForMeText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  cancelBtn: {
    width: '100%',
    height: 34,
    borderRadius: 17,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
});
