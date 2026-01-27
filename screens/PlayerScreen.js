import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Dimensions, Platform, TouchableWithoutFeedback, PanResponder, TouchableOpacity } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Brightness from 'expo-brightness';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import defaultChannels from '../assets/channels.json';
import { loadChannels } from '../utils/storage';

const { width, height } = Dimensions.get('window');

// Helper Component for Focus Handling
const FocusableButton = ({ onPress, style, children, focusStyle }) => {
    const [focused, setFocused] = useState(false);
    return (
        <TouchableOpacity
            onPress={onPress}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[style, focused && (focusStyle || styles.focusedItem)]}
            activeOpacity={0.7}
        >
            {children}
        </TouchableOpacity>
    );
};

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
            try {
                // Orientation is usually fixed on TV, locking might error or be useless
                if (!Platform.isTV) {
                    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
                }

                // Brightness control not available on TV
                if (!Platform.isTV) {
                    const { status } = await Brightness.requestPermissionsAsync();
                    if (status === 'granted') {
                        const cur = await Brightness.getBrightnessAsync();
                        setBrightness(cur);
                    }
                }
            } catch (e) {
                console.warn('Setup error:', e);
            }
        };
        setup();

        return () => {
            // Unlock on exit
            try {
                if (!Platform.isTV) {
                    ScreenOrientation.unlockAsync();
                    Brightness.restoreSystemBrightnessAsync();
                }
                if (Platform.OS === 'android' && !Platform.isTV) {
                    // Some TVs crash on nav bar manipulation
                    NavigationBar.setVisibilityAsync('visible').catch(() => { });
                }
            } catch (e) {
                console.warn('Cleanup error:', e);
            }
        };
    }, []);

    const currentChannel = channelList[currentIndex] || defaultChannels[0];

    /* TVEventHandler removed to prevent crash on non-TV platforms */

    useEffect(() => {
        // Handle Immersive Mode (Android specific)
        if (Platform.OS === 'android' && !Platform.isTV) {
            // TV usually handles its own bars or has none. Explicitly toggling might crash on some boxes.
            if (showInfo) {
                NavigationBar.setVisibilityAsync('visible').catch(() => { });
            } else {
                NavigationBar.setVisibilityAsync('hidden').catch(() => { });
                // Note: setBehaviorAsync is not supported with edge-to-edge enabled
                // NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => { });
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
        <View style={styles.container}>
            {/* Video Layer (Bottom) */}
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
                onError={(e) => console.warn('Video Error:', e)}
            />

            {/* Invisible Event Capture Overlay (Always Active) */}
            <TouchableOpacity
                style={styles.eventCaptureOverlay}
                activeOpacity={1}
                focusable={true}
                hasTVPreferredFocus={true}
                onPress={() => {
                    setShowInfo(prev => !prev);
                }}
            />

            {/* 4-Directional Button Grid for D-Pad Control */}

            {/* UP Button - Next Channel */}
            <TouchableOpacity
                style={[styles.invisibleButton, {
                    top: 0,
                    left: '25%',
                    width: '50%',
                    height: '25%'
                }]}
                activeOpacity={1}
                focusable={true}
                onFocus={() => {
                    console.log('📺 UP BUTTON FOCUSED - Next Channel');
                    changeChannel('next');
                    setShowInfo(true);
                }}
                onPress={() => {
                    changeChannel('next');
                    setShowInfo(true);
                }}
            />

            {/* DOWN Button - Previous Channel */}
            <TouchableOpacity
                style={[styles.invisibleButton, {
                    bottom: 0,
                    left: '25%',
                    width: '50%',
                    height: '25%'
                }]}
                activeOpacity={1}
                focusable={true}
                onFocus={() => {
                    console.log('📺 DOWN BUTTON FOCUSED - Prev Channel');
                    changeChannel('prev');
                    setShowInfo(true);
                }}
                onPress={() => {
                    changeChannel('prev');
                    setShowInfo(true);
                }}
            />

            {/* LEFT Button - Volume Down */}
            <TouchableOpacity
                style={[styles.invisibleButton, {
                    left: 0,
                    top: '25%',
                    width: '25%',
                    height: '50%'
                }]}
                activeOpacity={1}
                focusable={true}
                onFocus={() => {
                    console.log('📺 LEFT BUTTON FOCUSED - Volume Down');
                    const newVolume = Math.max(0, volume - 0.1);
                    setVolume(newVolume);
                    volumeRef.current = newVolume;
                    setGestureFeedback({ visible: true, icon: '🔊', value: Math.round(newVolume * 100) });
                    setTimeout(() => setGestureFeedback({ visible: false, icon: '', value: 0 }), 1000);
                }}
                onPress={() => {
                    const newVolume = Math.max(0, volume - 0.1);
                    setVolume(newVolume);
                    volumeRef.current = newVolume;
                    setGestureFeedback({ visible: true, icon: '🔊', value: Math.round(newVolume * 100) });
                    setTimeout(() => setGestureFeedback({ visible: false, icon: '', value: 0 }), 1000);
                }}
            />

            {/* RIGHT Button - Volume Up */}
            <TouchableOpacity
                style={[styles.invisibleButton, {
                    right: 0,
                    top: '25%',
                    width: '25%',
                    height: '50%'
                }]}
                activeOpacity={1}
                focusable={true}
                onFocus={() => {
                    console.log('📺 RIGHT BUTTON FOCUSED - Volume Up');
                    const newVolume = Math.min(1, volume + 0.1);
                    setVolume(newVolume);
                    volumeRef.current = newVolume;
                    setGestureFeedback({ visible: true, icon: '🔊', value: Math.round(newVolume * 100) });
                    setTimeout(() => setGestureFeedback({ visible: false, icon: '', value: 0 }), 1000);
                }}
                onPress={() => {
                    const newVolume = Math.min(1, volume + 0.1);
                    setVolume(newVolume);
                    volumeRef.current = newVolume;
                    setGestureFeedback({ visible: true, icon: '🔊', value: Math.round(newVolume * 100) });
                    setTimeout(() => setGestureFeedback({ visible: false, icon: '', value: 0 }), 1000);
                }}
            />

            {/* Info Overlay (Conditional) */}
            {showInfo && (
                <>
                    {/* Back Button (Top Left) */}
                    {!Platform.isTV && (
                        <FocusableButton
                            style={[styles.backButton, { top: Math.max(20, insets.top + 10), left: Math.max(20, insets.left + 10) }]}
                            onPress={() => navigation.goBack()}
                        >
                            <Text style={styles.backButtonText}>← Back</Text>
                        </FocusableButton>
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
                    <FocusableButton
                        style={[styles.muteButton, {
                            bottom: Math.max(50, insets.bottom + 20),
                            right: Math.max(50, insets.right + 20)
                        }]}
                        onPress={toggleMute}
                    >
                        <Text style={styles.muteIcon}>{isMuted ? '🔇' : '🔊'}</Text>
                    </FocusableButton>
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
    eventCaptureOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        zIndex: 1,
    },
    invisibleButton: {
        position: 'absolute',
        backgroundColor: 'transparent',
        zIndex: 2,
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
    focusedItem: {
        backgroundColor: 'rgba(255, 105, 180, 0.6)', // Pink tint
        borderRadius: 8,
        transform: [{ scale: 1.15 }],
        borderWidth: 3,
        borderColor: '#FFFFFF',
        shadowColor: "#FF69B4",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
        elevation: 10,
    },
});
