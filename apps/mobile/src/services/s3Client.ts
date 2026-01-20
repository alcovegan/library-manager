/**
 * S3 Client for mobile app
 * Compatible with AWS S3 and S3-compatible services (MinIO, etc.)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

export interface S3Config {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}

// Prefix for all S3 keys (same as desktop)
const S3_PREFIX = 'library-data/';

let s3Client: S3Client | null = null;
let currentConfig: S3Config | null = null;

/**
 * Initialize S3 client with configuration
 */
export function initializeS3(config: S3Config): void {
  currentConfig = config;

  // Normalize endpoint URL
  let endpoint = config.endpoint;
  if (endpoint && !endpoint.startsWith('http')) {
    endpoint = `https://${endpoint}`;
  }

  s3Client = new S3Client({
    endpoint: endpoint || undefined,
    region: config.region || 'us-east-1',
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: true, // Required for S3-compatible services like MinIO
  });

  console.log('[S3] Client initialized');
}

/**
 * Get current S3 client
 */
export function getS3Client(): S3Client {
  if (!s3Client) {
    throw new Error('S3 client not initialized. Call initializeS3() first.');
  }
  return s3Client;
}

/**
 * Get current bucket name
 */
export function getBucket(): string {
  if (!currentConfig) {
    throw new Error('S3 client not initialized');
  }
  return currentConfig.bucket;
}

/**
 * Test S3 connection
 */
export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = getS3Client();
    const bucket = getBucket();

    await client.send(new HeadBucketCommand({ Bucket: bucket }));

    console.log('[S3] Connection test successful');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[S3] Connection test failed:', message);
    return { ok: false, error: message };
  }
}

/**
 * Download JSON data from S3
 */
export async function downloadJson<T>(key: string): Promise<T | null> {
  try {
    const client = getS3Client();
    const bucket = getBucket();
    const fullKey = `${S3_PREFIX}${key}`;

    console.log(`[S3] Downloading JSON: ${fullKey}`);

    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: fullKey,
      })
    );

    if (!response.Body) {
      return null;
    }

    const bodyString = await response.Body.transformToString();
    return JSON.parse(bodyString) as T;
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      console.log(`[S3] Key not found: ${key}`);
      return null;
    }
    throw error;
  }
}

/**
 * Download binary data from S3
 */
export async function downloadBinary(key: string): Promise<Uint8Array | null> {
  try {
    const client = getS3Client();
    const bucket = getBucket();
    const fullKey = `${S3_PREFIX}${key}`;

    console.log(`[S3] Downloading binary: ${fullKey}`);

    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: fullKey,
      })
    );

    if (!response.Body) {
      return null;
    }

    return await response.Body.transformToByteArray();
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      console.log(`[S3] Key not found: ${key}`);
      return null;
    }
    throw error;
  }
}

/**
 * List files with a prefix
 */
export async function listFiles(prefix: string): Promise<string[]> {
  try {
    const client = getS3Client();
    const bucket = getBucket();
    const fullPrefix = `${S3_PREFIX}${prefix}`;

    console.log(`[S3] Listing files with prefix: ${fullPrefix}`);

    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: fullPrefix,
      })
    );

    // Remove the S3_PREFIX from returned keys
    const files = (response.Contents || [])
      .map((item) => item.Key?.replace(S3_PREFIX, ''))
      .filter((key): key is string => !!key);

    console.log(`[S3] Found ${files.length} files`);
    return files;
  } catch (error) {
    console.error('[S3] List files error:', error);
    throw error;
  }
}

/**
 * Upload JSON data to S3
 */
export async function uploadJson(key: string, data: unknown): Promise<void> {
  const client = getS3Client();
  const bucket = getBucket();
  const fullKey = `${S3_PREFIX}${key}`;

  console.log(`[S3] Uploading JSON: ${fullKey}`);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: fullKey,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    })
  );
}

/**
 * Check if S3 is configured
 */
export function isConfigured(): boolean {
  return s3Client !== null && currentConfig !== null;
}

/**
 * Reset S3 client
 */
export function resetS3Client(): void {
  s3Client = null;
  currentConfig = null;
}
