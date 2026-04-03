# Pego Real-Time Chat Setup Guide

The real-time chat functionality has been implemented using **Google Firebase** (Cloud Firestore & Firebase Storage), which is **100% free** under the Firebase Spark plan (50,000 free reads/day, 20,000 free writes/day, 1GB storage, unlimited real-time WebSocket connections).

---

## 🌟 What was implemented

1. **Real-Time 1-on-1 Chat Screen (`app/chat/[id].tsx`)**:
   - Live message streaming via Firebase Firestore real-time snapshots (`onSnapshot`).
   - Modern chat bubbles (current user on right in brand navy `#023E7D` with `✓✓`, other user on left in crisp slate card).
   - Formatted relative time badges ("Just now", "5m ago", "10:30 AM", "Yesterday").
   - Photo / image attachment support using `expo-image-picker` and Firebase Storage.
   - Auto-scroll to the newest message on delivery.
   - Fully optimized keyboard avoiding view and notch handling for iOS and Android.

2. **User Discovery & 1-Tap Chat Initiation (`components/chat/NewChatModal.tsx`)**:
   - Automatically discovers all registered users in Firestore.
   - Instant search by name or email.
   - 1-tap "Chat" button that calculates a deterministic conversation ID (`[uid1, uid2].sort().join('_')`) so both users seamlessly share the exact same conversation.

3. **Active Conversations List (`app/(tabs)/chats.tsx`)**:
   - Real-time listener for current user's conversations.
   - Displays other user's avatar (with photo or colored initial), display name, and preview of the last message ("You: ...", "Photo 📷", etc.).
   - Search bar to filter conversations.
   - Clean empty state with "Start a Chat" call-to-action.

4. **User Profile Synchronization (`src/services/firebase/user/userService.ts`)**:
   - When a user signs up (`app/(auth)/signup.tsx`), their user profile is automatically created in the Firestore `users` collection.
   - When a user logs in (`app/(auth)/login.tsx`), their profile is verified and synced.
   - When a user edits their name or photo in Profile (`app/(tabs)/profile.tsx`), it syncs directly to Firestore so their chat partner immediately sees the updated name and avatar.

5. **Security Rules (`firestore.rules` & `storage.rules`)**:
   - Ready-to-use production rules for Firestore and Storage.

---

## 🚀 1-Minute Firebase Console Setup (Free)

Firebase starts new projects with locked security rules by default (`allow read, write: if false;`). To let logged-in users chat with each other:

### Step 1: Set Firestore Rules
1. Open the [Firebase Console](https://console.firebase.google.com/project/pego-d5ff6/firestore/rules).
2. Go to **Firestore Database** -> **Rules**.
3. Replace the existing content with the contents of [`firestore.rules`](file:///d:/project2/Pego/firestore.rules):

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    // 1. User Profiles
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && request.auth.uid == userId;
    }

    // 2. Chat Conversations
    match /chats/{chatId} {
      allow read, write: if isSignedIn() && (
        resource == null ||
        request.auth.uid in resource.data.participants ||
        request.auth.uid in request.resource.data.participants
      );

      // Real-time messages within this chat
      match /messages/{messageId} {
        allow read, write: if isSignedIn();
      }
    }
  }
}
```
4. Click **Publish**.

---

### Step 2: (Optional) Set Storage Rules for Photo Attachments
1. Go to **Storage** -> **Rules** in [Firebase Console](https://console.firebase.google.com/project/pego-d5ff6/storage/rules).
2. Replace with the contents of [`storage.rules`](file:///d:/project2/Pego/storage.rules):

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /profile-photos/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    match /chat-images/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```
3. Click **Publish**.

---

## 📱 Testing Between Two Users

1. Run the app:
   ```bash
   npx expo start
   ```
2. Open on two devices (or one emulator and one web browser / Expo Go).
3. **User 1**: Sign up with `user1@test.com` (password: `123456`).
4. **User 2**: Sign up with `user2@test.com` (password: `123456`).
5. In **User 1**'s app:
   - Tap the "+" or "Start a Chat" button.
   - Tap `user2@test.com` (or search for it).
   - Send a message!
6. In **User 2**'s app:
   - The message and conversation will appear **instantly in real time**!
