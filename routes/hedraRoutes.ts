import axios, { AxiosResponse } from 'axios';
import express, { Request, Response, Router } from 'express';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

import { createScopedLogger } from '../utils';

const logger = createScopedLogger('routes/hedraRoutes');

const router: Router = express.Router();

const HEDRA_V2_API_URL: string = 'https://api.hedra.com/web-app/public';
const HEDRA_V2_API_KEY: string = process.env.HEDRA_V2_API_KEY || '';

// Interface definitions
interface HedraAssetResponse {
  data: any;
}

// Create asset
router.post('/assets', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    const url: string = `${HEDRA_V2_API_URL}/assets`;
    const headers = {
      'X-API-Key': HEDRA_V2_API_KEY,
    };

    const { data }: AxiosResponse = await axios.post(url, body, { headers });
    res.json({ data } as HedraAssetResponse);
  } catch (error) {
    logger.error('Error creating assets:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get asset by ID and type
router.get('/assets/:id/:type', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const type = req.params.type;
    const url: string = `${HEDRA_V2_API_URL}/assets?ids=${id}&type=${type}`;
    const headers = {
      'X-API-Key': HEDRA_V2_API_KEY,
    };

    const { data }: AxiosResponse = await axios.get(url, { headers });
    res.json({ data } as HedraAssetResponse);
  } catch (error) {
    logger.error('Error creating assets:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Upload asset
router.post('/assets/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const id: string = req.body.id;
    const filename: string = req.body.name;
    const filePath: string = path.join('./uploads', filename);

    // Create a readable stream from the file
    const fileStream = fs.createReadStream(filePath);

    // Determine content type based on file extension
    const ext: string = path.extname(filename).toLowerCase();
    let contentType: string = 'application/octet-stream'; // Default content type

    if (ext === '.png') {
      contentType = 'image/png';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    } else if (ext === '.mp4') {
      contentType = 'video/mp4';
    } else if (ext === '.mp3') {
      contentType = 'audio/mpeg';
    } else if (ext === '.wav') {
      contentType = 'audio/wav';
    }

    const formData = new FormData();
    formData.append('file', fileStream, {
      filename,
      contentType,
    });

    const url: string = `${HEDRA_V2_API_URL}/assets/${id}/upload`;
    const headers = {
      'X-API-Key': HEDRA_V2_API_KEY,
      ...formData.getHeaders(),
    };

    const { data }: AxiosResponse = await axios.post(url, formData, {
      headers,
    });
    res.json({ data } as HedraAssetResponse);
  } catch (error) {
    logger.error('Error upload assets:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Generate asset
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    const url: string = `${HEDRA_V2_API_URL}/generations`;
    const headers = {
      'X-API-Key': HEDRA_V2_API_KEY,
      'Content-Type': 'application/json',
    };

    const { data }: AxiosResponse = await axios.post(url, body, { headers });
    res.json({ data } as HedraAssetResponse);
  } catch (error) {
    logger.error('Error generating asset: ', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get generation status
router.get('/generate/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id: string = req.params.id;
    const url: string = `${HEDRA_V2_API_URL}/generations/${id}/status`;
    const headers = {
      'X-API-Key': HEDRA_V2_API_KEY,
    };

    const { data }: AxiosResponse = await axios.get(url, { headers });
    res.json({ data } as HedraAssetResponse);
  } catch (error) {
    logger.error('Error video status check: ', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as hedraRoutes };
