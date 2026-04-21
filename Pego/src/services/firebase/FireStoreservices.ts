// src/services/firebase/firestoreService.ts
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  DocumentData,
  Unsubscribe,
} from 'firebase/firestore';
import { app } from './FirebaseConfig';

export const db = getFirestore(app);

/**
 * Generic single-document fetch. Domain services (userService,
 * chatService, etc.) build on top of this instead of every file
 * importing raw Firestore functions directly.
 */
export async function getDocument<T = DocumentData>(
  collectionName: string,
  docId: string
): Promise<T | null> {
  const snapshot = await getDoc(doc(db, collectionName, docId));
  return snapshot.exists() ? (snapshot.data() as T) : null;
}

/**
 * Generic document write. `merge: true` means it only updates the
 * fields you pass in — it won't wipe out fields you don't mention.
 */
export async function setDocument(
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>
): Promise<void> {
  await setDoc(doc(db, collectionName, docId), data, { merge: true });
}

/**
 * Generic real-time listener for a single document.
 * Returns an unsubscribe function — call it in a useEffect cleanup.
 */
export function listenToDocument<T = DocumentData>(
  collectionName: string,
  docId: string,
  onChange: (data: T | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, collectionName, docId), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data() as T) : null);
  });
}