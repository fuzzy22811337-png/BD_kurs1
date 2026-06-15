const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'BD_TR_1',
  password: '228337',
  port: 5432,
});


// ===== ВХОД =====
// POST /api/login

app.post('/api/login', async (req, res) => {
  const { nickname, password } = req.body;

  if (!nickname || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE nickname = $1',
      [nickname]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный никнейм или пароль' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Неверный никнейм или пароль' });
    }

    res.json({ nickname: user.nickname }); //просто отвечает 

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== РЕГИСТРАЦИЯ =====
// POST /api/register

app.post('/api/register', async (req, res) => {
  const { tele, fio, nickname, password } = req.body;

  if (!tele || !fio || !nickname || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }

  if (tele.replace(/\D/g, '').length < 10 || tele.replace(/\D/g, '').length > 16) {
    return res.status(400).json({ error: 'Некорректный номер телефона (длина)' });
  }

  if (/^[\p{L}\s'-]$/u.test(fio)) {
    return res.status(431).json({ error: 'ФИО может содержать только буквы из unicode, пробелы, тире и апостроф'});
  }

  if (nickname.length > 32) {
    return res.status(400).json({ error: 'Длина никнейма не может превышать 32 символа' });
  }

  if (!/^[a-zA-Z\d~!_?\^-]+$/.test(nickname)) {
    return res.status(400).json({ error: 'Никнейм может содержать только буквы, цифры и спецсимволы: ~ ! _ ? -' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Пароль должен содержать не менее 8 символов' });
  }

  if (!/^[a-zA-Z\d~#@$%&!*_?\^-]+$/.test(password)) {
    return res.status(400).json({ error: 'Пароль содержит недопустимые символы' });
  }

  if (!/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[~#@$%&!*_?\^-]).+$/.test(password)) {
    return res.status(400).json({ error: 'Пароль должен содержать букву, цифру и спецсимвол' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (tele, fio, nickname, password) VALUES ($1, $2, $3, $4)',
      [tele.replace(/\D/g, ''), fio, nickname, hashedPassword]
    );

    res.status(201).json({ message: 'Пользователь зарегистрирован' });

  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint && err.constraint.includes('nickname')) {
        return res.status(409).json({ error: 'Этот никнейм уже занят' });
      }
      if (err.constraint && err.constraint.includes('tele')) {
        return res.status(409).json({ error: 'Этот телефон уже зарегистрирован' });
      }
    }
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== ДАННЫЕ ПОЛЬЗОВАТЕЛЯ =====
// GET /api/user/:nickname

app.get('/api/user/:nickname', async (req, res) => {
  const { nickname } = req.params;

  try {
    const result = await pool.query(
      'SELECT nickname, fio, tele FROM users WHERE nickname = $1',
      [nickname]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== УДАЛЕНИЕ АККАУНТА =====
// DELETE /api/user/:nickname

app.delete('/api/user/:nickname', async (req, res) => {
  const { nickname } = req.params;

  try {
    // RETURNING id — чтобы убедиться что строка действительно была удалена
    const result = await pool.query(
      'DELETE FROM users WHERE nickname = $1 RETURNING user_id',
      [nickname]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ message: 'Аккаунт удалён' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== РЕДАКТИРОВАНИЕ АККАУНТА =====
// PUT /api/user/:nickname

app.put('/api/user/:nickname', async (req, res) => {
  const { nickname } = req.params;
  const { newNickname, newTele, newFio, newPassword, accessPassword } = req.body;

  if (!newNickname || !newTele || !newFio || !accessPassword) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }

  try {
    // 1. Проверяем текущий пароль
    const result = await pool.query('SELECT * FROM users WHERE nickname = $1', [nickname]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = result.rows[0];
    const passwordOk = await bcrypt.compare(accessPassword, user.password);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Неверный текущий пароль' });
    }

    // 2. Если новый пароль передан — хешируем, иначе оставляем старый
    let hashedPassword = user.password;
    if (newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Новый пароль должен содержать не менее 8 символов' });
      }

      if (!/^[a-zA-Z\d~#@$%&!*_?\^-]+$/.test(newPassword)) {
        return res.status(400).json({ error: 'Новый пароль содержит недопустимые символы' });
      }

      if (!/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[~#@$%&!*_?\^-]).+$/.test(newPassword)) {
        return res.status(400).json({ error: 'Новый пароль должен содержать букву, цифру и спецсимвол' });
      }

      hashedPassword = await bcrypt.hash(newPassword, 10);
    }

    // 3. Обновляем запись
    await pool.query(
      `UPDATE users SET nickname=$1, tele=$2, fio=$3, password=$4 WHERE user_id=$5`,
      [newNickname, newTele.replace(/\D/g,''), newFio, hashedPassword, user.user_id]
    );

    res.json({ message: 'Профиль обновлён', nickname: newNickname });

  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint?.includes('nickname')) {
        return res.status(409).json({ error: 'Никнейм уже занят' });
      }
      if (err.constraint?.includes('tele')) {
        return res.status(409).json({ error: 'Телефон уже зарегистрирован' });
      }
    }
    console.error(err); 
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== ТАБЛИЦА УСТРОЙСТВ =====
// GET /api/devices?sort=device_id&dir=ASC&filter_device_id=id1

app.get('/api/devices', async (req, res) => {
  // Белый список столбцов для сортировки — защита от SQL-инъекций
  const ALLOWED_SORT = {
    device_id:   'dv.dv_id',
    device_name: 'dv.name',
  };
  const ALLOWED_DIR = ['ASC', 'DESC'];

  const { sort, dir } = req.query;

  let conditions = []; // части WHERE: ['u.nickname ILIKE $1', 'u.fio ILIKE $2']
  let params = []; // значения для плейсхолдеров
  let i = 1;  // счётчик плейсхолдеров $1, $2, ...

  // 1. Фильтр по пользователю
  const userNickname = req.query['filter_user_nickname'];
  if (userNickname) {
    conditions.push(`u.nickname = $${i++}`);
    params.push(userNickname);
  }

  // 2. Фильтр по ID
  const deviceId = req.query['filter_device_id'];
  if (deviceId) {
    conditions.push(`CAST(dv.dv_id AS TEXT) ILIKE $${i++}`);
    params.push(`%${deviceId}%`);
  }

  // 3. Фильтр по названию
  const deviceName = req.query['filter_device_name'];
  if (deviceName) {
    conditions.push(`dv.name ILIKE $${i++}`);
    params.push(`%${deviceName}%`);
  }

  const whereClause = conditions.length
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  // Проверяем что sort и dir — допустимые значения из белого списка
  const safeSort = sort && ALLOWED_SORT[sort];
  const safeDir  = (dir  && ALLOWED_DIR.includes(dir.toUpperCase())) 
    ? dir.toUpperCase() 
    : false; //null
  const orderClause = (safeSort && safeDir)
    ? `ORDER BY ${safeSort} ${safeDir}`
    : '';

  const query = `
    SELECT
      dv.dv_id AS device_id,
      dv.name AS device_name
    FROM device dv

    JOIN users u 
    ON dv.user_id = u.user_id

    ${whereClause}
    ${orderClause}
  `;
  
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== ДОБАВЛЕНИЕ УСТРОЙСТВА =====
// POST /api/devices

app.post('/api/devices', async (req, res) => {
  const { nickname, device_name } = req.body;

  if (!device_name.trim()) {
    return res.status(400).json({ error: 'Введите название устройства' });
  }

  try {
    const userResult = await pool.query(
      'SELECT user_id FROM users WHERE nickname = $1',
      [nickname]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const userId = userResult.rows[0].user_id;

    await pool.query(
      'INSERT INTO device (name, user_id) VALUES ($1, $2)',
      [device_name.trim(), userId]
    );

    res.json({ message: 'Устройство добавлено' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== РЕДАКТИРОВАНИЕ УСТРОЙСТВА =====
// PUT /api/devices/:id

app.put('/api/devices/:id', async (req, res) => {
  const { id } = req.params;
  const { nickname, device_name } = req.body;

  if (!device_name || !device_name.trim()) {
    return res.status(400).json({ error: 'Введите название устройства' });
  }

  try {
    const result = await pool.query(
      `UPDATE device dv
       SET name = $1
       FROM users u
       WHERE dv.user_id = u.user_id
         AND dv.dv_id = $2
         AND u.nickname = $3
       RETURNING dv.dv_id`,
      [device_name.trim(), id, nickname]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Устройство не найдено или нет прав на редактирование' });
    }

    res.json({ message: 'Устройство обновлено' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== УДАЛЕНИЕ УСТРОЙСТВА =====
// DELETE /api/devices/:id

app.delete('/api/devices/:id', async (req, res) => {
  const { id } = req.params;
  const { nickname } = req.body;

  try {
    // Удаляем только если устройство принадлежит пользователю
    const result = await pool.query(
      `DELETE FROM device dv
       USING users u
       WHERE dv.user_id = u.user_id
         AND dv.dv_id = $1
         AND u.nickname = $2
       RETURNING dv.dv_id`,
      [id, nickname]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Устройство не найдено или нет прав на удаление' });
    }

    res.json({ message: 'Устройство удалено' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== БРОНИ ПОЛЬЗОВАТЕЛЯ =====
// GET /api/bookings?${params}

app.get('/api/bookings', async (req, res) => {
  const ALLOWED_SORT = {
    booking_id:   'booking_id',
    device_id:    'device_id',
    device_name:  'device_name',
    booking_time: 'booking_time',
    port_id:      'port_id',
    port_name:    'port_name',
  };
  const ALLOWED_DIR = ['ASC', 'DESC'];

  const { sort, dir } = req.query;

  let innerConditions = [];
  let params = [];
  let i = 1;

  const userNickname = req.query['filter_user_nickname'];
  if (userNickname) {
    innerConditions.push(`u.nickname = $${i++}`);
    params.push(userNickname);
  }

  const innerWhere = innerConditions.length
    ? 'WHERE ' + innerConditions.join(' AND ')
    : '';

  const outerFilterMap = [
    ['filter_booking_id',   `CAST(booking_id AS TEXT)`],
    ['filter_device_id',    `CAST(device_id AS TEXT)`],
    ['filter_device_name',  `device_name`],
    ['filter_booking_time', `booking_time`],
    ['filter_port_id',      `CAST(port_id AS TEXT)`],
    ['filter_port_name',    `port_name`],
  ];

  let outerConditions = [];
  for (const [param, col] of outerFilterMap) {
    const val = req.query[param];
    if (val) {
      outerConditions.push(`${col} ILIKE $${i++}`);
      params.push(`%${val}%`);
    }
  }

  const outerWhere = outerConditions.length
    ? 'WHERE ' + outerConditions.join(' AND ')
    : '';

  const safeSort = sort && ALLOWED_SORT[sort];
  const safeDir  = (dir && ALLOWED_DIR.includes(dir.toUpperCase())) 
    ? dir.toUpperCase() 
    : false;
  const orderClause = (safeSort && safeDir) 
    ? `ORDER BY ${safeSort} ${safeDir}` 
    : '';

  const query = `
    WITH base AS (
      SELECT
        bk.bk_id AS booking_id,
        dv.dv_id AS device_id,
        dv.name AS device_name,

        FORMAT(
          '%s День : %s Часов : %s Минут',
          FLOOR((bk.time - EXTRACT(EPOCH FROM NOW()))::integer / 86400),
          FLOOR(((bk.time - EXTRACT(EPOCH FROM NOW()))::integer % 86400) / 3600),
          FLOOR(((bk.time - EXTRACT(EPOCH FROM NOW()))::integer % 86400) % 3600 / 60)
        ) AS booking_time,

        bk.time AS raw_time,
        pt.pt_id AS port_id,
        pt.name AS port_name,
        pt.description AS port_description
      FROM booking bk

      JOIN device dv 
      ON bk.dv_id = dv.dv_id

      JOIN port pt 
      ON bk.pt_id = pt.pt_id

      JOIN users u 
      ON dv.user_id = u.user_id

      ${innerWhere}
    )
    SELECT 
      booking_id, 
      device_id, 
      device_name, 
      booking_time, 
      raw_time, 
      port_id, 
      port_name, 
      port_description
    FROM base
    ${outerWhere}
    ${orderClause}
  `;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== СОЗДАНИЕ БРОНИ =====
// POST /api/bookings

app.post('/api/bookings', async (req, res) => {
  const { nickname, device_id, port_id, days, hours, minutes } = req.body;

  if (!nickname || !device_id || !port_id) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }

  const totalSeconds = (parseInt(days) || 0) * 86400
                     + (parseInt(hours) || 0) * 3600
                     + (parseInt(minutes) || 0) * 60;

  if (totalSeconds <= 0) {
    return res.status(400).json({ error: 'Время бронирования должно быть больше нуля' });
  }

  try {
    const dvCheck = await pool.query(
      `SELECT dv.dv_id FROM device dv
       JOIN users u ON dv.user_id = u.user_id
       WHERE dv.dv_id = $1 AND u.nickname = $2`,
      [device_id, nickname]
    );

    if (dvCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Устройство не найдено или не принадлежит пользователю' });
    }

    const ptCheck = await pool.query(`
        SELECT pt_id 
        FROM port 
        WHERE pt_id = $1`, 
        [port_id]
    );
    if (ptCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Порт не найден' });
    }

    await pool.query(
      `INSERT INTO booking (pt_id, dv_id, time)
       VALUES ($1, $2, EXTRACT(EPOCH FROM NOW()) + $3)`,
      [port_id, device_id, totalSeconds]
    );

    res.status(201).json({ message: 'Бронь создана' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== РЕДАКТИРОВАНИЕ БРОНИ =====
// PUT /api/bookings/:id

app.put('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { nickname, device_id, port_id, days, hours, minutes } = req.body;

  if (!nickname || !device_id || !port_id) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }

  const totalSeconds = (parseInt(days) || 0) * 86400
                     + (parseInt(hours) || 0) * 3600
                     + (parseInt(minutes) || 0) * 60;

  if (totalSeconds <= 0) {
    return res.status(400).json({ error: 'Время бронирования должно быть больше нуля' });
  }

  try {
    const bkCheck = await pool.query(
      `SELECT bk.bk_id 
       FROM booking bk

       JOIN device dv 
       ON bk.dv_id = dv.dv_id

       JOIN users u 
       ON dv.user_id = u.user_id

       WHERE bk.bk_id = $1 AND u.nickname = $2`,
      [id, nickname]
    );
    if (bkCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Бронь не найдена или нет прав' });
    }

    const dvCheck = await pool.query(
      `SELECT dv.dv_id 
       FROM device dv

       JOIN users u 
       ON dv.user_id = u.user_id

       WHERE dv.dv_id = $1 AND u.nickname = $2`,
      [device_id, nickname]
    );
    if (dvCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Устройство не найдено или не принадлежит пользователю' });
    }

    const ptCheck = await pool.query(`
        SELECT pt_id 
        FROM port 
        WHERE pt_id = $1`, 
        [port_id]
    );
    if (ptCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Порт не найден' });
    }

    await pool.query(
      `UPDATE booking
       SET pt_id = $1,
           dv_id = $2,
           time  = EXTRACT(EPOCH FROM NOW()) + $3
       WHERE bk_id = $4`,
      [port_id, device_id, totalSeconds, id]
    );

    res.json({ message: 'Бронь обновлена' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== УДАЛЕНИЕ БРОНИ =====
// DELETE /api/bookings/:id

app.delete('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { nickname } = req.body;

  try {
    const result = await pool.query(
      `DELETE FROM booking bk
       USING device dv, users u
       WHERE bk.dv_id = dv.dv_id
         AND dv.user_id = u.user_id
         AND bk.bk_id = $1
         AND u.nickname = $2
       RETURNING bk.bk_id`,
      [id, nickname]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Бронь не найдена или нет прав' });
    }

    res.json({ message: 'Бронь удалена' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== ТАБЛИЦА ПОРТОВ =====
// GET /api/ports?sort=nickname&dir=ASC&filter_nickname=user1&filter_fio=Иванов

app.get('/api/ports', async (req, res) => {

  // Белый список столбцов для сортировки — защита от SQL-инъекций
  const ALLOWED_SORT = {
    nickname:    'u.nickname',
    fio:         'u.fio',
    tele:        'u.tele',
    device_name: 'dv.name',
    booking_time:'bk.time',
    port_id:     'pt.pt_id',
    port_name:   'pt.name',
    port_status: 'pt.status',
  };
  const ALLOWED_DIR = ['ASC', 'DESC'];

  const { sort, dir } = req.query;

  let conditions = []; // части WHERE: ['u.nickname ILIKE $1', 'u.fio ILIKE $2']
  let params     = []; // значения для плейсхолдеров
  let i          = 1;  // счётчик плейсхолдеров $1, $2, ...

  // Маппинг: имя query-параметра → столбец в SQL
  const filterMap = {
    filter_nickname:    'u.nickname',
    filter_fio:         'u.fio',
    filter_tele:        'u.tele',
    filter_device_name: 'dv.name',
    filter_booking_time:'bk.time',
    filter_port_id:     'pt.pt_id::TEXT',
    filter_port_name:   'pt.name',
    //filter_port_status: 'pt.status',
  };

  for (const [param, col] of Object.entries(filterMap)) {
    const val = req.query[param];
    if (val) {
      // ILIKE — поиск без учёта регистра
      // % с обеих сторон — ищем вхождение в любом месте строки
      conditions.push(`${col} ILIKE $${i++}`);
      params.push(`%${val}%`);
    }
  }

  const whereClause = conditions.length
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  // Проверяем что sort и dir — допустимые значения из белого списка
  const safeSort = sort && ALLOWED_SORT[sort];
  const safeDir  = (dir  && ALLOWED_DIR.includes(dir.toUpperCase())) 
    ? dir.toUpperCase() 
    : false; //null
  const orderClause = (safeSort && safeDir)
    ? `ORDER BY ${safeSort} ${safeDir}`
    : '';

  const query = `
    SELECT
      u.nickname AS nickname,
      u.fio AS fio,
      u.tele AS tele,
      dv.name AS device_name,

      CASE 
        WHEN bk.time IS NULL OR bk.time <= EXTRACT(EPOCH FROM NOW())
        THEN NULL
        ELSE (
          SELECT FORMAT(
            '%s День : %s Часов : %s Минут',
            FLOOR( remaining_seconds / 86400),
            FLOOR( (remaining_seconds % 86400) / 3600),
            FLOOR( (remaining_seconds % 86400) % 3600 / 60)
          )
          FROM (
            SELECT(
              bk.time -
              EXTRACT(EPOCH FROM NOW()) 
            )::integer AS remaining_seconds
          )t1
		    )
      END AS booking_time,

      pt.pt_id AS port_id,
      pt.name AS port_name,

      CASE
        WHEN bk.time IS NULL OR bk.time <= EXTRACT(EPOCH FROM NOW())
        THEN false
        ELSE true
      END AS port_status,
      
      pt.description AS port_description
    FROM port pt
    LEFT JOIN booking bk
    ON pt.pt_id = bk.pt_id

    LEFT JOIN device dv
    ON bk.dv_id = dv.dv_id

    LEFT JOIN users u
    ON dv.user_id = u.user_id
    ${whereClause}
    ${orderClause}
  `;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== ЧИСТКА ТАБЛИЦЫ ОТ НЕРЕЛЕВАНТНЫХ БРОНЕЙ =====
// DELETE /api/ports

app.delete('/api/ports', async (req, res) => {
  const { nickname } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM booking 
        WHERE time <= EXTRACT(EPOCH FROM NOW())`
    );

    res.json({ message: 'Чистка прошла успешно' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== СОЗДАНИЕ ПОРТА =====
// POST /api/ports/manage

app.post('/api/ports/manage', async (req, res) => {
  const { port_name, port_description } = req.body;

  if (!port_name || !port_name.trim()) {
    return res.status(400).json({ error: 'Введите название порта' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO port (name, description, status)
       VALUES ($1, $2, false)
       RETURNING pt_id`,
      [port_name.trim(), (port_description || '').trim()]
    );

    res.status(201).json({ message: 'Порт создан', port_id: result.rows[0].pt_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== РЕДАКТИРОВАНИЕ ПОРТА =====
// PUT /api/ports/manage/:id
// Изменяются только name и description — статус не редактируется

app.put('/api/ports/manage/:id', async (req, res) => {
  const { id } = req.params;
  const { port_name, port_description } = req.body;

  if (!port_name || !port_name.trim()) {
    return res.status(400).json({ error: 'Введите название порта' });
  }

  try {
    const result = await pool.query(
      `UPDATE port
       SET name = $1,
           description = $2
       WHERE pt_id = $3
       RETURNING pt_id`,
      [port_name.trim(), (port_description || '').trim(), id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Порт не найден' });
    }

    res.json({ message: 'Порт обновлён' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== УДАЛЕНИЕ ПОРТА =====
// DELETE /api/ports/manage/:id
// Сначала удаляет все брони порта, затем сам порт

app.delete('/api/ports/manage/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Удаляем связанные брони (FK-constraint)
    await pool.query('DELETE FROM booking WHERE pt_id = $1', [id]);

    const result = await pool.query(
      'DELETE FROM port WHERE pt_id = $1 RETURNING pt_id',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Порт не найден' });
    }

    res.json({ message: 'Порт удалён' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ===== ЗАПУСК =====
app.listen(3000, () => console.log('Сервер запущен: http://localhost:3000'));
