import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigation from './src/navigation';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { OfflineProvider } from './src/contexts/OfflineContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { OfflineBanner } from './src/components/OfflineBanner';

function AppContent() {
  const { isDark } = useTheme();
  return (
    <>
      <OfflineBanner />
      <Navigation />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ThemeProvider>
          <OfflineProvider>
            <AppContent />
          </OfflineProvider>
        </ThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
