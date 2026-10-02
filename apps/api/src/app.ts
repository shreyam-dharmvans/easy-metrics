import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiRouter } from './routes/index.js';

// Load environment variables from root .env
dotenv.config({ path: '../../.env' });
dotenv.config(); // fallback to local .env if present

export const app = express();
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Middlewares
app.use(
  cors({
    origin: [CORS_ORIGIN, 'http://localhost:3000', 'http://localhost:8000'],
    credentials: true,
  })
);

// High-capacity JSON parser for batched telemetry payloads
app.use(express.json({ limit: '10mb' }));

// Health check endpoint (used by cloud container orchestrators and local testing)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'easymetrics-api',
    timestamp: new Date().toISOString(),
  });
});

// Mount API v1 router
app.use('/api/v1', apiRouter);
