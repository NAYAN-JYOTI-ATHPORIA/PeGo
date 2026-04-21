// src/services/firebase/chatService.ts
import {
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  limit,
  limitToLast,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from './FireStoreservices';
import { app } from './FirebaseConfig';
import { UserProfile } from './user/userService';

const storage = getStorage(app);

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string | null;
  text: string;
  imageUrl?: string | null;
  createdAt: number;
  seen?: boolean;
  seenAt?: number;
  deletedFor?: string[];
}

export interface ChatParticipant {
  uid: string;
  name: string;
  email: string;
  photoURL?: string | null;
}

export interface ChatConversation {
  id: string;
  participants: string[];
  participantDetails: Record<string, ChatParticipant>;
  lastMessage?: {
    text: string;
    senderId: string;
    senderName?: string;
    createdAt: number;
  } | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Computes deterministic ID for 1-on-1 chats:
 * e.g. "uidA_uidB" sorted alphabetically so both users map to the identical document.
 */
export function getChatId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

/**
 * Creates or retrieves a 1-on-1 chat conversation between two users.
 */
export async function createOrGetChat(
  currentUser: ChatParticipant,
  otherUser: ChatParticipant
): Promise<string> {
  const chatId = getChatId(currentUser.uid, otherUser.uid);
  const chatRef = doc(db, 'chats', chatId);

  const existing = await getDoc(chatRef);
  if (!existing.exists()) {
    const now = Date.now();
    await setDoc(chatRef, {
      id: chatId,
      participants: [currentUser.uid, otherUser.uid],
      participantDetails: {
        [currentUser.uid]: {
          uid: currentUser.uid,
          name: currentUser.name || currentUser.email.split('@')[0],
          email: currentUser.email,
          photoURL: currentUser.photoURL || null,
        },
        [otherUser.uid]: {
          uid: otherUser.uid,
          name: otherUser.name || otherUser.email.split('@')[0],
          email: otherUser.email,
          photoURL: otherUser.photoURL || null,
        },
      },
      lastMessage: null,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    // Keep participant profiles fresh
    await setDoc(
      chatRef,
      {
        participantDetails: {
          [currentUser.uid]: {
            uid: currentUser.uid,
            name: currentUser.name || currentUser.email.split('@')[0],
            email: currentUser.email,
            photoURL: currentUser.photoURL || null,
          },
          [otherUser.uid]: {
            uid: otherUser.uid,
            name: otherUser.name || otherUser.email.split('@')[0],
            email: otherUser.email,
            photoURL: otherUser.photoURL || null,
          },
        },
      },
      { merge: true }
    );
  }

  return chatId;
}

/**
 * Updates a participant's photo across their existing chats so other users see it immediately.
 */
export async function updateParticipantPhotoInChats(
  userId: string,
  photoURL: string
): Promise<void> {
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', userId));
    const snap = await getDocs(q);

    const updates: Promise<void>[] = [];
    snap.forEach((chatDoc) => {
      updates.push(
        setDoc(
          chatDoc.ref,
          {
            participantDetails: {
              [userId]: {
                photoURL,
              },
            },
          },
          { merge: true }
        )
      );
    });

    await Promise.allSettled(updates);
  } catch (err) {
    console.warn('updateParticipantPhotoInChats error:', err);
  }
}

/**
 * Sends a message in a chat and updates conversation preview.
 */
export async function sendMessage(params: {
  chatId: string;
  sender: ChatParticipant;
  text: string;
  imageUrl?: string | null;
}): Promise<string> {
  const { chatId, sender, text, imageUrl } = params;
  const now = Date.now();

  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const docRef = await addDoc(messagesRef, {
    chatId,
    senderId: sender.uid,
    senderName: sender.name || sender.email.split('@')[0],
    senderPhoto: sender.photoURL || null,
    text: text.trim(),
    imageUrl: imageUrl || null,
    createdAt: now,
    seen: false,
  });

  // Update conversation lastMessage & updatedAt
  const previewText = text.trim() || (imageUrl ? '📷 Photo' : '');
  const chatRef = doc(db, 'chats', chatId);
  await setDoc(
    chatRef,
    {
      lastMessage: {
        text: previewText,
        senderId: sender.uid,
        senderName: sender.name || sender.email.split('@')[0],
        createdAt: now,
      },
      updatedAt: now,
    },
    { merge: true }
  );

  return docRef.id;
}

/**
 * Marks a message as seen in Firestore.
 */
export async function markMessageSeen(
  chatId: string,
  messageId: string
): Promise<void> {
  try {
    const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
    await setDoc(msgRef, { seen: true, seenAt: Date.now() }, { merge: true });
  } catch (err) {
    console.warn('markMessageSeen error:', err);
  }
}

/**
 * Deletes a message for everyone in the chat (permanently removes from Firestore).
 */
export async function deleteMessageForEveryone(
  chatId: string,
  messageId: string
): Promise<void> {
  const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
  await deleteDoc(msgRef);

  // Recalculate conversation lastMessage
  await refreshLastMessageAfterDeletion(chatId);
}

/**
 * Deletes a message for the current user only (marks deletedFor array).
 */
export async function deleteMessageForMe(
  chatId: string,
  messageId: string,
  userId: string
): Promise<void> {
  const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
  await updateDoc(msgRef, {
    deletedFor: arrayUnion(userId),
  });

  // Recalculate conversation lastMessage if needed
  await refreshLastMessageAfterDeletion(chatId);
}

// Backward-compatibility alias
export const deleteMessage = deleteMessageForEveryone;

/**
 * Recalculates and updates the conversation's lastMessage preview after message deletion.
 */
async function refreshLastMessageAfterDeletion(chatId: string): Promise<void> {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(1));
    const snap = await getDocs(q);

    const chatRef = doc(db, 'chats', chatId);
    if (!snap.empty) {
      const latestData = snap.docs[0].data();
      const previewText =
        latestData.text || (latestData.imageUrl ? '📷 Photo' : '');
      await setDoc(
        chatRef,
        {
          lastMessage: {
            text: previewText,
            senderId: latestData.senderId,
            senderName: latestData.senderName || '',
            createdAt: latestData.createdAt || Date.now(),
          },
          updatedAt: latestData.createdAt || Date.now(),
        },
        { merge: true }
      );
    } else {
      await setDoc(
        chatRef,
        {
          lastMessage: null,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn('Error refreshing lastMessage after deletion:', err);
  }
}

/**
 * Deletes a chat conversation document.
 */
export async function deleteChat(chatId: string): Promise<void> {
  const chatRef = doc(db, 'chats', chatId);
  await deleteDoc(chatRef);
}

/**
 * Listens to real-time messages in a given chat conversation.
 */
export function subscribeToMessages(
  chatId: string,
  onUpdate: (messages: ChatMessage[]) => void
): Unsubscribe {
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'), limitToLast(40));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        messages.push({
          id: docSnap.id,
          chatId: data.chatId || chatId,
          senderId: data.senderId,
          senderName: data.senderName || '',
          senderPhoto: data.senderPhoto || null,
          text: data.text || '',
          imageUrl: data.imageUrl || null,
          createdAt: data.createdAt || 0,
          seen: Boolean(data.seen),
          seenAt: data.seenAt || undefined,
          deletedFor: Array.isArray(data.deletedFor) ? data.deletedFor : [],
        });
      });
      onUpdate(messages);
    },
    (error) => {
      console.warn('subscribeToMessages error:', error);
      onUpdate([]);
    }
  );
}

/**
 * Listens to real-time conversation list for the current user.
 * Uses `participants array-contains userId` which only needs default Firestore indexing.
 */
export function subscribeToUserChats(
  userId: string,
  onUpdate: (chats: ChatConversation[]) => void
): Unsubscribe {
  const chatsRef = collection(db, 'chats');
  const q = query(chatsRef, where('participants', 'array-contains', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ChatConversation[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          participants: data.participants || [],
          participantDetails: data.participantDetails || {},
          lastMessage: data.lastMessage || null,
          createdAt: data.createdAt || 0,
          updatedAt: data.updatedAt || data.createdAt || 0,
        });
      });

      // Sort newest active chat first in memory
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      onUpdate(list);
    },
    (error) => {
      console.warn('subscribeToUserChats error:', error);
      onUpdate([]);
    }
  );
}

/**
 * Subscribes to all registered users in Firestore to discover people to chat with.
 */
export function subscribeToAllUsers(
  currentUserId: string,
  onUpdate: (users: UserProfile[], error?: Error | null) => void
): Unsubscribe {
  const usersRef = collection(db, 'users');

  return onSnapshot(
    usersRef,
    (snapshot) => {
      const users: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as UserProfile;
        if (data.uid !== currentUserId) {
          users.push({
            uid: data.uid || docSnap.id,
            email: data.email || '',
            name: data.name || data.email?.split('@')[0] || 'User',
            photoURL: data.photoURL || null,
            createdAt: data.createdAt || 0,
          });
        }
      });
      onUpdate(users, null);
    },
    (error) => {
      console.warn('subscribeToAllUsers error:', error);
      onUpdate([], error);
    }
  );
}

function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function () {
      reject(new Error('Failed to convert image to blob'));
    };
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/**
 * Uploads an image to Firebase Storage for chat attachments.
 * If Firebase Storage is not enabled yet, falls back gracefully.
 */
export async function uploadChatImage(
  localUri: string,
  chatId: string
): Promise<string> {
  try {
    const blob = await uriToBlob(localUri);
    const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const storageRef = ref(storage, `chat-images/${chatId}/${filename}`);

    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.warn('Firebase Storage upload failed, falling back to direct URI:', err);
    return localUri;
  }
}

/**
 * Helper to format timestamps for chat screens.
 */
export function formatChatTime(timestamp: number): string {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return 'Yesterday';

  if (diffMs < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
