import { NextResponse } from 'next/server';
import { getServices } from '@/lib/services/service-factory';

export async function POST(): Promise<NextResponse> {
  const { kit } = getServices();
  kit.invalidateCache();
  return NextResponse.json({ success: true });
}
