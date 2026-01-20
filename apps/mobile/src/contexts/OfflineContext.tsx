/**
 * Offline Context for Library Manager Mobile
 * Tracks network connectivity and provides offline state to the app
 * Uses fetch-based connectivity check (works in Expo Go without native modules)
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

// Context type
interface OfflineContextType {
  isOffline: boolean;
  isOnline: boolean;
  checkNow: () => Promise<void>;
  // Debug: force offline mode for testing
  debugForceOffline: boolean;
  setDebugForceOffline: (value: boolean) => void;
}

// Create context
const OfflineContext = createContext<OfflineContextType | null>(null);

// Provider props
interface OfflineProviderProps {
  children: ReactNode;
}

// Provider component
export function OfflineProvider({ children }: OfflineProviderProps) {
  const [networkOffline, setNetworkOffline] = useState(false);
  const [debugForceOffline, setDebugForceOffline] = useState(false);
  const checkingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Effective offline state: true if network is down OR debug mode is on
  const isOffline = networkOffline || debugForceOffline;

  const checkNetwork = async () => {
    // Prevent concurrent checks
    if (checkingRef.current) return;
    checkingRef.current = true;

    let nowOffline = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('https://httpbin.org/get', {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      nowOffline = !response.ok;
    } catch (error) {
      nowOffline = true;
    }

    setNetworkOffline(nowOffline);
    checkingRef.current = false;

    // Schedule next check - faster when offline to detect recovery quickly
    const nextCheckDelay = nowOffline ? 5000 : 30000;
    timeoutRef.current = setTimeout(checkNetwork, nextCheckDelay);
  };

  useEffect(() => {
    // Initial check
    checkNetwork();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Force immediate check (cancels pending)
  const checkNow = async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    checkingRef.current = false; // Allow new check
    await checkNetwork();
  };

  const value: OfflineContextType = {
    isOffline,
    isOnline: !isOffline,
    checkNow,
    debugForceOffline,
    setDebugForceOffline,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

// Hook to use offline context
export function useOffline(): OfflineContextType {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
