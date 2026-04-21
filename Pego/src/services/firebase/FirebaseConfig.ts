import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-expect-error React Native build uses index.rn which exports getReactNativePersistence
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCOmuPpIakDvMANttoJDxmu2sGXzj2xnKg",
  authDomain: "pego-d5ff6.firebaseapp.com",
  projectId: "pego-d5ff6",
  storageBucket: "pego-d5ff6.firebasestorage.app",
  messagingSenderId: "128776049993",
  appId: "1:128776049993:web:d88e3b543c847adb53b698",
  measurementId: "G-SWQNVS79R4"
};

// 1. Initialize the app safely (prevents duplicate app crashes on hot reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 2. Initialize Auth with persistent storage
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export { app, auth };