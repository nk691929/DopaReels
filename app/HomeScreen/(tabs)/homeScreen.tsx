import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../src/constants/color';
import { Tabs } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { VideoItem } from '../../ComponentsScreen/VideoItem_new';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Alert,
  Text,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../../supabase.config';
const { height, width } = Dimensions.get('window');

const HomeScreen = () => {
  const router = useRouter();
  const [shorts, setShorts] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 100,
  }).current;

  const fetchShorts = async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get user's following list
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = following?.map(f => f.following_id) || [];

      // Get all shorts with engagement metrics
      const { data: shortsData, error } = await supabase
        .from('videos')
        .select(`
          *,
          user:users(*),
          likes:likes(count),
          comments:comments(count),
          video_views:video_views(count)
        `)
        .eq('type', 'short')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate scores and sort
      const scoredShorts = shortsData
        ?.map(short => {
          // Base engagement metrics
          const views = short.video_views[0]?.count || 0;
          const likes = short.likes[0]?.count || 0;
          const comments = short.comments[0]?.count || 0;
          
          // Calculate engagement rate (interactions per view)
          const engagementRate = views > 0 ? (likes + comments) / views : 0;
          
          // Base engagement score with engagement rate consideration
          const engagementScore = (
            views * 0.3 + 
            likes * 0.3 + 
            comments * 0.2 +
            engagementRate * 100 * 0.2 // Boost for high engagement rate
          );

          // Following boost
          const followingBoost = followingIds.includes(short.user_id) ? 1.5 : 1.0;

          // Enhanced recency boost
          const videoAge = Date.now() - new Date(short.created_at).getTime();
          const recencyBoost = 
            videoAge < 3600000 ? 2.0 : // Less than 1 hour
            videoAge < 86400000 ? 1.5 : // Less than 24 hours
            videoAge < 604800000 ? 1.2 : // Less than 7 days
            1.0;

          // Trending boost based on recent engagement
          const trendingBoost = 
            views > 1000 ? 1.5 :
            views > 500 ? 1.3 :
            views > 100 ? 1.2 :
            1.0;

          return {
            ...short,
            score: engagementScore * followingBoost * recencyBoost * trendingBoost
          };
        })
        .sort((a, b) => b.score - a.score);

      setShorts(scoredShorts || []);
      
      // Set first video as active by default
      if (scoredShorts && scoredShorts.length > 0) {
        setActiveIndex(0);
      }
    } catch (error) {
      console.error('Error fetching shorts:', error);
      Alert.alert('Error', 'Failed to load videos');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchShorts();
  }, []);

  const handleViewableItemsChanged = useRef(async ({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newActiveIndex = viewableItems[0].index;
      setActiveIndex(newActiveIndex);
      
      // Record video view
      const currentVideo = shorts[newActiveIndex];
      if (currentVideo) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          supabase
            .from('video_views')
            .insert({
              video_id: currentVideo.id,
              user_id: user.id
            })
            .then(({ error }) => {
              if (error) console.error('Error recording view:', error);
            });
        }
      }
    }
  }).current;

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchShorts();
  };

  if (isLoading && shorts.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {shorts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No shorts available</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={shorts}
          renderItem={({ item, index }) => {
            const isItemActive = index === activeIndex;
           
            return (
              <VideoItem 
                key={item.id}
                item={item} 
                isActive={isItemActive} 
              />
            );
          }}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          initialNumToRender={10}
          maxToRenderPerBatch={6}
          windowSize={2}
          getItemLayout={(data, index) => ({
            length: height * 0.9,
            offset: height * 0.9 * index,
            index,
          })}
          snapToInterval={height * 0.9}
          snapToAlignment="start"
          decelerationRate="normal"
          disableIntervalMomentum={true}
          onScrollToIndexFailed={() => {
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width,
    height: height * 0.9,
    backgroundColor: 'black',
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  emptyText: {
    color: 'white',
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
});

export default HomeScreen;