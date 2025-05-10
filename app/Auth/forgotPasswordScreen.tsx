import { Text, View, StyleSheet, StatusBar, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import React, { useState, useEffect } from "react";
import Colors from '@/src/constants/color';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from "expo-router";
import { supabase } from "../../supabase.config";
import { useTheme } from '@/src/context/ThemeContext';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorDisp, setErrorDisp] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Clear errors when component mounts
  useEffect(() => {
    setErrorDisp(null);
    setEmailError(null);
    setSuccessMessage(null);
  }, []);

  // Higher-order function to handle input change
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
    setter(value);
    // Clear errors when user types
    setErrorDisp(null);
    setEmailError(null);
    setSuccessMessage(null);
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
    
    return isValid;
  };

  // Handle password reset with Supabase
  const handlePasswordReset = async () => {
    // Validate form before proceeding
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrorDisp(null);
    setSuccessMessage(null);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'yourapp://reset-password',
      });

      if (error) {
        // Handle specific error cases
        if (error.message.includes("rate limit")) {
          setErrorDisp("Too many attempts. Please try again later.");
        } else if (error.message.includes("not found")) {
          setErrorDisp("No account found with this email address.");
        } else {
          setErrorDisp(error.message || "An error occurred during password reset");
        }
        return;
      }

      // Success case
      setSuccessMessage("Password reset instructions have been sent to your email.");
      
      // Navigate back to login after a delay
      setTimeout(() => {
        router.replace("/Auth/LoginScreen");
      }, 3000);
      
    } catch (error: any) {
      console.error("Password reset error:", error);
      
      // Handle network errors
      if (error.message?.includes("network") || error.message?.includes("timeout")) {
        setErrorDisp("Network error. Please check your internet connection and try again.");
      } else {
        setErrorDisp(error.message || "An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[myStyles.container, { backgroundColor: colors?.background || Colors.backgroundLight }]}>
      <StatusBar 
        barStyle={colors?.text === '#FFFFFF' ? 'light-content' : 'dark-content'} 
        backgroundColor={colors?.background || Colors.backgroundLight} 
      />

      <View style={[myStyles.contentContainer, { backgroundColor: colors?.card || Colors.card }]}>
        <Text style={[myStyles.heading, { color: colors?.primary || Colors.primary }]}>Forgot Password</Text>
        <Text style={[myStyles.subheading, { color: colors?.text || Colors.textLight }]}>
          Enter your email address and we'll send you instructions to reset your password.
        </Text>

        {/* Error Display */}
        {errorDisp && (
          <View style={[myStyles.errorContainer, { backgroundColor: colors?.errorBackground || '#FFEBEE' }]}>
            <Ionicons name="alert-circle" size={20} color={colors?.error || '#D32F2F'} />
            <Text style={[myStyles.errorText, { color: colors?.error || '#D32F2F' }]}>
              {errorDisp}
            </Text>
          </View>
        )}

        {/* Success Message */}
        {successMessage && (
          <View style={[myStyles.successContainer, { backgroundColor: colors?.successBackground || '#E8F5E9' }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors?.success || '#4CAF50'} />
            <Text style={[myStyles.successText, { color: colors?.success || '#4CAF50' }]}>
              {successMessage}
            </Text>
          </View>
        )}

        <View style={[
          myStyles.inputContainer, 
          { 
            backgroundColor: colors?.card || Colors.card,
            borderColor: emailError ? (colors?.error || '#D32F2F') : (colors?.border || Colors.border)
          }
        ]}>
          <MaterialIcons
            name="email"
            size={24}
            color={colors?.text || Colors.textLight}
            style={myStyles.icon}
          />
          <TextInput
            placeholder="Enter your email"
            placeholderTextColor={colors?.text + '80' || Colors.textLight + '80'}
            value={email}
            onChangeText={handleInputChange(setEmail)}
            style={[myStyles.inputText, { color: colors?.text || Colors.textDark }]}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        
        {emailError && (
          <Text style={[myStyles.fieldErrorText, { color: colors?.error || '#D32F2F' }]}>
            {emailError}
          </Text>
        )}

        <TouchableOpacity 
          onPress={handlePasswordReset} 
          style={[
            myStyles.button, 
            { 
              backgroundColor: colors?.primary || Colors.primary,
              opacity: isLoading ? 0.7 : 1
            }
          ]}
          disabled={isLoading}
        >
          {isLoading ? (
            <View style={myStyles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.textWhite} />
              <Text style={{ color: Colors.textWhite, fontSize: 18, fontWeight: "bold", marginLeft: 10 }}>
                Sending...
              </Text>
            </View>
          ) : (
            <Text style={{ color: Colors.textWhite, fontSize: 18, fontWeight: "bold" }}>
              Send Reset Instructions
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.back()} 
          style={[myStyles.backButton, { borderColor: colors?.border || Colors.border }]}
        >
          <Text style={{ color: colors?.text || Colors.textLight, fontSize: 16 }}>
            Back to Login
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const myStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  contentContainer: {
    width: "100%",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    gap: 20,
  },
  heading: {
    fontSize: 25,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subheading: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    width: '100%',
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    width: '100%',
  },
  successText: {
    marginLeft: 8,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: "row",
    width: "100%",
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 10,
  },
  inputText: {
    height: 50,
    width: "80%",
    paddingLeft: 20,
    fontSize: 16,
  },
  fieldErrorText: {
    fontSize: 12,
    marginTop: 5,
    marginBottom: 10,
    alignSelf: 'flex-start',
    marginLeft: 10,
  },
  button: {
    width: "100%",
    height: 50,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    width: "100%",
    height: 50,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  icon: {
    marginRight: 5,
    marginLeft: 10,
  },
});
