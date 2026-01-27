
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHANNELS_STORAGE_KEY = '@owntv_selected_channels';

/**
 * Saves the list of selected channels to AsyncStorage.
 * @param {Array} channels - Array of channel objects to save.
 * @returns {Promise<void>}
 */
export const saveChannels = async (channels) => {
    try {
        const jsonValue = JSON.stringify(channels);
        await AsyncStorage.setItem(CHANNELS_STORAGE_KEY, jsonValue);
    } catch (e) {
        console.error('Error saving channels to storage:', e);
    }
};

/**
 * Loads the list of selected channels from AsyncStorage.
 * @returns {Promise<Array>} Array of channel objects, or null if none saved.
 */
export const loadChannels = async () => {
    try {
        const jsonValue = await AsyncStorage.getItem(CHANNELS_STORAGE_KEY);
        return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
        console.error('Error loading channels from storage:', e);
        return null;
    }
};
