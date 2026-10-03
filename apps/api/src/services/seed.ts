import { prisma } from '../prisma.js';
import { seedLiveTraffic } from '../seed_live_traffic.js';

/**
 * Auto-seed demo project and developer credentials if database is empty.
 * Guarantees local developers have an active project and API key immediately on first boot.
 */
export async function ensureDefaultProject(): Promise<void> {
  try {
    // 1. Atomic User Upsert
    const demoUser = await prisma.user.upsert({
      where: { email: 'developer@easymetrics.local' },
      update: {},
      create: {
        email: 'developer@easymetrics.local',
        name: 'Demo Developer',
      },
    });

    // 2. Atomic Project Upsert
    const demoProject = await prisma.project.upsert({
      where: { slug: 'demo-web-app' },
      update: {},
      create: {
        name: 'Demo Web App',
        slug: 'demo-web-app',
        ownerId: demoUser.id,
      },
    });

    // 3. Atomic API Key Upsert
    const demoApiKey = process.env.EASY_METRICS_API_KEY || 'em_live_local_dev_key';
    await prisma.apiKey.upsert({
      where: { key: demoApiKey },
      update: {},
      create: {
        name: 'Default Local Development Key',
        key: demoApiKey,
        projectId: demoProject.id,
      },
    });

    // Auto-seed demo telemetry if trace table is empty
    const traceCount = await prisma.trace.count();
    if (traceCount === 0) {
      console.log('🌱 Traces table is empty. Auto-seeding initial demo traces...');
      await seedLiveTraffic();
    }
  } catch (error) {
    console.warn('Note: Could not run initial seed check (PostgreSQL may not be started yet).');
  }
}
