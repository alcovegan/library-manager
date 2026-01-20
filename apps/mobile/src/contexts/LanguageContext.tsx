/**
 * Language Context for Library Manager Mobile
 * Provides reactive language switching with persistence
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
import i18n, { pluralizeBooks as pluralizeBooksHelper } from '../i18n';

export type Language = 'ru' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, options?: object) => string;
  pluralizeBooks: (count: number) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const LANGUAGE_KEY = '@library_manager_language';

// Get device locale
function getDeviceLocale(): Language {
  try {
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      const locale = settings?.AppleLocale || settings?.AppleLanguages?.[0];
      if (locale) {
        const lang = locale.split('_')[0].split('-')[0];
        return lang === 'ru' ? 'ru' : 'en';
      }
    }
    if (Platform.OS === 'android') {
      const locale = NativeModules.I18nManager?.localeIdentifier;
      if (locale) {
        const lang = locale.split('_')[0].split('-')[0];
        return lang === 'ru' ? 'ru' : 'en';
      }
    }
  } catch (e) {
    // Fallback on error
  }
  return 'ru';
}

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>('ru');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved language on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (saved === 'ru' || saved === 'en') {
          i18n.locale = saved;
          setLanguageState(saved);
        } else {
          // Use device locale if no saved preference
          const deviceLang = getDeviceLocale();
          i18n.locale = deviceLang;
          setLanguageState(deviceLang);
        }
      } catch (e) {
        // Use default on error
        const deviceLang = getDeviceLocale();
        i18n.locale = deviceLang;
        setLanguageState(deviceLang);
      }
      setIsLoaded(true);
    };
    loadLanguage();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
      i18n.locale = lang;
      setLanguageState(lang);
    } catch (e) {
      console.error('Failed to save language preference:', e);
    }
  }, []);

  // Translation function that's reactive to language changes
  const t = useCallback((key: string, options?: object): string => {
    return i18n.t(key, options);
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pluralization helper for books
  const pluralizeBooks = useCallback((count: number): string => {
    return pluralizeBooksHelper(count, t);
  }, [t]);

  // Don't render until language is loaded
  if (!isLoaded) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, pluralizeBooks }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Re-export for convenience
export { i18n };
