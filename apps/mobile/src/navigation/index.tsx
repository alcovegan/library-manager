/**
 * Navigation configuration for Library Manager Mobile
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import LibraryScreen from '../screens/LibraryScreen';
import SearchScreen from '../screens/SearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import BookDetailsScreen from '../screens/BookDetailsScreen';
import BookEditScreen from '../screens/BookEditScreen';
import CollectionsScreen from '../screens/CollectionsScreen';
import CollectionDetailsScreen from '../screens/CollectionDetailsScreen';
import SyncSettingsScreen from '../screens/SyncSettingsScreen';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { RootStackParamList, MainTabParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Library: '📚',
    Search: '🔍',
    Collections: '📁',
    Settings: '⚙️',
  };

  return (
    <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.5 }}>
      {icons[name] || '📖'}
    </Text>
  );
}

function MainTabs() {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerShown: true,
      })}
    >
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{ title: t('tabs.library') }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: t('tabs.search') }}
      />
      <Tab.Screen
        name="Collections"
        component={CollectionsScreen}
        options={{ title: t('tabs.collections') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t('tabs.settings') }}
      />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      >
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BookDetails"
          component={BookDetailsScreen}
          options={{ title: t('screens.book') }}
        />
        <Stack.Screen
          name="CollectionDetails"
          component={CollectionDetailsScreen}
          options={{ title: t('screens.collection') }}
        />
        <Stack.Screen
          name="SyncSettings"
          component={SyncSettingsScreen}
          options={{ title: t('screens.sync') }}
        />
        <Stack.Screen
          name="EditBook"
          component={BookEditScreen}
          options={{ title: t('screens.editBook') }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
