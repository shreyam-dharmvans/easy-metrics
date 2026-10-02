// Step 1: Initialize EasyMetrics instrumentation before Express is loaded
import './instrument.js';

// Step 2: Standard application code
import express from 'express';

const app = express();
const PORT = process.env.DEMO_PORT || 5000;

app.use(express.json());

// 1. Fast, healthy endpoint
app.get('/api/products', (req, res) => {
  res.json([
    { id: 1, name: 'Wireless Headphones', price: 99 },
    { id: 2, name: 'Mechanical Keyboard', price: 149 },
    { id: 3, name: 'Gaming Mouse', price: 59 },
  ]);
});

// 2. Slow endpoint (simulates third-party payment gateway delay)
app.post('/api/checkout', async (req, res) => {
  // Simulate heavy payment processor delay (e.g. Stripe / PayPal taking 750ms)
  await new Promise((resolve) => setTimeout(resolve, 750));

  res.json({
    success: true,
    orderId: `ord_${Math.floor(Math.random() * 100000)}`,
    amount: 149.99,
    status: 'paid',
  });
});

// 3. Real outgoing network call (Tests OpenTelemetry parent-child trace correlation)
app.get('/api/external-quote', async (req, res) => {
  try {
    // OpenTelemetry auto-instrumentation will automatically intercept this fetch call!
    const response = await fetch('https://dummyjson.com/quotes/random');
    const data = await response.json();
    res.json({ source: 'dummyjson-api', quote: data });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch from external API' });
  }
});

// 4. Failing endpoint (Tests 500 status code and error rate metrics)
app.get('/api/simulate-error', (req, res) => {
  res.status(500).json({
    error: 'InternalServerError',
    message: 'Simulated database transaction lock timeout',
  });
});

app.listen(PORT, () => {
  console.log(`\n🛍️ Demo Application running at http://localhost:${PORT}`);
  console.log(`Available endpoints to test:`);
  console.log(`  - GET  http://localhost:${PORT}/api/products       (Fast: ~15ms)`);
  console.log(`  - POST http://localhost:${PORT}/api/checkout       (Slow: ~750ms Stripe delay)`);
  console.log(`  - GET  http://localhost:${PORT}/api/external-quote (Outgoing HTTP call)`);
  console.log(`  - GET  http://localhost:${PORT}/api/simulate-error (Error: 500)\n`);
});

