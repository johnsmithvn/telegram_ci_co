# Telegram Work Bot (44h/week KPI)

Telegram bot time-tracking cho check-in/check-out, bám KPI 44h/tuần, có burn-down report, nhắc quên checkout, và nhập giờ thủ công.

## Stack

- Node.js + TypeScript
- Telegraf + Express
- PostgreSQL (Supabase compatible)
- node-cron
- Docker + Fly.io

## Features

- Reply keyboard luôn hiển thị:
  - `🟢 Check-in`
  - `🔴 Check-out`
- Chỉ cho phép 1 session `OPEN` cho mỗi user (enforced ở DB bằng partial unique index).
- Check-out tính thời lượng phiên, tổng hôm nay, tổng tuần, còn thiếu KPI.
- Burn-down report lúc `17:30` từ Thứ 2 đến Thứ 6.
- KPI warning mỗi 5 phút khi user đang làm và đạt mốc `43h50`.
- Nhắc quên checkout lúc `23:59` nếu còn session mở.
- Nhập số giờ trực tiếp để đóng phiên mở thủ công (ví dụ `8`, `8.5`).
- Lệnh thêm giờ cho ngày cũ:
  - `/add` (flow hỏi ngày rồi hỏi giờ)
  - `/add YYYY-MM-DD 8.5`

## Environment

Copy `.env.example` thành `.env`:

```env
BOT_TOKEN=...
DATABASE_URL=...
TIMEZONE=Asia/Ho_Chi_Minh
PORT=3000
WEBHOOK_URL=https://your-app.fly.dev
LOG_LEVEL=info
NODE_ENV=production
```

## Local Run

```bash
npm install
npm run db:init
npm run dev
```

- Nếu có `WEBHOOK_URL`: bot chạy webhook qua `POST /telegram/webhook`.
- Nếu không có `WEBHOOK_URL`: bot chạy polling (dev-friendly).

## Build & Start

```bash
npm run typecheck
npm run build
npm run start
```

## Database Schema

Schema nằm ở [src/db/schema.sql](/d:/Development/Workspace/Python_Projects/telegram_ci_co/src/db/schema.sql).

Các bảng chính:

- `users`
- `work_sessions`
- `user_state`

Các enum chính:

- `work_session_status`: `OPEN`, `CLOSED`
- `work_session_source`: `normal`, `manual`, `auto`

## Scheduler Cron

- Burn-down: `30 17 * * 1-5`
- Forgot checkout: `59 23 * * *`
- KPI warning: `*/5 * * * *`

## Deploy Fly.io

```bash
fly launch
fly secrets set BOT_TOKEN=... DATABASE_URL=... TIMEZONE=Asia/Ho_Chi_Minh WEBHOOK_URL=https://<your-app>.fly.dev
fly deploy
```

Health check: `GET /health`

