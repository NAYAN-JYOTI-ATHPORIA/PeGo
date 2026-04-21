// components/chat/NewChatModal.tsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../src/services/firebase/FirebaseConfig';
import {
  subscribeToAllUsers,
  createOrGetChat,
  getChatId,
  ChatParticipant,
} from '../../src/services/firebase/chatService';
import { UserProfile } from '../../src/services/firebase/user/userService';
import {
  getSyncLocalProfileImage,
  batchCacheAvatars,
} from '../../src/services/storage/localStorageService';

const CACHED_USERS_KEY = '@pego_cached_users';

interface NewChatModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NewChatModal({ visible, onClose }: NewChatModalProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);

  const currentUser = auth.currentUser;

  // Load cached users on open
  useEffect(() => {
    if (!visible) return;

    AsyncStorage.getItem(CACHED_USERS_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setUsers(parsed);
              batchCacheAvatars(parsed).catch(() => {});
            }
          } catch (e) {
            console.warn('Error parsing cached users:', e);
          }
        }
      })
      .catch(() => {});
  }, [visible]);

  // Subscribe to real-time users
  const loadUsers = useCallback(() => {
    if (!currentUser) return () => {};

    setLoading(true);
    setPermissionError(false);

    return subscribeToAllUsers(currentUser.uid, (fetchedUsers, error) => {
      setLoading(false);
      if (error) {
        console.warn('User discovery error:', error.message);
        setPermissionError(true);
        return;
      }

      setPermissionError(false);
      if (fetchedUsers.length > 0) {
        setUsers(fetchedUsers);
        AsyncStorage.setItem(CACHED_USERS_KEY, JSON.stringify(fetchedUsers)).catch(() => {});
        batchCacheAvatars(fetchedUsers).catch(() => {});
      }
    });
  }, [currentUser]);

  useEffect(() => {
    if (!visible || !currentUser) return;
    const unsubscribe = loadUsers();
    return () => {
      unsubscribe();
    };
  }, [visible, currentUser, loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleStartChatWithUser = (targetUser: UserProfile) => {
    if (!currentUser) return;

    const currentParticipant: ChatParticipant = {
      uid: currentUser.uid,
      name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
      email: currentUser.email || '',
      photoURL: currentUser.photoURL || null,
    };

    const targetPhoto =
      targetUser.photoURL ||
      getSyncLocalProfileImage(targetUser.uid) ||
      null;

    const otherParticipant: ChatParticipant = {
      uid: targetUser.uid,
      name: targetUser.name || targetUser.email.split('@')[0],
      email: targetUser.email,
      photoURL: targetPhoto,
    };

    // Calculate deterministic chatId instantly (0ms)
    const chatId = getChatId(currentUser.uid, targetUser.uid);

    // Immediately close modal and navigate with zero delay
    onClose();
    setSearch('');

    router.push({
      pathname: '/chat/[id]',
      params: {
        id: chatId,
        otherUserId: otherParticipant.uid,
        otherUserName: otherParticipant.name,
        otherUserEmail: otherParticipant.email,
        otherUserPhoto: otherParticipant.photoURL || '',
      },
    });

    // Ensure conversation exists in Firestore in background (non-blocking)
    createOrGetChat(currentParticipant, otherParticipant).catch(() => {});
  };

  // Direct chat if typing an email or username
  const handleDirectChat = () => {
    const target = search.trim();
    if (!target || !currentUser) return;

    // Check if target is already in the list
    const found = users.find(
      (u) =>
        u.email.toLowerCase() === target.toLowerCase() ||
        u.name.toLowerCase() === target.toLowerCase()
    );

    if (found) {
      return handleStartChatWithUser(found);
    }

    const currentParticipant: ChatParticipant = {
      uid: currentUser.uid,
      name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
      email: currentUser.email || '',
      photoURL: currentUser.photoURL || null,
    };

    // Create fallback other participant
    const otherUid = target.replace(/[^a-zA-Z0-9]/g, '_');
    const cachedPhoto = getSyncLocalProfileImage(otherUid) || null;
    const otherParticipant: ChatParticipant = {
      uid: otherUid,
      name: target.split('@')[0],
      email: target.includes('@') ? target : `${target}@pego.app`,
      photoURL: cachedPhoto,
    };

    // Calculate deterministic chatId instantly (0ms)
    const chatId = getChatId(currentUser.uid, otherUid);

    // Immediately close modal and navigate with zero delay
    onClose();
    setSearch('');

    router.push({
      pathname: '/chat/[id]',
      params: {
        id: chatId,
        otherUserId: otherParticipant.uid,
        otherUserName: otherParticipant.name,
        otherUserEmail: otherParticipant.email,
        otherUserPhoto: otherParticipant.photoURL || '',
      },
    });

    // Ensure conversation exists in Firestore in background (non-blocking)
    createOrGetChat(currentParticipant, otherParticipant).catch(() => {});
  };

  const renderUserItem = ({ item }: { item: UserProfile }) => {
    const initial = (item.name || item.email || 'U').charAt(0).toUpperCase();
    const photo = item.photoURL || getSyncLocalProfileImage(item.uid);

    return (
      <TouchableOpacity
        style={styles.userItem}
        activeOpacity={0.7}
        onPress={() => handleStartChatWithUser(item)}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        )}

        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.name || 'User'}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {item.email}
          </Text>
        </View>

        <View style={styles.chatAction}>
          <View style={styles.chatBadge}>
            <Ionicons name="chatbubble-ellipses" size={16} color="#FFFFFF" />
            <Text style={styles.chatBadgeText}>Chat</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>New Conversation</Text>
              <Text style={styles.headerSubtitle}>
                Select a user or search by email/name
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search or enter email to chat..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleDirectChat}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Direct Chat Card when typing */}
          {search.trim().length > 0 && (
            <TouchableOpacity
              style={styles.directChatCard}
              activeOpacity={0.8}
              onPress={handleDirectChat}
            >
              <View style={styles.directChatIcon}>
                <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.directChatContent}>
                <Text style={styles.directChatTitle}>Start Chat with</Text>
                <Text style={styles.directChatEmail} numberOfLines={1}>
                  {search.trim()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#023E7D" />
            </TouchableOpacity>
          )}

          {/* Permission / Rules guidance banner if Firestore rules locked */}
          {permissionError && (
            <View style={styles.warningBanner}>
              <Ionicons name="lock-closed" size={18} color="#D97706" style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.warningTitle}>Firestore Rules Need Publishing</Text>
                <Text style={styles.warningText}>
                  Your Firebase rules currently restrict listing all users. Publish <Text style={{ fontWeight: '700' }}>firestore.rules</Text> in Firebase Console, or type your friend&apos;s email above to chat directly!
                </Text>
              </View>
            </View>
          )}

          {/* Users List */}
          {loading && users.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#023E7D" />
              <Text style={styles.loadingText}>Finding registered users...</Text>
            </View>
          ) : filteredUsers.length > 0 ? (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.uid}
              renderItem={renderUserItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                {search ? 'No users match your search' : 'No other users found yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? "Tap 'Start Chat with' above to begin a conversation with this email immediately!"
                  : "Invite a friend to register or enter their email above to chat!"}
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '60%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#0F172A',
  },
  directChatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    marginBottom: 12,
  },
  directChatIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#023E7D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  directChatContent: {
    flex: 1,
  },
  directChatTitle: {
    fontSize: 12,
    color: '#023E7D',
    fontWeight: '600',
  },
  directChatEmail: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '700',
    marginTop: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  warningText: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    borderRadius: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E6ECF3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#023E7D',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  userEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  chatAction: {
    marginLeft: 10,
  },
  chatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#023E7D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  chatBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
