// src/components/profile/EditProfileModal.tsx
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface EditProfileModalProps {
  visible: boolean;
  currentName: string;
  currentPhotoURL: string | null;
  saving: boolean;
  onClose: () => void;
  onSaveName: (name: string) => Promise<unknown>;
  onSavePhoto: (localUri: string) => Promise<unknown>;
}

export function EditProfileModal({
  visible,
  currentName,
  currentPhotoURL,
  saving,
  onClose,
  onSaveName,
  onSavePhoto,
}: EditProfileModalProps) {
  const [name, setName] = useState(currentName);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const imagePayload = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;

      setPreviewUri(imagePayload);

      try {
        await onSavePhoto(imagePayload);
      } catch (err) {
        console.warn('onSavePhoto error:', err);
      }
    }
  };

  const handleSaveName = async () => {
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      Alert.alert('Name required', 'Please enter a name.');
      return;
    }

    try {
      await onSaveName(trimmed);
      onClose();
    } catch {
      // Error already surfaced via the hook's error state.
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Edit Profile</Text>

          <Pressable onPress={handlePickImage} style={styles.avatarWrapper}>
            <Image
              source={{ uri: previewUri ?? currentPhotoURL ?? undefined }}
              style={styles.avatar}
            />
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>Edit</Text>
            </View>
          </Pressable>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
          />

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSaveName}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  avatarWrapper: { alignSelf: 'center', marginBottom: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#E6ECF3' },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#023E7D', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  avatarBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 24 },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelButton: { flex: 1, paddingVertical: 14, alignItems: 'center', marginRight: 8 },
  cancelButtonText: { color: '#666', fontWeight: '600' },
  saveButton: { flex: 1, backgroundColor: '#023E7D', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginLeft: 8 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});