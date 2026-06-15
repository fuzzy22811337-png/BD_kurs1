let sortState = { column: 'booking_id', dir: 'ASC' };

// Активные фильтры
let filterState = {};

// Для какого столбца открыта карточка фильтра
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
  booking_id:   'ID брони',
  device_id:    'ID устройства',
  device_name:  'Устройство',
  booking_time: 'Бронирование',
  port_id:      'ID порта',
  port_name:    'Порт',
};

function openFilter(col, btn) {
  // Повторный клик — снять фильтр
  if (filterState[col] !== undefined) {
    delete filterState[col];
    btn.classList.remove('active');
    loadTable();
    return;
  }

  currentFilterCol = col;

  const card = document.getElementById('filter-card');
  const input = document.getElementById('filter-input');
  const rect = btn.getBoundingClientRect();

  document.getElementById('filter-card-label').textContent = `Фильтр: ${colLabels[col]}`;
  input.value = '';

  card.style.top  = `${rect.bottom + 6}px`;
  card.style.left = `${Math.min(rect.left, window.innerWidth - 240)}px`;

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

// Закрываем карточку фильтра при клике вне неё
document.addEventListener('click', e => {
  const card = document.getElementById('filter-card');
  if (card.classList.contains('hidden')) return;

  // Не закрываем если кликнули внутри карточки или по кнопке фильтра
  if (!card.contains(e.target) && !e.target.closest('.ctrl-btn')) {
    closeFilter();
  }
});

document.getElementById('filter-input').addEventListener('keydown', e => {
  if (e.key === 'Enter')  applyFilter();
  if (e.key === 'Escape') closeFilter();
});


// ===== ЗАГРУЗКА И ОТОБРАЖЕНИЕ ТАБЛИЦЫ =====

async function loadTable() {
  showLoadingState();

  const params = new URLSearchParams();

  if (sortState.column) {
    params.set('sort', sortState.column);
    params.set('dir', sortState.dir);
  }

  Object.entries(filterState).forEach(([col, val]) => {
    params.set(`filter_${col}`, val);
  });

  params.set('filter_user_nickname', currentUser);

  try {
    const response = await fetch(
      `http://localhost:3000/api/bookings?${params}`,
      { method: 'GET' }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const rows = await response.json();
    renderTable(rows);
  } catch (err) {
    showErrorState();
    console.error('Ошибка загрузки броней:', err);
  }
}

function showLoadingState() {
  document.getElementById('bookings-body').innerHTML =
    `<tr><td colspan="8">
      <div class="table-state">
        <div class="spinner"></div>
        Загрузка…
      </div>
    </td></tr>`;
}

function showErrorState() {
  document.getElementById('bookings-body').innerHTML =
    `<tr><td colspan="8">
      <div class="table-state">
        Не удалось загрузить брони. Проверьте подключение к серверу.
      </div>
    </td></tr>`;
}

function renderTable(rows) {
  const tbody = document.getElementById('bookings-body');

  if (!rows.length) {
    tbody.innerHTML =
      `<tr><td colspan="8">
        <div class="table-state">
          Нет броней или данных для отображения
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(row => {
    const timeCell =`<span class="booking-time">${esc(row.booking_time)}</span>`;

    return `
      <tr>
        <td>
          <div class="row-actions">
            <button class="ctrl-btn row-btn-delete" onclick="deleteBooking(${row.booking_id})" title="Удалить">🗑</button>
            <button class="ctrl-btn row-btn-edit" onclick="editBooking(${row.booking_id}, ${row.device_id}, ${row.port_id}, ${row.raw_time})" title="Редактировать">✎</button>
          </div>
        </td>
        <td>${esc(row.booking_id)}</td>
        <td>${esc(row.device_id)}</td>
        <td>${esc(row.device_name)}</td>
        <td>${timeCell}</td>
        <td>${esc(row.port_id)}</td>
        <td>${esc(row.port_name)}</td>
        <td>${esc(row.port_description)}</td>
      </tr>
    `;
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


// ===== МОДАЛЬНОЕ ОКНО БРОНИ =====

let bookingModalMode = 'add';
let bookingEditId  = null;

// Преобразует сырой epoch-timestamp в { days, hours, minutes } остатка
function secondsToComponents(rawTime) {
  const remaining = Math.max(0, Math.floor(rawTime - Date.now() / 1000));
  return {
    days: Math.floor(remaining / 86400),
    hours: Math.floor((remaining % 86400) / 3600),
    minutes: Math.floor(((remaining % 86400) % 3600) / 60),
  };
}

function openBookingModal(mode, data = {}) {
  bookingModalMode = mode;
  bookingEditId = data.booking_id || null;

  const title = document.getElementById('booking-modal-title');
  const confirm = document.getElementById('booking-modal-confirm');

  if (mode === 'edit') {
    title.textContent   = 'Редактировать бронь';
    confirm.textContent = 'Сохранить';

    document.getElementById('booking-device-id').value = data.device_id ?? '';
    document.getElementById('booking-port-id').value = data.port_id ?? '';

    const { days, hours, minutes } = secondsToComponents(data.raw_time || 0);
    document.getElementById('booking-days').value = days;
    document.getElementById('booking-hours').value = hours;
    document.getElementById('booking-minutes').value = minutes;
  } else {
    title.textContent = 'Добавить бронь';
    confirm.textContent = 'Добавить';

    document.getElementById('booking-device-id').value = '';
    document.getElementById('booking-port-id').value = '';
    document.getElementById('booking-days').value = '';
    document.getElementById('booking-hours').value = '';
    document.getElementById('booking-minutes').value = '';
  }

  document.getElementById('booking-modal').classList.remove('hidden');
  document.getElementById('booking-device-id').focus();
}

function closeBookingModal() {
  document.getElementById('booking-modal').classList.add('hidden');
  bookingModalMode = 'add';
  bookingEditId = null;
}

// Клик по фону оверлея
function handleBookingOverlayClick(e) {
  if (e.target === document.getElementById('booking-modal')) {
    closeBookingModal();
  }
}

// ESC и Enter на всех полях модального окна брони
['booking-device-id', 'booking-days', 'booking-hours', 'booking-minutes', 'booking-port-id']
  .forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Escape') closeBookingModal();
      if (e.key === 'Enter') submitBooking();
    });
  });

async function submitBooking() {
  const device_id = document.getElementById('booking-device-id').value.trim();
  const port_id = document.getElementById('booking-port-id').value.trim();
  const days = parseInt(document.getElementById('booking-days').value) || 0;
  const hours = parseInt(document.getElementById('booking-hours').value) || 0;
  const minutes = parseInt(document.getElementById('booking-minutes').value) || 0;

  if (!device_id) {
    document.getElementById('booking-device-id').focus();
    return alert('Введите id устройства');
  }

  if (days + hours + minutes === 0) {
    document.getElementById('booking-days').focus();
    return alert('Введите время не равное 0');
  }

  if (!port_id) {
    document.getElementById('booking-port-id').focus();
    return alert('Введите название устройства');
  }

  const confirmBtn = document.getElementById('booking-modal-confirm');
  confirmBtn.disabled = true;
  confirmBtn.textContent = bookingModalMode === 'edit' ? 'Сохранение…' : 'Добавление…';

  try {
    const body = JSON.stringify({
      nickname: currentUser,
      device_id,
      port_id,
      days,
      hours,
      minutes,
    });

    const response = bookingModalMode === 'edit'
      ? await fetch(`http://localhost:3000/api/bookings/${bookingEditId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      : await fetch('http://localhost:3000/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });

    const data = await response.json();

    if (response.ok) {
      closeBookingModal();
      loadTable();
    } else {
      alert(`Ошибка: ${data.error || 'Неизвестная ошибка'}`);
      confirmBtn.disabled = false;
      confirmBtn.textContent = bookingModalMode === 'edit' ? 'Сохранить' : 'Добавить';
    }
  } catch (err) {
    alert('Не удалось подключиться к серверу');
    console.error('Ошибка сохранения брони:', err);
    confirmBtn.disabled = false;
    confirmBtn.textContent = bookingModalMode === 'edit' ? 'Сохранить' : 'Добавить';
  }
}


// ===== ДЕЙСТВИЯ СО СТРОКАМИ =====

function addBooking() {
  openBookingModal('add');
}

async function deleteBooking(id) {
  if (!confirm(`Удалить бронь #${id}?\n\nЭто действие необратимо.`)) return;

  try {
    const response = await fetch(
      `http://localhost:3000/api/bookings/${id}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: currentUser }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      loadTable();
    } else {
      alert(`Ошибка удаления: ${data.error || 'Неизвестная ошибка'}`);
    }
  } catch (err) {
    alert('Не удалось подключиться к серверу');
    console.error('Ошибка удаления брони:', err);
  }
}

function editBooking(booking_id, device_id, port_id, raw_time) {
  openBookingModal('edit', { booking_id, device_id, port_id, raw_time });
}


// ===== СТАРТ =====
if (document.getElementById('bookings-body')) {
  loadTable();
}