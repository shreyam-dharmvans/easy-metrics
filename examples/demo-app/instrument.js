import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
dotenv.config();

import { init } from '@easy-metrics/node';

// Initialize EasyMetrics before any other library (like Express) is loaded
init({
  serviceName: 'e-commerce-api',
  apiKey: process.env.EASY_METRICS_API_KEY || 'em_live_local_dev_key',
  debug: true,
  flushIntervalMs: 1500,
});

