import express, { Request, RequestHandler, Response, Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';

const router: Router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file size limit
    fieldSize: 5 * 1024 * 1024, // 5MB field size limit
    files: 10, // Maximum number of files
    parts: 100, // Maximum number of parts
  },
});

// Interface definitions
interface UploadResponse {
  success: boolean;
  filename?: string;
  error?: string;
}

interface CharacterUploadResponse {
  success: boolean;
  jsonFilename?: string;
  error?: string;
}

router.post(
  '/file',
  upload.single('file') as unknown as RequestHandler,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Check if file exists in request
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded',
        } as UploadResponse);

        return;
      }

      // Create uploads directory if it doesn't exist
      if (!fs.existsSync('./uploads')) {
        fs.mkdirSync('./uploads');
      }

      // Generate filename with timestamp
      const filename: string = `${
        req.body.type
      }-${new Date().getTime()}${path.extname(req.file.originalname)}`;
      const filePath: string = path.join('./uploads', filename);

      // Write the file to disk
      fs.writeFileSync(filePath, req.file.buffer);

      // Return the file path in the response
      res.json({
        success: true,
        filename,
      } as UploadResponse);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as UploadResponse);
    }
  },
);

const CHARACTERS_FOLDER: string = process.env.CHARACTERS_FOLDER || '';

router.post('/character', express.json(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { uid, voice, image } = req.body;

    // Check if both parameters exist
    if (!voice || !image) {
      res.status(400).json({
        success: false,
        error: 'Both voice and image parameters are required',
      } as CharacterUploadResponse);

      return;
    }

    // Create the target directory if it doesn't exist
    const targetDir = CHARACTERS_FOLDER;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Create JSON data
    const characterData = {
      voice,
      image,
    };

    // Generate filename with timestamp
    const jsonFilename = `character-${uid}.json`;
    const jsonFilePath = path.join(targetDir, jsonFilename);

    // Write JSON file
    fs.writeFileSync(jsonFilePath, JSON.stringify(characterData, null, 2));

    // Return the filename in the response
    res.json({
      success: true,
      jsonFilename,
    } as CharacterUploadResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    } as CharacterUploadResponse);
  }
});

export { router as uploadRoutes, upload };
