import { Text, View, StyleSheet, StatusBar, Image, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import React, { useState } from "react";
import Colors from '@/src/constants/color';
import { MaterialIcons, Feather, Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from "expo-router";
import { supabase } from "../../supabase.config";
import { useTheme } from '@/src/context/ThemeContext';

export default function SignUpScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(true);
  const [showConfirmPass, setShowConfirmPass] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorDisp, setErrorDisp] = useState(null);

  // Higher-order function to handle input change
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
    setter(value);
    if (errorDisp) {
      setErrorDisp(null);
    }
  };

  // Handle signup with Supabase
  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        alert("Sign up successful! Please check your email for verification.");
        router.replace("/Auth/LoginScreen");
      }
    } catch (error: any) {
      alert(error.message || "An unknown error occurred");
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
            source={require("../../src/assets/images/signup.png")} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <Text style={[styles.welcomeText, { color: colors?.primary || Colors.primary }]}>
            Create Account
          </Text>
          <Text style={[styles.subtitle, { color: colors?.text || Colors.textLight }]}>
            Sign up to get started
          </Text>
        </View>

        {/* Signup Form */}
        <View style={[styles.formContainer, { backgroundColor: colors?.card || Colors.card }]}>
          {/* Email Input Field */}
          <View style={styles.inputWrapper}>
            <View style={[styles.inputContainer, { 
              backgroundColor: colors?.inputBackground || Colors.inputBackground,
              borderColor: colors?.border || Colors.border 
            }]}>
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
          </View>

          {/* Password Input Field */}
          <View style={styles.inputWrapper}>
            <View style={[styles.inputContainer, { 
              backgroundColor: colors?.inputBackground || Colors.inputBackground,
              borderColor: colors?.border || Colors.border 
            }]}>
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
          </View>

          {/* Confirm Password Input Field */}
          <View style={styles.inputWrapper}>
            <View style={[styles.inputContainer, { 
              backgroundColor: colors?.inputBackground || Colors.inputBackground,
              borderColor: colors?.border || Colors.border 
            }]}>
              <MaterialIcons 
                name="lock" 
                size={22} 
                color={colors?.text || Colors.textLight} 
                style={styles.icon} 
              />
              <TextInput
                placeholder="Confirm password"
                placeholderTextColor={colors?.text + '80' || Colors.textLight + '80'}
                value={confirmPassword}
                secureTextEntry={showConfirmPass}
                onChangeText={handleInputChange(setConfirmPassword)}
                style={[styles.inputText, { color: colors?.text || Colors.textDark }]}
              />
              <TouchableOpacity 
                onPress={() => setShowConfirmPass(!showConfirmPass)}
                style={styles.eyeIcon}
              >
                <Feather 
                  name={showConfirmPass ? 'eye' : 'eye-off'} 
                  size={20} 
                  color={colors?.text || Colors.textLight} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity 
            onPress={handleSignUp} 
            style={[styles.signUpButton, { backgroundColor: colors?.primary || Colors.primary }]}
            disabled={isLoading}
          >
            {isLoading ? (
              <Text style={styles.buttonText}>Loading...</Text>
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Social Signup Options */}
          <View style={styles.socialSignupContainer}>
            <Text style={[styles.orText, { color: colors?.text || Colors.textLight }]}>
              Or sign up with
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

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={[styles.loginText, { color: colors?.text || Colors.textLight }]}>
              Already have an account?{" "}
            </Text>
            <TouchableOpacity onPress={() => router.replace("/Auth/LoginScreen")}>
              <Text style={[styles.loginLink, { color: colors?.primary || Colors.primary }]}>
                Sign In
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
  eyeIcon: {
    padding: 5,
  },
  signUpButton: {
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
  socialSignupContainer: {
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
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 16,
  },
  loginLink: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

