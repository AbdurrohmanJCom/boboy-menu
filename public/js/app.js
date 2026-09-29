/* BOBOY touch menu — kiosk front end (no frameworks) */
(() => {
  'use strict';

  const IDLE_MS = 45_000;          // back to the splash after 60 s without touches
  const POLL_MS = 45_000;          // check the admin for menu changes every minute
  const LANGS = [
    { code: 'uz',  label: "O'zb" },
    { code: 'uzc', label: 'Ўзб' },
    { code: 'ru',  label: 'Рус' },
    { code: 'en',  label: 'Eng' },
  ];
  const FALLBACK = { uz: ['uz', 'uzc', 'ru', 'en'], uzc: ['uzc', 'uz', 'ru', 'en'], ru: ['ru', 'uz', 'en', 'uzc'], en: ['en', 'ru', 'uz', 'uzc'] };

  const T = {
    tagline: { uz: "Quyoshli O'zbekistonning haqiqiy ta'mi", uzc: 'Қуёшли Ўзбекистоннинг ҳақиқий таъми', ru: 'Настоящий вкус солнечного Узбекистана', en: 'The true taste of sunny Uzbekistan' },
    tap:     { uz: "Menyuni ko'rish uchun ekranga teging", uzc: 'Менюни кўриш учун экранга тегинг', ru: 'Коснитесь экрана, чтобы открыть меню', en: 'Touch the screen to see the menu' },
    service: { uz: 'Xizmat haqi 0%', uzc: 'Хизмат ҳақи 0%', ru: '0% за обслуживание', en: '0% service charge' },
    menu:    { uz: 'Menyu', uzc: 'Меню', ru: 'Меню', en: 'Menu' },
    cur:     { uz: "so'm", uzc: 'сўм', ru: 'сум', en: 'UZS' },
    single:  { uz: 'Single', uzc: 'Сингл', ru: 'Сингл', en: 'Single' },
    double:  { uz: 'Double', uzc: 'Дабл', ru: 'Дабл', en: 'Double' },
    items:   { uz: (n) => `${n} ta`, uzc: (n) => `${n} та`, ru: (n) => `${n} ${plural(n, 'позиция', 'позиции', 'позиций')}`, en: (n) => `${n} item${n === 1 ? '' : 's'}` },
    empty:   { uz: 'Tez orada', uzc: 'Тез орада', ru: 'Скоро появится', en: 'Coming soon' },
    offline: { uz: "Internet yo'q — saqlangan menyu", uzc: 'Интернет йўқ — сақланган меню', ru: 'Нет интернета — показано сохранённое меню', en: 'Offline — showing saved menu' },
    sale:    { uz: 'Chegirma', uzc: 'Чегирма', ru: 'Скидка', en: 'Sale' },
  };

  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function plural(n, one, few, many) { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; }

  // ---------------------------------------------------------------- state
  const store = {
    get lang() { try { return localStorage.getItem('boboy_lang') || 'uz'; } catch { return 'uz'; } },
    set lang(v) { try { localStorage.setItem('boboy_lang', v); } catch {} },
  };
  let lang = LANGS.some((l) => l.code === store.lang) ? store.lang : 'uz';
  let menu = { version: null, categories: [], items: [] };
  let route = { view: 'splash' };        // splash | home | cat(id) | dish(id, cat)
  const tr = (obj) => { if (!obj) return ''; for (const l of FALLBACK[lang]) if (obj[l]) return obj[l]; return ''; };
  const t = (key, ...a) => { const v = T[key][lang] ?? T[key].ru; return typeof v === 'function' ? v(...a) : v; };
  const money = (n) => Number(n).toLocaleString('ru-RU').replace(/ |,/g, ' ');

  // ---------------------------------------------------------------- data
  async function loadMenu() {
    if (window.__MENU__) { menu = window.__MENU__; return; }   // static preview build
    try {
      const r = await fetch('/api/menu', { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      menu = await r.json();
      $('#offline').hidden = true;
      try { localStorage.setItem('boboy_menu', JSON.stringify(menu)); } catch {}
    } catch {
      try { const saved = JSON.parse(localStorage.getItem('boboy_menu') || 'null'); if (saved && !menu.version) menu = saved; } catch {}
      if (menu.items.length) { $('#offline').textContent = t('offline'); $('#offline').hidden = false; }
    }
  }
  async function poll() {
    if (window.__MENU__) return;
    try {
      const r = await fetch('/api/version', { cache: 'no-store' });
      const { version } = await r.json();
      $('#offline').hidden = true;
      if (version !== menu.version) { await loadMenu(); renderAll(); }
    } catch {}
  }
  const itemsOf = (catId) => menu.items.filter((i) => i.category_id === catId);
  const coverOf = (cat) => cat.photo || (itemsOf(cat.id).find((i) => i.photo) || {}).photo || null;

  // ---------------------------------------------------------------- rendering
  function imgOrPlaceholder(src, alt) {
    return src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`
               : `<div class="ph"><img src="img/brand/logo.png" alt=""></div>`;
  }

  function priceHTML(it) {
    const cur = `<span class="price__cur">${esc(t('cur'))}</span>`;
    const one = (now, old, label) => `<span class="price__v">${label ? `<span class="price__lbl">${esc(label)}</span>` : ''}` +
      (old ? `<span class="price__old">${money(old)}</span>` : '') + `<span class="price__now">${money(now)}</span>${cur}</span>`;
    if (it.price2 != null) return `<div class="price">${one(it.price, it.old_price, t('single'))}${one(it.price2, it.old_price2, t('double'))}</div>`;
    return `<div class="price">${one(it.price, it.old_price)}</div>`;
  }

  function renderStatic() {
    document.documentElement.lang = lang === 'uzc' ? 'uz-Cyrl' : lang;
    document.querySelectorAll('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t); });
    document.querySelectorAll('[data-lang-switch]').forEach((box) => {
      box.innerHTML = '';
      const wrap = el('div', 'lang');
      for (const l of LANGS) {
        const b = el('button', null, esc(l.label));
        b.setAttribute('aria-pressed', String(l.code === lang));
        b.addEventListener('click', (e) => { e.stopPropagation(); setLang(l.code); });
        wrap.appendChild(b);
      }
      box.appendChild(wrap);
    });
  }

  function renderHome() {
    const grid = $('#catGrid');
    grid.innerHTML = '';
    menu.categories.forEach((c, i) => {
      const n = itemsOf(c.id).length;
      const card = el('button', 'cat-card');
      card.style.animationDelay = `${Math.min(i, 12) * 45}ms`;
      card.innerHTML = `<div class="cat-card__img">${imgOrPlaceholder(coverOf(c), tr(c.name))}</div>
        <div class="cat-card__name">${esc(tr(c.name))}</div>
        <div class="cat-card__count">${esc(n ? t('items', n) : t('empty'))}</div>`;
      card.addEventListener('click', () => go({ view: 'cat', id: c.id }));
      grid.appendChild(card);
    });
  }

  function renderCat(keepScroll) {
    const cat = menu.categories.find((c) => c.id === route.id);
    if (!cat) return go({ view: 'home' });
    $('#topTitle').textContent = tr(cat.name);

    const pills = $('#pills');
    pills.innerHTML = '';
    for (const c of menu.categories) {
      const p = el('button', 'pill', esc(tr(c.name)));
      if (c.id === cat.id) p.setAttribute('aria-current', 'true');
      p.addEventListener('click', () => go({ view: 'cat', id: c.id }));
      pills.appendChild(p);
    }
    const active = pills.querySelector('[aria-current]');
    if (active) requestAnimationFrame(() => active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: keepScroll ? 'auto' : 'smooth' }));

    const list = $('#dishList');
    list.innerHTML = '';
    const items = itemsOf(cat.id);
    if (!items.length) list.appendChild(el('div', 'empty', esc(t('empty'))));
    items.forEach((it, i) => {
      const row = el('button', 'dish-row');
      row.style.animationDelay = `${Math.min(i, 10) * 40}ms`;
      const sale = it.old_price ? `<span class="badge">${esc(t('sale'))}</span>` : '';
      row.innerHTML = `<div class="dish-row__img">${imgOrPlaceholder(it.photo, tr(it.name))}</div>
        <div class="dish-row__body">
          <div class="dish-row__name">${esc(tr(it.name))}${sale}</div>
          ${tr(it.description) ? `<div class="dish-row__desc">${esc(tr(it.description))}</div>` : ''}
          ${priceHTML(it)}
        </div>`;
      row.addEventListener('click', () => openDish(it.id));
      list.appendChild(row);
    });
    if (!keepScroll) $('#viewCat').scrollTop = 0;
  }

  function renderDish() {
    const it = menu.items.find((i) => i.id === route.dish);
    if (!it) return closeDish();
    $('#dishMedia').innerHTML = imgOrPlaceholder(it.photo, tr(it.name));
    $('#dishName').textContent = tr(it.name);
    $('#dishPrice').innerHTML = priceHTML(it);
    $('#dishDesc').textContent = tr(it.description);
  }

  function renderAll() {
    renderStatic();
    renderHome();
    if (route.view === 'cat') renderCat(true);
    if (route.dish) renderDish();
  }

  // ---------------------------------------------------------------- navigation
  const app = $('#app'), splash = $('#splash'), dish = $('#dish');

  function show(view) {
    if (view === 'splash') {
      splash.classList.remove('is-leaving');
      splash.classList.add('is-active');
      app.classList.remove('is-active');
      return;
    }
    app.dataset.view = view;
    if (!app.classList.contains('is-active')) {
      splash.classList.add('is-leaving');
      app.classList.add('is-active');
      setTimeout(() => splash.classList.remove('is-active'), 250);
    }
  }

  function go(r) {
    route = r;
    if (r.view === 'cat') renderCat(false);
    show(r.view);
    closeDish(true);
  }

  function openDish(id) {
    route.dish = id;
    renderDish();
    dish.scrollTop = 0;
    $('.dish__scroll').scrollTop = 0;
    dish.classList.add('is-open');
    dish.setAttribute('aria-hidden', 'false');
  }
  function closeDish(silent) {
    delete route.dish;
    dish.classList.remove('is-open');
    dish.setAttribute('aria-hidden', 'true');
  }

  function setLang(code) {
    lang = code;
    store.lang = code;              // the next guest sees the same language
    renderAll();
  }

  function resetToSplash() {
    closeDish();
    route = { view: 'splash' };
    $('#viewHome').scrollTop = 0;
    show('splash');
    poll();
  }

  // ---------------------------------------------------------------- events
  splash.addEventListener('click', () => go({ view: 'home' }));
  $('#backBtn').addEventListener('click', () => go({ view: 'home' }));
  $('#brandBtn').addEventListener('click', resetToSplash);
  $('#dishBack').addEventListener('click', () => closeDish());

  // swipe left/right on the dish list to move between categories
  (() => {
    let x0 = 0, y0 = 0, t0 = 0, tracking = false;
    const v = $('#viewCat');
    v.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); tracking = !e.target.closest('.pills'); }, { passive: true });
    v.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (Date.now() - t0 < 600 && Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.8) {
        const idx = menu.categories.findIndex((c) => c.id === route.id);
        const next = menu.categories[idx + (dx < 0 ? 1 : -1)];
        if (next) go({ view: 'cat', id: next.id });
      }
    }, { passive: true });
  })();

  // idle → splash
  let idleTimer;
  const bump = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (route.view !== 'splash' || route.dish) resetToSplash(); }, IDLE_MS);
  };
  ['pointerdown', 'touchstart', 'wheel', 'keydown', 'scroll'].forEach((ev) => document.addEventListener(ev, bump, { passive: true, capture: true }));

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // ---------------------------------------------------------------- start
  renderStatic();
  loadMenu().then(() => { renderAll(); bump(); });
  setInterval(poll, POLL_MS);
  window.addEventListener('online', poll);

  if (!window.__MENU__ && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
})();
