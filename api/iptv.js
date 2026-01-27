
export const IPTV_API_BASE = 'https://iptv-org.github.io/api';

/**
 * Fetches the list of all channels (metadata) from the API.
 * @returns {Promise<Array>} Array of channel objects.
 */
export const fetchChannels = async () => {
    try {
        const response = await fetch(`${IPTV_API_BASE}/channels.json`);
        if (!response.ok) {
            throw new Error('Failed to fetch channels meta');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching channels:', error);
        return [];
    }
};

/**
 * Fetches the list of all streams (URLs) from the API.
 * @returns {Promise<Array>} Array of stream objects.
 */
export const fetchStreams = async () => {
    try {
        const response = await fetch(`${IPTV_API_BASE}/streams.json`);
        if (!response.ok) {
            throw new Error('Failed to fetch streams');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching streams:', error);
        return [];
    }
};

/**
 * Fetches the list of all logos from the API.
 * @returns {Promise<Array>} Array of logo objects.
 */
export const fetchLogos = async () => {
    try {
        const response = await fetch(`${IPTV_API_BASE}/logos.json`);
        if (!response.ok) {
            throw new Error('Failed to fetch logos');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching logos:', error);
        return [];
    }
};

/**
 * Merges channels, streams, and logos to create a usable list of channels with URLs and Logos.
 * Filters out channels that do not have a stream URL.
 * @returns {Promise<Array>} Array of merged channel objects {id, name, logo, url, category, country}.
 */
export const getMergedChannels = async () => {
    try {
        const [channels, streams, logos] = await Promise.all([fetchChannels(), fetchStreams(), fetchLogos()]);

        // Create a map of streams by channel ID
        const streamsMap = new Map();
        streams.forEach(stream => {
            if (stream.channel) {
                streamsMap.set(stream.channel, stream);
            }
        });

        // Create a map of logos by channel ID
        const logosMap = new Map();
        logos.forEach(logo => {
            if (logo.channel) {
                const existing = logosMap.get(logo.channel);
                // Keep existing if it has a URL, otherwise take new one.
                // Or maybe just overwrite? API usually has one primary logo per channel?
                // The sample showed multiple entries for same channel sometimes.
                // Let's just key by channel ID. Use the latest or first one.
                // The sample logos.json has width/height.
                // Let's prefer higher resolution if multiple exist?
                if (!existing || (logo.width > existing.width)) {
                    logosMap.set(logo.channel, logo);
                }
            }
        });

        // Merge logic
        const merged = channels.reduce((acc, channel) => {
            const stream = streamsMap.get(channel.id);
            if (stream) {
                const logoObj = logosMap.get(channel.id);

                acc.push({
                    id: channel.id,
                    name: channel.name,
                    // Use logo from channels.json if exists, otherwise from logos.json
                    logo: channel.logo || logoObj?.url || null,
                    url: stream.url,
                    category: channel.categories?.[0] || 'Uncategorized',
                    country: channel.country || 'Unknown',
                });
            }
            return acc;
        }, []);

        return merged;
    } catch (error) {
        console.error('Error merging channels and streams:', error);
        return [];
    }
};
