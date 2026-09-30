import { NextResponse } from 'next/server';

/**
 * Liveness / readiness probe. No dependencies and no session: the kubelet
 * carries no cookie, and a probe that touched another service would restart
 * this pod whenever that service was down.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ status: 'healthy', app: 'fleet-public' });
}
