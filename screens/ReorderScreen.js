
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadChannels, saveChannels } from '../utils/storage';

// Helper for TV Focus
const FocusableOpacity = ({ onPress, style, children, activeOpacity, focusedStyle, disabled }) => {
    const [focused, setFocused] = useState(false);
    return (
        <TouchableOpacity
            onPress={onPress}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[style, focused && (focusedStyle || styles.focusedItem)]}
            activeOpacity={activeOpacity}
            disabled={disabled}
        >
            {children}
        </TouchableOpacity>
    );
};

const ReorderScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const [channels, setChannels] = useState([]);
    const [selectedIdx, setSelectedIdx] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const saved = await loadChannels();
        if (saved) {
            setChannels(saved);
        }
    };

    const moveUp = (index) => {
        if (index === 0) return;
        const newChannels = [...channels];
        [newChannels[index - 1], newChannels[index]] = [newChannels[index], newChannels[index - 1]];
        setChannels(newChannels);
        setSelectedIdx(index - 1);
    };

    const moveDown = (index) => {
        if (index === channels.length - 1) return;
        const newChannels = [...channels];
        [newChannels[index + 1], newChannels[index]] = [newChannels[index], newChannels[index + 1]];
        setChannels(newChannels);
        setSelectedIdx(index + 1);
    };

    const handleSave = async () => {
        try {
            await saveChannels(channels);
            Alert.alert('Success', 'Channel order saved!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error('Error saving order:', error);
            Alert.alert('Error', 'Failed to save order.');
        }
    };

    const renderItem = ({ item, index }) => {
        const isSelected = selectedIdx === index;
        return (
            <FocusableOpacity
                style={[styles.itemContainer, isSelected && styles.itemSelected]}
                onPress={() => setSelectedIdx(index)}
                activeOpacity={0.8}
            >
                <Text style={styles.index}>{index + 1}.</Text>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <View style={styles.controls}>
                    <FocusableOpacity
                        style={[styles.controlBtn, index === 0 && styles.disabledBtn]}
                        onPress={() => moveUp(index)}
                        disabled={index === 0}
                    >
                        <Text style={styles.controlText}>▲</Text>
                    </FocusableOpacity>
                    <FocusableOpacity
                        style={[styles.controlBtn, index === channels.length - 1 && styles.disabledBtn]}
                        onPress={() => moveDown(index)}
                        disabled={index === channels.length - 1}
                    >
                        <Text style={styles.controlText}>▼</Text>
                    </FocusableOpacity>
                </View>
            </FocusableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
                <Text style={styles.title}>Reorder Channels</Text>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                    <Text style={styles.saveButtonText}>Save Order</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.instruction}>Select a channel then use arrows to move.</Text>

            <FlatList
                data={channels}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    saveButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    instruction: {
        color: '#888',
        padding: 16,
        textAlign: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e1e1e',
        padding: 12,
        marginBottom: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    itemSelected: {
        borderColor: '#007AFF',
        backgroundColor: '#1a2a3a',
    },
    index: {
        color: '#666',
        width: 30,
        fontSize: 16,
    },
    name: {
        color: '#fff',
        fontSize: 18,
        flex: 1,
    },
    controls: {
        flexDirection: 'row',
    },
    controlBtn: {
        padding: 10,
        backgroundColor: '#333',
        marginLeft: 8,
        borderRadius: 4,
        width: 40,
        alignItems: 'center',
    },
    disabledBtn: {
        opacity: 0.3,
    },
    controlText: {
        color: '#fff',
        fontSize: 16,
    },
    focusedItem: {
        backgroundColor: '#FF69B4', // Hot Pink
        transform: [{ scale: 1.05 }],
        borderWidth: 3,
        borderColor: '#FFFFFF',
        elevation: 5,
        zIndex: 999,
    },
});

export default ReorderScreen;
