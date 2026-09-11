import { NextRequest, NextResponse } from 'next/server';
import { telegramNotifier } from '@/lib/telegram-notifier';

/**
 * POST /api/notify
 * Send notifications via Telegram
 *
 * Body:
 * {
 *   type: 'bet_placed' | 'copy_trade' | 'registration' | 'custom',
 *   data: { ... }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    let success = false;

    switch (type) {
      case 'bet_placed':
        success = await telegramNotifier.notifyBetPlaced(
          data.platform,
          data.position,
          data.amount,
          data.address
        );
        break;

      case 'copy_trade':
        success = await telegramNotifier.notifyCopyTrade(
          data.traderAddress,
          data.followerAddress,
          data.allocation
        );
        break;

      case 'registration':
        success = await telegramNotifier.notifyRegistration(
          data.address,
          data.tier
        );
        break;

      case 'custom':
        success = await telegramNotifier.send({
          title: data.title,
          message: data.message,
          level: data.level || 'info',
        });
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid notification type' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success });
  } catch (error: any) {
    console.error('Notification API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
