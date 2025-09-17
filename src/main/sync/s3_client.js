const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

class S3SyncClient {
  constructor() {
    this.client = null;
    this.config = null;
    this.isConnected = false;
  }

  /**
   * Initialize S3 client with configuration
   */
  async initialize() {
    try {
      this.config = {
        endpoint: process.env.S3_ENDPOINT,
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
        bucket: process.env.S3_BUCKET,
        region: process.env.S3_REGION || 'us-east-1'
      };

      // Validate required config
      if (!this.config.endpoint || !this.config.accessKeyId || !this.config.secretAccessKey || !this.config.bucket) {
        throw new Error('Missing required S3 configuration. Check S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET in .env');
      }

      this.client = new S3Client({
        endpoint: this.config.endpoint,
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        forcePathStyle: true, // Required for MinIO and other S3-compatible services
      });

      console.log('🔗 S3 client initialized:', {
        endpoint: this.config.endpoint,
        bucket: this.config.bucket,
        region: this.config.region
      });

      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize S3 client:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Test S3 connection
   */
  async testConnection() {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: 'library-data/',
        MaxKeys: 1
      });

      await this.client.send(command);
      console.log('✅ S3 connection test successful');
      return { ok: true };
    } catch (error) {
      console.error('❌ S3 connection test failed:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Upload file to S3
   */
  async uploadFile(localPath, s3Key) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      console.log('📤 Uploading file:', localPath, '→', s3Key);

      const fileContent = fs.readFileSync(localPath);
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: `library-data/${s3Key}`,
        Body: fileContent,
        ContentType: this.getContentType(localPath),
      });

      const result = await this.client.send(command);
      console.log('✅ Upload successful:', s3Key);
      return { ok: true, etag: result.ETag };
    } catch (error) {
      console.error('❌ Upload failed:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Download file from S3
   */
  async downloadFile(s3Key, localPath) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      console.log('📥 Downloading file:', s3Key, '→', localPath);

      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: `library-data/${s3Key}`,
      });

      const result = await this.client.send(command);

      // Ensure directory exists
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Convert stream to buffer and write to file
      const chunks = [];
      for await (const chunk of result.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      fs.writeFileSync(localPath, buffer);

      console.log('✅ Download successful:', s3Key);
      return { ok: true, lastModified: result.LastModified, etag: result.ETag };
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        console.log('📄 File not found in S3:', s3Key);
        return { ok: false, error: 'File not found', notFound: true };
      }
      console.error('❌ Download failed:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Upload JSON data
   */
  async uploadJson(data, s3Key) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      console.log('📤 Uploading JSON:', s3Key);

      const jsonContent = JSON.stringify(data, null, 2);
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: `library-data/${s3Key}`,
        Body: jsonContent,
        ContentType: 'application/json',
      });

      const result = await this.client.send(command);
      console.log('✅ JSON upload successful:', s3Key);
      return { ok: true, etag: result.ETag };
    } catch (error) {
      console.error('❌ JSON upload failed:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Download JSON data
   */
  async downloadJson(s3Key) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      console.log('📥 Downloading JSON:', s3Key);

      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: `library-data/${s3Key}`,
      });

      const result = await this.client.send(command);

      // Convert stream to string
      const chunks = [];
      for await (const chunk of result.Body) {
        chunks.push(chunk);
      }
      const jsonString = Buffer.concat(chunks).toString('utf-8');
      const data = JSON.parse(jsonString);

      console.log('✅ JSON download successful:', s3Key);
      return { ok: true, data, lastModified: result.LastModified, etag: result.ETag };
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        console.log('📄 JSON file not found in S3:', s3Key);
        return { ok: false, error: 'File not found', notFound: true };
      }
      console.error('❌ JSON download failed:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * List files with prefix
   */
  async listFiles(prefix = '') {
    if (!this.client) {
      await this.initialize();
    }

    try {
      console.log('📋 Listing files with prefix:', prefix);

      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: `library-data/${prefix}`,
      });

      const result = await this.client.send(command);
      const files = (result.Contents || []).map(obj => ({
        key: obj.Key.replace('library-data/', ''),
        lastModified: obj.LastModified,
        size: obj.Size,
        etag: obj.ETag
      }));

      console.log('✅ Listed', files.length, 'files');
      return { ok: true, files };
    } catch (error) {
      console.error('❌ List files failed:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(s3Key) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      console.log('🗑️ Deleting file:', s3Key);

      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: `library-data/${s3Key}`,
      });

      await this.client.send(command);
      console.log('✅ Delete successful:', s3Key);
      return { ok: true };
    } catch (error) {
      console.error('❌ Delete failed:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get content type for file
   */
  getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.json': 'application/json',
      '.db': 'application/octet-stream',
      '.sqlite': 'application/octet-stream',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.txt': 'text/plain',
      '.log': 'text/plain',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return this.config ? {
      endpoint: this.config.endpoint,
      bucket: this.config.bucket,
      region: this.config.region,
      isConnected: this.isConnected
    } : null;
  }
}

module.exports = new S3SyncClient();
