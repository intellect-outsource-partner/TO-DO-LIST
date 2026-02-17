'use strict';

// ===== State =====
let todos = [];
let activeFilter = { status: 'all', priority: 'all', category: 'all' };
let pendingDeleteId = null;

// ===== LocalStorage =====
function loadTodos() {
  try {
    todos = JSON.parse(localStorage.getItem('daily-planner-todos')) || [];
  } catch {
    todos = [];
  }
}

function saveTodos() {
  localStorage.setItem('daily-planner-todos', JSON.stringify(todos));
}

// ===== CRUD =====
function addTodo(data) {
  const todo = {
    id: Date.now(),
    title: data.title.trim(),
    category: data.category,
    priority: data.priority,
    dueDate: data.dueDate || '',
    completed: false,
    createdAt: new Date().toISOString().slice(0, 10)
  };
  todos.unshift(todo);
  saveTodos();
  renderTodos();
  updateStats();
}

function editTodo(id, data) {
  const idx = todos.findIndex(t => t.id === id);
  if (idx === -1) return;
  todos[idx] = {
    ...todos[idx],
    title: data.title.trim(),
    category: data.category,
    priority: data.priority,
    dueDate: data.dueDate || ''
  };
  saveTodos();
  renderTodos();
  updateStats();
}

function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  saveTodos();
  renderTodos();
  updateStats();
}

function toggleComplete(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  todo.completed = !todo.completed;
  saveTodos();
  renderTodos();
  updateStats();
}

// ===== Filters =====
function applyFilters() {
  return todos.filter(todo => {
    const statusOk =
      activeFilter.status === 'all' ||
      (activeFilter.status === 'active' && !todo.completed) ||
      (activeFilter.status === 'completed' && todo.completed);

    const priorityOk =
      activeFilter.priority === 'all' || todo.priority === activeFilter.priority;

    const categoryOk =
      activeFilter.category === 'all' || todo.category === activeFilter.category;

    return statusOk && priorityOk && categoryOk;
  });
}

// ===== Stats =====
function updateStats() {
  const total = todos.length;
  const completed = todos.filter(t => t.completed).length;
  const pending = total - completed;
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-completed').textContent = completed;
  document.getElementById('stat-pending').textContent = pending;
}

// ===== Render =====
function renderTodos() {
  const list = document.getElementById('todo-list');
  const empty = document.getElementById('empty-state');
  const filtered = applyFilters();

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = filtered.map(todo => buildTodoHTML(todo)).join('');
}

function buildTodoHTML(todo) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = todo.dueDate && todo.dueDate < today && !todo.completed;

  const dueBadge = todo.dueDate
    ? `<span class="todo-due ${isOverdue ? 'overdue' : ''}">
         ${isOverdue ? '&#9888; Overdue: ' : '&#128197; '}${formatDate(todo.dueDate)}
       </span>`
    : '';

  return `
    <div class="todo-item priority-${escHtml(todo.priority)} ${todo.completed ? 'completed' : ''}"
         data-id="${todo.id}">
      <div class="todo-check" role="checkbox" aria-checked="${todo.completed}"
           aria-label="Toggle complete" onclick="toggleComplete(${todo.id})"></div>
      <div class="todo-content">
        <div class="todo-title">${escHtml(todo.title)}</div>
        <div class="todo-meta">
          <span class="badge badge-category">${escHtml(todo.category)}</span>
          <span class="badge badge-${escHtml(todo.priority)}">${escHtml(todo.priority)}</span>
          ${dueBadge}
        </div>
      </div>
      <div class="todo-actions">
        <button class="icon-btn" title="Edit" onclick="openEditModal(${todo.id})">&#9998;</button>
        <button class="icon-btn delete-btn" title="Delete" onclick="openDeleteModal(${todo.id})">&#128465;</button>
      </div>
    </div>
  `;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== Edit Modal =====
function openEditModal(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;

  document.getElementById('edit-id').value = todo.id;
  document.getElementById('edit-title').value = todo.title;
  document.getElementById('edit-category').value = todo.category;
  document.getElementById('edit-priority').value = todo.priority;
  document.getElementById('edit-due').value = todo.dueDate || '';

  document.getElementById('edit-modal').classList.remove('hidden');
  document.getElementById('edit-title').focus();
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

// ===== Delete Modal =====
function openDeleteModal(id) {
  pendingDeleteId = id;
  document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  pendingDeleteId = null;
  document.getElementById('delete-modal').classList.add('hidden');
}

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', () => {
  loadTodos();
  renderTodos();
  updateStats();

  // Add form
  document.getElementById('add-form').addEventListener('submit', e => {
    e.preventDefault();
    const title = document.getElementById('todo-title').value;
    if (!title.trim()) return;
    addTodo({
      title,
      category: document.getElementById('todo-category').value,
      priority: document.getElementById('todo-priority').value,
      dueDate: document.getElementById('todo-due').value
    });
    e.target.reset();
    document.getElementById('todo-priority').value = 'Medium';
    document.getElementById('todo-title').focus();
  });

  // Edit form
  document.getElementById('edit-form').addEventListener('submit', e => {
    e.preventDefault();
    const id = parseInt(document.getElementById('edit-id').value, 10);
    editTodo(id, {
      title: document.getElementById('edit-title').value,
      category: document.getElementById('edit-category').value,
      priority: document.getElementById('edit-priority').value,
      dueDate: document.getElementById('edit-due').value
    });
    closeEditModal();
  });

  // Edit modal close buttons
  document.getElementById('modal-close').addEventListener('click', closeEditModal);
  document.getElementById('cancel-edit').addEventListener('click', closeEditModal);

  // Delete modal buttons
  document.getElementById('cancel-delete').addEventListener('click', closeDeleteModal);
  document.getElementById('confirm-delete').addEventListener('click', () => {
    if (pendingDeleteId !== null) {
      deleteTodo(pendingDeleteId);
      closeDeleteModal();
    }
  });

  // Click outside modal to close
  document.getElementById('edit-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('edit-modal')) closeEditModal();
  });
  document.getElementById('delete-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('delete-modal')) closeDeleteModal();
  });

  // Status filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter.status = tab.dataset.status;
      renderTodos();
    });
  });

  // Priority filter
  document.getElementById('filter-priority').addEventListener('change', e => {
    activeFilter.priority = e.target.value;
    renderTodos();
  });

  // Category filter
  document.getElementById('filter-category').addEventListener('change', e => {
    activeFilter.category = e.target.value;
    renderTodos();
  });

  // Keyboard: Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeEditModal();
      closeDeleteModal();
    }
  });
});
