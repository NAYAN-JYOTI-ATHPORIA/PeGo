// src/services/firebase/authService.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth } from './FirebaseConfig';

/**
 * Signs up a new user with email and password.
 * Optionally sets a display name right after account creation.
 */
export async function signUp(
  email: string,
  password: string,
  displayName?: string
): Promise<User> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }

    return userCredential.user;
  } catch (error) {
    throw mapFirebaseAuthError(error);
  }
}

/**
 * Signs in an existing user with email and password.
 */
export async function signIn(email: string, password: string): Promise<User> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw mapFirebaseAuthError(error);
  }
}

/**
 * Signs the current user out.
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    throw mapFirebaseAuthError(error);
  }
}

/**
 * Sends a password reset email to the given address.
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw mapFirebaseAuthError(error);
  }
}

/**
 * Returns the currently signed-in user, or null if none.
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Converts Firebase's cryptic error codes into readable messages.
 * Extend this list as you run into more codes during testing.
 */
function mapFirebaseAuthError(error: unknown): Error {
  const code = (error as { code?: string })?.code ?? '';

  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'That email is already registered. Try logging in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
  };

  return new Error(messages[code] ?? 'Something went wrong. Please try again.');
}