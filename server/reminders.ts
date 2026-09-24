/**
 * Telegram reminders and bot updates.
 *  - meal reminders at 09:30 / 13:30 / 19:30 local time, only if that meal
 *    isn't logged yet;
 *  - water reminders at 11/13/15/17/19 h, only when behind the day's pace,
 *    with +250 / +500 ml buttons that log water straight from the chat.
 * Each slot fires at most once per day (reminder_log) and within a 60-minute
 * window, so a restart or a missed tick doesn't lose or duplicate it.
 */
import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type { Bot, Keyboard } from './telegram.js';
import { TelegramError } from './telegram.js';

type Lang = 'ru' | 'uz';

export const MEAL_SLOTS = [
  { meal: 'breakfast', at: 9 * 60 + 30 },
  { meal: 'lunch', at: 13 * 60 + 30 },
  { meal: 'dinner', at: 19 * 60 + 30 },
] as const;
export const WATER_SLOTS = [11, 13, 15, 17, 19];
const WINDOW_MIN = 60;
const DAY_START = 8 * 60;
const DAY_END = 21 * 60;

const TEXT = {
  ru: {
    meal: { breakfast: 'Время записать завтрак', lunch: 'Время записать обед', dinner: 'Время записать ужин' },
    mealSub: 'Это займёт пару секунд — можно просто сфотографировать.',
    water: (a: string, b: string) => `Пора выпить воды. Сегодня <b>${a}</b> из ${b} л.`,
    waterAdded: (ml: number, a: string, b: string) => `Записано +${ml} мл. Сегодня <b>${a}</b> из ${b} л.`,
    open: 'Открыть Nura',
    welcome:
      'Привет! Nura считает калории и БЖУ, знает узбекскую кухню и распознаёт еду по фото.\n\nНажмите «Открыть Nura», чтобы начать. Напоминания о еде и воде включаются в профиле.',
    stopped: 'Напоминания выключены. Включить снова можно в профиле Nura.',
    hint: 'Всё самое интересное — в приложении.',
    noAccount: 'Сначала откройте Nura',
  },
  uz: {
    meal: { breakfast: 'Nonushtani yozish vaqti', lunch: 'Tushlikni yozish vaqti', dinner: 'Kechki ovqatni yozish vaqti' },
    mealSub: 'Bir necha soniya oladi — shunchaki suratga olsangiz boʻladi.',
    water: (a: string, b: string) => `Suv ichish vaqti. Bugun <b>${a}</b> / ${b} l.`,
    waterAdded: (ml: number, a: string, b: string) => `+${ml} ml yozildi. Bugun <b>${a}</b> / ${b} l.`,
    open: 'Nurani ochish',
    welcome:
      'Salom! Nura kaloriya va BJUni hisoblaydi, oʻzbek taomlarini biladi va ovqatni rasmdan taniydi.\n\nBoshlash uchun «Nurani ochish» tugmasini bosing. Ovqat va suv eslatmalari profilda yoqiladi.',
    stopped: 'Eslatmalar oʻchirildi. Ularni Nura profilida qayta yoqish mumkin.',
    hint: 'Eng qiziqlari — ilovada.',
    noAccount: 'Avval Nurani oching',
  },
};

export function localTime(tz: string, now: Date): { date: string; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now);
  } catch {
    return localTime('Asia/Tashkent', now);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** Water the day's pace expects by now: linear from 08:00 to 21:00. */
export function expectedWater(goalMl: number, minutes: number): number {
  return goalMl * Math.min(1, Math.max(0, (minutes - DAY_START) / (DAY_END - DAY_START)));
}

export const liters = (ml: number) => {
  const l = Math.round(ml / 10) / 100;
  return String(l).replace('.', ',');
};

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function openButton(lang: Lang, appUrl: string): Keyboard {
  return [[{ text: TEXT[lang].open, web_app: { url: appUrl } }]];
}

function waterKeyboard(lang: Lang, appUrl: string, date: string): Keyboard {
  return [
    [
      { text: lang === 'uz' ? '+250 ml' : '+250 мл', callback_data: `w:250:${date}` },
      { text: lang === 'uz' ? '+500 ml' : '+500 мл', callback_data: `w:500:${date}` },
    ],
    ...openButton(lang, appUrl),
  ];
}

type Candidate = {
  id: string; telegram_id: number; lang: Lang; tz: string; remind_meals: number; remind_water: number; water_goal: number | null;
};

export function createReminders(db: Database.Database, bot: Bot, appUrl: string) {
  const q = {
    candidates: db.prepare(
      `SELECT u.id, u.telegram_id, u.lang, u.tz, u.remind_meals, u.remind_water, g.water_goal_ml water_goal
       FROM users u JOIN telegram_chats c ON c.telegram_id = u.telegram_id AND c.blocked = 0
       LEFT JOIN goals g ON g.user_id = u.id
       WHERE u.remind_meals = 1 OR u.remind_water = 1`,
    ),
    logged: db.prepare('SELECT 1 FROM reminder_log WHERE user_id = ? AND kind = ? AND date = ?'),
    log: db.prepare('INSERT OR IGNORE INTO reminder_log (user_id, kind, date) VALUES (?, ?, ?)'),
    hasMeal: db.prepare('SELECT 1 FROM entries WHERE user_id = ? AND date = ? AND meal_type = ? LIMIT 1'),
    water: db.prepare('SELECT COALESCE(SUM(ml), 0) ml FROM water_logs WHERE user_id = ? AND date = ?'),
    block: db.prepare('UPDATE telegram_chats SET blocked = 1 WHERE telegram_id = ?'),
    upsertChat: db.prepare(
      `INSERT INTO telegram_chats (telegram_id, blocked) VALUES (?, 0)
       ON CONFLICT(telegram_id) DO UPDATE SET blocked = 0`,
    ),
    userByTg: db.prepare('SELECT id, lang FROM users WHERE telegram_id = ?'),
    stop: db.prepare('UPDATE users SET remind_meals = 0, remind_water = 0 WHERE telegram_id = ?'),
    insertWater: db.prepare('INSERT INTO water_logs (id, user_id, date, ml) VALUES (?, ?, ?, ?)'),
    waterGoal: db.prepare('SELECT water_goal_ml FROM goals WHERE user_id = ?'),
    pruneLog: db.prepare("DELETE FROM reminder_log WHERE date < date('now', '-14 days')"),
  };

  async function deliver(u: Candidate, kind: string, date: string, text: string, keyboard: Keyboard) {
    q.log.run(u.id, kind, date); // log first: a failed send is not retried every minute
    try {
      await bot.send(u.telegram_id, text, keyboard);
    } catch (err) {
      if (err instanceof TelegramError && err.code === 403) q.block.run(u.telegram_id);
      else console.error('[reminders] send failed:', err);
    }
  }

  /** One pass over everyone with reminders on. Called every minute. Returns what was sent (for tests). */
  async function tick(now = new Date()): Promise<string[]> {
    const sent: string[] = [];
    for (const u of q.candidates.all() as Candidate[]) {
      const { date, minutes } = localTime(u.tz, now);
      const lang: Lang = u.lang === 'uz' ? 'uz' : 'ru';
      if (u.remind_meals) {
        for (const slot of MEAL_SLOTS) {
          if (minutes < slot.at || minutes >= slot.at + WINDOW_MIN) continue;
          if (q.logged.get(u.id, slot.meal, date) || q.hasMeal.get(u.id, date, slot.meal)) continue;
          await deliver(u, slot.meal, date, `<b>${TEXT[lang].meal[slot.meal]}</b>\n${TEXT[lang].mealSub}`, openButton(lang, appUrl));
          sent.push(`${u.id}:${slot.meal}`);
        }
      }
      if (u.remind_water) {
        for (const h of WATER_SLOTS) {
          if (minutes < h * 60 || minutes >= h * 60 + WINDOW_MIN) continue;
          const kind = `water-${h}`;
          if (q.logged.get(u.id, kind, date)) continue;
          const goal = u.water_goal ?? 2000;
          const drunk = (q.water.get(u.id, date) as { ml: number }).ml;
          if (drunk >= expectedWater(goal, minutes) - 250) {
            q.log.run(u.id, kind, date); // on pace — skip this slot quietly
            continue;
          }
          await deliver(u, kind, date, TEXT[lang].water(liters(drunk), liters(goal)), waterKeyboard(lang, appUrl, date));
          sent.push(`${u.id}:${kind}`);
        }
      }
    }
    return sent;
  }

  // -------------------------------------------------------------------------
  // Webhook updates
  // -------------------------------------------------------------------------

  type Update = {
    message?: { chat: { id: number; type: string }; from?: { id: number; language_code?: string }; text?: string };
    my_chat_member?: { chat: { id: number; type: string }; new_chat_member: { status: string } };
    callback_query?: {
      id: string; from: { id: number; language_code?: string }; data?: string;
      message?: { message_id: number; chat: { id: number } };
    };
  };

  const langOf = (tgId: number, code?: string): Lang => {
    const u = q.userByTg.get(tgId) as { lang: string } | undefined;
    return (u?.lang ?? (code === 'uz' ? 'uz' : 'ru')) === 'uz' ? 'uz' : 'ru';
  };

  async function handleUpdate(update: Update) {
    const m = update.message;
    if (m && m.chat.type === 'private' && m.from) {
      const lang = langOf(m.from.id, m.from.language_code);
      q.upsertChat.run(m.from.id);
      const cmd = m.text?.trim().split(/\s|@/)[0];
      if (cmd === '/stop') {
        q.stop.run(m.from.id);
        await bot.send(m.chat.id, TEXT[lang].stopped);
      } else {
        await bot.send(m.chat.id, cmd === '/start' ? TEXT[lang].welcome : TEXT[lang].hint, openButton(lang, appUrl));
      }
      return;
    }

    const cm = update.my_chat_member;
    if (cm && cm.chat.type === 'private') {
      if (cm.new_chat_member.status === 'kicked') q.block.run(cm.chat.id);
      else if (cm.new_chat_member.status === 'member') q.upsertChat.run(cm.chat.id);
      return;
    }

    const cb = update.callback_query;
    if (cb) {
      const lang = langOf(cb.from.id, cb.from.language_code);
      const match = /^w:(250|500):(\d{4}-\d{2}-\d{2})$/.exec(cb.data ?? '');
      const user = q.userByTg.get(cb.from.id) as { id: string } | undefined;
      if (!match || !user) {
        await bot.call('answerCallbackQuery', { callback_query_id: cb.id, text: TEXT[lang].noAccount });
        return;
      }
      const ml = Number(match[1]);
      const date = match[2];
      q.insertWater.run(`water_${Date.now()}_${nanoid(6)}`, user.id, date, ml);
      const total = (q.water.get(user.id, date) as { ml: number }).ml;
      const goal = (q.waterGoal.get(user.id) as { water_goal_ml: number } | undefined)?.water_goal_ml ?? 2000;
      await bot.call('answerCallbackQuery', { callback_query_id: cb.id, text: `+${ml} ${lang === 'uz' ? 'ml' : 'мл'}` });
      if (cb.message) {
        await bot
          .call('editMessageText', {
            chat_id: cb.message.chat.id,
            message_id: cb.message.message_id,
            text: TEXT[lang].waterAdded(ml, liters(total), liters(goal)),
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: waterKeyboard(lang, appUrl, date) },
          })
          .catch(() => {}); // "message is not modified" etc. — cosmetic
      }
    }
  }

  function allowChat(telegramId: number) {
    q.upsertChat.run(telegramId);
  }

  return { tick, handleUpdate, allowChat, prune: () => q.pruneLog.run() };
}

export type Reminders = ReturnType<typeof createReminders>;
