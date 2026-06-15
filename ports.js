// ===== СОСТОЯНИЕ ТАБЛИЦЫ =====

// Текущая сортировка: { column: string|null, dir: 'ASC'|'DESC' }
let sortState = { column: 'nickname', dir: 'ASC' };

// Активные фильтры: { nickname: 'значение', fio: 'значение', ... }
let filterState = {};

// Для какого столбца сейчас открыта карточка фильтра
let currentFilterCol = null;


// ===== СОРТИРОВКА И ФИЛЬТРЫ =====

// Сортировка
function handleSort(col, btn) {
  if (sortState.column === col) {
    sortState.dir = sortState.dir === 'ASC' ? 'DESC' : 'ASC';
  } else {
    if (sortState.column) {
      const prevBtn = document.getElementById(`sort-${sortState.column}`);
      if (prevBtn) {
        prevBtn.classList.remove('active');
        prevBtn.textContent = '↕';
      }
    }
    sortState.column = col;
    sortState.dir = 'ASC';
  }

  btn.classList.add('active');
  btn.textContent = sortState.dir === 'ASC' ? '↑' : '↓';

  loadTable();
}

// Метки столбцов для карточки фильтра
const colLabels = {
  nickname:    'Никнейм',
  fio:         'ФИО',
  tele:        'Телефон',
  device_name: 'Устройство',
  booking_time:'Бронирование',
  port_id:     'ID порта',
  port_name:   'Порт',
  //port_status: 'Статус порта',
};

// Фильтр
function openFilter(col, btn) {
  // Снятие фильтра по повторному клику
  if (filterState[col] !== undefined) {
    delete filterState[col];
    btn.classList.remove('active');

    loadTable();
    return;
  }

  currentFilterCol = col;

  const card = document.getElementById('filter-card');
  const input = document.getElementById('filter-input');
  const rect = btn.getBoundingClientRect(); // координаты кнопки относительно viewport

  document.getElementById('filter-card-label').textContent = `Фильтр: ${colLabels[col]}`;
  input.value = '';

  // Позиционируем карточку под кнопкой
  card.style.top  = `${rect.bottom + 6}px`;
  card.style.left = `${Math.min(rect.left, window.innerWidth - 240)}px`; // не уходим за правый край
  
  card.classList.remove('hidden');
  input.focus();
}

function closeFilter() {
  document.getElementById('filter-card').classList.add('hidden');
  currentFilterCol = null;
}

function applyFilter() {
  if (!currentFilterCol) return;

  const val = document.getElementById('filter-input').value.trim();

  if (!val) {
    closeFilter();
    return;
  }

  filterState[currentFilterCol] = val;
  const btn = document.getElementById(`filter-${currentFilterCol}`);
  if (btn) btn.classList.add('active');

  closeFilter();
  loadTable();
}

// Закрываем карточку фильтра при клике вне её
document.addEventListener('click', e => {
  const card = document.getElementById('filter-card');
  if (card.classList.contains('hidden')) return;

  // Не закрываем если кликнули внутри карточки или по кнопке фильтра
  if (!card.contains(e.target) && !e.target.closest('.ctrl-btn')) {
    closeFilter();
  }
});

// Enter — применить фильтр, Escape — закрыть
document.getElementById('filter-input').addEventListener('keydown', e => {
  if (e.key === 'Enter')  applyFilter();
  if (e.key === 'Escape') closeFilter();
});


// ===== ЗАГРУЗКА И ОТОБРАЖЕНИЕ ТАБЛИЦЫ =====

async function loadTable() {
  showLoadingState();

  // Собираем параметры запроса
  const params = new URLSearchParams();

  if (sortState.column) {
    params.set('sort', sortState.column);
    params.set('dir',  sortState.dir);
  }

  // Добавляем все активные фильтры
  Object.entries(filterState).forEach(([col, val]) => {
    params.set(`filter_${col}`, val);
  });

  try {
    const responseDelete = await fetch(
      `http://localhost:3000/api/ports`, 
      { method: 'DELETE' }
    );
    if (!responseDelete.ok) throw new Error(`HTTP ${response.status}`);

    const response = await fetch(
      `http://localhost:3000/api/ports?${params}`, 
      { method: 'GET' }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const rows = await response.json();
    renderTable(rows);
  } catch (err) {
    showErrorState();
    console.error('Ошибка загрузки главной таблицы:', err);
  }
}

function showLoadingState() {
  document.getElementById('ports-body').innerHTML = `
    <tr><td colspan="9">
      <div class="table-state">
        <div class="spinner"></div>
        Загрузка данных…
      </div>
    </td></tr>`;
}

function showErrorState() {
  document.getElementById('ports-body').innerHTML = `
    <tr><td colspan="9">
      <div class="table-state">
        Не удалось загрузить данные. Проверьте подключение к серверу.
      </div>
    </td></tr>`;
}

function renderTable(rows) {
  const tbody = document.getElementById('ports-body');

  if (!rows.length) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="table-state">
          Нет данных для отображения
        </div>
      </td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(row => {

    const timeCell = row.booking_time
      ? `<span class="booking-time">${esc(row.booking_time)}</span>`
      : '<span class="empty-cell">—</span>';

    const statusCell = row.port_status == '1'
      ? '<span class="badge booked">Занят</span>'
      : '<span class="badge free">Свободен</span>';

    return `
      <tr>
        <td>${esc(row.nickname) || '<span class="empty-cell">—</span>'}</td>
        <td>${esc(row.fio) || '<span class="empty-cell">—</span>'}</td>
        <td>${esc(row.tele) || '<span class="empty-cell">—</span>'}</td>
        <td>${esc(row.device_name) || '<span class="empty-cell">—</span>'}</td>
        <td>${timeCell}</td>
        <td>${esc(row.port_id) || '<span class="empty-cell">—</span>'}</td>
        <td>${esc(row.port_name) || '<span class="empty-cell">—</span>'}</td>
        <td>${statusCell}</td>
        <td>${esc(row.port_description) || '<span class="empty-cell">—</span>'}</td>
      </tr>`;
  }).join('');
}

// Экранирование HTML — защита от XSS
function esc(val) {
  if (val == null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ===== СТАРТ =====
if (document.getElementById('ports-body')) {
  loadTable();
};
