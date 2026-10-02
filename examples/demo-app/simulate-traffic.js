/**
 * Automated Traffic Generator for EasyMetrics Demo Application:
 * Fires simulated requests with randomized intervals to populate metrics in PostgreSQL.
 */
const BASE_URL = process.env.DEMO_URL || 'http://localhost:5000';

const endpoints = [
  { method: 'GET', path: '/api/products', weight: 5 },
  { method: 'POST', path: '/api/checkout', weight: 3 },
  { method: 'GET', path: '/api/external-quote', weight: 3 },
  { method: 'GET', path: '/api/simulate-error', weight: 1 },
];

async function fireRequest(method, path) {
  try {
    const url = `${BASE_URL}${path}`;
    const start = Date.now();
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify({ item: 'headphones' }) : undefined,
    });
    const duration = Date.now() - start;
    console.log(`[Traffic] ${method} ${path} -> HTTP ${res.status} (${duration}ms)`);
  } catch (err) {
    console.error(`[Traffic] Failed ${method} ${path}:`, err.message);
  }
}

async function runSimulation(totalRequests = 20) {
  console.log(`🚀 Starting simulated traffic generator (${totalRequests} requests)...\n`);

  for (let i = 0; i < totalRequests; i++) {
    // Select weighted random endpoint
    const rand = Math.random();
    let target = endpoints[0];
    if (rand > 0.85) target = endpoints[3]; // error
    else if (rand > 0.55) target = endpoints[1]; // checkout
    else if (rand > 0.35) target = endpoints[2]; // external-quote

    await fireRequest(target.method, target.path);

    // Random delay between requests (100ms - 400ms)
    await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 300) + 100));
  }

  console.log('\n✨ Traffic simulation complete! Check your database at http://localhost:8081');
}

runSimulation();

