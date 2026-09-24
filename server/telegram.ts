/**
 * Minimal Telegram Bot API client: sends reminders, answers the webhook and
 * configures the bot (webhook, commands, menu button) on startup, so nothing
 * has to be set up by hand in @BotFather besides creating the bot.
 */
import { createHash } from 'crypto';

export interface InlineButton {
  text: string;
  callback_data?: string;
  web_app?: { url: string };
}
export type Keyboard = InlineButton[][];

export class TelegramError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

export class Bot {
  username: string | null = null;

  constructor(private token: string, private fetchImpl: typeof fetch = fetch) {}

  /** Secret Telegram echoes in X-Telegram-Bot-Api-Secret-Token — derived, so no extra env var. */
  get webhookSecret(): string {
    return createHash('sha256').update(`webhook:${this.token}`).digest('hex').slice(0, 48);
  }

  async call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const res = await this.fetchImpl(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; error_code?: number; description?: string };
    if (!data.ok) throw new TelegramError(data.error_code ?? res.status, data.description ?? `HTTP ${res.status}`);
    return data.result as T;
  }

  send(chatId: number, text: string, keyboard?: Keyboard) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    });
  }

  async setup(appUrl: string) {
    const me = await this.call<{ username: string }>('getMe');
    this.username = me.username;
    await this.call('setWebhook', {
      url: `${appUrl}/api/telegram/webhook`,
      secret_token: this.webhookSecret,
      allowed_updates: ['message', 'callback_query', 'my_chat_member'],
      drop_pending_updates: false,
    });
    await this.call('setMyCommands', {
      commands: [
        { command: 'start', description: 'Открыть Nura' },
        { command: 'stop', description: 'Выключить напоминания' },
      ],
    });
    await this.call('setMyCommands', {
      language_code: 'uz',
      commands: [
        { command: 'start', description: 'Nurani ochish' },
        { command: 'stop', description: 'Eslatmalarni oʻchirish' },
      ],
    });
    await this.call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Nura', web_app: { url: appUrl } } });
    await this.call('setMyShortDescription', { short_description: 'Калории и БЖУ с узбекской кухней, ИИ-распознаванием и напоминаниями' });
    return me.username;
  }
}
