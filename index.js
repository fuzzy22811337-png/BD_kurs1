// ===== АВТОРИЗАЦИЯ =====

const currentUser = localStorage.getItem('user');
if (!currentUser) {
  window.location.href = 'auth.html';
}

if (currentUser === 'admin' && !window.location.pathname.includes('admin-')) {
  window.location.href = 'admin-ports.html';
}

document.getElementById('account-nickname').textContent = currentUser;
document.getElementById('info-nickname').textContent = currentUser;

// Данные профиля — хранятся для предзаполнения формы редактирования
let currentUserData = { nickname: currentUser, tele: '', fio: '' };

// Загружаем данные пользователя
(async () => {
  try {
    const response = await fetch(
      `http://localhost:3000/api/user/${encodeURIComponent(currentUser)}`,
      { method: 'GET' }
    );

    if (response.ok) {
      const data = await response.json();
      currentUserData.tele = data.tele || '';
      currentUserData.fio  = data.fio  || '';
      document.getElementById('info-tele').textContent = data.tele || '—';
      document.getElementById('info-fio').textContent = data.fio  || '—';
    }
  } catch (err) {
    console.error('Ошибка загрузки профиля:', err);
  }
})();


// ===== НАВБАР: ПРИЛИПАНИЕ =====

const navbar = document.getElementById('navbar');
const STICK_OFFSET = 40; // кол-во пикселей прокрутки до прилипания

window.addEventListener('scroll', () => {
  if (window.scrollY > STICK_OFFSET) {
    navbar.classList.add('stuck');
  } else {
    navbar.classList.remove('stuck');
  }
}, { passive: true }); // не блокирует прокрутку


// ===== ПАНЕЛЬ АККАУНТА =====

function toggleAccountDropdown() {
  const dropdown = document.getElementById('account-dropdown');
  const btn = document.getElementById('btn-account');
  const isOpen = !dropdown.classList.contains('hidden');

  dropdown.classList.toggle('hidden', isOpen);
  btn.classList.toggle('open', !isOpen);
}

// Закрываем панель при клике вне неё
document.addEventListener('click', e => {
  const acc = document.getElementById('nav-account');
  const editModal = document.getElementById('edit-modal');
  if (!acc.contains(e.target) && !editModal?.contains(e.target)) {
    document.getElementById('account-dropdown').classList.add('hidden');
    document.getElementById('btn-account').classList.remove('open');
  }
});

function logout() {
  if (confirm('Выйти из аккаунта?')) {
    localStorage.removeItem('user');
    window.location.href = 'auth.html';
  }
}

async function deleteAccount() {
  const confirmed = confirm(
    `Удалить аккаунт «${currentUser}» ?\n\nЭТО ДЕЙСТВИЕ НЕОБРАТИМО! — ВСЕ СВЯЗАННЫЕ ДАННЫЕ УДАЛЯТСЯ.`
  );
  if (!confirmed) return;

  const btn = document.querySelector('.btn-delete');
  btn.disabled = true;
  btn.textContent = 'Удаление…';

  try {
    const response = await fetch(
      `http://localhost:3000/api/user/${encodeURIComponent(currentUser)}`,
      { method: 'DELETE' }
    );

    if (response.ok) {
      localStorage.removeItem('user');
      window.location.href = 'auth.html';
    } else {
      const data = await response.json();
      alert(`Ошибка удаления: ${data.error || 'Неизвестная ошибка'}`);
      btn.disabled = false;
      btn.textContent = 'Удалить';
    }
  } catch (err) {
    alert('Не удалось подключиться к серверу');
    console.error('Ошибка удаления аккаунта:', err);
    btn.disabled = false;
    btn.textContent = 'Удалить';
  }
}

//Редактирование аккаунта
function editAccount() {
  // Закрываем дропдаун аккаунта
  document.getElementById('account-dropdown').classList.add('hidden');
  document.getElementById('btn-account').classList.remove('open');

  // Предзаполняем поля текущими данными
  document.getElementById('edit-nickname').value = currentUserData.nickname;
  document.getElementById('edit-tele').value = currentUserData.tele;
  document.getElementById('edit-fio').value = currentUserData.fio;
  document.getElementById('edit-password').value = '';

  // Показываем модальное окно
  document.getElementById('edit-modal').classList.remove('hidden');
  document.getElementById('edit-nickname').focus();
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

// Клик по фону оверлея
function handleEditOverlayClick(e) {
  if (e.target === document.getElementById('edit-modal')) {
    closeEditModal();
  }
}

// ESC и Enter на полях редактирования
// document.getElementById('edit-nickname').forEach(input => {
//   input.addEventListener('keydown', e => {
//     if (e.key === 'Escape') closeEditModal();
//     if (e.key === 'Enter')  submitEdit();
//   });
// });

document.getElementById('edit-nickname').addEventListener('keydown', e => {
    if (e.key === 'Escape') closeEditModal();
    if (e.key === 'Enter')  submitEdit();
});

document.getElementById('edit-tele').addEventListener('keydown', e => {
    if (e.key === 'Escape') closeEditModal();
    if (e.key === 'Enter')  submitEdit();
});

document.getElementById('edit-fio').addEventListener('keydown', e => {
    if (e.key === 'Escape') closeEditModal();
    if (e.key === 'Enter')  submitEdit();
});


async function submitEdit() {
  const newNickname = document.getElementById('edit-nickname').value.trim();
  const newTele = document.getElementById('edit-tele').value.trim();
  const newFio = document.getElementById('edit-fio').value.trim();
  const newPassword = document.getElementById('edit-password').value;

  // Проверяем обязательные поля
  if (!newNickname || !newTele || !newFio) {
    alert('Никнейм, телефон и ФИО обязательны');
    return;
  }

  // Запрашиваем текущий пароль для подтверждения через prompt
  const accessPassword = prompt('Введите текущий пароль для подтверждения изменений:');
  if (accessPassword === null) return; // нажал Отмена
  if (!accessPassword.trim()) {
    alert('Пароль не может быть пустым');
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/user/${encodeURIComponent(currentUser)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newNickname, newTele, newFio, newPassword, accessPassword })
      }
    );

    const data = await response.json();

    if (response.ok) {
      closeEditModal();

      if (newNickname !== currentUser) {
        // Обновляем localStorage и перезагружаем страницу
        localStorage.setItem('user', newNickname);
        window.location.reload();
      } else {
        // Обновляем отображение без перезагрузки
        currentUserData = { nickname: newNickname, tele: newTele, fio: newFio };
        document.getElementById('account-nickname').textContent = newNickname;
        document.getElementById('info-nickname').textContent = newNickname;
        document.getElementById('info-tele').textContent = newTele || '—';
        document.getElementById('info-fio').textContent = newFio  || '—';
      }
    } else {
      alert(`Ошибка редактирования аккаунта: ${data.error || 'Неизвестная ошибка'}`);
    }
  } catch (err) {
    alert('Не удалось подключиться к серверу или телефон/никнейм заняты');
    console.error('Ошибка редактирования аккаунта:', err);
  }
}
