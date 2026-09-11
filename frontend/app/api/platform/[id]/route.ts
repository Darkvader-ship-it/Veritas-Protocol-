import { NextRequest, NextResponse } from 'next/server';

const PLATFORMS: Record<string, any> = {
  '1': { id: 1, name: 'DreamDEX Event Contracts', adapter: '0x59150F96c5FE2b40777aA7221dD1B0E903Df421f', dataSource: 'https://shannon-explorer.somnia.network', platformType: 1, isActive: true, registeredAt: 0, updatedAt: 0 },
  '2': { id: 2, name: 'Azuro', adapter: '0xb0fF214f3575098966c1dbF66bd39Dca9DDc0130', dataSource: 'https://azuro.org', platformType: 1, isActive: true, registeredAt: 0, updatedAt: 0 },
  '3': { id: 3, name: 'SX Bet', adapter: '0xB0e660108571B4B191a14B0efdF8EA98d76fb5CC', dataSource: 'https://sx.bet', platformType: 1, isActive: true, registeredAt: 0, updatedAt: 0 },
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const platform = PLATFORMS[id];
  if (!platform) {
    return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
  }
  return NextResponse.json(platform);
}
