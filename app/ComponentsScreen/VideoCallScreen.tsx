import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase.config';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Colors from '@/src/constants/color';
import { useTheme } from '@/src/context/ThemeContext';

const VideoCallScreen = () => {
  const { colors } = useTheme();
  const router = useRouter();
  const { callId, otherUser } = useLocalSearchParams();
  const [call, setCall] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const localVideoRef = useRef<Video>(null);
  const remoteVideoRef = useRef<Video>(null);
  const durationInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    fetchCall();
    setupCallChannel();
    startCallTimer();
    setupVideo();

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      cleanupVideo();
    };
  }, [callId]);

  const fetchCall = async () => {
    try {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (error) throw error;
      setCall(data);
    } catch (error) {
      console.error('Error fetching call:', error);
    }
  };

  const setupCallChannel = () => {
    const channel = supabase.channel(`call:${callId}`);

    channel
      .on('broadcast', { event: 'call_status' }, (payload) => {
        if (payload.status === 'ended') {
          endCall();
        }
      })
      .on('broadcast', { event: 'camera_status' }, (payload) => {
        // Handle remote user's camera status
        if (payload.cameraOff) {
          // Show placeholder or message when remote camera is off
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const setupVideo = async () => {
    try {
      // Request camera and microphone permissions
      const { status: cameraStatus } = await Video.requestCameraPermissionsAsync();
      const { status: audioStatus } = await Video.requestMicrophonePermissionsAsync();

      if (cameraStatus !== 'granted' || audioStatus !== 'granted') {
        Alert.alert('Permission required', 'Camera and microphone permissions are required for video calls');
        return;
      }

      // Setup local video
      if (localVideoRef.current) {
        await localVideoRef.current.loadAsync(
          { uri: 'camera' },
          {
            shouldPlay: true,
            isMuted: true,
            isLooping: true,
            resizeMode: ResizeMode.COVER
          }
        );
      }

      // Setup remote video
      if (remoteVideoRef.current) {
        await remoteVideoRef.current.loadAsync(
          { uri: 'remote' }, // Replace with actual remote video stream
          {
            shouldPlay: true,
            isMuted: false,
            isLooping: true,
            resizeMode: ResizeMode.COVER
          }
        );
      }
    } catch (error) {
      console.error('Error setting up video:', error);
    }
  };

  const cleanupVideo = async () => {
    if (localVideoRef.current) {
      await localVideoRef.current.unloadAsync();
    }
    if (remoteVideoRef.current) {
      await remoteVideoRef.current.unloadAsync();
    }
  };

  const startCallTimer = () => {
    durationInterval.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const toggleMute = async () => {
    try {
      setIsMuted(!isMuted);
      if (localVideoRef.current) {
        await localVideoRef.current.setIsMutedAsync(!isMuted);
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const toggleCamera = async () => {
    try {
      setIsCameraOff(!isCameraOff);
      if (localVideoRef.current) {
        await localVideoRef.current.setIsMutedAsync(isCameraOff);
      }
      // Broadcast camera status to other user
      await supabase.channel(`call:${callId}`).send({
        type: 'broadcast',
        event: 'camera_status',
        payload: { cameraOff: !isCameraOff }
      });
    } catch (error) {
      console.error('Error toggling camera:', error);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    // Implement actual speaker toggle functionality
  };

  const switchCamera = async () => {
    try {
      setIsFrontCamera(!isFrontCamera);
      if (localVideoRef.current) {
        await localVideoRef.current.setIsMutedAsync(!isFrontCamera);
      }
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  };

  const endCall = async () => {
    try {
      await supabase
        .from('calls')
        .update({ 
          status: 'ended',
          ended_at: new Date().toISOString(),
          duration: callDuration
        })
        .eq('id', callId);

      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }

      await cleanupVideo();
      router.back();
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Remote Video */}
      <View style={styles.remoteVideoContainer}>
        <Video
          ref={remoteVideoRef}
          style={styles.remoteVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isMuted={false}
        />
        {isCameraOff && (
          <View style={styles.placeholderContainer}>
            <Image
              source={{ uri: otherUser?.photo_url }}
              style={styles.placeholderImage}
            />
            <Text style={[styles.placeholderText, { color: colors.text }]}>
              Camera is off
            </Text>
          </View>
        )}
      </View>

      {/* Local Video */}
      <View style={styles.localVideoContainer}>
        <Video
          ref={localVideoRef}
          style={styles.localVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isMuted={isMuted}
        />
      </View>

      {/* User Info */}
      <View style={styles.userInfoContainer}>
        <Text style={[styles.userName, { color: colors.text }]}>
          {otherUser?.username}
        </Text>
        <Text style={[styles.callStatus, { color: colors.textSecondary }]}>
          {formatDuration(callDuration)}
        </Text>
      </View>

      {/* Call Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.card }]}
          onPress={toggleMute}
        >
          <Ionicons
            name={isMuted ? 'mic-off' : 'mic'}
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.card }]}
          onPress={toggleCamera}
        >
          <Ionicons
            name={isCameraOff ? 'videocam-off' : 'videocam'}
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.card }]}
          onPress={switchCamera}
        >
          <Ionicons
            name="camera-reverse"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.card }]}
          onPress={toggleSpeaker}
        >
          <Ionicons
            name={isSpeakerOn ? 'volume-high' : 'volume-off'}
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.endCallButton, { backgroundColor: colors.error }]}
          onPress={endCall}
        >
          <Ionicons name="call" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  remoteVideoContainer: {
    flex: 1,
    backgroundColor: 'black',
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  placeholderImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  placeholderText: {
    fontSize: 16,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 100,
    height: 150,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'white',
  },
  localVideo: {
    flex: 1,
  },
  userInfoContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  callStatus: {
    fontSize: 14,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default VideoCallScreen; 