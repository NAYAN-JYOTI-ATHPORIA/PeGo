// src/services/storage/localStorageService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const AVATAR_KEY_PREFIX = '@pego_local_avatar_';
const CHAT_IMAGE_PREFIX = '@pego_local_chat_img_';

// In-memory cache for synchronous, zero-latency avatar display
const memoryAvatarCache: Record<string, string> = {};

/**
 * Synchronously retrieves a cached profile image (0ms latency, no flicker).
 */
export function getSyncLocalProfileImage(userId: string): string | null {
  if (!userId) return null;
  return memoryAvatarCache[userId] || null;
}

/**
 * Saves a user's profile image locally in memory and AsyncStorage.
 */
export async function saveLocalProfileImage(
  userId: string,
  imageUriOrBase64: string | null | undefined
): Promise<void> {
  if (!userId || !imageUriOrBase64) return;

  memoryAvatarCache[userId] = imageUriOrBase64;
  try {
    await AsyncStorage.setItem(`${AVATAR_KEY_PREFIX}${userId}`, imageUriOrBase64);
  } catch (error) {
    console.warn('Failed to save profile image in local storage:', error);
  }
}

/**
 * Retrieves the locally stored profile image for a user.
 * Checks memory cache first, then AsyncStorage.
 */
export async function getLocalProfileImage(
  userId: string
): Promise<string | null> {
  if (!userId) return null;

  if (memoryAvatarCache[userId]) {
    return memoryAvatarCache[userId];
  }

  try {
    const cached = await AsyncStorage.getItem(`${AVATAR_KEY_PREFIX}${userId}`);
    if (cached) {
      memoryAvatarCache[userId] = cached;
      return cached;
    }
  } catch (error) {
    console.warn('Failed to load profile image from local storage:', error);
  }

  return null;
}

/**
 * Batch-caches avatars for multiple users into memory and AsyncStorage.
 */
export async function batchCacheAvatars(
  users: { uid: string; photoURL?: string | null }[]
): Promise<void> {
  const toStore: [string, string][] = [];

  for (const user of users) {
    if (user.uid && user.photoURL) {
      memoryAvatarCache[user.uid] = user.photoURL;
      toStore.push([`${AVATAR_KEY_PREFIX}${user.uid}`, user.photoURL]);
    }
  }

  if (toStore.length > 0) {
    try {
      await AsyncStorage.multiSet(toStore);
    } catch (err) {
      console.warn('batchCacheAvatars multiSet error:', err);
    }
  }
}

/**
 * Loads all locally cached avatars, messages, and conversations from AsyncStorage into memory on app launch.
 */
export async function initAvatarCache(): Promise<void> {
  return initLocalStorageCache();
}

/**
 * Pre-warms in-memory cache for all avatars, recent chat messages, and conversations.
 */
export async function initLocalStorageCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const avatarKeys = keys.filter((k) => k.startsWith(AVATAR_KEY_PREFIX));
    const msgKeys = keys.filter((k) => k.startsWith(MSGS_KEY_PREFIX));
    const chatKeys = keys.filter((k) => k.startsWith(CHATS_KEY_PREFIX));

    const allKeys = [...avatarKeys, ...msgKeys, ...chatKeys];
    if (allKeys.length === 0) return;

    const pairs = await AsyncStorage.multiGet(allKeys);
    for (const [key, val] of pairs) {
      if (!val) continue;
      if (key.startsWith(AVATAR_KEY_PREFIX)) {
        const uid = key.replace(AVATAR_KEY_PREFIX, '');
        memoryAvatarCache[uid] = val;
      } else if (key.startsWith(MSGS_KEY_PREFIX)) {
        const chatId = key.replace(MSGS_KEY_PREFIX, '');
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            memoryMessagesCache[chatId] = parsed;
          }
        } catch {}
      } else if (key.startsWith(CHATS_KEY_PREFIX)) {
        const userId = key.replace(CHATS_KEY_PREFIX, '');
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            memoryChatsCache[userId] = parsed;
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('initLocalStorageCache error:', err);
  }
}

/**
 * Caches a chat image locally for instant offline viewing.
 */
export async function saveLocalChatImage(
  imageIdOrKey: string,
  imageUriOrBase64: string
): Promise<void> {
  try {
    await AsyncStorage.setItem(`${CHAT_IMAGE_PREFIX}${imageIdOrKey}`, imageUriOrBase64);
  } catch (error) {
    console.warn('Failed to cache chat image in local storage:', error);
  }
}

/**
 * Retrieves a locally cached chat image.
 */
export async function getLocalChatImage(
  imageIdOrKey: string
): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(`${CHAT_IMAGE_PREFIX}${imageIdOrKey}`);
  } catch (error) {
    console.warn('Failed to read chat image from local storage:', error);
    return null;
  }
}

const MSGS_KEY_PREFIX = '@pego_local_msgs_';
const CHATS_KEY_PREFIX = '@pego_local_chats_';

// Synchronous in-memory caches for 0ms instant display
const memoryMessagesCache: Record<string, unknown[]> = {};
const memoryChatsCache: Record<string, unknown[]> = {};

/**
 * Synchronously retrieves cached messages for a chat (0ms latency, zero delay).
 */
export function getSyncChatMessages<T = unknown>(chatId: string): T[] {
  if (!chatId) return [];
  return (memoryMessagesCache[chatId] as T[]) || [];
}

/**
 * Caches messages in memory and AsyncStorage.
 */
export async function cacheChatMessages<T = unknown>(chatId: string, messages: T[]): Promise<void> {
  if (!chatId || !Array.isArray(messages)) return;
  memoryMessagesCache[chatId] = messages;
  try {
    await AsyncStorage.setItem(`${MSGS_KEY_PREFIX}${chatId}`, JSON.stringify(messages));
  } catch (error) {
    console.warn('Failed to cache chat messages locally:', error);
  }
}

/**
 * Loads cached messages from AsyncStorage if not already in memory.
 */
export async function loadCachedChatMessages<T = unknown>(chatId: string): Promise<T[]> {
  if (!chatId) return [];
  if (memoryMessagesCache[chatId] && memoryMessagesCache[chatId].length > 0) {
    return memoryMessagesCache[chatId] as T[];
  }
  try {
    const raw = await AsyncStorage.getItem(`${MSGS_KEY_PREFIX}${chatId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryMessagesCache[chatId] = parsed;
        return parsed as T[];
      }
    }
  } catch (error) {
    console.warn('Failed to load cached chat messages:', error);
  }
  return [];
}

/**
 * Synchronously retrieves cached conversations for a user (0ms latency).
 */
export function getSyncCachedConversations<T = unknown>(userId: string): T[] {
  if (!userId) return [];
  return (memoryChatsCache[userId] as T[]) || [];
}

/**
 * Caches conversations in memory and AsyncStorage.
 */
export async function cacheConversations<T = unknown>(userId: string, chats: T[]): Promise<void> {
  if (!userId || !Array.isArray(chats)) return;
  memoryChatsCache[userId] = chats;
  try {
    await AsyncStorage.setItem(`${CHATS_KEY_PREFIX}${userId}`, JSON.stringify(chats));
  } catch (error) {
    console.warn('Failed to cache conversations locally:', error);
  }
}

/**
 * Loads cached conversations from AsyncStorage.
 */
export async function loadCachedConversations<T = unknown>(userId: string): Promise<T[]> {
  if (!userId) return [];
  if (memoryChatsCache[userId] && memoryChatsCache[userId].length > 0) {
    return memoryChatsCache[userId] as T[];
  }
  try {
    const raw = await AsyncStorage.getItem(`${CHATS_KEY_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryChatsCache[userId] = parsed;
        return parsed as T[];
      }
    }
  } catch (error) {
    console.warn('Failed to load cached conversations:', error);
  }
  return [];
}
