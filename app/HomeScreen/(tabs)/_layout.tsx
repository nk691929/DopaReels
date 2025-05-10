import Colors from '@/src/constants/color';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Dimensions, StatusBar, View, useColorScheme, Platform } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { height, width } = Dimensions.get('window');
  const colorScheme = useColorScheme();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Calculate tab bar height based on platform and safe area
  const tabBarHeight = Platform.OS === 'ios' 
    ? height * 0.08 + insets.bottom 
    : height * 0.1;

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: colors?.background || '#FFFFFF',
      paddingBottom: insets.bottom 
    }}>
      <StatusBar 
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={colors?.background || '#FFFFFF'} 
      />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors?.primary || '#007AFF',
          tabBarInactiveTintColor: colors?.text + '80' || '#00000080',
          tabBarStyle: { 
            height: tabBarHeight,
            backgroundColor: colors?.background || '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: colors?.border || '#DDDDDD',
            paddingBottom: Platform.OS === 'ios' ? insets.bottom : 5,
            paddingTop: 7,
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
            marginBottom: Platform.OS === 'ios' ? 0 : 5,
          },
          headerShown: false,
          contentStyle: {
            paddingBottom: tabBarHeight,
          },
        }}
      >
        <Tabs.Screen
          name="homeScreen"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'home' : 'home-outline'} 
                size={24} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="SearchScreen"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'search' : 'search-outline'} 
                size={24} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="AddNewPost"
          options={{
            title: 'Create',
            tabBarIcon: ({ color, focused }) => (
              <View style={{
                backgroundColor: colors?.primary || '#007AFF',
                width: 50,
                height: 50,
                borderRadius: 25,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: Platform.OS === 'ios' ? insets.bottom + 20 : 20,
                shadowColor: colors?.primary || '#007AFF',
                shadowOffset: {
                  width: 0,
                  height: 2,
                },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5,
              }}>
                <Ionicons 
                  name="add" 
                  size={28} 
                  color="#FFFFFF" 
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="MessageScreen"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'chatbubbles' : 'chatbubbles-outline'} 
                size={24} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="UserProfileScreen"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? 'person' : 'person-outline'} 
                size={24} 
                color={color} 
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
