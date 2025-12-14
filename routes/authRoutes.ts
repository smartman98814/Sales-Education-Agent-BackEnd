import { NextFunction, Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '../config';
import { User } from '../models';
import { createScopedLogger } from '../utils';

const logger = createScopedLogger('routes/authRoutes');

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Interface for authenticated request
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email?: string;
  };
}

/**
 * Middleware to verify JWT token
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.jwt || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };
    next();
  } catch (error) {
    logger.error('JWT verification failed:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, displayName, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection('users');

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser: User = {
      email: email.toLowerCase(),
      password: hashedPassword,
      displayName: displayName || email.split('@')[0],
      username,
      authMethod: 'email',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);
    const userId = result.insertedId.toString();

    // Generate JWT
    const token = jwt.sign(
      { userId, email: newUser.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Set JWT as httpOnly cookie
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        email: newUser.email,
        displayName: newUser.displayName,
        username: newUser.username,
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login user with email and password
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection('users');

    // Find user
    const user = await usersCollection.findOne<User>({
      email: email.toLowerCase(),
    });

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Generate JWT
    const userId = user._id!.toString();
    const token = jwt.sign(
      { userId, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Set JWT as httpOnly cookie
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: userId,
        email: user.email,
        displayName: user.displayName,
        username: user.username,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/isLoggedIn
 * Check if user is logged in
 */
router.get("/isLoggedIn", async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.jwt || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.json(false);
    }

    jwt.verify(token, JWT_SECRET);
    return res.json(true);
  } catch (error) {
    logger.error('Error checking login status:', error);
    return res.json(false);
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('jwt');

  return res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Get current user profile (protected route)
 */
router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'No user ID in token' });
    }

    // Get user from database
    try {
      const db = await connectToDatabase();
      const usersCollection = db.collection('users');

      const user = await usersCollection.findOne<User>({
        _id: new ObjectId(userId),
      });

      if (user) {
        return res.json({
          id: user._id,
          email: user.email,
          username: user.username,
          displayName: user.displayName || user.email.split('@')[0],
          avatar: user.avatar,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
        });
      }
    } catch (dbError) {
      logger.error('Database error:', dbError);
    }

    return res.status(404).json({ error: 'User not found' });
  } catch (error) {
    logger.error('Error getting user:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * PUT /api/auth/me
 * Update current user profile (protected route)
 */
router.put("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { displayName, avatar, username } = req.body;

    const db = await connectToDatabase();
    const usersCollection = db.collection('users');

    const updatedUser = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      {
        $set: {
          username,
          displayName,
          avatar,
          updatedAt: new Date(),
        },
      },
      {
        returnDocument: 'after',
      },
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: updatedUser._id,
      email: updatedUser.email,
      username: updatedUser.username,
      displayName: updatedUser.displayName || updatedUser.email.split('@')[0],
      avatar: updatedUser.avatar,
    });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export const authRoutes = router;
