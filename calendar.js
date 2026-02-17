'use strict';

// ===== Calendar State =====
let calEvents = [];
let calReminders = [];
let calCurrentYear = new Date().getFullYear();
let calCurrentMonth = new Date().getMonth(); // 0-indexed
let calSelectedDate = new Date().toISOString().slice(0, 10);
let calEditingEventId = null;
window.calPendingDeleteEventId = null;

const EVENT_COLORS = {
  blue:   '#3b82f6',
  green:  '#22c55e',
  red:    '#ef4444',
  orange: '#f97316',
  purple: '#8b5cf6'
};

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ===== Storage =====
function loadCalEvents() {
  try { calEvents = JSON.parse(localStorage.getItem('daily-planner-events')) || []; }
  catch { calEvents = []; }
}

function saveCalEvents() {
  localStorage.setItem('daily-planner-events', JSON.stringify(calEvents));
}

function loadCalReminders() {
  try { calReminders = JSON.parse(localStorage.getItem('daily-planner-reminders')) || []; }
  catch { calReminders = []; }
}

function saveCalReminders() {
  localStorage.setItem('daily-planner-reminders', JSON.stringify(calReminders));
}

// ===== CRUD Events =====
function addCalEvent(data) {
  calEvents.push({
    id: Date.now(),
    title: data.title.trim(),
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    description: data.description.trim(),
    color: data.color,
    recurrence: data.recurrence,
    recurrenceEnd: data.recurrenceEnd,
    createdAt: new Date().toISOString()
  });
  saveCalEvents();
  renderCalendar();
  renderDayPanel(calSelectedDate);
}

function editCalEvent(id, data) {
  const idx = calEvents.findIndex(e => e.id === id);
  if (idx === -1) return;
  calEvents[idx] = {
    ...calEvents[idx],
    title: data.title.trim(),
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    description: data.description.trim(),
    color: data.color,
    recurrence: data.recurrence,
    recurrenceEnd: data.recurrenceEnd
  };
  saveCalEvents();
  renderCalendar();
  renderDayPanel(calSelectedDate);
}

function deleteCalEvent(id) {
  calEvents = calEvents.filter(e => e.id !== id);
  saveCalEvents();
  renderCalendar();
  renderDayPanel(calSelectedDate);
}

// ===== CRUD Reminders =====
function addCalReminder(title) {
  if (!title.trim()) return;
  calReminders.push({ id: Date.now(), title: title.trim() });
  saveCalReminders();
  renderPinnedReminders();
}

function deleteCalReminder(id) {
  calReminders = calReminders.filter(r => r.id !== id);
  saveCalReminders();
  renderPinnedReminders();
}

// ===== Recurrence Logic =====
function eventOccursOn(event, dateStr) {
  if (dateStr < event.date) return false;
  if (event.recurrenceEnd && dateStr > event.recurrenceEnd) return false;

  switch (event.recurrence) {
    case 'none':
      return event.date === dateStr;
    case 'daily':
      return true;
    case 'weekly': {
      const base   = new Date(event.date + 'T00:00:00');
      const target = new Date(dateStr  + 'T00:00:00');
      return base.getDay() === target.getDay();
    }
    case 'monthly': {
      const base   = new Date(event.date + 'T00:00:00');
      const target = new Date(dateStr  + 'T00:00:00');
      return base.getDate() === target.getDate();
    }
    case 'yearly': {
      return event.date.slice(5) === dateStr.slice(5); // MM-DD match
    }
    default:
      return false;
  }
}

function getEventsForDay(dateStr) {
  return calEvents
    .filter(e => eventOccursOn(e, dateStr))
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
}

// ===== Render Calendar Grid =====
function renderCalendar() {
  const label = document.getElementById('cal-month-label');
  const grid  = document.getElementById('cal-grid');
  if (!label || !grid) return;

  label.textContent = `${MONTH_NAMES[calCurrentMonth]} ${calCurrentYear}`;

  const today    = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(calCurrentYear, calCurrentMonth, 1).getDay();
  const daysInMonth    = new Date(calCurrentYear, calCurrentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calCurrentYear, calCurrentMonth, 0).getDate();

  let cells = '';

  // Trailing days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = calCurrentMonth === 0 ? 12 : calCurrentMonth;
    const y = calCurrentMonth === 0 ? calCurrentYear - 1 : calCurrentYear;
    const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells += buildDayCell(d, dateStr, true, today);
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calCurrentYear}-${String(calCurrentMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells += buildDayCell(d, dateStr, false, today);
  }

  // Leading days from next month to fill grid
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const trailing   = totalCells - firstDay - daysInMonth;
  for (let d = 1; d <= trailing; d++) {
    const m = calCurrentMonth === 11 ? 1 : calCurrentMonth + 2;
    const y = calCurrentMonth === 11 ? calCurrentYear + 1 : calCurrentYear;
    const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells += buildDayCell(d, dateStr, true, today);
  }

  grid.innerHTML = cells;

  // Attach click handlers to each day
  grid.querySelectorAll('.cal-day').forEach(cell => {
    cell.addEventListener('click', () => {
      calSelectedDate = cell.dataset.date;
      // Update selected highlight without full re-render
      grid.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      renderDayPanel(calSelectedDate);
    });
  });
}

function buildDayCell(dayNum, dateStr, otherMonth, today) {
  const events  = getEventsForDay(dateStr);
  const classes = [
    'cal-day',
    otherMonth           ? 'other-month' : '',
    dateStr === today    ? 'today'        : '',
    dateStr === calSelectedDate ? 'selected' : ''
  ].filter(Boolean).join(' ');

  const shown = events.slice(0, 3);
  let dots = shown.map(e => {
    const color = EVENT_COLORS[e.color] || EVENT_COLORS.blue;
    return `<span class="event-dot" style="background:${color}" title="${escCalHtml(e.title)}"></span>`;
  }).join('');
  if (events.length > 3) {
    dots += `<span class="event-dot-more">+${events.length - 3}</span>`;
  }

  return `
    <div class="${classes}" data-date="${dateStr}">
      <span class="cal-day-num">${dayNum}</span>
      <div class="event-dots">${dots}</div>
    </div>
  `;
}

// ===== Render Day Sidebar Panel =====
function renderDayPanel(dateStr) {
  const label     = document.getElementById('cal-day-label');
  const container = document.getElementById('cal-day-events');
  const addBtn    = document.getElementById('add-event-btn');
  if (!label || !container) return;

  const d = new Date(dateStr + 'T00:00:00');
  label.textContent = `${DAY_NAMES[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

  if (addBtn) {
    addBtn.onclick = () => openEventModal(dateStr);
  }

  const events = getEventsForDay(dateStr);
  if (events.length === 0) {
    container.innerHTML = '<p class="sidebar-empty">No events. Click "+ Event" to add one.</p>';
    return;
  }

  container.innerHTML = events.map(e => buildEventCard(e)).join('');
}

function buildEventCard(event) {
  const color   = EVENT_COLORS[event.color] || EVENT_COLORS.blue;
  const timeStr = event.startTime
    ? `${formatCalTime(event.startTime)}${event.endTime ? ' &ndash; ' + formatCalTime(event.endTime) : ''}`
    : 'All day';

  const recBadge = event.recurrence !== 'none'
    ? `<span class="rec-badge">&#8635; ${event.recurrence.charAt(0).toUpperCase() + event.recurrence.slice(1)}</span>`
    : '';

  const desc = event.description
    ? `<p class="event-desc">${escCalHtml(event.description)}</p>`
    : '';

  return `
    <div class="event-card" style="border-left-color:${color}">
      <div class="event-card-header">
        <div class="event-card-info">
          <span class="event-time">${timeStr}</span>
          <span class="event-title-text">${escCalHtml(event.title)}</span>
          ${recBadge}
        </div>
        <div class="event-card-actions">
          <button class="icon-btn" title="Edit" onclick="openEventModal('${escCalHtml(calSelectedDate)}', ${event.id})">&#9998;</button>
          <button class="icon-btn delete-btn" title="Delete" onclick="confirmDeleteCalEvent(${event.id})">&#128465;</button>
        </div>
      </div>
      ${desc}
    </div>
  `;
}

function formatCalTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

// ===== Upcoming Todos =====
function renderUpcomingTodos() {
  const container = document.getElementById('cal-upcoming');
  if (!container) return;

  const today = new Date().toISOString().slice(0, 10);
  const limit = new Date();
  limit.setDate(limit.getDate() + 7);
  const limitStr = limit.toISOString().slice(0, 10);

  const allTodos = window.todos || [];
  const upcoming = allTodos
    .filter(t => !t.completed && t.dueDate && t.dueDate >= today && t.dueDate <= limitStr)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (upcoming.length === 0) {
    container.innerHTML = '<p class="sidebar-empty">No tasks due in the next 7 days.</p>';
    return;
  }

  const priorityColor = { High: '#ef4444', Medium: '#f97316', Low: '#22c55e' };
  container.innerHTML = upcoming.map(t => {
    const d         = new Date(t.dueDate + 'T00:00:00');
    const dateLabel = t.dueDate === today
      ? '<strong>Today</strong>'
      : `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
    const color = priorityColor[t.priority] || '#6b7280';
    return `
      <div class="upcoming-task">
        <span class="upcoming-dot" style="background:${color}"></span>
        <div class="upcoming-info">
          <span class="upcoming-title">${escCalHtml(t.title)}</span>
          <span class="upcoming-date">${dateLabel}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ===== Pinned Reminders =====
function renderPinnedReminders() {
  const container = document.getElementById('cal-reminders');
  if (!container) return;

  if (calReminders.length === 0) {
    container.innerHTML = '<p class="sidebar-empty">No reminders yet.</p>';
    return;
  }

  container.innerHTML = calReminders.map(r => `
    <div class="reminder-item">
      <span class="reminder-text">${escCalHtml(r.title)}</span>
      <button class="icon-btn delete-btn reminder-del" title="Remove" onclick="deleteCalReminder(${r.id})">&#10005;</button>
    </div>
  `).join('');
}

// ===== Event Modal =====
function openEventModal(dateStr, eventId) {
  calEditingEventId = eventId || null;
  const modal = document.getElementById('event-modal');
  const titleEl = document.getElementById('event-modal-title');

  // Reset
  document.getElementById('event-form').reset();
  document.getElementById('event-date').value = dateStr || calSelectedDate;
  document.querySelector('input[name="event-color"][value="blue"]').checked = true;
  document.getElementById('recurrence-end-row').style.display = 'none';

  if (eventId) {
    const ev = calEvents.find(e => e.id === eventId);
    if (!ev) return;
    titleEl.textContent = 'Edit Event';
    document.getElementById('event-id').value    = ev.id;
    document.getElementById('event-title').value = ev.title;
    document.getElementById('event-date').value  = ev.date;
    document.getElementById('event-start').value = ev.startTime || '';
    document.getElementById('event-end').value   = ev.endTime   || '';
    document.getElementById('event-desc').value  = ev.description || '';
    document.getElementById('event-recurrence').value = ev.recurrence;
    document.getElementById('event-recurrence-end').value = ev.recurrenceEnd || '';
    const colorInput = document.querySelector(`input[name="event-color"][value="${ev.color}"]`);
    if (colorInput) colorInput.checked = true;
    if (ev.recurrence !== 'none') {
      document.getElementById('recurrence-end-row').style.display = '';
    }
  } else {
    titleEl.textContent = 'Add Event';
    document.getElementById('event-id').value = '';
  }

  modal.classList.remove('hidden');
  document.getElementById('event-title').focus();
}

function closeEventModal() {
  document.getElementById('event-modal').classList.add('hidden');
  calEditingEventId = null;
}

function confirmDeleteCalEvent(id) {
  window.calPendingDeleteEventId = id;
  document.getElementById('delete-modal').classList.remove('hidden');
}

// ===== Escape HTML =====
function escCalHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  loadCalEvents();
  loadCalReminders();

  // Month navigation
  document.getElementById('cal-prev').addEventListener('click', () => {
    calCurrentMonth--;
    if (calCurrentMonth < 0) { calCurrentMonth = 11; calCurrentYear--; }
    renderCalendar();
  });

  document.getElementById('cal-next').addEventListener('click', () => {
    calCurrentMonth++;
    if (calCurrentMonth > 11) { calCurrentMonth = 0; calCurrentYear++; }
    renderCalendar();
  });

  // Event form submit
  document.getElementById('event-form').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      title:         document.getElementById('event-title').value,
      date:          document.getElementById('event-date').value,
      startTime:     document.getElementById('event-start').value,
      endTime:       document.getElementById('event-end').value,
      description:   document.getElementById('event-desc').value,
      color:         document.querySelector('input[name="event-color"]:checked')?.value || 'blue',
      recurrence:    document.getElementById('event-recurrence').value,
      recurrenceEnd: document.getElementById('event-recurrence-end').value
    };
    if (calEditingEventId) {
      editCalEvent(calEditingEventId, data);
    } else {
      addCalEvent(data);
    }
    closeEventModal();
  });

  // Show/hide recurrence end date field
  document.getElementById('event-recurrence').addEventListener('change', e => {
    document.getElementById('recurrence-end-row').style.display =
      e.target.value !== 'none' ? '' : 'none';
  });

  // Close event modal
  document.getElementById('event-modal-close').addEventListener('click', closeEventModal);
  document.getElementById('cancel-event').addEventListener('click', closeEventModal);
  document.getElementById('event-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('event-modal')) closeEventModal();
  });

  // Add reminder
  document.getElementById('add-reminder-btn').addEventListener('click', () => {
    const input = document.getElementById('reminder-input');
    if (input.value.trim()) {
      addCalReminder(input.value);
      input.value = '';
    }
  });

  document.getElementById('reminder-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const input = document.getElementById('reminder-input');
      if (input.value.trim()) {
        addCalReminder(input.value);
        input.value = '';
      }
    }
  });

  // Initial renders (calendar renders on tab switch via app.js)
  renderDayPanel(calSelectedDate);
  renderUpcomingTodos();
  renderPinnedReminders();
});
