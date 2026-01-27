import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ImageBackground, Dimensions, Alert, Platform, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import defaultChannels from '../assets/channels.json';
import { loadChannels } from '../utils/storage';

const BG_IMAGES = [
    'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=1920&auto=format&fit=crop', // Coffee
    'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=1920&auto=format&fit=crop', // Forest
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=1920&auto=format&fit=crop', // Nature
    'https://images.unsplash.com/photo-1501854140884-074bf86ee911?q=80&w=1920&auto=format&fit=crop', // Dark Space
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920&auto=format&fit=crop', // Tech
];

const FocusableCard = ({ item, onPress }) => {
    const [focused, setFocused] = useState(false);

    return (
        <TouchableOpacity
            style={[styles.card, focused && styles.cardFocused]}
            onPress={onPress}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            activeOpacity={0.7}
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

export default function HomeScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [bgImage, setBgImage] = useState(BG_IMAGES[0]);
    const [channels, setChannels] = useState([]);

    useFocusEffect(
        React.useCallback(() => {
            const load = async () => {
                const saved = await loadChannels();
                setChannels(saved && saved.length > 0 ? saved : defaultChannels);
            };
            load();
        }, [])
    );

    useEffect(() => {
        const interval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * BG_IMAGES.length);
            setBgImage(BG_IMAGES[randomIndex]);
        }, 15 * 60 * 1000); // 15 minutes
        return () => clearInterval(interval);
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
        <View style={{ width: itemWidth, margin: gap / 2 }}>
            <FocusableCard
                item={item}
                onPress={() => navigation.navigate('Player', { channelIndex: index })}
            />
        </View>
    );

    return (
        <ImageBackground source={{ uri: bgImage }} style={styles.background}>
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
                        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Settings')}>
                            <Text style={styles.iconText}>⚙️</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <FlatList
                    data={channels}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    numColumns={numColumns}
                    key={numColumns} // Force re-render when columns change
                    contentContainerStyle={styles.grid}
                />
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background: { flex: 1, width: '100%', height: '100%' },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)' },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)' },
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
        borderColor: '#00BFFF', // DeepSkyBlue
        backgroundColor: 'rgba(255,255,255,0.15)',
        transform: [{ scale: 1.05 }],
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
});
