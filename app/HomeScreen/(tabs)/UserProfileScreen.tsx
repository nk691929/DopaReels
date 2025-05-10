import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import Colors from '@/src/constants/color';
import { supabase } from '../../../supabase.config';
import { Video } from 'expo-av';
import { useTheme } from '@/src/context/ThemeContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { VideoItem } from '../../ComponentsScreen/VideoItem_new';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { FollowListComponent } from '../../ComponentsScreen/FollowListComponent';
import { UserVideoList } from '../../ComponentsScreen/UserVideoList';

const { width } = Dimensions.get('window');

type Video = {
  id: string;
  video_url: string;
  type: string;
  caption?: string;
  created_at: string;
  view_count?: number;
  thumbnail_url?: string;
};

type User = {
  id: string;
  username: string;
  fullname: string;
  photo_url: string;
  bio: string;
  follower_count: number;
  following_count: number;
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
  gender?: string;
  birthdate?: string;
};

type UserSettings = {
  theme: 'light' | 'dark' | 'system';
  notification_enabled: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
};

const UserProfileScreen = () => {
  const { theme, colors, toggleTheme } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'shorts' | 'stories' | 'favorites'>('shorts');
  const [user, setUser] = useState<User | null>(null);
  const [shorts, setShorts] = useState<Video[]>([]);
  const [stories, setStories] = useState<Video[]>([]);
  const [favorites, setFavorites] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [stats, setStats] = useState({
    following: 0,
    followers: 0,
    posts: 0
  });
  const [editData, setEditData] = useState({
    fullname: '',
    username: '',
    bio: '',
    email: '',
    phone: '',
    website: '',
    location: '',
    gender: '',
    birthdate: '',
  });
  const [isProfilePicModalVisible, setIsProfilePicModalVisible] = useState(false);
  const [profilePicTimestamp, setProfilePicTimestamp] = useState(Date.now());
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);

  // Add refs to track if component is mounted and if data has been loaded
  const isMounted = useRef(true);
  const dataLoaded = useRef(false);
  const lastFetchTime = useRef(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Clear all data when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const clearAllData = () => {
    if (!isMounted.current) return;
    setUser(null);
    setShorts([]);
    setStories([]);
    setFavorites([]);
    setStats({
      following: 0,
      followers: 0,
      posts: 0
    });
  };

  const fetchUserData = async (forceRefresh = false) => {
    console.log('Starting to fetch user data...');

    const now = Date.now();
    if (!forceRefresh && dataLoaded.current && (now - lastFetchTime.current < CACHE_DURATION)) {
      console.log('Using cached data, last fetch was', (now - lastFetchTime.current) / 1000, 'seconds ago');
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setIsLoading(true);
      if (forceRefresh) clearAllData();

      // Get current user
      console.log('Attempting to get current user...');
      const { data: { user: currentUser }, error: currentUserError } = await supabase.auth.getUser();
      if (currentUserError || !currentUser) {
        console.error('User error:', currentUserError);
        Alert.alert('Error', 'Failed to get user information. Please try again.');
        router.push('/login');
        return;
      }
      console.log('Current user found:', currentUser.id);

      // Fetch user profile, settings, follow counts, and videos in parallel
      const [
        userRes,
        settingsRes,
        followersRes,
        followingRes,
        shortsRes,
        storiesRes,
        favoritesRes
      ] = await Promise.all([
        supabase.from('users').select('*').eq('id', currentUser.id).single(),
        supabase.from('user_settings').select('*').eq('user_id', currentUser.id).single(),
        supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', currentUser.id),
        supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', currentUser.id),
        supabase.from('videos').select('*').eq('user_id', currentUser.id).eq('type', 'short').order('created_at', { ascending: false }),
        supabase.from('videos').select('*').eq('user_id', currentUser.id).eq('type', 'story').order('created_at', { ascending: false }),
        supabase.from('favourites').select(`video_id, videos(*)`).eq('user_id', currentUser.id)
      ]);

      // Handle user profile data
      let userData = userRes.data;
      if (userRes.error?.code === 'PGRST116') {
        console.log('Creating new user profile...');
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([{
            id: currentUser.id,
            username: currentUser.email?.split('@')[0] || 'user',
            fullname: currentUser.user_metadata?.full_name || 'User',
            photo_url: currentUser.user_metadata?.avatar_url || '',
            bio: '',
            follower_count: 0,
            following_count: 0,
          }])
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          Alert.alert('Error', 'Failed to create user profile.');
          return;
        }
        userData = newUser;
      } else if (userRes.error) {
        console.error('Error fetching user profile:', userRes.error);
        Alert.alert('Error', 'Failed to fetch user profile.');
        return;
      }

      // Handle settings data
      let settingsData = settingsRes.data;
      if (settingsRes.error?.code === 'PGRST116') {
        const { data: newSettings, error: createSettingsError } = await supabase
          .from('user_settings')
          .insert([{
            user_id: currentUser.id,
            theme: 'light',
            notification_enabled: true,
            email_notifications: true,
            push_notifications: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();
        settingsData = newSettings || {
          user_id: currentUser.id,
          theme: 'light',
          notification_enabled: true,
          email_notifications: true,
          push_notifications: true
        };
        if (createSettingsError) console.error('Settings creation error:', createSettingsError);
      } else if (settingsRes.error) {
        console.error('Settings fetch error:', settingsRes.error);
        settingsData = {
          user_id: currentUser.id,
          theme: 'light',
          notification_enabled: true,
          email_notifications: true,
          push_notifications: true
        };
      }

      // Handle follow counts
      if (followersRes.error || followingRes.error) {
        console.error('Follow count error:', followersRes.error || followingRes.error);
      }
      const followerCount = followersRes.count || 0;
      const followingCount = followingRes.count || 0;

      // Handle video data
      if (shortsRes.error || storiesRes.error || favoritesRes.error) {
        console.error('Video fetch errors:', shortsRes.error, storiesRes.error, favoritesRes.error);
        throw shortsRes.error || storiesRes.error || favoritesRes.error;
      }

      // Map utility for video data
      const mapVideo = (video) => ({
        ...video,
        views: video.view_count || 0,
        thumbnail_url: video.thumbnail_url || 'https://via.placeholder.com/150'
      });

      if (isMounted.current) {
        // Update userData with follow counts before setting state
        const updatedUserData = { ...userData, follower_count: followerCount, following_count: followingCount };
        setUser(updatedUserData);
        setUserSettings(settingsData);
        setShorts(shortsRes.data.map(mapVideo));
        setStories(storiesRes.data.map(mapVideo));
        setFavorites(favoritesRes.data.map(fav => mapVideo(fav.videos)));

        setStats({
          following: followingCount,
          followers: followerCount,
          posts: shortsRes.data.length
        });
      }

      lastFetchTime.current = now;
      dataLoaded.current = true;

    } catch (error) {
      console.error('Error in fetchUserData:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };


  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchUserData(true);
  }, []);


  // Only fetch data on first focus or when explicitly refreshing
  useFocusEffect(
    useCallback(() => {
      if (!dataLoaded.current) {
        fetchUserData();
      }
    }, [])
  );

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        await updateProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const updateProfilePicture = async (uri: string) => {
    try {
      setIsLoading(true);
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authUser) throw new Error('User not authenticated');

      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Create a unique file path
      const filePath = `profile_${authUser.id}_${Date.now()}.jpg`;

      // Upload to Supabase storage
      const { data, error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, decode(base64), {
          contentType: 'image/jpeg',
          upsert: true,
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({
          photo_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', authUser.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // Update local state without reloading everything
      if (isMounted.current) {
        setUser(prev => prev ? { ...prev, photo_url: publicUrl } : null);
        setProfilePicTimestamp(Date.now());
      }

      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (error) {
      console.error('Error updating profile picture:', error);
      Alert.alert('Error', 'Failed to update profile picture');
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setIsProfilePicModalVisible(false);
      }
    }
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const handleUpdateField = async (field: string, value: string) => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from('users')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;

      // Update only the specific field in the user state
      if (isMounted.current) {
        setUser(prev => prev ? { ...prev, [field]: value } : null);
      }

      Alert.alert('Success', `${field} updated successfully`);
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
      Alert.alert('Error', `Failed to update ${field}`);
    }
  };

  const handleSettingsUpdate = async (field: string, value: any) => {
    try {
      if (!userSettings) return;

      const { error } = await supabase
        .from('user_settings')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('user_id', user?.id);

      if (error) throw error;

      // Update only the specific setting in the userSettings state
      if (isMounted.current) {
        setUserSettings(prev => prev ? { ...prev, [field]: value } : null);
      }

      if (field === 'theme') {
        toggleTheme(value);
      }

      Alert.alert('Success', 'Settings updated successfully');
    } catch (error) {
      console.error('Error updating settings:', error);
      Alert.alert('Error', 'Failed to update settings');
    }
  };

  const renderStats = () => (
    <View style={styles.statsContainer}>
      <TouchableOpacity
        style={styles.statItem}
      >
        <Text style={[styles.statNumber, { color: colors.text }]}>{stats.posts}</Text>
        <Text style={[styles.statLabel, { color: colors.text }]}>Posts</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.statItem}
        onPress={() => setShowFollowersModal(true)}
      >
        <Text style={[styles.statNumber, { color: colors.text }]}>{stats.followers}</Text>
        <Text style={[styles.statLabel, { color: colors.text }]}>Followers</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.statItem}
        onPress={() => setShowFollowingModal(true)}
      >
        <Text style={[styles.statNumber, { color: colors.text }]}>{stats.following}</Text>
        <Text style={[styles.statLabel, { color: colors.text }]}>Following</Text>
            </TouchableOpacity>
    </View>
  );

  const generateThumbnail = async (videoUrl: string) => {
    try {
      const video = new Video.createAsync(
        { uri: videoUrl },
        { shouldPlay: false }
      );
      const status = await (await video).getStatusAsync();
      if (status.isLoaded) {
        return status.thumbnailUrl;
      }
      return null;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  };


  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              console.log('Logging out user...');

              // Clear all local data first
              clearAllData();

              // Sign out from Supabase
              const { error } = await supabase.auth.signOut();
              if (error) throw error;

              console.log('User logged out successfully');

              // Force navigation to login screen
              router.replace('/Auth/LoginScreen');
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };


  const handleVideoPress = (videoType: 'shorts' | 'stories' | 'favorites', index: number) => {
    router.push({
      pathname: '/HomeScreen/VideoViewScreen',
      params: {
        userId: user?.id,
        videoType,
        initialIndex: index
      }
    });
  };

  if (isLoading && !user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors?.background || '#FFFFFF' }]}>
        <ActivityIndicator size="large" color={colors?.primary || '#007AFF'} />
        <Text style={[styles.loadingText, { color: colors?.text || '#000000' }]}>Loading profile...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors?.background || '#FFFFFF' }]}>
        <Text style={[styles.errorText, { color: colors?.text || '#000000' }]}>
          Unable to load profile data. Please try again.
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors?.primary || '#007AFF' }]}
          onPress={fetchUserData}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors?.background || '#FFFFFF' }]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={[colors?.primary || '#007AFF']}
          tintColor={colors?.primary || '#007AFF'}
        />
      }
    >
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={24} color={colors.primary} />
          <Text style={[styles.logoutText, { color: colors.primary }]}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileImageContainer}>
          <Image
            source={{
              uri: `${user.photo_url}?t=${profilePicTimestamp}`,
              cache: 'reload'
            }}
            style={styles.profileImage}
            onError={(e) => console.error('Image loading error:', e.nativeEvent.error)}
          />
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: colors?.primary || '#007AFF' }]}
            onPress={() => setIsProfilePicModalVisible(true)}
          >
            <Ionicons name="camera" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {renderStats()}
      </View>

      {/* User Info */}
      <View style={styles.userInfo}>
        <Text style={[styles.fullname, { color: colors?.text || '#000000' }]}>
          {user.fullname || 'No name set'}
        </Text>
        <Text style={[styles.username, { color: colors?.text + '80' || '#00000080' }]}>
          @{user.username || 'username'}
        </Text>
        <Text style={[styles.bio, { color: colors?.text || '#000000' }]}>
          {user.bio || 'No bio yet'}
        </Text>
        <TouchableOpacity
          style={[styles.editProfileButton, { backgroundColor: colors?.primary || '#007AFF' }]}
          onPress={() => setShowEditModal(true)}
        >
          <Text style={styles.editProfileButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab ===
            'shorts' && styles.activeTab]}
            onPress={() => setActiveTab('shorts')}
          >
            <Text style={[styles.tabText, activeTab === 'shorts' && styles.activeTabText]}>
              Shorts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'stories' && styles.activeTab]}
            onPress={() => setActiveTab('stories')}
          >
            <Text style={[styles.tabText, activeTab === 'stories' && styles.activeTabText]}>
              Stories
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'favorites' && styles.activeTab]}
            onPress={() => setActiveTab('favorites')}
          >
            <Text style={[styles.tabText, activeTab === 'favorites' && styles.activeTabText]}>
              Favorites
            </Text>
          </TouchableOpacity>
        </View>
  
        {/* Video Grid - Moved inside ScrollView */}
        <View style={styles.videosContainer}>
        <FlatList
          data={activeTab === 'shorts' ? shorts : activeTab === 'stories' ? stories : favorites}
          keyExtractor={(item) => item.id}
          numColumns={3}
            scrollEnabled={false} // Keep this false so the parent ScrollView handles scrolling
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.videoItem}
              onPress={() => handleVideoPress(activeTab, index)}
            >
              <View style={[styles.videoThumbnailContainer, !item.thumbnail_url && styles.videoPlaceholder]}>
                {item.thumbnail_url ? (
                  <Image
                    source={{ uri: item.thumbnail_url }}
                    style={styles.videoThumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.placeholderContent}>
                    <Ionicons name="videocam" size={24} color="#FFFFFF" />
                  </View>
                )}
                <View style={styles.playIconContainer}>
                  <Ionicons name="play-circle" size={24} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.videoOverlay}>
                <View style={styles.viewsContainer}>
                  <Ionicons name="eye" size={12} color="#FFFFFF" />
                  <Text style={styles.viewsText}>{item.view_count || 0}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyContent}>
              <Text style={[styles.emptyText, { color: colors?.text || '#000000' }]}>
                No {activeTab} found
              </Text>
            </View>
          )}
          contentContainerStyle={styles.contentContainer}
        />
        </View>
  
        {/* Profile Picture Update Modal */}
        <Modal
          visible={isProfilePicModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsProfilePicModalVisible(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors?.background || '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors?.text || '#000000' }]}>
                Update Profile Picture
              </Text>
              <TouchableOpacity onPress={() => setIsProfilePicModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors?.text || '#000000'} />
              </TouchableOpacity>
            </View>
  
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: colors?.primary || '#007AFF' }]}
                onPress={pickImage}
              >
                <Text style={styles.uploadButtonText}>Choose from Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
  
        {/* Edit Profile Modal */}
        <Modal
          visible={showEditModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowEditModal(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors?.background || '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors?.text || '#000000' }]}>
                Edit Profile
              </Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors?.text || '#000000'} />
              </TouchableOpacity>
            </View>
  
            <ScrollView style={styles.modalContent}>
              {Object.entries(editData).map(([field, value]) => (
                <View key={field} style={styles.editField}>
                  <Text style={[styles.editLabel, { color: colors?.text || '#000000' }]}>
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                  </Text>
                  <TextInput
                    style={[
                      styles.editInput,
                      {
                        color: colors?.text || '#000000',
                        borderColor: colors?.border || '#DDDDDD',
                        backgroundColor: colors?.card || '#F5F5F5',
                      }
                    ]}
                    value={value}
                    onChangeText={(text) => setEditData(prev => ({ ...prev, [field]: text }))}
                    placeholder={`Enter ${field}`}
                    placeholderTextColor={colors?.text + '80' || '#00000080'}
                  />
                  <TouchableOpacity
                    style={[styles.updateButton, { backgroundColor: colors?.primary || '#007AFF' }]}
                    onPress={() => handleUpdateField(field, value)}
                  >
                    <Text style={styles.updateButtonText}>Update</Text>
                  </TouchableOpacity>
                </View>
              ))}
  
              {/* Settings Section */}
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsTitle, { color: colors?.text || '#000000' }]}>
                  Settings
                </Text>
  
                <View style={styles.settingItem}>
                  <Text style={[styles.settingLabel, { color: colors?.text || '#000000' }]}>
                    Theme
                  </Text>
          <TouchableOpacity
                    style={[styles.settingButton, { backgroundColor: colors?.card || '#F5F5F5' }]}
                    onPress={() => handleSettingsUpdate('theme', userSettings?.theme === 'dark' ? 'light' : 'dark')}
          >
                    <Text style={[styles.settingButtonText, { color: colors?.text || '#000000' }]}>
                      {userSettings?.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </Text>
          </TouchableOpacity>
        </View>
  
                <View style={styles.settingItem}>
                  <Text style={[styles.settingLabel, { color: colors?.text || '#000000' }]}>
                    Notifications
                  </Text>
                  <TouchableOpacity
                    style={[styles.settingButton, { backgroundColor: colors?.card || '#F5F5F5' }]}
                    onPress={() => handleSettingsUpdate('notification_enabled', !userSettings?.notification_enabled)}
                  >
                    <Text style={[styles.settingButtonText, { color: colors?.text || '#000000' }]}>
                      {userSettings?.notification_enabled ? 'Disable' : 'Enable'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
  
        {/* Followers Modal */}
        <Modal
          visible={showFollowersModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowFollowersModal(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Followers</Text>
              <TouchableOpacity onPress={() => setShowFollowersModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FollowListComponent
              type="followers"
              userId={user?.id}
              onClose={() => setShowFollowersModal(false)}
            />
          </View>
        </Modal>
  
        {/* Following Modal */}
        <Modal
          visible={showFollowingModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowFollowingModal(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Following</Text>
              <TouchableOpacity onPress={() => setShowFollowingModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FollowListComponent
              type="following"
              userId={user?.id}
              onClose={() => setShowFollowingModal(false)}
            />
          </View>
        </Modal>
      </ScrollView>
    );
  };
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      padding: 15,
    },
    themeToggle: {
      padding: 10,
      borderRadius: 20,
    },
    profileHeader: {
      padding: 20,
      alignItems: 'center',
    },
    profileImageContainer: {
      position: 'relative',
      marginBottom: 20,
    },
    profileImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
    },
    editButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      marginTop: 20,
    },
    statItem: {
      alignItems: 'center',
      padding: 10,
    },
    statNumber: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    statLabel: {
      fontSize: 12,
      marginTop: 4,
    },
    userInfo: {
      padding: 20,
      alignItems: 'center',
    },
    fullname: {
      fontSize: 24,
      fontWeight: 'bold',
    },
    username: {
      fontSize: 16,
      marginTop: 4,
    },
    bio: {
      fontSize: 14,
      marginTop: 8,
      textAlign: 'center',
    },
    editProfileButton: {
      marginTop: 15,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    editProfileButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    tabContainer: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    tabButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: Colors.primary,
    },
    tabText: {
      color: '#FFFFFF',
      fontSize: 16,
      opacity: 0.7,
    },
    activeTabText: {
      opacity: 1,
      fontWeight: 'bold',
    },
    content: {
      flex: 1,
    },
    modalContainer: {
      flex: 1,
      marginTop: 50,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    modalContent: {
      padding: 20,
    },
    editField: {
      marginBottom: 20,
    },
    editLabel: {
      fontSize: 16,
      marginBottom: 8,
    },
    editInput: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      marginBottom: 8,
    },
    updateButton: {
      padding: 10,
      borderRadius: 8,
      alignItems: 'center',
    },
    updateButtonText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
    },
    settingsSection: {
      marginTop: 30,
    },
    settingsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 20,
    },
    settingItem: {
      marginBottom: 20,
    },
    settingLabel: {
      fontSize: 16,
      marginBottom: 8,
    },
    settingButton: {
      padding: 10,
      borderRadius: 8,
      alignItems: 'center',
    },
    settingButtonText: {
      fontWeight: '500',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 10,
      fontSize: 16,
      fontWeight: '500',
    },
    uploadButton: {
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
    },
    uploadButtonText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
    },
    emptyContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '500',
    },
    videoItem: {
      width: (width - 12) / 3,
      aspectRatio: 9/16,
      padding: 4,
      position: 'relative',
    },
    videoThumbnailContainer: {
      width: '100%',
      height: '100%',
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: '#2A2A2A',
    },
    videoThumbnail: {
      width: '100%',
      height: '100%',
    },
    placeholderContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    playIconContainer: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -12 }, { translateY: -12 }],
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: 12,
    },
    videoOverlay: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      right: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    viewsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    viewsText: {
      color: '#FFFFFF',
      fontSize: 12,
      marginLeft: 4,
    },
    videosGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 4,
    },
    videoItemContainer: {
      flex: 1,
      margin: 5,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: '#F5F5F5',
    },
    videoInfo: {
      padding: 8,
    },
    videoTitle: {
      fontSize: 12,
      fontWeight: '500',
      marginBottom: 4,
    },
    videoStats: {
      fontSize: 10,
    },
    videosList: {
      flex: 1,
    },
    contentContainer: {
      flexGrow: 1,
      paddingBottom: 20,
    },
    errorText: {
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 20,
      textAlign: 'center',
    },
    retryButton: {
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
    },
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderRadius: 8,
      backgroundColor: 'transparent',
    },
    logoutText: {
      marginLeft: 4,
      fontSize: 16,
      fontWeight: '600',
    },
    videosContainer: {
      width: '100%',
    },
  });
  
  export default UserProfileScreen;
  