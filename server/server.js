// 纪念 · 双身份工作台 —— 同步服务器
// 同时托管前端页面 (public/) 和提供 /api/records 同步接口。
// 存储：设置了 DATABASE_URL 时使用 PostgreSQL（云端持久化）；否则用本地 JSON 文件。
// 按 updatedAt 做"后写覆盖"合并。

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'records.json');
const USE_PG = !!process.env.DATABASE_URL;

// ---- 本地 JSON 存储（始终初始化，作为无 DB 时的回退）----
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
let jsonStore = { records: {} };
if (fs.existsSync(DATA_FILE)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (parsed && parsed.records) jsonStore = parsed;
  } catch (e) {
    console.error('读取本地数据失败，将使用空数据：', e.message);
  }
}
function saveJson() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(jsonStore));
  fs.renameSync(tmp, DATA_FILE);
}

// ---- PostgreSQL 存储 ----
let pool = null;
let pgOk = false;
if (USE_PG) {
  try {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  } catch (e) {
    console.error('初始化 PostgreSQL 失败，将回退到本地文件：', e.message);
    pool = null;
  }
}

// 统一读取/写入接口（根据 pgOk 自动选择后端）
async function getAllRecords() {
  if (pgOk && pool) {
    const r = await pool.query('SELECT data FROM records');
    return r.rows.map((x) => x.data);
  }
  return Object.values(jsonStore.records);
}
async function getCount() {
  if (pgOk && pool) {
    const r = await pool.query('SELECT COUNT(*)::int AS c FROM records');
    return r.rows[0].c;
  }
  return Object.keys(jsonStore.records).length;
}
async function upsertRecords(incoming) {
  const returned = [];
  if (pgOk && pool) {
    for (const rec of incoming) {
      if (!rec || !rec.id) continue;
      const ex = await pool.query('SELECT data FROM records WHERE id=$1', [rec.id]);
      const existing = ex.rows[0] ? ex.rows[0].data : null;
      if (!existing || new Date(rec.updatedAt) > new Date(existing.updatedAt)) {
        await pool.query(
          'INSERT INTO records(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2',
          [rec.id, rec]
        );
        returned.push(rec);
      } else {
        returned.push(existing);
      }
    }
    return returned;
  }
  for (const rec of incoming) {
    if (!rec || !rec.id) continue;
    const ex = jsonStore.records[rec.id];
    if (!ex || new Date(rec.updatedAt) > new Date(ex.updatedAt)) {
      jsonStore.records[rec.id] = rec;
      returned.push(rec);
    } else {
      returned.push(ex);
    }
  }
  saveJson();
  return returned;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon'
};

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ---- 同步接口 ----
  if (pathname === '/api/records' && req.method === 'GET') {
    const since = parsed.query.since ? new Date(parsed.query.since) : new Date(0);
    const all = await getAllRecords();
    const out = all
      .filter((r) => new Date(r.updatedAt) > since)
      .map((r) => (typeof r === 'string' ? JSON.parse(r) : r));
    return send(res, 200, JSON.stringify({ now: new Date().toISOString(), records: out }));
  }

  if (pathname === '/api/records' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      let incoming = [];
      try {
        incoming = (JSON.parse(body).records) || [];
      } catch (e) {
        return send(res, 400, JSON.stringify({ error: 'bad json' }));
      }
      try {
        const returned = await upsertRecords(incoming);
        return send(res, 200, JSON.stringify({ now: new Date().toISOString(), records: returned }));
      } catch (e) {
        return send(res, 500, JSON.stringify({ error: 'upsert failed', detail: e.message }));
      }
    });
    return;
  }

  if (pathname === '/api/status' && req.method === 'GET') {
    const c = await getCount();
    return send(res, 200, JSON.stringify({ ok: true, count: c, storage: pgOk ? 'postgres' : 'json' }));
  }

  // 返回可访问地址，方便手机连接
  // 云端部署时设 PUBLIC_URL（公网 IP 或域名），手机扫码直达公网地址
  if (pathname === '/api/info' && req.method === 'GET') {
    const publicUrl = process.env.PUBLIC_URL;
    if (publicUrl) {
      return send(res, 200, JSON.stringify({
        port: PORT, ips: [publicUrl], url: publicUrl, cloud: true
      }));
    }
    const ifaces = os.networkInterfaces();
    const ips = [];
    for (const k in ifaces) {
      for (const a of ifaces[k]) {
        if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254')) {
          ips.push(a.address);
        }
      }
    }
    const rank = (ip) => (ip.startsWith('192.168.') || ip.startsWith('10.')) ? 0
      : ip.startsWith('172.') ? 1 : 2;
    ips.sort((a, b) => rank(a) - rank(b));
    const urlStr = 'http://' + (ips[0] || 'localhost') + ':' + PORT;
    return send(res, 200, JSON.stringify({ port: PORT, ips, url: urlStr }));
  }

  // 生成二维码（手机扫码直达）
  if (pathname === '/qr' && req.method === 'GET') {
    const u = parsed.query.url || ('http://localhost:' + PORT);
    QRCode.toBuffer(u).then((buf) => {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
      res.end(buf);
    }).catch(() => send(res, 500, 'qr error', 'text/plain'));
    return;
  }

  // ---- 静态文件 ----
  let filePath = path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname);
  filePath = path.normalize(filePath);
  if (!filePath.startsWith(PUBLIC)) {
    return send(res, 403, 'forbidden', 'text/plain; charset=utf-8');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'not found', 'text/plain; charset=utf-8');
    const ext = path.extname(filePath);
    send(res, 200, data, MIME[ext] || 'application/octet-stream');
  });
});

// 启动：若使用 Postgres，先建表并测试连通
async function start() {
  if (USE_PG && pool) {
    try {
      await pool.query('SELECT 1');
      await pool.query('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, data JSONB)');
      pgOk = true;
      console.log('PostgreSQL 连接成功，使用数据库存储。');
    } catch (e) {
      console.error('PostgreSQL 不可用，回退到本地文件存储：', e.message);
      pgOk = false;
    }
  } else {
    console.log('未配置 DATABASE_URL，使用本地 JSON 文件存储。');
  }
  server.listen(PORT, '0.0.0.0', () => {
    console.log('===================================');
    console.log(' 纪念 · 双身份工作台 已启动');
    console.log(' 本机访问:   http://localhost:' + PORT);
    console.log(' 手机访问:   http://<本机局域网IP>:' + PORT);
    console.log(' 云端部署:   绑定 0.0.0.0:' + PORT);
    console.log(' 存储后端:   ' + (pgOk ? 'PostgreSQL' : '本地 JSON 文件'));
    console.log('===================================');
  });
}
start();
