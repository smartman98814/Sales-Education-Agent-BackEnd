import dotenv from 'dotenv';
import { Db, MongoClient, MongoClientOptions } from 'mongodb';

import { createScopedLogger } from '../utils';

dotenv.config();

const logger = createScopedLogger('config/database');

let db: Db | null = null;
let client: MongoClient | null = null;

/**
 * Get MongoDB connection pool options optimized for bulk I/O operations
 * Exported for use in other services that create their own MongoClient instances
 */
export const getConnectionPoolOptions = (): MongoClientOptions => {
  return {
    // Connection pool settings
    minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '5', 10), // Minimum connections in pool
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '50', 10), // Maximum connections in pool
    maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_TIME_MS || '30000', 10), // Close connections after 30s of inactivity

    // Connection timeout settings
    connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT_MS || '10000', 10), // 10s connection timeout
    socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS || '45000', 10), // 45s socket timeout

    // Server selection settings
    serverSelectionTimeoutMS: parseInt(
      process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '10000',
      10,
    ), // 10s server selection timeout

    // Retry settings for better reliability
    retryWrites: true,
    retryReads: true,

    // Compression (if supported by server)
    compressors: ['zlib'],

    // Write concern for bulk operations
    writeConcern: {
      w: 'majority',
      j: true, // Journal write acknowledgment
    },
  };
};

export const connectToDatabase = async (): Promise<Db> => {
  if (db) {
    return db;
  }

  try {
    const databaseUri = process.env.DATABASE_URL || 'mongodb://localhost:27017/nfa-xyz';
    const options = getConnectionPoolOptions();
    client = new MongoClient(databaseUri, options);
    await client.connect();
    db = client.db(process.env.DATABASE_NAME || 'nfa');
    logger.log('Connected to MongoDB with connection pooling enabled');
    logger.log(`Connection pool: min=${options.minPoolSize}, max=${options.maxPoolSize}`);

    return db;
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    throw error;
  }
};

export const getDatabase = (): Db => {
  if (!db) {
    throw new Error('Database not connected. Please call connectToDatabase first.');
  }

  return db;
};

/**
 * Get the shared MongoClient instance
 * This ensures all services use the same connection pool
 */
export const getClient = (): MongoClient => {
  if (!client) {
    throw new Error('Database not connected. Please call connectToDatabase first.');
  }

  return client;
};

export const closeDatabase = async (): Promise<void> => {
  if (client) {
    await client.close();
    db = null;
    client = null;
    logger.log('Disconnected from MongoDB');
  }
};
