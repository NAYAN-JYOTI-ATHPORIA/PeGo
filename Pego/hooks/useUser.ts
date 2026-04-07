// src/hooks/useUser.ts
import { useState, useEffect, useCallback } from 'react';
import { auth } from '../src/services/firebase/FirebaseConfig';
import { uploadProfilePhoto } from '../src/services/firebase/Storageservice';
import {
  subscribeToUserProfile,
  updateUserProfile,
  UserProfile,
} from '../src/services/firebase/user/userService';

export function useUser() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;

    if (!uid) {
      setLoading(false);
      return;
    }

    // Real-time listener — if the user updates their profile from
    // another device, this screen updates automatically.
    const unsubscribe = subscribeToUserProfile(uid, (data) => {
      setProfile(data);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const updateName = useCallback(async (name: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('No authenticated user');

    setSaving(true);
    setError(null);

    try {
      await updateUserProfile(uid, { name });
      // No need to manually update local state — the onSnapshot
      // listener above will receive the change and update it for us.
    } catch (err) {
      console.error('Failed to update name:', err);
      setError('Could not save your name. Please try again.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const updatePhoto = useCallback(async (localUri: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('No authenticated user');

    setSaving(true);
    setError(null);

    try {
      const photoURL = await uploadProfilePhoto(localUri, uid);
      await updateUserProfile(uid, { photoURL });
    } catch (err) {
      console.error('Failed to update photo:', err);
      setError('Could not upload your photo. Please try again.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  return { profile, loading, saving, error, updateName, updatePhoto };
}