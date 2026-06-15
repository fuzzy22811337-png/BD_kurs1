// ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК =====

function switchTab(tab) {
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const indicator = document.getElementById('tab-indicator');

  clearMessage();

  if (tab === 'login') {
    // Показываем форму входа
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');

    const tabRect = tabLogin.getBoundingClientRect();
    const tabsRect = tabLogin.parentElement.getBoundingClientRect();
    const x = tabRect.left - tabsRect.left;

    indicator.style.transform = `translateX(${x}px)`;
    indicator.style.width = `${tabRect.width}px`
    
  } else {
    // Показываем форму регистрации
    formRegister.classList.remove('hidden');
    formLogin.classList.add('hidden');
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');

    const tabRect = tabRegister.getBoundingClientRect();
    const tabsRect = tabRegister.parentElement.getBoundingClientRect();
    const x = tabRect.left - tabsRect.left;

    indicator.style.transform = `translateX(${x}px)`;
    indicator.style.width = `${tabRect.width}px`
  }
}


// ===== ПОКАЗ СООБЩЕНИЙ =====

function showMessage(text, type) {
  const msg = document.getElementById('message');
  msg.textContent = text;

  msg.className = `message show ${type}`;
}

function clearMessage() {
  const msg = document.getElementById('message');
  msg.className = 'message';
  msg.textContent = '';
}


// ===== ОЖИДАНИЕ ЗАГРУЗКИ ОКНА =====

window.addEventListener('load', () => {
  switchTab('login');
  const tele = '+1234R2'
  console.log(tele.replace(/\D/g, ''));
});



// ===== ФОРМА ВОЙТИ =====

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();  // не перезагружаем страницу

  const nickname = document.getElementById('login-nickname').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('btn-login');

  // Блокируем кнопку пока идёт запрос
  btn.disabled = true;
  btn.textContent = 'Проверка...';

  try {
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password })
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem('user', nickname);
      window.location.href = 'index.html';
    } else {
      showMessage(data.error, 'error');
    }

  } catch (err) {
    showMessage('Не удалось подключиться к серверу или телефон/никнейм заняты', 'error');
    console.error('Ошибка подключения к серверу:', err);
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Войти';
    }, 1000);
  }
});


// ===== ФОРМА РЕГИСТРАЦИИ =====

document.getElementById('form-register').addEventListener('submit', async (e) => {
  e.preventDefault();

  const tele = document.getElementById('reg-tele').value.trim();
  const fio = document.getElementById('reg-fio').value.trim();
  const nickname = document.getElementById('reg-nickname').value.trim();
  const password = document.getElementById('reg-password').value;
  const btn = document.getElementById('btn-register');

  clearMessage();

  btn.disabled = true;
  btn.textContent = 'Регистрация...';

  try {
    const response = await fetch('http://localhost:3000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tele, fio, nickname, password })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage('Аккаунт создан!', 'success');
      setTimeout(() => {
        switchTab('login');
        // console.log(response.status)
        // Подставляем никнейм в форму входа
        document.getElementById('login-nickname').value = nickname;
      }, 1000);
    } else {
      showMessage(data.error, 'error');
    }

  } catch (err) {
    showMessage('Не удалось подключиться к серверу', 'error');
    console.error('Ошибка подключения к серверу:', err);
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Зарегистрироваться';
    }, 1000);
  }
});
