const { io } = require('socket.io-client');
const chokidar = require('chokidar');
const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('./config');
const panelPage = require('./panel-page');

// ========== 动态计算外部服务地址 ==========
const bizWsUrl = `ws://${config.bizServerIp}:8011`;
const bizHttpUrl = `http://${config.bizServerIp}:9011`;

// ========== 状态 ==========
let lightChatSocket = null;
let bizSocket = null;
let folderWatcher = null;
let shortNoToUidMap = {};
let fireReportBetsReceivedTime = null;

// 机器人从服务器拉到的配置
let robotInfo = null;
let bindGroupIds = [];

// 消息缓存（给 Web 面板用，最多存 500 条）
const messageLog = [];
const MAX_LOG = 500;

// Web 面板的 WebSocket 连接
const panelClients = new Set();

// ========== 日志（同时输出到控制台和面板） ==========
function log(level, tag, msg) {
  const time = new Date().toLocaleString('zh-CN', { hour12: false });
  const line = `[${time}] [${tag}] ${msg}`;
  console.log(line);

  // 推送到面板
  broadcastToPanel({ type: 'log', level, tag, msg, time });
}

function pushMessageLog(item) {
  messageLog.unshift(item);
  if (messageLog.length > MAX_LOG) messageLog.pop();
  broadcastToPanel({ type: 'message', item });
}

function broadcastToPanel(data) {
  const str = JSON.stringify(data);
  for (const ws of panelClients) {
    if (ws.readyState === 1) ws.send(str);
  }
}

// ========== HTTP 请求工具 ==========
function httpPost(urlPath, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, bizHttpUrl);
    const data = JSON.stringify(payload);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ========== 连接轻聊机器人 ==========
function connectLightChat() {
  log('info', 'LightChat', `连接到 ${config.serverUrl} ...`);

  lightChatSocket = io(`${config.serverUrl}/robot`, {
    auth: { api_key: config.apiKey },
    transports: ['websocket'],
  });

  lightChatSocket.on('connect', () => {
    log('info', 'LightChat', '机器人连接成功');
    broadcastToPanel({ type: 'status', robotConnected: true });
  });

  lightChatSocket.on('connect_error', (err) => {
    log('error', 'LightChat', `连接失败: ${err.message}`);
    broadcastToPanel({ type: 'status', robotConnected: false });
  });

  lightChatSocket.on('disconnect', (reason) => {
    log('warn', 'LightChat', `断开连接: ${reason}`);
    broadcastToPanel({ type: 'status', robotConnected: false });
  });

  // 收到机器人配置
  lightChatSocket.on('robot_config', (cfg) => {
    robotInfo = cfg;
    bindGroupIds = cfg.groups.map(g => g.groupId);
    log('info', 'LightChat', `机器人: ${cfg.name} (${cfg.id})`);
    log('info', 'LightChat', `绑定群: ${cfg.groups.map(g => `${g.groupId}:${g.groupName}`).join(', ') || '无'}`);
    broadcastToPanel({ type: 'robot_info', info: cfg, bindGroupIds });

    // 保存到本地机器人列表
    const robots = loadLocalRobots();
    if (!robots.find(r => r.apiKey === config.apiKey)) {
      robots.push({ id: cfg.id, name: cfg.name, apiKey: config.apiKey });
      saveLocalRobots(robots);
    }

    // 启动外部 WS
    if (config.enableBizWs && config.bizServerIp) {
      connectBizWs(bizWsUrl);
    } else {
      log('info', 'Biz', '外部业务 WebSocket 未启用');
    }

    // 启动文件夹监控
    if (config.enableFolderWatch && config.watchFolder) {
      startFolderWatch(config.watchFolder, config.imageExtensions);
    } else {
      log('info', 'Watch', '文件夹监控未启用');
    }

    log('info', 'Forward', `群消息转发: ${config.enableMessageForward ? '启用' : '关闭'}`);

    // 同步成员
    syncGroupMembers();
  });

  // 收到群消息
  lightChatSocket.on('group_message', (data) => {
    const { message, groupId } = data;

    // 维护 short_no -> uid 映射
    if (message.from_short_no && message.from_uid) {
      shortNoToUidMap[message.from_short_no] = message.from_uid;
    }

    // 记录日志
    pushMessageLog({
      id: message.id,
      direction: 'in',
      groupId,
      groupName: getGroupName(groupId),
      fromUid: message.from_uid,
      fromNickname: message.from_nickname,
      fromShortNo: message.from_short_no,
      isRobot: !!message.is_robot,
      type: message.type,
      content: message.content,
      withdrawn: false,
      time: new Date().toISOString(),
    });

    // 忽略机器人自己发的消息
    if (message.is_robot) return;

    // 判断是否在监控的群里
    if (!shouldWatchGroup(groupId)) return;

    // 转发到外部 HTTP 接口
    if (config.enableMessageForward) {
      forwardChatMessage(message, groupId);
    }
  });

  // 收到消息撤回
  lightChatSocket.on('group_message_withdraw', (data) => {
    const { message, groupId } = data;
    if (!shouldWatchGroup(groupId)) return;
    if (config.enableMessageForward) {
      forwardRecallMessage(message.id);
    }
    // 更新日志标记
    for (const m of messageLog) {
      if (m.id === message.id) { m.withdrawn = true; break; }
    }
    broadcastToPanel({ type: 'message_withdrawn', msgId: message.id });
  });

  // 有新成员加入群
  lightChatSocket.on('member_joined', async (data) => {
    const { groupId, members } = data;
    if (!shouldWatchGroup(groupId)) return;

    log('info', 'Member', `群${groupId} 新成员: ${members.map(m => m.nickname).join(', ')}`);

    for (const m of members || []) {
      if (m.short_no && m.uid) {
        shortNoToUidMap[m.short_no] = m.uid;
      }
    }

    if (config.enableAddPaochatUser) {
      for (const m of members || []) {
        if (m.uid && m.short_no) {
          await addPaochatUser(m);
        }
      }
    }
  });

  // 收到手动添加玩家指令
  lightChatSocket.on('add_player', async (data) => {
    const { groupId, player } = data;
    if (!player) return;
    log('info', 'AddPlayer', `收到添加请求: ${player.nickname} (${player.short_no})`);
    await addPaochatUser(player);
  });

  // 心跳
  lightChatSocket.on('pong', () => {});
  setInterval(() => {
    if (lightChatSocket?.connected) lightChatSocket.emit('ping');
  }, 25000);
}

function getGroupName(groupId) {
  if (!robotInfo?.groups) return String(groupId);
  const g = robotInfo.groups.find(x => x.groupId === groupId || x.groupId === parseInt(groupId));
  return g ? g.groupName : String(groupId);
}

function shouldWatchGroup(groupId) {
  if (config.watchGroupIds && config.watchGroupIds.length > 0) {
    return config.watchGroupIds.includes(groupId) || config.watchGroupIds.includes(String(groupId));
  }
  return bindGroupIds.includes(groupId) || bindGroupIds.includes(String(groupId));
}

// ========== 转发群消息 ==========
async function forwardChatMessage(message, groupId) {
  try {
    const payload = {
      wxid: message.from_short_no || '',
      nickname: message.from_nickname || '',
      att_num: message.content || '',
      msgid: String(message.id),
      uid: message.from_uid || '',
    };

    await httpPost(config.forwardChatApi, payload);
    log('info', 'Forward', `消息转发: ${message.from_nickname} -> ${(message.content || '').substring(0, 20)}`);
  } catch (err) {
    log('error', 'Forward', `消息转发失败: ${err.message}`);
  }
}

async function forwardRecallMessage(msgId) {
  try {
    await httpPost(config.forwardRecallApi, { msgid: String(msgId) });
    log('info', 'Forward', `撤回转发: msgId=${msgId}`);
  } catch (err) {
    log('error', 'Forward', `撤回转发失败: ${err.message}`);
  }
}

// ========== 添加玩家 ==========
async function addPaochatUser(user) {
  try {
    const payload = {
      paochatid: user.short_no || '',
      paochatname: user.nickname || '',
      uid: user.uid || '',
    };
    await httpPost(config.addPaochatApi, payload);
    log('info', 'AddPlayer', `添加成功: ${user.nickname} (${user.short_no})`);
    return true;
  } catch (err) {
    log('error', 'AddPlayer', `添加失败: ${err.message}`);
    return false;
  }
}

// ========== 重连轻聊机器人 ==========
function reconnectLightChat() {
  if (lightChatSocket) {
    try { lightChatSocket.disconnect(); } catch (e) {}
    lightChatSocket = null;
  }
  bindGroupIds = [];
  messageLog.length = 0;
  shortNoToUidMap = {};
  connectLightChat();
}

// ========== 获取群成员 ==========
function getGroupMembers(groupId) {
  return new Promise((resolve, reject) => {
    if (!lightChatSocket?.connected) { reject(new Error('未连接')); return; }
    lightChatSocket.emit('get_group_members', { groupId }, (res) => {
      if (res?.code === 0) resolve(res.data || []);
      else reject(new Error(res?.message || '失败'));
    });
    setTimeout(() => reject(new Error('超时')), 10000);
  });
}

async function syncGroupMembers() {
  const groups = bindGroupIds;
  for (const groupId of groups) {
    if (!shouldWatchGroup(groupId)) continue;
    try {
      const members = await getGroupMembers(groupId);
      let count = 0;
      for (const m of members) {
        if (m.short_no && m.uid) { shortNoToUidMap[m.short_no] = m.uid; count++; }
      }
      log('info', 'Sync', `群${groupId} 成员同步: ${count} 个`);
    } catch (err) {
      log('error', 'Sync', `群${groupId} 同步失败: ${err.message}`);
    }
  }
}

// ========== 发送消息到轻聊群 ==========
function sendTextMessage(text, mentionUids = null, groupId = null) {
  if (!lightChatSocket?.connected) {
    log('warn', 'LightChat', '未连接，无法发送');
    return;
  }
  if (!text || text.length === 0) return;

  // 指定了群就发指定群，否则发所有绑定群
  const targetGroups = groupId ? [groupId] : bindGroupIds;
  if (!targetGroups || targetGroups.length === 0) {
    log('warn', 'LightChat', '没有绑定的群');
    return;
  }

  for (const targetGroup of targetGroups) {
    lightChatSocket.emit(
      'send_group_msg',
      { groupId: targetGroup, type: 1, content: text, mentionUids: mentionUids || [] },
      (res) => {
        if (res?.code === 0) {
          pushMessageLog({
            id: res.data.id,
            direction: 'out',
            groupId: targetGroup,
            groupName: getGroupName(targetGroup),
            fromUid: `robot:${robotInfo?.id}`,
            fromNickname: robotInfo?.name || '机器人',
            isRobot: true,
            type: 1,
            content: text,
            withdrawn: false,
            time: new Date().toISOString(),
          });
          log('info', 'Send', `[群${targetGroup}] 文本: ${text.substring(0, 30)}`);
        } else {
          log('error', 'Send', `[群${targetGroup}] 发送失败: ${res?.message}`);
        }
      }
    );
  }
}

async function sendImageMessage(filePath, groupId = null) {
  if (!lightChatSocket?.connected) return;
  const targetGroups = groupId ? [groupId] : bindGroupIds;
  if (!targetGroups || targetGroups.length === 0) return;

  try {
    const imageBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mime = ext === 'jpg' ? 'jpeg' : ext;

    let imageUrl = '';

    // 如果配置了 OSS，直接上传 OSS
    const ossConfig = config.oss;
    if (ossConfig && ossConfig.accessKeyId && ossConfig.bucket) {
      try {
        const OSS = require('ali-oss');
        const client = new OSS({
          region: ossConfig.region || 'oss-cn-guangzhou',
          accessKeyId: ossConfig.accessKeyId,
          accessKeySecret: ossConfig.accessKeySecret,
          bucket: ossConfig.bucket,
          secure: true,
        });
        const prefix = ossConfig.prefix || 'chat';
        const filename = `${prefix}/robot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const result = await client.put(filename, imageBuffer);
        imageUrl = ossConfig.domain ? `${ossConfig.domain}/${filename}` : result.url;
        log('info', 'Send', `图片已上传OSS: ${imageUrl}`);
      } catch (ossErr) {
        log('error', 'Send', `OSS上传失败，回退到base64: ${ossErr.message}`);
      }
    }

    // 没配置OSS或上传失败，用 base64
    if (!imageUrl) {
      const base64 = imageBuffer.toString('base64');
      imageUrl = `data:image/${mime};base64,${base64}`;
    }

    for (const targetGroup of targetGroups) {
      lightChatSocket.emit(
        'send_group_msg',
        { groupId: targetGroup, type: 2, content: imageUrl, mentionUids: [] },
        (res) => {
          if (res?.code === 0) {
            pushMessageLog({
              id: res.data.id,
              direction: 'out',
              groupId: targetGroup,
              groupName: getGroupName(targetGroup),
              fromUid: `robot:${robotInfo?.id}`,
              fromNickname: robotInfo?.name || '机器人',
              isRobot: true,
              type: 2,
              content: imageUrl,
              withdrawn: false,
              time: new Date().toISOString(),
            });
            log('info', 'Send', `[群${targetGroup}] 图片: ${path.basename(filePath)}`);
          }
        }
      );
    }
  } catch (err) {
    log('error', 'Send', `发送图片失败: ${err.message}`);
  }
}

function findUidByShortNo(shortNo) {
  return shortNoToUidMap[shortNo] || null;
}

// ========== 处理外部业务 WS 消息 ==========
function handleBizMessage(jsonString) {
  try {
    const msg = JSON.parse(jsonString);
    const { type, data } = msg;
    if (!type || data === undefined) return;

    let messageText = null;
    let mentionedUids = null;

    if (type === 'cx') {
      if (typeof data !== 'object' || !data) return;
      const shortNo = data.wxid;
      const nickname = data.nickname;
      if (!nickname || !shortNo) return;
      const uid = findUidByShortNo(shortNo);
      messageText = `@${nickname} 没有（🈚️效），请注意看图`;
      if (uid) mentionedUids = [uid];
    } else if (type === 'score_not_enough') {
      if (typeof data !== 'object' || !data) return;
      const shortNo = data.wxid;
      const nickname = data.nickname;
      if (!nickname || !shortNo) return;
      const uid = findUidByShortNo(shortNo);
      messageText = `@${nickname} 没有（积分不足，🈚️效），请注意看图`;
      if (uid) mentionedUids = [uid];
    } else if (type === 'not_bind') {
      if (typeof data !== 'object' || !data) return;
      const nickname = data.nickname;
      if (!nickname) return;
      messageText = `@${nickname}，没有（未绑定wx号，🈚️效），请注意看图`;
      mentionedUids = null;
    } else if (type === 'fire_report_bets') {
      if (!Array.isArray(data)) return;
      const n = data.length;
      const numerator = n + 1;
      const denominator = ((n + 1) * 0.8).toFixed(1);
      const reportText = `请注意👀看图 ${numerator} / ${denominator}`;
      fireReportBetsReceivedTime = Date.now();
      sendTextMessage('==========停止⬇️注==========');
      setTimeout(() => sendTextMessage(reportText), 2000);
      return;
    } else if (type === 'fire_report') {
      // 预留
    } else if (type === 'download_pic') {
      if (typeof data !== 'object' || !data) return;
      let base64String = data.base64;
      if (!base64String || typeof base64String !== 'string') return;
      const commaIdx = base64String.indexOf(',');
      if (commaIdx !== -1) base64String = base64String.substring(commaIdx + 1);

      const imageBuffer = Buffer.from(base64String, 'base64');
      if (!imageBuffer || imageBuffer.length === 0) return;

      const dataUrl = `data:image/png;base64,${base64String}`;
      if (lightChatSocket?.connected && bindGroupIds[0]) {
        lightChatSocket.emit(
          'send_group_msg',
          { groupId: bindGroupIds[0], type: 2, content: dataUrl, mentionUids: [] },
          (res) => {
            if (res?.code === 0) {
              pushMessageLog({
                id: res.data.id,
                direction: 'out',
                groupId: bindGroupIds[0],
                groupName: getGroupName(bindGroupIds[0]),
                fromUid: `robot:${robotInfo?.id}`,
                fromNickname: robotInfo?.name || '机器人',
                isRobot: true,
                type: 2,
                content: dataUrl,
                withdrawn: false,
                time: new Date().toISOString(),
              });
            }
          }
        );
      }
      return;
    } else if (type === 'clear_bets') {
      messageText = '==========开始⬇️注==========';
      mentionedUids = null;
    } else {
      log('info', 'Biz', `未知类型: ${type}`);
      return;
    }

    if (messageText) sendTextMessage(messageText, mentionedUids);
  } catch (err) {
    log('error', 'Biz', `处理失败: ${err.message}`);
  }
}

// ========== 连接外部业务 WS ==========
function connectBizWs(url) {
  if (!url) return;
  log('info', 'Biz', `连接到 ${url} ...`);

  if (bizSocket) {
    try { bizSocket.close(); } catch (e) {}
    bizSocket = null;
  }

  bizSocket = new WebSocket(url);

  bizSocket.on('open', () => {
    log('info', 'Biz', '外部业务 WebSocket 连接成功');
    broadcastToPanel({ type: 'status', bizConnected: true });
  });

  bizSocket.on('message', (data) => {
    handleBizMessage(data.toString());
  });

  bizSocket.on('error', (err) => {
    log('error', 'Biz', `WebSocket 错误: ${err.message}`);
  });

  bizSocket.on('close', () => {
    log('warn', 'Biz', 'WebSocket 断开，5秒后重连...');
    broadcastToPanel({ type: 'status', bizConnected: false });
    setTimeout(() => connectBizWs(url), 5000);
  });
}

// ========== 文件夹监控 ==========
function startFolderWatch(folder, extensions) {
  if (!folder || !fs.existsSync(folder)) {
    log('error', 'Watch', `文件夹不存在: ${folder}`);
    return;
  }

  if (folderWatcher) {
    try { folderWatcher.close(); } catch (e) {}
    folderWatcher = null;
  }

  const exts = extensions || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
  log('info', 'Watch', `监控: ${folder} (${exts.join(', ')})`);

  folderWatcher = chokidar.watch(folder, {
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  });

  folderWatcher.on('add', (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (exts.includes(ext)) {
      log('info', 'Watch', `新图片: ${path.basename(filePath)}`);
      sendImageMessage(filePath);
    }
  });

  folderWatcher.on('error', (err) => {
    log('error', 'Watch', `错误: ${err.message}`);
  });
}

// ========== 保存配置文件 ==========
function saveConfigFile() {
  const lines = [];
  lines.push('// 机器人客户端配置');
  lines.push('module.exports = {');
  lines.push(`  // ===== 轻聊服务器 =====`);
  lines.push(`  serverUrl: '${config.serverUrl}',`);
  lines.push(`  // 机器人 API Key`);
  lines.push(`  apiKey: '${config.apiKey}',`);
  lines.push('');
  lines.push(`  // ===== 群绑定 =====`);
  lines.push(`  // 监控哪些群的消息（数组，可配置群ID列表）`);
  lines.push(`  // 留空则监控所有绑定的群`);
  lines.push(`  watchGroupIds: ${JSON.stringify(config.watchGroupIds)},`);
  lines.push('');
  lines.push(`  // ===== 外部业务服务器 =====`);
  lines.push(`  // 外部业务服务器 IP（WS端口固定8011，HTTP端口固定9011）`);
  lines.push(`  bizServerIp: '${config.bizServerIp}',`);
  lines.push(`  enableBizWs: ${config.enableBizWs},`);
  lines.push('');
  lines.push(`  // 是否启用群消息转发`);
  lines.push(`  enableMessageForward: ${config.enableMessageForward},`);
  lines.push(`  // 转发接口路径`);
  lines.push(`  forwardChatApi: '${config.forwardChatApi}',`);
  lines.push(`  // 撤回消息接口`);
  lines.push(`  forwardRecallApi: '${config.forwardRecallApi}',`);
  lines.push(`  // 添加玩家接口`);
  lines.push(`  addPaochatApi: '${config.addPaochatApi}',`);
  lines.push(`  // 新成员入群时自动调用 addpaochatuser`);
  lines.push(`  enableAddPaochatUser: ${config.enableAddPaochatUser},`);
  lines.push('');
  lines.push(`  // ===== 本地控制面板 =====`);
  lines.push(`  // 本地 Web 面板端口，浏览器打开 http://localhost:${config.panelPort}`);
  lines.push(`  panelPort: ${config.panelPort},`);
  lines.push('');
  lines.push(`  // ===== 文件夹监控 =====`);
  lines.push(`  watchFolder: '${config.watchFolder}',  // 本地文件夹路径`);
  lines.push(`  enableFolderWatch: ${config.enableFolderWatch},`);
  lines.push(`  imageExtensions: ${JSON.stringify(config.imageExtensions)},`);
  lines.push('};');
  lines.push('');
  fs.writeFileSync(path.join(__dirname, 'config.js'), lines.join('\n'));
}

// ========== 本地机器人列表（保存登录过的机器人） ==========
const robotsFile = path.join(__dirname, 'robots.json');

function loadLocalRobots() {
  try {
    if (fs.existsSync(robotsFile)) {
      return JSON.parse(fs.readFileSync(robotsFile, 'utf-8'));
    }
  } catch (e) {}
  // 默认从当前配置加一个
  const list = [];
  if (robotInfo) {
    list.push({ id: robotInfo.id, name: robotInfo.name, apiKey: config.apiKey });
  }
  return list;
}

function saveLocalRobots(robots) {
  fs.writeFileSync(robotsFile, JSON.stringify(robots, null, 2));
}

// ========== 本地 Web 控制面板 ==========
function startPanel() {
  const app = express();
  app.use(express.json());

  // 页面
  app.get('/', (req, res) => {
    res.send(panelPage);
  });

  // API: 获取配置
  app.get('/api/config', (req, res) => {
    res.json({
      config: { ...config },
      robotInfo: robotInfo,
      bindGroupIds,
      robotConnected: !!lightChatSocket?.connected,
      bizConnected: bizSocket?.readyState === 1,
    });
  });

  // API: 保存配置（写入 config.js）
  app.post('/api/config', (req, res) => {
    const newCfg = req.body;
    try {
      Object.assign(config, newCfg);
      saveConfigFile();
      log('info', 'Config', '配置已保存');
      res.json({ code: 0 });
    } catch (err) {
      res.json({ code: 500, message: err.message });
    }
  });

  // API: 获取消息日志
  app.get('/api/messages', (req, res) => {
    res.json({ list: messageLog });
  });

  // API: 发送文本消息
  app.post('/api/send', (req, res) => {
    const { text, groupId } = req.body;
    if (!text) return res.json({ code: 400, message: '内容不能为空' });
    sendTextMessage(text, null, groupId);
    res.json({ code: 0 });
  });

  // API: 发送图片
  app.post('/api/send-image', (req, res) => {
    const { filePath, groupId } = req.body;
    if (!filePath) return res.json({ code: 400, message: '路径不能为空' });
    sendImageMessage(filePath, groupId);
    res.json({ code: 0 });
  });

  // API: 获取群成员
  app.get('/api/members', async (req, res) => {
    const { groupId } = req.query;
    if (!groupId) return res.json({ code: 400, message: '缺少 groupId' });
    try {
      const members = await getGroupMembers(groupId);
      res.json({ list: members });
    } catch (err) {
      res.json({ code: 500, message: err.message });
    }
  });

  // API: 获取所有群
  app.get('/api/all-groups', async (req, res) => {
    if (!lightChatSocket?.connected) return res.json({ list: [] });
    lightChatSocket.emit('get_all_groups', {}, (resp) => {
      if (resp?.code === 0) {
        res.json({ list: resp.data || [] });
      } else {
        res.json({ list: [] });
      }
    });
    // 超时回退
    setTimeout(() => {
      if (!res.headersSent) res.json({ list: [] });
    }, 5000);
  });

  // API: 绑定群
  app.post('/api/bind-group', (req, res) => {
    const { groupId } = req.body;
    if (!groupId) return res.json({ code: 400, message: '缺少 groupId' });
    if (!lightChatSocket?.connected) return res.json({ code: 500, message: '机器人未连接' });
    lightChatSocket.emit('bind_group', { groupId }, (resp) => {
      res.json(resp || { code: 500, message: '无响应' });
    });
    setTimeout(() => {
      if (!res.headersSent) res.json({ code: 500, message: '超时' });
    }, 5000);
  });

  // API: 解绑群
  app.post('/api/unbind-group', (req, res) => {
    const { groupId } = req.body;
    if (!groupId) return res.json({ code: 400, message: '缺少 groupId' });
    if (!lightChatSocket?.connected) return res.json({ code: 500, message: '机器人未连接' });
    lightChatSocket.emit('unbind_group', { groupId }, (resp) => {
      res.json(resp || { code: 500, message: '无响应' });
    });
    setTimeout(() => {
      if (!res.headersSent) res.json({ code: 500, message: '超时' });
    }, 5000);
  });

  // API: 手动添加玩家
  app.post('/api/add-player', async (req, res) => {
    const { groupId, uid } = req.body;
    if (!groupId || !uid) return res.json({ code: 400, message: '参数错误' });
    try {
      const members = await getGroupMembers(groupId);
      const member = members.find(m => m.uid === uid);
      if (!member) return res.json({ code: 404, message: '成员不存在' });
      const ok = await addPaochatUser(member);
      res.json({ code: ok ? 0 : 500, message: ok ? '成功' : '失败' });
    } catch (err) {
      res.json({ code: 500, message: err.message });
    }
  });

  // API: 机器人列表（从服务端拉取 + 合并本地 apiKey）
  app.get('/api/robots', async (req, res) => {
    let serverRobots = [];
    if (lightChatSocket?.connected) {
      try {
        const result = await new Promise((resolve, reject) => {
          lightChatSocket.emit('list_robots', {}, (resp) => {
            if (resp?.code === 0) resolve(resp.data || []);
            else reject(new Error(resp?.message || '失败'));
          });
          setTimeout(() => reject(new Error('超时')), 5000);
        });
        serverRobots = result;
      } catch (e) {
          log('warn', 'Robots', `从服务端拉取机器人列表失败: ${e.message}`);
        }
    }
    // 合并本地保存的 apiKey
    const localRobots = loadLocalRobots();
    const localMap = {};
    for (const r of localRobots) { localMap[r.id] = r.apiKey; }
    const merged = serverRobots.map(r => ({
      id: r.id,
      name: r.name,
      status: r.status,
      apiKey: localMap[r.id] || '',
      hasKey: !!localMap[r.id],
    }));
    // 加上本地有但服务端没有的（兜底）
    for (const lr of localRobots) {
      if (!merged.find(m => String(m.id) === String(lr.id))) {
        merged.push({ id: lr.id, name: lr.name, status: 1, apiKey: lr.apiKey, hasKey: true });
      }
    }
    res.json({ list: merged });
  });

  // API: 切换机器人
  app.post('/api/switch-robot', (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.json({ code: 400, message: '缺少 apiKey' });
    config.apiKey = apiKey;
    // 保存到配置文件
    saveConfigFile();
    // 重连
    reconnectLightChat();
    res.json({ code: 0 });
  });

  // API: 手动重连
  app.post('/api/reconnect', (req, res) => {
    reconnectLightChat();
    res.json({ code: 0 });
  });

  // API: 添加本地机器人记录
  app.post('/api/add-robot-local', (req, res) => {
    const { id, name, apiKey } = req.body;
    if (!name || !apiKey) return res.json({ code: 400, message: '参数错误' });
    const robots = loadLocalRobots();
    if (robots.find(r => r.apiKey === apiKey)) {
      return res.json({ code: 400, message: '该机器人已存在' });
    }
    const newRobot = {
      id: id || Date.now(),
      name,
      apiKey,
    };
    // 如果 ID 已存在，更新名称和 key
    const existing = robots.find(r => String(r.id) === String(newRobot.id));
    if (existing) {
      existing.name = name;
      existing.apiKey = apiKey;
    } else {
      robots.push(newRobot);
    }
    saveLocalRobots(robots);
    res.json({ code: 0 });
  });

  // API: 选择文件夹（调用系统文件夹选择对话框）
  app.post('/api/choose-folder', (req, res) => {
    const { exec } = require('child_process');
    let cmd;
    if (process.platform === 'darwin') {
      cmd = 'osascript -e \'POSIX path of (choose folder with prompt "选择监控文件夹")\' 2>/dev/null';
    } else if (process.platform === 'win32') {
      cmd = 'powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.ShowDialog() | Out-Null; $f.SelectedPath"';
    } else {
      cmd = 'zenity --file-selection --directory 2>/dev/null';
    }
    exec(cmd, (err, stdout) => {
      const folder = stdout?.toString().trim();
      if (err || !folder) {
        return res.json({ code: 400, message: '未选择文件夹或系统不支持' });
      }
      res.json({ code: 0, data: { folder } });
    });
  });

  // API: 打开文件夹（在资源管理器中显示）
  app.get('/api/open-folder', (req, res) => {
    const folder = req.query.path;
    if (!folder) return res.json({ code: 400, message: '缺少路径' });
    const { exec } = require('child_process');
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    exec(`${cmd} "${folder}"`);
    res.json({ code: 0 });
  });

  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    panelClients.add(ws);
    // 发送初始状态
    ws.send(JSON.stringify({
      type: 'init',
      robotConnected: !!lightChatSocket?.connected,
      bizConnected: bizSocket?.readyState === 1,
      robotInfo,
      bindGroupIds,
    }));

    ws.on('close', () => {
      panelClients.delete(ws);
    });
  });

  server.listen(config.panelPort, () => {
    log('info', 'Panel', `控制面板已启动: http://localhost:${config.panelPort}`);
  });
}

// ========== 启动 ==========
function start() {
  if (!config.apiKey) {
    console.error('请在 config.js 中配置 apiKey');
    process.exit(1);
  }
  startPanel();
  connectLightChat();
}

start();
