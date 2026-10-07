module.exports = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>机器人控制面板</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: #f0f2f5; color: #333; }
.layout { display: flex; height: 100vh; }

/* 侧边栏 */
.sidebar { width: 240px; background: #001529; color: #fff; display: flex; flex-direction: column; }
.sidebar-header { padding: 20px; border-bottom: 1px solid #1f3a5c; }
.sidebar-header h1 { font-size: 18px; font-weight: 600; }
.sidebar-header .robot-name { font-size: 13px; color: #8ab4d8; margin-top: 4px; cursor: pointer; }
.sidebar-header .robot-name:hover { color: #fff; }
.sidebar-menu { flex: 1; padding: 12px 0; }
.menu-item { padding: 12px 24px; cursor: pointer; font-size: 14px; color: #a9bdd4; transition: all .2s; }
.menu-item:hover { background: #1890ff22; color: #fff; }
.menu-item.active { background: #1890ff; color: #fff; }
.sidebar-footer { padding: 16px; border-top: 1px solid #1f3a5c; font-size: 12px; color: #8ab4d8; }
.sidebar-footer > div { margin-bottom: 4px; }
.status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
.status-dot.on { background: #52c41a; box-shadow: 0 0 4px #52c41a; }
.status-dot.off { background: #ff4d4f; }

/* 主内容 */
.main { flex: 1; overflow: auto; padding: 20px; }
.page-title { font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #1a1a1a; display: flex; align-items: center; gap: 12px; }
.page-title .sub { font-size: 13px; color: #999; font-weight: normal; }
.card { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.card-title { font-size: 15px; font-weight: 600; margin-bottom: 14px; color: #1a1a1a; display: flex; align-items: center; justify-content: space-between; }

/* 状态卡片网格 */
.status-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
.status-card { background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.status-card .label { font-size: 13px; color: #666; margin-bottom: 8px; }
.status-card .value { font-size: 22px; font-weight: 600; }
.status-card .value.ok { color: #52c41a; }
.status-card .value.err { color: #ff4d4f; }

.mini-btn { padding: 2px 8px; font-size: 11px; border: 1px solid #d9d9d9; background: #fff; border-radius: 3px; cursor: pointer; color: #666; }
.mini-btn:hover { border-color: #1890ff; color: #1890ff; }

/* 表单 */
.form-row { display: flex; align-items: center; margin-bottom: 14px; }
.form-row label { width: 140px; font-size: 14px; color: #555; flex-shrink: 0; }
.form-row input[type=text], .form-row input[type=number], .form-row select, .form-row input[type=password] {
  flex: 1; padding: 7px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 14px; outline: none;
}
.form-row input:focus { border-color: #1890ff; }
.form-row .switch-wrap { display: flex; align-items: center; gap: 8px; }
.form-row .tip { font-size: 12px; color: #999; margin-left: 8px; }
.switch { width: 40px; height: 22px; background: #ccc; border-radius: 11px; position: relative; cursor: pointer; transition: .2s; }
.switch.on { background: #1890ff; }
.switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: .2s; }
.switch.on::after { left: 20px; }

button {
  padding: 7px 18px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;
  background: #1890ff; color: #fff; transition: .2s;
}
button:hover { background: #40a9ff; }
button.secondary { background: #f0f0f0; color: #333; }
button.secondary:hover { background: #e0e0e0; }
button.danger { background: #ff4d4f; }
button.danger:hover { background: #ff7875; }
button.small { padding: 4px 12px; font-size: 12px; }

/* 消息列表 */
.toolbar { display: flex; gap: 10px; margin-bottom: 14px; align-items: center; flex-wrap: wrap; }
.toolbar select, .toolbar input {
  padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px;
}
.toolbar .spacer { flex: 1; }
.msg-list { max-height: calc(100vh - 320px); overflow-y: auto; padding: 8px 0; }
.msg-item { margin-bottom: 10px; padding: 10px 12px; border-radius: 6px; background: #f5f7fa; border-left: 3px solid #999; }
.msg-item.in { border-left-color: #1890ff; background: #e6f4ff; }
.msg-item.out { border-left-color: #52c41a; background: #f0f9eb; }
.msg-item .msg-header { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #666; margin-bottom: 4px; flex-wrap: wrap; }
.msg-item .msg-tag { padding: 1px 6px; border-radius: 3px; font-size: 11px; background: #ddd; color: #555; }
.msg-item.in .msg-tag { background: #91d5ff; color: #003a8c; }
.msg-item.out .msg-tag { background: #b7eb8f; color: #135200; }
.msg-item .msg-group { font-weight: 500; color: #333; }
.msg-item .msg-from { color: #888; }
.msg-item .msg-time { margin-left: auto; color: #aaa; }
.msg-item .msg-content { font-size: 14px; line-height: 1.6; word-break: break-all; }
.msg-item .msg-content img { max-width: 200px; max-height: 200px; border-radius: 4px; cursor: pointer; }
.msg-item.withdrawn { opacity: 0.5; }
.msg-item.withdrawn .msg-content { text-decoration: line-through; color: #999; }

/* 发送区 */
.send-area { display: flex; gap: 8px; margin-top: 12px; }
.send-area textarea {
  flex: 1; padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 4px;
  font-size: 14px; resize: none; height: 60px; outline: none; font-family: inherit;
}
.send-area textarea:focus { border-color: #1890ff; }
.send-area .actions { display: flex; flex-direction: column; gap: 6px; }

/* 日志 */
.log-list { max-height: calc(100vh - 200px); overflow-y: auto; font-family: 'SF Mono', Menlo, monospace; font-size: 12px; }
.log-line { padding: 3px 6px; border-radius: 3px; margin-bottom: 2px; white-space: pre-wrap; word-break: break-all; }
.log-line .time { color: #999; margin-right: 8px; }
.log-line .tag { color: #1890ff; margin-right: 8px; }
.log-line.error { background: #fff1f0; color: #cf1322; }
.log-line.error .tag { color: #cf1322; }
.log-line.warn { background: #fffbe6; color: #d48806; }
.log-line.warn .tag { color: #d48806; }

/* 群列表 */
.group-tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.group-tab {
  padding: 8px 16px; background: #fff; border-radius: 6px; cursor: pointer;
  border: 1px solid #e8e8e8; font-size: 14px; transition: .2s;
}
.group-tab:hover { border-color: #1890ff; color: #1890ff; }
.group-tab.active { background: #1890ff; color: #fff; border-color: #1890ff; }

.member-row {
  display: flex; align-items: center; padding: 10px 12px; border-radius: 6px; margin-bottom: 6px;
  background: #f8f9fa; gap: 12px;
}
.member-row:hover { background: #eef3ff; }
.member-avatar { width: 40px; height: 40px; border-radius: 50%; background: #ddd; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #fff; flex-shrink: 0; overflow: hidden; }
.member-avatar img { width: 100%; height: 100%; object-fit: cover; }
.member-info { flex: 1; min-width: 0; }
.member-name { font-size: 14px; font-weight: 500; color: #333; }
.member-id { font-size: 12px; color: #999; margin-top: 2px; }
.member-role { font-size: 11px; padding: 1px 6px; border-radius: 3px; background: #ff976a; color: #fff; margin-left: 6px; }

/* 绑定群管理 */
.bind-section { display: flex; gap: 20px; }
.bind-col { flex: 1; background: #fafafa; border-radius: 6px; padding: 16px; }
.bind-col h4 { margin-bottom: 12px; font-size: 14px; color: #333; }
.bind-item {
  display: flex; align-items: center; padding: 8px 10px; background: #fff;
  border-radius: 4px; margin-bottom: 6px; cursor: pointer; transition: .2s;
}
.bind-item:hover { background: #eef3ff; }
.bind-item .name { flex: 1; font-size: 13px; }
.bind-item .gid { font-size: 11px; color: #999; }

/* 弹窗 */
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: 8px; width: 420px; max-width: 90vw; padding: 24px; }
.modal h3 { margin-bottom: 16px; font-size: 16px; }
.modal .form-row label { width: 100px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }

/* 文件选择按钮伪装 */
.file-btn {
  padding: 7px 14px; border: 1px solid #d9d9d9; border-radius: 4px; cursor: pointer;
  font-size: 13px; background: #fafafa; display: inline-block;
}
.file-btn:hover { border-color: #1890ff; color: #1890ff; }

/* 搜索框 */
.search-box { width: 200px; }
</style>
</head>
<body>
<div class="layout">
  <div class="sidebar">
    <div class="sidebar-header">
      <h1>🤖 机器人控制台</h1>
      <div class="robot-name" onclick="showRobotSwitcher()" id="robotName">加载中... <span style="font-size:11px">▼ 切换</span></div>
    </div>
    <div class="sidebar-menu">
      <div class="menu-item active" data-page="messages">💬 消息监控</div>
      <div class="menu-item" data-page="members">👥 群成员</div>
      <div class="menu-item" data-page="groups">🔗 群绑定</div>
      <div class="menu-item" data-page="config">⚙️ 配置管理</div>
      <div class="menu-item" data-page="logs">📋 运行日志</div>
    </div>
    <div class="sidebar-footer">
      <div><span class="status-dot" id="robotDot"></span>轻聊: <span id="robotStatus">未连接</span> <button id="reconnectBtn" class="mini-btn" style="display:none;margin-left:6px" onclick="doReconnect()">重连</button></div>
      <div><span class="status-dot" id="bizDot"></span>业务WS: <span id="bizStatus">未连接</span></div>
    </div>
  </div>

  <div class="main">
    <!-- 消息监控 -->
    <div class="page" id="page-messages">
      <div class="page-title">消息监控 <span class="sub" id="msgSubtitle"></span></div>
      <div class="status-grid">
        <div class="status-card">
          <div class="label">收到消息</div>
          <div class="value" id="countIn">0</div>
        </div>
        <div class="status-card">
          <div class="label">发出消息</div>
          <div class="value" id="countOut">0</div>
        </div>
        <div class="status-card">
          <div class="label">监控群数</div>
          <div class="value" id="countGroups">0</div>
        </div>
        <div class="status-card">
          <div class="label">消息转发</div>
          <div class="value" id="forwardStatus">-</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">消息列表</div>
        <div class="toolbar">
          <select id="filterDir">
            <option value="">全部消息</option>
            <option value="in">收到的</option>
            <option value="out">发出的</option>
          </select>
          <select id="filterGroup">
            <option value="">全部群</option>
          </select>
          <input type="text" id="filterKw" placeholder="搜索内容/昵称..." class="search-box">
          <div class="spacer"></div>
          <button class="secondary" onclick="clearMessages()">清空</button>
        </div>
        <div class="msg-list" id="msgList"></div>
        <div class="send-area">
          <select id="sendGroup" style="width:140px"></select>
          <textarea id="sendText" placeholder="输入消息内容... (Ctrl+Enter发送)"></textarea>
          <div class="actions">
            <button onclick="doSendText()">发送</button>
            <button class="secondary" onclick="doSendImage()">发图片</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 群成员 -->
    <div class="page" id="page-members" style="display:none">
      <div class="page-title">群成员 <span class="sub">点击"玩家入库"可手动添加到外部系统</span></div>
      <div class="card">
        <div class="card-title">
          <span>选择群聊</span>
          <span style="font-size:12px;color:#999;font-weight:normal" id="memberCount"></span>
        </div>
        <div class="group-tabs" id="memberGroupTabs"></div>
        <div style="margin-bottom:12px">
          <input type="text" id="memberSearch" placeholder="搜索昵称/ID..." style="padding:7px 12px;border:1px solid #d9d9d9;border-radius:4px;width:240px;font-size:13px">
          <button class="secondary small" style="margin-left:8px" onclick="addAllMembers()">全部入库</button>
        </div>
        <div id="memberList" style="max-height:calc(100vh - 340px);overflow-y:auto"></div>
      </div>
    </div>

    <!-- 群绑定 -->
    <div class="page" id="page-groups" style="display:none">
      <div class="page-title">群绑定管理</div>
      <div class="card">
        <div class="bind-section">
          <div class="bind-col">
            <h4>📌 已绑定群聊</h4>
            <div id="boundGroups"></div>
          </div>
          <div class="bind-col">
            <h4>🔍 可绑定群聊</h4>
            <div style="margin-bottom:10px">
              <input type="text" id="groupSearch" placeholder="搜索群..." style="padding:6px 10px;border:1px solid #d9d9d9;border-radius:4px;width:100%;font-size:13px">
            </div>
            <div id="availableGroups"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 配置管理 -->
    <div class="page" id="page-config" style="display:none">
      <div class="page-title">配置管理</div>
      <div class="card">
        <div class="card-title">轻聊服务器</div>
        <div class="form-row">
          <label>服务器地址</label>
          <input type="text" id="cfg-serverUrl">
        </div>
        <div class="form-row">
          <label>API Key</label>
          <input type="password" id="cfg-apiKey">
        </div>
        <div class="form-row">
          <label>控制面板端口</label>
          <input type="number" id="cfg-panelPort">
        </div>
      </div>
      <div class="card">
        <div class="card-title">外部业务服务器</div>
        <div class="form-row">
          <label>服务器 IP</label>
          <input type="text" id="cfg-bizServerIp">
          <span class="tip">端口固定: WS 8011 / HTTP 9011</span>
        </div>
        <div class="form-row">
          <label>启用业务 WS</label>
          <div class="switch-wrap">
            <div class="switch" id="sw-enableBizWs" onclick="toggleSwitch(this)"></div>
            <span style="font-size:13px;color:#666">接收外部指令（cx/clear_bets等）</span>
          </div>
        </div>
        <div class="form-row">
          <label>启用消息转发</label>
          <div class="switch-wrap">
            <div class="switch" id="sw-enableMessageForward" onclick="toggleSwitch(this)"></div>
            <span style="font-size:13px;color:#666">群消息转发到外部 HTTP</span>
          </div>
        </div>
        <div class="form-row">
          <label>自动添加玩家</label>
          <div class="switch-wrap">
            <div class="switch" id="sw-enableAddPaochatUser" onclick="toggleSwitch(this)"></div>
            <span style="font-size:13px;color:#666">新成员入群自动调用 addpaochatuser</span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">文件夹监控</div>
        <div class="form-row">
          <label>启用监控</label>
          <div class="switch-wrap">
            <div class="switch" id="sw-enableFolderWatch" onclick="toggleSwitch(this)"></div>
          </div>
        </div>
        <div class="form-row">
          <label>监控文件夹</label>
          <input type="text" id="cfg-watchFolder" placeholder="/path/to/folder">
          <button class="secondary small" style="margin-left:8px" onclick="chooseFolder()">选择文件夹</button>
          <button class="secondary small" style="margin-left:4px" onclick="openFolder()">打开</button>
        </div>
        <div class="form-row">
          <label>图片格式</label>
          <input type="text" id="cfg-imageExtensions" placeholder=".png,.jpg,.jpeg">
        </div>
      </div>
      <div style="text-align:right">
        <button class="secondary" onclick="loadConfig()">重置</button>
        <button onclick="saveConfig()" style="margin-left:8px">保存配置</button>
      </div>
    </div>

    <!-- 运行日志 -->
    <div class="page" id="page-logs" style="display:none">
      <div class="page-title">运行日志</div>
      <div class="card">
        <div class="card-title">
          <span>实时日志</span>
          <button class="secondary small" onclick="clearLogs()">清空</button>
        </div>
        <div class="log-list" id="logList"></div>
      </div>
    </div>
  </div>
</div>

<!-- 机器人切换弹窗 -->
<div class="modal-mask" id="robotSwitcher" style="display:none">
  <div class="modal">
    <h3>切换机器人</h3>
    <div id="robotList" style="max-height:300px;overflow-y:auto"></div>
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid #eee">
      <div style="font-size:13px;color:#666;margin-bottom:8px">添加新机器人</div>
      <div class="form-row">
        <label style="width:70px">名称</label>
        <input type="text" id="newRobotName" placeholder="机器人名称">
      </div>
      <div class="form-row">
        <label style="width:70px">API Key</label>
        <input type="text" id="newRobotKey" placeholder="机器人 API Key">
      </div>
      <button class="small" onclick="addRobot()">添加</button>
    </div>
    <div class="modal-actions">
      <button class="secondary" onclick="hideRobotSwitcher()">关闭</button>
    </div>
  </div>
</div>

<script>
// ============ 页面切换 ============
document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const page = item.dataset.page;
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById('page-' + page).style.display = 'block';
    if (page === 'members') loadMembers();
    if (page === 'groups') loadBindGroups();
  });
});

function toggleSwitch(el) { el.classList.toggle('on'); }

// ============ 状态 ============
let allMessages = [];
let robotInfo = null;
let bindGroupIds = [];
let currentMemberGroup = null;
let allGroups = [];
let currentMembers = [];

function updateStatus(data) {
  const robotDot = document.getElementById('robotDot');
  const robotStatus = document.getElementById('robotStatus');
  const bizDot = document.getElementById('bizDot');
  const bizStatus = document.getElementById('bizStatus');

  if (data.robotConnected !== undefined) {
    robotDot.className = 'status-dot ' + (data.robotConnected ? 'on' : 'off');
    robotStatus.textContent = data.robotConnected ? '已连接' : '未连接';
    const reconBtn = document.getElementById('reconnectBtn');
    if (reconBtn) reconBtn.style.display = data.robotConnected ? 'none' : 'inline-block';
  }
  if (data.bizConnected !== undefined) {
    bizDot.className = 'status-dot ' + (data.bizConnected ? 'on' : 'off');
    bizStatus.textContent = data.bizConnected ? '已连接' : '未连接';
  }
}

// ============ WebSocket ============
const ws = new WebSocket('ws://' + location.host);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'init') {
    updateStatus(data);
    robotInfo = data.robotInfo;
    bindGroupIds = data.bindGroupIds || [];
    if (robotInfo) {
      document.getElementById('robotName').innerHTML = escapeHtml(robotInfo.name) + ' <span style="font-size:11px">▼ 切换</span>';
    }
    refreshGroupSelects();
  } else if (data.type === 'status') {
    updateStatus(data);
  } else if (data.type === 'robot_info') {
    robotInfo = data.info;
    bindGroupIds = data.bindGroupIds || [];
    document.getElementById('robotName').innerHTML = escapeHtml(data.info.name) + ' <span style="font-size:11px">▼ 切换</span>';
    refreshGroupSelects();
    updateStats();
  } else if (data.type === 'message') {
    allMessages.unshift(data.item);
    if (allMessages.length > 500) allMessages.pop();
    renderMessages();
    updateStats();
  } else if (data.type === 'message_withdrawn') {
    for (const m of allMessages) {
      if (m.id === data.msgId) { m.withdrawn = true; break; }
    }
    renderMessages();
  } else if (data.type === 'log') {
    addLog(data);
  }
};

// ============ 消息列表 ============
function renderMessages() {
  const dir = document.getElementById('filterDir').value;
  const grp = document.getElementById('filterGroup').value;
  const kw = document.getElementById('filterKw').value.toLowerCase();

  const list = document.getElementById('msgList');
  const items = allMessages.filter(m => {
    if (dir && m.direction !== dir) return false;
    if (grp && String(m.groupId) !== grp) return false;
    if (kw && !String(m.content || '').toLowerCase().includes(kw) && !String(m.fromNickname || '').toLowerCase().includes(kw)) return false;
    return true;
  });

  list.innerHTML = items.slice(0, 200).map(m => {
    const isImg = m.type === 2 && m.content && (m.content.startsWith('data:image') || /\\.(png|jpg|jpeg|gif|webp|bmp)(\\?|$)/i.test(m.content));
    const content = isImg ? '<img src="' + m.content + '" onclick="window.open(this.src)">' : escapeHtml(m.content || '');
    const tag = m.direction === 'in' ? '收到' : '发出';
    const time = m.time ? new Date(m.time).toLocaleString('zh-CN', { hour12: false }) : '';
    return '<div class="msg-item ' + m.direction + (m.withdrawn ? ' withdrawn' : '') + '">' +
      '<div class="msg-header">' +
        '<span class="msg-tag">' + tag + '</span>' +
        '<span class="msg-group">' + escapeHtml(m.groupName || String(m.groupId)) + '</span>' +
        '<span class="msg-from">' + escapeHtml(m.fromNickname || '') + (m.fromShortNo ? '(' + m.fromShortNo + ')' : '') + '</span>' +
        '<span class="msg-time">' + time + '</span>' +
      '</div>' +
      '<div class="msg-content">' + (m.withdrawn ? '<span style="color:#999;font-style:italic">[已撤回] </span>' : '') + content + '</div>' +
    '</div>';
  }).join('');
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function updateStats() {
  const inCount = allMessages.filter(m => m.direction === 'in').length;
  const outCount = allMessages.filter(m => m.direction === 'out').length;
  document.getElementById('countIn').textContent = inCount;
  document.getElementById('countOut').textContent = outCount;
  document.getElementById('countGroups').textContent = bindGroupIds.length;
}

function clearMessages() {
  allMessages = [];
  renderMessages();
  updateStats();
}

['filterDir', 'filterGroup', 'filterKw'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderMessages);
  document.getElementById(id).addEventListener('change', renderMessages);
});

function refreshGroupSelects() {
  if (!robotInfo?.groups) return;
  const opts = robotInfo.groups.map(g => '<option value="' + g.groupId + '">' + escapeHtml(g.groupName) + '</option>').join('');
  document.getElementById('filterGroup').innerHTML = '<option value="">全部群</option>' + opts;
  document.getElementById('sendGroup').innerHTML = opts;

  // 成员页的群 tab
  const tabs = document.getElementById('memberGroupTabs');
  tabs.innerHTML = robotInfo.groups.map((g, i) =>
    '<div class="group-tab ' + (i === 0 ? 'active' : '') + '" data-gid="' + g.groupId + '">' + escapeHtml(g.groupName) + '</div>'
  ).join('');
  tabs.querySelectorAll('.group-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.querySelectorAll('.group-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMemberGroup = tab.dataset.gid;
      loadMembers();
    });
  });
  if (robotInfo.groups.length > 0) currentMemberGroup = robotInfo.groups[0].groupId;
}

// ============ 发送消息 ============
function doSendText() {
  const text = document.getElementById('sendText').value.trim();
  const groupId = document.getElementById('sendGroup').value;
  if (!text) return;
  fetch('/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, groupId })
  });
  document.getElementById('sendText').value = '';
}

async function doSendImage() {
  let filePath;
  if (window.electronAPI?.openFileDialog) {
    filePath = await window.electronAPI.openFileDialog([
      { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }
    ]);
  } else {
    // 网页版 fallback：用自定义 prompt
    showPrompt('请输入图片的本地完整路径：', '', function(val) {
      if (!val) return;
      const groupId = document.getElementById('sendGroup').value;
      fetch('/api/send-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: val, groupId })
      });
    });
    return;
  }
  if (!filePath) return;
  const groupId = document.getElementById('sendGroup').value;
  fetch('/api/send-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, groupId })
  });
}

document.getElementById('sendText').addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') doSendText();
});

// ============ 群成员 ============
async function loadMembers() {
  if (!currentMemberGroup) return;
  try {
    const res = await fetch('/api/members?groupId=' + currentMemberGroup);
    const data = await res.json();
    currentMembers = data.list || [];
    renderMembers();
  } catch (e) {}
}

function renderMembers() {
  const kw = (document.getElementById('memberSearch')?.value || '').toLowerCase();
  const list = currentMembers.filter(m =>
    !kw || (m.nickname || '').toLowerCase().includes(kw) || (m.short_no || '').toLowerCase().includes(kw)
  );
  document.getElementById('memberCount').textContent = '共 ' + currentMembers.length + ' 人';
  document.getElementById('memberList').innerHTML = list.map(m => {
    const avatarHtml = m.avatar ? '<img src="' + m.avatar + '">' : (m.nickname || '?').charAt(0);
    const roleTag = m.role === 2 ? '<span class="member-role">群主</span>' : '';
    const idText = m.short_no ? 'ID: ' + m.short_no + ' · uid: ' + m.uid : 'uid: ' + m.uid;
    return '<div class="member-row" data-uid="' + m.uid + '">' +
      '<div class="member-avatar">' + avatarHtml + '</div>' +
      '<div class="member-info">' +
        '<div class="member-name">' + escapeHtml(m.nickname || '未知') + roleTag + '</div>' +
        '<div class="member-id">' + idText + '</div>' +
      '</div>' +
      '<button class="small btn-add-player">玩家入库</button>' +
    '</div>';
  }).join('');
}

// 事件委托：成员列表按钮
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-add-player')) {
    const row = e.target.closest('.member-row');
    if (row) addPlayer(row.dataset.uid);
  }
  if (e.target.classList.contains('btn-bind-group')) {
    const gid = parseInt(e.target.dataset.gid);
    if (gid) bindGroup(gid);
  }
  if (e.target.classList.contains('btn-unbind-group')) {
    const gid = parseInt(e.target.dataset.gid);
    if (gid) unbindGroup(gid);
  }
  if (e.target.classList.contains('btn-switch-robot')) {
    const key = e.target.dataset.key;
    if (key) switchRobot(key);
  }
  if (e.target.classList.contains('btn-setup-robot')) {
    const id = e.target.dataset.id;
    const name = e.target.dataset.name;
    setupRobot(id, name);
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'memberSearch') renderMembers();
});

async function addPlayer(uid) {
  try {
    const res = await fetch('/api/add-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: currentMemberGroup, uid })
    });
    const data = await res.json();
    if (data.code === 0) {
      alert('添加请求已发送');
    } else {
      alert('添加失败: ' + (data.message || ''));
    }
  } catch (e) {
    alert('请求失败');
  }
}

function addAllMembers() {
  showConfirm('确定要把当前群所有成员都入库吗？', async function() {
    for (const m of currentMembers) {
      if (!m.uid) continue;
      await fetch('/api/add-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: currentMemberGroup, uid: m.uid })
      });
    }
    alert('已全部发送添加请求');
  });
}

// ============ 群绑定 ============
async function loadBindGroups() {
  try {
    const res = await fetch('/api/all-groups');
    const data = await res.json();
    allGroups = data.list || [];
    renderBindGroups();
  } catch (e) {}
}

function renderBindGroups() {
  const boundIds = new Set(bindGroupIds.map(id => String(id)));
  const kw = (document.getElementById('groupSearch')?.value || '').toLowerCase();

  const bound = allGroups.filter(g => boundIds.has(String(g.id)));
  const avail = allGroups.filter(g => !boundIds.has(String(g.id)) && (!kw || (g.name || '').toLowerCase().includes(kw)));

  document.getElementById('boundGroups').innerHTML = bound.length === 0
    ? '<div style="color:#999;font-size:13px;text-align:center;padding:20px">暂无绑定群聊</div>'
    : bound.map(g =>
        '<div class="bind-item" title="点击解绑">' +
          '<span class="name">' + escapeHtml(g.name || '未命名') + '</span>' +
          '<span class="gid">ID:' + g.id + '</span>' +
          '<button class="danger small btn-unbind-group" style="margin-left:10px" data-gid="' + g.id + '">解绑</button>' +
        '</div>'
      ).join('');

  document.getElementById('availableGroups').innerHTML = avail.length === 0
    ? '<div style="color:#999;font-size:13px;text-align:center;padding:20px">没有更多群了</div>'
    : avail.map(g =>
        '<div class="bind-item" title="点击绑定">' +
          '<span class="name">' + escapeHtml(g.name || '未命名') + '</span>' +
          '<span class="gid">ID:' + g.id + '</span>' +
          '<button class="small btn-bind-group" style="margin-left:10px" data-gid="' + g.id + '">绑定</button>' +
        '</div>'
      ).join('');
}

document.addEventListener('input', (e) => {
  if (e.target.id === 'groupSearch') renderBindGroups();
});

async function bindGroup(groupId) {
  try {
    const res = await fetch('/api/bind-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId })
    });
    const data = await res.json();
    if (data.code === 0) {
      loadBindGroups();
    } else {
      alert('绑定失败: ' + (data.message || ''));
    }
  } catch (e) {}
}

function unbindGroup(groupId) {
  showConfirm('确定解绑该群吗？', async function() {
    try {
      const res = await fetch('/api/unbind-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId })
      });
      const data = await res.json();
      if (data.code === 0) {
        loadBindGroups();
      } else {
        alert('解绑失败: ' + (data.message || ''));
      }
    } catch (e) {}
  });
}

// ============ 重连 ============
async function doReconnect() {
  try {
    await fetch('/api/reconnect', { method: 'POST' });
  } catch (e) {}
}

// ============ 配置管理 ============
async function loadConfig() {
  const res = await fetch('/api/config');
  const data = await res.json();
  const c = data.config;
  document.getElementById('cfg-serverUrl').value = c.serverUrl;
  document.getElementById('cfg-apiKey').value = c.apiKey;
  document.getElementById('cfg-panelPort').value = c.panelPort;
  document.getElementById('cfg-bizServerIp').value = c.bizServerIp;
  document.getElementById('cfg-watchFolder').value = c.watchFolder;
  document.getElementById('cfg-imageExtensions').value = (c.imageExtensions || []).join(',');

  document.getElementById('forwardStatus').textContent = c.enableMessageForward ? '已启用' : '已关闭';
  document.getElementById('forwardStatus').className = 'value ' + (c.enableMessageForward ? 'ok' : '');

  setSwitch('sw-enableBizWs', c.enableBizWs);
  setSwitch('sw-enableMessageForward', c.enableMessageForward);
  setSwitch('sw-enableAddPaochatUser', c.enableAddPaochatUser);
  setSwitch('sw-enableFolderWatch', c.enableFolderWatch);
}

function setSwitch(id, val) {
  const el = document.getElementById(id);
  if (val) el.classList.add('on');
  else el.classList.remove('on');
}

function getSwitch(id) {
  return document.getElementById(id).classList.contains('on');
}

async function saveConfig() {
  const config = {
    serverUrl: document.getElementById('cfg-serverUrl').value,
    apiKey: document.getElementById('cfg-apiKey').value,
    panelPort: parseInt(document.getElementById('cfg-panelPort').value) || 7777,
    bizServerIp: document.getElementById('cfg-bizServerIp').value,
    enableBizWs: getSwitch('sw-enableBizWs'),
    enableMessageForward: getSwitch('sw-enableMessageForward'),
    enableAddPaochatUser: getSwitch('sw-enableAddPaochatUser'),
    watchFolder: document.getElementById('cfg-watchFolder').value,
    enableFolderWatch: getSwitch('sw-enableFolderWatch'),
    imageExtensions: document.getElementById('cfg-imageExtensions').value.split(',').map(s => s.trim()).filter(Boolean),
  };
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  const data = await res.json();
  if (data.code === 0) {
    alert('保存成功！连接类配置需要重启机器人生效。');
  } else {
    alert('保存失败: ' + (data.message || ''));
  }
}

async function chooseFolder() {
  // 桌面应用：调用系统文件夹选择
  if (window.electronAPI?.openDirectoryDialog) {
    const folder = await window.electronAPI.openDirectoryDialog();
    if (folder) {
      document.getElementById('cfg-watchFolder').value = folder;
    }
    return;
  }
  // 网页版：提示手动输入
  alert('网页版无法打开文件夹选择器，请手动输入路径。桌面应用可直接选择文件夹。');
}

async function openFolder() {
  const folder = document.getElementById('cfg-watchFolder').value;
  if (!folder) { alert('请先设置文件夹路径'); return; }
  // 桌面应用：用系统文件管理器打开
  if (window.electronAPI?.showInFolder) {
    await window.electronAPI.showInFolder(folder);
    return;
  }
  // 网页版
  try {
    await fetch('/api/open-folder?path=' + encodeURIComponent(folder));
  } catch (e) {}
}

// ============ 机器人切换 ============
function showRobotSwitcher() {
  loadRobotList();
  document.getElementById('robotSwitcher').style.display = 'flex';
}

function hideRobotSwitcher() {
  document.getElementById('robotSwitcher').style.display = 'none';
}

async function loadRobotList() {
  try {
    const [listRes, cfgRes] = await Promise.all([
      fetch('/api/robots'),
      fetch('/api/config')
    ]);
    const listData = await listRes.json();
    const cfgData = await cfgRes.json();
    const list = listData.list || [];
    const currentKey = cfgData.config.apiKey;

    document.getElementById('robotList').innerHTML = list.map(r => {
      const isCurrent = r.apiKey === currentKey && r.hasKey;
      const statusTag = r.status === 0 ? '<span style="font-size:11px;color:#ff976a;margin-right:6px">[停用]</span>' : '';
      let btn = '';
      if (isCurrent) {
        btn = '<span style="font-size:12px;color:#1890ff;margin-left:8px">当前登录</span>';
      } else if (r.hasKey) {
        btn = '<button class="small btn-switch-robot" style="margin-left:8px" data-key="' + r.apiKey + '">切换</button>';
      } else {
        btn = '<button class="small secondary btn-setup-robot" style="margin-left:8px" data-id="' + r.id + '" data-name="' + r.name + '">配置</button>';
      }
      return '<div class="bind-item" style="' + (isCurrent ? 'background:#eef3ff;border-color:#1890ff' : '') + '">' +
        '<span class="name">' + statusTag + escapeHtml(r.name) + '</span>' +
        '<span class="gid">ID:' + r.id + '</span>' +
        btn +
      '</div>';
    }).join('');
  } catch (e) {
    document.getElementById('robotList').innerHTML = '<div style="color:#999;font-size:13px">加载失败</div>';
  }
}

function switchRobot(apiKey) {
  showConfirm('确定切换机器人吗？将重新连接。', async function() {
    try {
      const res = await fetch('/api/switch-robot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      const data = await res.json();
      if (data.code === 0) {
        hideRobotSwitcher();
        location.reload();
      } else {
        alert('切换失败: ' + (data.message || ''));
      }
    } catch (e) {}
  });
}

function setupRobot(id, name) {
  showPrompt('请输入机器人 ' + name + ' 的 API Key：', '', async function(apiKey) {
    if (!apiKey) return;
    try {
      const res = await fetch('/api/add-robot-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, apiKey })
      });
      const data = await res.json();
      if (data.code === 0) {
        loadRobotList();
      } else {
        alert('配置失败: ' + (data.message || ''));
      }
    } catch (e) {}
  });
}

async function addRobot() {
  const name = document.getElementById('newRobotName').value.trim();
  const apiKey = document.getElementById('newRobotKey').value.trim();
  if (!name || !apiKey) { alert('请填写名称和API Key'); return; }
  try {
    const res = await fetch('/api/add-robot-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, apiKey })
    });
    const data = await res.json();
    if (data.code === 0) {
      document.getElementById('newRobotName').value = '';
      document.getElementById('newRobotKey').value = '';
      loadRobotList();
    } else {
      alert('添加失败: ' + (data.message || ''));
    }
  } catch (e) {}
}

// ============ 日志 ============
function addLog(data) {
  const list = document.getElementById('logList');
  const line = document.createElement('div');
  line.className = 'log-line ' + (data.level || '');
  line.innerHTML = '<span class="time">' + data.time + '</span><span class="tag">[' + data.tag + ']</span>' + escapeHtml(data.msg);
  list.insertBefore(line, list.firstChild);
  while (list.children.length > 500) list.removeChild(list.lastChild);
}

function clearLogs() {
  document.getElementById('logList').innerHTML = '';
}

// ============ 初始化 ============
loadConfig();
fetch('/api/messages').then(r => r.json()).then(d => {
  allMessages = d.list || [];
  renderMessages();
  updateStats();
});
  // ============ 通用弹窗（替代 alert/confirm/prompt，兼容 Electron） ============
  function showAlert(msg, onOk) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = '<div class="modal" style="max-width:400px">' +
      '<h3 style="margin-top:0">提示</h3>' +
      '<div style="font-size:14px;color:#333;margin-bottom:16px;white-space:pre-wrap">' + escapeHtml(msg) + '</div>' +
      '<div style="text-align:right"><button class="primary" id="__dlgOk">确定</button></div>' +
    '</div>';
    document.body.appendChild(mask);
    mask.querySelector('#__dlgOk').onclick = () => {
      document.body.removeChild(mask);
      onOk && onOk();
    };
  }

  function showConfirm(msg, onOk, onCancel) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = '<div class="modal" style="max-width:400px">' +
      '<h3 style="margin-top:0">确认</h3>' +
      '<div style="font-size:14px;color:#333;margin-bottom:16px;white-space:pre-wrap">' + escapeHtml(msg) + '</div>' +
      '<div style="text-align:right">' +
        '<button class="secondary" id="__dlgCancel" style="margin-right:8px">取消</button>' +
        '<button class="primary" id="__dlgOk">确定</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(mask);
    mask.querySelector('#__dlgOk').onclick = () => {
      document.body.removeChild(mask);
      onOk && onOk();
    };
    mask.querySelector('#__dlgCancel').onclick = () => {
      document.body.removeChild(mask);
      onCancel && onCancel();
    };
  }

  function showPrompt(msg, defaultText, onOk, onCancel) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = '<div class="modal" style="max-width:420px">' +
      '<h3 style="margin-top:0">输入</h3>' +
      '<div style="font-size:14px;color:#333;margin-bottom:10px">' + escapeHtml(msg) + '</div>' +
      '<input type="text" id="__dlgInput" style="width:100%;padding:8px 10px;border:1px solid #d9d9d9;border-radius:6px;font-size:14px;box-sizing:border-box;margin-bottom:16px">' +
      '<div style="text-align:right">' +
        '<button class="secondary" id="__dlgCancel" style="margin-right:8px">取消</button>' +
        '<button class="primary" id="__dlgOk">确定</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(mask);
    const input = mask.querySelector('#__dlgInput');
    input.value = defaultText || '';
    setTimeout(() => input.focus(), 50);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') mask.querySelector('#__dlgOk').click();
      if (e.key === 'Escape') mask.querySelector('#__dlgCancel').click();
    });
    mask.querySelector('#__dlgOk').onclick = () => {
      const val = input.value;
      document.body.removeChild(mask);
      onOk && onOk(val);
    };
    mask.querySelector('#__dlgCancel').onclick = () => {
      document.body.removeChild(mask);
      onCancel && onCancel();
    };
  }

  // 重写全局 alert，让已有代码直接兼容（alert 不需要返回值）
  window.alert = function(msg) { showAlert(msg); };
</script>
</body>
</html>`;
