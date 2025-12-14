import axios, { AxiosResponse } from 'axios';
import express, { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';

import { createScopedLogger } from '../utils';

const logger = createScopedLogger('routes/elevenLabsRoutes');

const router: Router = express.Router();

const ELEVEN_API_URL: string = 'https://api.elevenlabs.io';
const ELEVEN_API_KEY: string = process.env.ELEVEN_API_KEY || '';

// Interface definitions
interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  fine_tuning?: {
    language?: string;
  };
  voice_verification?: {
    language?: string;
  };
  labels?: {
    gender?: string;
  };
  preview_url?: string;
}

interface ElevenLabsVoicesResponse {
  voices: ElevenLabsVoice[];
}

interface MappedVoice {
  id: string;
  name: string;
  language: string;
  gender: string;
  preview_url?: string;
}

interface TTSRequest {
  voiceId: string;
  text: string;
}

interface TTSResponse {
  success: boolean;
  filename?: string;
  error?: string;
}

// Get voices
router.get('/voices', async (_req: Request, res: Response): Promise<void> => {
  try {
    const url: string = `${ELEVEN_API_URL}/v2/voices?page_size=100`;
    const headers = {
      'xi-api-key': ELEVEN_API_KEY,
      'Content-Type': 'application/json',
    };
    const { data }: AxiosResponse<ElevenLabsVoicesResponse> = await axios.get(url, { headers });
    if (data && data.voices) {
      // Map the new API response format to match the expected format in the application
      res.json({
        data: data.voices.map((voice: ElevenLabsVoice): MappedVoice => {
          // Extract language and gender from labels if they exist
          const language: string =
            voice.fine_tuning?.language || voice.voice_verification?.language || 'English';
          const gender: string = voice.labels?.gender || 'Neutral';

          return {
            id: voice.voice_id,
            name: voice.name,
            language,
            gender,
            preview_url: voice.preview_url,
          };
        }),
      });
    } else {
      res.json({ data: [] });
    }
  } catch (error) {
    logger.error('Error get voices: ', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Text to speech
router.post('/tts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { voiceId, text }: TTSRequest = req.body;
    const url: string = `${ELEVEN_API_URL}/v1/text-to-speech/${voiceId}`;
    const headers = {
      'xi-api-key': ELEVEN_API_KEY,
      'Content-Type': 'application/json',
    };

    // Get audio data with responseType as arraybuffer to handle binary data
    const response: AxiosResponse<ArrayBuffer> = await axios.post(
      url,
      { text, model_id: 'eleven_multilingual_v2' },
      {
        headers,
        responseType: 'arraybuffer',
      },
    );

    // Create uploads directory if it doesn't exist
    if (!fs.existsSync('./uploads')) {
      fs.mkdirSync('./uploads');
    }

    // Generate filename and path
    const filename: string = `audio-${new Date().getTime()}.wav`;
    const filePath: string = path.join('./uploads', filename);

    // Write the audio data to a file
    fs.writeFileSync(filePath, Buffer.from(response.data));

    // Return the file path in the response
    res.json({
      success: true,
      filename,
    } as TTSResponse);
  } catch (error) {
    logger.error('Error text to speech: ', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    } as TTSResponse);
  }
});

export { router as elevenLabsRoutes };
