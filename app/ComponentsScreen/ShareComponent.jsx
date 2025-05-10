import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Share,
  StyleSheet,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const ShareModal = ({ visible, onClose, videoUrl, friends }) => {
  const externalApps = [
    { name: 'WhatsApp', icon: 'whatsapp' },
    { name: 'Instagram', icon: 'instagram' },
    { name: 'Telegram', icon: 'send' },
    { name: 'Twitter', icon: 'twitter' },
  ];

  const handleShareExternal = async () => {
    try {
      await Share.share({
        message: `Check out this video: ${videoUrl}`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const renderFriend = ({ item }) => (
    <TouchableOpacity style={styles.friendItem}>
      <Image source={{ uri: item.photo_url }} style={styles.avatar} />
      <Text style={styles.username}>{item.username}</Text>
    </TouchableOpacity>
  );

  const renderApp = ({ item }) => (
    <TouchableOpacity style={styles.appItem} onPress={handleShareExternal}>
      <Icon name={item.icon} size={28} color="#555" />
      <Text style={styles.appName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Share Video</Text>

          {/* In-app Friends */}
          <Text style={styles.sectionTitle}>Share with Friends</Text>
          <FlatList
            data={friends}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.id}
            renderItem={renderFriend}
            contentContainerStyle={styles.friendList}
          />

          {/* External Apps */}
          <Text style={styles.sectionTitle}>Share via Apps</Text>
          <FlatList
            data={externalApps}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.name}
            renderItem={renderApp}
            contentContainerStyle={styles.appList}
          />

          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ShareModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  sectionTitle: {
    marginTop: 10,
    fontWeight: '600',
    fontSize: 16,
  },
  friendList: {
    paddingVertical: 10,
  },
  friendItem: {
    alignItems: 'center',
    marginRight: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
  },
  username: {
    marginTop: 4,
    fontSize: 12,
  },
  appList: {
    paddingVertical: 10,
  },
  appItem: {
    alignItems: 'center',
    marginRight: 20,
  },
  appName: {
    marginTop: 4,
    fontSize: 12,
  },
  closeButton: {
    marginTop: 20,
    alignSelf: 'center',
    padding: 10,
  },
  closeText: {
    fontSize: 16,
    color: 'blue',
  },
});
