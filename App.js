import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import PlayerScreen from './screens/PlayerScreen';
import SettingsScreen from './screens/SettingsScreen';
import ReorderScreen from './screens/ReorderScreen';
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
  React.useEffect(() => {
    async function onFetchUpdateAsync() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (error) {
        console.log(`Error fetching latest Expo update: ${error}`);
      }
    }

    if (!__DEV__) {
      onFetchUpdateAsync();
    }
  }, []);

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
