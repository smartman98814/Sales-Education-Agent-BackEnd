/**
 * Knowledge Upload Routes
 * Handles uploading knowledge files (PDF, DOCX, DOC, TXT) and automatically creates RAG data
 */
import axios from 'axios';
import express, { Request, RequestHandler, Response, Router } from 'express';
import multer from 'multer';

import { RAGBuilder, WebScraper, fileParser, tokenizeParagraphs } from '../services';
import { createScopedLogger } from '../utils';

const logger = createScopedLogger('routes/knowledgeRoutes');

const router: Router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB file size limit for knowledge files
  },
  fileFilter: (_req, file, cb) => {
    // Check if file format is supported
    if (fileParser.isSupportedFormat(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format. Supported formats: PDF, DOCX, DOC, TXT'));
    }
  },
});

interface _KnowledgeUploadResponse {
  success: boolean;
  message?: string;
  filename?: string;
  documentsCreated?: number;
  error?: string;
}

/**
 * POST /api/knowledge/upload
 * Upload one or more knowledge files and automatically create RAG data per user
 */
router.post(
  '/upload',
  upload.array('files', 10) as unknown as RequestHandler, // Allow up to 10 files
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Check if files exist in request
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No files uploaded',
        });

        return;
      }

      // Check if uid is provided
      const uid = req.body.uid;
      if (!uid) {
        res.status(400).json({
          success: false,
          error: 'uid is required',
        });

        return;
      }

      // Check if DATABASE_URL is set
      const mongodbUrl = process.env.DATABASE_URL;
      if (!mongodbUrl) {
        res.status(500).json({
          success: false,
          error: 'DATABASE_URL not configured. Please set DATABASE_URL in environment variables.',
        });

        return;
      }

      // Get optional parameters from request body
      const databaseName = process.env.DATABASE_NAME || 'nfa';
      const collectionName = process.env.DATABASE_COLLECTION || 'knowledges';
      const embeddingsDimension = 1536;
      const embeddingsModel = 'text-embedding-3-small';

      // Create RAG builder with uid
      const builder = new RAGBuilder({
        mongodbUrl,
        databaseName,
        collectionName,
        embeddingsDimension,
        embeddingsModel,
        uid,
      });

      let totalParagraphs = 0;
      const processedFiles: string[] = [];

      // Process each file
      for (const file of req.files) {
        try {
          // Parse the file to extract text content
          const textContent = await fileParser.parseFile(file.buffer, file.originalname);

          if (textContent && textContent.trim().length > 0) {
            // Tokenize the content into paragraphs
            const paragraphs = tokenizeParagraphs(textContent);

            if (paragraphs.length > 0) {
              await builder.buildFromTexts(paragraphs, false);
              totalParagraphs += paragraphs.length;
              processedFiles.push(file.originalname);
            }
          }
        } catch (error) {
          logger.error(`Error processing ${file.originalname}:`, error);
          // Continue with other files
        }
      }

      res.json({
        success: true,
        message: `Processed ${processedFiles.length} files successfully`,
        filesProcessed: processedFiles,
        documentsCreated: totalParagraphs,
      });
    } catch (error) {
      logger.error('Error processing knowledge files:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

/**
 * POST /api/knowledge/scrape-url
 * Scrape content from one or more URLs and automatically create RAG data per user
 */
router.post('/scrape-url', express.json(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { urls, uid } = req.body;

    // Validate URLs
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({
        success: false,
        error: 'URLs array is required and must not be empty',
      });

      return;
    }

    // Check if uid is provided
    if (!uid) {
      res.status(400).json({
        success: false,
        error: 'uid is required',
      });

      return;
    }

    // Check if DATABASE_URL is set
    const mongodbUrl = process.env.DATABASE_URL;
    if (!mongodbUrl) {
      res.status(500).json({
        success: false,
        error: 'DATABASE_URL not configured. Please set DATABASE_URL in environment variables.',
      });

      return;
    }

    // Get optional parameters from request body
    const databaseName = process.env.DATABASE_NAME || 'nfa';
    const collectionName = process.env.DATABASE_COLLECTION || 'knowledges';
    const embeddingsDimension = 1536;
    const embeddingsModel = 'text-embedding-3-small';

    // Create RAG builder with uid
    const builder = new RAGBuilder({
      mongodbUrl,
      databaseName,
      collectionName,
      embeddingsDimension,
      embeddingsModel,
      uid,
    });

    let totalParagraphs = 0;
    const processedUrls: string[] = [];

    // Process each URL
    for (const url of urls) {
      try {
        // Scrape the URL
        const scraper = new WebScraper({ urls: [url] });
        await scraper.scrape();
        const content = scraper.getContent();

        if (content && content.trim().length > 0) {
          // Tokenize the content into paragraphs
          const paragraphs = tokenizeParagraphs(content);

          if (paragraphs.length > 0) {
            await builder.buildFromTexts(paragraphs, false);
            totalParagraphs += paragraphs.length;
            processedUrls.push(url);
          }
        }
      } catch (error) {
        logger.error(`Error processing ${url}:`, error);
        // Continue with other URLs
      }
    }

    res.json({
      success: true,
      message: `Processed ${processedUrls.length} URLs successfully`,
      urlsProcessed: processedUrls,
      documentsCreated: totalParagraphs,
    });
  } catch (error) {
    logger.error('Error processing URLs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/knowledge/scrape
 * Fetch character JSON from S3 and process all knowledge items (files and URLs)
 */
router.post('/scrape', express.json(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { uid, url } = req.body;

    // Check if uid is provided
    if (!uid) {
      res.status(400).json({
        success: false,
        error: 'uid is required',
      });

      return;
    }

    // Check if DATABASE_URL is set
    const mongodbUrl = process.env.DATABASE_URL;
    if (!mongodbUrl) {
      res.status(500).json({
        success: false,
        error: 'DATABASE_URL not configured. Please set DATABASE_URL in environment variables.',
      });

      return;
    }

    // Fetch character JSON from S3
    let characterData: any;
    try {
      const response = await axios.get(url);
      characterData = response.data;
    } catch (error) {
      res.status(404).json({
        success: false,
        error: `Failed to fetch character data from IPFS: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      });

      return;
    }

    // Check if knowledge array exists
    if (!characterData.agent.knowledge || !Array.isArray(characterData.agent.knowledge)) {
      res.status(400).json({
        success: false,
        error: 'No knowledge items found in character data',
      });

      return;
    }

    // Get optional parameters
    const databaseName = process.env.DATABASE_NAME || 'nfa';
    const collectionName = process.env.DATABASE_COLLECTION || 'knowledges';
    const embeddingsDimension = 1536;
    const embeddingsModel = 'text-embedding-3-small';

    // Create RAG builder with uid
    const builder = new RAGBuilder({
      mongodbUrl,
      databaseName,
      collectionName,
      embeddingsDimension,
      embeddingsModel,
      uid,
    });

    // Clean up existing knowledge for this uid before adding new ones
    const _deletedCount = await builder.cleanupByUid(uid);

    let totalParagraphs = 0;
    const processedItems: { type: string; name: string; status: string }[] = [];

    // Process each knowledge item
    for (const item of characterData.agent.knowledge) {
      const { type, name, value } = item;

      try {
        if (type === 'url') {
          // Process URL
          const scraper = new WebScraper({ urls: [value] });
          await scraper.scrape();
          const content = scraper.getContent();

          if (content && content.trim().length > 0) {
            const paragraphs = tokenizeParagraphs(content);
            if (paragraphs.length > 0) {
              await builder.buildFromTexts(paragraphs, false);
              totalParagraphs += paragraphs.length;
              processedItems.push({ type, name, status: 'success' });
            }
          }
        } else if (['pdf', 'doc', 'docx', 'txt'].includes(type)) {
          // Process file from S3 URL
          const fileResponse = await axios.get(value, {
            responseType: 'arraybuffer',
          });
          const fileBuffer = Buffer.from(fileResponse.data);

          // Parse the file to extract text content
          const textContent = await fileParser.parseFile(fileBuffer, name);

          if (textContent && textContent.trim().length > 0) {
            const paragraphs = tokenizeParagraphs(textContent);
            if (paragraphs.length > 0) {
              await builder.buildFromTexts(paragraphs, false);
              totalParagraphs += paragraphs.length;
              processedItems.push({ type, name, status: 'success' });
            }
          }
        }
      } catch (error) {
        logger.error(`Error processing ${name}:`, error);
        processedItems.push({
          type,
          name,
          status: `failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${
        processedItems.filter((i) => i.status === 'success').length
      } knowledge items successfully`,
      itemsProcessed: processedItems,
      documentsCreated: totalParagraphs,
    });
  } catch (error) {
    logger.error('Error processing knowledge items:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as knowledgeRoutes };
