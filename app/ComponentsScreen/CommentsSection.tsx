import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/color';
import { supabase } from '../../supabase.config';

const { height } = Dimensions.get('window');

interface Comment {
  id: string;
  content: string;
  user_id: string;
  video_id: string;
  created_at: string;
  user: {
    username: string;
    photo_url: string;
  };
}

interface CommentsSectionProps {
  videoId: string;
  onClose: () => void;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({ videoId, onClose }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [videoOwner, setVideoOwner] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUserData();
    fetchComments();
  }, [videoId]);

  const fetchUserData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user?.id || null);

      // Get video owner
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('user_id')
        .eq('id', videoId)
        .single();

      if (videoError) throw videoError;
      setVideoOwner(videoData?.user_id || null);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchComments = async () => {
    try {
      setIsLoading(true);
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select(`
          *,
          user:users(username, photo_url)
        `)
        .eq('video_id', videoId)
        .order('created_at', { ascending: false });

      if (commentsError) throw commentsError;
      setComments(commentsData || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    try {
      if (!newComment.trim()) return;
      
      // Check authentication first
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to comment');
        return;
      }
      
      // Optimistic update
      const tempCommentId = `temp-${Date.now()}`;
      const tempComment = {
        id: tempCommentId,
        content: newComment.trim(),
        video_id: videoId,
        user_id: currentUser,
        created_at: new Date().toISOString(),
        user: {
          username: 'You',
          photo_url: ''
        }
      };
      
      // Add temporary comment to the list
      setComments(prevComments => [tempComment, ...prevComments]);
      setNewComment('');
      setIsSubmitting(true);
      
      // Submit to database
      const { data, error } = await supabase
        .from('comments')
        .insert([{
          content: newComment.trim(),
          video_id: videoId,
          user_id: currentUser
        }])
        .select(`
          *,
          user:users(username, photo_url)
        `)
        .single();

      if (error) throw error;
      
      // Replace temporary comment with real one
      setComments(prevComments => 
        prevComments.map(comment => 
          comment.id === tempCommentId ? data : comment
        )
      );
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
      
      // Remove temporary comment on error
      setComments(prevComments => 
        prevComments.filter(comment => !comment.id.startsWith('temp-'))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    try {
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to edit comments');
        return;
      }

      const comment = comments.find(c => c.id === commentId);
      if (!comment || comment.user_id !== currentUser) {
        Alert.alert('Error', 'You can only edit your own comments');
        return;
      }

      const { error } = await supabase
        .from('comments')
        .update({ content: editText.trim() })
        .eq('id', commentId);

      if (error) throw error;

      setEditingComment(null);
      setEditText('');
      await fetchComments();
    } catch (error) {
      console.error('Error editing comment:', error);
      Alert.alert('Error', 'Failed to edit comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to delete comments');
        return;
      }

      const comment = comments.find(c => c.id === commentId);
      if (!comment) return;

      // Check if user is comment author or video owner
      if (comment.user_id !== currentUser && currentUser !== videoOwner) {
        Alert.alert('Error', 'You can only delete your own comments or comments on your videos');
        return;
      }

      Alert.alert(
        'Delete Comment',
        'Are you sure you want to delete this comment?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const { error } = await supabase
                .from('comments')
                .delete()
                .eq('id', commentId);

              if (error) throw error;
              await fetchComments();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error deleting comment:', error);
      Alert.alert('Error', 'Failed to delete comment');
    }
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentContainer}>
      <Image
        source={
          item.user.photo_url
            ? { uri: item.user.photo_url }
            : require('../../src/assets/images/login.png')
        }
        style={styles.profilePic}
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.username}>@{item.user.username}</Text>
          {(currentUser === item.user_id || currentUser === videoOwner) && (
            <View style={styles.commentActions}>
              {currentUser === item.user_id && (
                <TouchableOpacity
                  onPress={() => {
                    setEditingComment(item.id);
                    setEditText(item.content);
                  }}
                  style={styles.actionButton}
                >
                  <Ionicons name="create-outline" size={16} color="white" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => handleDeleteComment(item.id)}
                style={styles.actionButton}
              >
                <Ionicons name="trash-outline" size={16} color="white" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        {editingComment === item.id ? (
          <View style={styles.editContainer}>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                onPress={() => {
                  setEditingComment(null);
                  setEditText('');
                }}
                style={styles.editButton}
              >
                <Text style={styles.editButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleEditComment(item.id)}
                style={[styles.editButton, styles.saveButton]}
              >
                <Text style={styles.editButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={styles.commentText}>{item.content}</Text>
        )}
        <Text style={styles.timestamp}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Comments</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <>
          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={item => item.id}
            style={styles.commentsList}
            contentContainerStyle={styles.commentsListContent}
          />
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor="#888"
              value={newComment}
              onChangeText={setNewComment}
              multiline
              editable={!isSubmitting}
            />
            <TouchableOpacity 
              style={[
                styles.sendButton,
                (!newComment.trim() || isSubmitting) && styles.sendButtonDisabled
              ]} 
              onPress={handleAddComment}
              disabled={isSubmitting || !newComment.trim()}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={24} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.5,
    backgroundColor: 'black',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsList: {
    padding: 16,
  },
  commentsListContent: {
    padding: 16,
  },
  commentContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    color: 'white',
    fontWeight: 'bold',
  },
  commentText: {
    color: 'white',
    marginBottom: 4,
  },
  timestamp: {
    color: '#666',
    fontSize: 12,
  },
  commentActions: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: 12,
  },
  editContainer: {
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 8,
    color: 'white',
    marginBottom: 8,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: Colors.primary,
  },
  editButtonText: {
    color: 'white',
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  input: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: 'white',
    marginRight: 8,
  },
  sendButton: {
    padding: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default CommentsSection; 