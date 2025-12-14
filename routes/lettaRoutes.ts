import express, { Request, Response, Router } from 'express';

import { createScopedLogger } from '../utils';

const logger = createScopedLogger('routes/lettaRoutes');

const router: Router = express.Router();

const LETTA_API_BASE_URL: string = process.env.LETTA_API_SERVER_URL || '';
const AGENT_ID: string = process.env.LETTA_AGENT_ID || '';
const LETTA_ACCESS_KEY: string = process.env.LETTA_ACCESS_KEY || '';

// Helper function to handle API errors
// const handleApiError = (error: any, message: string) => {
//   logger.error(`${message}:`, error);
//   throw new Error(`${message}: ${error.message || 'Unknown error'}`);
// };

// Common function to make API requests to Letta with Bearer token authorization
const makeLettaApiRequest = async (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  endpoint: string,
  data?: any,
): Promise<any> => {
  const url = `${LETTA_API_BASE_URL}${endpoint}`;
  const headers: any = {
    Authorization: `Bearer ${LETTA_ACCESS_KEY}`,
  };

  // Only add Content-Type for requests with data
  if (data) {
    headers['Content-Type'] = 'application/json';
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const responseData = await response.json();

  return { data: responseData };
};

// Get agent context window
router.get('/context', async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!LETTA_API_BASE_URL || !AGENT_ID) {
      res.status(500).json({
        success: false,
        error: 'Letta API configuration missing',
      });

      return;
    }

    const { data } = await makeLettaApiRequest('GET', `/v1/agents/${AGENT_ID}/context`);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Error fetching context window:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get agent information
router.get('/agent', async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!LETTA_API_BASE_URL || !AGENT_ID) {
      res.status(500).json({
        success: false,
        error: 'Letta API configuration missing',
      });

      return;
    }

    const { data } = await makeLettaApiRequest('GET', `/v1/agents/${AGENT_ID}`);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Error fetching agent info:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get agent messages
router.get('/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!LETTA_API_BASE_URL || !AGENT_ID) {
      res.status(500).json({
        success: false,
        error: 'Letta API configuration missing',
      });

      return;
    }

    const { limit = 10, before } = req.query;
    let endpoint = `/v1/agents/${AGENT_ID}/messages?limit=${limit}`;

    if (before) {
      endpoint += `&before=${before}`;
    }

    const { data } = await makeLettaApiRequest('GET', endpoint);

    // Filter messages based on message type (same logic as frontend)
    const messages: any[] = [];
    data.forEach((message: any) => {
      switch (message.message_type) {
        case 'user_message':
          if (!message.content.includes('heartbeat')) {
            messages.push(message);
          }
          break;
        case 'assistant_message':
          messages.push(message);
          break;
        default:
          break;
      }
    });

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    logger.error('Error fetching agent messages:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [], // Return empty array on error like frontend
    });
  }
});

// Send message to agent
router.post('/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!LETTA_API_BASE_URL || !AGENT_ID) {
      res.status(500).json({
        success: false,
        error: 'Letta API configuration missing',
      });

      return;
    }

    const { content } = req.body;

    if (!content) {
      res.status(400).json({
        success: false,
        error: 'Message content is required',
      });

      return;
    }

    const body = {
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: content,
            },
          ],
        },
      ],
    };

    const { data } = await makeLettaApiRequest('POST', `/v1/agents/${AGENT_ID}/messages`, body);

    // Filter messages based on message type (same logic as frontend)
    const messages: any[] = [];
    data.messages.forEach((message: any) => {
      switch (message.message_type) {
        case 'user_message':
          if (!message.content.includes('heartbeat')) {
            messages.push(message);
          }
          break;
        case 'assistant_message':
          messages.push(message);
          break;
        default:
          break;
      }
    });

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// List LLM models
router.get('/models', async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!LETTA_API_BASE_URL) {
      res.status(500).json({
        success: false,
        error: 'Letta API configuration missing',
      });

      return;
    }

    const { data } = await makeLettaApiRequest('GET', '/v1/models/');

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    logger.error('Error listing models:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [], // Return empty array on error like frontend
    });
  }
});

// Update agent
router.patch('/agent', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!LETTA_API_BASE_URL || !AGENT_ID) {
      res.status(500).json({
        success: false,
        error: 'Letta API configuration missing',
      });

      return;
    }

    const settings = req.body;
    const { data } = await makeLettaApiRequest('PATCH', `/v1/agents/${AGENT_ID}`, settings);

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    logger.error('Error updating agent:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [], // Return empty array on error like frontend
    });
  }
});

// Update memory block
router.patch('/memory/blocks/:label', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!LETTA_API_BASE_URL || !AGENT_ID) {
      res.status(500).json({
        success: false,
        error: 'Letta API configuration missing',
      });

      return;
    }

    const { label } = req.params;
    const block = req.body;

    const { data } = await makeLettaApiRequest(
      'PATCH',
      `/v1/agents/${AGENT_ID}/core-memory/blocks/${label}`,
      block,
    );

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    logger.error('Error updating memory block:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [], // Return empty array on error like frontend
    });
  }
});

export { router as lettaRoutes };
