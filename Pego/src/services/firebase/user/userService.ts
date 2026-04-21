// src/services/user/userService.ts
import { getDocument, setDocument, listenToDocument } from '../FireStoreservices';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  photoURL: string | null;
  createdAt: number;
}

const COLLECTION = 'users';

/**
 * Fetches a user's profile document once (no live updates).
 * Used sparingly — prefer subscribeToUserProfile for screens that
 * should reflect changes made on other devices in real time.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  return getDocument<UserProfile>(COLLECTION, uid);
}

/**
 * Creates the initial profile document right after signup.
 * (In this architecture this is also mirrored by a Cloud Function
 * — see functions/src/users.ts — as a safety net in case the client
 * call fails or the app is closed before it completes.)
 */
export async function createUserProfile(
  uid: string,
  email: string,
  name?: string,
  photoURL?: string | null
): Promise<void> {
  const fallbackName = name?.trim() || email.split('@')[0] || 'User';
  await setDocument(COLLECTION, uid, {
    uid,
    email,
    name: fallbackName,
    photoURL: photoURL || null,
    createdAt: Date.now(),
  });
}

/**
 * Ensures user document exists in Firestore and updates lastSeen.
 */
export async function ensureUserProfile(
  uid: string,
  email: string,
  name?: string,
  photoURL?: string | null
): Promise<void> {
  const existing = await getUserProfile(uid);
  if (!existing) {
    await createUserProfile(uid, email, name, photoURL);
  } else if (name || photoURL !== undefined) {
    await updateUserProfile(uid, {
      ...(name ? { name } : {}),
      ...(photoURL !== undefined ? { photoURL } : {}),
    });
  }
}

/**
 * Updates name and/or photoURL. Only pass the fields you want changed —
 * setDocument uses merge:true so other fields are left untouched.
 */
export async function updateUserProfile(
  uid: string,
  updates: { name?: string; photoURL?: string | null }
): Promise<void> {
  await setDocument(COLLECTION, uid, updates);
}

/**
 * Subscribes to real-time changes on a user's profile document.
 * Call the returned function to unsubscribe (e.g. in a useEffect cleanup).
 */
export function subscribeToUserProfile(
  uid: string,
  onChange: (profile: UserProfile | null) => void
) {
  return listenToDocument<UserProfile>(COLLECTION, uid, onChange);
}