// app/(tabs)/profile.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut, updateProfile as firebaseUpdateProfile } from 'firebase/auth';
import { router } from 'expo-router';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../src/services/firebase/FirebaseConfig';
import { updateUserProfile } from '../../src/services/firebase/user/userService';
import { updateParticipantPhotoInChats } from '../../src/services/firebase/chatService';
import {
  saveLocalProfileImage,
  getLocalProfileImage,
  getSyncLocalProfileImage,
} from '../../src/services/storage/localStorageService';
import { EditProfileModal } from '../../components/profile/EditProfileModal';
import { ImageViewerModal } from '../../components/chat/ImageViewerModal';

const Profile = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewImageModalVisible, setViewImageModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(auth.currentUser?.displayName ?? '');
  const [photoURL, setPhotoURL] = useState<string | null>(
    (auth.currentUser?.uid ? getSyncLocalProfileImage(auth.currentUser.uid) : null) ||
      auth.currentUser?.photoURL ||
      null
  );

  // Load cached photo or name from local storage on mount
  React.useEffect(() => {
    const loadCachedProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const localPhoto = await getLocalProfileImage(auth.currentUser.uid);
        if (localPhoto) {
          setPhotoURL(localPhoto);
        } else if (auth.currentUser.photoURL) {
          setPhotoURL(auth.currentUser.photoURL);
        }

        const cachedName = await AsyncStorage.getItem(`@pego_name_${auth.currentUser.uid}`);
        if (cachedName && !auth.currentUser.displayName) {
          setName(cachedName);
        }
      } catch (e) {
        console.warn('Error reading cached profile:', e);
      }
    };
    loadCachedProfile();
  }, []);

  const email = auth.currentUser?.email ?? 'User';

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await signOut(auth);
            router.replace('/(auth)/login');
          } catch (err) {
            console.log('Logout error:', err);
            Alert.alert('Logout Failed', 'Unable to log out. Please try again.');
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleSaveName = async (newName: string) => {
    if (!auth.currentUser) return;

    setSaving(true);
    setError(null);

    try {
      await firebaseUpdateProfile(auth.currentUser, { displayName: newName });
      setName(newName); // update local state so the screen reflects it immediately
      await AsyncStorage.setItem(`@pego_name_${auth.currentUser.uid}`, newName);

      // Attempt syncing to Firestore without throwing if rules are still locked
      try {
        await updateUserProfile(auth.currentUser.uid, { name: newName });
      } catch (fsErr) {
        console.warn('Firestore profile sync postponed:', fsErr);
      }
    } catch (err: any) {
      console.log('Update name error:', err);
      setError('Could not save your name. Please try again.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleSavePhoto = async (imagePayload: string) => {
    if (!auth.currentUser) return;

    setSaving(true);
    setError(null);

    try {
      // 1. Instantly save image to local storage & state so it persists offline
      setPhotoURL(imagePayload);
      await saveLocalProfileImage(auth.currentUser.uid, imagePayload);

      // 2. Also sync to Firebase Auth and Firestore if possible
      try {
        await firebaseUpdateProfile(auth.currentUser, { photoURL: imagePayload });
      } catch (authErr) {
        console.warn('Firebase Auth photoURL update postponed:', authErr);
      }

      try {
        await updateUserProfile(auth.currentUser.uid, { photoURL: imagePayload });
      } catch (fsErr) {
        console.warn('Firestore photo sync postponed:', fsErr);
      }

      // 3. Update participantDetails in all chats the user belongs to
      try {
        await updateParticipantPhotoInChats(auth.currentUser.uid, imagePayload);
      } catch (chatErr) {
        console.warn('Chat participantDetails photo sync postponed:', chatErr);
      }
    } catch (err: any) {
      console.log('Update photo error:', err);
      setError('Could not update your photo. Please try again.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Profile Content */}
        <View style={styles.content}>
          <View style={styles.profileCard}>
            <TouchableOpacity
              onPress={() => {
                if (photoURL) {
                  setViewImageModalVisible(true);
                } else {
                  setModalVisible(true);
                }
              }}
              activeOpacity={0.8}
            >
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {email.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.name}>{name || 'Add your name'}</Text>
            <Text style={styles.email}>{email}</Text>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.logoutText}>Log Out</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <EditProfileModal
        visible={modalVisible}
        currentName={name}
        currentPhotoURL={photoURL}
        saving={saving}
        onClose={() => setModalVisible(false)}
        onSaveName={handleSaveName}
        onSavePhoto={handleSavePhoto}
      />

      {/* Fullscreen Image Viewer */}
      <ImageViewerModal
        visible={viewImageModalVisible}
        imageUri={photoURL}
        title={name || 'Profile Photo'}
        onClose={() => setViewImageModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    height: 65,
    backgroundColor: '#023E7D',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#e6ecf3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#e6ecf3',
    marginBottom: 15,
  },
  avatarText: {
    color: '#023E7D',
    fontSize: 32,
    fontWeight: 'bold',
  },
  name: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  email: {
    color: '#333333',
    fontSize: 15,
  },
  errorText: {
    color: '#D14343',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  editButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#023E7D',
  },
  editButtonText: {
    color: '#023E7D',
    fontSize: 14,
    fontWeight: '700',
  },
  logoutButton: {
    height: 52,
    backgroundColor: '#023E7D',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default Profile;