# Nura

Трекер калорий и БЖУ для Узбекистана: PWA и Telegram Mini App из одного кода.
Дизайн в стиле iOS 27: Liquid Glass только в навигации (таб-бар, шторки, тосты), пастельные карточки с контентом.

## Что умеет

- **Сегодня:** кольцо калорий, Б/Ж/У, вода стаканами, приёмы пищи, неделя кольцами с переходом по дням. Удаление с отменой.
- **Добавление:** узбекская кухня (34 блюда с порциями), «вы часто едите», поиск, ручной ввод.
  ИИ (Google Gemini) распознаёт фото и текст вида «самса и чай с сахаром». Корзина с количеством сохраняется одним запросом.
- **Прогресс:** график веса, калории за 7 дней с линией цели, серия дней, средняя вода.
- **Профиль:** норма по формуле Миффлина — Сан Жеора (пол, возраст, рост, вес, активность, цель).
  Пересчитывается при записи веса; можно переключить на свою цель. Русский / Oʻzbekcha. Экспорт данных, смена пароля, удаление аккаунта.

## Стек

- **Клиент:** React 19, Vite, TanStack Query, wouter, plain CSS с токенами (`client/src/styles.css`).
- **Сервер:** Express, better-sqlite3, zod. Версионные миграции в `PRAGMA user_version` (`server/db.ts`).
- **Общее:** `shared/` — формула нормы, пресеты блюд, схемы запросов.

```
client/src/
  screens/   Today, AddSheet, EntrySheet, Progress, Profile, Onboarding, Auth, Privacy
  ui/        Sheet, Toast, TabBar, controls (Segmented, Stepper, Switch, Ring)
  state/     auth, queries (все запросы и мутации)
  lib/       api, telegram, i18n, dates, image, format
server/      index.ts (запуск, статика, бэкапы), app.ts (API), auth.ts, ai.ts, db.ts
shared/      nutrition.ts, foods.ts, schemas.ts
tests/       vitest: API, миграция старой базы, Telegram-подпись, формула
```

## Запуск

```bash
pnpm install
pnpm dev          # сервер :3000 + Vite :5173
pnpm test         # vitest
pnpm check        # tsc
pnpm build && pnpm start
```

## Переменные окружения

| Переменная | Зачем |
| --- | --- |
| `GEMINI_API_KEY` | Распознавание фото и текста. Без неё кнопки ИИ отвечают «не настроено». |
| `TELEGRAM_BOT_TOKEN` | Проверка входа из Telegram Mini App. |
| `ADMIN_KEY` | `GET /api/admin/stats` и `/api/admin/backup`, ключ в заголовке `X-Admin-Key`. |
| `DB_DIR` | Папка с SQLite (на Railway — примонтированный volume). |

## Telegram Mini App

1. В @BotFather создать бота (`/newbot`), токен положить в `TELEGRAM_BOT_TOKEN` на Railway.
2. `/newapp` (или Bot Settings → Configure Mini App) → URL приложения на Railway (https).
3. Bot Settings → Menu Button → тот же URL, текст «Открыть Nura».

Mini App авторизуется по подписанному `initData` (HMAC по токену бота) и получает Bearer-токен.
В PWA вход по email, сессия в HttpOnly-cookie. Аккаунты Telegram и email пока раздельные.

## Данные и безопасность

- **Миграция v2 переносит существующую базу без потерь:**
  - пароли старого формата продолжают работать;
  - токены сессий хэшируются на месте, никого не разлогинивает;
  - ручные цели остаются ручными.
- **Сессии** хранятся как SHA-256, живут 180 дней, просроченные чистятся раз в сутки.
- **Валидация:** все входные данные проходят через zod, ошибки возвращаются JSON-ом (400/401/404/429). Лимит ИИ — 30 распознаваний в день на пользователя.
- **Бэкапы:** ежедневный снапшот базы в `DB_DIR/backups` хранится 7 дней. Снять копию с сервера: `curl -H "X-Admin-Key: …" https://…/api/admin/backup -o nura.db`.
