import { prisma } from '../prisma.js';

/**
 * Auto-seed demo project and developer credentials if database is empty.
 * Guarantees local developers have an active project and API key immediately on first boot.
 */
export async function ensureDefaultProject(): Promise<void> {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('🌱 Database is empty. Creating default project and demo API key...');
      const demoUser = await prisma.user.create({
        data: {
          email: 'developer@easymetrics.local',
          name: 'Demo Developer',
        },
      });

      const demoProject = await prisma.project.create({
        data: {
          name: 'Demo Web App',
          slug: 'demo-web-app',
          ownerId: demoUser.id,
        },
      });

      const demoApiKey = process.env.EASY_METRICS_API_KEY || 'em_live_local_dev_key';
      await prisma.apiKey.create({
        data: {
          name: 'Default Local Development Key',
          key: demoApiKey,
          projectId: demoProject.id,
        },
      });

      console.log(`✅ Default project created: "${demoProject.name}" (ID: ${demoProject.id})`);
      console.log(`🔑 Active API Key: "${demoApiKey}"`);
    }
  } catch (error) {
    console.warn('Note: Could not run initial seed check (PostgreSQL may not be started yet).');
  }
}
