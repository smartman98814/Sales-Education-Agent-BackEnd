import axios, { AxiosResponse } from 'axios';
import express, { Request, Response, Router } from 'express';

import { createScopedLogger } from '../utils';

const logger = createScopedLogger('routes/anthropicRoutes');
const router: Router = express.Router();

const ANTHROPIC_API_URL: string = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_KEY: string = process.env.ANTHROPIC_API_KEY || '';

// Chat completion
router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      messages,
      model = 'claude-sonnet-4-20250514',
      temperature = 0.7,
      max_tokens = 1000,
      system,
    } = req.body;

    if (!ANTHROPIC_API_KEY) {
      res.status(500).json({
        success: false,
        error: 'Anthropic API key not configured',
      });

      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    };

    const { data }: AxiosResponse = await axios.post(
      ANTHROPIC_API_URL,
      {
        model,
        messages,
        max_tokens,
        temperature,
        system,
      },
      { headers },
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Error calling Anthropic API:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as anthropicRoutes };
