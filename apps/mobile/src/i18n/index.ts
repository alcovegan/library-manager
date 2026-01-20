/**
 * i18n configuration for Library Manager Mobile
 * Uses i18n-js for translation management
 * Locale detection via React Native's Platform API (works in Expo Go)
 */

import { I18n } from 'i18n-js';
import { Platform, NativeModules } from 'react-native';

import en from './en';
import ru from './ru';

// Create i18n instance
const i18n = new I18n({
  en,
  ru,
});

// Get device locale without native modules
function getDeviceLocale(): string {
  try {
    // iOS
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      const locale = settings?.AppleLocale || settings?.AppleLanguages?.[0];
      if (locale) {
        return locale.split('_')[0].split('-')[0];
      }
    }
    // Android
    if (Platform.OS === 'android') {
      const locale = NativeModules.I18nManager?.localeIdentifier;
      if (locale) {
        return locale.split('_')[0].split('-')[0];
      }
    }
  } catch (e) {
    // Fallback on error
  }
  return 'ru'; // Default to Russian
}

const deviceLocale = getDeviceLocale();

// Set locale based on device settings
i18n.locale = deviceLocale === 'ru' ? 'ru' : 'en';

// Enable fallback to English for missing translations
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

// Function to change locale at runtime
export function setLocale(locale: 'ru' | 'en') {
  i18n.locale = locale;
}

// Get current locale
export function getLocale(): string {
  return i18n.locale;
}

// Export translation function and i18n instance
export const t = i18n.t.bind(i18n);
export default i18n;

// Helper for Russian pluralization of books
export function pluralizeBooks(count: number, tFunc: (key: string, options?: object) => string): string {
  const locale = i18n.locale;

  if (locale === 'ru') {
    // Russian pluralization rules
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) {
      return tFunc('books.count_one', { count });
    } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return tFunc('books.count_few', { count });
    } else {
      return tFunc('books.count_many', { count });
    }
  } else {
    // English - simple singular/plural
    if (count === 1) {
      return tFunc('books.count_one', { count });
    } else {
      return tFunc('books.count_other', { count });
    }
  }
}

// Export type for translation keys (for TypeScript autocomplete)
export type TranslationKeys = typeof en;
