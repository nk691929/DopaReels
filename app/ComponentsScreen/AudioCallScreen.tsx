import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase.config';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Colors from '@/src/constants/color';
import { useTheme } from '@/src/context/ThemeContext';

const AudioCallScreen = () => {
  const { colors } = useTheme();
  const router = useRouter();
  const { callId, otherUser } = useLocalSearchParams();
  const [call, setCall] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const durationInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    fetchCall();
    setupCallChannel();
    startCallTimer();

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
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
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const startCallTimer = () => {
    durationInterval.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Implement actual mute functionality
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    // Implement actual speaker toggle functionality
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
      <View style={styles.userInfoContainer}>
        <Image
          source={{ uri: otherUser?.photo_url }}
          style={styles.userImage}
        />
        <Text style={[styles.userName, { color: colors.text }]}>
          {otherUser?.username}
        </Text>
        <Text style={[styles.callStatus, { color: colors.textSecondary }]}>
          {formatDuration(callDuration)}
        </Text>
      </View>

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
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfoContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  userImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  callStatus: {
    fontSize: 16,
  },
  controlsContainer: {
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

export default AudioCallScreen; 