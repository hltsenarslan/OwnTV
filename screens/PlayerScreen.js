import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Dimensions, TVEventHandler, Platform, TouchableWithoutFeedback, PanResponder, TouchableOpacity } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Brightness from 'expo-brightness';
import * as NavigationBar from 'expo-navigation-bar';
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

    // Controls State
    const [volume, setVolume] = useState(1.0);
    const [isMuted, setIsMuted] = useState(false);
    const [brightness, setBrightness] = useState(0.5);
    const volumeRef = useRef(1.0); // Ref to track volume for PanResponder
    const lastVolumeRef = useRef(1.0); // To restore volume after unmute
    const isMutedRef = useRef(false); // Ref for PanResponder to access current mute state

    // Gesture Feedback State
    const [gestureFeedback, setGestureFeedback] = useState({ visible: false, icon: '', value: 0 });

    // Pan Responder Helpers
    const isSwiping = useRef(false);
    const startY = useRef(0);
    const startValue = useRef(0); // stores initial Vol/Bright at start of gesture

    useEffect(() => {
        const load = async () => {
            const saved = await loadChannels();
            setChannelList(saved && saved.length > 0 ? saved : defaultChannels);
            setLoading(false);
        };
        load();

        // Lock to landscape & Permission
        const setup = async () => {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            const { status } = await Brightness.requestPermissionsAsync();
            if (status === 'granted') {
                const cur = await Brightness.getBrightnessAsync();
                setBrightness(cur);
            }
        };
        setup();

        return () => {
            // Unlock on exit
            ScreenOrientation.unlockAsync();
            Brightness.restoreSystemBrightnessAsync();
            if (Platform.OS === 'android') {
                NavigationBar.setVisibilityAsync('visible');
            }
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
                    // Show info for 3 seconds
                    setShowInfo(true);
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
        // Handle Immersive Mode (Android specific)
        if (Platform.OS === 'android') {
            if (showInfo) {
                NavigationBar.setVisibilityAsync('visible');
            } else {
                NavigationBar.setVisibilityAsync('hidden');
                NavigationBar.setBehaviorAsync('overlay-swipe');
            }
        }

        // Auto-hide info after 3 seconds if it's visible, unless swiping
        if (showInfo && !isSwiping.current) {
            const timer = setTimeout(() => setShowInfo(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showInfo, currentIndex]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only claim responder if moved more than 10px (ignore taps)
                return Math.abs(gestureState.dy) > 10;
            },
            onPanResponderGrant: async (evt, gestureState) => {
                isSwiping.current = true;
                startY.current = gestureState.y0;

                const { width } = Dimensions.get('window');
                if (gestureState.x0 < width / 2) {
                    // Brightness
                    startValue.current = await Brightness.getBrightnessAsync();
                } else {
                    // Volume
                    // If muted, start from 0
                    startValue.current = (isMutedRef.current || volumeRef.current === 0) ? 0 : volumeRef.current;
                }
            },
            onPanResponderMove: async (evt, gestureState) => {
                const { height, width } = Dimensions.get('window');
                const delta = -gestureState.dy / (height * 0.8);

                let newValue = Math.max(0, Math.min(1, startValue.current + delta));
                const percent = Math.round(newValue * 100);

                if (gestureState.x0 < width / 2) {
                    // Brightness
                    setBrightness(newValue);
                    Brightness.setBrightnessAsync(newValue);
                    setGestureFeedback({ visible: true, icon: '☀️', value: percent });
                } else {
                    // Volume
                    setVolume(newValue);
                    volumeRef.current = newValue;

                    // Check ref for current mute status
                    if (isMutedRef.current && newValue > 0) {
                        setIsMuted(false);
                        isMutedRef.current = false;
                    }

                    setGestureFeedback({ visible: true, icon: '🔊', value: percent });
                }
            },
            onPanResponderRelease: (evt, gestureState) => {
                isSwiping.current = false;
                setGestureFeedback({ visible: false, icon: '', value: 0 }); // Hide feedback

                if (Math.abs(gestureState.dy) < 10 && Math.abs(gestureState.dx) < 10) {
                    setShowInfo(true);
                }
            }
        })
    ).current;

    const changeChannel = (direction) => {
        if (channelList.length === 0) return;
        if (direction === 'next') {
            setCurrentIndex((prev) => (prev + 1) % channelList.length);
        } else {
            setCurrentIndex((prev) => (prev - 1 + channelList.length) % channelList.length);
        }
    };

    const toggleMute = () => {
        if (isMuted) {
            // Unmute: Restore last volume
            setVolume(lastVolumeRef.current);
            volumeRef.current = lastVolumeRef.current;
            setIsMuted(false);
            isMutedRef.current = false;
            setGestureFeedback({ visible: true, icon: '🔊', value: Math.round(lastVolumeRef.current * 100) });
        } else {
            // Mute: Save current volume
            lastVolumeRef.current = volume;
            setVolume(0);
            volumeRef.current = 0;
            setIsMuted(true);
            isMutedRef.current = true;
            setGestureFeedback({ visible: true, icon: '🔇', value: 0 });
        }
        setTimeout(() => setGestureFeedback({ visible: false, icon: '', value: 0 }), 1000);
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <Text style={{ color: 'white' }}>Loading...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container} {...panResponder.panHandlers}>
            <Video
                ref={videoRef}
                style={styles.video}
                source={{ uri: currentChannel.url }}
                resizeMode={ResizeMode.STRETCH}
                shouldPlay
                isLooping={false}
                useNativeControls={false}
                volume={volume}
                isMuted={isMuted}
            />

            {showInfo && (
                <>
                    {/* Back Button (Top Left) */}
                    {!Platform.isTV && (
                        <TouchableOpacity
                            style={[styles.backButton, { top: Math.max(20, insets.top + 10), left: Math.max(20, insets.left + 10) }]}
                            onPress={() => navigation.goBack()}
                        >
                            <Text style={styles.backButtonText}>← Back</Text>
                        </TouchableOpacity>
                    )}

                    {/* Info Overlay */}
                    <View style={[styles.overlay, {
                        bottom: Math.max(50, insets.bottom + 20),
                        left: Math.max(50, insets.left + 20)
                    }]}>
                        <Text style={styles.channelNumber}>{currentIndex + 1}</Text>
                        <Text style={styles.channelName}>{currentChannel.name}</Text>
                    </View>

                    {/* Mute Button (Bottom Right) */}
                    <TouchableOpacity
                        style={[styles.muteButton, {
                            bottom: Math.max(50, insets.bottom + 20),
                            right: Math.max(50, insets.right + 20)
                        }]}
                        onPress={toggleMute}
                    >
                        <Text style={styles.muteIcon}>{isMuted ? '🔇' : '🔊'}</Text>
                    </TouchableOpacity>
                </>
            )}

            {/* Gesture Feedback (Center) */}
            {gestureFeedback.visible && (
                <View style={styles.feedbackContainer}>
                    <Text style={styles.feedbackIcon}>{gestureFeedback.icon}</Text>
                    <Text style={styles.feedbackText}>{gestureFeedback.value}%</Text>
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
        width: '100%',
        height: '100%',
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
    backButton: {
        position: 'absolute',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        zIndex: 10,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    feedbackContainer: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 30,
        borderRadius: 20,
    },
    feedbackIcon: {
        fontSize: 60,
        marginBottom: 10,
    },
    feedbackText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
    },
    muteButton: {
        position: 'absolute',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 15,
        borderRadius: 30, // Circle
        justifyContent: 'center',
        alignItems: 'center',
    },
    muteIcon: {
        fontSize: 30,
        color: '#fff',
    },
});
