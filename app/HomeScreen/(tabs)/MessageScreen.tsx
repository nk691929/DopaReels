import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { FontAwesome, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../supabase.config';
import Colors from '@/src/constants/color';
import { useTheme } from '@/src/context/ThemeContext';
import ChatComponent from '../../ComponentsScreen/ChatComponent';
import { useNavigation } from '@react-navigation/native';
import StoriesComponent from '@/app/ComponentsScreen/StoriesComponent';

const { width } = Dimensions.get('window'); // Get the screen width

type User = {
  id: string;
  username: string;
  fullname: string;
  photo_url: string;
};

type Chat = {
  id: string;
  other_user: User;
  last_message?: {
    content: string;
    created_at: string;
    is_seen?: boolean;
  };
  unread_count: number;
  is_unread?: boolean;
};

const MessageScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedChat, setSelectedChat] = useState<{
    userId: string;
    username: string;
    photoUrl: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const messageSubscriptionRef = useRef<any>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageIdsRef = useRef<Record<string, string>>({});
  const readChatsRef = useRef<Set<string>>(new Set());
  const seenMessagesRef = useRef<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
    fetchChats();

    // Set up real-time subscription for messages
    const unsubscribe = subscribeToMessages();

    return () => {
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current.unsubscribe();
      }
    };
  }, [currentUserId]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      setCurrentUserId(user?.id || null);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchChats = async () => {
    try {
      setIsLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      // Fetch all chats where the current user is either sender or receiver
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          receiver_id,
          content,
          created_at,
          sender:users!messages_sender_id_fkey(id, username, fullname, photo_url),
          receiver:users!messages_receiver_id_fkey(id, username, fullname, photo_url)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Group messages by chat and get the latest message
      const chatMap = new Map<string, Chat>();
      messages?.forEach((message) => {
        const otherUser = message.sender_id === user.id ? message.receiver : message.sender;
        const chatId = `${user.id}_${otherUser.id}`;

        // Check if this message has been seen
        const isSeen = seenMessagesRef.current.has(message.id);

        if (!chatMap.has(chatId)) {
          chatMap.set(chatId, {
            id: chatId,
            other_user: otherUser,
            last_message: {
              content: message.content,
              created_at: message.created_at,
              is_seen: message.sender_id === user.id ? isSeen : true
            },
            unread_count: (message.sender_id !== user.id && !isSeen) ? 1 : 0,
            is_unread: (message.sender_id !== user.id && !isSeen)
          });
        } else {
          const existingChat = chatMap.get(chatId)!;
          // Only update if this is a newer message
          const existingTime = existingChat.last_message?.created_at ? new Date(existingChat.last_message.created_at).getTime() : 0;
          const newTime = new Date(message.created_at).getTime();

          if (newTime > existingTime) {
            existingChat.last_message = {
              content: message.content,
              created_at: message.created_at,
              is_seen: message.sender_id === user.id ? isSeen : true
            };
            // Update unread count only for messages from the other user
            if (message.sender_id !== user.id && !isSeen) {
              existingChat.unread_count += 1;
              existingChat.is_unread = true;
            }
          }
        }
      });

      // Convert map to array and sort by most recent message
      const chatArray = Array.from(chatMap.values());
      chatArray.sort((a, b) => {
        const aTime = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
        const bTime = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
        return bTime - aTime;
      });

      setChats(chatArray);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (!currentUserId) {
      console.log('Cannot subscribe: currentUserId is null');
      return () => { };
    }

    console.log('Setting up real-time subscription for messages');

    // Subscribe to new messages
    const messageSubscription = supabase
      .channel('messages_channel')
      .on('postgres_changes', {
        event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: 'messages',
        filter: `or(sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId})`
      }, (payload) => {
        console.log('Received real-time message event:', payload);

        if (payload.new) {
          const message = payload.new;
          const otherUserId = message.sender_id === currentUserId ? message.receiver_id : message.sender_id;
          const chatId = `${currentUserId}_${otherUserId}`;

          // Check if this message has been seen
          const isSeen = seenMessagesRef.current.has(message.id);

          setChats(prevChats => {
            const chatIndex = prevChats.findIndex(chat => chat.id === chatId);

            if (chatIndex === -1) {
              // This is a new chat, fetch all chats to get the other user info
              fetchChats();
              return prevChats;
            }

            const newChats = [...prevChats];
            const existingChat = newChats[chatIndex];

            // Update the last message
            existingChat.last_message = {
              content: message.content,
              created_at: message.created_at,
              is_seen: message.sender_id === currentUserId ? isSeen : true
            };

            // Update unread status if it's a message from the other user and not seen
            if (message.sender_id !== currentUserId && !isSeen) {
              existingChat.unread_count += 1;
              existingChat.is_unread = true;
            }

            // Move this chat to the top of the list
            newChats.splice(chatIndex, 1);
            newChats.unshift(existingChat);

            return newChats;
          });
        }
      })
      .subscribe((status) => {
        console.log('Message subscription status:', status);
      });

    messageSubscriptionRef.current = messageSubscription;

    // Set up message seen channel
    setupMessageSeenChannel();

    return () => {
      console.log('Unsubscribing from messages channel');
      messageSubscription.unsubscribe();
    };
  };

  const setupMessageSeenChannel = () => {
    if (!currentUserId) return;

    // Create a dedicated channel for message seen status
    const seenChannelName = `seen:${currentUserId}`;
    console.log('Setting up message seen channel:', seenChannelName);

    // Create a new channel for seen status
    const seenChannel = supabase.channel(seenChannelName);

    // Subscribe to seen events
    seenChannel
      .on('broadcast', { event: 'seen' }, ({ payload }) => {
        console.log('Received message seen status:', payload);
        if (payload.userId !== currentUserId) {
          // Update the chats to reflect the seen status
          setChats(prevChats => {
            return prevChats.map(chat => {
              // Only update chats where the other user is the one who marked messages as seen
              if (chat.other_user.id === payload.userId) {
                return {
                  ...chat,
                  last_message: chat.last_message ? {
                    ...chat.last_message,
                    is_seen: true
                  } : undefined
                };
              }
              return chat;
            });
          });
        }
      })
      .subscribe((status) => {
        console.log('Message seen subscription status:', status);
      });

    return seenChannel;
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      // First, get all users that the current user follows
      const { data: following, error: followingError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followingError) throw followingError;

      const followingIds = following.map(f => f.following_id);

      // Then, search for users that the current user follows
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, username, fullname, photo_url')
        .in('id', followingIds)
        .or(`username.ilike.%${query}%,fullname.ilike.%${query}%`)
        .limit(10);

      if (usersError) throw usersError;
      setSearchResults(users || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    searchUsers(text);
  };

  const handleChatPress = (userId: string, username: string, photoUrl: string) => {
    // Hide tabs before opening chat using a more reliable method
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({
        tabBarStyle: {
          display: 'none',
          height: 0,
          opacity: 0
        }
      });
    }

    setSelectedChat({ userId, username, photoUrl });
  };

  const handleCloseChat = () => {
    // Show tabs when closing chat
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({
        tabBarStyle: {
          display: 'flex',
          height: 60,
          opacity: 1
        }
      });
    }

    setSelectedChat(null);
  };

  const renderChatItem = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => handleChatPress(item.other_user.id, item.other_user.username, item.other_user.photo_url)}
    >
      <Image
        source={{ uri: item.other_user.photo_url }}
        style={styles.chatAvatar}
      />
      <View style={styles.chatInfo}>
        <Text style={[
          styles.chatUsername,
          {
            color: colors?.text || '#000000',
            fontWeight: item.is_unread ? '700' : '600'
          }
        ]}>
          {item.other_user.username}
        </Text>
        {item.last_message && (
          <View style={styles.lastMessageContainer}>
            <Text
              style={[
                styles.lastMessage,
                {
                  color: item.is_unread
                    ? colors?.text || '#000000'
                    : colors?.textSecondary || '#999999',
                  fontWeight: item.is_unread ? '500' : '400'
                }
              ]}
              numberOfLines={1}
            >
              {item.last_message.content}
            </Text>
            {item.last_message.is_seen === false && (
              <Ionicons name="checkmark" size={14} color={colors?.textSecondary || '#999999'} style={styles.seenIndicator} />
            )}
            {item.last_message.is_seen === true && (
              <Ionicons name="checkmark-done" size={14} color={colors?.primary || Colors.primary} style={styles.seenIndicator} />
            )}
          </View>
        )}
      </View>
      {item.unread_count > 0 && (
        <View style={[styles.unreadBadge, { backgroundColor: colors?.primary || Colors.primary }]}>
          <Text style={styles.unreadCount}>{item.unread_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleChatPress(item.id, item.username, item.photo_url)}
    >
      <Image
        source={{ uri: item.photo_url }}
        style={styles.searchResultAvatar}
      />
      <View style={styles.searchResultInfo}>
        <Text style={[styles.searchResultUsername, { color: colors?.text || '#000000' }]}>
          {item.username}
        </Text>
        <Text style={styles.searchResultName}>{item.fullname}</Text>
      </View>
    </TouchableOpacity>
  );

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      // Clear the last message IDs to force a full refresh
      lastMessageIdsRef.current = {};
      await fetchChats();
    } catch (error) {
      console.error('Error refreshing chats:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (selectedChat) {
    return (
      <ChatComponent
        otherUserId={selectedChat.userId}
        otherUserUsername={selectedChat.username}
        otherUserPhotoUrl={selectedChat.photoUrl}
        onClose={handleCloseChat}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors?.background || '#FFFFFF' }]}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors?.text + '80' || '#00000080'} />
        <TextInput
          style={[styles.searchInput, { color: colors?.text || '#000000' }]}
          placeholder="Search friends..."
          placeholderTextColor={colors?.text + '80' || '#00000080'}
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors?.primary || Colors.primary} />
        </View>
      ) : searchQuery ? (
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.searchResults}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors?.text + '80' || '#00000080' }]}>
              No friends found
            </Text>
          }
        />
      ) : (
        <ScrollView showsHorizontalScrollIndicator={false}>
          <StoriesComponent />
          <FlatList
            data={chats}
            renderItem={renderChatItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatsList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors?.primary || Colors.primary]}
                tintColor={colors?.primary || Colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name="chat-outline"
                  size={48}
                  color={colors?.text + '40' || '#00000040'}
                />
                <Text styl-e={[styles.emptyText, { color: colors?.text + '80' || '#00000080' }]}>
                  No messages yet
                </Text>
                <Text style={[styles.emptySubtext, { color: colors?.text + '60' || '#00000060' }]}>
                  Search for friends to start chatting
                </Text>
              </View>
            }
          />
        </ScrollView>
      )}
    </View>
  );
};

export default MessageScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResults: {
    padding: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  searchResultAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultUsername: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchResultName: {
    fontSize: 14,
    color: '#999999',
  },
  chatsList: {
    padding: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
  },
  chatUsername: {
    fontSize: 16,
    fontWeight: '600',
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#999999',
  },
  seenIndicator: {
    marginLeft: 4,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});