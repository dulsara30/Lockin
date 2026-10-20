import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'disconnected';

  try {
    await connectDB();
    const state = mongoose.connection.readyState;
    // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    dbStatus = state === 1 ? 'connected' : state === 2 ? 'connecting' : 'disconnected';
  } catch {
    dbStatus = 'error';
  }

  const isHealthy = dbStatus === 'connected';
  const responseTimeMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
      },
      responseTimeMs,
    },
    {
      status: isHealthy ? 200 : 503,
    }
  );
}
