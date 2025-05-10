import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  FlatList,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../supabase.config';
import CommentsSection from './CommentsSection';
import { useTheme } from '@/src/context/ThemeContext';
import { useRouter } from 'expo-router';

const { height, width } = Dimensions.get('window');
const ITEMS_PER_PAGE = 5;

type UserVideoListProps = {
  userId: string;
  onBack?: () => void;
  initialIndex?: number;
  videoType?: 'shorts' | 'stories' | 'favorites';
};

type VideoItem = {
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

// Separate component for rendering individual video items
const VideoItemComponent: React.FC<{
  item: VideoItem;
  isActive: boolean;
  // onLike: (videoId: string) => void;
  onCommentPress: (video: VideoItem) => void;
  onFollow: () => void;
  onFavorite: () => void;
  isFollowing: boolean;
  isFavorite: boolean;
  isOwnVideo: boolean;
}> = ({ 
  item, 
  isActive, 
  // onLike, 
  onCommentPress,
  onFollow,
  onFavorite,
  isFollowing,
  isFavorite,
  isOwnVideo
}) => {
  const { colors } = useTheme();
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isLiked, setIsLiked] = useState(true);
  const [like, setLikes] = useState(0);

  useEffect(() => {
    if (isActive && !isManuallyPaused) {
      videoRef.current?.playAsync();
      setIsPlaying(true);
    } else {
      videoRef.current?.pauseAsync();
      setIsPlaying(false);
    }
  }, [isActive, isManuallyPaused]);

  
  useEffect(()=>{
    setLikes(item.likes || 0);
  },[like])

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
  };

  const handleVideoPress = async () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      await videoRef.current.pauseAsync();
      setIsPlaying(false);
      setIsManuallyPaused(true);
    } else {
      await videoRef.current.playAsync();
      setIsPlaying(true);
      setIsManuallyPaused(false);
    }
  };

  const handleLike = async (videoId: string) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;
  
      // Check if the like already exists
      const { data: existingLike, error: checkError } = await supabase
        .from('likes')
        .select('id')
        .eq('video_id', videoId)
        .eq('user_id', user.id)
        .maybeSingle();
  
      if (checkError) throw checkError;
  
      if (existingLike) {
        // Dislike: remove the like
        const { error: deleteError } = await supabase
          .from('likes')
          .delete()
          .eq('id', existingLike.id);
  
        if (deleteError) throw deleteError;
  
        setIsLiked(false);              // ✅ Update liked state
        setLikes(prev => Math.max(prev - 1, 0)); // ✅ Decrease likes count
      } else {
        // Like: add a new like
        const { error: likeError } = await supabase
          .from('likes')
          .insert([{ video_id: videoId, user_id: user.id }]);
  
        if (likeError) throw likeError;
  
        setIsLiked(true);              // ✅ Update liked state
        setLikes(prev => prev + 1);    // ✅ Increase likes count
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };
  

  return (
    <View style={[styles.videoItem, { backgroundColor: colors.background }]}>
      <TouchableOpacity 
        style={styles.videoContainer}
        onPress={handleVideoPress}
        activeOpacity={1}
      >
        <Video
          ref={videoRef}
          style={styles.video}
          source={{ uri: item.video_url.startsWith('http') 
            ? item.video_url 
            : `${supabase.storage.from('videos').getPublicUrl(item.video_url).data.publicUrl}` }}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={isActive && !isManuallyPaused}
          useNativeControls={false}
          isMuted={false}
          volume={1.0}
          rate={1.0}
          progressUpdateIntervalMillis={100}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onLoad={() => setIsVideoLoaded(true)}
          onLoadStart={() => setIsVideoLoaded(false)}
        />
      </TouchableOpacity>

      <View style={styles.overlay}>
        <View style={styles.leftSide}>
          <View style={styles.userInfo}>
            <Image
              source={
                item.user?.photo_url
                  ? { uri: item.user.photo_url }
                  : require('../../src/assets/images/login.png')
              }
              style={styles.profilePic}
            />
            <View style={styles.userTextContainer}>
              <Text style={styles.username}>@{item.user?.username || 'username'}</Text>
              <Text style={styles.fullname}>{item.user?.fullname || 'User'}</Text>
            </View>
          </View>
          
          {/* Follow Button - Only show if not own video */}
          {!isOwnVideo && (
            <TouchableOpacity 
              style={[
                styles.followButton,
                isFollowing && styles.followingButton
              ]}
              onPress={onFollow}
            >
              <Text style={[
                styles.followButtonText,
                isFollowing && styles.followingButtonText
              ]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.descriptionContainer}>
            <Text style={styles.caption}>{item.caption || ''}</Text>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="eye" size={20} color="#FFFFFF" />
                <Text style={styles.statText}>{item.views || 0}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleLike(item.id)}
          >
             <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={28}
                  color={isLiked ? Colors.primary : colors.text}
                />
            <Text style={[styles.actionText, { color: colors.text }]}>{like || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => onCommentPress(item)}
          >
            <MaterialCommunityIcons 
              name="comment-outline" 
              size={32} 
              color="#FFFFFF" 
            />
            <Text style={styles.actionText}>{item.comments || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={onFavorite}
          >
            <MaterialCommunityIcons
              name={isFavorite ? "bookmark" : "bookmark-outline"}
              size={32}
              color={isFavorite ? "#FFD700" : "#FFFFFF"}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export const UserVideoList: React.FC<UserVideoListProps> = ({ 
  userId, 
  onBack, 
  initialIndex = 0,
  videoType = 'shorts'
}) => {
  const { colors } = useTheme();
  const router = useRouter();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [showComments, setShowComments] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isOwnVideo, setIsOwnVideo] = useState(false);
  const [favoriteStatus, setFavoriteStatus] = useState<Record<string, boolean>>({});
  const flatListRef = useRef<FlatList>(null);
  const [isLiked, setIsLiked] = useState(true);

  const fetchUserVideos = async (page = 0, isInitialLoad = false) => {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (isInitialLoad) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      let query = supabase
        .from('videos')
        .select(`
          *,
          user:users(*),
          likes:likes(count),
          comments:comments(count),
          video_views:video_views(count)
        `)
        .eq('user_id', userId);

      // Apply type filter
      if (videoType === 'shorts') {
        query = query.eq('type', 'short');
      } else if (videoType === 'stories') {
        query = query.eq('type', 'story');
      } else if (videoType === 'favorites') {
        const { data: favorites, error: favoritesError } = await supabase
          .from('favourites')
          .select('video_id')
          .eq('user_id', userId);

        if (favoritesError) throw favoritesError;

        const videoIds = favorites?.map(fav => fav.video_id) || [];
        if (videoIds.length > 0) {
          query = query.in('id', videoIds);
        } else {
          // If no favorites, return empty array
          setVideos([]);
          setHasMore(false);
          return;
        }
      }

      // Apply pagination
      const { data: videosData, error: videosError } = await query
        .order('created_at', { ascending: false })
        .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

      if (videosError) throw videosError;

      const formattedVideos = videosData?.map(video => ({
        ...video,
        views: video.video_views[0]?.count || 0,
        likes: video.likes[0]?.count || 0,
        comments: video.comments[0]?.count || 0,
      })) || [];

      if (isInitialLoad) {
        setVideos(formattedVideos);
      } else {
        setVideos(prev => [...prev, ...formattedVideos]);
      }

      setHasMore(formattedVideos.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching user videos:', error);
      setError(error instanceof Error ? error.message : 'Failed to load videos');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const checkFollowStatus = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      if (user) {
        setIsOwnVideo(user.id === userId);

        if (!isOwnVideo) {
          const { data: followData, error: followError } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', user.id)
            .eq('following_id', userId)
            .maybeSingle();

          if (!followError) {
            setIsFollowing(!!followData);
          }
        }
      }
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const checkFavoriteStatus = async (videoIds: string[]) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      const { data: favorites, error: favoritesError } = await supabase
        .from('favourites')
        .select('video_id')
        .eq('user_id', user.id)
        .in('video_id', videoIds);

      if (favoritesError) throw favoritesError;

      const favoriteMap = favorites?.reduce((acc, fav) => {
        acc[fav.video_id] = true;
        return acc;
      }, {} as Record<string, boolean>);

      setFavoriteStatus(favoriteMap || {});
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

  const handleFollow = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        Alert.alert('Error', 'You must be logged in to follow users');
        return;
      }

      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);

        if (error) throw error;
        setIsFollowing(false);
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert([
            { follower_id: user.id, following_id: userId }
          ]);

        if (error) throw error;
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error toggling follow status:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const handleFavorite = async (videoId: string) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        Alert.alert('Error', 'You must be logged in to favorite videos');
        return;
      }

      const isCurrentlyFavorite = favoriteStatus[videoId];

      if (isCurrentlyFavorite) {
        // Remove from favorites
        const { error } = await supabase
          .from('favourites')
          .delete()
          .eq('video_id', videoId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('favourites')
          .insert([{ video_id: videoId, user_id: user.id }]);

        if (error) throw error;
      }

      setFavoriteStatus(prev => ({
        ...prev,
        [videoId]: !isCurrentlyFavorite
      }));
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  useEffect(() => {
    fetchUserVideos(0, true);
  }, [userId, videoType]);

  useEffect(() => {
    checkFollowStatus();
  }, [userId]);

  useEffect(() => {
    if (videos.length > 0) {
      checkFavoriteStatus(videos.map(video => video.id));
    }
  }, [videos]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchUserVideos(0, true);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      const nextPage = Math.floor(videos.length / ITEMS_PER_PAGE);
      fetchUserVideos(nextPage);
    }
  };

  const handleViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== activeIndex) {
      setActiveIndex(newIndex);

        // Pause all videos except the active one
        videos.forEach((video, index) => {
          if (index !== newIndex) {
            const videoRef = videoRefs.current[index];
            if (videoRef) {
              videoRef.pauseAsync();
            }
          }
        });
      }
    }
  }, [activeIndex, videos]);

  // Add refs for all videos
  const videoRefs = useRef<{ [key: number]: Video | null }>({});

  // Update video refs when videos change
  useEffect(() => {
    videoRefs.current = {};
  }, [videos]);

  // Scroll to initial index when videos are loaded
  useEffect(() => {
    if (videos.length > 0 && initialIndex > 0) {
      flatListRef.current?.scrollToIndex({
        index: initialIndex,
        animated: false,
      });
    }
  }, [videos.length, initialIndex]);

  // handl likes 
  // const handleLike = async (videoId: string) => {
  //   try {
  //     const { data: { user }, error: authError } = await supabase.auth.getUser();
  //     if (authError || !user) return;
  
  //     // Check if the like already exists
  //     const { data: existingLike, error: checkError } = await supabase
  //       .from('likes')
  //       .select('id')
  //       .eq('video_id', videoId)
  //       .eq('user_id', user.id)
  //       .maybeSingle();

  //       console.log('existingLike', existingLike);
  
  //     if (checkError) throw checkError;
  
  //     if (existingLike) {
  //       // Dislike: remove the like
  //       const { error: deleteError } = await supabase
  //         .from('likes')
  //         .delete()
  //         .eq('id', existingLike.id);
  
  //       if (deleteError) throw deleteError;
  
  //       setVideos(prevVideos =>
  //         prevVideos.map(video =>
  //           video.id === videoId
  //             ? {
  //                 ...video,
  //                 likes: Math.max((video.likes || 1) - 1, 0),
  //                 // setIsLiked(false)
  //               }
  //             : video
  //         )
  //       );
  //     } else {
  //       // Like: add a new like
  //       const { error: likeError } = await supabase
  //         .from('likes')
  //         .insert([{ video_id: videoId, user_id: user.id }]);
  
  //       if (likeError) throw likeError;
  
  //       setVideos(prevVideos =>
  //         prevVideos.map(video =>
  //           video.id === videoId
  //             ? {
  //                 ...video,
  //                 likes: (video.likes || 0) + 1,
  //                 // setIsLiked(true)
  //               }
  //             : video
  //         )
  //       );
  //     }
  //   } catch (error) {
  //     console.error('Error toggling like:', error);
  //   }
  // };
  
  
  const handleCommentPress = (video: VideoItem) => {
    setSelectedVideo(video);
    setShowComments(true);
  };

  const handleCommentsClose = () => {
    setShowComments(false);
    setSelectedVideo(null);
  };

  const renderVideoItem = ({ item, index }: { item: VideoItem; index: number }) => {
    const isActive = index === activeIndex;
    
    return (
    <VideoItemComponent
        key={`${item.id}-${item.type}-${item.user_id}-${item.created_at}-${index}`}
      item={item}
        isActive={isActive}
        // onLike={() => handleLike(item.id)}
        onCommentPress={() => handleCommentPress(item)}
        onFollow={handleFollow}
        onFavorite={() => handleFavorite(item.id)}
        isFollowing={isFollowing}
        isFavorite={favoriteStatus[item.id] || false}
        isOwnVideo={isOwnVideo}
    />
  );
  };

  if (isLoading && videos.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isLoading && videos.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={videos}
          renderItem={renderVideoItem}
          keyExtractor={(item, index) => `${item.id}-${item.type}-${item.user_id}-${item.created_at}-${index}`}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={{
            itemVisiblePercentThreshold: 50,
            minimumViewTime: 100,
          }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={3}
          getItemLayout={(data, index) => ({
            length: height * 0.9,
            offset: height * 0.9 * index,
            index,
          })}
          initialScrollIndex={initialIndex}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            // Fallback to manual scrolling if automatic scroll fails
            flatListRef.current?.scrollToOffset({
              offset: index * averageItemLength,
              animated: true,
            });
          }}
          snapToInterval={height * 0.9}
          snapToAlignment="start"
          decelerationRate="normal"
          disableIntervalMomentum={true}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.text }]}>
                No {videoType} available
              </Text>
              <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
                <Text style={styles.refreshText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {showComments && selectedVideo && (
        <Modal
          visible={showComments}
          animationType="slide"
          transparent={true}
          onRequestClose={handleCommentsClose}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Comments</Text>
                <TouchableOpacity onPress={handleCommentsClose}>
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <CommentsSection
                videoId={selectedVideo.id}
                onClose={handleCommentsClose}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: width,
    height: height,
  },
  videoItem: {
    width: width,
    height: height * 0.9,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 20,
  },
  refreshButton: {
    padding: 10,
    backgroundColor: Colors.primary,
    borderRadius: 5,
  },
  refreshText: {
    color: 'white',
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    height: height * 0.5,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  loadingMoreContainer: {
    padding: 20,
    alignItems: 'center',
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
});

export default UserVideoList; 