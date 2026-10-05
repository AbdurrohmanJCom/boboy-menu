// BOBOY touch-screen menu — server
// Node.js + Express + SQLite (built-in node:sqlite). Photos are stored as files in DATA_DIR/uploads.
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { DatabaseSync } = require('node:sqlite'); // built into Node.js 22.13+ — nothing to compile

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'boboy2026';
const LANGS = ['uz', 'uzc', 'ru', 'en'];

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------------------------------------------------------------- database
const db = new DatabaseSync(path.join(DATA_DIR, 'menu.db'));
// DELETE journal mode: every change is written straight into menu.db, so the file can be committed to git as-is
db.exec('PRAGMA journal_mode = DELETE; PRAGMA foreign_keys = ON;');
// db.transaction(fn) returns a function that runs fn inside BEGIN/COMMIT
db.transaction = (fn) => (...args) => {
  db.exec('BEGIN');
  try { const r = fn(...args); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
};
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name    TEXT NOT NULL,              -- JSON {uz, uzc, ru, en}
    photo   TEXT,                       -- optional cover photo; otherwise first dish photo is used
    sort    INTEGER NOT NULL DEFAULT 0,
    hidden  INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id    INTEGER NOT NULL REFERENCES categories(id),
    name           TEXT NOT NULL,       -- JSON {uz, uzc, ru, en}
    description    TEXT,                -- JSON {uz, uzc, ru, en} or NULL
    photo          TEXT,                -- file name inside uploads/
    price          INTEGER NOT NULL,    -- UZS; "single" price when price2 is set
    price2         INTEGER,             -- UZS; "double" price (coffee), optional
    discount_type  TEXT,                -- NULL | 'percent' | 'price'
    discount_value INTEGER,             -- percent (1-99) or new price for price
    discount_value2 INTEGER,            -- new price for price2 when discount_type = 'price'
    sort           INTEGER NOT NULL DEFAULT 0,
    hidden         INTEGER NOT NULL DEFAULT 0,
    updated_at     INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER))
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
`);

// First start: load the menu prepared from the PDF + Excel.
if (db.prepare('SELECT COUNT(*) AS n FROM categories').get().n === 0) {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed', 'menu.json'), 'utf8'));
  const insCat = db.prepare('INSERT INTO categories (name, sort, photo) VALUES (?, ?, ?)');
  const insItem = db.prepare(`INSERT INTO items (category_id, name, description, photo, price, price2, sort)
                              VALUES (?, ?, ?, ?, ?, ?, ?)`);
  db.transaction(() => {
    const catIds = {};
    for (const c of seed.categories) {
      if (c.photo) fs.copyFileSync(path.join(__dirname, 'seed', 'photos', c.photo), path.join(UPLOAD_DIR, c.photo));
      catIds[c.id] = insCat.run(JSON.stringify(c.name), c.sort, c.photo || null).lastInsertRowid;
    }
    for (const it of seed.items) {
      const src = path.join(__dirname, 'seed', 'photos', it.photo);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(UPLOAD_DIR, it.photo));
      insItem.run(catIds[it.category], JSON.stringify(it.name),
        it.description ? JSON.stringify(it.description) : null, it.photo, it.price, it.price2, it.sort);
    }
  })();
  console.log(`[seed] loaded ${seed.categories.length} categories, ${seed.items.length} items`);
}

// ---------------------------------------------------------------- helpers
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
const cleanText = (obj, max) => {
  if (!obj || typeof obj !== 'object') return null;
  const out = {};
  for (const l of LANGS) out[l] = String(obj[l] ?? '').trim().slice(0, max);
  return Object.values(out).some(Boolean) ? out : null;
};
const toPrice = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Math.round(Number(String(v).replace(/\s/g, '')));
  return Number.isFinite(n) && n >= 0 && n < 100_000_000 ? n : NaN;
};

function finalPrices(row) {
  const base = [row.price, row.price2];
  let now = base.slice();
  if (row.discount_type === 'percent' && row.discount_value > 0 && row.discount_value < 100) {
    now = base.map((p) => (p == null ? null : Math.round((p * (100 - row.discount_value)) / 100 / 1000) * 1000));
  } else if (row.discount_type === 'price') {
    now = [row.discount_value ?? row.price, row.price2 == null ? null : (row.discount_value2 ?? row.price2)];
  }
  const discounted = now[0] < base[0] || (base[1] != null && now[1] < base[1]);
  return { price: now[0], price2: now[1], old_price: discounted ? base[0] : null, old_price2: discounted ? base[1] : null };
}

function itemOut(row, admin) {
  const o = {
    id: row.id, category_id: row.category_id, name: parse(row.name), description: parse(row.description),
    photo: row.photo ? `/uploads/${row.photo}?v=${row.updated_at}` : null, ...finalPrices(row),
  };
  if (admin) Object.assign(o, {
    base_price: row.price, base_price2: row.price2, discount_type: row.discount_type,
    discount_value: row.discount_value, discount_value2: row.discount_value2,
    hidden: !!row.hidden, sort: row.sort, photo_file: row.photo,
  });
  return o;
}
const catOut = (r) => ({ id: r.id, name: parse(r.name), sort: r.sort, hidden: !!r.hidden,
  photo: r.photo ? `/uploads/${r.photo}` : null, photo_file: r.photo || null });
const photoFile = (v) => {
  if (!v) return null;
  const f = path.basename(String(v));
  return fs.existsSync(path.join(UPLOAD_DIR, f)) ? f : undefined;
};

function menuVersion() {
  const r = db.prepare(`SELECT (SELECT COUNT(*) FROM items) || '-' || (SELECT IFNULL(MAX(updated_at),0) FROM items)
                        || '-' || IFNULL((SELECT value FROM settings WHERE key='cat_version'), '0') AS v`).get();
  return r.v;
}
// ---------------------------------------------------------------- photo cleanup
// A photo file is deleted once no dish and no category uses it any more.
const isUsed = (f) => !!db.prepare('SELECT 1 FROM items WHERE photo = ? UNION SELECT 1 FROM categories WHERE photo = ? LIMIT 1').get(f, f);
function removeIfUnused(file) {
  if (!file || isUsed(file)) return;
  try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(file))); } catch {}
}
// Uploads that were never saved (form closed with «Отмена») are swept after 1 hour.
const ORPHAN_AGE_MS = 60 * 60_000;
function sweepOrphans() {
  let n = 0;
  for (const f of fs.readdirSync(UPLOAD_DIR)) {
    const full = path.join(UPLOAD_DIR, f);
    try {
      if (isUsed(f) || Date.now() - fs.statSync(full).mtimeMs < ORPHAN_AGE_MS) continue;
      fs.unlinkSync(full); n++;
    } catch {}
  }
  if (n) console.log(`[cleanup] removed ${n} unused photo(s)`);
}

const bumpCats = () => db.prepare(`INSERT INTO settings (key, value) VALUES ('cat_version', ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(String(Date.now()));

// ---------------------------------------------------------------- auth (signed cookie, no extra deps)
const secretFile = path.join(DATA_DIR, '.secret');
if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'));
const SECRET = fs.readFileSync(secretFile, 'utf8').trim();
const SESSION_DAYS = 30;

const sign = (exp) => `${exp}.${crypto.createHmac('sha256', SECRET).update(String(exp) + ADMIN_PASSWORD).digest('hex')}`;
function readCookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
function isAuthed(req) {
  const tok = readCookie(req, 'boboy_admin');
  if (!tok) return false;
  const [exp] = tok.split('.');
  if (!(Number(exp) > Date.now())) return false;
  const expect = sign(exp);
  return tok.length === expect.length && crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(expect));
}
const requireAdmin = (req, res, next) => (isAuthed(req) ? next() : res.status(401).json({ error: 'auth' }));

const attempts = new Map(); // ip -> {n, until}

// ---------------------------------------------------------------- app
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));
// The host's nginx caches GET responses without no-store (ignoring cookies), which breaks login
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// Public menu (only visible categories/items)
app.get('/api/menu', (req, res) => {
  const cats = db.prepare('SELECT * FROM categories WHERE hidden = 0 ORDER BY sort, id').all();
  const items = db.prepare(`SELECT i.* FROM items i JOIN categories c ON c.id = i.category_id
                            WHERE i.hidden = 0 AND c.hidden = 0 ORDER BY i.sort, i.id`).all();
  res.json({ version: menuVersion(), categories: cats.map(catOut), items: items.map((r) => itemOut(r, false)) });
});
app.get('/api/version', (req, res) => { res.json({ version: menuVersion() }); });

// Auth
app.post('/api/login', (req, res) => {
  const ip = req.ip;
  const a = attempts.get(ip) || { n: 0, until: 0 };
  if (a.until > Date.now()) return res.status(429).json({ error: 'wait' });
  const pw = String(req.body?.password ?? '');
  const ok = pw.length === ADMIN_PASSWORD.length &&
    crypto.timingSafeEqual(Buffer.from(pw), Buffer.from(ADMIN_PASSWORD));
  if (!ok) {
    a.n += 1; if (a.n >= 5) { a.until = Date.now() + 5 * 60_000; a.n = 0; }
    attempts.set(ip, a);
    return res.status(401).json({ error: 'wrong' });
  }
  attempts.delete(ip);
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  res.set('Set-Cookie', `boboy_admin=${encodeURIComponent(sign(exp))}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${req.secure ? '; Secure' : ''}`);
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => {
  res.set('Set-Cookie', 'boboy_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.json({ ok: true });
});
app.get('/api/admin/me', (req, res) => res.json({ authed: isAuthed(req) }));

// Admin: full menu
app.get('/api/admin/menu', requireAdmin, (req, res) => {
  const cats = db.prepare('SELECT * FROM categories ORDER BY sort, id').all();
  const items = db.prepare('SELECT * FROM items ORDER BY sort, id').all();
  res.json({ categories: cats.map(catOut), items: items.map((r) => itemOut(r, true)) });
});

// Admin: photo upload (the admin page shrinks photos in the browser before sending)
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `u_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : '.jpg'}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});
app.post('/api/admin/upload', requireAdmin, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл должен быть фото (JPG, PNG или WEBP) до 8 МБ' });
  res.json({ file: req.file.filename, url: `/uploads/${req.file.filename}` });
});

function validateItem(b) {
  const name = cleanText(b.name, 120);
  if (!name || !name.ru && !name.uz) return 'Укажите название хотя бы на русском или узбекском';
  const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(Number(b.category_id));
  if (!cat) return 'Выберите категорию';
  const price = toPrice(b.price), price2 = toPrice(b.price2);
  if (price == null || Number.isNaN(price) || price === 0) return 'Укажите цену';
  if (Number.isNaN(price2)) return 'Неверная цена «Дабл»';
  let dt = b.discount_type || null, dv = null, dv2 = null;
  if (dt === 'percent') {
    dv = Math.round(Number(b.discount_value));
    if (!(dv >= 1 && dv <= 99)) return 'Скидка в процентах: от 1 до 99';
  } else if (dt === 'price') {
    dv = toPrice(b.discount_value); dv2 = price2 ? toPrice(b.discount_value2) : null;
    if (dv == null || Number.isNaN(dv) || dv >= price) return 'Новая цена со скидкой должна быть меньше обычной';
    if (price2 && (dv2 == null || Number.isNaN(dv2) || dv2 >= price2)) return 'Укажите новую цену «Дабл» меньше обычной';
  } else dt = null;
  const photo = b.photo_file ? path.basename(String(b.photo_file)) : null;
  if (photo && !fs.existsSync(path.join(UPLOAD_DIR, photo))) return 'Фото не найдено, загрузите заново';
  return { category_id: cat.id, name: JSON.stringify(name), description: cleanText(b.description, 400) ? JSON.stringify(cleanText(b.description, 400)) : null,
    photo, price, price2: price2 || null, discount_type: dt, discount_value: dv, discount_value2: dv2, hidden: b.hidden ? 1 : 0 };
}

app.post('/api/admin/items', requireAdmin, (req, res) => {
  const v = validateItem(req.body || {});
  if (typeof v === 'string') return res.status(400).json({ error: v });
  const sort = (db.prepare('SELECT IFNULL(MAX(sort), 0) + 1 AS s FROM items WHERE category_id = ?').get(v.category_id)).s;
  const r = db.prepare(`INSERT INTO items (category_id, name, description, photo, price, price2, discount_type, discount_value, discount_value2, hidden, sort, updated_at)
    VALUES (@category_id, @name, @description, @photo, @price, @price2, @discount_type, @discount_value, @discount_value2, @hidden, @sort, CAST(strftime('%s','now') AS INTEGER))`).run({ ...v, sort });
  res.json(itemOut(db.prepare('SELECT * FROM items WHERE id = ?').get(r.lastInsertRowid), true));
});

app.put('/api/admin/items/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Блюдо не найдено' });
  const v = validateItem(req.body || {});
  if (typeof v === 'string') return res.status(400).json({ error: v });
  db.prepare(`UPDATE items SET category_id=@category_id, name=@name, description=@description, photo=@photo, price=@price, price2=@price2,
    discount_type=@discount_type, discount_value=@discount_value, discount_value2=@discount_value2, hidden=@hidden,
    updated_at=MAX(updated_at + 1, CAST(strftime('%s','now') AS INTEGER))
    WHERE id=@id`).run({ ...v, id: row.id });
  if (row.photo !== v.photo) removeIfUnused(row.photo);
  res.json(itemOut(db.prepare('SELECT * FROM items WHERE id = ?').get(row.id), true));
});

// Quick toggles from the list (show/hide)
app.patch('/api/admin/items/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Блюдо не найдено' });
  if ('hidden' in (req.body || {})) {
    db.prepare(`UPDATE items SET hidden = ?, updated_at = MAX(updated_at + 1, CAST(strftime('%s','now') AS INTEGER)) WHERE id = ?`).run(req.body.hidden ? 1 : 0, row.id);
  }
  res.json(itemOut(db.prepare('SELECT * FROM items WHERE id = ?').get(row.id), true));
});

app.delete('/api/admin/items/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Блюдо не найдено' });
  db.prepare('DELETE FROM items WHERE id = ?').run(row.id);
  removeIfUnused(row.photo);
  bumpCats();
  res.json({ ok: true });
});

// Reorder: body {ids: [...]} — items of one category, or categories
app.post('/api/admin/items/reorder', requireAdmin, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
  const st = db.prepare(`UPDATE items SET sort = ?, updated_at = MAX(updated_at + 1, CAST(strftime('%s','now') AS INTEGER)) WHERE id = ?`);
  db.transaction(() => ids.forEach((id, i) => st.run(i, id)))();
  res.json({ ok: true });
});
app.post('/api/admin/categories/reorder', requireAdmin, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
  const st = db.prepare('UPDATE categories SET sort = ? WHERE id = ?');
  db.transaction(() => ids.forEach((id, i) => st.run(i, id)))();
  bumpCats();
  res.json({ ok: true });
});

app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const name = cleanText(req.body?.name, 60);
  if (!name || !name.ru && !name.uz) return res.status(400).json({ error: 'Укажите название категории' });
  const sort = db.prepare('SELECT IFNULL(MAX(sort), 0) + 1 AS s FROM categories').get().s;
  const photo = photoFile(req.body?.photo_file);
  if (photo === undefined) return res.status(400).json({ error: 'Фото не найдено, загрузите заново' });
  const r = db.prepare('INSERT INTO categories (name, sort, hidden, photo) VALUES (?, ?, ?, ?)').run(JSON.stringify(name), sort, req.body?.hidden ? 1 : 0, photo);
  bumpCats();
  res.json(catOut(db.prepare('SELECT * FROM categories WHERE id = ?').get(r.lastInsertRowid)));
});
app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Категория не найдена' });
  const name = req.body?.name ? cleanText(req.body.name, 60) : parse(row.name);
  if (!name || !name.ru && !name.uz) return res.status(400).json({ error: 'Укажите название категории' });
  const hidden = 'hidden' in (req.body || {}) ? (req.body.hidden ? 1 : 0) : row.hidden;
  const photo = 'photo_file' in (req.body || {}) ? photoFile(req.body.photo_file) : row.photo;
  if (photo === undefined) return res.status(400).json({ error: 'Фото не найдено, загрузите заново' });
  db.prepare('UPDATE categories SET name = ?, hidden = ?, photo = ? WHERE id = ?').run(JSON.stringify(name), hidden, photo, row.id);
  if (row.photo !== photo) removeIfUnused(row.photo);
  bumpCats();
  res.json(catOut(db.prepare('SELECT * FROM categories WHERE id = ?').get(row.id)));
});
app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const n = db.prepare('SELECT COUNT(*) AS n FROM items WHERE category_id = ?').get(id).n;
  if (n > 0) return res.status(400).json({ error: `В категории ${n} блюд. Сначала перенесите или удалите их.` });
  const cat = db.prepare('SELECT photo FROM categories WHERE id = ?').get(id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  removeIfUnused(cat?.photo);
  bumpCats();
  res.json({ ok: true });
});

// Static files
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));
app.get(['/admin', '/admin/'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, p) => {
    if (/\.(html|js|css|webmanifest)$/.test(p) || p.endsWith('sw.js')) res.set('Cache-Control', 'no-cache');
    else res.set('Cache-Control', 'public, max-age=604800');
  },
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.code === 'LIMIT_FILE_SIZE' ? 400 : 500).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Фото больше 8 МБ' : 'Ошибка сервера' });
});

sweepOrphans();
setInterval(sweepOrphans, ORPHAN_AGE_MS).unref();

app.listen(PORT, () => {
  console.log(`BOBOY menu:  http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  if (!process.env.ADMIN_PASSWORD) console.warn('!! ADMIN_PASSWORD not set — using the default password. Set it before going live.');
});
