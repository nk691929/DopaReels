import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { useTheme } from '../../../src/context/ThemeContext';
import { supabase } from '../../../supabase.config';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';

const AddNewPost = () => {
  const { colors } = useTheme();
  const router = useRouter();
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [video, setVideo] = useState<Video | null>(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'We need access to your media library to upload photos and videos.');
        }
      }
    })();
  }, []);

  // const pickImage = async () => {
  //   try {
  //     const result = await ImagePicker.launchImageLibraryAsync({
  //       mediaTypes: ImagePicker.MediaTypeOptions.Images,
  //       allowsEditing: true,
  //       aspect: [4, 3],
  //       quality: 0.8,
  //     });

  //     if (!result.canceled) {
  //       setMedia(result.assets[0].uri);
  //       setMediaType('image');
  //     }
  //   } catch (error) {
  //     console.error('Error picking image:', error);
  //     Alert.alert('Error', 'Failed to pick image. Please try again.');
  //   }
  // };

  const pickVideo = async () => {
    try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60, // 60 seconds max
    });

    if (!result.canceled) {
        setMedia(result.assets[0].uri);
        setMediaType('video');
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
    }
  };

  const uploadMedia = async (uri: string) => { try { const BUCKET_NAME = 'videos';

    setUploadStatus('Checking user...');
    setUploadProgress(10);
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');
  
    // Check if user exists in users table, create if not
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();
  
    if (userCheckError && userCheckError.code !== 'PGRST116') {
      console.error('Error checking user:', userCheckError);
      throw new Error('Failed to verify user account');
    }
  
    if (!existingUser) {
      setUploadStatus('Creating user profile...');
      setUploadProgress(20);
      
      try {
        // Create user record with all required fields
        const { error: createUserError } = await supabase
          .from('users')
          .insert([
            {
              id: user.id,
              email: user.email,
              fullname: user.user_metadata?.full_name || '',
              username: user.user_metadata?.username || '',
              bio: '',
              photo_url: user.user_metadata?.avatar_url || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]);
  
        if (createUserError) {
          if (createUserError.code === '42501') {
            throw new Error('Permission denied. Please check your database policies.');
          }
          console.error('Error creating user:', createUserError);
          throw new Error('Failed to create user account');
        }
  
        setUploadStatus('Creating user settings...');
        setUploadProgress(30);
  
        // Create user settings
        const { error: createSettingsError } = await supabase
          .from('user_settings')
          .insert([
            {
              user_id: user.id,
              theme: 'system',
              notification_enabled: true,
              email_notifications: true,
              push_notifications: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]);
  
        if (createSettingsError) {
          console.error('Error creating user settings:', createSettingsError);
          throw new Error('Failed to create user settings');
        }
      } catch (error) {
        console.error('Error in user creation process:', error);
        throw new Error(error.message || 'Failed to create user profile');
      }
    }
  
    setUploadStatus('Preparing media upload...');
    setUploadProgress(40);
  
    // Convert URI to base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  
    const fileName = `${Date.now()}.${mediaType === 'image' ? 'jpg' : 'mp4'}`;
    const filePath = `${mediaType}/${fileName}`;
  
    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
  
    setUploadStatus('Uploading media...');
    setUploadProgress(60);
  
    // Upload to Supabase storage with metadata
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, bytes, {
        contentType: mediaType === 'image' ? 'image/jpeg' : 'video/mp4',
        upsert: false,
        cacheControl: '3600',
        metadata: {
          uploadedBy: user.id,
          type: mediaType,
        }
      });
  
    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error('Failed to upload media to storage. Please check your permissions and try again.');
    }
  
    setUploadStatus('Creating post...');
    setUploadProgress(80);
  
    // Create the video record in the database
    const { error: dbError } = await supabase
      .from('videos')
      .insert([
        {
          user_id: user.id,
          video_url: data.path,
          type: mediaType === 'video' ? 'short' : 'story',
          caption: caption,
          view_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
  
    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to create video record');
    }
  
    setUploadStatus('Upload complete!');
    setUploadProgress(100);
  
    // Clear the media and reset form
    setMedia(null);
    setMediaType(null);
    setCaption('');
  
    return data.path;
  } catch (error) {
    console.error('Error uploading media:', error);
    throw new Error('Network error occurred while uploading media');
  } finally {
    // Reset progress after a delay
    setTimeout(() => {
      setUploadProgress(0);
      setUploadStatus('');
    }, 2000);
  }
  };
  

  const handlePost = async () => {
    if (!media || !mediaType) {
      Alert.alert('Error', 'Please select a media file');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Upload media to Supabase storage
      await uploadMedia(media);

      Alert.alert('Success', 'Post created successfully');
      router.back();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to create post. Please check your internet connection and try again.'
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors?.background || '#FFFFFF' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons 
            name="close" 
            size={24} 
            color={colors?.text || '#000000'} 
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors?.text || '#000000' }]}>
          New Post
        </Text>
        <TouchableOpacity 
          onPress={handlePost}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color={colors?.primary || '#007AFF'} />
          ) : (
            <Text style={[styles.postButton, { color: colors?.primary || '#007AFF' }]}>
              Post
            </Text>
        )}
      </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {isUploading && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
            <Text style={[styles.progressText, { color: colors?.text || '#000000' }]}>
              {uploadStatus} {uploadProgress}%
            </Text>
          </View>
        )}

        <View style={styles.mediaContainer}>
          {!media ? (
            <View style={styles.mediaButtons}>
          {/* <TouchableOpacity
                style={[styles.mediaButton, { backgroundColor: colors?.card || '#F5F5F5' }]}
                onPress={pickImage}
              >
                <Ionicons 
                  name="image-outline" 
                  size={24} 
                  color={colors?.text || '#000000'} 
                />
                <Text style={[styles.mediaButtonText, { color: colors?.text || '#000000' }]}>
                  Add Photo
            </Text>
          </TouchableOpacity> */}

          <TouchableOpacity
                style={[styles.mediaButton, { backgroundColor: colors?.card || '#F5F5F5' }]}
                onPress={pickVideo}
              >
                <Ionicons 
                  name="videocam-outline" 
                  size={24} 
                  color={colors?.text || '#000000'} 
                />
                <Text style={[styles.mediaButtonText, { color: colors?.text || '#000000' }]}>
                  Add Video
            </Text>
          </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.mediaPreview}>
              {mediaType === 'image' ? (
                <Image
                  source={{ uri: media }}
                  style={styles.previewImage}
                />
              ) : (
                <Video
                  source={{ uri: media }}
                  style={styles.previewVideo}
                  useNativeControls
                  resizeMode="contain"
                />
              )}
          <TouchableOpacity
                style={[styles.removeButton, { backgroundColor: colors?.card || '#F5F5F5' }]}
                onPress={() => {
                  setMedia(null);
                  setMediaType(null);
                }}
              >
                <Ionicons 
                  name="close" 
                  size={20} 
                  color={colors?.text || '#000000'} 
                />
          </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.captionContainer}>
          <TextInput
            style={[
              styles.captionInput,
              {
                color: colors?.text || '#000000',
                borderColor: colors?.border || '#DDDDDD',
                backgroundColor: colors?.card || '#F5F5F5',
              }
            ]}
            placeholder="Write a caption..."
            placeholderTextColor={colors?.text + '80' || '#00000080'}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={2200}
          />
          <Text style={[styles.charCount, { color: colors?.text + '80' || '#00000080' }]}>
            {caption.length}/2200
            </Text>
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  postButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  progressContainer: {
    padding: 10,
    marginHorizontal: 15,
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#007AFF',
    borderRadius: 2,
    marginBottom: 5,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
  },
  mediaContainer: {
    padding: 15,
  },
  mediaButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  mediaButton: {
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    width: '45%',
  },
  mediaButtonText: {
    marginTop: 8,
    fontSize: 14,
  },
  mediaPreview: {
    position: 'relative',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 10,
  },
  previewVideo: {
    width: '100%',
    height: 300,
    borderRadius: 10,
  },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
    borderRadius: 15,
  },
  captionContainer: {
    padding: 15,
  },
  captionInput: {
    minHeight: 100,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
  },
});

export default AddNewPost;