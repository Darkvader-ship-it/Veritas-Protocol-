/**
 * Telegram Notification Service
 * Send alerts to your phone via Telegram Bot
 *
 * Setup:
 * 1. Create bot: https://t.me/botfather -> /newbot
 * 2. Get your chat ID: https://t.me/userinfobot
 * 3. Add to .env.local:
 *    TELEGRAM_BOT_TOKEN=your_bot_token
 *    TELEGRAM_CHAT_ID=your_chat_id
 */

interface TelegramMessage {
  title: string;
  message: string;
  level?: 'info' | 'success' | 'warning' | 'error';
}

export class TelegramNotifier {
  private botToken: string;
  private chatId: string;
  private baseUrl: string;

  constructor(botToken?: string, chatId?: string) {
    this.botToken = botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = chatId || process.env.TELEGRAM_CHAT_ID || '';
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Send a notification to Telegram
   */
  async send({ title, message, level = 'info' }: TelegramMessage): Promise<boolean> {
    if (!this.botToken || !this.chatId) {
      console.warn('Telegram credentials not configured');
      return false;
    }

    const emoji = this.getEmoji(level);
    const formattedMessage = `${emoji} *${title}*\n\n${message}`;

    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: formattedMessage,
          parse_mode: 'Markdown',
        }),
      });

      const data = await response.json();
      return data.ok;
    } catch (error) {
      console.error('Failed to send Telegram notification:', error);
      return false;
    }
  }

  /**
   * Send bet placed notification
   */
  async notifyBetPlaced(
    platform: string,
    position: string,
    amount: string,
    address: string
  ): Promise<boolean> {
    return this.send({
      title: '🎲 New Bet Placed',
      message: `Platform: ${platform}\nPosition: ${position}\nAmount: ${amount}\nWallet: ${address.slice(0, 6)}...${address.slice(-4)}`,
      level: 'info',
    });
  }

  /**
   * Send copy trade notification
   */
  async notifyCopyTrade(
    traderAddress: string,
    followerAddress: string,
    allocation: number
  ): Promise<boolean> {
    return this.send({
      title: '👥 New Copy Trade Follow',
      message: `Trader: ${traderAddress.slice(0, 6)}...${traderAddress.slice(-4)}\nFollower: ${followerAddress.slice(0, 6)}...${followerAddress.slice(-4)}\nAllocation: ${allocation}%`,
      level: 'success',
    });
  }

  /**
   * Send registration notification
   */
  async notifyRegistration(address: string, tier: string): Promise<boolean> {
    return this.send({
      title: '🎉 New User Registered',
      message: `Address: ${address.slice(0, 6)}...${address.slice(-4)}\nTier: ${tier}`,
      level: 'success',
    });
  }

  /**
   * Send error notification
   */
  async notifyError(context: string, error: string): Promise<boolean> {
    return this.send({
      title: '❌ Error Occurred',
      message: `Context: ${context}\nError: ${error}`,
      level: 'error',
    });
  }

  private getEmoji(level: string): string {
    const emojis = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    };
    return emojis[level as keyof typeof emojis] || 'ℹ️';
  }
}

// Singleton instance
export const telegramNotifier = new TelegramNotifier();
