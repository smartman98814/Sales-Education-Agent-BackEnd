import axios, { AxiosResponse } from 'axios';
import express, { Request, RequestHandler, Response, Router } from 'express';
import FormData from 'form-data';
import OpenAI from 'openai';

import { createScopedLogger } from '../utils';
import { upload } from './uploadRoutes';

const logger = createScopedLogger('routes/openaiRoutes');

const router: Router = express.Router();

const OPENAI_API_URL: string = 'https://api.openai.com/v1/chat/completions';
const OPENAI_API_KEY: string = process.env.OPENAI_API_KEY || '';

// Chat completion
router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages, model = 'gpt-4o', temperature = 0.7, max_tokens = 1000 } = req.body;

    if (!OPENAI_API_KEY) {
      res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured',
      });

      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    };

    const { data }: AxiosResponse = await axios.post(
      OPENAI_API_URL,
      {
        model,
        messages,
        temperature,
        max_tokens,
        stream: false,
      },
      { headers },
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Error calling OpenAI API:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Whisper transcription
router.post(
  '/whisper',
  upload.single('audio') as unknown as RequestHandler,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No audio file provided',
        });

        return;
      }

      if (!OPENAI_API_KEY) {
        res.status(500).json({
          success: false,
          error: 'OpenAI API key not configured',
        });

        return;
      }

      // Create form data for OpenAI Whisper API
      const formData = new FormData();
      formData.append('file', req.file.buffer, {
        filename: 'audio.webm',
        contentType: req.file.mimetype || 'audio/webm',
      });
      formData.append('model', 'whisper-1');

      const headers = {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        ...formData.getHeaders(),
      };

      const { data }: AxiosResponse = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        { headers },
      );

      res.json({
        success: true,
        text: data.text,
      });
    } catch (error) {
      logger.error('Error calling OpenAI Whisper API:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// Speech synthesis
router.post('/speech', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!OPENAI_API_KEY) {
      res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured',
      });

      return;
    }

    const { input, voice = 'coral', model = 'tts-1' } = req.body;

    if (!input) {
      res.status(400).json({
        success: false,
        error: 'Input text is required',
      });

      return;
    }

    const openai = new OpenAI();
    const response = await openai.audio.speech.create({
      model,
      voice,
      input,
    });

    // Set appropriate headers for audio streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'inline; filename="speech.mp3"');
    res.setHeader('Cache-Control', 'no-cache');

    // Convert the response to buffer and send
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    logger.error('Error calling OpenAI Audio Speech API:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Speech synthesis (returns base64 encoded audio)
router.post('/speech-base64', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!OPENAI_API_KEY) {
      res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured',
      });

      return;
    }

    const { input, voice = 'coral', model = 'gpt-4o-mini-tts' } = req.body;

    if (!input) {
      res.status(400).json({
        success: false,
        error: 'Input text is required',
      });

      return;
    }

    const openai = new OpenAI();
    const response = await openai.audio.speech.create({
      model,
      voice,
      input,
    });

    // Convert the stream to buffer and then to base64
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    res.json({
      success: true,
      audio: base64Audio,
      contentType: 'audio/mpeg',
    });
  } catch (error) {
    logger.error('Error calling OpenAI Audio Speech API:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as openaiRoutes };
