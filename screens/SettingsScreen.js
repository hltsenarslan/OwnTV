
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Alert,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMergedChannels } from '../api/iptv';
import { saveChannels, loadChannels } from '../utils/storage';

const SettingsScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [allChannels, setAllChannels] = useState([]);

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCountry, setSelectedCountry] = useState('All');
    const [selectedCategory, setSelectedCategory] = useState('All');

    // Selection State
    const [selectedChannelsMap, setSelectedChannelsMap] = useState(new Map()); // id -> channel
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // First fetch latest channel data (with logos)
            const channels = await getMergedChannels();
            setAllChannels(channels);

            // Create a lookup map for faster access
            const channelsMap = new Map();
            channels.forEach(c => channelsMap.set(c.id, c));

            // Load saved channels and update them with fresh data
            const saved = await loadChannels();
            if (saved) {
                const map = new Map();
                saved.forEach(savedChannel => {
                    // Try to find the fresh version of this channel (with logo)
                    // If found, use the fresh one. If not, fallback to saved (for safety)
                    const freshChannel = channelsMap.get(savedChannel.id);
                    if (freshChannel) {
                        map.set(freshChannel.id, freshChannel);
                    } else {
                        map.set(savedChannel.id, savedChannel);
                    }
                });
                setSelectedChannelsMap(map);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            Alert.alert('Error', 'Failed to load channels.');
        } finally {
            setLoading(false);
        }
    };

    // Extract Unique Countries and Categories
    const countries = useMemo(() => {
        const unique = new Set(allChannels.map(c => c.country).filter(Boolean));
        const sorted = Array.from(unique).sort();
        const trIndex = sorted.indexOf('TR');
        if (trIndex > -1) {
            sorted.splice(trIndex, 1);
            return ['All', 'TR', ...sorted];
        }
        return ['All', ...sorted];
    }, [allChannels]);

    const categories = useMemo(() => {
        const unique = new Set(allChannels.map(c => c.category).filter(Boolean));
        return ['All', ...Array.from(unique).sort()];
    }, [allChannels]);

    // Filter Logic
    const displayedChannels = useMemo(() => {
        return allChannels.filter(c => {
            const matchesSearch = !searchQuery ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCountry = selectedCountry === 'All' || c.country === selectedCountry;
            const matchesCategory = selectedCategory === 'All' || c.category === selectedCategory;

            // Exclude already selected channels from the left list?
            // Actually user wants to see selectable channels on left, selected on right.
            // Usually in this pattern, left shows "Available" (which might exclude selected, or just show everything).
            // Let's hide already selected channels from left list to avoid confusion?
            // User request: "sol tarafta seçilebilir kanallar. sağ tarafta ise seçilen kanallar olsun"
            // Interpreting as: Left = Available (not yet selected), Right = Selected.
            const notSelected = !selectedChannelsMap.has(c.id);

            return matchesSearch && matchesCountry && matchesCategory && notSelected;
        });
    }, [allChannels, searchQuery, selectedCountry, selectedCategory, selectedChannelsMap]);

    const selectedChannelsList = useMemo(() => {
        return Array.from(selectedChannelsMap.values());
    }, [selectedChannelsMap]);

    // Actions
    const addChannel = (channel) => {
        setSelectedChannelsMap(prev => {
            const newMap = new Map(prev);
            newMap.set(channel.id, channel);
            return newMap;
        });
    };

    const removeChannel = (channelId) => {
        setSelectedChannelsMap(prev => {
            const newMap = new Map(prev);
            newMap.delete(channelId);
            return newMap;
        });
    };

    const moveChannelUp = (index) => {
        if (index === 0) return;
        const list = Array.from(selectedChannelsMap.values());
        [list[index - 1], list[index]] = [list[index], list[index - 1]];

        const newMap = new Map();
        list.forEach(c => newMap.set(c.id, c));
        setSelectedChannelsMap(newMap);
    };

    const moveChannelDown = (index) => {
        const list = Array.from(selectedChannelsMap.values());
        if (index === list.length - 1) return;
        [list[index + 1], list[index]] = [list[index], list[index + 1]];

        const newMap = new Map();
        list.forEach(c => newMap.set(c.id, c));
        setSelectedChannelsMap(newMap);
    };

    // Auto-save effect
    useEffect(() => {
        if (loading) return;
        const save = async () => {
            try {
                await saveChannels(Array.from(selectedChannelsMap.values()));
            } catch (error) {
                console.error('Auto-save error:', error);
            }
        };
        save();
    }, [selectedChannelsMap, loading]);

    // Renderers
    const renderFilterItem = (item, selected, onSelect) => (
        <TouchableOpacity
            style={[styles.filterChip, item === selected && styles.filterChipSelected]}
            onPress={() => onSelect(item)}
        >
            <Text style={[styles.filterText, item === selected && styles.filterTextSelected]}>
                {item}
            </Text>
        </TouchableOpacity>
    );

    const renderChannelItem = ({ item, index }, isAdd) => (
        <TouchableOpacity
            style={styles.channelItem}
            onPress={() => isAdd ? addChannel(item) : removeChannel(item.id)}
        >
            {item.logo ? (
                <Image source={{ uri: item.logo }} style={styles.channelLogo} resizeMode="contain" />
            ) : (
                <View style={styles.placeholderLogo} />
            )}

            <View style={styles.channelInfo}>
                <Text style={styles.channelName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.channelMeta}>{item.country} | {item.category}</Text>
            </View>

            {!isAdd && (
                <View style={styles.reorderControls}>
                    <TouchableOpacity
                        style={styles.reorderBtn}
                        onPress={(e) => { e.stopPropagation(); moveChannelUp(index); }}
                    >
                        <Text style={styles.reorderText}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.reorderBtn}
                        onPress={(e) => { e.stopPropagation(); moveChannelDown(index); }}
                    >
                        <Text style={styles.reorderText}>▼</Text>
                    </TouchableOpacity>
                </View>
            )}

            <Text style={[styles.actionIcon, { color: isAdd ? '#4CAF50' : '#F44336' }]}>
                {isAdd ? '+' : '−'}
            </Text>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading channels...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Channel Store</Text>
            </View>

            {/* Filters Section */}
            <View style={styles.filtersContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search channels..."
                    placeholderTextColor="#666"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />

                <View style={styles.horizontalFilter}>
                    <Text style={styles.filterLabel}>Country:</Text>
                    <FlatList
                        horizontal
                        data={countries}
                        renderItem={({ item }) => renderFilterItem(item, selectedCountry, setSelectedCountry)}
                        keyExtractor={item => `country-${item}`}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingRight: 20 }}
                    />
                </View>

                <View style={styles.horizontalFilter}>
                    <Text style={styles.filterLabel}>Category:</Text>
                    <FlatList
                        horizontal
                        data={categories}
                        renderItem={({ item }) => renderFilterItem(item, selectedCategory, setSelectedCategory)}
                        keyExtractor={item => `cat-${item}`}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingRight: 20 }}
                    />
                </View>
            </View>

            {/* Split Screen Content */}
            <View style={styles.splitContainer}>
                {/* Left: Available Channels */}
                <View style={styles.splitPane}>
                    <Text style={styles.paneHeader}>Available ({displayedChannels.length})</Text>
                    <FlatList
                        data={displayedChannels}
                        renderItem={(props) => renderChannelItem(props, true)}
                        keyExtractor={item => item.id}
                        initialNumToRender={20}
                        maxToRenderPerBatch={20}
                        windowSize={10}
                        contentContainerStyle={styles.listContent}
                    />
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Right: Selected Channels */}
                <View style={styles.splitPane}>
                    <Text style={styles.paneHeader}>Selected ({selectedChannelsList.length})</Text>
                    <FlatList
                        data={selectedChannelsList}
                        renderItem={(props) => renderChannelItem(props, false)}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                    />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: { color: '#fff', marginTop: 10 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        backgroundColor: '#1E1E1E',
    },
    title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    saveButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    saveButtonText: { color: '#fff', fontWeight: 'bold' },

    // Filters
    filtersContainer: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        backgroundColor: '#181818',
    },
    searchInput: {
        backgroundColor: '#2C2C2C',
        color: '#fff',
        padding: 10,
        borderRadius: 8,
        marginBottom: 12,
        fontSize: 16,
    },
    horizontalFilter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    filterLabel: {
        color: '#888',
        width: 80,
        fontSize: 14,
    },
    filterChip: {
        backgroundColor: '#333',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#444',
    },
    filterChipSelected: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    filterText: { color: '#ccc', fontSize: 13 },
    filterTextSelected: { color: '#fff', fontWeight: 'bold' },

    // Split Layout
    splitContainer: {
        flex: 1,
        flexDirection: 'row',
    },
    splitPane: {
        flex: 1,
        backgroundColor: '#121212',
    },
    divider: {
        width: 1,
        backgroundColor: '#333',
    },
    paneHeader: {
        padding: 12,
        backgroundColor: '#1E1E1E',
        color: '#888',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        fontSize: 12,
        letterSpacing: 1,
    },
    listContent: {
        padding: 8,
    },
    channelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1E1E1E',
        padding: 12,
        marginBottom: 8,
        borderRadius: 6,
    },
    channelInfo: {
        flex: 1,
    },
    channelName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    channelMeta: {
        color: '#666',
        fontSize: 12,
        marginTop: 2,
    },
    actionIcon: {
        fontSize: 24,
        fontWeight: 'bold',
        marginLeft: 12,
    },
    channelLogo: {
        width: 40,
        height: 40,
        marginRight: 12,
        backgroundColor: '#fff',
        borderRadius: 4,
    },
    placeholderLogo: {
        width: 40,
        height: 40,
        marginRight: 12,
        backgroundColor: '#333',
        borderRadius: 4,
    },
    reorderControls: {
        flexDirection: 'row',
        marginRight: 8,
    },
    reorderBtn: {
        paddingHorizontal: 8,
    },
    reorderText: {
        color: '#888',
        fontSize: 18,
    },
});

export default SettingsScreen;
