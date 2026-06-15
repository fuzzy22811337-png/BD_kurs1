let sortState = { column: 'nickname', dir: 'ASC' };

// Активные фильтры
let filterState = {};

// Для какого столбца открыта карточка фильтра
let currentFilterCol = null;


// ===== СОРТИРОВКА И ФИЛЬТРЫ =====

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

const colLabels = {
  nickname:     'Никнейм',
  fio:          'ФИО',
  tele:         'Телефон',
  device_name:  'Устройство',
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

  const card  = document.getElementById('filter-card');
  const input = document.getElementById('filter-input');
  const rect  = btn.getBoundingClientRect();

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
  if (!val) { closeFilter(); return; }

  filterState[currentFilterCol] = val;
  const btn = document.getElementById(`filter-${currentFilterCol}`);
  if (btn) btn.classList.add('active');

  closeFilter();
  loadTable();
}

// Закрытие карточки фильтра при клике вне неё
document.addEventListener('click', e => {
  const card = document.getElementById('filter-card');
  if (card.classList.contains('hidden')) return;
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
    params.set('dir',  sortState.dir);
  }

  Object.entries(filterState).forEach(([col, val]) => {
    params.set(`filter_${col}`, val);
  });

  try {
    const response = await fetch(
      `http://localhost:3000/api/ports?${params}`,
      { method: 'GET' }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const rows = await response.json();
    renderTable(rows);
  } catch (err) {
    showErrorState();
    console.error('Ошибка загрузки портов:', err);
  }
}

function showLoadingState() {
  document.getElementById('ports-body').innerHTML =
    `<tr><td colspan="10">
      <div class="table-state">
        <div class="spinner"></div>
        Загрузка…
      </div>
    </td></tr>`;
}

function showErrorState() {
  document.getElementById('ports-body').innerHTML =
    `<tr><td colspan="10">
      <div class="table-state">
        Не удалось загрузить данные. Проверьте подключение к серверу.
      </div>
    </td></tr>`;
}

function renderTable(rows) {
  const tbody = document.getElementById('ports-body');

  if (!rows.length) {
    tbody.innerHTML =
      `<tr><td colspan="10">
        <div class="table-state">Нет данных для отображения</div>
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
        <td>
          <div class="row-actions">
            <button class="ctrl-btn row-btn-delete" onclick="deletePort(${row.port_id})" title="Удалить">🗑</button>
            <button class="ctrl-btn row-btn-edit"   onclick="editPort(${row.port_id}, '${row.port_name}', '${row.port_description}')" title="Редактировать">✎</button>
          </div>
        </td>
        <td>${esc(row.nickname) || '<span class="empty-cell">—</span>'}</td>
        <td>${esc(row.fio) || '<span class="empty-cell">—</span>'}</td>
        <td>${esc(row.tele) || '<span class="empty-cell">—</span>'}</td>
        <td>${esc(row.device_name) || '<span class="empty-cell">—</span>'}</td>
        <td>${timeCell}</td>
        <td>${esc(row.port_id) || '<span class="empty-cell">—</span>'}</td>
        <td>${esc(row.port_name) || '<span class="empty-cell">—</span>'}</td>
        <td>${statusCell}</td>
        <td>${esc(row.port_description) || '<span class="empty-cell">—</span>'}</td>
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


// ===== МОДАЛЬНОЕ ОКНО ПОРТА =====

let portModalMode = 'add';
let portEditId    = null;

function openPortModal(mode, id = null, name = '', desc = '') {
  portModalMode = mode;
  portEditId = id;

  const title = document.getElementById('port-modal-title');
  const confirm = document.getElementById('port-modal-confirm');

  if (mode === 'edit') {
    title.textContent = 'Редактировать порт';
    confirm.textContent = 'Сохранить';
    document.getElementById('port-name-input').value = name;
    document.getElementById('port-desc-input').value = desc;

    console.log('editor');
  } else {
    title.textContent = 'Добавить порт';
    confirm.textContent = 'Добавить';
    document.getElementById('port-name-input').value = '';
    document.getElementById('port-desc-input').value = '';
  }

  document.getElementById('port-modal').classList.remove('hidden');
  document.getElementById('port-name-input').focus();
}

function closePortModal() {
  document.getElementById('port-modal').classList.add('hidden');
  portModalMode = 'add';
  portEditId    = null;
}

// Клик по фону оверлея
function handlePortOverlayClick(e) {
  if (e.target === document.getElementById('port-modal')) {
    closePortModal();
  }
}

// ESC и Enter на полях модального окна порта
['port-name-input', 'port-desc-input'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Escape') closePortModal();
    if (e.key === 'Enter')  submitPort();
  });
});

async function submitPort() {
  const port_name = document.getElementById('port-name-input').value.trim();
  const port_desc = document.getElementById('port-desc-input').value.trim();

  if (!port_name) {
    document.getElementById('port-name-input').focus();
    return alert('Порт должен иметь название');
  }

  const confirmBtn = document.getElementById('port-modal-confirm');
  confirmBtn.disabled = true;
  confirmBtn.textContent = portModalMode === 'edit' ? 'Сохранение…' : 'Добавление…';

  try {
    const body = JSON.stringify({ port_name, port_description: port_desc });

    const response = portModalMode === 'edit'
      ? await fetch(`http://localhost:3000/api/ports/manage/${portEditId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      : await fetch('http://localhost:3000/api/ports/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });

    const data = await response.json();

    if (response.ok) {
      closePortModal();
      loadTable();
    } else {
      alert(`Ошибка: ${data.error || 'Неизвестная ошибка'}`);
      confirmBtn.disabled = false;
      confirmBtn.textContent = portModalMode === 'edit' ? 'Сохранить' : 'Добавить';
    }
  } catch (err) {
    alert('Не удалось подключиться к серверу');
    console.error('Ошибка сохранения порта:', err);
    confirmBtn.disabled = false;
    confirmBtn.textContent = portModalMode === 'edit' ? 'Сохранить' : 'Добавить';
  }
}


// ===== ДЕЙСТВИЯ СО СТРОКАМИ =====

function addPort() {
  openPortModal('add');
}

async function deletePort(id) {
  if (!confirm(`Удалить порт #${id}?\n\nВсе активные брони этого порта будут также удалены.\nЭто действие необратимо.`)) return;

  try {
    const response = await fetch(
      `http://localhost:3000/api/ports/manage/${id}`,
      { method: 'DELETE' }
    );

    const data = await response.json();

    if (response.ok) {
      loadTable();
    } else {
      alert(`Ошибка удаления: ${data.error || 'Неизвестная ошибка'}`);
    }
  } catch (err) {
    alert('Не удалось подключиться к серверу');
    console.error('Ошибка удаления порта:', err);
  }
}

function editPort(id, name, desc) {
  openPortModal('edit', id, name, desc);
}


// ===== СТАРТ =====
if (document.getElementById('ports-body')) {
  loadTable();
}
