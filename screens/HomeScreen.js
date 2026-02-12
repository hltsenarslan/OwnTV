import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ImageBackground, Dimensions, Alert, Platform, useWindowDimensions, TVEventHandler, ToastAndroid } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import defaultChannels from '../assets/channels.json'; // Removed dummy channels
import { loadChannels } from '../utils/storage';
import { initializeBackground, prefetchNextBackground } from '../utils/backgroundManager';

const FocusableCard = ({ item, onPress, hasTVPreferredFocus }) => {
    const [focused, setFocused] = useState(false);

    return (
        <TouchableOpacity
            style={[styles.card, focused && styles.cardFocused]}
            onPress={onPress}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            activeOpacity={0.7}
            hasTVPreferredFocus={hasTVPreferredFocus}
        >
            {/* Use a default image or broken image handler if needed, but for now assuming URLs work */}
            {item.logo ? (
                <Image source={{ uri: item.logo }} style={styles.logo} resizeMode="contain" />
            ) : (
                <View style={styles.placeholderLogo} />
            )}
            <Text style={styles.channelName}>{item.name}</Text>
        </TouchableOpacity>
    );
};

// Helper for Settings Button Focus
const FocusableButton = ({ onPress, style, children, focusedStyle }) => {
    const [focused, setFocused] = useState(false);
    return (
        <TouchableOpacity
            onPress={onPress}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[style, focused && (focusedStyle || styles.buttonFocused)]}
            activeOpacity={0.7}
        >
            {children}
        </TouchableOpacity>
    );
};

export default function HomeScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [bgImage, setBgImage] = useState(null); // URL or file path
    const [channels, setChannels] = useState([]);

    // TV Remote Debugger - Shows key codes in Toast messages
    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const tvEventHandler = new TVEventHandler();

        const handleTVEvent = (component, evt) => {
            const { eventType, eventKeyAction } = evt;
            const message = `Key: ${eventType}\nAction: ${eventKeyAction || 'press'}`;

            console.log('🎮 TV Remote Event:', evt);
            ToastAndroid.show(message, ToastAndroid.LONG);
        };

        tvEventHandler.enable(null, handleTVEvent);

        return () => {
            if (tvEventHandler) {
                tvEventHandler.disable();
            }
        };
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            const load = async () => {
                const saved = await loadChannels();
                setChannels(saved || []); // No fallback to defaultChannels
            };
            load();
        }, [])
    );

    useEffect(() => {
        const setupBg = async () => {
            // 1. Get the current background (from cache or download first time)
            const uri = await initializeBackground();
            if (uri) setBgImage(uri);

            // 2. Prefetch the next background for future use
            prefetchNextBackground();
        };
        setupBg();
    }, []);

    const { width: screenWidth } = useWindowDimensions();

    // Dynamic Responsive Layout Calculation
    const getColumnCount = (width) => {
        if (width < 600) return 2;      // Mobile phones
        if (width < 900) return 3;      // Small tablets / Foldables
        if (width < 1200) return 4;     // Tablets / Small TV
        if (width < 1500) return 5;     // 1080p TV
        return 6;                       // Large TV / 4K
    };

    const numColumns = getColumnCount(screenWidth);
    const isSmallScreen = screenWidth < 600;

    const gap = isSmallScreen ? 10 : 20;
    // Add horizontal insets to container padding deduction
    const horizontalInsets = insets.left + insets.right;
    const basePadding = isSmallScreen ? 20 : 60;
    const containerPadding = basePadding + horizontalInsets;

    const availableWidth = screenWidth - containerPadding;
    const itemWidth = (availableWidth / numColumns) - gap;

    const renderItem = ({ item, index }) => (
        <View style={{ width: itemWidth, margin: gap / 2, overflow: 'visible' }}>
            <FocusableCard
                item={item}
                onPress={() => navigation.navigate('Player', { channelIndex: index })}
                hasTVPreferredFocus={index === 0} // FORCE FOCUS on the first element
            />
        </View>
    );

    // If no background logic is ready yet, we can fallback or just wait. ImageBackground handles null source gracefully-ish (shows nothing).
    // But we can add a default plain bg just in case.
    const imageSource = bgImage ? { uri: bgImage } : { uri: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920&auto=format&fit=crop' };

    return (
        <ImageBackground source={imageSource} style={styles.background}>
            <View style={styles.overlay} />
            <View style={[styles.container, {
                paddingTop: insets.top + 20,
                paddingBottom: insets.bottom + 20,
                paddingLeft: insets.left + (isSmallScreen ? 15 : 30),
                paddingRight: insets.right + (isSmallScreen ? 15 : 30)
            }]}>
                <View style={styles.header}>
                    <Text style={styles.title}>Canlı TV</Text>
                    <View style={styles.headerButtons}>
                        <FocusableButton style={styles.iconButton} onPress={() => navigation.navigate('Settings')}>
                            <Text style={styles.iconText}>⚙️</Text>
                        </FocusableButton>
                    </View>
                </View>
                {channels.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                        <Text style={styles.emptyStateText}>Listeyi görüntülemek için ayarlardan kanal ekleyiniz</Text>
                        <FocusableButton
                            style={styles.ctaButton}
                            onPress={() => navigation.navigate('Settings')}
                            focusedStyle={styles.ctaButtonFocused}
                        >
                            <Text style={styles.ctaButtonText}>Kanalları Ayarla</Text>
                        </FocusableButton>
                    </View>
                ) : (
                    <FlatList
                        data={channels}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        numColumns={numColumns}
                        key={numColumns}
                        contentContainerStyle={styles.grid}
                    />
                )}
            </View>
            <View style={[styles.versionBadge, { bottom: insets.bottom + 10, right: insets.right + 20 }]}>
                <Text style={styles.versionText}>v1.1.0</Text>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background: { flex: 1, width: '100%', height: '100%' },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.60)' }, // Lighter overlay
    container: { flex: 1, padding: 30, justifyContent: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 36, color: '#fff', fontWeight: 'bold', marginLeft: 10 },
    headerButtons: { flexDirection: 'row' },
    iconButton: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 8, marginLeft: 10 },
    iconText: { color: 'white', fontSize: 16 },
    grid: { paddingBottom: 20 },
    card: {
        width: '100%',
        aspectRatio: 1.2,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'transparent',
    },
    cardFocused: {
        backgroundColor: 'rgba(255, 0, 0, 0.6)', // Red overlay for testing
        transform: [{ scale: 1.05 }],
        borderColor: '#FF0000', // Red border
        borderWidth: 4,
        shadowColor: "#FF0000",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 20,
        elevation: 20,
    },
    buttonFocused: {
        backgroundColor: '#FF0000', // Red background
        borderColor: '#FFF',
        borderWidth: 3,
        transform: [{ scale: 1.1 }],
    },
    logo: { width: '60%', height: '60%', marginBottom: 15 },
    placeholderLogo: {
        width: '50%',
        height: '50%',
        marginBottom: 15,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
    },
    channelName: { color: '#eee', fontSize: 16, fontWeight: '600', textAlign: 'center' },
    emptyStateContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyStateText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    ctaButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    ctaButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    ctaButtonFocused: {
        backgroundColor: '#FF0000', // Red background
        transform: [{ scale: 1.1 }],
        borderWidth: 4,
        borderColor: '#FFFFFF',
        shadowColor: "#FF0000",
        shadowOpacity: 1,
        elevation: 20,
    },
    versionBadge: {
        position: 'absolute',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    versionText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '600',
    },
});
