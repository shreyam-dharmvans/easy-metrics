import { app } from './app.js';
import { ensureDefaultProject } from './services/seed.js';
import { autoAlignDemoTraces } from './services/demoSync.js';

const PORT = process.env.API_PORT || 4000;

// Start server and lifecycle services
app.listen(PORT, async () => {
  console.log(`🚀 EasyMetrics API running on http://localhost:${PORT}`);
  console.log(`📡 Ingestion endpoint: http://localhost:${PORT}/api/v1/telemetry/ingest`);
  await ensureDefaultProject();
  await autoAlignDemoTraces();
  // Keep demo dataset continuously fresh in background every 5 minutes
  setInterval(autoAlignDemoTraces, 5 * 60 * 1000);
});
