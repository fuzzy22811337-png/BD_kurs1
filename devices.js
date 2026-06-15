let sortState = { column: 'device_id', dir: 'ASC' };

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
   device_id: 'ID',
   device_name: 'Устройство',
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


// ===== ЗАГРУЗКА И ОТОБРАЖЕНИЕ ТАБЛИЦЫ  =====

async function loadTable() {
  showLoadingState();

  // Собираем параметры запроса
  const params = new URLSearchParams();

  if (sortState.column) {
    params.set('sort', sortState.column);
    params.set('dir', sortState.dir);
  }

  // Добавляем все активные фильтры
  Object.entries(filterState).forEach(([col, val]) => {
    params.set(`filter_${col}`, val);
  });

  //Параметр, который позволит отобразить только пользовательские девайсы
  params.set('filter_user_nickname', currentUser);

  try {
    const response = await fetch(
      `http://localhost:3000/api/devices?${params}`,
      { method: 'GET' }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const rows = await response.json();
    renderTable(rows);
  } catch (err) {
    showErrorState();
    console.error('Ошибка загрузки устройств:', err);
  }
}

function showLoadingState() {
  document.getElementById('devices-body').innerHTML =
    `<tr><td colspan="3">
      <div class="table-state">
        <div class="spinner"></div>
        Загрузка…
      </div>
    </td></tr>`;
}

function showErrorState() {
  document.getElementById('devices-body').innerHTML =
    `<tr><td colspan="3">
      <div class="table-state">
        Не удалось загрузить устройства. Проверьте подключение к серверу.
      </div>
    </td></tr>`;
}

function renderTable(rows) {
  const tbody = document.getElementById('devices-body');

  if (!rows.length) {
    tbody.innerHTML =
      `<tr><td colspan="3">
        <div class="table-state">
          Нет зарегистрированных устройств или данных для отображения
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(row => `
    <tr>
      <!-- Кнопки действий — дизайн аналогичен ctrl-btn из таблицы портов -->
      <td>
        <div class="row-actions">
          <button class="ctrl-btn row-btn-delete" onclick="deleteDevice(${row.device_id})" title="Удалить">🗑</button>
          <button class="ctrl-btn row-btn-edit" onclick="editDevice(${row.device_id})" title="Редактировать">✎</button>
        </div>
      </td>
      <td>${esc(row.device_id)}</td>
      <td>${esc(row.device_name)}</td>
    </tr>
  `).join('');
}

// Экранирование HTML — защита от XSS
function esc(val) {
  if (val == null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


// ===== МОДАЛЬНОЕ ОКНО УСТРОЙСТВА =====

// Режим работы модалки: 'add' или 'edit'
let deviceModalMode = 'add';
// ID редактируемого устройства
let deviceEditId = null;

function openDeviceModal(mode, id = null, currentName = '') {
  deviceModalMode = mode;
  deviceEditId = id;

  const title = document.getElementById('device-modal-title');
  const confirm = document.getElementById('device-modal-confirm');
  const input = document.getElementById('device-name-input');

  if (mode === 'edit') {
    title.textContent = 'Редактировать устройство';
    confirm.textContent = 'Сохранить';
    input.value = currentName;
  } else {
    title.textContent = 'Добавить устройство';
    confirm.textContent = 'Добавить';
    input.value = '';
  }

  document.getElementById('device-modal').classList.remove('hidden');
  input.focus();
}

function closeDeviceModal() {
  document.getElementById('device-modal').classList.add('hidden');
  deviceModalMode = 'add';
  deviceEditId = null;
}

// Клик по фону оверлея
function handleDeviceOverlayClick(e) {
  if (e.target === document.getElementById('device-modal')) {
    closeDeviceModal();
  }
}

// ESC и Enter на поле ввода устройства
document.getElementById('device-name-input').addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDeviceModal();
  if (e.key === 'Enter')  submitDevice();
});

async function submitDevice() {
  const name = document.getElementById('device-name-input').value.trim();

  if (name === null || name === '') {
    document.getElementById('device-name-input').focus();
    return alert('Введите название устройства');
  }

  const confirmBtn = document.getElementById('device-modal-confirm');
  confirmBtn.disabled = true;
  confirmBtn.textContent = deviceModalMode === 'edit' ? 'Сохранение…' : 'Добавление…';

  try {
    let response;

    if (deviceModalMode === 'edit') {
      response = await fetch(
        `http://localhost:3000/api/devices/${deviceEditId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname: currentUser, device_name: name }),
        }
      );
    } else {
      response = await fetch(
        'http://localhost:3000/api/devices',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname: currentUser, device_name: name }),
        }
      );
    }

    const data = await response.json();

    if (response.ok) {
      closeDeviceModal();
      loadTable();
    } else {
      alert(`Ошибка: ${data.error || 'Неизвестная ошибка'}`);
      confirmBtn.disabled = false;
      confirmBtn.textContent = deviceModalMode === 'edit' ? 'Сохранить' : 'Добавить';
    }
  } catch (err) {
    alert('Не удалось подключиться к серверу');
    console.error('Ошибка сохранения устройства:', err);
    confirmBtn.disabled = false;
    confirmBtn.textContent = deviceModalMode === 'edit' ? 'Сохранить' : 'Добавить';
  }
}


// ===== ДЕЙСТВИЯ СО СТРОКАМИ =====

function addDevice() {
  openDeviceModal('add');
}

async function deleteDevice(id) {
  if (!confirm(`Удалить устройство #${id}?\n\nЭто действие необратимо.`)) return;

  try {
    const response = await fetch(
      `http://localhost:3000/api/devices/${id}`,
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
    console.error('Ошибка удаления устройства:', err);
  }
}

function editDevice(id, currentName) {
  openDeviceModal('edit', id, currentName);
}

// ===== СТАРТ =====
if (document.getElementById('devices-body')) {
  loadTable();
};;
