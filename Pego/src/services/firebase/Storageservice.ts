// src/services/firebase/storageService.ts
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from './FirebaseConfig';

const storage = getStorage(app);

/**
 * Converts a local file URI into a Blob in React Native.
 */
function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function () {
      reject(new Error('Failed to convert local image to blob'));
    };
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/**
 * Uploads a local image (from expo-image-picker) to Firebase Storage
 * under profile-photos/{uid}.jpg, and returns the public download URL.
 */
export async function uploadProfilePhoto(
  localUri: string,
  uid: string
): Promise<string> {
  const blob = await uriToBlob(localUri);
  const storageRef = ref(storage, `profile-photos/${uid}.jpg`);

  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}