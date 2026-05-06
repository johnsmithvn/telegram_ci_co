/* ================================================================
   CI/CO Dashboard — App Logic
   localStorage-only time tracker, 1-week scope
   Matches Telegram bot business rules:
     - Weekly target: 44h (2640 min)
     - Daily target: 8h (480 min)
     - Lunch break: 1h deducted if session > 4h
     - Work days: Mon–Sat (T2–T7)
   ================================================================ */

(function () {
  'use strict';

  // ─── Constants ───
  const WEEKLY_TARGET = 44 * 60;
  const DAILY_TARGET = 8 * 60;
  const LUNCH_BREAK = 60;
  const LUNCH_THRESHOLD = 4 * 60;
  const STORAGE_KEY = 'cico_data';
  const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const DAY_FULL = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  var DEFAULT_IN = '08:00';
  var DEFAULT_OUT = '17:30';

  // ─── State ───
  let data = { weekStart: '', entries: {} };
  let selectedDate = null;
  let editingDate = null; // date string of card currently in inline-edit mode
  let clockTimer = null;

  // ─── DOM References ───
  const $ = (id) => document.getElementById(id);

  // ============================================================
  // UTILS
  // ============================================================

  function getISOWeekStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function fmtDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function fmtDateShort(date) {
    return String(date.getDate()).padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0');
  }

  function fmtMinutes(total) {
    if (total === 0) return '0h00m';
    var abs = Math.abs(total);
    var h = Math.floor(abs / 60);
    var m = abs % 60;
    var s = h + 'h' + String(m).padStart(2, '0') + 'm';
    return total < 0 ? '-' + s : s;
  }

  function parseTime(str) {
    var parts = str.split(':');
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function calcDuration(checkIn, checkOut) {
    var inM = parseTime(checkIn);
    var outM = parseTime(checkOut);
    var duration = outM - inM;
    if (duration <= 0) return 0;
    if (duration > LUNCH_THRESHOLD) {
      duration = Math.max(0, duration - LUNCH_BREAK);
    }
    return duration;
  }

  function getISOWeekNumber(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // ─── Time Parsers (ported from bot logic) ───

  function pad2(n) { return String(n).padStart(2, '0'); }

  function parseClockTime(text) {
    text = text.trim().toLowerCase();
    // "08:30" or "8:30" or "8h30"
    var m1 = text.match(/^([01]?\d|2[0-3])[:h]([0-5]?\d)$/);
    if (m1) return pad2(Number(m1[1])) + ':' + pad2(Number(m1[2]));
    // "8" or "8h" → 08:00
    var m2 = text.match(/^([01]?\d|2[0-3])h?$/);
    if (m2) return pad2(Number(m2[1])) + ':00';
    // "830" or "1730"
    var m3 = text.match(/^(\d{3,4})$/);
    if (m3) {
      var digits = m3[1];
      var hp = digits.length === 3 ? digits.slice(0, 1) : digits.slice(0, 2);
      var mp = digits.slice(-2);
      var h = Number(hp), mn = Number(mp);
      if (h >= 0 && h <= 23 && mn >= 0 && mn <= 59) return pad2(h) + ':' + pad2(mn);
    }
    return null;
  }

  function parseTimeRange(text) {
    var parts = text.trim().split(/[\s\-→]+/).filter(Boolean);
    if (parts.length < 2) return null;
    var s = parseClockTime(parts[0]);
    var e = parseClockTime(parts[1]);
    if (!s || !e) return null;
    return { checkIn: s, checkOut: e };
  }
  // ============================================================
  // STORAGE
  // ============================================================

  function loadData() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { initWeek(); return; }
    try {
      var parsed = JSON.parse(raw);
      var currentWeekStart = fmtDate(getISOWeekStart(new Date()));
      if (parsed.weekStart !== currentWeekStart) {
        initWeek();
        return;
      }
      data = parsed;
    } catch (e) {
      initWeek();
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function initWeek() {
    data = {
      weekStart: fmtDate(getISOWeekStart(new Date())),
      entries: {}
    };
    saveData();
  }

  // ============================================================
  // CALCULATIONS
  // ============================================================

  function getWeekDays() {
    var start = new Date(data.weekStart + 'T00:00:00');
    var days = [];
    var todayStr = fmtDate(new Date());
    for (var i = 0; i < 7; i++) {
      var d = new Date(start);
      d.setDate(d.getDate() + i);
      var dateStr = fmtDate(d);
      days.push({
        date: dateStr,
        dayOfWeek: d.getDay(),
        dayName: DAY_LABELS[d.getDay()],
        dayFull: DAY_FULL[d.getDay()],
        dateShort: fmtDateShort(d),
        isWorkDay: d.getDay() >= 1 && d.getDay() <= 6,
        isToday: dateStr === todayStr,
        entry: data.entries[dateStr] || null
      });
    }
    return days;
  }

  function getDayMinutes(entry) {
    if (!entry || !entry.checkIn || !entry.checkOut) return 0;
    return calcDuration(entry.checkIn, entry.checkOut);
  }

  function getWeeklyTotal() {
    var total = 0;
    var keys = Object.keys(data.entries);
    for (var i = 0; i < keys.length; i++) {
      total += getDayMinutes(data.entries[keys[i]]);
    }
    return total;
  }

  function getDaysWorked() {
    var count = 0;
    var keys = Object.keys(data.entries);
    for (var i = 0; i < keys.length; i++) {
      if (getDayMinutes(data.entries[keys[i]]) > 0) count++;
    }
    return count;
  }

  function getWorkdaysLeft() {
    var dayOfWeek = new Date().getDay();
    // ISO: 1=Mon...5=Fri, 6=Sat, 0=Sun
    // Burndown counts Mon-Fri (5 days), Sat/Sun → 1
    if (dayOfWeek === 0 || dayOfWeek >= 5) return 1;
    return 5 - dayOfWeek;
  }

  function getBurndownRequired() {
    var remaining = Math.max(0, WEEKLY_TARGET - getWeeklyTotal());
    var daysLeft = getWorkdaysLeft();
    if (remaining <= 0) return 0;
    var raw = Math.ceil(remaining / daysLeft);
    return Math.max(raw, DAILY_TARGET);
  }

  // ============================================================
  // RENDERING
  // ============================================================

  function render() {
    renderClock();
    renderWeekInfo();
    renderSummary();
    renderDayGrid();
    renderReport();
  }

  function renderClock() {
    var now = new Date();
    $('liveClock').textContent =
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');
    $('liveDate').textContent =
      DAY_FULL[now.getDay()] + ', ' + fmtDateShort(now) + '/' + now.getFullYear();
  }

  function renderWeekInfo() {
    var start = new Date(data.weekStart + 'T00:00:00');
    var end = new Date(start);
    end.setDate(end.getDate() + 6);
    $('weekNumber').textContent = 'Tuần ' + getISOWeekNumber(start);
    $('weekRange').textContent = fmtDateShort(start) + ' → ' + fmtDateShort(end) + '/' + end.getFullYear();
  }

  function renderSummary() {
    var total = getWeeklyTotal();
    var remaining = Math.max(0, WEEKLY_TARGET - total);
    var pct = Math.min(100, (total / WEEKLY_TARGET) * 100);
    var daysLeft = getWorkdaysLeft();
    var required = getBurndownRequired();

    $('progressFill').style.width = pct + '%';
    $('progressGlow').style.width = pct + '%';
    $('workedLabel').textContent = fmtMinutes(total);
    $('targetLabel').textContent = fmtMinutes(WEEKLY_TARGET);
    $('totalWorked').textContent = fmtMinutes(total);
    $('remaining').textContent = fmtMinutes(remaining);
    $('avgPerDay').textContent = remaining <= 0 ? '✅ Done' : fmtMinutes(required);
    $('daysWorked').textContent = getDaysWorked() + '/6';
  }

  function renderDayGrid() {
    var days = getWeekDays();
    var grid = $('dayGrid');
    var ordered = days;
    var html = '';
    var hasEmpty = false;

    for (var i = 0; i < ordered.length; i++) {
      var day = ordered[i];
      var mins = getDayMinutes(day.entry);
      var hasData = mins > 0;
      var isSunday = day.dayOfWeek === 0;
      var isEditing = editingDate === day.date;

      if (!isSunday && !hasData) hasEmpty = true;

      var classes = 'day-card';
      if (day.isToday) classes += ' day-card--today';
      if (hasData) classes += ' day-card--has-data';
      if (isSunday) classes += ' day-card--sunday';
      if (isEditing) classes += ' day-card--editing';

      html += '<div class="' + classes + '" data-date="' + day.date + '">';

      if (day.isToday) {
        html += '<div class="day-card__today-badge">Hôm nay</div>';
      }

      html += '<div class="day-card__header">';
      html += '<div><span class="day-card__name">' + day.dayName + '</span> ';
      html += '<span class="day-card__date">' + day.dateShort + '</span></div>';
      if (hasData && !isEditing) {
        html += '<div class="day-card__header-actions">';
        html += '<button class="day-card__edit-btn" data-action="modal" data-date="' + day.date + '" title="Sửa">✏️</button>';
        html += '<button class="day-card__delete-btn" data-action="delete" data-date="' + day.date + '" title="Xóa">✕</button>';
        html += '</div>';
      } else {
        html += '<div class="day-card__status' +
          (hasData ? ' day-card__status--done' : ' day-card__status--empty') +
          '"></div>';
      }
      html += '</div>';

      html += '<div class="day-card__body">';
      if (isEditing) {
        // Inline edit mode
        var prefill = hasData && day.entry
          ? day.entry.checkIn.replace(':', '') + ' ' + day.entry.checkOut.replace(':', '')
          : '';
        html += '<div class="day-card__inline-edit">';
        html += '<input type="text" class="day-card__inline-input" id="inlineInput_' + day.date + '"';
        html += ' value="' + prefill + '" placeholder="VD: 830 1730"';
        html += ' data-date="' + day.date + '">';
        html += '<div class="day-card__inline-hint">Enter ↵ lưu · Esc hủy</div>';
        html += '</div>';
      } else if (hasData && day.entry) {
        html += '<div class="day-card__times">';
        html += '<span>' + day.entry.checkIn + ' → ' + day.entry.checkOut + '</span>';
        html += '<span class="day-card__modal-link" data-action="modal" data-date="' + day.date + '" title="Tùy chỉnh">⏰</span>';
        html += '</div>';
        html += '<div class="day-card__duration">' + fmtMinutes(mins) + '</div>';
      } else if (isSunday) {
        html += '<div class="day-card__empty">Nghỉ 😴</div>';
      } else {
        html += '<div class="day-card__empty">Nhấn đúp để nhập</div>';
        html += '<div class="day-card__modal-link" data-action="modal" data-date="' + day.date + '">⏰ Tùy chỉnh</div>';
      }
      html += '</div></div>';
    }

    grid.innerHTML = html;

    // Show/hide fill-all button
    $('gridToolbar').style.display = hasEmpty ? 'flex' : 'none';

    // Auto-focus inline input if editing
    if (editingDate) {
      var inp = $('inlineInput_' + editingDate);
      if (inp) {
        inp.focus();
        inp.select();
      }
    }
  }

  // ─── Inline Edit ───

  function activateInlineEdit(dateStr) {
    if (editingDate === dateStr) return;
    editingDate = dateStr;
    renderDayGrid(); // re-render to show input
  }

  function cancelInlineEdit() {
    editingDate = null;
    renderDayGrid();
  }

  function handleInlineSave(dateStr, rawValue) {
    var parsed = parseTimeRange(rawValue);
    if (!parsed) {
      showToast('Sai format. VD: 830 1730 hoặc 08:30 17:30', 'error');
      return;
    }
    var duration = calcDuration(parsed.checkIn, parsed.checkOut);
    if (duration <= 0) {
      showToast('Giờ ra phải sau giờ vào.', 'error');
      return;
    }
    data.entries[dateStr] = { checkIn: parsed.checkIn, checkOut: parsed.checkOut };
    saveData();
    editingDate = null;
    render();
    showToast(fmtMinutes(duration) + ' → ' + dateStr, 'success');
  }

  function renderReport() {
    var days = getWeekDays();
    var ordered = days;
    var maxDisplay = 14 * 60; // 14h max for chart scale

    var chartHtml = '';
    for (var i = 0; i < ordered.length; i++) {
      var day = ordered[i];
      var mins = getDayMinutes(day.entry);
      var heightPct = Math.min(100, (mins / maxDisplay) * 100);
      var isOver = mins >= DAILY_TARGET;
      var todayClass = day.isToday ? ' chart-bar--today' : '';

      chartHtml += '<div class="chart-bar' + todayClass + '">';
      chartHtml += '<div class="chart-bar__value">' + (mins > 0 ? fmtMinutes(mins) : '-') + '</div>';
      chartHtml += '<div class="chart-bar__fill-wrap">';
      chartHtml += '<div class="chart-bar__fill' + (isOver ? ' chart-bar__fill--over' : '') +
        '" style="height:' + heightPct + '%"></div>';
      chartHtml += '</div>';
      chartHtml += '<div class="chart-bar__label">' + day.dayName + '</div>';
      chartHtml += '</div>';
    }
    $('reportChart').innerHTML = chartHtml;

    // Burndown info
    var total = getWeeklyTotal();
    var remaining = WEEKLY_TARGET - total;
    var daysLeft = getWorkdaysLeft();
    var burndown = '';

    if (remaining <= 0) {
      burndown = '🎉 <strong>Đã hoàn thành KPI tuần!</strong> Vượt ' + fmtMinutes(Math.abs(remaining)) +
        '. Vẫn phải làm đủ 8h/ngày nhưng khỏi lo OT!';
    } else {
      var required = getBurndownRequired();
      var daysText = daysLeft === 1 ? '1 ngày làm việc' : daysLeft + ' ngày làm việc';
      burndown = '⚡ Còn <strong>' + fmtMinutes(remaining) + '</strong> nữa là đủ. ';
      burndown += 'Từ giờ đến cuối tuần còn ' + daysText + ', ';
      burndown += 'cần cày <strong>' + fmtMinutes(required) + '/ngày</strong>.';
      if (required > DAILY_TARGET) {
        burndown += '<br>🥲 Đang nợ — đừng để dồn cuối tuần!';
      } else {
        burndown += '<br>😎 Đang đi đúng tiến độ!';
      }
    }
    $('burndownInfo').innerHTML = burndown;
  }

  // ============================================================
  // MODAL
  // ============================================================

  function openModal(dateStr) {
    var day = new Date(dateStr + 'T00:00:00');
    if (day.getDay() === 0) return; // Sunday — no entry

    selectedDate = dateStr;
    var entry = data.entries[dateStr];

    $('modalTitle').textContent = entry ? 'Sửa giờ' : 'Nhập giờ';
    $('modalDate').textContent = DAY_FULL[day.getDay()] + ' — ' + fmtDateShort(day) + '/' + day.getFullYear();
    $('inputCheckIn').value = entry ? entry.checkIn : '08:00';
    $('inputCheckOut').value = entry && entry.checkOut ? entry.checkOut : '17:30';
    $('btnDelete').style.display = entry ? 'inline-flex' : 'none';

    updatePreview();
    $('modalOverlay').classList.add('modal-overlay--open');
  }

  function closeModal() {
    $('modalOverlay').classList.remove('modal-overlay--open');
    selectedDate = null;
  }

  function updatePreview() {
    var checkIn = $('inputCheckIn').value;
    var checkOut = $('inputCheckOut').value;
    if (!checkIn || !checkOut) {
      $('previewDuration').textContent = '--';
      $('previewNote').textContent = '';
      return;
    }
    var duration = calcDuration(checkIn, checkOut);
    if (duration <= 0) {
      $('previewDuration').textContent = 'Không hợp lệ';
      $('previewDuration').style.color = 'var(--danger)';
      $('previewNote').textContent = 'Giờ ra phải sau giờ vào.';
      return;
    }
    $('previewDuration').style.color = 'var(--success)';
    $('previewDuration').textContent = fmtMinutes(duration);

    var rawDuration = parseTime(checkOut) - parseTime(checkIn);
    if (rawDuration > LUNCH_THRESHOLD) {
      $('previewNote').textContent = 'Đã trừ 1h nghỉ trưa (' + fmtMinutes(rawDuration) + ' → ' + fmtMinutes(duration) + ')';
    } else {
      $('previewNote').textContent = '';
    }
  }

  function saveEntry() {
    if (!selectedDate) return;
    var checkIn = $('inputCheckIn').value;
    var checkOut = $('inputCheckOut').value;

    if (!checkIn || !checkOut) {
      showToast('Vui lòng nhập đủ giờ vào và giờ ra.', 'error');
      return;
    }

    var duration = calcDuration(checkIn, checkOut);
    if (duration <= 0) {
      showToast('Giờ ra phải sau giờ vào.', 'error');
      return;
    }

    data.entries[selectedDate] = { checkIn: checkIn, checkOut: checkOut };
    saveData();
    var savedDate = selectedDate;
    closeModal();
    render();
    showToast('Đã lưu ' + fmtMinutes(duration) + ' cho ngày ' + savedDate, 'success');
  }

  function deleteEntry() {
    if (!selectedDate) return;
    if (!data.entries[selectedDate]) return;
    delete data.entries[selectedDate];
    saveData();
    var deletedDate = selectedDate;
    closeModal();
    render();
    showToast('Đã xóa log ngày ' + deletedDate, 'success');
  }



  // Quick-delete from card action button
  function quickDelete(dateStr) {
    if (!data.entries[dateStr]) return;
    delete data.entries[dateStr];
    saveData();
    render();
    showToast('Đã xóa ' + dateStr, 'success');
  }

  // Fill all empty work days with default times
  function fillAll() {
    var days = getWeekDays();
    var filled = 0;
    for (var i = 0; i < days.length; i++) {
      var day = days[i];
      if (day.dayOfWeek === 0) continue;
      if (data.entries[day.date]) continue;
      data.entries[day.date] = { checkIn: DEFAULT_IN, checkOut: DEFAULT_OUT };
      filled++;
    }
    if (filled === 0) {
      showToast('Không có ngày trống nào!', 'error');
      return;
    }
    saveData();
    render();
    showToast('Đã fill ' + filled + ' ngày (' + DEFAULT_IN + '→' + DEFAULT_OUT + ')', 'success');
  }

  // ============================================================
  // TOAST
  // ============================================================

  function showToast(message, type) {
    var container = $('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast toast--' + (type || 'success');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      toast.style.transition = '0.3s ease-out';
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  // ============================================================
  // EVENTS
  // ============================================================

  function setupEvents() {
    // Double-click on day card → inline edit
    $('dayGrid').addEventListener('dblclick', function (e) {
      var card = e.target.closest('.day-card');
      if (!card || card.classList.contains('day-card--sunday')) return;
      // Don't trigger if clicking delete button
      if (e.target.closest('[data-action="delete"]')) return;
      var dateStr = card.dataset.date;
      if (dateStr) activateInlineEdit(dateStr);
    });

    // Click handlers (delete, modal link)
    $('dayGrid').addEventListener('click', function (e) {
      // Modal link → open time picker modal
      var modalLink = e.target.closest('[data-action="modal"]');
      if (modalLink) {
        e.stopPropagation();
        openModal(modalLink.dataset.date);
        return;
      }

      var deleteBtn = e.target.closest('[data-action="delete"]');
      if (deleteBtn) {
        e.stopPropagation();
        quickDelete(deleteBtn.dataset.date);
        return;
      }
    });

    // Inline input: Enter → save, Escape → cancel
    $('dayGrid').addEventListener('keydown', function (e) {
      var input = e.target.closest('.day-card__inline-input');
      if (!input) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleInlineSave(input.dataset.date, input.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelInlineEdit();
      }
    });

    // Blur on inline input → cancel
    $('dayGrid').addEventListener('focusout', function (e) {
      var input = e.target.closest('.day-card__inline-input');
      if (!input) return;
      // Small delay to allow Enter keydown to fire first
      setTimeout(function () {
        if (editingDate === input.dataset.date) {
          cancelInlineEdit();
        }
      }, 150);
    });

    // Fill all button
    $('fillAllBtn').addEventListener('click', fillAll);

    // Modal (kept for fallback)
    $('modalClose').addEventListener('click', closeModal);
    $('btnCancel').addEventListener('click', closeModal);
    $('btnSave').addEventListener('click', saveEntry);
    $('btnDelete').addEventListener('click', deleteEntry);
    $('modalOverlay').addEventListener('click', function (e) {
      if (e.target === $('modalOverlay')) closeModal();
    });
    $('inputCheckIn').addEventListener('input', updatePreview);
    $('inputCheckOut').addEventListener('input', updatePreview);

    // Global Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (editingDate) cancelInlineEdit();
        else closeModal();
      }
    });
  }

  // ============================================================
  // INIT
  // ============================================================

  function init() {
    loadData();
    setupEvents();
    render();

    // Live clock update
    clockTimer = setInterval(renderClock, 1000);

    // Auto-refresh data display every minute
    setInterval(function () { render(); }, 60000);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
