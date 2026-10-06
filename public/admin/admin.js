/* BOBOY admin panel */
(() => {
  'use strict';
  const LANGS = [
    { code: 'uz',  tab: "O'zbek (lotin)", short: 'UZ' },
    { code: 'uzc', tab: 'Ўзбек (кирилл)', short: 'ЎЗ' },
    { code: 'ru',  tab: 'Русский', short: 'RU' },
    { code: 'en',  tab: 'English', short: 'EN' },
  ];
  const PH = { name: { uz: 'Masalan: Qo\'y go\'shti', uzc: 'Масалан: Қўй гўшти', ru: 'Например: Баранина кусковой', en: 'e.g. Lamb kebab' },
               desc: { uz: 'Taom haqida qisqacha', uzc: 'Таом ҳақида қисқача', ru: 'Коротко о блюде (необязательно)', en: 'Short description (optional)' } };

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (n == null ? '' : Number(n).toLocaleString('ru-RU').replace(/ /g, ' '));
  const digits = (v) => String(v ?? '').replace(/\D/g, '');
  const pick = (o) => (o && (o.ru || o.uz || o.en || o.uzc)) || '—';
  const ICON = {
    up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>',
  };

  let data = { categories: [], items: [] };

  // ---------------------------------------------------------------- api
  async function api(method, url, body, isForm) {
    const opt = { method, headers: {}, credentials: 'same-origin' };
    if (body && !isForm) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    if (isForm) opt.body = body;
    const r = await fetch(url, opt);
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && url !== '/api/login') { showLogin(); throw new Error('Войдите заново'); }
    if (!r.ok) throw new Error(j.error === 'wrong' ? 'Неверный пароль' : j.error === 'wait' ? 'Слишком много попыток. Подождите 5 минут.' : j.error || 'Ошибка');
    return j;
  }
  let toastT;
  function toast(msg, err) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' toast--err' : ''); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
  }

  // ---------------------------------------------------------------- auth
  function showLogin() { $('#main').hidden = true; $('#login').hidden = false; $('#loginPw').focus(); }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#loginErr').textContent = '';
    try { await api('POST', '/api/login', { password: $('#loginPw').value }); $('#loginPw').value = ''; start(); }
    catch (err) { $('#loginErr').textContent = err.message; }
  });
  $('#logoutBtn').addEventListener('click', async () => { await api('POST', '/api/logout'); showLogin(); });

  async function start() {
    const me = await fetch('/api/admin/me', { cache: 'no-store' }).then((r) => r.json());
    if (!me.authed) return showLogin();
    $('#login').hidden = true; $('#main').hidden = false;
    await reload();
  }
  async function reload() { data = await api('GET', '/api/admin/menu'); render(); }

  // ---------------------------------------------------------------- list
  function missingLangs(o) { return LANGS.filter((l) => !(o && o[l.code])).map((l) => l.short); }

  function render() {
    const q = $('#search').value.trim().toLowerCase();
    const list = $('#list'); list.innerHTML = '';
    if (!data.categories.length) list.innerHTML = '<div class="cat"><div class="empty-cat">Пока нет категорий. Нажмите «+ Категория».</div></div>';
    data.categories.forEach((c, ci) => {
      const items = data.items.filter((i) => i.category_id === c.id)
        .filter((i) => !q || Object.values(i.name || {}).some((v) => String(v).toLowerCase().includes(q)));
      if (q && !items.length) return;
      const firstPhoto = c.photo || (data.items.find((i) => i.category_id === c.id && i.photo) || {}).photo;
      const box = document.createElement('section');
      box.className = 'cat' + (c.hidden ? ' cat--hidden' : '');
      box.innerHTML = `
        <div class="cat__head">
          ${firstPhoto ? `<img class="cat__img" src="${esc(firstPhoto)}" alt="">` : '<div class="cat__img"></div>'}
          <div class="cat__name">${esc(pick(c.name))}<small>${data.items.filter((i) => i.category_id === c.id).length} блюд${c.hidden ? ' · скрыта' : ''}</small></div>
          <button class="iconbtn" data-a="cup" title="Выше" ${ci === 0 ? 'disabled' : ''}>${ICON.up}</button>
          <button class="iconbtn" data-a="cdown" title="Ниже" ${ci === data.categories.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
          <button class="iconbtn" data-a="chide" title="${c.hidden ? 'Показать в меню' : 'Скрыть из меню'}">${c.hidden ? ICON.eyeOff : ICON.eye}</button>
          <button class="iconbtn" data-a="cedit" title="Изменить категорию">${ICON.edit}</button>
        </div>
        <div class="cat__items"></div>
        <div class="cat__add"><button class="btn btn--ghost" data-a="add">+ Добавить блюдо в «${esc(pick(c.name))}»</button></div>`;
      box.querySelector('[data-a=cup]').onclick = () => moveCat(ci, -1);
      box.querySelector('[data-a=cdown]').onclick = () => moveCat(ci, 1);
      box.querySelector('[data-a=chide]').onclick = () => saveCatQuick(c, { hidden: !c.hidden });
      box.querySelector('[data-a=cedit]').onclick = () => openCat(c);
      box.querySelector('[data-a=add]').onclick = () => openItem(null, c.id);

      const wrap = box.querySelector('.cat__items');
      if (!items.length) wrap.innerHTML = '<div class="empty-cat">В этой категории пока нет блюд.</div>';
      items.forEach((it, ii) => {
        const row = document.createElement('div');
        row.className = 'item' + (it.hidden ? ' item--hidden' : '');
        const miss = missingLangs(it.name);
        const prices = it.price2 != null
          ? `<span class="item__price">${money(it.price)} / ${money(it.price2)}</span>${it.old_price ? `<span class="item__old">${money(it.old_price)} / ${money(it.old_price2)}</span>` : ''}`
          : `<span class="item__price">${money(it.price)}</span>${it.old_price ? `<span class="item__old">${money(it.old_price)}</span>` : ''}`;
        row.innerHTML = `
          ${it.photo ? `<img class="item__img" src="${esc(it.photo)}" alt="" loading="lazy">` : '<div class="item__img ph">без фото</div>'}
          <div class="item__main">
            <div class="item__name">${esc(pick(it.name))}</div>
            <div class="item__meta">${prices} сум
              ${it.discount_type ? `<span class="tag tag--sale">скидка${it.discount_type === 'percent' ? ' ' + it.discount_value + '%' : ''}</span>` : ''}
              ${it.hidden ? '<span class="tag tag--stop">стоп-лист</span>' : ''}
              ${miss.length ? `<span class="tag tag--lang" title="Не заполнены языки">нет: ${miss.join(', ')}</span>` : ''}
            </div>
          </div>
          ${q ? '' : `<button class="iconbtn" data-a="up" title="Выше" ${ii === 0 ? 'disabled' : ''}>${ICON.up}</button>
          <button class="iconbtn" data-a="down" title="Ниже" ${ii === items.length - 1 ? 'disabled' : ''}>${ICON.down}</button>`}
          <button class="iconbtn" data-a="hide" title="${it.hidden ? 'Вернуть в меню' : 'В стоп-лист (скрыть)'}">${it.hidden ? ICON.eyeOff : ICON.eye}</button>`;
        row.onclick = (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a;
          if (a === 'up' || a === 'down') return moveItem(items, ii, a === 'up' ? -1 : 1);
          if (a === 'hide') return toggleItem(it);
          openItem(it);
        };
        wrap.appendChild(row);
      });
      list.appendChild(box);
    });
    if (q && !list.children.length) list.innerHTML = '<div class="cat"><div class="empty-cat">Ничего не найдено.</div></div>';
  }
  $('#search').addEventListener('input', render);

  async function moveCat(i, d) {
    const ids = data.categories.map((c) => c.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    await api('POST', '/api/admin/categories/reorder', { ids }); await reload();
  }
  async function moveItem(items, i, d) {
    const ids = items.map((x) => x.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    await api('POST', '/api/admin/items/reorder', { ids }); await reload();
  }
  async function toggleItem(it) {
    try { await api('PATCH', `/api/admin/items/${it.id}`, { hidden: !it.hidden }); toast(it.hidden ? 'Блюдо снова в меню' : 'Блюдо скрыто (стоп-лист)'); await reload(); }
    catch (e) { toast(e.message, true); }
  }
  async function saveCatQuick(c, patch) {
    try { await api('PUT', `/api/admin/categories/${c.id}`, patch); toast(patch.hidden ? 'Категория скрыта' : 'Категория показана'); await reload(); }
    catch (e) { toast(e.message, true); }
  }

  // ---------------------------------------------------------------- editor
  const ed = { mode: null, id: null, photo: null, lang: 'ru', disc: '' };

  function buildLangUI(withDesc) {
    const tabs = $('#langTabs'), panes = $('#langPanes');
    tabs.innerHTML = ''; panes.innerHTML = '';
    for (const l of LANGS) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.lang = l.code;
      b.innerHTML = `${esc(l.tab)}<span class="dot"></span>`;
      b.onclick = () => selectLang(l.code);
      tabs.appendChild(b);
      const p = document.createElement('div');
      p.className = 'pane'; p.dataset.lang = l.code; p.hidden = true;
      p.innerHTML = `
        <label class="field"><span>Название — ${esc(l.tab)}</span><input data-f="name" maxlength="120" placeholder="${esc(ed.mode === 'cat' ? '' : PH.name[l.code])}"></label>
        ${withDesc ? `<label class="field"><span>Описание — ${esc(l.tab)}</span><textarea data-f="desc" maxlength="400" placeholder="${esc(PH.desc[l.code])}"></textarea></label>` : ''}`;
      p.addEventListener('input', updateDots);
      panes.appendChild(p);
    }
  }
  function selectLang(code) {
    ed.lang = code;
    document.querySelectorAll('#langTabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.lang === code)));
    document.querySelectorAll('#langPanes .pane').forEach((p) => (p.hidden = p.dataset.lang !== code));
    const inp = $(`#langPanes .pane[data-lang="${code}"] input`); if (inp && window.innerWidth > 600) inp.focus();
  }
  function updateDots() {
    for (const l of LANGS) {
      const filled = !!$(`#langPanes .pane[data-lang="${l.code}"] [data-f=name]`).value.trim();
      const dot = $(`#langTabs button[data-lang="${l.code}"] .dot`); dot.classList.toggle('on', filled);
    }
  }
  function readLang(field) {
    const o = {}; for (const l of LANGS) { const n = $(`#langPanes .pane[data-lang="${l.code}"] [data-f=${field}]`); o[l.code] = n ? n.value.trim() : ''; }
    return o;
  }
  function fillLang(field, obj) {
    for (const l of LANGS) { const n = $(`#langPanes .pane[data-lang="${l.code}"] [data-f=${field}]`); if (n) n.value = (obj && obj[l.code]) || ''; }
  }

  function setPhoto(file, url) {
    ed.photo = file || null;
    $('#photoPreview').innerHTML = url ? `<img src="${esc(url)}" alt="">` : 'Нет фото';
    $('#photoRemove').hidden = !url;
    $('#photoBtnText').textContent = url ? 'Заменить фото' : 'Загрузить фото';
  }

  function openModal(title) {
    $('#modalTitle').textContent = title;
    $('#formErr').textContent = '';
    $('#confirm').hidden = true;
    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() { $('#modal').hidden = true; document.body.style.overflow = ''; }
  document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeModal));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

  function openItem(it, catId) {
    if (!data.categories.length) return toast('Сначала создайте категорию', true);
    ed.mode = 'item'; ed.id = it ? it.id : null;
    buildLangUI(true);
    fillLang('name', it?.name); fillLang('desc', it?.description);
    selectLang('ru'); updateDots();
    $('#itemFields').hidden = false;
    $('#photoHint').textContent = 'Фото необязательно. Лучше горизонтальное, блюдо по центру.';
    $('#fCategory').innerHTML = data.categories.map((c) => `<option value="${c.id}">${esc(pick(c.name))}</option>`).join('');
    $('#fCategory').value = it ? it.category_id : (catId || data.categories[0].id);
    $('#fPrice').value = it ? money(it.base_price) : '';
    $('#fPrice2').value = it?.base_price2 != null ? money(it.base_price2) : '';
    $('#fTwoPrices').checked = it?.base_price2 != null;
    setDisc(it?.discount_type || '');
    $('#fDiscPct').value = it?.discount_type === 'percent' ? it.discount_value : '';
    $('#fDiscPrice').value = it?.discount_type === 'price' ? money(it.discount_value) : '';
    $('#fDiscPrice2').value = it?.discount_type === 'price' && it.discount_value2 != null ? money(it.discount_value2) : '';
    $('#fHidden').checked = !!it?.hidden;
    $('#hiddenLabel').textContent = 'Скрыть из меню (стоп-лист)';
    setPhoto(it?.photo_file, it?.photo);
    $('#deleteBtn').hidden = !it;
    syncPriceUI();
    openModal(it ? 'Изменить блюдо' : 'Новое блюдо');
  }

  function openCat(c) {
    ed.mode = 'cat'; ed.id = c ? c.id : null;
    buildLangUI(false);
    fillLang('name', c?.name);
    selectLang('ru'); updateDots();
    $('#itemFields').hidden = true;
    $('#photoHint').textContent = 'Обложка категории. Если не загрузить — возьмётся фото первого блюда.';
    $('#fHidden').checked = !!c?.hidden;
    $('#hiddenLabel').textContent = 'Скрыть категорию из меню';
    setPhoto(c?.photo_file, c?.photo);
    $('#deleteBtn').hidden = !c;
    openModal(c ? 'Изменить категорию' : 'Новая категория');
  }
  $('#addItemBtn').onclick = () => openItem(null);
  $('#addCatBtn').onclick = () => openCat(null);

  // prices & discount UI
  function setDisc(v) {
    ed.disc = v;
    document.querySelectorAll('#discSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    $('#discPercent').hidden = v !== 'percent';
    $('#discPrice').hidden = v !== 'price';
    syncPriceUI();
  }
  document.querySelectorAll('#discSeg button').forEach((b) => (b.onclick = () => setDisc(b.dataset.v)));
  function syncPriceUI() {
    const two = $('#fTwoPrices').checked;
    $('#price2Wrap').hidden = !two;
    $('#priceLabel').textContent = two ? 'Цена «Сингл», сум' : 'Цена, сум';
    $('#discPrice2Wrap').hidden = !two;
    $('#discPriceLabel').textContent = two ? 'Новая цена «Сингл», сум' : 'Новая цена, сум';
    const pct = Number(digits($('#fDiscPct').value));
    const p = Number(digits($('#fPrice').value)), p2 = Number(digits($('#fPrice2').value));
    const calc = (x) => Math.round((x * (100 - pct)) / 100 / 1000) * 1000;
    $('#discPreview').textContent = pct > 0 && pct < 100 && p ? `Будет: ${money(calc(p))}${two && p2 ? ' / ' + money(calc(p2)) : ''} сум` : '';
  }
  ['#fTwoPrices', '#fPrice', '#fPrice2', '#fDiscPct'].forEach((s) => $(s).addEventListener('input', syncPriceUI));
  // pretty-print money while typing
  ['#fPrice', '#fPrice2', '#fDiscPrice', '#fDiscPrice2'].forEach((s) => $(s).addEventListener('blur', (e) => { const d = digits(e.target.value); e.target.value = d ? money(d) : ''; }));

  // photo upload (shrunk in the browser first)
  function shrink(file, max = 1600) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось обработать фото'))), 'image/jpeg', 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Это не похоже на фото')); };
      img.src = url;
    });
  }
  $('#photoInput').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    $('#photoPreview').textContent = 'Загрузка…';
    try {
      const blob = await shrink(f);
      const fd = new FormData(); fd.append('photo', blob, 'photo.jpg');
      const r = await api('POST', '/api/admin/upload', fd, true);
      setPhoto(r.file, r.url);
    } catch (err) { setPhoto(ed.photo, null); $('#formErr').textContent = err.message; }
  });
  $('#photoRemove').onclick = () => setPhoto(null, null);

  // save
  $('#editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#formErr').textContent = '';
    const name = readLang('name');
    if (!LANGS.some((l) => name[l.code])) { $('#formErr').textContent = 'Заполните название хотя бы на одном языке.'; selectLang('ru'); return; }
    $('#saveBtn').disabled = true;
    try {
      if (ed.mode === 'cat') {
        const body = { name, hidden: $('#fHidden').checked, photo_file: ed.photo };
        if (ed.id) await api('PUT', `/api/admin/categories/${ed.id}`, body); else await api('POST', '/api/admin/categories', body);
        toast('Категория сохранена');
      } else {
        const two = $('#fTwoPrices').checked;
        const body = {
          name, description: readLang('desc'), category_id: Number($('#fCategory').value), photo_file: ed.photo,
          price: digits($('#fPrice').value), price2: two ? digits($('#fPrice2').value) : '',
          discount_type: ed.disc || null,
          discount_value: ed.disc === 'percent' ? digits($('#fDiscPct').value) : ed.disc === 'price' ? digits($('#fDiscPrice').value) : null,
          discount_value2: ed.disc === 'price' && two ? digits($('#fDiscPrice2').value) : null,
          hidden: $('#fHidden').checked,
        };
        if (two && !body.price2) throw new Error('Укажите цену «Дабл» или уберите галочку «Две цены»');
        if (ed.id) await api('PUT', `/api/admin/items/${ed.id}`, body); else await api('POST', '/api/admin/items', body);
        toast('Блюдо сохранено — на экране обновится в течение минуты');
      }
      closeModal(); await reload();
    } catch (err) { $('#formErr').textContent = err.message; }
    finally { $('#saveBtn').disabled = false; }
  });

  // delete (with in-page confirmation)
  $('#deleteBtn').onclick = () => {
    $('#confirmText').textContent = ed.mode === 'cat' ? 'Удалить эту категорию? (Только если в ней нет блюд.)' : 'Удалить это блюдо навсегда? Если нужно убрать временно — лучше поставьте «стоп-лист».';
    $('#confirm').hidden = false;
  };
  $('#confirmNo').onclick = () => ($('#confirm').hidden = true);
  $('#confirmYes').onclick = async () => {
    try {
      await api('DELETE', ed.mode === 'cat' ? `/api/admin/categories/${ed.id}` : `/api/admin/items/${ed.id}`);
      toast('Удалено'); closeModal(); await reload();
    } catch (err) { $('#confirm').hidden = true; $('#formErr').textContent = err.message; }
  };

  start();
})();
