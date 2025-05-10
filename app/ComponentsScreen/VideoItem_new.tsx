import React, { useEffect, useState, useRef, useCallback } from 'react'; // Import useCallback
import { Ionicons, MaterialCommunityIcons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import Colors from '@/src/constants/color';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { supabase } from '../../supabase.config';
import CommentsSection from './CommentsSection';
import { useTheme } from '@/src/context/ThemeContext';
import { useRouter, useFocusEffect } from 'expo-router'; // Import useFocusEffect
import OtherUserProfile from './OtherUserProfile';
import ShareModal from './ShareComponent';

const { height, width } = Dimensions.get('window');

type VideoItemProps = {
  item: {
    id: string;
    video_url: string;
    type: string;
    caption?: string;
    created_at: string;
    user_id: string;
    user?: {
      username: string;
      fullname: string;
      photo_url: string;
    };
    views?: number;
    thumbnail_url?: string;
  };
  isActive: boolean;
  onLike: () => void; // This prop might become redundant if like logic is fully internal
  onShare: () => void;
};

// Define a type for the authenticated user
type AuthenticatedUser = {
  id: string;
  email?: string;
  // Add other relevant user properties if needed
};


export const VideoItem: React.FC<VideoItemProps> = ({ item, isActive, onLike, onShare }) => {
  const { colors } = useTheme();
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<any>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [likes, setLikes] = useState(item.like_count || 0);
  const [comments, setComments] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [videoUser, setVideoUser] = useState(item.user);
  const [views, setViews] = useState(item.views || 0);
  const [hasIncrementedView, setHasIncrementedView] = useState(false);
  const [playbackStartTime, setPlaybackStartTime] = useState<number | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [isOwnVideo, setIsOwnVideo] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isUserDataLoaded, setIsUserDataLoaded] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const VIEW_THRESHOLD = 3000;
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState('');


  // State to hold the authenticated user
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthenticatedUser | null>(null);


  // Combined loading function for both video and data
  const loadVideoAndData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setIsDataLoaded(false);
      setIsVideoLoaded(false);
      setIsUserDataLoaded(false);

      // Fetch current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      // Store the authenticated user in state
      setAuthenticatedUser(user);

      if (user) setIsOwnVideo(user.id === item.user_id);

      // Run these 3 queries in parallel 🚀
      const [
        { data: userData, error: userError },
        { data: videoData, error: videoError },
        { data: likesData, error: likesError },
      ] = await Promise.all([
        supabase
          .from('users')
          .select('username, fullname, photo_url')
          .eq('id', item.user_id)
          .single(),

        supabase
          .from('videos')
          .select('view_count')
          .eq('id', item.id)
          .single(),

        supabase
          .from('likes')
          .select('id')
          .eq('video_id', item.id),
      ]);

      // Error handling for parallel queries
      if (userError) throw userError;
      if (videoError) throw videoError;
      if (likesError) throw likesError;

      setVideoUser(userData);
      setViews(videoData?.view_count || 0);
      setLikes(likesData?.length || 0);
      setIsUserDataLoaded(true);

      // If user exists, run these additional checks
      if (user) {
        const [
          { data: followData, error: followError },
          { data: likeData, error: likeError },
          { data: favoriteData, error: favoriteError },
        ] = await Promise.all([
          supabase
            .from('follows')
            .select('id')
            .eq('follower_id', user.id)
            .eq('following_id', item.user_id)
            .maybeSingle(),

          supabase
            .from('likes')
            .select('id')
            .eq('video_id', item.id)
            .eq('user_id', user.id)
            .maybeSingle(),

          supabase
            .from('favourites')
            .select('id')
            .eq('video_id', item.id)
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        if (followError && !followError.message.includes('No rows found')) throw followError;
        if (likeError && !likeError.message.includes('No rows found')) throw likeError;
        if (favoriteError && !favoriteError.message.includes('No rows found')) throw favoriteError;

        setIsFollowing(!!followData);
        setIsLiked(!!likeData);
        setIsFavorite(!!favoriteData);
      }

      // Fetch comments count (last, as it's usually lighter)
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('id')
        .eq('video_id', item.id);

      if (commentsError) throw commentsError;
      setComments(commentsData?.length || 0);

      // Load video URL
      const videoUrl = item.video_url.startsWith('http')
        ? item.video_url
        : supabase.storage.from('videos').getPublicUrl(item.video_url).data.publicUrl;

      console.log('VIDEO STATUS: Loading video from URL:', videoUrl);

      setIsVideoLoaded(true);
      setIsDataLoaded(true);
      console.log('VIDEO STATUS: Video and data loaded successfully');

    } catch (error) {
      console.error('Error loading video and data:', error);
      setError('Failed to load video and data');
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    loadVideoAndData();

    return () => {
      if (videoRef.current) {
        videoRef.current.unloadAsync();
      }
    };
  }, [item.id, item.user_id]);

  // Effect to control playback based on isActive prop
  useEffect(() => {
    const playVideo = async () => {
      if (!videoRef.current || !isVideoLoaded) return;

      try {
        if (isActive) {
          await videoRef.current.playAsync();
          setIsPlaying(true);
        } else {
          await videoRef.current.pauseAsync();
          setIsPlaying(false);
        }
      } catch (error) {
        console.error('Error toggling video playback:', error);
      }
    };

    playVideo();
  }, [isActive, isVideoLoaded]);

  // Add useFocusEffect to pause video when screen loses focus
  useFocusEffect(
    useCallback(() => {
      // This function runs when the screen comes into focus
      // The returned function runs when the screen goes out of focus
      return () => {
        if (videoRef.current) {
          console.log('Screen losing focus, pausing video');
          videoRef.current.pauseAsync();
          setIsPlaying(false); // Update local state
          setIsManuallyPaused(false); // Reset manual pause state
        }
      };
    }, []) // Empty dependency array means this effect runs on mount/unmount and focus/blur
  );


  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    setIsPlaying(status.isPlaying);

    // Only increment view count when video starts playing for the first time
    if (status.isPlaying && !hasIncrementedView && isVideoLoaded) {
      console.log('Incrementing view count - Video is playing and loaded');
      incrementViewCount();
    }
  };

  const handleError = (error: any) => {
    console.error('VIDEO ERROR: Video error details:', {
      error,
      videoUrl: item.video_url,
      itemId: item.id
    });
    setError('Failed to load video');
    setIsLoading(false);
  };

  const handleVideoPress = async () => {
    try {
      if (!videoRef.current) {
        console.log('VIDEO STATUS: Video ref not available for playback toggle');
        return;
      }

      console.log('VIDEO STATUS: Toggling playback, current state:', isPlaying ? 'playing' : 'paused');

      if (isPlaying) {
        await videoRef.current.pauseAsync();
        setIsPlaying(false);
        setIsManuallyPaused(true);
        console.log('VIDEO STATUS: Video paused');
      } else {
        await videoRef.current.playAsync();
        setIsPlaying(true);
        setIsManuallyPaused(false);
        console.log('VIDEO STATUS: Video playing');
      }
    } catch (err) {
      console.error('VIDEO ERROR: Error toggling playback:', err);
      // Don't let playback errors affect the UI
    }
  };

  // Modified handleLike to use the authenticatedUser from state
  const handleLike = async () => {
    // Skip everything if already loading
    if (isLikeLoading) return;

    // Use the authenticatedUser from state
    if (!authenticatedUser || !authenticatedUser.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    const previousLikes = likes;
    const previousIsLiked = isLiked;

    // Optimistic UI update
    const newLikes = isLiked ? likes - 1 : likes + 1;
    setLikes(newLikes);
    setIsLiked(!isLiked);
    setIsLikeLoading(true);

    try {
      // Run like/unlike operation using the authenticated user's ID
      const likeOp = isLiked
        ? supabase.from('likes').delete().eq('video_id', item.id).eq('user_id', authenticatedUser.id)
        : supabase.from('likes').insert([{ video_id: item.id, user_id: authenticatedUser.id }]);

      const { error } = await likeOp;
      if (error) throw error;

    } catch (err) {
      // Rollback optimistic update if anything fails
      setLikes(previousLikes);
      setIsLiked(previousIsLiked);
      console.error('Error toggling like:', err);
      Alert.alert('Error', err.message || 'Failed to update like status');
    } finally {
      setIsLikeLoading(false);
    }
  };


  const handleFavorite = async () => {
    try {
      // Use the authenticatedUser from state
      if (!authenticatedUser || !authenticatedUser.id) {
        Alert.alert('Error', 'You must be logged in to favorite videos');
        return;
      }

      if (isFavorite) {
        // Remove from favorites
        const { error } = await supabase
          .from('favourites')
          .delete()
          .eq('video_id', item.id)
          .eq('user_id', authenticatedUser.id);

        if (error) throw error;
        setIsFavorite(false);
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('favourites')
          .insert([{ video_id: item.id, user_id: authenticatedUser.id }]);

        if (error) throw error;
        setIsFavorite(true);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  const handleCommentPress = () => {
    setShowComments(true);
  };

  const handleCommentsClose = async () => {
    setShowComments(false);
    // Refresh comment count when closing comments
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('id')
        .eq('video_id', item.id);

      if (commentsError) throw commentsError;
      setComments(commentsData?.length || 0);
    } catch (err) {
      console.error('Error fetching updated comment count:', err);
    }
  };

  const handleFollow = async () => {
    try {
      setIsLoading(true);

      if (!authenticatedUser || !authenticatedUser.id) {
        throw new Error('User not authenticated');
      }

      // Use correct table name (usually it's 'follows', not 'followers')
      const tableName = 'followers';

      if (isFollowing) {
        // Unfollow - Delete only if exists, Supabase handles this gracefully
        const { error: unfollowError } = await supabase
          .from(tableName)
          .delete()
          .eq('follower_id', authenticatedUser.id)
          .eq('following_id', item.user_id);

        if (unfollowError) {
          console.warn('Unfollow error (may be okay if row doesn’t exist):', unfollowError.message);
        }

        setIsFollowing(false);
      } else {
        // Follow - Insert if not already existing
        const { data: existingFollow, error: checkError } = await supabase
          .from(tableName)
          .select('id')
          .eq('follower_id', authenticatedUser.id)
          .eq('following_id', item.user_id)
          .maybeSingle();

        if (checkError) throw checkError;

        if (!existingFollow) {
          const { error: followError } = await supabase
            .from(tableName)
            .insert([
              {
                follower_id: authenticatedUser.id,
                following_id: item.user_id,
              }
            ]);

          if (followError) throw followError;
        }

        setIsFollowing(true);
      }

    } catch (error) {
      console.error('Error toggling follow status:', error);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setIsLoading(false);
    }
  };


  const navigateToProfile = async () => {
    try {
      // Use the authenticatedUser from state
      if (authenticatedUser && authenticatedUser.id === item.user_id) {
        // If the video belongs to the authenticated user, navigate to UserProfileScreen
        router.push('/HomeScreen/(tabs)/UserProfileScreen');
      } else {
        // If it's another user's video, show the OtherUserProfile modal
        setShowUserProfile(true);
      }
    } catch (error) {
      console.error('Error checking user authentication:', error);
      Alert.alert('Error', 'Failed to navigate to profile');
    }
  };

  const handleBackFromProfile = () => {
    setShowUserProfile(false);
  };

  const incrementViewCount = async () => {
    if (hasIncrementedView) {
      console.log('View already incremented, skipping');
      return;
    }

    if (!item || !item.id) {
      console.log('No video item to track views');
      return;
    }

    if (!authenticatedUser || !authenticatedUser.id) {
      console.log('No authenticated user, skipping view count increment');
      return;
    }

    try {
      const { data: existingViews, error: checkError } = await supabase
        .from('video_views')
        .select('id')
        .eq('video_id', item.id)
        .eq('user_id', authenticatedUser.id);

      if (checkError) {
        console.error('Error checking existing view:', checkError);
        return;
      }

      if (existingViews && existingViews.length > 0) {
        console.log('View already exists, skipping increment');
        setHasIncrementedView(true);
        return;
      }

      setHasIncrementedView(true); // Set early to prevent race conditions

      const { error: insertError } = await supabase
        .from('video_views')
        .insert([
          {
            video_id: item.id,
            user_id: authenticatedUser.id,
            created_at: new Date().toISOString()
          }
        ]);

      if (insertError) {
        console.error('Error creating view record:', insertError);
        return;
      }

      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('view_count')
        .eq('id', item.id)
        .single();

      if (videoError) {
        console.error('Error fetching updated view count:', videoError);
        return;
      }

      console.log('View count updated successfully:', videoData?.view_count);
      setViews(videoData?.view_count || 0);
    } catch (error) {
      console.error('Error in incrementViewCount:', error);
    }
  };

  // Reset view tracking when video changes
  useEffect(() => {
    setHasIncrementedView(false);
  }, [item.id]);

  // Handle video loading state
  const handleVideoLoad = () => {
    console.log('Video loaded successfully');
    setIsVideoLoaded(true);
  };

  const handleVideoLoadStart = () => {
    console.log('Video loading started');
    setIsVideoLoaded(false);
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          onPress={() => {
            setError(null);
            setIsLoading(true);
            loadVideoAndData();
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors?.primary || Colors.primary} />
          <Text style={[styles.loadingText, { color: colors?.text || '#FFFFFF' }]}>
            Loading video and data...
          </Text>
        </View>
      )}

      {!isLoading && error && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors?.text || '#FFFFFF' }]}>{error}</Text>
          <TouchableOpacity
            onPress={loadVideoAndData}
            style={styles.retryButton}
          >
            <Text style={[styles.retryText, { color: colors?.primary || Colors.primary }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !error && (
        <>
          <TouchableOpacity
            style={styles.videoContainer}
            onPress={handleVideoPress}
            activeOpacity={1}
          >
            <Video
              ref={videoRef}
              style={styles.video}
              source={{
                uri: item.video_url.startsWith('http')
                  ? item.video_url
                  : `${supabase.storage.from('videos').getPublicUrl(item.video_url).data.publicUrl}`
              }}
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay={isActive && !isManuallyPaused}
              useNativeControls={false}
              isMuted={false}
              volume={1.0}
              rate={1.0}
              progressUpdateIntervalMillis={100}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              onError={handleError}
              onLoad={handleVideoLoad}
              onLoadStart={handleVideoLoadStart}
            />
          </TouchableOpacity>

          <View style={styles.overlay}>
            {/* Left Side - User Info and Description */}
            <View style={styles.leftSide}>
              {/* User Info Section */}
              <TouchableOpacity
                onPress={navigateToProfile}
                style={styles.userInfo}
                activeOpacity={0.7}
              >
                <Image
                  source={
                    videoUser?.photo_url
                      ? { uri: videoUser.photo_url }
                      : require('../../src/assets/images/login.png')
                  }
                  style={styles.profilePic}
                />
                <View style={styles.userTextContainer}>
                  <Text style={styles.username}>@{videoUser?.username || 'username'}</Text>
                  <Text style={styles.fullname}>{videoUser?.fullname || 'User'}</Text>
                </View>
              </TouchableOpacity>

              {/* Follow Button - Only show if not own video */}
              {!isOwnVideo && (
                <TouchableOpacity
                  style={[
                    styles.followButton,
                    isFollowing && styles.followingButton
                  ]}
                  onPress={handleFollow}
                >
                  <Text style={[
                    styles.followButtonText,
                    isFollowing && styles.followingButtonText
                  ]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Description Section */}
              <View style={styles.descriptionContainer}>
                <Text style={styles.caption}>{item.caption || ''}</Text>
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons name="eye" size={20} color="#FFFFFF" />
                    <Text style={styles.statText}>{views}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Right Side - Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleLike} // Call handleLike without passing user, it uses
                disabled={isLikeLoading}
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={28}
                  color={isLiked ? Colors.primary : colors.text}
                />
                {isLikeLoading ? (
                  <ActivityIndicator size="small" color={colors.text} style={styles.actionLoader} />
                ) : (
                  <Text style={[styles.actionText, { color: colors.text }]}>{likes}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCommentPress}
              >
                <MaterialCommunityIcons
                  name="comment-outline"
                  size={32}
                  color="#FFFFFF"
                />
                <Text style={styles.actionText}>{comments}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setSelectedVideoUrl(item.video_url);  // or however you're storing video links
                  setModalVisible(true);
                }}
              >
                <MaterialCommunityIcons
                  name="share-variant"
                  size={32}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleFavorite}
              >
                <MaterialCommunityIcons
                  name={isFavorite ? "bookmark" : "bookmark-outline"}
                  size={32}
                  color={isFavorite ? "#FFD700" : "#FFFFFF"}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* User Profile Modal */}
          <Modal
            visible={showUserProfile}
            animationType="slide"
            transparent={true}
            onRequestClose={handleBackFromProfile}
          >
            <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
              <View style={[styles.modalContainer, {
                backgroundColor: colors?.background || '#000000',
                height: '100%',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
              }]}>
                <OtherUserProfile userId={item.user_id} onBack={handleBackFromProfile} />
              </View>
            </View>
          </Modal>

          {/* Comments Modal */}
          <Modal
            visible={showComments}
            animationType="slide"
            transparent={true}
            onRequestClose={handleCommentsClose}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContainer, {
                backgroundColor: colors?.background || '#000000',
                height: height * 0.5,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
              }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors?.text || '#FFFFFF' }]}>Comments</Text>
                  <TouchableOpacity onPress={handleCommentsClose}>
                    <MaterialIcons name="close" size={24} color={colors?.text || '#FFFFFF'} />
                  </TouchableOpacity>
                </View>
                <CommentsSection
                  videoId={item.id}
                  onClose={handleCommentsClose}
                />
              </View>
            </View>
          </Modal>
        </>
      )}

      <ShareModal
        visible={isModalVisible}
        onClose={() => setModalVisible(false)}
        videoUrl={selectedVideoUrl}
        friends={["1","Noshad", "https://example.com/avatar1.jpg"]}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width,
    height: height * 0.9, // Reduced height to prevent overriding
    backgroundColor: '#000000',
    position: 'relative',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 2,
  },
  leftSide: {
    flex: 1,
    marginRight: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  userTextContainer: {
    marginLeft: 10,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fullname: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.8,
  },
  followButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  followingButtonText: {
    color: Colors.primary,
  },
  descriptionContainer: {
    marginTop: 15,
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  statText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 5,
  },
  actionButtons: {
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  retryButton: {
    padding: 10,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionLoader: {
    marginTop: 4,
  },
});

export default VideoItem;
