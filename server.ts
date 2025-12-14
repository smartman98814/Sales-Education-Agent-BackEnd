import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

// Import database connection
import { connectToDatabase } from './config';
// Import routes
import {
  agentRoutes,
  anthropicRoutes,
  authRoutes,
  elevenLabsRoutes,
  hedraRoutes,
  knowledgeRoutes,
  openaiRoutes,
  uploadRoutes,
} from './routes';
// Optional integrations - uncomment if needed:
// import { lettaRoutes } from './routes';
import { createScopedLogger } from './utils';

const logger = createScopedLogger('server');

// Load environment variables
dotenv.config();

const app = express();
const PORT: number = 3005;

// Middleware - Configure request size limits
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.ALLOWED_CORS?.split(",") ?? [
      "http://localhost:3001",
      "http://localhost:3005",
      "http://localhost:3000",
    ],
    credentials: true,
  }),
);

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/hedra", hedraRoutes);
app.use("/api/elevenlabs", elevenLabsRoutes);
app.use("/api/openai", openaiRoutes);
app.use("/api/anthropic", anthropicRoutes);
app.use("/api/knowledge", knowledgeRoutes);
// Optional integrations - uncomment if needed:
// app.use("/api/letta", lettaRoutes);
app.get("/healthcheck", (_req, res) => {
  res.send("OK");
});

// Root route
app.get('/', (_req, res) => {
  res.send('Sales Training Platform Backend Server is running');
});

const startServer = async () => {
  try {
    try {
      await connectToDatabase();
      logger.log('✅ Connected to MongoDB');
    } catch (dbError) {
      logger.warn('⚠️ MongoDB connection failed, continuing without database:', dbError);
    }

    app.listen(PORT, (): void => {
      logger.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
