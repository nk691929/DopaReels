import { Text, View, StyleSheet, StatusBar, Image, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import React, { useState, useEffect } from "react";
import Colors from '@/src/constants/color';
import { MaterialIcons, Feather, Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from "expo-router";
import { supabase } from "../../supabase.config";
import { useTheme } from '@/src/context/ThemeContext';

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Clear errors when component mounts
  useEffect(() => {
    setError(null);
    setEmailError(null);
    setPasswordError(null);
  }, []);

  // Higher-order function to handle input change
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
    setter(value);
    // Clear errors when user types
    setError(null);
    setEmailError(null);
    setPasswordError(null);
  };

  // Validate email format
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate form inputs
  const validateForm = (): boolean => {
    let isValid = true;
    
    // Validate email
    if (!email) {
      setEmailError("Email is required");
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      isValid = false;
    } else {
      setEmailError(null);
    }
    
    // Validate password
    if (!password) {
      setPasswordError("Password is required");
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      isValid = false;
    } else {
      setPasswordError(null);
    }
    
    return isValid;
  };

  // Handle login with Supabase
  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate input
      if (!email || !password) {
        setError('Please enter both email and password');
        return;
      }

      // Attempt to sign in
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('Sign in error:', signInError);
        throw signInError;
      }

      if (!data.session) {
        throw new Error('No session returned after successful sign in');
      }

      // Session is automatically persisted by Supabase client
      console.log('Login successful, session:', data.session.user.id);
      router.replace('/HomeScreen/(tabs)/homeScreen');

    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors?.background || Colors.backgroundLight }]}
    >
      <StatusBar 
        barStyle={colors?.text === '#FFFFFF' ? 'light-content' : 'dark-content'} 
        backgroundColor={colors?.background || Colors.backgroundLight} 
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Logo and Welcome Section */}
        <View style={styles.logoContainer}>
          <Image 
            source={require("../../src/assets/images/login.png")} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <Text style={[styles.welcomeText, { color: colors?.primary || Colors.primary }]}>
            Welcome Back
          </Text>
          <Text style={[styles.subtitle, { color: colors?.text || Colors.textLight }]}>
            Sign in to continue
          </Text>
        </View>

        {/* Login Form */}
        <View style={[styles.formContainer, { backgroundColor: colors?.card || Colors.card }]}>
          {/* Error Display */}
          {error && (
            <View style={[styles.errorContainer, { backgroundColor: colors?.errorBackground || '#FFEBEE' }]}>
              <Ionicons name="alert-circle" size={20} color={colors?.error || '#D32F2F'} />
              <Text style={[styles.errorText, { color: colors?.error || '#D32F2F' }]}>
                {error}
              </Text>
            </View>
          )}

          {/* Email Input Field */}
          <View style={styles.inputWrapper}>
            <View style={[
              styles.inputContainer, 
              { 
                backgroundColor: colors?.inputBackground || Colors.inputBackground,
                borderColor: emailError ? (colors?.error || '#D32F2F') : (colors?.border || Colors.border)
              }
            ]}>
              <MaterialIcons 
                name="email" 
                size={22} 
                color={colors?.text || Colors.textLight} 
                style={styles.icon} 
              />
              <TextInput
                placeholder="Email address"
                placeholderTextColor={colors?.text + '80' || Colors.textLight + '80'}
                value={email}
                onChangeText={handleInputChange(setEmail)}
                style={[styles.inputText, { color: colors?.text || Colors.textDark }]}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            {emailError && (
              <Text style={[styles.fieldErrorText, { color: colors?.error || '#D32F2F' }]}>
                {emailError}
              </Text>
            )}
          </View>

          {/* Password Input Field */}
          <View style={styles.inputWrapper}>
            <View style={[
              styles.inputContainer, 
              { 
                backgroundColor: colors?.inputBackground || Colors.inputBackground,
                borderColor: passwordError ? (colors?.error || '#D32F2F') : (colors?.border || Colors.border)
              }
            ]}>
              <MaterialIcons 
                name="lock" 
                size={22} 
                color={colors?.text || Colors.textLight} 
                style={styles.icon} 
              />
              <TextInput
                placeholder="Password"
                placeholderTextColor={colors?.text + '80' || Colors.textLight + '80'}
                value={password}
                secureTextEntry={showPass}
                onChangeText={handleInputChange(setPassword)}
                style={[styles.inputText, { color: colors?.text || Colors.textDark }]}
              />
              <TouchableOpacity 
                onPress={() => setShowPass(!showPass)}
                style={styles.eyeIcon}
              >
                <Feather 
                  name={showPass ? 'eye' : 'eye-off'} 
                  size={20} 
                  color={colors?.text || Colors.textLight} 
                />
              </TouchableOpacity>
            </View>
            {passwordError && (
              <Text style={[styles.fieldErrorText, { color: colors?.error || '#D32F2F' }]}>
                {passwordError}
              </Text>
            )}
          </View>

          {/* Forgot Password Link */}
          <TouchableOpacity 
            onPress={() => router.push('/Auth/forgotPasswordScreen')}
            style={styles.forgotPasswordContainer}
          >
            <Text style={[styles.forgotPasswordText, { color: colors?.primary || Colors.primary }]}>
              Forgot Password?
            </Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity 
            onPress={handleLogin} 
            style={[
              styles.loginButton, 
              { 
                backgroundColor: colors?.primary || Colors.primary,
                opacity: isLoading ? 0.7 : 1
              }
            ]}
            disabled={isLoading}
          >
            {isLoading ? (
              <Text style={styles.buttonText}>Signing In...</Text>
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Social Login Options */}
          <View style={styles.socialLoginContainer}>
            <Text style={[styles.orText, { color: colors?.text || Colors.textLight }]}>
              Or continue with
            </Text>

            <View style={styles.socialButtonsContainer}>
              <TouchableOpacity style={[styles.socialButton, { backgroundColor: colors?.inputBackground || Colors.inputBackground }]}>
                <Ionicons name="logo-google" size={22} color={colors?.text || Colors.textDark} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.socialButton, { backgroundColor: colors?.inputBackground || Colors.inputBackground }]}>
                <Ionicons name="logo-apple" size={22} color={colors?.text || Colors.textDark} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.socialButton, { backgroundColor: colors?.inputBackground || Colors.inputBackground }]}>
                <Ionicons name="logo-facebook" size={22} color={colors?.text || Colors.textDark} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign Up Link */}
          <View style={styles.signUpContainer}>
            <Text style={[styles.signUpText, { color: colors?.text || Colors.textLight }]}>
              Don't have an account?{" "}
            </Text>
            <TouchableOpacity onPress={() => router.replace("/Auth/signUpScreen")}>
              <Text style={[styles.signUpLink, { color: colors?.primary || Colors.primary }]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
  },
  formContainer: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 25,
    paddingTop: 30,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 15,
    height: 55,
  },
  icon: {
    marginRight: 10,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  fieldErrorText: {
    fontSize: 12,
    marginTop: 5,
    marginLeft: 10,
  },
  eyeIcon: {
    padding: 5,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 25,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  buttonText: {
    color: Colors.textWhite,
    fontSize: 18,
    fontWeight: 'bold',
  },
  socialLoginContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  orText: {
    fontSize: 14,
    marginBottom: 20,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 16,
  },
  signUpLink: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

