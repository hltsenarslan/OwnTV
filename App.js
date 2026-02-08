import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import PlayerScreen from './screens/PlayerScreen';
import SettingsScreen from './screens/SettingsScreen';
import ReorderScreen from './screens/ReorderScreen';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: ['owntv://'],
  config: {
    screens: {
      Home: 'home',
      Player: 'player',
      Settings: 'settings',
      Reorder: 'reorder',
    },
  },
};

export default function App() {
  const [isCheckingUpdates, setIsCheckingUpdates] = React.useState(true);

  React.useEffect(() => {
    async function onFetchUpdateAsync() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
          return; // Reloading, so we don't finish
        }
      } catch (error) {
        console.log(`Error fetching latest Expo update: ${error}`);
      } finally {
        setIsCheckingUpdates(false);
      }
    }

    if (!__DEV__ && Updates.isEnabled) {
      onFetchUpdateAsync();
    } else {
      setIsCheckingUpdates(false);
    }
  }, []);

  if (isCheckingUpdates) {
    return (
      <View style={appStyles.splash}>
        <StatusBar hidden />
        <Text style={appStyles.splashTitle}>OwnTV</Text>
        <ActivityIndicator size="large" color="#00BFFF" />
        <Text style={appStyles.splashSubtitle}>Güncellemeler denetleniyor...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <StatusBar hidden />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Player" component={PlayerScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Reorder" component={ReorderScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const appStyles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashTitle: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 40,
    letterSpacing: 2,
  },
  splashSubtitle: {
    color: '#666',
    fontSize: 16,
    marginTop: 20,
  },
});
