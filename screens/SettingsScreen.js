
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
    Animated, // Import Animated
    Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMergedChannels } from '../api/iptv';
import { saveChannels, loadChannels } from '../utils/storage';
import * as Updates from 'expo-updates';
import AndroidTv from '../modules/android-tv';
import { Platform } from 'react-native';

// Helper for TV Focus
// Helper for TV Focus - Animated Approach
const FocusableOpacity = ({ onPress, onLongPress, delayLongPress, style, children, activeOpacity, focusedStyle, ...props }) => {
    const focusAnim = React.useRef(new Animated.Value(0)).current;

    const onFocus = () => {
        Animated.timing(focusAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true, // Use native driver for transform
            easing: Easing.out(Easing.quad),
        }).start();
    };

    const onBlur = () => {
        Animated.timing(focusAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
        }).start();
    };

    const scale = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.15]
    });

    return (
        <TouchableOpacity
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={delayLongPress}
            onFocus={onFocus}
            onBlur={onBlur}
            activeOpacity={1}
            {...props}
        >
            <Animated.View style={[
                style,
                {
                    transform: [{ scale }],
                    zIndex: focusAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 999]
                    }),
                    // Create a border via a wrapper view or just let the child handle it?
                    // Let's add a border width simulation or just rely on scale + overlay.
                }
            ]}>
                {children}
                {/* Animated Overlay for Color */}
                <Animated.View style={{
                    ...StyleSheet.absoluteFillObject,
                    borderRadius: 8,
                    borderWidth: 4,
                    borderColor: '#FF69B4',
                    backgroundColor: 'rgba(255, 105, 180, 0.4)',
                    opacity: focusAnim, // Fade in the pink
                }} />
            </Animated.View>
        </TouchableOpacity>
    );
};

// Search Input that behaves like a button until clicked
const SearchInputButton = ({ value, onChangeText, placeholder, onNextFocus }) => {
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = React.useRef(null);

    const handlePress = () => {
        setIsEditing(true);
        // Wait for render then focus
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleSubmit = () => {
        setIsEditing(false);
        // Optional: Move focus down automatically after searching? 
        // For now just exit edit mode. User can then nav down.
    };

    if (isEditing) {
        return (
            <TextInput
                ref={inputRef}
                style={[styles.searchInput, styles.searchInputActive]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#999"
                autoFocus={true}
                blurOnSubmit={true}
                onSubmitEditing={handleSubmit}
                onBlur={() => setIsEditing(false)}
            />
        );
    }

    return (
        <FocusableOpacity
            style={styles.searchInput}
            onPress={handlePress}
            activeOpacity={1}
            focusedStyle={styles.searchInputFocused}
        >
            <Text style={[styles.searchTextDisplay, !value && styles.placeholderText]}>
                {value || placeholder}
            </Text>
            <Text style={styles.searchIcon}>🔍</Text>
        </FocusableOpacity>
    );
};

const SettingsScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [allChannels, setAllChannels] = useState([]);
    const firstFilterRef = React.useRef(null); // Ref for navigating from Search -> Filter

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCountry, setSelectedCountry] = useState('All');
    const [selectedCategory, setSelectedCategory] = useState('All');

    // Selection State
    const [selectedChannelsMap, setSelectedChannelsMap] = useState(new Map()); // id -> channel
    const [movingChannel, setMovingChannel] = useState(null);
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

    const handleMoveSelect = (channel, index) => {
        if (!movingChannel) {
            // Pick up
            setMovingChannel(channel);
        } else {
            // Drop / Place here
            if (movingChannel.id === channel.id) {
                // Cancel if clicked same item
                setMovingChannel(null);
                return;
            }

            // Move logic: Insert movingChannel at new index
            const list = Array.from(selectedChannelsMap.values());
            const oldIndex = list.findIndex(c => c.id === movingChannel.id);
            const newIndex = index;

            if (oldIndex > -1) {
                // Remove from old pos
                list.splice(oldIndex, 1);
                // Insert at new pos
                list.splice(newIndex, 0, movingChannel);

                const newMap = new Map();
                list.forEach(c => newMap.set(c.id, c));
                setSelectedChannelsMap(newMap);
            }
            setMovingChannel(null);
        }
    };

    // Update Check Logic
    const checkUpdate = async () => {
        try {
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
                Alert.alert(
                    'Yeni Güncelleme',
                    'Uygulamanın yeni bir versiyonu bulundu. Şimdi indirip yüklensin mi?',
                    [
                        { text: 'Vazgeç', style: 'cancel' },
                        {
                            text: 'Güncelle',
                            onPress: async () => {
                                await Updates.fetchUpdateAsync();
                                await Updates.reloadAsync();
                            }
                        }
                    ]
                );
            } else {
                Alert.alert('Güncel', 'Uygulamanız en son sürümde.');
            }
        } catch (e) {
            Alert.alert('Hata', 'Güncelleme kontrolü sırasında bir hata oluştu.');
            console.error(e);
        }
    };

    // Auto-save effect
    useEffect(() => {
        if (loading) return;
        const save = async () => {
            try {
                const list = Array.from(selectedChannelsMap.values());
                await saveChannels(list);

                // Sync with Android TV Home Screen
                if (Platform.OS === 'android') {
                    const syncList = list.slice(0, 20).map(c => ({
                        id: c.id,
                        name: c.name,
                        logo: c.logo || ''
                    }));
                    await AndroidTv.syncChannels(syncList).catch(e => console.error('TV Sync Error:', e));
                }
            } catch (error) {
                console.error('Auto-save error:', error);
            }
        };
        save();
    }, [selectedChannelsMap, loading]);

    // Renderers
    const renderFilterItem = (item, selected, onSelect, index) => (
        <FocusableOpacity
            ref={index === 0 ? firstFilterRef : null}
            style={[styles.filterChip, item === selected && styles.filterChipSelected]}
            onPress={() => onSelect(item)}
            focusedStyle={styles.focusedItem}
        >
            <Text style={[styles.filterText, item === selected && styles.filterTextSelected]}>
                {item}
            </Text>
        </FocusableOpacity>
    );

    const renderChannelItem = ({ item, index }, isAdd) => {
        const isMoving = movingChannel && movingChannel.id === item.id;
        // In "Available" list, click adds.
        // In "Selected" list, click handles move logic.

        return (
            <FocusableOpacity
                style={[
                    styles.channelItem,
                    isMoving && styles.channelItemMoving,
                    (movingChannel && !isAdd && !isMoving) && styles.channelItemTarget // visual hint
                ]}
                onPress={() => isAdd ? addChannel(item) : handleMoveSelect(item, index)}
                onLongPress={() => !isAdd && removeChannel(item.id)}
                delayLongPress={600}
                onLongPress={() => !isAdd && removeChannel(item.id)}
                delayLongPress={600}
                activeOpacity={0.7}
                focusedStyle={styles.focusedItem}
            >
                {item.logo ? (
                    <Image source={{ uri: item.logo }} style={styles.channelLogo} resizeMode="contain" />
                ) : (
                    <View style={styles.placeholderLogo} />
                )}

                <View style={styles.channelInfo}>
                    <Text style={styles.channelName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.channelMeta}>
                        {isAdd ? `${item.country} | ${item.category}` : (isMoving ? 'Moving... Select new position' : 'Tap to Move • Long Press to Delete')}
                    </Text>
                </View>

                {isAdd ? (
                    <Text style={[styles.actionIcon, { color: '#4CAF50' }]}>+</Text>
                ) : (
                    <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={(e) => { e.stopPropagation(); removeChannel(item.id); }}
                    >
                        <Text style={styles.removeIcon}>🗑️</Text>
                    </TouchableOpacity>
                )}
            </FocusableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading channels...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right
        }]}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Channel Store</Text>
                    <Text style={styles.versionText}>v{Updates.runtimeVersion || '1.0.0'}</Text>
                </View>
                <FocusableOpacity
                    style={styles.updateButton}
                    onPress={checkUpdate}
                    focusedStyle={styles.focusedItem}
                >
                    <Text style={styles.updateButtonText}>Güncellemeleri Denetle</Text>
                </FocusableOpacity>
            </View>

            {/* Filters Section */}
            <View style={styles.filtersContainer}>
                {/* Search Button / Input Wrapper */}
                <SearchInputButton
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search channels..."
                    onNextFocus={() => firstFilterRef.current?.focus()}
                />

                <View style={styles.horizontalFilter}>
                    <Text style={styles.filterLabel}>Country:</Text>
                    <FlatList
                        horizontal
                        data={countries}
                        renderItem={({ item, index }) => renderFilterItem(item, selectedCountry, setSelectedCountry, index)}
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
        padding: 10,
        borderRadius: 8,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    searchInputFocused: {
        backgroundColor: '#FF69B4', // Hot Pink
        borderColor: '#FFF',
        borderWidth: 3,
        transform: [{ scale: 1.05 }],
    },
    searchInputActive: {
        borderColor: '#00BFFF',
        borderWidth: 2,
        color: '#fff',
        fontSize: 16,
    },
    searchTextDisplay: {
        color: '#fff',
        fontSize: 16,
    },
    placeholderText: {
        color: '#666',
    },
    searchIcon: {
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
    channelItemMoving: {
        borderColor: '#00BFFF',
        borderWidth: 2,
        backgroundColor: '#333',
    },
    channelItemTarget: {
        opacity: 0.8,
    },
    removeBtn: {
        padding: 8,
        marginLeft: 8,
    },
    removeIcon: {
        fontSize: 18,
    },
    focusedItem: {
        backgroundColor: '#FF69B4', // Hot Pink
        transform: [{ scale: 1.05 }],
        borderWidth: 3,
        borderColor: '#FFFFFF', // White border
        shadowColor: "#FF69B4",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 5,
        elevation: 10,
        zIndex: 999,
    },
    versionText: {
        color: '#666',
        fontSize: 12,
        marginTop: 2,
    },
    updateButton: {
        backgroundColor: '#333',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#444',
    },
    updateButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
});

export default SettingsScreen;
