import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { supabase } from '../../supabase.config';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ChatComponent from './ChatComponent';
import { Video } from 'expo-av';

const { width } = Dimensions.get('window');

interface OtherUserProfileProps {
  userId: string;
  onBack: () => void;
}

const OtherUserProfile: React.FC<OtherUserProfileProps> = ({ userId, onBack }) => {
  const { colors } = useTheme();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [videos, setVideos] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProfileDataLoaded, setIsProfileDataLoaded] = useState(false);
  const [isVideosLoaded, setIsVideosLoaded] = useState(false);

  // Ref to store the current authenticated user's ID
  const currentUserIdRef = useRef<string | null>(null);

  // Function to fetch the current authenticated user ID once
  const fetchCurrentUserId = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      currentUserIdRef.current = user?.id || null;
    } catch (error) {
      console.error('Error fetching current user ID:', error);
      currentUserIdRef.current = null; // Ensure it's null on error
    }
  };

  // Combined function to fetch all necessary data
  const fetchAllData = async () => {
    try {
      // Ensure current user ID is fetched before proceeding
      if (currentUserIdRef.current === undefined) { // Check if it hasn't been fetched yet
         await fetchCurrentUserId();
      }

      const [
        { data: userData, error: userError },
        { count: followersCount, error: followersError },
        { count: followingCount, error: followingError },
        { data: videosData, error: videosError },
      ] = await Promise.all([
        // Fetch target user profile
        supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single(),

        // Fetch followers count for target user
        supabase
          .from('follows')
          .select('*', { count: 'exact' })
          .eq('following_id', userId),

        // Fetch following count for target user
        supabase
          .from('follows')
          .select('*', { count: 'exact' })
          .eq('follower_id', userId),

        // Fetch videos for target user
        supabase
          .from('videos')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(12), // Limit initial load to 12 videos
      ]);

      // Handle errors from parallel fetches
      if (userError) throw userError;
      if (followersError) console.error('Followers count error:', followersError);
      if (followingError) console.error('Following count error:', followingError);
      if (videosError) console.error('Videos fetch error:', videosError);

      if (!userData) throw new Error('User not found');

      setUser(userData);
      setFollowersCount(followersCount || 0);
      setFollowingCount(followingCount || 0);
      setVideos(videosData || []);

      // Check follow status if we have a current user ID
      if (currentUserIdRef.current) {
        const { data: followData, error: followError } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', currentUserIdRef.current)
          .eq('following_id', userId)
          .maybeSingle();

        if (!followError) {
          setIsFollowing(!!followData);
        } else {
           console.error('Error checking follow status:', followError);
        }
      }

      setIsProfileDataLoaded(true);
      setIsVideosLoaded(true);

    } catch (error) {
      console.error('Error fetching all data:', error);
      setError('Failed to load profile data');
    }
  };

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      setIsProfileDataLoaded(false);
      setIsVideosLoaded(false);

      try {
        // Fetch current user ID and all other data in parallel
        await Promise.all([
           fetchCurrentUserId(), // Fetch current user ID concurrently
           fetchAllData() // fetchAllData will wait for currentUserIdRef to be set if not already
        ]);

      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]); // Depend on userId

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    setIsProfileDataLoaded(false);
    setIsVideosLoaded(false);

    try {
      // Re-fetch all data including current user ID on refresh
      await Promise.all([
         fetchCurrentUserId(),
         fetchAllData()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleFollow = async () => {
    try {
      // Use the current user ID stored in the ref
      const currentUserId = currentUserIdRef.current;
      if (!currentUserId) {
         Alert.alert('Error', 'You must be logged in to follow users.');
         return;
      }

      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', userId);

        if (error) throw error;
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1);
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert([
            { follower_id: currentUserId, following_id: userId }
          ]);

        if (error) throw error;
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const handleChatWithUser = () => {
    if (!user) return;

    router.push({
      pathname: './ChatComponent',
      params: {
        userId: user.id,
        username: user.username,
        photoUrl: user.photo_url
      }
    });
  };

  if (loading && !isProfileDataLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading profile...
          </Text>
        </View>
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={handleRefresh}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <TouchableOpacity
          style={[styles.chatButton, { backgroundColor: colors.primary }]}
          onPress={handleChatWithUser}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <Image
            source={{ uri: user.photo_url }}
            style={styles.profileImage}
            defaultSource={require('../../src/assets/images/person.png')}
          />
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.text }]}>{videos.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Shorts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.text }]}>{followersCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.text }]}>{followingCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Following</Text>
            </View>
          </View>
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={[styles.username, { color: colors.text }]}>{user.username}</Text>
          <Text style={[styles.fullName, { color: colors.textSecondary }]}>{user.fullname}</Text>
          {user.bio && (
            <Text style={[styles.bio, { color: colors.text }]}>{user.bio}</Text>
          )}
          <TouchableOpacity
            style={[
              styles.followButton,
              {
                backgroundColor: isFollowing ? colors.background : colors.primary,
                borderColor: colors.primary,
              },
            ]}
            onPress={handleFollow}
          >
            <Text
              style={[
                styles.followButtonText,
                { color: isFollowing ? colors.primary : '#FFFFFF' },
              ]}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Videos Grid */}
        {isVideosLoaded && (
        <View style={styles.videosGrid}>
          {videos.map((video) => (
            <TouchableOpacity
              key={video.id}
              style={styles.videoItem}
              onPress={() => router.push({
                  pathname: '/HomeScreen/VideoViewScreen',
                  params: {
                    userId: userId,
                    videoType: 'shorts',
                    initialIndex: videos.findIndex(v => v.id === video.id)
                  }
              })}
            >
              <View style={styles.videoThumbnailContainer}>
                <Image
                  source={{
                    uri: video.thumbnail_url || 'https://via.placeholder.com/150',
                      cache: 'force-cache'
                  }}
                  style={styles.videoThumbnail}
                  defaultSource={require('../../src/assets/images/person.png')}
                />
                <View style={styles.videoOverlay}>
                  <MaterialCommunityIcons name="play-circle" size={24} color="#FFFFFF" />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  chatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    padding: 16,
    alignItems: 'center',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
  },
  userInfo: {
    padding: 16,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  fullName: {
    fontSize: 14,
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    marginBottom: 16,
  },
  followButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  videosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 2,
  },
  videoItem: {
    width: (width - 24) / 3,
    aspectRatio: 9/16,
    padding: 2,
  },
  videoThumbnailContainer: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
});

export default OtherUserProfile;
