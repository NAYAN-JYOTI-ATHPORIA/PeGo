// app/_layout.tsx
import { ComponentType, PropsWithChildren, useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { View, ActivityIndicator } from 'react-native';
import { auth } from '../src/services/firebase/FirebaseConfig';
import { AuthProvider } from '../src/context/AuthContext';
import { ensureUserProfile } from '../src/services/firebase/user/userService';
import { initAvatarCache } from '../src/services/storage/localStorageService';

/**
 * Watches Firebase auth state and redirects the user to the correct
 * screen group based on whether they're logged in and where they
 * currently are in the app.
 */
function useProtectedRoute(user: User | null, initializing: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Not logged in and trying to access a protected route
      router.replace('/(auth)/signup');
    } else if (user && inAuthGroup) {
      // Logged in but sitting on an auth screen
      router.replace('/(tabs)/chats');
    }
  }, [user, initializing, segments]);
}

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

function RootLayoutNav() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Load all cached user avatars from local storage for instant zero-latency display
    initAvatarCache().catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (initializing) setInitializing(false);

      if (firebaseUser) {
        ensureUserProfile(
          firebaseUser.uid,
          firebaseUser.email || '',
          firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          firebaseUser.photoURL
        ).catch((err) => console.warn('ensureUserProfile in RootLayout error:', err));
      }
    });

    return unsubscribe;
  }, []);

  useProtectedRoute(user, initializing);

  if (initializing) {
    return <LoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="call/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  const Provider = AuthProvider as unknown as ComponentType<
    PropsWithChildren<{}>
  >;

  return (
    <Provider>
      <RootLayoutNav />
    </Provider>
  );
}
