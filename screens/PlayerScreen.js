import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Dimensions, TVEventHandler, Platform } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import defaultChannels from '../assets/channels.json';
import { loadChannels } from '../utils/storage';

const { width, height } = Dimensions.get('window');

export default function PlayerScreen({ route, navigation }) {
    const { channelIndex: initialIndex } = route.params;
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [showInfo, setShowInfo] = useState(true);
    const videoRef = useRef(null);
    const tvEventHandler = useRef(null);
    const insets = useSafeAreaInsets();

    const [channelList, setChannelList] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const saved = await loadChannels();
            setChannelList(saved && saved.length > 0 ? saved : defaultChannels);
            setLoading(false);
        };
        load();

        // Lock to landscape
        const lockOrientation = async () => {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        };
        lockOrientation();

        return () => {
            // Unlock on exit
            ScreenOrientation.unlockAsync();
        };
    }, []);

    const currentChannel = channelList[currentIndex] || defaultChannels[0];

    useEffect(() => {
        if (Platform.isTV) {
            tvEventHandler.current = new TVEventHandler();
            tvEventHandler.current.enable(null, (cmp, evt) => {
                if (evt && evt.eventType === 'up') {
                    changeChannel('next');
                } else if (evt && evt.eventType === 'down') {
                    changeChannel('prev');
                } else if (evt && evt.eventType === 'select') {
                    // Toggle play/pause or show info
                    setShowInfo(prev => !prev);
                }
            });
        } else if (Platform.OS === 'web') {
            // Web fallback
            const handleKeyDown = (e) => {
                if (e.key === 'ArrowUp') {
                    changeChannel('next');
                } else if (e.key === 'ArrowDown') {
                    changeChannel('prev');
                } else if (e.key === 'Enter') {
                    setShowInfo(prev => !prev);
                }
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }

        return () => {
            if (tvEventHandler.current) {
                tvEventHandler.current.disable();
            }
        };
    }, []);

    useEffect(() => {
        // Show info when channel changes, then hide
        setShowInfo(true);
        const timer = setTimeout(() => setShowInfo(false), 3000);
        return () => clearTimeout(timer);
    }, [currentIndex]);

    const changeChannel = (direction) => {
        if (channelList.length === 0) return;
        if (direction === 'next') {
            setCurrentIndex((prev) => (prev + 1) % channelList.length);
        } else {
            setCurrentIndex((prev) => (prev - 1 + channelList.length) % channelList.length);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <Text style={{ color: 'white' }}>Loading...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Video
                ref={videoRef}
                style={styles.video}
                source={{ uri: currentChannel.url }}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping={false}
                useNativeControls={false}
            />

            {showInfo && (
                <View style={[styles.overlay, {
                    bottom: Math.max(50, insets.bottom + 20),
                    left: Math.max(50, insets.left + 20)
                }]}>
                    <Text style={styles.channelNumber}>{currentIndex + 1}</Text>
                    <Text style={styles.channelName}>{currentChannel.name}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    video: {
        width: width,
        height: height,
    },
    overlay: {
        position: 'absolute',
        bottom: 50,
        left: 50,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 20,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    channelNumber: {
        fontSize: 48,
        color: '#FFD700',
        fontWeight: 'bold',
        marginRight: 20,
    },
    channelName: {
        fontSize: 32,
        color: '#fff',
        fontWeight: '600',
    },
});
