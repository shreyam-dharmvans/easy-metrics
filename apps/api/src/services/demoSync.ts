import { prisma } from '../prisma.js';

let lastShiftTime = 0;

/**
 * Keeps demo telemetry perpetually fresh:
 * If the newest trace in 'demo-web-app' is older than 5 minutes, shifts all demo
 * traces and child spans forward so the latest trace is ~90 seconds ago.
 * Guarantees that 15m, 1h, 24h, and 7d filters are ALWAYS populated with rich charts!
 */
export async function autoAlignDemoTraces(): Promise<void> {
  // Throttle to at most once every 60 seconds to avoid repetitive DB calls
  const now = Date.now();
  if (now - lastShiftTime < 60 * 1000) return;
  lastShiftTime = now;

  try {
    const latest = await prisma.trace.findFirst({
      where: { serviceName: 'demo-web-app' },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });

    if (!latest) return;

    const diffSeconds = Math.round((now - latest.timestamp.getTime()) / 1000);

    // If latest trace is older than 5 minutes (300 seconds), shift forward
    if (diffSeconds > 300) {
      const shiftSeconds = diffSeconds - 90;
      await prisma.$executeRawUnsafe(
        `UPDATE "traces" SET "timestamp" = "timestamp" + ($1 || ' second')::interval WHERE "serviceName" = $2`,
        shiftSeconds.toString(),
        'demo-web-app'
      );
      await prisma.$executeRawUnsafe(
        `UPDATE "spans" SET "startTime" = "startTime" + ($1 || ' second')::interval, "endTime" = "endTime" + ($1 || ' second')::interval WHERE "traceId" IN (SELECT id FROM "traces" WHERE "serviceName" = $2)`,
        shiftSeconds.toString(),
        'demo-web-app'
      );
      console.log(`✨ [Demo Mode] Kept demo dataset fresh: shifted traces forward by ${Math.round(shiftSeconds / 60)} minutes.`);
    }
  } catch (error) {
    // Silently continue if database or tables are not initialized yet
  }
}
