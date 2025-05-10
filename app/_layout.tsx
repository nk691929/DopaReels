import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../supabase.config"; // Import Supabase client
import { initializeUser } from '../src/utils/userInit';
import { ThemeProvider } from '../src/context/ThemeContext';
import { View, Text, ActivityIndicator, Button } from "react-native";
import Colors from '@/src/constants/color';

// Debug logging function
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${message}:`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
};

/**
 * AuthStateHandler component
 * 
 * This component handles authentication state and navigation.
 * It's separated from the main layout to avoid navigation issues.
 */
function AuthStateHandler() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('Checking initial session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          throw sessionError;
        }

        if (!mounted) return;

        if (session) {
          console.log('Session found, redirecting to home...');
          router.replace('/HomeScreen/(tabs)/homeScreen');
        } else {
          console.log('No session found, redirecting to login...');
          router.replace('/Auth/LoginScreen');
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize auth');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      if (event === 'SIGNED_IN') {
        router.replace('/HomeScreen/(tabs)/homeScreen');
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out, redirecting to login screen');
        // Force navigation to login screen
        router.replace('/Auth/LoginScreen');
      }
    });

    // Initialize auth state
    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'red' }}>Error: {error}</Text>
        <Button 
          title="Retry" 
          onPress={() => {
            setError(null);
            setIsLoading(true);
          }} 
        />
      </View>
    );
  }

  return null;
}

/**
 * RootLayout component
 * 
 * This component serves as the main layout wrapper for the entire application.
 * It handles:
 * 1. Theme provider setup
 * 2. Navigation stack configuration
 * 3. User initialization
 */
export default function RootLayout() {
  log("RootLayout rendering");
  
  // Initialize user data when app starts
  useEffect(() => {
    log("Initializing user data");
    initializeUser();
  }, []);

  return (
    <ThemeProvider>
      <AuthStateHandler />
      <Stack screenOptions={{ headerShown: false, statusBarBackgroundColor: "#000000" }}>
        <Stack.Screen name="index" options={{ title: "Splash Screen" }} />
        <Stack.Screen name="Auth/LoginScreen" options={{ title: "Login" }} />
        <Stack.Screen name="Auth/signUpScreen" options={{ title: "Sign Up" }} />
        <Stack.Screen name="Auth/forgotPasswordScreen" options={{ title: "Forgot Password" }} />
        <Stack.Screen name="HomeScreen" options={{ title: "Home" }} />
      </Stack>
    </ThemeProvider>
  );
}
