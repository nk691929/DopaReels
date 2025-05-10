import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { supabase } from '../../supabase.config';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type User = {
  id: string;
  username: string;
  fullname: string;
  photo_url: string;
  is_following?: boolean;
};

type FollowListComponentProps = {
  type: 'followers' | 'following';
  userId: string;
  onClose: () => void;
};

const FollowListComponent = ({ type, userId, onClose }: FollowListComponentProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { colors } = useTheme();

  useEffect(() => {
    if (!userId) {
      setError('User ID is required');
      setLoading(false);
      return;
    }
    fetchUsers();
  }, [userId, type]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      let query;
      if (type === 'followers') {
        query = supabase
          .from('follows')
          .select(`
            follower:follower_id (
              id,
              username,
              fullname,
              photo_url
            )
          `)
          .eq('following_id', userId);
      } else {
        query = supabase
          .from('followers')
          .select(`
            following:following_id (
              id,
              username,
              fullname,
              photo_url
            )
          `)
          .eq('follower_id', userId);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw new Error(`Database query failed: ${queryError.message}`);
      }

      if (!data) {
        throw new Error('No data received from the server');
      }

      const userList = data.map(item => {
        const user = type === 'followers' ? item.follower : item.following;
        if (!user) {
          throw new Error('Invalid user data received');
        }
        return {
          id: user.id,
          username: user.username,
          fullname: user.fullname,
          photo_url: user.photo_url,
        };
      });

      // Check if current user is following each user
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }

      if (currentUser) {
        const { data: followingData, error: followingError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUser.id);

        if (followingError) {
          throw new Error(`Failed to fetch following status: ${followingError.message}`);
        }

        const followingIds = new Set(followingData?.map(f => f.following_id) || []);
        
        const usersWithFollowingStatus = userList.map(user => ({
          ...user,
          is_following: followingIds.has(user.id),
        }));

        setUsers(usersWithFollowingStatus);
      } else {
        setUsers(userList);
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      const errorMessage = err.message || 'Failed to load users. Please try again.';
      setError(errorMessage);
      
      // If it's a network error, show a more specific message
      if (err.message?.includes('network') || err.message?.includes('timeout')) {
        setError('Network connection error. Please check your internet connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (targetUserId: string) => {
    try {
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }
      
      if (!currentUser) {
        Alert.alert(
          'Authentication Required',
          'Please sign in to follow users.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign In', onPress: () => router.push('/Auth/LoginScreen') }
          ]
        );
        return;
      }

      const { data: existingFollow, error: followCheckError } = await supabase
        .from('follows')
        .select()
        .eq('follower_id', currentUser.id)
        .eq('following_id', targetUserId)
        .single();

      if (followCheckError && !followCheckError.message.includes('No rows found')) {
        throw new Error(`Failed to check follow status: ${followCheckError.message}`);
      }

      if (existingFollow) {
        // Unfollow
        const { error: unfollowError } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', targetUserId);

        if (unfollowError) {
          throw new Error(`Failed to unfollow: ${unfollowError.message}`);
        }
      } else {
        // Follow
        const { error: followError } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUser.id,
            following_id: targetUserId,
          });

        if (followError) {
          throw new Error(`Failed to follow: ${followError.message}`);
        }
      }

      // Update local state
      setUsers(users.map(user => 
        user.id === targetUserId 
          ? { ...user, is_following: !user.is_following }
          : user
      ));
    } catch (err: any) {
      console.error('Error updating follow status:', err);
      Alert.alert(
        'Error',
        err.message || 'Failed to update follow status. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleUserPress = (userId: string) => {
    if (!userId) {
      Alert.alert('Error', 'Invalid user ID');
      return;
    }
    onClose();
    router.push(`/user/${userId}`);
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    fetchUsers();
  };

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity 
      style={[styles.userItem, { borderBottomColor: colors.border }]}
      onPress={() => handleUserPress(item.id)}
    >
      <Image
        source={{ uri: item.photo_url || 'https://via.placeholder.com/150' }}
        style={styles.avatar}
        onError={() => {
          // Handle image loading error silently
          console.log('Failed to load user avatar');
        }}
      />
      <View style={styles.userInfo}>
        <Text style={[styles.username, { color: colors.text }]}>{item.username}</Text>
        <Text style={[styles.fullName, { color: colors.textSecondary }]}>{item.fullname}</Text>
      </View>
      {item.id !== userId && (
        <TouchableOpacity
          style={[
            styles.followButton,
            { backgroundColor: item.is_following ? 'transparent' : colors.primary }
          ]}
          onPress={() => handleFollow(item.id)}
        >
          <Text style={[
            styles.followButtonText,
            { color: item.is_following ? colors.text : colors.white }
          ]}>
            {item.is_following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={50} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            {retryCount > 0 ? `Attempt ${retryCount} of 3` : ''}
          </Text>
          {retryCount < 3 && (
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={handleRetry}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.closeButton, { borderColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.closeButtonText, { color: colors.text }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={50} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No {type} yet
            </Text>
          </View>
        }
        onRefresh={fetchUsers}
        refreshing={loading}
        contentContainerStyle={users.length === 0 ? styles.emptyListContainer : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userInfo: {
    marginLeft: 15,
    flex: 1,
  },
  username: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  fullName: {
    fontSize: 14,
    opacity: 0.7,
  },
  followButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#0095F6',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FollowListComponent; 