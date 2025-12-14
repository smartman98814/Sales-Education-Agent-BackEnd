import { Request, Response, Router } from 'express';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '../config';
import { Agent } from '../models';
import { AuthRequest, authMiddleware } from './authRoutes';

const router = Router();

router.post('/save', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { characterUrl, id } = req.body;

    if (!characterUrl) {
      return res.status(400).json({
        error: 'Character URL is required',
      });
    }

    if (!id) {
      return res.status(400).json({
        error: 'UID is required',
      });
    }

    const db = await connectToDatabase();
    const agentsCollection = db.collection('agents');
    const countersCollection = db.collection('counters');

    const agentId = new ObjectId(id);
    const userObjectId = new ObjectId(userId);

    // Check if agent already exists
    const existingAgent = await agentsCollection.findOne({ _id: agentId });

    if (existingAgent) {
      // Verify ownership
      if (existingAgent.userId.toString() !== userId) {
        return res.status(403).json({ error: 'Not authorized to update this agent' });
      }

      // Update existing agent
      const updatedAgent = await agentsCollection.findOneAndUpdate(
        { _id: agentId },
        {
          $set: {
            characterUrl,
            updatedAt: new Date(),
          },
        },
        {
          returnDocument: 'after',
        },
      );

      res.json({
        success: true,
        message: 'Agent updated successfully',
        data: {
          agentId: updatedAgent?._id,
          agentNumber: updatedAgent?.agentNumber,
          characterUrl: updatedAgent?.characterUrl,
        },
      });
    } else {
      // Create new agent
      // Get the next agent number using atomic operation
      const counter = await countersCollection.findOneAndUpdate(
        { _id: 'agentNumber' as any },
        { $inc: { sequence: 1 } },
        {
          upsert: true,
          returnDocument: 'after',
        },
      );

      const agentNumber = counter?.sequence || 1;

      const agent: Agent = {
        _id: agentId,
        agentNumber,
        userId: userObjectId,
        characterUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await agentsCollection.insertOne(agent);

      res.json({
        success: true,
        message: 'Agent created successfully',
        data: {
          agentId: agent._id,
          agentNumber: agent.agentNumber,
          characterUrl: agent.characterUrl,
        },
      });
    }
  } catch (_error) {
    res.status(500).json({ error: 'Failed to save agent' });
  }
});

router.get('', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const db = await connectToDatabase();
    const agentsCollection = db.collection('agents');

    const myAgents = await agentsCollection
      .find({
        userId: new ObjectId(userId),
      })
      .toArray();

    // Transform _id to id in the response
    const transformedAgents = myAgents.map((agent) => ({
      id: agent._id,
      agentNumber: agent.agentNumber,
      characterUrl: agent.characterUrl,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    }));

    res.json({
      success: true,
      message: 'Agents fetched successfully',
      data: {
        agents: transformedAgents,
      },
    });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to get agents' });
  }
});

/**
 * GET /api/agents/:identifier
 * Get agent by ID or agentNumber
 */
router.get('/:identifier', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      return res.status(400).json({ error: 'Agent ID or agentNumber is required' });
    }

    const db = await connectToDatabase();
    const agentsCollection = db.collection('agents');

    let agent;

    // Check if identifier is a valid ObjectId (24 hex characters)
    if (ObjectId.isValid(identifier) && identifier.length === 24) {
      agent = await agentsCollection.findOne({ _id: new ObjectId(identifier) });
    }

    // If not found by ID, try to find by agentNumber
    if (!agent) {
      const agentNumber = parseInt(identifier, 10);
      if (!isNaN(agentNumber)) {
        agent = await agentsCollection.findOne({ agentNumber });
      }
    }

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Transform _id to id in the response
    const transformedAgent = {
      id: agent._id,
      agentNumber: agent.agentNumber,
      characterUrl: agent.characterUrl,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };

    res.json({
      success: true,
      message: 'Agent fetched successfully',
      data: transformedAgent,
    });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

/**
 * PATCH /api/agents/character
 * Store or update agent character URL
 */
router.patch('/character', async (req: Request, res: Response) => {
  try {
    const { agentId, characterUrl } = req.body;

    if (!agentId || typeof agentId !== 'string') {
      return res.status(400).json({ error: 'Agent ID is required' });
    }

    if (!characterUrl || typeof characterUrl !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const db = await connectToDatabase();
    const agentsCollection = db.collection('agents');

    const updatedAgent = await agentsCollection.findOneAndUpdate(
      { _id: new ObjectId(agentId) },
      {
        $set: {
          characterUrl,
          updatedAt: new Date(),
        },
      },
      {
        returnDocument: 'after',
      },
    );

    if (!updatedAgent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      success: true,
      agentId: updatedAgent._id,
      characterUrl: updatedAgent.characterUrl,
    });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to store character URL' });
  }
});

export const agentRoutes = router;
