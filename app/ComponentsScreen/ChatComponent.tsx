import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  Image, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator, 
  Pressable,
  SafeAreaView,
  Keyboard,
  TouchableWithoutFeedback,
  RefreshControl,
  Alert,
  Modal
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../supabase.config';
import Colors from '@/src/constants/color';
import { useTheme } from '@/src/context/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import VideoCallScreen from './VideoCallScreen';
import AudioCallScreen from './AudioCallScreen';

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  media_url?: string;
  media_type?: string;
  is_seen?: boolean;
};

type ChatComponentProps = {
  otherUserId: string;
  otherUserUsername: string;
  otherUserPhotoUrl: string;
  onClose: () => void;
};

const useMessageSubscription = (currentUserId: string | null, otherUserId: string | null, onNewMessage: (message: Message) => void) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const messageSubscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (!currentUserId || !otherUserId) return;

    const subscribe = () => {
      // Create a unique channel name for this conversation
      const channelName = `chat:${currentUserId}:${otherUserId}`;
      
      messageSubscriptionRef.current = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `or(and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId}))`
        }, (payload) => {
          console.log('Received real-time message event:', payload);
          if (payload.new) {
            const newMessage = payload.new as Message;
            setMessages(prev => [...prev, newMessage]);
            onNewMessage(newMessage);
          }
        })
        .subscribe((status) => {
          console.log('Message subscription status:', status);
        });
    };

    subscribe();

    return () => {
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current.unsubscribe();
      }
    };
  }, [currentUserId, otherUserId, onNewMessage]);

  return { messages, setMessages };
};

const useTypingIndicator = (currentUserId: string | null, otherUserId: string | null) => {
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<any>(null);

  useEffect(() => {
    if (!currentUserId || !otherUserId) return;

    const channelName = `typing:${[currentUserId, otherUserId].sort().join(':')}`;
    
    typingChannelRef.current = supabase
      .channel(channelName)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId === otherUserId) {
          setIsOtherUserTyping(true);
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            setIsOtherUserTyping(false);
          }, 3000);
        }
      })
      .subscribe();

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
      }
    };
  }, [currentUserId, otherUserId]);

  const broadcastTypingStatus = useCallback(() => {
    if (!typingChannelRef.current || !currentUserId) return;
    
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId }
    });
  }, [currentUserId]);

  return { isOtherUserTyping, broadcastTypingStatus };
};

const usePresenceTracking = (currentUserId: string | null, otherUserId: string | null) => {
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const presenceChannelRef = useRef<any>(null);

  useEffect(() => {
    if (!currentUserId || !otherUserId) return;

    presenceChannelRef.current = supabase
      .channel(`presence:${currentUserId}:${otherUserId}`)
      .on('presence', { event: 'sync' }, () => {
        const presenceState = presenceChannelRef.current.presenceState();
        const isOnline = Object.keys(presenceState).length > 0;
        setIsOtherUserOnline(isOnline);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannelRef.current.track({ online: true });
        }
      });

    return () => {
      if (presenceChannelRef.current) {
        presenceChannelRef.current.unsubscribe();
      }
    };
  }, [currentUserId, otherUserId]);

  return { isOtherUserOnline, lastSeen };
};

const ChatComponent: React.FC<ChatComponentProps> = ({
  otherUserId,
  otherUserUsername,
  otherUserPhotoUrl,
  onClose,
}) => {
  const { colors } = useTheme();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  
  const { isOtherUserTyping, broadcastTypingStatus } = useTypingIndicator(currentUserId, otherUserId);
  
  const [debugInfo, setDebugInfo] = useState<string>('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<any>(null);
  
  const [seenMessages, setSeenMessages] = useState<Set<string>>(new Set());
  const seenMessagesRef = useRef<Set<string>>(new Set());
  const lastMessageRef = useRef<Message | null>(null);

  const navigation = useNavigation();

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Add notification channel
  const notificationChannel = useRef<RealtimeChannel | null>(null);

  const router = useRouter();

  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showAudioCall, setShowAudioCall] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);

  const handleNewMessage = useCallback((message: Message) => {
    console.log('New message received:', message);
    // Add any additional handling for new messages here
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      console.log('Fetching messages for users:', user.id, otherUserId);
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          receiver_id,
          content,
          media_url,
          media_type,
          created_at,
          sender:users!messages_sender_id_fkey(username, photo_url)
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      console.log('Fetched messages:', data?.length || 0);
      
      if (data && data.length > 0) {
        setMessages(data);
        setLastMessageId(data[data.length - 1].id);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setDebugInfo(prev => prev + '\nError fetching messages: ' + JSON.stringify(error));
    } finally {
      setIsLoading(false);
    }
  }, [otherUserId]);

  // Add default values for message subscription
  const messageSubscription = useMessageSubscription(currentUserId, otherUserId, handleNewMessage) || {
    messages: [],
    setMessages: () => {}
  };
  const { messages, setMessages } = messageSubscription;

  // Setup notification channel
  useEffect(() => {
    if (!currentUserId || !otherUserId) return;

    const channelName = `notifications:${otherUserId}`;
    notificationChannel.current = supabase.channel(channelName);

    notificationChannel.current
      .on('broadcast', { event: 'new_message' }, (payload) => {
        // Handle incoming notifications
        if (payload.message) {
          // You can show a local notification here if needed
          console.log('New message notification:', payload.message);
        }
      })
      .subscribe();

    return () => {
      notificationChannel.current?.unsubscribe();
    };
  }, [currentUserId, otherUserId]);

  // Function to send notification
  const sendNotification = async (message: Message) => {
    if (!notificationChannel.current || !otherUserId) return;

    try {
      // Send notification to the other user
      await notificationChannel.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          message: {
            id: message.id,
            content: message.content,
            sender_id: currentUserId,
            chat_id: otherUserId,
            created_at: message.created_at
          }
        }
      });

      // Also store the notification in the database
      const { error } = await supabase
        .from('notifications')
        .insert([
          {
            user_id: otherUserId,
            type: 'new_message',
            data: {
              message_id: message.id,
              chat_id: otherUserId,
              sender_id: currentUserId,
              content: message.content
            },
            read: false
          }
        ]);

      if (error) {
        console.error('Error storing notification:', error);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchMessages();
    setupTypingChannel();
    fetchUserStatus();
    
    // Set up message seen channel
    const seenChannel = setupMessageSeenChannel();
    
    // Set up polling as a fallback for real-time updates
    const pollingInterval = setInterval(() => {
      if (currentUserId) {
        fetchMessages();
      }
    }, 3000); // Poll every 3 seconds
    
    const unsubscribe = subscribeToMessages();
    
    // Set up presence tracking
    const cleanupPresence = setupPresenceTracking();
    
    // Ensure tabs are hidden when component mounts
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
    
    // Cleanup function to ensure tabs are shown when component unmounts
    return () => {
      unsubscribe();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (typingChannelRef.current) {
        typingChannelRef.current.unsubscribe();
      }
      if (seenChannel) {
        seenChannel.unsubscribe();
      }
      if (cleanupPresence) {
        cleanupPresence();
      }
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
    };
  }, [currentUserId, otherUserId, fetchMessages, navigation]);

  useEffect(() => {
    // When messages change, check for unread messages
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      lastMessageRef.current = lastMessage;
      
      // If the last message is from the other user and not seen, mark it as seen
      if (lastMessage.sender_id !== currentUserId && !seenMessagesRef.current.has(lastMessage.id)) {
        markMessageAsSeen(lastMessage.id);
      }
    }
  }, [messages]);

  const markMessageAsSeen = async (messageId: string) => {
    try {
      if (!currentUserId || !otherUserId) return;

      // Add to seen messages set
      const newSeenMessages = new Set(seenMessagesRef.current);
      newSeenMessages.add(messageId);
      seenMessagesRef.current = newSeenMessages;
      setSeenMessages(newSeenMessages);

      // Try to update the message status in the database
      try {
        const { error } = await supabase
          .from('messages')
          .update({ is_seen: true })
          .eq('id', messageId);

        if (error) {
          console.log('Could not update is_seen in database, using local state only');
        }
      } catch (dbError) {
        console.log('Database error when updating is_seen, using local state only');
      }

      // Broadcast the seen status to the other user
      broadcastMessageSeen([messageId]);

      // Update the local message state
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId ? { ...msg, is_seen: true } : msg
        )
      );
    } catch (error) {
      console.error('Error marking message as seen:', error);
    }
  };

  const broadcastMessageSeen = (messageIds: string[]) => {
    if (!currentUserId || !otherUserId || messageIds.length === 0) return;
    
    console.log('Broadcasting message seen:', messageIds);
    
    // Create a dedicated channel for message seen status
    const seenChannelName = `seen:${otherUserId}:${currentUserId}`;
    
    // Broadcast seen status
    supabase
      .channel(seenChannelName)
      .send({
        type: 'broadcast',
        event: 'seen',
        payload: { 
          userId: currentUserId,
          messageIds: messageIds
        }
      })
      .then(() => {
        console.log('Message seen status broadcast sent successfully');
      })
      .catch(error => {
        console.error('Error broadcasting message seen status:', error);
      });
  };

  const setupMessageSeenChannel = () => {
    if (!currentUserId || !otherUserId) return;
    
    // Create a dedicated channel for message seen status
    const seenChannelName = `seen:${currentUserId}:${otherUserId}`;
    console.log('Setting up message seen channel:', seenChannelName);
    
    // Create a new channel for seen status
    const seenChannel = supabase.channel(seenChannelName);
    
    // Subscribe to seen events
    seenChannel
      .on('broadcast', { event: 'seen' }, ({ payload }) => {
        console.log('Received message seen status:', payload);
        if (payload.userId === otherUserId) {
          // Update the seen status of the messages
          setMessages(prevMessages => 
            prevMessages.map(message => 
              payload.messageIds.includes(message.id) 
                ? { ...message, is_seen: true } 
                : message
            )
          );
          
          // Update our seen messages set
          const newSeenMessages = new Set(seenMessagesRef.current);
          payload.messageIds.forEach(id => newSeenMessages.add(id));
          seenMessagesRef.current = newSeenMessages;
          setSeenMessages(newSeenMessages);
        }
      })
      .subscribe((status) => {
        console.log('Message seen subscription status:', status);
      });
    
    return seenChannel;
  };

  const fetchCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      setCurrentUserId(user?.id || null);
      console.log('Current user ID:', user?.id);
    } catch (error) {
      console.error('Error fetching current user:', error);
      setDebugInfo(prev => prev + '\nError fetching current user: ' + JSON.stringify(error));
    }
  };

  const fetchUserStatus = async () => {
    try {
      console.log('Fetching user status for:', otherUserId);
      
      // First check if user is online from user_status table
      const { data: statusData, error: statusError } = await supabase
          .from('user_status')
        .select('is_online, last_seen')
          .eq('user_id', otherUserId)
          .single();
          
      if (statusError) {
        console.error('Error fetching user status:', statusError);
        setIsOtherUserOnline(false);
        setLastSeen(null);
        return;
      }

      if (statusData) {
        setIsOtherUserOnline(statusData.is_online);
        // Always set last_seen, regardless of online status
        setLastSeen(statusData.last_seen);
        } else {
        setIsOtherUserOnline(false);
        setLastSeen(null);
        }

    } catch (error) {
      console.error('Error fetching user status:', error);
      setIsOtherUserOnline(false);
      setLastSeen(null);
    }
  };

  const subscribeToMessages = () => {
    if (!currentUserId) {
      console.log('Cannot subscribe: currentUserId is null');
      return () => {};
    }
    
    console.log('Setting up real-time subscription for users:', currentUserId, otherUserId);
    
    // Create a unique channel name for this conversation
    const channelName = `chat:${currentUserId}:${otherUserId}`;
    
    // Subscribe to new messages using a simpler approach
    const messageSubscription = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        console.log('Received real-time message event:', payload);
        
        // When we receive a change, fetch the latest messages
        fetchMessages();
      })
      .subscribe((status) => {
        console.log('Subscription status:', status);
        setDebugInfo(prev => prev + '\nSubscription status: ' + status);
      });

    // Set up typing indicator channel
    setupTypingChannel();

    return () => {
      console.log('Unsubscribing from channels');
      messageSubscription.unsubscribe();
      if (typingChannelRef.current) {
        typingChannelRef.current.unsubscribe();
      }
    };
  };

  const setupTypingChannel = () => {
    // This function is no longer needed as typing is handled by the hook
    return () => {};
  };

  const handleTextChange = (text: string) => {
    setNewMessage(text);
    broadcastTypingStatus();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMessages();
    setRefreshing(false);
  };

  const pickMedia = async (type: 'image' | 'video') => {
    try {
      console.log('Picking media:', type);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === 'image' 
          ? ImagePicker.MediaTypeOptions.Images 
          : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('Media selected:', result.assets[0]);
        setSelectedMedia({ uri: result.assets[0].uri, type });
      }
      setShowMediaOptions(false);
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick media. Please try again.');
    }
  };

  const uploadMedia = async (uri: string, type: 'image' | 'video') => {
    try {
      console.log('Starting media upload:', { uri, type });
      
      // Create a unique filename
      const fileExt = uri.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${type}s/${fileName}`;
      
      // For local files, we need to handle the file differently
      let fileData;
      
      if (uri.startsWith('file://')) {
        // For local files, we need to read the file as a base64 string
        const response = await fetch(uri);
        const blob = await response.blob();
        
        // Convert blob to base64
        const reader = new FileReader();
        fileData = await new Promise((resolve, reject) => {
          reader.onload = () => {
            const base64data = reader.result as string;
            // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
            const base64Content = base64data.split(',')[1];
            resolve(base64Content);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        // For remote URLs, fetch the file
        const response = await fetch(uri);
        const blob = await response.blob();
        fileData = blob;
      }
      
      console.log('Uploading to Supabase storage:', filePath);
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(filePath, fileData, {
          contentType: type === 'image' ? 'image/jpeg' : 'video/mp4',
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('Error uploading media:', error);
        throw error;
      }
      
      console.log('Media uploaded successfully:', data);
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);
      
      console.log('Public URL:', publicUrl);
      
      return publicUrl;
    } catch (error) {
      console.error('Error in uploadMedia:', error);
      throw error;
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedMedia) || !currentUserId) return;

    try {
      setIsSending(true);
      let mediaUrl = null;

      if (selectedMedia) {
        console.log('Uploading media before sending message');
        mediaUrl = await uploadMedia(selectedMedia.uri, selectedMedia.type);
        console.log('Media uploaded, URL:', mediaUrl);
      }

      console.log('Sending message to:', otherUserId);
      
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            sender_id: currentUserId,
            receiver_id: otherUserId,
            content: newMessage.trim(),
            media_url: mediaUrl,
            media_type: selectedMedia?.type,
          },
        ])
        .select();

      if (error) {
        console.error('Error sending message:', error);
        Alert.alert('Error', 'Failed to send message. Please try again.');
        throw error;
      }
      
      console.log('Message sent successfully:', data);
      
      // Fetch the latest messages to ensure we have the most up-to-date data
      fetchMessages();

      setNewMessage('');
      setSelectedMedia(null);

      // Send notification for the new message
      await sendNotification(data[0]);
    } catch (error) {
      console.error('Error sending message:', error);
      setDebugInfo(prev => prev + '\nError sending message: ' + JSON.stringify(error));
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const setupPresenceTracking = () => {
    if (!currentUserId || !otherUserId) return;
    
    console.log('Setting up presence tracking for users:', currentUserId, otherUserId);
    
    // Update user status to online
    const updateUserStatus = async (isOnline: boolean) => {
      try {
        if (!currentUserId) {
          console.error('Cannot update status: currentUserId is null');
          return;
        }

        // First check if the user has a status record
        const { data: existingStatus, error: checkError } = await supabase
          .from('user_status')
          .select('user_id')
          .eq('user_id', currentUserId)
          .single();
        
        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error('Error checking user status:', checkError.message);
          return;
        }

        // If no record exists, create one
        if (!existingStatus) {
          const { error: insertError } = await supabase
            .from('user_status')
            .insert({
            user_id: currentUserId,
              is_online: isOnline,
            last_seen: new Date().toISOString()
          });

          if (insertError) {
            console.error('Error creating user status:', insertError.message);
            return;
          }
        } else {
          // Update existing record
          const { error: updateError } = await supabase
            .from('user_status')
            .update({
              is_online: isOnline,
          last_seen: new Date().toISOString()
            })
            .eq('user_id', currentUserId);

          if (updateError) {
            console.error('Error updating user status:', updateError.message);
            return;
          }
        }

        console.log(`Successfully ${existingStatus ? 'updated' : 'created'} user status to ${isOnline ? 'online' : 'offline'}`);
      } catch (error) {
        console.error('Error in updateUserStatus:', error);
        console.error('Full error object:', error);
      }
    };

    // Set initial online status
    updateUserStatus(true);

    // Set up an interval to update our online status
    const statusInterval = setInterval(() => {
      updateUserStatus(true);
    }, 30000); // Update every 30 seconds

    // Update status when component unmounts
    return () => {
      clearInterval(statusInterval);
      updateUserStatus(false);
    };
  };

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return 'Unknown';
    
    try {
      const lastSeenDate = new Date(lastSeen);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - lastSeenDate.getTime()) / 1000);
      
      if (diffInSeconds < 60) {
        return 'Just now';
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        return lastSeenDate.toLocaleDateString();
      }
    } catch (error) {
      console.error('Error formatting last seen:', error);
      return 'Unknown';
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage || !currentUserId) return;

    try {
      // Delete from database
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', selectedMessage.id);

      if (error) throw error;

      // Update local state
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg.id !== selectedMessage.id)
      );

      // Close modal and clear selection
      setShowDeleteModal(false);
      setSelectedMessage(null);

      // Broadcast deletion to other user
      broadcastMessageDeletion(selectedMessage.id);
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message. Please try again.');
    }
  };

  const broadcastMessageDeletion = (messageId: string) => {
    if (!currentUserId || !otherUserId) return;
    
    const deletionChannelName = `delete:${otherUserId}:${currentUserId}`;
    
    supabase
      .channel(deletionChannelName)
      .send({
        type: 'broadcast',
        event: 'delete',
        payload: { 
          userId: currentUserId,
          messageId: messageId
        }
      })
      .catch(error => {
        console.error('Error broadcasting message deletion:', error);
      });
  };

  const setupMessageDeletionChannel = () => {
    if (!currentUserId || !otherUserId) return;
    
    const deletionChannelName = `delete:${currentUserId}:${otherUserId}`;
    
    const deletionChannel = supabase.channel(deletionChannelName);
    
    deletionChannel
      .on('broadcast', { event: 'delete' }, ({ payload }) => {
        if (payload.userId === otherUserId) {
          setMessages(prevMessages => 
            prevMessages.filter(msg => msg.id !== payload.messageId)
          );
        }
      })
      .subscribe();
    
    return deletionChannel;
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_id === currentUserId;
    const isSeen = seenMessagesRef.current.has(item.id);

    return (
      <Pressable
        onLongPress={() => {
          if (isMyMessage) {
            setSelectedMessage(item);
            setShowDeleteModal(true);
          }
        }}
        delayLongPress={500}
      >
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessage : styles.otherMessage,
      ]}>
        {!isMyMessage && (
          <Image
            source={{ uri: otherUserPhotoUrl }}
            style={styles.messageAvatar}
          />
        )}
        <View style={[
          styles.messageContent,
          isMyMessage ? styles.myMessageContent : [styles.otherMessageContent, { backgroundColor: colors.card }],
        ]}>
          {item.media_url && (
            <View style={styles.mediaContainer}>
              {item.media_type === 'image' ? (
                <Image
                  source={{ uri: item.media_url }}
                  style={styles.mediaContent}
                  resizeMode="cover"
                />
              ) : (
                <Video
                  source={{ uri: item.media_url }}
                  style={styles.mediaContent}
                  useNativeControls
                  resizeMode="contain"
                />
              )}
            </View>
          )}
          {item.content && (
            <Text style={[
              styles.messageText,
              { color: isMyMessage ? '#FFFFFF' : colors.text },
            ]}>
              {item.content}
            </Text>
          )}
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              { color: isMyMessage ? 'rgba(255, 255, 255, 0.7)' : colors.textSecondary }
            ]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMyMessage && (
              <View style={styles.seenIndicator}>
                  {isSeen ? (
                  <Ionicons name="checkmark-done" size={16} color="rgba(255, 255, 255, 0.7)" />
                ) : (
                  <Ionicons name="checkmark" size={16} color="rgba(255, 255, 255, 0.7)" />
                )}
              </View>
            )}
          </View>
        </View>
      </View>
      </Pressable>
    );
  };

  const handleClose = () => {
    // Ensure tabs are shown when closing chat
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
    onClose();
  };

  const startCall = async (type: 'video' | 'audio') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create a new call record
      const { data: call, error } = await supabase
        .from('calls')
        .insert([
          {
            caller_id: user.id,
            receiver_id: otherUserId,
            type: type,
            status: 'pending'
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setCallId(call.id);
      if (type === 'video') {
        setShowVideoCall(true);
      } else {
        setShowAudioCall(true);
      }

      // Broadcast the call to the other user
      const channel = supabase.channel(`call:${otherUserId}`);
      await channel.send({
        type: 'broadcast',
        event: 'incoming_call',
        payload: {
          callId: call.id,
          type: type,
          caller: {
            id: user.id,
            username: user.user_metadata.username,
            photo_url: user.user_metadata.photo_url
          }
        }
      });
    } catch (error) {
      console.error('Error starting call:', error);
      Alert.alert('Error', 'Failed to start call. Please try again.');
    }
  };

  const handleIncomingCall = async (payload: any) => {
    Alert.alert(
      `Incoming ${payload.type} Call`,
      `${payload.caller.username} is calling you`,
      [
        {
          text: 'Reject',
          style: 'cancel',
          onPress: async () => {
            await supabase
              .from('calls')
              .update({ status: 'rejected' })
              .eq('id', payload.callId);
          }
        },
        {
          text: 'Accept',
          onPress: async () => {
            setCallId(payload.callId);
            if (payload.type === 'video') {
              setShowVideoCall(true);
            } else {
              setShowAudioCall(true);
            }
            await supabase
              .from('calls')
              .update({ status: 'accepted' })
              .eq('id', payload.callId);
          }
        }
      ]
    );
  };

  useEffect(() => {
    // Set up call channel
    const callChannel = supabase.channel(`call:${otherUserId}`);
    
    callChannel
      .on('broadcast', { event: 'incoming_call' }, handleIncomingCall)
      .subscribe();

    return () => {
      callChannel.unsubscribe();
    };
  }, [otherUserId]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Navigation Bar */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Image source={{ uri: otherUserPhotoUrl }} style={styles.headerImage} />
        <View style={styles.headerUserInfo}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{otherUserUsername}</Text>
          <View style={styles.statusContainer}>
            {isOtherUserOnline ? (
              <View style={styles.onlineIndicator}>
                <View style={[styles.onlineDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                  Online 
                </Text>
              </View>
            ) : (
              <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                Last seen {formatLastSeen(lastSeen)}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.callButtons}>
          <TouchableOpacity
            style={[styles.callButton, { backgroundColor: colors.primary }]}
            onPress={() => startCall('video')}
          >
            <Ionicons name="videocam" size={24} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.callButton, { backgroundColor: colors.primary }]}
            onPress={() => startCall('audio')}
          >
            <Ionicons name="call" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.contentContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              }
            />
          )}
          
          {isOtherUserTyping && (
            <View style={styles.typingIndicatorContainer}>
              <Image source={{ uri: otherUserPhotoUrl }} style={styles.typingAvatar} />
              <View style={[styles.typingIndicator, { backgroundColor: colors.card }]}>
                <Text style={[styles.typingText, { color: colors.text }]}>
                  {otherUserUsername} is typing
                </Text>
                <View style={styles.typingDots}>
                  <Text style={[styles.typingDot, { color: colors.text }]}>.</Text>
                  <Text style={[styles.typingDot, { color: colors.text }]}>.</Text>
                  <Text style={[styles.typingDot, { color: colors.text }]}>.</Text>
                </View>
              </View>
            </View>
          )}
          
          {debugInfo ? (
            <View style={styles.debugContainer}>
              <Text style={styles.debugText}>{debugInfo}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.inputContainer, { 
          backgroundColor: colors.card, 
          borderTopColor: colors.border 
        }]}>
          <TouchableOpacity 
            style={styles.mediaButton}
            onPress={() => setShowMediaOptions(!showMediaOptions)}
          >
            <Ionicons name="add-circle" size={28} color={colors.primary} />
          </TouchableOpacity>
          
          {showMediaOptions && (
            <View style={[styles.mediaOptionsContainer, { backgroundColor: colors.card }]}>
              <TouchableOpacity 
                style={styles.mediaOptionButton}
                onPress={() => pickMedia('image')}
              >
                <Ionicons name="image" size={24} color={colors.text} />
                <Text style={[styles.mediaOptionText, { color: colors.text }]}>Image</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.mediaOptionButton}
                onPress={() => pickMedia('video')}
              >
                <Ionicons name="videocam" size={24} color={colors.text} />
                <Text style={[styles.mediaOptionText, { color: colors.text }]}>Video</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {selectedMedia && (
            <View style={styles.mediaPreviewContainer}>
              {selectedMedia.type === 'image' ? (
                <Image 
                  source={{ uri: selectedMedia.uri }} 
                  style={styles.mediaPreview}
                />
              ) : (
                <Video
                  source={{ uri: selectedMedia.uri }}
                  style={styles.mediaPreview}
                  useNativeControls
                  resizeMode="cover"
                  isLooping={false}
                />
              )}
              <TouchableOpacity 
                style={styles.removeMediaButton}
                onPress={() => setSelectedMedia(null)}
              >
                <Ionicons name="close-circle" size={24} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}
          
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.background, 
              color: colors.text,
              borderColor: colors.border
            }]}
            value={newMessage}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
            multiline
          />
          
          <TouchableOpacity 
            style={[styles.sendButton, { backgroundColor: colors.primary }]}
            onPress={sendMessage}
            disabled={isSending || (!newMessage.trim() && !selectedMedia)}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="send" size={20} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete Message</Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              Are you sure you want to delete this message? This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.background }]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.error }]}
                onPress={handleDeleteMessage}
              >
                <Text style={styles.modalButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showVideoCall && callId && (
        <VideoCallScreen
          callId={callId}
          otherUser={{
            id: otherUserId,
            username: otherUserUsername,
            photo_url: otherUserPhotoUrl
          }}
          onClose={() => {
            setShowVideoCall(false);
            setCallId(null);
          }}
        />
      )}

      {showAudioCall && callId && (
        <AudioCallScreen
          callId={callId}
          otherUser={{
            id: otherUserId,
            username: otherUserUsername,
            photo_url: otherUserPhotoUrl
          }}
          onClose={() => {
            setShowAudioCall(false);
            setCallId(null);
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  backButton: {
    marginRight: 10,
  },
  headerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerUserInfo: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusContainer: {
    marginTop: 2,
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    marginLeft: 'auto',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    marginRight: 'auto',
  },
  messageContent: {
    padding: 12,
    borderRadius: 16,
    marginLeft: 8,
  },
  myMessageContent: {
    backgroundColor: '#007AFF',
    borderTopRightRadius: 4,
  },
  otherMessageContent: {
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
  },
  messageTime: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    position: 'relative',
    bottom: 70
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    fontSize: 16,
    borderWidth: 1,
    minHeight: 40,
    maxHeight: 100,
  },
  mediaButton: {
    padding: 8,
    marginRight: 8,
  },
  mediaOptionsContainer: {
    position: 'absolute',
    bottom: 70,
    left: 16,
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 100,
  },
  mediaOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  mediaOptionText: {
    marginLeft: 8,
    fontSize: 16,
  },
  sendButton: {
    borderRadius: 20,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPreviewContainer: {
    position: 'relative',
    marginRight: 8,
  },
  mediaPreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removeMediaButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaContainer: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    maxWidth: '100%',
  },
  mediaContent: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
  },
  typingAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  typingIndicator: {
    padding: 8,
    borderRadius: 16,
    maxWidth: '80%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  typingDots: {
    flexDirection: 'row',
    marginLeft: 2,
  },
  typingDot: {
    fontSize: 16,
    marginHorizontal: 1,
    opacity: 0.7,
  },
  debugContainer: {
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    margin: 10,
    borderRadius: 5,
  },
  debugText: {
    fontSize: 10,
    color: 'red',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  seenIndicator: {
    marginLeft: 4,
  },
  typingIndicator: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 4,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  callButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatComponent;