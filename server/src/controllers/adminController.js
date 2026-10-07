const bcrypt = require('bcryptjs');
const db = require('../config/db');
const userModel = require('../models/userModel');
const groupModel = require('../models/groupModel');
const messageModel = require('../models/messageModel');
const robotModel = require('../models/robotModel');
const robotMessageLogModel = require('../models/robotMessageLogModel');
const loginLogModel = require('../models/loginLogModel');
const { generateToken } = require('../utils/jwt');
const { generatePassword } = require('../utils/password');
const { getAvatarByUid } = require('../utils/avatar');
const socketHandler = require('../socket');

// 管理员登录
async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ code: 400, message: '参数错误' });
  }

  const result = await db.query('SELECT * FROM admins WHERE username = $1', [username]);
  if (result.rows.length === 0) {
    return res.json({ code: 400, message: '用户名或密码错误' });
  }

  const admin = result.rows[0];
  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) {
    return res.json({ code: 400, message: '用户名或密码错误' });
  }

  const token = generateToken({
    adminId: admin.id,
    username: admin.username,
    isAdmin: true,
  });

  res.json({
    code: 0,
    message: '登录成功',
    data: {
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname,
      },
    },
  });
}

// 用户列表
async function userList(req, res) {
  const { page = 1, pageSize = 20, keyword } = req.query;
  let result;
  if (keyword) {
    const list = await userModel.search(keyword, page, pageSize);
    result = { list, total: list.length, page: parseInt(page), pageSize: parseInt(pageSize) };
  } else {
    result = await userModel.list(page, pageSize);
  }
  res.json({ code: 0, data: result });
}

// 用户详情
async function userDetail(req, res) {
  const { uid } = req.params;
  const user = await userModel.findByUid(uid);
  if (!user) {
    return res.json({ code: 404, message: '用户不存在' });
  }
  // 最近登录日志
  const loginLogs = await loginLogModel.getRecentLogs(uid, 5);
  res.json({ code: 0, data: { ...user, loginLogs } });
}

// 设置设备锁
async function setDeviceLock(req, res) {
  const { uid } = req.params;
  const { deviceLock } = req.body;

  const updateData = { deviceLock: !!deviceLock };
  // 关闭设备锁时，清空绑定的 device_id
  if (!deviceLock) {
    updateData.deviceId = '';
  }

  const user = await userModel.update(uid, updateData);
  if (!user) {
    return res.json({ code: 404, message: '用户不存在' });
  }

  // 如果开启了设备锁并且当前有在线连接，可以选择踢下线
  // 这里不主动踢，下次登录时会校验

  res.json({ code: 0, message: '操作成功', data: user });
}

// 更新用户备注
async function updateUserRemark(req, res) {
  const { uid } = req.params;
  const { remark } = req.body;

  const user = await userModel.update(uid, { remark: remark || '' });
  if (!user) {
    return res.json({ code: 404, message: '用户不存在' });
  }
  res.json({ code: 0, message: '更新成功', data: user });
}

// 创建用户
async function createUser(req, res) {
  const { phone, nickname, avatar, password, isPublic = false } = req.body;

  if (!phone) {
    return res.json({ code: 400, message: '手机号不能为空' });
  }

  // 检查手机号是否已存在
  const existing = await userModel.findByPhone(phone);
  if (existing) {
    return res.json({ code: 400, message: '该手机号已注册' });
  }

  const rawPassword = password || generatePassword(12);
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const user = await userModel.create({
    phone,
    nickname: nickname || `用户${phone.slice(-4)}`,
    avatar: avatar || '',
    password: hashedPassword,
  });

  // 设置公共标志
  if (isPublic) {
    await userModel.setPublic(user.uid, true);
    user.is_public = true;
  }

  res.json({
    code: 0,
    message: '创建成功',
    data: {
      ...user,
      password: rawPassword, // 返回明文密码给管理员
    },
  });
}

// 批量创建用户
async function batchCreateUsers(req, res) {
  const { users } = req.body;
  if (!users || !Array.isArray(users) || users.length === 0) {
    return res.json({ code: 400, message: '用户数据不能为空' });
  }

  const success = [];
  const failed = [];

  for (const item of users) {
    try {
      if (!item.phone) {
        failed.push({ ...item, reason: '手机号不能为空' });
        continue;
      }

      const existing = await userModel.findByPhone(item.phone);
      if (existing) {
        failed.push({ ...item, reason: '手机号已存在' });
        continue;
      }

      const rawPassword = item.password || generatePassword(12);
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      const user = await userModel.create({
        phone: item.phone,
        nickname: item.nickname || `用户${item.phone.slice(-4)}`,
        avatar: item.avatar || '',
        password: hashedPassword,
      });

      success.push({
        ...user,
        password: rawPassword,
      });
    } catch (e) {
      failed.push({ ...item, reason: e.message });
    }
  }

  res.json({
    code: 0,
    message: `创建完成：成功 ${success.length} 个，失败 ${failed.length} 个`,
    data: { success, failed },
  });
}

// 封禁/解封用户
async function setUserStatus(req, res) {
  const { uid } = req.params;
  const { status } = req.body; // 0=正常 1=封禁

  const user = await userModel.updateStatus(uid, status);

  // 如果封禁，踢用户下线
  if (status === 1) {
    await socketHandler.kickUser(uid, 'banned');
  }

  res.json({
    code: 0,
    message: status === 1 ? '已封禁' : '已解封',
    data: user,
  });
}

// 设置用户公开/私有
async function setUserPublic(req, res) {
  const { uid } = req.params;
  const { isPublic } = req.body;

  const user = await userModel.setPublic(uid, !!isPublic);
  res.json({
    code: 0,
    message: isPublic ? '已设为公共账号' : '已取消公共标志',
    data: user,
  });
}

// 创建群
async function createGroup(req, res) {
  const { name, avatar, ownerUid, isPublic = false } = req.body;

  if (!name) {
    return res.json({ code: 400, message: '群名称不能为空' });
  }

  // 如果没指定群主，用系统用户或第一个用户
  let owner = ownerUid;
  if (!owner) {
    const firstUser = await db.query('SELECT uid FROM users LIMIT 1');
    if (firstUser.rows.length === 0) {
      return res.json({ code: 400, message: '系统中没有用户，无法创建群' });
    }
    owner = firstUser.rows[0].uid;
  }

  const group = await groupModel.create({
    name,
    avatar: avatar || '',
    ownerUid: owner,
  });

  // 设置公共标志
  if (isPublic) {
    await groupModel.setPublic(group.id, true);
    group.is_public = true;
  }

  res.json({
    code: 0,
    message: '创建成功',
    data: group,
  });
}

// 设置群公开/私有
async function setGroupPublic(req, res) {
  const { id } = req.params;
  const { isPublic } = req.body;

  const group = await groupModel.setPublic(id, !!isPublic);
  res.json({
    code: 0,
    message: isPublic ? '已设为公共群' : '已取消公共标志',
    data: group,
  });
}

// 解散群
async function disbandGroup(req, res) {
  const { id } = req.params;

  const group = await groupModel.getById(id);
  if (!group) {
    return res.json({ code: 404, message: '群不存在' });
  }

  await groupModel.disband(id);

  // 通知群成员群已解散（通过 socket）
  // TODO: 可以发送系统消息通知

  res.json({
    code: 0,
    message: '群已解散',
  });
}

// 群列表
async function groupList(req, res) {
  const { page = 1, pageSize = 20, keyword } = req.query;
  const offset = (page - 1) * pageSize;

  let where = '';
  let params = [pageSize, offset];
  if (keyword) {
    where = 'WHERE name LIKE $3';
    params = [pageSize, offset, `%${keyword}%`];
  }

  const result = await db.query(
    `SELECT * FROM groups ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    params
  );
  const countResult = await db.query(
    `SELECT COUNT(*) FROM groups ${keyword ? 'WHERE name LIKE $1' : ''}`,
    keyword ? [`%${keyword}%`] : []
  );

  res.json({
    code: 0,
    data: {
      list: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    },
  });
}

// 群开门/关门
async function setGroupStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body; // 0=开门 1=关门

  const result = await groupModel.setStatus(id, status);
  res.json({
    code: 0,
    message: status === 1 ? '已关门' : '已开门',
    data: result,
  });
}

// 消息列表
async function messageList(req, res) {
  const { page = 1, pageSize = 20, keyword, uid, groupId } = req.query;
  const result = await messageModel.search({ keyword, uid, groupId, page, pageSize });
  res.json({ code: 0, data: result });
}

// 机器人列表
async function robotList(req, res) {
  const robots = await robotModel.list();
  // 带上绑定的群
  for (const robot of robots) {
    robot.groups = await robotModel.getRobotGroups(robot.id);
  }
  res.json({ code: 0, data: robots });
}

// 创建机器人
async function createRobot(req, res) {
  const { name, avatar } = req.body;
  if (!name) {
    return res.json({ code: 400, message: '机器人名称不能为空' });
  }
  const robot = await robotModel.create({ name, avatar });
  res.json({ code: 0, message: '创建成功', data: robot });
}

// 更新机器人
async function updateRobot(req, res) {
  const { id } = req.params;
  const { name, avatar, status } = req.body;

  const data = {};
  if (name !== undefined) data.name = name;
  if (avatar !== undefined) data.avatar = avatar;
  if (status !== undefined) data.status = status;

  const robot = await robotModel.update(id, data);
  res.json({ code: 0, message: '更新成功', data: robot });
}

// 机器人绑定群
async function robotBindGroup(req, res) {
  const { id } = req.params;
  const { groupId } = req.body;

  const group = await groupModel.getById(groupId);
  if (!group) {
    return res.json({ code: 404, message: '群不存在' });
  }

  const result = await robotModel.bindGroup(id, groupId);
  res.json({ code: 0, message: '绑定成功', data: result });
}

// 机器人解绑群
async function robotUnbindGroup(req, res) {
  const { id, groupId } = req.params;
  const result = await robotModel.unbindGroup(id, groupId);
  res.json({ code: 0, message: '解绑成功', data: result });
}

// 导入 tsdd 用户
async function importTsddUsers(req, res) {
  const { users } = req.body;
  if (!users || !Array.isArray(users)) {
    return res.json({ code: 400, message: '用户数据格式错误' });
  }

  const result = await userModel.importTsddUsers(users);
  res.json({ code: 0, message: '导入完成', data: result });
}

// 获取系统设置
async function getSystemSettings(req, res) {
  const systemSettingModel = require('../models/systemSettingModel');
  const settings = await systemSettingModel.getAll();
  res.json({ code: 0, data: settings });
}

// 更新系统设置
async function updateSystemSettings(req, res) {
  const systemSettingModel = require('../models/systemSettingModel');
  const { app_name, app_logo, app_description } = req.body;

  if (app_name !== undefined) {
    await systemSettingModel.set('app_name', app_name);
  }
  if (app_logo !== undefined) {
    await systemSettingModel.set('app_logo', app_logo);
  }
  if (app_description !== undefined) {
    await systemSettingModel.set('app_description', app_description);
  }

  const settings = await systemSettingModel.getAll();
  res.json({ code: 0, message: '保存成功', data: settings });
}

// 机器人消息日志
async function robotMessageLogs(req, res) {
  const { robotId, groupId, direction, page = 1, pageSize = 50 } = req.query;
  const result = await robotMessageLogModel.getLogs({
    robotId: robotId ? parseInt(robotId) : null,
    groupId: groupId ? parseInt(groupId) : null,
    direction: direction || null,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
  });
  res.json({ code: 0, data: result });
}

module.exports = {
  login,
  userList,
  userDetail,
  createUser,
  batchCreateUsers,
  updateUserRemark,
  setUserStatus,
  setUserPublic,
  setDeviceLock,
  groupList,
  createGroup,
  setGroupStatus,
  setGroupPublic,
  disbandGroup,
  messageList,
  robotList,
  createRobot,
  updateRobot,
  robotBindGroup,
  robotUnbindGroup,
  robotMessageLogs,
  importTsddUsers,
  getSystemSettings,
  updateSystemSettings,
};
