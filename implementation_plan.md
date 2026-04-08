# Log Lifecycle Optimization — Implementation Plan

## Mục tiêu

Nhìn 1 ngày log → hiểu ngay toàn cảnh: bot nhận signal lúc nào, parse xong lúc nào, vào lệnh lúc nào, giá thị trường lúc đó là bao nhiêu, độ trễ tổng là bao lâu.

---

## Thiết Kế: 1 Signal = 1 Log Entry Duy Nhất

### Trước (fragments):
```
parse_success | XAUUSD | fp=abc123
validation_rejected | XAUUSD | fp=abc123 reason=drift
dry_run_execution | XAUUSD | fp=abc123
```

### Sau (1 entry hoàn chỉnh):
```json
{
  "event": "SIGNAL",
  "symbol": "XAUUSD",
  "side": "BUY",
  "fp": "abc123",

  "t_recv":   "2026-04-05T14:22:15.123+07:00",   ← Telegram message timestamp gốc
  "t_parse":  "2026-04-05T14:22:15.245+07:00",   ← Sau khi parse xong
  "t_exec":   "2026-04-05T14:22:15.678+07:00",   ← Sau khi MT5 confirm

  "parse_ms":  122,   ← T_parse - T_recv
  "exec_ms":   555,   ← T_exec - T_recv (total latency)

  "sig_entry": 3210.50,   ← Giá signal gốc
  "sig_sl":    3200.00,
  "sig_tp":    [3230.00],

  "mkt_bid":   3212.30,   ← Giá thị trường lúc T_exec
  "mkt_ask":   3212.80,
  "slippage_pips": 2.3,   ← |mkt_ask - sig_entry| / pip_size

  "order_kind": "MARKET",
  "volume":     0.02,
  "ticket":     123456789,

  "outcome":       "executed",   ← executed | rejected | failed | parse_fail
  "reject_reason": ""
}
```

---

## Proposed Changes

---

### core/telegram_listener.py

#### [MODIFY] `_handle_new_message`

Capture `message.date` (server timestamp của Telegram, chính xác nhất) và `recv_at` (local monotonic khi callback chạy).

```python
# Lấy timestamp server-side từ Telegram (chính xác hơn time.time())
t_telegram = message.date  # datetime object (UTC) from Telegram server
```

Pass thêm `t_telegram` vào pipeline callback.

**PipelineCallback signature thay đổi:**
```
(raw_text, chat_id, message_id) → (raw_text, chat_id, message_id, t_telegram)
```

> [!IMPORTANT]
> `message.date` là timestamp Telegram server-side (UTC). Đây là thời điểm gốc chính xác nhất — tránh clock drift từ local machine.

---

### main.py

#### [MODIFY] `_process_signal` + `_do_process_signal`

1. Nhận thêm `t_telegram: datetime` từ listener
2. Dùng `time.monotonic()` để tính `parse_ms` và `exec_ms` tương đối, nhưng dùng `t_telegram` làm anchor cho ISO timestamps
3. Ở **cuối pipeline** (thay vì nhiều log ở giữa), emit **1 log_event duy nhất**: `SIGNAL`
4. Mọi log_event intermediate trong pipeline → xóa hoặc downgrade xuống DEBUG

**Events bị REMOVE** (thay bằng 1 SIGNAL entry):
- `parse_success` → merged vào SIGNAL
- `drift_rejected` → merged vào SIGNAL (outcome=rejected, reason=drift)
- `validation_rejected` → merged vào SIGNAL
- `dry_run_execution` → merged vào SIGNAL
- `multi_order_executed` → merged (hoặc 1 entry/order với level_id)
- `pipeline_no_plans` → merged

**Events còn GIỮ (ERROR/SYSTEM level):**
- `heartbeat` ✅
- `session_summary` ✅
- `system_startup/shutdown` ✅
- `circuit_breaker_open` ✅
- `mt5_connection_lost` ✅
- `trade_tracked` ✅ (kết quả đóng lệnh)
- `reply_action_parsed` + `reply_executed` ✅ (tương tự, gộp thành 1 REPLY entry)

---

### Reply cũng gộp thành 1 entry: `REPLY`

```json
{
  "event": "REPLY",
  "t_recv":     "2026-04-05T15:10:22.100+07:00",
  "t_exec":     "2026-04-05T15:10:22.450+07:00",
  "exec_ms":    350,
  "action":     "secure_profit",
  "pips":       20,
  "reply_to":   "msg_id_original_signal",
  "tickets":    [123456789],
  "outcome":    "secured",
  "detail":     "closed #123456789, BE on #123456790"
}
```

---

### utils/logger.py

#### [MODIFY] Console format

Thêm format dễ đọc hơn cho console — dùng `event` + data quan trọng inline:

```
2026-04-05 14:22:15 | SIGNAL   | XAUUSD BUY  | exec=ok  ticket=123456789 vol=0.02 slippage=2.3p exec_ms=555ms
2026-04-05 14:22:20 | SIGNAL   | EURUSD SELL | rejected reason=spread_too_wide
2026-04-05 15:10:22 | REPLY    | secure_profit +20p → #123456789 closed, #123456790 BE | exec_ms=350ms
2026-04-05 15:30:00 | HEARTBEAT| up=65m parsed=12 exec=9 rej=3 open=1 pending=0
2026-04-05 16:05:11 | TRADE    | #123456789 XAUUSD TP +$8.40 (net) peak=+18.5p
```

---

## Scope Thay Đổi

| File | Loại | Nội dung |
|---|---|---|
| `core/telegram_listener.py` | MODIFY | Pass `t_telegram` (message.date) vào pipeline callback |
| `main.py` | MODIFY | Gộp lifecycle thành 1 `SIGNAL` event; xóa intermediate logs |
| `utils/logger.py` | MODIFY | Cải thiện console format để readable hơn |
| `core/pipeline.py` | MODIFY | Xóa log_event() intermediate; trả về timing data |
| `core/telegram_alerter.py` | MODIFY | Xóa `alert_sent`, `debug_sent/skipped`, `reply_skipped` |
| `core/trade_tracker.py` | MINOR | Xóa `trade_tracker_poll_complete` (chỉ log khi error) |
| `core/range_monitor.py` | MINOR | Xóa `range_monitor_cleanup_done` |

---

## Không thay đổi

- Logic xử lý signal, validation, execution — **không đổi gì**
- DB storage — **không đổi gì**
- Alerter Telegram messages — **không đổi gì**
- Health check, circuit breaker — **không đổi gì**

---

## Verification Plan

Sau khi implement:
1. Chạy bot dry-run với 1 vài signal giả
2. Kiểm tra `logs/bot.log` — mỗi signal phải cho ra **đúng 1 JSON entry** với đầy đủ timing
3. Kiểm tra console — format phải readable ngay mà không cần jq
4. Kiểm tra signal bị rejected cũng cho ra 1 entry với `outcome=rejected`

---

## Git Workflow

```
Branch : feat/log-lifecycle-single-entry
Commit : feat(logging): single-entry signal lifecycle with telegram timestamp
PR     : [feat] Log: 1 entry per signal with full timing + slippage tracking
```

## Next Version: v0.9.1 (MINOR)
