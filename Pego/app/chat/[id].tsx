import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { auth } from '../../src/services/firebase/FirebaseConfig';
import {
  subscribeToMessages,
  sendMessage,
  markMessageSeen,
  deleteMessageForEveryone,
  deleteMessageForMe,
  ChatMessage,
  ChatParticipant,
  formatChatTime,
} from '../../src/services/firebase/chatService';
import {
  saveLocalChatImage,
  getSyncLocalProfileImage,
  getLocalProfileImage,
  saveLocalProfileImage,
  getSyncChatMessages,
  cacheChatMessages,
  loadCachedChatMessages,
} from '../../src/services/storage/localStorageService';
import { subscribeToUserProfile } from '../../src/services/firebase/user/userService';
import { ImageViewerModal } from '../../components/chat/ImageViewerModal';
import { DeleteMessageModal } from '../../components/chat/DeleteMessageModal';

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    otherUserId?: string;
    otherUserName?: string;
    otherUserEmail?: string;
    otherUserPhoto?: string;
  }>();

  const chatId = params.id;
  const otherUserId = params.otherUserId || '';
  const otherUserName = params.otherUserName || 'Chat';
  const otherUserEmail = params.otherUserEmail || '';

  const initialPhoto =
    (otherUserId ? getSyncLocalProfileImage(otherUserId) : null) ||
    params.otherUserPhoto ||
    null;
  const [otherUserPhoto, setOtherUserPhoto] = useState<string | null>(initialPhoto);

  const initialMessages = chatId ? getSyncChatMessages<ChatMessage>(chatId) : [];
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(initialMessages.length === 0);
  const [sending, setSending] = useState(false);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [viewingImageMessageId, setViewingImageMessageId] = useState<string | null>(null);
  const [selectedMessageForDelete, setSelectedMessageForDelete] = useState<ChatMessage | null>(null);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const markedSeenRef = useRef<Set<string>>(new Set());
  const currentUser = auth.currentUser;

  // Filter out messages that the current user deleted for themselves
  const visibleMessages = useMemo(() => {
    if (!currentUser) return messages;
    return messages.filter(
      (msg) => !msg.deletedFor || !msg.deletedFor.includes(currentUser.uid)
    );
  }, [messages, currentUser]);

  // Load cached photo from local storage and listen for real-time photo updates
  useEffect(() => {
    if (!otherUserId) return;

    // Check persistent AsyncStorage if memory cache didn't have it yet
    getLocalProfileImage(otherUserId).then((cached) => {
      if (cached) {
        setOtherUserPhoto(cached);
      }
    });

    const unsubscribe = subscribeToUserProfile(otherUserId, (profile) => {
      if (profile?.photoURL) {
        setOtherUserPhoto(profile.photoURL);
        saveLocalProfileImage(otherUserId, profile.photoURL).catch(() => {});
      }
    });

    return () => {
      unsubscribe();
    };
  }, [otherUserId]);

  // Real-time listener for messages in this conversation with instant cache fallback
  useEffect(() => {
    if (!chatId) return;

    // Check memory cache first, or load from persistent storage
    const syncMem = getSyncChatMessages<ChatMessage>(chatId);
    if (syncMem && syncMem.length > 0) {
      setMessages(syncMem);
      setLoadingMessages(false);
    } else {
      loadCachedChatMessages<ChatMessage>(chatId).then((cached) => {
        if (cached && cached.length > 0) {
          setMessages(cached);
          setLoadingMessages(false);
        }
      });
    }

    const unsubscribe = subscribeToMessages(chatId, (newMessages) => {
      setMessages(newMessages);
      setLoadingMessages(false);
      cacheChatMessages(chatId, newMessages).catch(() => {});
    });

    return () => {
      unsubscribe();
    };
  }, [chatId]);

  // Mark incoming unread messages as seen in background without network thrashing
  useEffect(() => {
    if (!messages.length || !currentUser || !chatId) return;

    const unread = messages.filter(
      (msg) =>
        msg.senderId !== currentUser.uid &&
        !msg.seen &&
        !markedSeenRef.current.has(msg.id)
    );

    if (unread.length === 0) return;

    unread.forEach((msg) => markedSeenRef.current.add(msg.id));

    const timer = setTimeout(() => {
      unread.forEach((msg) => {
        markMessageSeen(chatId, msg.id).catch(() => {});
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [messages, currentUser, chatId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (visibleMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 50);
    }
  }, [visibleMessages.length]);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission Needed',
        'Please allow access to your photos to send image attachments.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.4,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const imagePayload = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;
      setSelectedImageUri(imagePayload);
    }
  };

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if ((!trimmed && !selectedImageUri) || sending || !currentUser || !chatId) {
      return;
    }

    try {
      setSending(true);

      let uploadedImageUrl: string | null = null;
      if (selectedImageUri) {
        uploadedImageUrl = selectedImageUri;
        // Cache image in local storage for instant offline viewing
        saveLocalChatImage(`${chatId}_${Date.now()}`, selectedImageUri).catch(() => {});
      }

      const sender: ChatParticipant = {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        email: currentUser.email || '',
        photoURL: currentUser.photoURL || null,
      };

      const textToSend = trimmed;
      setInputText('');
      setSelectedImageUri(null);

      await sendMessage({
        chatId,
        sender,
        text: textToSend,
        imageUrl: uploadedImageUrl,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Send Error', 'Unable to send message. Please check your connection.');
    } finally {
      setSending(false);
    }
  };

  const otherInitial = useMemo(() => {
    return (otherUserName || otherUserEmail || 'U').charAt(0).toUpperCase();
  }, [otherUserName, otherUserEmail]);

  const handleMessageLongPress = useCallback((item: ChatMessage) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {}
    setSelectedMessageForDelete(item);
  }, []);

  const handleDeleteForEveryone = async () => {
    if (!selectedMessageForDelete) return;
    const targetId = selectedMessageForDelete.id;
    setSelectedMessageForDelete(null);
    try {
      await deleteMessageForEveryone(chatId, targetId);
    } catch (error) {
      console.error('Delete message error:', error);
      Alert.alert(
        'Error',
        'Unable to delete message. Please check your connection.'
      );
    }
  };

  const handleDeleteForMe = async () => {
    if (!selectedMessageForDelete || !currentUser) return;
    const targetId = selectedMessageForDelete.id;
    setSelectedMessageForDelete(null);

    // Instant local removal
    setMessages((prev) => prev.filter((m) => m.id !== targetId));

    try {
      await deleteMessageForMe(chatId, targetId, currentUser.uid);
    } catch (error) {
      console.error('Delete for me error:', error);
    }
  };

  const renderMessageItem = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isMe = item.senderId === currentUser?.uid;

      return (
        <View
          style={[
            styles.messageRow,
            isMe ? styles.myMessageRow : styles.otherMessageRow,
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.88}
            onLongPress={() => handleMessageLongPress(item)}
            delayLongPress={220}
            style={[
              styles.bubble,
              isMe ? styles.myBubble : styles.otherBubble,
            ]}
          >
            {item.imageUrl ? (
              <TouchableOpacity
                onPress={() => {
                  setViewingImageUrl(item.imageUrl || null);
                  setViewingImageMessageId(item.id);
                }}
                onLongPress={() => handleMessageLongPress(item)}
                delayLongPress={220}
                activeOpacity={0.88}
                style={styles.imageContainer}
              >
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.attachedImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : null}

            {item.text ? (
              <Text
                style={[
                  styles.messageText,
                  isMe ? styles.myMessageText : styles.otherMessageText,
                ]}
              >
                {item.text}
              </Text>
            ) : null}

            <View
              style={[
                styles.metaRow,
                isMe ? styles.myMetaRow : styles.otherMetaRow,
              ]}
            >
              <Text
                style={[
                  styles.timeText,
                  isMe ? styles.myTimeText : styles.otherTimeText,
                ]}
              >
                {formatChatTime(item.createdAt)}
              </Text>

              {isMe && (
                <View
                  style={[
                    styles.statusBar,
                    item.seen ? styles.statusBarSeen : styles.statusBarDelivered,
                  ]}
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      );
    },
    [currentUser?.uid, handleMessageLongPress]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerUser}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => {
              if (otherUserPhoto) setViewingImageUrl(otherUserPhoto);
            }}
            activeOpacity={otherUserPhoto ? 0.8 : 1}
          >
            {otherUserPhoto ? (
              <Image source={{ uri: otherUserPhoto }} style={styles.headerAvatarImage} />
            ) : (
              <View style={styles.headerAvatar}>
                <Text style={styles.headerAvatarText}>{otherInitial}</Text>
              </View>
            )}
            <View style={styles.onlineBadge} />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>
              {otherUserName}
            </Text>
            <Text style={styles.headerStatus} numberOfLines={1}>
              {loadingMessages ? 'Connecting...' : (otherUserEmail || 'Active now')}
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {/* Messages List - Rendered instantly without full-page blocking */}
        {visibleMessages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyAvatar}>
              <Text style={styles.emptyAvatarText}>{otherInitial}</Text>
            </View>
            <Text style={styles.emptyTitle}>
              Say hello to {otherUserName}! 👋
            </Text>
            <Text style={styles.emptySubtitle}>
              {loadingMessages
                ? 'Connecting to conversation...'
                : 'This is the beginning of your conversation. Messages are synced in real time.'}
            </Text>
            {loadingMessages && (
              <ActivityIndicator size="small" color="#023E7D" style={{ marginTop: 12 }} />
            )}
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={visibleMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Selected image preview */}
        {selectedImageUri && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={() => setSelectedImageUri(null)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Bar */}
        <SafeAreaView edges={['bottom']} style={styles.inputSafeArea}>
          <View style={styles.inputBar}>
            <TouchableOpacity
              onPress={handlePickImage}
              style={styles.attachButton}
              activeOpacity={0.7}
            >
              <Ionicons name="image-outline" size={24} color="#023E7D" />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor="#94A3B8"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />

            <TouchableOpacity
              onPress={handleSend}
              disabled={(!inputText.trim() && !selectedImageUri) || sending}
              style={[
                styles.sendButton,
                (!inputText.trim() && !selectedImageUri) && styles.sendButtonDisabled,
              ]}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* Fullscreen Image Viewer Modal */}
      <ImageViewerModal
        visible={!!viewingImageUrl}
        imageUri={viewingImageUrl}
        title={otherUserName}
        onClose={() => {
          setViewingImageUrl(null);
          setViewingImageMessageId(null);
        }}
        onDelete={
          viewingImageMessageId
            ? () => {
                const targetMsg = messages.find((m) => m.id === viewingImageMessageId);
                if (targetMsg) {
                  setViewingImageUrl(null);
                  setViewingImageMessageId(null);
                  setSelectedMessageForDelete(targetMsg);
                }
              }
            : undefined
        }
      />

      {/* Custom Popup for Delete for Me and Delete for Everyone */}
      <DeleteMessageModal
        visible={!!selectedMessageForDelete}
        message={selectedMessageForDelete}
        isMyMessage={selectedMessageForDelete?.senderId === currentUser?.uid}
        onClose={() => setSelectedMessageForDelete(null)}
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  backButton: {
    padding: 6,
    marginRight: 6,
    borderRadius: 20,
  },
  headerUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  headerAvatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#023E7D',
  },
  onlineBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerStatus: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 3,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: '#023E7D',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#0F172A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  myMetaRow: {
    justifyContent: 'flex-end',
  },
  otherMetaRow: {
    justifyContent: 'flex-start',
  },
  timeText: {
    fontSize: 11,
  },
  myTimeText: {
    color: '#BFDBFE',
  },
  otherTimeText: {
    color: '#94A3B8',
  },
  statusBar: {
    width: 14,
    height: 3.5,
    borderRadius: 2,
    marginLeft: 6,
  },
  statusBarDelivered: {
    backgroundColor: '#38BDF8', // Blue when delivered
  },
  statusBarSeen: {
    backgroundColor: '#22C55E', // Green when seen
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 6,
  },
  attachedImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
  },
  previewContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#023E7D',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 12,
    backgroundColor: '#EF4444',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputSafeArea: {
    backgroundColor: '#FFFFFF',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  attachButton: {
    padding: 8,
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    color: '#0F172A',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#023E7D',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  emptyAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyAvatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#023E7D',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },
});
