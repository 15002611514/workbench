/* =========================================================
   纪念 · 双身份工作台 —— 前端逻辑
   - 鼎天测控(老板): 财务
   - 翰亚科技(项目经理): 出差开销与补助
   - 本地存 localStorage，通过 /api/records 与服务器同步
   ========================================================= */

const LS = {
  finance: 'wb_finance',
  trips: 'wb_trips',
  opening: 'wb_opening',
  lastSync: 'wb_lastSync',
  device: 'wb_device'
};

function uid() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function load(key, def) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; }
  catch (e) { return def; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function money(n) {
  return '¥' + Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function daysBetween(a, b) {
  const d1 = new Date(a + 'T00:00:00');
  const d2 = new Date(b + 'T00:00:00');
  const diff = Math.round((d2 - d1) / 86400000);
  return diff < 0 ? 0 : diff + 1; // 含首尾
}
function nowISO() { return new Date().toISOString(); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

// 设备标识
let DEVICE = localStorage.getItem(LS.device);
if (!DEVICE) { DEVICE = uid(); localStorage.setItem(LS.device, DEVICE); }

// 状态
let finance = load(LS.finance, []);
let trips = load(LS.trips, []);
let opening = Number(load(LS.opening, 0));
let lastSync = localStorage.getItem(LS.lastSync) || '1970-01-01T00:00:00.000Z';

/* ---------------- 财务 ---------------- */
function addFinance(e) {
  e.preventDefault();
  const rec = {
    id: uid(), book: 'finance',
    date: document.getElementById('fDate').value || todayStr(),
    type: document.getElementById('fType').value,
    category: document.getElementById('fCategory').value,
    amount: parseFloat(document.getElementById('fAmount').value) || 0,
    note: document.getElementById('fNote').value.trim(),
    updatedAt: nowISO(), deleted: false
  };
  finance.push(rec);
  save(LS.finance, finance);
  document.getElementById('financeForm').reset();
  document.getElementById('fDate').value = todayStr();
  renderFinance();
  sync();
}
function renderFinance() {
  const monthSel = document.getElementById('fMonth');
  const months = [...new Set(finance.map(r => r.date.slice(0, 7)))].sort().reverse();
  if (!monthSel.dataset.filled) {
    monthSel.innerHTML = '<option value="">全部</option>' +
      months.map(m => `<option value="${m}">${m}</option>`).join('');
    monthSel.dataset.filled = '1';
  }
  const sel = monthSel.value;
  const list = finance.filter(r => !r.deleted && (!sel || r.date.slice(0, 7) === sel))
    .sort((a, b) => b.date.localeCompare(a.date));

  let income = 0, expense = 0;
  finance.forEach(r => {
    if (r.deleted) return;
    if (r.type === 'income') income += r.amount; else expense += r.amount;
  });
  document.getElementById('fIncome').textContent = money(income);
  document.getElementById('fExpense').textContent = money(expense);
  document.getElementById('fBalance').textContent = money(opening + income - expense);
  document.getElementById('fOpening').textContent = money(opening);

  const tb = document.querySelector('#financeTable tbody');
  tb.innerHTML = list.map(r => `
    <tr>
      <td>${r.date}</td>
      <td><span class="tag ${r.type}">${r.type === 'income' ? '收入' : '支出'}</span></td>
      <td>${r.category}</td>
      <td class="num" style="color:${r.type === 'income' ? 'var(--green)' : 'var(--red)'}">${money(r.amount)}</td>
      <td>${r.note || '-'}</td>
      <td><button class="del" data-del-fin="${r.id}">删除</button></td>
    </tr>`).join('');
  document.getElementById('fEmpty').style.display = list.length ? 'none' : 'block';
}

/* ---------------- 出差 ---------------- */
function addTrip(e) {
  e.preventDefault();
  const start = document.getElementById('tStart').value;
  const end = document.getElementById('tEnd').value;
  const days = daysBetween(start, end);
  const transport = parseFloat(document.getElementById('tTransport').value) || 0;
  const lodging = parseFloat(document.getElementById('tLodging').value) || 0;
  const meal = parseFloat(document.getElementById('tMeal').value) || 0;
  const other = parseFloat(document.getElementById('tOther').value) || 0;
  const rate = parseFloat(document.getElementById('tSubsidyRate').value) || 0;
  const rec = {
    id: uid(), book: 'trip',
    person: document.getElementById('tPerson').value.trim(),
    from: document.getElementById('tFrom').value.trim(),
    to: document.getElementById('tTo').value.trim(),
    start, end, days,
    transport, lodging, meal, other,
    subsidyRate: rate,
    cost: transport + lodging + meal + other,
    subsidy: days * rate,
    note: document.getElementById('tNote').value.trim(),
    updatedAt: nowISO(), deleted: false
  };
  trips.push(rec);
  save(LS.trips, trips);
  document.getElementById('tripForm').reset();
  document.getElementById('tSubsidyRate').value = 200;
  renderTrips();
  sync();
}
function renderTrips() {
  const list = trips.filter(r => !r.deleted).sort((a, b) => b.start.localeCompare(a.start));
  let days = 0, cost = 0, subsidy = 0;
  list.forEach(r => { days += r.days; cost += r.cost; subsidy += r.subsidy; });
  document.getElementById('tCount').textContent = list.length;
  document.getElementById('tDays').textContent = days;
  document.getElementById('tCost').textContent = money(cost);
  document.getElementById('tSubsidy').textContent = money(subsidy);

  const tb = document.querySelector('#tripTable tbody');
  tb.innerHTML = list.map(r => `
    <tr>
      <td>${r.person}</td>
      <td>${r.from} → ${r.to}</td>
      <td>${r.start}<br><span style="color:var(--sub);font-size:11px">${r.end}</span></td>
      <td class="num">${r.days}</td>
      <td class="num" style="color:var(--red)">${money(r.cost)}</td>
      <td class="num" style="color:var(--green)">${money(r.subsidy)}</td>
      <td><button class="del" data-del-trip="${r.id}">删除</button></td>
    </tr>`).join('');
  document.getElementById('tEmpty').style.display = list.length ? 'none' : 'block';
}

/* ---------------- 删除 ---------------- */
document.addEventListener('click', (e) => {
  const df = e.target.getAttribute('data-del-fin');
  const dt = e.target.getAttribute('data-del-trip');
  if (df) {
    const r = finance.find(x => x.id === df);
    if (r) { r.deleted = true; r.updatedAt = nowISO(); save(LS.finance, finance); renderFinance(); sync(); }
  }
  if (dt) {
    const r = trips.find(x => x.id === dt);
    if (r) { r.deleted = true; r.updatedAt = nowISO(); save(LS.trips, trips); renderTrips(); sync(); }
  }
});

/* ---------------- 期初余额 ---------------- */
document.getElementById('saveOpening').addEventListener('click', () => {
  opening = parseFloat(document.getElementById('openingInput').value) || 0;
  save(LS.opening, opening);
  renderFinance();
  sync();
});

/* ---------------- 标签切换 ---------------- */
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.mtab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('panel-finance').classList.toggle('active', tab === 'finance');
  document.getElementById('panel-trip').classList.toggle('active', tab === 'trip');
}
document.querySelectorAll('.tab, .mtab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

/* ---------------- 同步引擎 ---------------- */
async function sync() {
  const btn = document.getElementById('syncBtn');
  const status = document.getElementById('syncStatus');
  btn.classList.add('busy');
  status.textContent = '同步中…';
  try {
    // 1) 拉取服务器自 lastSync 以来的变更
    const pull = await fetch('/api/records?since=' + encodeURIComponent(lastSync));
    const pd = await pull.json();
    mergeRecords(pd.records || []);

    // 2) 推送本地自 lastSync 以来有变化的记录
    const localChanges = [...finance, ...trips].filter(r => new Date(r.updatedAt) > new Date(lastSync));
    let serverNow = pd.now;
    if (localChanges.length) {
      const push = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: localChanges })
      });
      const pusd = await push.json();
      mergeRecords(pusd.records || []);
      serverNow = pusd.now;
    }

    lastSync = serverNow;
    localStorage.setItem(LS.lastSync, lastSync);
    status.textContent = '已同步 · ' + new Date().toLocaleTimeString('zh-CN');
    document.getElementById('lastSyncText').textContent = '上次同步 ' + new Date(lastSync).toLocaleString('zh-CN');
  } catch (err) {
    status.textContent = '离线/未连接 · 本地已保存';
    document.getElementById('lastSyncText').textContent = '离线模式（本地数据保留）';
  } finally {
    btn.classList.remove('busy');
  }
}
function mergeRecords(records) {
  if (!records || !records.length) return;
  records.forEach(r => {
    if (r.book === 'finance') {
      const i = finance.findIndex(x => x.id === r.id);
      if (i < 0) finance.push(r);
      else if (new Date(r.updatedAt) >= new Date(finance[i].updatedAt)) finance[i] = r;
    } else if (r.book === 'trip') {
      const i = trips.findIndex(x => x.id === r.id);
      if (i < 0) trips.push(r);
      else if (new Date(r.updatedAt) >= new Date(trips[i].updatedAt)) trips[i] = r;
    }
  });
  save(LS.finance, finance);
  save(LS.trips, trips);
  renderFinance();
  renderTrips();
}

/* ---------------- 备份导入导出 ---------------- */
document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ finance, trips, opening, lastSync }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '工作台备份_' + todayStr() + '.json';
  a.click();
});
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (d.finance) { finance = d.finance; save(LS.finance, finance); }
      if (d.trips) { trips = d.trips; save(LS.trips, trips); }
      if (d.opening != null) { opening = d.opening; save(LS.opening, opening); }
      renderFinance(); renderTrips(); sync();
      alert('导入成功');
    } catch (err) { alert('文件格式有误'); }
  };
  reader.readAsText(file);
});

/* ---------------- 手机连接浮层 ---------------- */
function applyConnUrl(u) {
  document.getElementById('qrImg').src = '/qr?url=' + encodeURIComponent(u);
  document.getElementById('lanAddr').textContent = '手机访问：' + u;
}
function loadConnect() {
  const sel = document.getElementById('ipSelect');
  sel.innerHTML = '';
  fetch('/api/info').then(r => r.json()).then(d => {
    // 云端部署：ips 已是完整地址（如 http://公网IP:3000）
    const isCloud = !!d.cloud;
    const base = d.ips.length ? d.ips : ['localhost'];
    base.forEach(ip => {
      const full = isCloud ? ip : ('http://' + ip + ':' + d.port);
      const o = document.createElement('option');
      o.value = full;
      o.textContent = isCloud ? ip : (ip + ':' + d.port);
      sel.appendChild(o);
    });
    applyConnUrl(sel.value);
    sel.onchange = () => applyConnUrl(sel.value);
  }).catch(() => { document.getElementById('lanAddr').textContent = '无法获取地址，请检查网络'; });
}
document.getElementById('connectBtn').addEventListener('click', () => {
  loadConnect();
  document.getElementById('connectOverlay').hidden = false;
});
document.getElementById('closeConnect').addEventListener('click', () => {
  document.getElementById('connectOverlay').hidden = true;
});

/* ---------------- 初始化 ---------------- */
document.getElementById('syncBtn').addEventListener('click', sync);
document.getElementById('financeForm').addEventListener('submit', addFinance);
document.getElementById('tripForm').addEventListener('submit', addTrip);
document.getElementById('fDate').value = todayStr();
document.getElementById('tStart').value = todayStr();
document.getElementById('tEnd').value = todayStr();
document.getElementById('openingInput').value = opening || '';

renderFinance();
renderTrips();
sync(); // 启动时尝试同步

// 注册 Service Worker (PWA 离线 + 可安装到主屏幕)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
