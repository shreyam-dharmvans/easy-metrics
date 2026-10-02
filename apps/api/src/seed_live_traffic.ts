import { randomBytes } from 'crypto';
import { prisma } from './prisma.js';

interface RouteDef {
  method: string;
  path: string;
  minDuration: number;
  maxDuration: number;
  errorRate: number; // 0 to 1
  serviceName: string;
  rootInput?: Record<string, any>;
  rootOutput?: Record<string, any>;
  children: Array<{
    name: string;
    kind: 'CLIENT' | 'INTERNAL';
    durationFactor: number;
    errorRate?: number;
    input?: Record<string, any>;
    output?: Record<string, any>;
  }>;
}

const DEMO_ROUTES: RouteDef[] = [
  {
    method: 'GET',
    path: '/api/products',
    minDuration: 25,
    maxDuration: 130,
    errorRate: 0.02,
    serviceName: 'demo-web-app',
    rootInput: {
      params: { category: 'electronics', in_stock: true, limit: 20 },
      headers: { accept: 'application/json', 'user-agent': 'EasyMetrics-Client/1.0' },
    },
    rootOutput: {
      count: 14,
      items: [
        { id: 'prod_901', name: 'Premium Cloud Instance (4 vCPU)', price: 49.00, in_stock: true },
        { id: 'prod_902', name: 'NVMe Storage Expansion (200GB)', price: 29.00, in_stock: true },
        { id: 'prod_903', name: 'Load Balancer Dedicated Addon', price: 19.50, in_stock: true },
      ],
    },
    children: [
      {
        name: 'SELECT * FROM "products" WHERE in_stock = true',
        kind: 'INTERNAL',
        durationFactor: 0.6,
        input: {
          query: 'SELECT id, name, price, stock FROM products WHERE in_stock = $1 ORDER BY created_at DESC LIMIT $2',
          parameters: [true, 20],
        },
        output: {
          rowCount: 14,
          rows: [
            { id: 'prod_901', name: 'Premium Cloud Instance (4 vCPU)', price: 49.00 },
            { id: 'prod_902', name: 'NVMe Storage Expansion (200GB)', price: 29.00 },
          ],
        },
      },
      {
        name: 'Redis.get:catalog:cache',
        kind: 'CLIENT',
        durationFactor: 0.15,
        input: {
          command: 'GET',
          key: 'catalog:cache:electronics:page_1',
          ttlSeconds: 300,
        },
        output: {
          hit: true,
          sizeBytes: 3120,
          cachedAt: '2026-09-26T05:15:00Z',
        },
      },
    ],
  },
  {
    method: 'POST',
    path: '/api/checkout',
    minDuration: 450,
    maxDuration: 880,
    errorRate: 0.08,
    serviceName: 'demo-web-app',
    rootInput: {
      cartId: 'cart_88291',
      customerId: 'usr_4401',
      currency: 'USD',
      amount: 149.50,
      paymentMethodId: 'pm_card_visa_4242',
      idempotencyKey: 'idem_checkout_991823',
    },
    rootOutput: {
      orderId: 'ord_2026_9941',
      status: 'confirmed',
      amountCharged: 149.50,
      currency: 'USD',
      chargeId: 'ch_3N8291',
      receiptUrl: 'https://pay.stripe.com/receipts/ch_3N8291',
    },
    children: [
      {
        name: 'auth.verify_jwt_token',
        kind: 'INTERNAL',
        durationFactor: 0.04,
        input: {
          token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_token_data',
          requiredScope: 'orders:create',
        },
        output: {
          valid: true,
          userId: 'usr_4401',
          role: 'customer',
          expiresAt: '2026-09-27T00:00:00Z',
        },
      },
      {
        name: 'ioredis.get session:usr_9921',
        kind: 'INTERNAL',
        durationFactor: 0.03,
        input: {
          command: 'GET',
          key: 'session:usr_9921',
        },
        output: {
          exists: true,
          session: { cartCount: 2, lastActiveMinutesAgo: 1 },
        },
      },
      {
        name: 'SELECT * FROM "users" WHERE id = $1',
        kind: 'INTERNAL',
        durationFactor: 0.07,
        input: {
          query: 'SELECT id, email, tier, is_verified FROM users WHERE id = $1',
          parameters: ['usr_4401'],
        },
        output: {
          id: 'usr_4401',
          email: 'alex.dev@easymetrics.io',
          tier: 'pro_annual',
          is_verified: true,
        },
      },
      {
        name: 'SELECT * FROM "cart_items" WHERE user_id = $1',
        kind: 'INTERNAL',
        durationFactor: 0.08,
        input: {
          query: 'SELECT item_id, sku, quantity, unit_price FROM cart_items WHERE user_id = $1',
          parameters: ['usr_4401'],
        },
        output: {
          itemsCount: 2,
          subtotal: 149.50,
          items: [
            { sku: 'SKU-PROD-901', quantity: 2, unit_price: 49.00 },
            { sku: 'SKU-PROD-903', quantity: 1, unit_price: 51.50 },
          ],
        },
      },
      {
        name: 'POST https://api.stripe.com/v1/charges',
        kind: 'CLIENT',
        durationFactor: 0.68,
        input: {
          method: 'POST',
          url: 'https://api.stripe.com/v1/charges',
          headers: { 'Idempotency-Key': 'idem_checkout_991823' },
          body: {
            amount: 14950,
            currency: 'usd',
            source: 'pm_card_visa_4242',
            description: 'Order ord_2026_9941 for usr_4401',
          },
        },
        output: {
          id: 'ch_3N8291',
          status: 'succeeded',
          paid: true,
          amount: 14950,
          currency: 'usd',
          receipt_url: 'https://pay.stripe.com/receipts/ch_3N8291',
        },
      },
      {
        name: 'INSERT INTO "orders" ("userId", "amount")',
        kind: 'INTERNAL',
        durationFactor: 0.08,
        input: {
          query: 'INSERT INTO orders ("userId", "amount", "status", "chargeId") VALUES ($1, $2, $3, $4) RETURNING id',
          parameters: ['usr_4401', 149.50, 'confirmed', 'ch_3N8291'],
        },
        output: {
          insertedId: 'ord_2026_9941',
          status: 'committed',
        },
      },
    ],
  },
  {
    method: 'GET',
    path: '/api/external-quote',
    minDuration: 620,
    maxDuration: 1250,
    errorRate: 0.12,
    serviceName: 'demo-web-app',
    rootInput: {
      params: { base: 'USD', currencies: 'EUR,GBP,CAD,JPY' },
    },
    rootOutput: {
      base: 'USD',
      date: '2026-09-26',
      rates: { EUR: 0.924, GBP: 0.789, CAD: 1.352, JPY: 154.21 },
    },
    children: [
      {
        name: 'GET https://rates.currencyapi.com/v3/latest',
        kind: 'CLIENT',
        durationFactor: 0.8,
        input: {
          method: 'GET',
          url: 'https://rates.currencyapi.com/v3/latest?base_currency=USD&currencies=EUR,GBP,CAD,JPY',
          headers: { 'apikey': 'cur_live_992147318491823' },
        },
        output: {
          meta: { last_updated_at: '2026-09-26T04:59:59Z' },
          data: {
            EUR: { code: 'EUR', value: 0.924 },
            GBP: { code: 'GBP', value: 0.789 },
            CAD: { code: 'CAD', value: 1.352 },
            JPY: { code: 'JPY', value: 154.21 },
          },
        },
      },
    ],
  },
  {
    method: 'GET',
    path: '/api/users/profile',
    minDuration: 30,
    maxDuration: 90,
    errorRate: 0.0,
    serviceName: 'demo-web-app',
    rootInput: {
      userId: 'usr_7712',
      headers: { authorization: 'Bearer tok_mock_user_profile_secret' },
    },
    rootOutput: {
      id: 'usr_7712',
      displayName: 'Sarah Chen',
      email: 'sarah.chen@techcorp.io',
      role: 'Staff DevOps Engineer',
      organizations: ['org_easy_metrics', 'org_acme_corp'],
    },
    children: [
      {
        name: 'SELECT * FROM "users" WHERE id = $1',
        kind: 'INTERNAL',
        durationFactor: 0.7,
        input: {
          query: 'SELECT id, displayName, email, role, avatarUrl FROM users WHERE id = $1',
          parameters: ['usr_7712'],
        },
        output: {
          id: 'usr_7712',
          displayName: 'Sarah Chen',
          email: 'sarah.chen@techcorp.io',
          role: 'Staff DevOps Engineer',
        },
      },
    ],
  },
  {
    method: 'GET',
    path: '/api/simulate-error',
    minDuration: 90,
    maxDuration: 220,
    errorRate: 1.0,
    serviceName: 'demo-web-app',
    rootInput: {
      mode: 'fault_injection',
      target: 'faulty_table',
    },
    rootOutput: {
      error: 'QueryFailedError: relation "faulty_table" does not exist',
      code: '42P01',
    },
    children: [
      {
        name: 'DatabaseQuery: SELECT NULL FROM "faulty_table"',
        kind: 'INTERNAL',
        durationFactor: 0.85,
        errorRate: 1.0,
        input: {
          query: 'SELECT NULL FROM "faulty_table" WHERE id = $1',
          parameters: ['err_999'],
        },
        output: {
          error: 'PostgreSQL error: relation "faulty_table" does not exist (SQLSTATE 42P01)',
          rowCount: 0,
        },
      },
    ],
  },
];

const PAYMENT_ROUTES: RouteDef[] = [
  {
    method: 'POST',
    path: '/v1/charges',
    minDuration: 140,
    maxDuration: 380,
    errorRate: 0.05,
    serviceName: 'payment-gateway',
    rootInput: {
      amount: 25000,
      currency: 'eur',
      merchantId: 'mch_eu_9812',
      cardToken: 'tok_card_eu_99128',
    },
    rootOutput: {
      chargeId: 'tx_eu_881920',
      status: 'settled',
      amount: 25000,
      currency: 'eur',
      fee: 420,
    },
    children: [
      {
        name: 'POST https://vault.payment.net/tokens/tokenize',
        kind: 'CLIENT',
        durationFactor: 0.5,
        input: {
          method: 'POST',
          url: 'https://vault.payment.net/tokens/tokenize',
          body: { cardToken: 'tok_card_eu_99128', pciEnclave: 'eu-central-1' },
        },
        output: {
          tokenRef: 'tokref_998124',
          brand: 'Mastercard',
          last4: '8812',
          expMonth: 12,
          expYear: 2029,
        },
      },
      {
        name: 'INSERT INTO "transactions"',
        kind: 'INTERNAL',
        durationFactor: 0.3,
        input: {
          query: 'INSERT INTO transactions (id, merchant_id, amount, currency, status) VALUES ($1, $2, $3, $4, $5)',
          parameters: ['tx_eu_881920', 'mch_eu_9812', 25000, 'eur', 'settled'],
        },
        output: {
          insertedRows: 1,
        },
      },
    ],
  },
  {
    method: 'POST',
    path: '/v1/refunds',
    minDuration: 95,
    maxDuration: 240,
    errorRate: 0.03,
    serviceName: 'payment-gateway',
    rootInput: {
      transactionId: 'tx_eu_881920',
      reason: 'customer_request',
      refundAmount: 25000,
    },
    rootOutput: {
      refundId: 'rfnd_991204',
      transactionId: 'tx_eu_881920',
      status: 'processed',
      refundedAmount: 25000,
    },
    children: [
      {
        name: 'UPDATE "transactions" SET status = "refunded"',
        kind: 'INTERNAL',
        durationFactor: 0.4,
        input: {
          query: 'UPDATE transactions SET status = $1, refunded_at = NOW() WHERE id = $2',
          parameters: ['refunded', 'tx_eu_881920'],
        },
        output: {
          affectedRows: 1,
        },
      },
    ],
  },
  {
    method: 'GET',
    path: '/v1/customers',
    minDuration: 40,
    maxDuration: 110,
    errorRate: 0.01,
    serviceName: 'payment-gateway',
    rootInput: {
      limit: 50,
      starting_after: 'cus_88100',
    },
    rootOutput: {
      object: 'list',
      hasMore: false,
      dataCount: 50,
    },
    children: [
      {
        name: 'SELECT * FROM "customers" LIMIT 50',
        kind: 'INTERNAL',
        durationFactor: 0.7,
        input: {
          query: 'SELECT id, email, created_at, balance FROM customers WHERE id > $1 ORDER BY id ASC LIMIT 50',
          parameters: ['cus_88100'],
        },
        output: {
          rowCount: 50,
        },
      },
    ],
  },
];

function randomFloat(min: number, max: number): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(1));
}

async function seedLiveTraffic() {
  console.log('🌱 Starting live traffic seed for multiple timeframes and projects...\n');

  const projects = await prisma.project.findMany();
  if (projects.length === 0) {
    console.error('No projects found in database. Exiting.');
    return;
  }

  const demoProject = projects.find((p) => p.name === 'Demo Web App') || projects[0];
  const paymentProject = projects.find((p) => p.name === 'Payment Gateway Service') || projects[1] || demoProject;

  console.log(`Targeting Projects:
  - Project 1: ${demoProject.name} (${demoProject.id})
  - Project 2: ${paymentProject.name} (${paymentProject.id})\n`);

  const now = Date.now();

  // Intervals to seed:
  // 1. Last 15 minutes: [now - 14m, now - 30s] -> 18 traces
  // 2. Last 1 hour: [now - 55m, now - 15m] -> 25 traces
  // 3. Last 24 hours: [now - 23h, now - 1h] -> 40 traces
  // 4. Last 7 days: [now - 6d, now - 24h] -> 35 traces
  const timeBuckets = [
    { label: 'last 15 minutes (15m window)', count: 18, minAgoMs: 30 * 1000, maxAgoMs: 14 * 60 * 1000 },
    { label: 'last 1 hour (1h window)', count: 25, minAgoMs: 15 * 60 * 1000, maxAgoMs: 58 * 60 * 1000 },
    { label: 'last 24 hours (24h window)', count: 40, minAgoMs: 65 * 60 * 1000, maxAgoMs: 23 * 60 * 60 * 1000 },
    { label: 'last 7 days (7d window)', count: 35, minAgoMs: 25 * 60 * 60 * 1000, maxAgoMs: 6 * 24 * 60 * 60 * 1000 },
  ];

  let totalCreated = 0;

  for (const bucket of timeBuckets) {
    console.log(`Generating ${bucket.count} traces for ${bucket.label}...`);

    for (let i = 0; i < bucket.count; i++) {
      // 75% traffic to Demo Web App, 25% traffic to Payment Gateway
      const isPayment = Math.random() > 0.75 && paymentProject.id !== demoProject.id;
      const targetProject = isPayment ? paymentProject : demoProject;
      const routeList = isPayment ? PAYMENT_ROUTES : DEMO_ROUTES;

      // Select weighted route
      const routeDef = routeList[Math.floor(Math.random() * routeList.length)];

      const traceId = randomBytes(16).toString('hex');
      const rootSpanId = randomBytes(8).toString('hex');

      // Random timestamp inside the bucket window
      const offsetMs = Math.floor(Math.random() * (bucket.maxAgoMs - bucket.minAgoMs)) + bucket.minAgoMs;
      const startTime = new Date(now - offsetMs);

      const durationMs = randomFloat(routeDef.minDuration, routeDef.maxDuration);
      const endTime = new Date(startTime.getTime() + durationMs);

      const isError = Math.random() < routeDef.errorRate;
      const statusCode = isError ? 500 : (routeDef.method === 'POST' ? 201 : 200);

      const rootRoute = `${routeDef.method} ${routeDef.path}`;

      // Create Trace
      await prisma.trace.create({
        data: {
          id: traceId,
          projectId: targetProject.id,
          serviceName: routeDef.serviceName,
          rootRoute,
          httpMethod: routeDef.method,
          statusCode,
          durationMs,
          hasError: isError,
          timestamp: startTime,
        },
      });

      // Create Root Span
      await prisma.span.create({
        data: {
          id: rootSpanId,
          traceId,
          projectId: targetProject.id,
          parentSpanId: null,
          name: rootRoute,
          kind: 'SERVER',
          httpMethod: routeDef.method,
          httpUrl: `http://localhost:5000${routeDef.path}`,
          statusCode,
          durationMs,
          startTime,
          endTime,
          hasError: isError,
          errorMessage: isError ? 'Internal Server Error: Unhandled exception in handler' : null,
          errorStack: isError ? 'Error: Unhandled exception\n    at handleRequest (/app/server.js:42:11)' : null,
          attributes: {
            'http.route': routeDef.path,
            'http.status_code': statusCode,
            'service.name': routeDef.serviceName,
            input: routeDef.rootInput || {
              method: routeDef.method,
              path: routeDef.path,
              headers: { host: 'localhost:5000', 'user-agent': 'EasyMetrics-Client/1.0' },
            },
            output: isError
              ? { error: 'Internal Server Error: Unhandled exception in handler', statusCode: 500 }
              : (routeDef.rootOutput || { status: 'OK', statusCode }),
          },
        },
      });

      // Create Child Spans
      let childStartOffset = 2;
      for (const child of routeDef.children) {
        const childSpanId = randomBytes(8).toString('hex');
        const childDuration = parseFloat((durationMs * child.durationFactor).toFixed(1));
        const childStartTime = new Date(startTime.getTime() + childStartOffset);
        const childEndTime = new Date(childStartTime.getTime() + childDuration);
        childStartOffset += childDuration * 0.4;

        const childError = isError && (child.errorRate ? Math.random() < child.errorRate : true);

        await prisma.span.create({
          data: {
            id: childSpanId,
            traceId,
            projectId: targetProject.id,
            parentSpanId: rootSpanId,
            name: child.name,
            kind: child.kind,
            httpMethod: child.kind === 'CLIENT' ? 'GET' : null,
            statusCode: childError ? 500 : 200,
            durationMs: childDuration,
            startTime: childStartTime,
            endTime: childEndTime,
            hasError: childError,
            errorMessage: childError ? 'Operation timed out or failed' : null,
            attributes: {
              'span.kind': child.kind,
              input: child.input || { operation: child.name },
              output: childError
                ? { error: 'Operation timed out or failed', statusCode: 500 }
                : (child.output || { status: 'SUCCESS' }),
            },
          },
        });
      }

      totalCreated++;
    }
  }

  console.log(`\n🎉 Successfully seeded ${totalCreated} live traces across all timeframes & projects!`);
}

seedLiveTraffic().finally(() => prisma.$disconnect());
