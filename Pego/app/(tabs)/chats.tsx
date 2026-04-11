import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { auth } from "../../src/services/firebase/FirebaseConfig";
import {
  subscribeToUserChats,
  deleteChat,
  ChatConversation,
  formatChatTime,
} from "../../src/services/firebase/chatService";
import {
  ensureUserProfile,
  subscribeToUserProfile,
} from "../../src/services/firebase/user/userService";
import {
  getSyncLocalProfileImage,
  saveLocalProfileImage,
  batchCacheAvatars,
  getSyncCachedConversations,
  cacheConversations,
  loadCachedConversations,
} from "../../src/services/storage/localStorageService";
import { NewChatModal } from "../../components/chat/NewChatModal";

export default function ChatsScreen() {
  const currentUser = auth.currentUser;
  const initialChats = currentUser
    ? getSyncCachedConversations<ChatConversation>(currentUser.uid)
    : [];

  const [conversations, setConversations] = useState<ChatConversation[]>(initialChats);
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(initialChats.length === 0);
  const [modalVisible, setModalVisible] = useState(false);

  const activeAvatarSubs = useRef<Map<string, () => void>>(new Map());

  // Listen to user's chats with instant local cache fallback
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    // Background profile check (non-blocking)
    ensureUserProfile(
      currentUser.uid,
      currentUser.email || "",
      currentUser.displayName || currentUser.email?.split("@")[0] || "User",
      currentUser.photoURL
    ).catch(() => {});

    // Check memory cache first, or load from persistent storage
    const syncChats = getSyncCachedConversations<ChatConversation>(currentUser.uid);
    if (syncChats && syncChats.length > 0) {
      setConversations(syncChats);
      setLoading(false);
    } else {
      loadCachedConversations<ChatConversation>(currentUser.uid).then((cached) => {
        if (cached && cached.length > 0) {
          setConversations(cached);
          setLoading(false);
        }
      });
    }

    const unsubscribe = subscribeToUserChats(currentUser.uid, (chats) => {
      setConversations(chats);
      setLoading(false);
      cacheConversations(currentUser.uid, chats).catch(() => {});
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // Cache avatars in local storage and listen for real-time photo updates stably
  useEffect(() => {
    if (!conversations.length || !currentUser) return;

    const toCache: { uid: string; photoURL?: string | null }[] = [];

    conversations.forEach((conv) => {
      const otherUid = conv.participants.find((p) => p !== currentUser.uid);
      if (!otherUid) return;

      const detail = conv.participantDetails?.[otherUid];
      if (detail?.photoURL) {
        toCache.push({ uid: otherUid, photoURL: detail.photoURL });
      }

      // Only subscribe if not already subscribed to this user
      if (!activeAvatarSubs.current.has(otherUid)) {
        const unsub = subscribeToUserProfile(otherUid, (profile) => {
          if (profile?.photoURL) {
            saveLocalProfileImage(otherUid, profile.photoURL).catch(() => {});
            setAvatarMap((prev) => {
              if (prev[otherUid] === profile.photoURL) return prev;
              return { ...prev, [otherUid]: profile.photoURL! };
            });
          }
        });
        activeAvatarSubs.current.set(otherUid, unsub);
      }
    });

    if (toCache.length > 0) {
      batchCacheAvatars(toCache).catch(() => {});
    }
  }, [conversations, currentUser]);

  // Clean up avatar subscriptions on unmount
  useEffect(() => {
    const subs = activeAvatarSubs.current;
    return () => {
      subs.forEach((unsub) => unsub());
      subs.clear();
    };
  }, []);

  // Extract the other participant's details for each conversation
  const getOtherParticipant = React.useCallback(
    (item: ChatConversation) => {
      if (!currentUser) {
        return {
          uid: "",
          name: "User",
          email: "",
          photoURL: null as string | null,
        };
      }

      const otherUid =
        item.participants.find((p) => p !== currentUser.uid) || "";
      const detail = item.participantDetails?.[otherUid];
      const localPhoto =
        avatarMap[otherUid] || getSyncLocalProfileImage(otherUid);
      const photoURL = localPhoto || detail?.photoURL || null;

      if (detail) {
        return {
          uid: otherUid,
          name: detail.name || detail.email?.split("@")[0] || "User",
          email: detail.email || "",
          photoURL,
        };
      }

      return {
        uid: otherUid,
        name: "Chat",
        email: "",
        photoURL,
      };
    },
    [currentUser, avatarMap]
  );

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;

    return conversations.filter((item) => {
      const other = getOtherParticipant(item);
      const lastMsg = item.lastMessage?.text?.toLowerCase() || "";
      return (
        other.name.toLowerCase().includes(q) ||
        other.email.toLowerCase().includes(q) ||
        lastMsg.includes(q)
      );
    });
  }, [conversations, search, getOtherParticipant]);

  const handleOpenChat = useCallback((item: ChatConversation) => {
    const other = getOtherParticipant(item);

    router.push({
      pathname: "/chat/[id]",
      params: {
        id: item.id,
        otherUserId: other.uid,
        otherUserName: other.name,
        otherUserEmail: other.email,
        otherUserPhoto: other.photoURL || "",
      },
    });
  }, [getOtherParticipant]);

  const handleLongPressChat = useCallback((item: ChatConversation) => {
    const other = getOtherParticipant(item);
    Alert.alert(
      "Delete Conversation",
      `Are you sure you want to delete your conversation with ${other.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteChat(item.id);
            } catch (err) {
              console.error("Delete chat error:", err);
              Alert.alert("Error", "Unable to delete conversation.");
            }
          },
        },
      ]
    );
  }, [getOtherParticipant]);

  const renderChatItem = useCallback(({ item }: { item: ChatConversation }) => {
    const other = getOtherParticipant(item);
    const initial = (other.name || other.email || "U").charAt(0).toUpperCase();

    const lastMsgText = item.lastMessage?.text || "Started a new conversation";
    const isMeLastSender = item.lastMessage?.senderId === currentUser?.uid;
    const timeDisplay = formatChatTime(
      item.lastMessage?.createdAt || item.updatedAt || item.createdAt
    );

    return (
      <TouchableOpacity
        style={styles.chatItem}
        activeOpacity={0.7}
        onPress={() => handleOpenChat(item)}
        onLongPress={() => handleLongPressChat(item)}
        delayLongPress={350}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {other.photoURL ? (
            <Image
              source={{ uri: other.photoURL }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}

          <View style={styles.onlineDot} />
        </View>

        {/* Chat content */}
        <View style={styles.chatContent}>
          <View style={styles.chatTopRow}>
            <Text style={styles.name} numberOfLines={1}>
              {other.name}
            </Text>

            <Text style={styles.time}>{timeDisplay}</Text>
          </View>

          <View style={styles.chatBottomRow}>
            <Text style={styles.message} numberOfLines={1}>
              {isMeLastSender ? `You: ${lastMsgText}` : lastMsgText}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [getOtherParticipant, currentUser?.uid, handleOpenChat, handleLongPressChat]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Chats</Text>
          <Text style={styles.subtitle}>
            Stay connected with your friends
          </Text>
        </View>

        <Pressable
          style={styles.newChatButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="create-outline" size={23} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#64748B" />

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search conversations..."
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
        />

        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={20} color="#94A3B8" />
          </Pressable>
        )}
      </View>

      {/* Conversations list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#023E7D" />
          <Text style={styles.loadingText}>Loading chats...</Text>
        </View>
      ) : filteredConversations.length > 0 ? (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="chatbubbles-outline"
              size={42}
              color="#023E7D"
            />
          </View>

          <Text style={styles.emptyTitle}>
            {search ? "No conversations found" : "No chats yet"}
          </Text>

          <Text style={styles.emptyDescription}>
            {search
              ? "Try searching for another person or message."
              : "Connect and chat with anyone! Tap below to start your first conversation."}
          </Text>

          {!search && (
            <Pressable
              style={styles.startFirstChatBtn}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons
                name="chatbubble-ellipses"
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.startFirstChatText}>Start a Chat</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Floating button */}
      <Pressable
        style={styles.floatingButton}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="chatbubble" size={24} color="#FFFFFF" />
      </Pressable>

      {/* New conversation modal */}
      <NewChatModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748B",
  },
  newChatButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#023E7D",
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 15,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: "#0F172A",
  },
  list: {
    paddingBottom: 100,
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    paddingHorizontal: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    borderRadius: 12,
  },
  chatItemPressed: {
    backgroundColor: "#F1F5F9",
    opacity: 0.85,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#023E7D",
  },
  onlineDot: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22C55E",
    borderWidth: 2.5,
    borderColor: "#F8FAFC",
  },
  chatContent: {
    flex: 1,
  },
  chatTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    flex: 1,
    marginRight: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  time: {
    fontSize: 12,
    color: "#94A3B8",
  },
  chatBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  message: {
    flex: 1,
    fontSize: 14,
    color: "#64748B",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#64748B",
  },
  floatingButton: {
    position: "absolute",
    right: 22,
    bottom: 25,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#023E7D",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 85,
    height: 85,
    borderRadius: 43,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  emptyDescription: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
  startFirstChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#023E7D",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 22,
  },
  startFirstChatText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
