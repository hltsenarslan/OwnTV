import * as FileSystem from 'expo-file-system/legacy';

const CURRENT_BG_PATH = FileSystem.documentDirectory + 'current_bg.jpg';
const NEXT_BG_PATH = FileSystem.documentDirectory + 'next_bg.jpg';

// Using Lorem Picsum for reliable random 1920x1080 backgrounds
// Unsplash Source is deprecated, so this is a great free alternative.
const getRandomUrl = () => {
    // Add a random query param to ensure we get a new image every time
    return `https://picsum.photos/1920/1080?random=${Date.now()}`;
};

export const initializeBackground = async () => {
    try {
        const nextInfo = await FileSystem.getInfoAsync(NEXT_BG_PATH);
        const currentInfo = await FileSystem.getInfoAsync(CURRENT_BG_PATH);

        if (nextInfo.exists) {
            // We have a pre-downloaded image for this session.
            // Move NEXT -> CURRENT (overwrite current)
            if (currentInfo.exists) {
                await FileSystem.deleteAsync(CURRENT_BG_PATH, { idempotent: true });
            }
            await FileSystem.moveAsync({
                from: NEXT_BG_PATH,
                to: CURRENT_BG_PATH
            });
            return CURRENT_BG_PATH;
        }

        // If no NEXT image, check if we have a CURRENT one (from a previous session where Next failed or first run logic)
        if (currentInfo.exists) {
            return CURRENT_BG_PATH;
        }

        // Very first run: No current, no next.
        // Download directly to CURRENT so the user sees something immediately (with loader)
        const randomUrl = getRandomUrl();
        await FileSystem.downloadAsync(randomUrl, CURRENT_BG_PATH);

        return CURRENT_BG_PATH;
    } catch (error) {
        console.warn('Background Manager Error:', error); // Changed to warn to make it visible
        return null; // Fallback to default solid color if everything breaks
    }
};

export const prefetchNextBackground = async () => {
    try {
        console.log('Starting prefetch...');
        const randomUrl = getRandomUrl();
        // Ensure we delete old one
        await FileSystem.deleteAsync(NEXT_BG_PATH, { idempotent: true });

        const { uri } = await FileSystem.downloadAsync(randomUrl, NEXT_BG_PATH);
        console.log('Next background downloaded to:', uri);
    } catch (error) {
        console.warn('Prefetch Error:', error);
    }
};
