/**
 * Settings storage service
 * Uses expo-secure-store for sensitive data (S3 credentials)
 * Uses AsyncStorage for non-sensitive settings
 */

import * as SecureStore from 'expo-secure-store';
import { S3Config } from './s3Client';

const KEYS = {
  S3_ENDPOINT: 's3_endpoint',
  S3_ACCESS_KEY: 's3_access_key',
  S3_SECRET_KEY: 's3_secret_key',
  S3_BUCKET: 's3_bucket',
  S3_REGION: 's3_region',
  DEVICE_ID: 'device_id',
  AUTO_SYNC: 'auto_sync',
  LAST_SYNC: 'last_sync',
};

/**
 * Save S3 configuration securely
 */
export async function saveS3Config(config: S3Config): Promise<void> {
  await SecureStore.setItemAsync(KEYS.S3_ENDPOINT, config.endpoint);
  await SecureStore.setItemAsync(KEYS.S3_ACCESS_KEY, config.accessKey);
  await SecureStore.setItemAsync(KEYS.S3_SECRET_KEY, config.secretKey);
  await SecureStore.setItemAsync(KEYS.S3_BUCKET, config.bucket);
  await SecureStore.setItemAsync(KEYS.S3_REGION, config.region);
  console.log('[Settings] S3 config saved');
}

/**
 * Load S3 configuration
 */
export async function loadS3Config(): Promise<S3Config | null> {
  const endpoint = await SecureStore.getItemAsync(KEYS.S3_ENDPOINT);
  const accessKey = await SecureStore.getItemAsync(KEYS.S3_ACCESS_KEY);
  const secretKey = await SecureStore.getItemAsync(KEYS.S3_SECRET_KEY);
  const bucket = await SecureStore.getItemAsync(KEYS.S3_BUCKET);
  const region = await SecureStore.getItemAsync(KEYS.S3_REGION);

  if (!endpoint || !accessKey || !secretKey || !bucket) {
    return null;
  }

  return {
    endpoint,
    accessKey,
    secretKey,
    bucket,
    region: region || 'us-east-1',
  };
}

/**
 * Check if S3 is configured
 */
export async function hasS3Config(): Promise<boolean> {
  const config = await loadS3Config();
  return config !== null;
}

/**
 * Clear S3 configuration
 */
export async function clearS3Config(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.S3_ENDPOINT);
  await SecureStore.deleteItemAsync(KEYS.S3_ACCESS_KEY);
  await SecureStore.deleteItemAsync(KEYS.S3_SECRET_KEY);
  await SecureStore.deleteItemAsync(KEYS.S3_BUCKET);
  await SecureStore.deleteItemAsync(KEYS.S3_REGION);
  console.log('[Settings] S3 config cleared');
}

/**
 * Get or create device ID
 */
export async function getDeviceId(): Promise<string> {
  let deviceId = await SecureStore.getItemAsync(KEYS.DEVICE_ID);

  if (!deviceId) {
    // Generate a simple UUID
    deviceId = 'mobile-' + Math.random().toString(36).substring(2, 15) +
               Math.random().toString(36).substring(2, 15);
    await SecureStore.setItemAsync(KEYS.DEVICE_ID, deviceId);
    console.log('[Settings] Generated new device ID:', deviceId);
  }

  return deviceId;
}

/**
 * Save last sync timestamp
 */
export async function saveLastSync(timestamp: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.LAST_SYNC, timestamp);
}

/**
 * Get last sync timestamp
 */
export async function getLastSync(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.LAST_SYNC);
}

/**
 * Set auto-sync preference
 */
export async function setAutoSync(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEYS.AUTO_SYNC, enabled ? 'true' : 'false');
}

/**
 * Get auto-sync preference
 */
export async function getAutoSync(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(KEYS.AUTO_SYNC);
  return value === 'true';
}
