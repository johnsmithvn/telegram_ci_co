# Telegram Work Bot (44h/week KPI)

Telegram bot time-tracking cho check-in/check-out, theo KPI 44h/tuan, co burn-down, report theo ngay/tuan/thang, nhac quen checkout, va nhap gio thu cong.

## Stack

- Node.js + TypeScript
- Telegraf + Express
- PostgreSQL (Supabase compatible)
- node-cron
- Docker + Fly.io / Render

## Features

- Reply keyboard:
  - `🟢 Check-in`
  - `🔴 Check-out`
- 1 user chi co toi da 1 session `OPEN` (partial unique index trong DB).
- Check-out tinh thoi luong session, tong hom nay, tong tuan, con thieu KPI.
- Burn-down report luc `17:30` (Thu 2 -> Thu 6) + progress bar.
- KPI warning moi 5 phut khi gan moc `43h50`.
- Nhac quen checkout luc `23:59`.
- Manual hours:
  - nhap so gio truc tiep (vi du `8`, `8.5`) de dong session mo.
  - `/add` flow nhap ngay + so gio.
  - `/add YYYY-MM-DD 8.5`.
- Bao cao nhanh:
  - `/today`
  - `/week`
  - `/month`
- Summary scheduler:
  - `Sun 21:00`: weekly summary
  - `21:05` ngay cuoi thang: monthly summary
- Admin reset data:
  - `/resetall CONFIRM` (chi user nam trong `ADMIN_TELEGRAM_IDS`)
- User self-stop:
  - `/stop CONFIRM` (xoa du lieu cua chinh user va ngung bot cho user do)

## Environment

Copy `.env.example` thanh `.env`:

```env
BOT_TOKEN=...
DATABASE_URL=...
TIMEZONE=Asia/Ho_Chi_Minh
PORT=3000
WEBHOOK_URL=https://your-app.fly.dev
# KEEP_AWAKE_URL=https://your-app.fly.dev/health
# ADMIN_TELEGRAM_IDS=123456789,987654321
LOG_LEVEL=info
NODE_ENV=production
```

## Local Run

```bash
npm install
npm run db:init
npm run dev
```

- Neu co `WEBHOOK_URL`: bot dung webhook qua `POST /telegram/webhook`.
- Neu khong co `WEBHOOK_URL`: bot dung long polling.

## Build & Start

```bash
npm run typecheck
npm run build
npm run start
```

## Database Schema

Schema: [src/db/schema.sql](/d:/Development/Workspace/Python_Projects/telegram_ci_co/src/db/schema.sql)

Bang chinh:

- `users`
- `work_sessions`
- `user_state`

## Scheduler Cron

- Burn-down: `30 17 * * 1-5`
- Forgot checkout: `59 23 * * *`
- KPI warning: `*/5 * * * *`
- Weekly summary: `0 21 * * 0`
- Monthly summary: `5 21 * * *` (chi gui vao ngay cuoi thang)
- Keep awake (optional): `*/14 * * * *`

## Deploy Fly.io

```bash
fly launch
fly secrets set BOT_TOKEN=... DATABASE_URL=... TIMEZONE=Asia/Ho_Chi_Minh WEBHOOK_URL=https://<your-app>.fly.dev
fly deploy
```

Health check: `GET /health`

## Deploy Render (Free Tier) + Keep Awake

1. Deploy web service len Render.
2. Set env vars:
   - `NODE_ENV=production`
   - `BOT_TOKEN`
   - `DATABASE_URL`
   - `TIMEZONE=Asia/Ho_Chi_Minh`
   - `WEBHOOK_URL=https://<your-service>.onrender.com`
3. Ping endpoint:
   - `https://<your-service>.onrender.com/health`
4. Tao monitor tren UptimeRobot/Better Stack:
   - interval `14 minutes`
5. Optional keep-awake ping noi bo:
   - `KEEP_AWAKE_URL=https://<your-service>.onrender.com/health`
6. Set Telegram webhook:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-service>.onrender.com/telegram/webhook"
```
