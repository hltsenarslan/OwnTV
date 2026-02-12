import { useEffect } from 'react';
import { Platform, ToastAndroid, BackHandler } from 'react-native';

/**
 * TV Remote Debugger Hook
 * Displays Toast messages with key codes when remote buttons are pressed
 * This helps identify which remote buttons map to which key codes
 */
export const useRemoteDebugger = (enabled = true) => {
    useEffect(() => {
        if (!enabled || Platform.OS !== 'android') return;

        const handleKeyDown = (event) => {
            const { eventKeyAction, eventType, tag } = event;

            // Log to console
            console.log('🎮 Remote Key Event:', {
                eventKeyAction,
                eventType,
                tag,
                fullEvent: event
            });

            // Show Toast with key information
            const message = `Key: ${eventType || 'Unknown'}\nAction: ${eventKeyAction || 'N/A'}\nTag: ${tag || 'N/A'}`;
            ToastAndroid.show(message, ToastAndroid.SHORT);

            return false; // Don't prevent default behavior
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            ToastAndroid.show('Back Button Pressed', ToastAndroid.SHORT);
            console.log('🎮 Back button pressed');
            return false; // Let the default behavior continue
        });

        // For Android TV, we need to listen to hardware key events
        // This is handled automatically by react-native-tvos through the native layer
        // But we can add additional logging here if needed

        return () => {
            backHandler.remove();
        };
    }, [enabled]);
};

/**
 * Get key code name from numeric code
 * Common Android TV remote key codes
 */
export const getKeyCodeName = (keyCode) => {
    const keyCodes = {
        19: 'DPAD_UP',
        20: 'DPAD_DOWN',
        21: 'DPAD_LEFT',
        22: 'DPAD_RIGHT',
        23: 'DPAD_CENTER (SELECT)',
        66: 'ENTER',
        4: 'BACK',
        85: 'PLAY/PAUSE',
        86: 'STOP',
        87: 'NEXT',
        88: 'PREVIOUS',
        89: 'REWIND',
        90: 'FAST_FORWARD',
        24: 'VOLUME_UP',
        25: 'VOLUME_DOWN',
        164: 'MUTE',
        82: 'MENU',
        3: 'HOME',
        222: 'GUIDE',
        172: 'INFO',
    };

    return keyCodes[keyCode] || `UNKNOWN (${keyCode})`;
};
