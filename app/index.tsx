import { StatusBar, StyleSheet, Text, View, Image, ActivityIndicator, Animated, Easing } from 'react-native'
import React, { useEffect, useRef } from 'react'
import Colors from '@/src/constants/color'
import { useTheme } from '@/src/context/ThemeContext';

/**
 * Splash Screen Component
 * 
 * This component serves as the initial visual entry point to the app.
 * It displays a branded splash screen with animations while the authentication check
 * happens in the background (handled by _layout.tsx).
 * 
 * This component does NOT handle any authentication logic to avoid
 * the "AuthSessionMissingError" that can occur when trying to access
 * auth state before the app is fully initialized.
 */
const Index = () => {
    const { colors } = useTheme();
    
    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const spinValue = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    
    // Start animations when component mounts
    useEffect(() => {
        // Fade in animation
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start();
        
        // Scale animation
        Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.out(Easing.back(1.5)),
            useNativeDriver: true,
        }).start();
        
        // Spinning animation for the loading indicator
        Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 2000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
        
        // Pulse animation for the logo
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                })
            ])
        ).start();
    }, []);
    
    // Interpolate rotation for the loading indicator
    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    return (
        <View style={[styles.container, { backgroundColor: colors?.background || Colors.backgroundLight }]}>
            <StatusBar 
                barStyle={colors?.text === '#FFFFFF' ? 'light-content' : 'dark-content'} 
                backgroundColor={colors?.background || Colors.backgroundLight} 
            />
            
            <View style={[styles.upperContainer, { backgroundColor: colors?.primary || Colors.primary }]}>
                <View style={styles.patternContainer}>
                    {[...Array(20)].map((_, i) => (
                        <View 
                            key={i} 
                            style={[
                                styles.patternDot, 
                                { 
                                    backgroundColor: colors?.white + '20' || Colors.textWhite + '20',
                                    left: `${Math.random() * 100}%`,
                                    top: `${Math.random() * 100}%`,
                                    width: Math.random() * 10 + 5,
                                    height: Math.random() * 10 + 5,
                                    borderRadius: Math.random() * 5 + 2,
                                }
                            ]} 
                        />
                    ))}
                </View>
                
                <Animated.View 
                    style={[
                        styles.logoContainer,
                        { 
                            opacity: fadeAnim,
                            transform: [
                                { scale: scaleAnim },
                                { scale: pulseAnim }
                            ]
                        }
                    ]}
                >
                    <Image 
                        source={require('../src/assets/images/person.png')} 
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <Text style={[styles.appName, { color: colors?.white || Colors.textWhite }]}>
                        Your App Name
                    </Text>
                    <Text style={[styles.tagline, { color: colors?.white + 'CC' || Colors.textWhite + 'CC' }]}>
                        Connect • Share • Inspire
                    </Text>
                </Animated.View>
            </View>

            <View style={[styles.lowerContainer, { backgroundColor: colors?.background || Colors.backgroundLight }]}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <ActivityIndicator size="large" color={colors?.primary || Colors.primary} />
                </Animated.View>
                <Text style={[styles.loadingText, { color: colors?.text || Colors.textDark }]}>
                    Loading...
                </Text>
            </View>
        </View>
    );
}

export default Index

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundLight
    },
    upperContainer: {
        height: "85%",
        width: "100%",
        backgroundColor: Colors.primary,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: -20,
        overflow: 'hidden',
    },
    patternContainer: {
        position: 'absolute',
        width: '100%',
        height: '100%',
    },
    patternDot: {
        position: 'absolute',
    },
    logoContainer: {
        alignItems: "center",
        justifyContent: "center",
    },
    lowerContainer: {
        width: "100%",
        height: "15%",
        backgroundColor: Colors.backgroundLight,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingTop: 20,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -3,
        },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 5,
    },
    logo: {
        width: 120,
        height: 120,
        marginBottom: 20,
    },
    appName: {
        fontSize: 28,
        fontWeight: "bold",
        color: Colors.textWhite,
        marginBottom: 8,
    },
    tagline: {
        fontSize: 16,
        color: Colors.textWhite + 'CC',
        marginBottom: 20,
    },
    loadingText: {
        fontSize: 16,
        marginTop: 10,
        fontWeight: "500",
    }
})