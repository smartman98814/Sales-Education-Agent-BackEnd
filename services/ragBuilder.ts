/**
 * RAG Database Builder
 * Builds MongoDB vector databases for RAG from text documents
 *
 * Features:
 * - MongoDB vector storage
 * - Text chunking with SentenceChunker
 * - OpenAI embeddings generation
 * - Content cleaning and filtering
 * - UUID-based paragraph storage
 */
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import { Collection, Db } from 'mongodb';
import OpenAI from 'openai';

import { connectToDatabase, getClient } from '../config';
import { createScopedLogger } from '../utils';
import { tokenizeParagraphs } from './tokenizer';

const logger = createScopedLogger('services/ragBuilder');

interface DocumentMetadata {
  index: number;
  embedding_model: string;
  embedding_dimension: number;
}

interface RAGDocument {
  uuid: string;
  uid?: string;
  content: string;
  embedding: number[];
  created_at: Date;
  metadata: DocumentMetadata;
}

interface RAGBuilderOptions {
  mongodbUrl?: string; // Optional - now uses shared client from config/database.ts
  databaseName?: string;
  collectionName?: string;
  embeddingsDimension?: number;
  embeddingsModel?: string;
  uid?: string;
}

export class RAGBuilder {
  private databaseName: string;
  private collectionName: string;
  private embeddingsDimension: number;
  private embeddingsModel: string;
  private uid: string | undefined;
  private openai: OpenAI;

  constructor(options: RAGBuilderOptions) {
    this.databaseName = options.databaseName ?? 'nfa';
    this.collectionName = options.collectionName ?? 'knowledges';
    this.embeddingsDimension = options.embeddingsDimension ?? 1536;
    this.embeddingsModel = options.embeddingsModel ?? 'text-embedding-3-small';
    this.uid = options.uid;

    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Get or create MongoDB collection
   */
  private async getCollection(): Promise<Collection<RAGDocument>> {
    // Ensure database is connected
    await connectToDatabase();
    const client = getClient();
    const db: Db = client.db(this.databaseName);
    const collection = db.collection<RAGDocument>(this.collectionName);

    // Create indexes
    try {
      const indexes = await collection.listIndexes().toArray();
      const indexNames = indexes.map((idx) => idx.name);

      if (!indexNames.includes('uuid_1')) {
        await collection.createIndex({ uuid: 1 }, { unique: true });
      }

      if (!indexNames.includes('uid_1')) {
        await collection.createIndex({ uid: 1 });
      }

      if (!indexNames.includes('created_at_-1')) {
        await collection.createIndex({ created_at: -1 });
      }

      if (!indexNames.includes('uid_1_created_at_-1')) {
        await collection.createIndex({ uid: 1, created_at: -1 });
      }
    } catch (error) {
      logger.warn(`Could not create indexes: ${error}`);
    }

    return collection;
  }

  /**
   * Create embeddings for a single text using OpenAI
   */
  private async createEmbeddings(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      input: text,
      model: this.embeddingsModel,
      dimensions: this.embeddingsDimension,
    });

    return response.data[0].embedding;
  }

  /**
   * Build the RAG database from a list of texts
   */
  async buildFromTexts(texts: string[], showProgress: boolean = true): Promise<void> {
    const collection = await this.getCollection();

    // // Clear existing documents
    // await collection.deleteMany({});
    // logger.log(`Cleared existing documents from ${this.collectionName}`);

    // Filter out empty texts
    const validTexts = texts.filter((text) => text.trim().length > 0);

    // Generate embeddings and insert into MongoDB
    const documents: RAGDocument[] = [];
    let processed = 0;

    for (let idx = 0; idx < validTexts.length; idx++) {
      const text = validTexts[idx];

      try {
        const embedding = await this.createEmbeddings(text);

        const document: RAGDocument = {
          uuid: randomUUID(),
          ...(this.uid && { uid: this.uid }),
          content: text,
          embedding,
          created_at: new Date(),
          metadata: {
            index: idx,
            embedding_model: this.embeddingsModel,
            embedding_dimension: this.embeddingsDimension,
          },
        };

        documents.push(document);
        processed++;

        if (showProgress && processed % 10 === 0) {
        }

        // Batch insert every 100 documents
        if (documents.length >= 100) {
          await collection.insertMany(documents, { ordered: false });
          documents.length = 0;
        }
      } catch (error) {
        logger.error(`Error processing document ${idx}: ${error}`);
      }
    }

    // Insert remaining documents
    if (documents.length > 0) {
      await collection.insertMany(documents, { ordered: false });
    }
  }

  /**
   * Build the RAG database from a text file
   */
  async buildFromFile(filePath: string, showProgress: boolean = true): Promise<void> {
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`Input file not found: ${filePath}`);
    }

    // Read and tokenize the file
    const rawData = await fs.readFile(filePath, 'utf-8');
    const paragraphs = tokenizeParagraphs(rawData);

    await this.buildFromTexts(paragraphs, showProgress);
  }

  /**
   * Clean up existing knowledge for a specific uid
   */
  async cleanupByUid(uid: string): Promise<number> {
    const collection = await this.getCollection();
    const result = await collection.deleteMany({ uid });

    return result.deletedCount;
  }

  /**
   * Convenience method to create and build a RAG database in one step
   */
  static async createFromFile(filePath: string, options: RAGBuilderOptions): Promise<RAGBuilder> {
    const builder = new RAGBuilder(options);
    await builder.buildFromFile(filePath);

    return builder;
  }
}
