/**
 * 轻聊压力测试脚本
 * 用法: node stress-test.js --users=1000 --groups=50 --url=http://localhost:3001
 *
 * 需要管理员账号密码（默认 admin / admin123）
 */

const { io } = require('socket.io-client');
const http = require('http');

// ========== 配置 ==========
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.replace(/^--/, '').split('=');
  acc[key] = val;
  return acc;
}, {});

const SERVER_URL = args.url || 'http://localhost:3001';
const TOTAL_USERS = parseInt(args.users) || 100;
const TOTAL_GROUPS = parseInt(args.groups) || 10;
const MSG_INTERVAL = parseInt(args.interval) || 2000; // 每个用户发消息间隔(ms)
const TEST_DURATION = parseInt(args.duration) || 60000; // 测试时长(ms)
const ADMIN_USER = args.adminUser || 'admin';
const ADMIN_PASS = args.adminPass || 'admin123';
const SKIP_CREATE = args['skip-create'] !== undefined;  // 跳过创建用户和群，复用已有

console.log(`
========== 压力测试 ==========
服务器: ${SERVER_URL}
用户数: ${TOTAL_USERS}
群数: ${TOTAL_GROUPS}
发消息间隔: ${MSG_INTERVAL}ms
测试时长: ${TEST_DURATION / 1000}s
跳过创建: ${SKIP_CREATE ? '是（复用已有用户和群）' : '否'}
============================
`);

// ========== 统计 ==========
let connectedCount = 0;
let disconnectCount = 0;
let msgSent = 0;
let msgReceived = 0;
let errorCount = 0;
let startTime = 0;
// 错误统计（按错误信息聚合，最多记 20 种）
const errorMap = new Map();
function recordError(msg) {
  errorCount++;
  const key = msg || 'unknown';
  errorMap.set(key, (errorMap.get(key) || 0) + 1);
}

// ========== HTTP 工具 ==========
function request(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const url = new URL(path, SERVER_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(body); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// ========== 主流程 ==========
async function main() {
  console.log('步骤1: 管理员登录...');
  const adminRes = await request('POST', '/api/admin/login', {
    username: ADMIN_USER,
    password: ADMIN_PASS,
  });
  if (adminRes.code !== 0) {
    console.error('管理员登录失败:', adminRes.message);
    process.exit(1);
  }
  const adminToken = adminRes.data.token;
  console.log('  成功');

  console.log(`步骤2: ${SKIP_CREATE ? '跳过创建用户' : `批量创建 ${TOTAL_USERS} 个测试用户`}...`);
  if (!SKIP_CREATE) {
    const batch = [];
    for (let i = 0; i < TOTAL_USERS; i++) {
      const phone = `138${String(10000000 + i).padStart(8, '0')}`;
      batch.push({
        phone,
        nickname: `压测用户${i}`,
        password: '123456',
      });
    }
    const createRes = await request('POST', '/api/admin/users/batch', { users: batch }, adminToken);
    console.log(`  完成: ${createRes.message || JSON.stringify(createRes)}`);
  } else {
    console.log('  使用已有用户（手机号 13800010000 ~ 1380001xxxx，密码 123456）');
  }

  console.log('步骤3: 所有用户登录拿 token...');
  const tokens = [];
  const uids = [];
  // 分批登录，避免并发太高
  const BATCH_SIZE = 50;
  for (let i = 0; i < TOTAL_USERS; i += BATCH_SIZE) {
    const batch = [];
    for (let j = i; j < Math.min(i + BATCH_SIZE, TOTAL_USERS); j++) {
      const phone = `138${String(10000000 + j).padStart(8, '0')}`;
      batch.push(
        request('POST', '/api/v1/user/login', {
          phone,
          password: '123456',
          device_id: `stress_${j}`,
          device_info: 'stress-test',
        }).then(res => {
          if (res.code === 0) {
            tokens.push(res.data.token);
            uids.push(res.data.user.uid);
          }
        })
      );
    }
    await Promise.all(batch);
    process.stdout.write(`  已登录 ${tokens.length}/${TOTAL_USERS}\r`);
  }
  console.log(`\n  完成，成功 ${tokens.length} 个用户`);

  console.log(`步骤4: 确保有 ${TOTAL_GROUPS} 个群，用户加入群...`);
  // 先获取群列表
  const groupsRes = await request('GET', '/api/admin/groups?pageSize=100', null, adminToken);
  let groups = groupsRes.data?.list || [];

  if (!SKIP_CREATE) {
    // 如果群不够，创建
    while (groups.length < TOTAL_GROUPS) {
      const idx = groups.length + 1;
      await request('POST', '/api/admin/groups', {
        name: `压测群${idx}`,
        owner_uid: uids[0],
        isPublic: true,
      }, adminToken);
      const gl = await request('GET', '/api/admin/groups?pageSize=100', null, adminToken);
      groups = gl.data?.list || [];
    }
  }

  if (groups.length < TOTAL_GROUPS) {
    console.error(`  错误：只有 ${groups.length} 个群，但需要 ${TOTAL_GROUPS} 个`);
    process.exit(1);
  }

  const groupIds = groups.slice(0, TOTAL_GROUPS).map(g => g.id);
  console.log(`  使用群: ${groupIds.join(', ')}`);

  // 确保所有群都是公开且开门状态，方便压测
  for (const gid of groupIds) {
    await request('POST', `/api/admin/groups/${gid}/public`, { isPublic: true }, adminToken);
    await request('POST', `/api/admin/groups/${gid}/status`, { status: 0 }, adminToken);
  }
  console.log('  已设置所有群为公开+开门');

  // 用户加入群（平均分配）
  let joinSuccess = 0;
  let joinFail = 0;
  for (let i = 0; i < tokens.length; i++) {
    const groupId = groupIds[i % groupIds.length];
    try {
      const res = await request('POST', `/api/v1/groups/${groupId}/join`, {}, tokens[i]);
      if (res.code === 0) {
        joinSuccess++;
      } else {
        joinFail++;
      }
    } catch (e) {
      joinFail++;
    }
    if ((i + 1) % 100 === 0) {
      process.stdout.write(`  加群进度: ${i + 1}/${tokens.length} (成功${joinSuccess}/失败${joinFail})\r`);
    }
  }
  console.log(`\n  完成，成功 ${joinSuccess}，失败 ${joinFail}`);

  console.log('步骤5: 连接 Socket.IO...');
  startTime = Date.now();
  const connectPromises = [];
  const sockets = [];

  for (let i = 0; i < tokens.length; i++) {
    const p = new Promise((resolve) => {
      const socket = io(SERVER_URL, {
        auth: { token: tokens[i] },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
      });

      socket.on('connect', () => {
        connectedCount++;
        sockets.push({ socket, uid: uids[i], idx: i });
        resolve();
      });

      socket.on('disconnect', () => {
        disconnectCount++;
      });

      socket.on('new_message', () => {
        msgReceived++;
      });

      socket.on('connect_error', () => {
        errorCount++;
        resolve();
      });

      setTimeout(() => resolve(), 15000);
    });
    connectPromises.push(p);

    // 分批连接，每批 100 个
    if (connectPromises.length >= 100) {
      await Promise.all(connectPromises);
      connectPromises.length = 0;
      process.stdout.write(`  已连接 ${connectedCount}/${tokens.length}\r`);
    }
  }
  await Promise.all(connectPromises);
  console.log(`\n  完成，连接成功 ${connectedCount}`);

  if (sockets.length === 0) {
    console.error('没有用户连接成功，退出');
    process.exit(1);
  }

  console.log('步骤6: 开始发消息压测...');
  const statsInterval = setInterval(printStats, 5000);

  // 每个用户随机发群消息和单聊消息
  const sendIntervals = sockets.map(({ socket, uid, idx }) => {
    return setInterval(() => {
      if (!socket.connected) return;
      // 70% 群消息，30% 单聊
      if (Math.random() < 0.7) {
        const groupId = groupIds[idx % groupIds.length];
        socket.emit('send_message', {
          groupId,
          type: 1,
          content: `[用户${idx}] 压测消息 ${Date.now()}`,
          mentionUids: [],
        }, (res) => {
          if (res?.code === 0) {
            msgSent++;
          } else {
            recordError(`群聊: ${res?.message || 'code=' + res?.code}`);
          }
        });
      } else {
        // 随机找一个用户私聊
        const randomIdx = Math.floor(Math.random() * sockets.length);
        const targetUid = sockets[randomIdx]?.uid;
        if (targetUid && targetUid !== uid) {
          socket.emit('send_message', {
            to_uid: targetUid,
            type: 1,
            content: `[用户${idx}] 私聊 ${Date.now()}`,
          }, (res) => {
            if (res?.code === 0) {
              msgSent++;
            } else {
              recordError(`单聊: ${res?.message || 'code=' + res?.code}`);
            }
          });
        }
      }
    }, MSG_INTERVAL + Math.floor(Math.random() * 1000));
  });

  // 测试结束
  setTimeout(() => {
    clearInterval(statsInterval);
    sendIntervals.forEach(clearInterval);
    console.log('\n========== 测试结束 ==========');
    printStats();
    console.log(`总时长: ${TEST_DURATION / 1000}s`);
    process.exit(0);
  }, TEST_DURATION);
}

function printStats() {
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`
--- ${elapsed.toFixed(1)}s ---
  已连接: ${connectedCount}/${TOTAL_USERS}
  断开: ${disconnectCount}
  发送消息: ${msgSent} (${(msgSent / elapsed).toFixed(1)}/s)
  接收消息: ${msgReceived} (${(msgReceived / elapsed).toFixed(1)}/s)
  错误: ${errorCount}
`);
  if (errorCount > 0 && errorMap.size > 0) {
    console.log('  错误分布:');
    const sorted = [...errorMap.entries()].sort((a, b) => b[1] - a[1]);
    for (const [msg, count] of sorted.slice(0, 10)) {
      console.log(`    ${count}次 - ${msg}`);
    }
    if (sorted.length > 10) {
      console.log(`    ... 还有 ${sorted.length - 10} 种错误`);
    }
    console.log('');
  }
}

main().catch(err => {
  console.error('压测失败:', err);
  process.exit(1);
});
