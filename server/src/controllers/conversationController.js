const conversationSettingsModel = require('../models/conversationSettingsModel');

// 获取我的所有会话设置
async function getMySettings(req, res) {
  const uid = req.user.uid;
  const settings = await conversationSettingsModel.getByUser(uid);
  res.json({ code: 0, data: settings });
}

// 置顶/取消置顶会话
async function setPinned(req, res) {
  const uid = req.user.uid;
  const { convType, convId, isPinned } = req.body;

  if (!convType || !convId) {
    return res.json({ code: 400, message: '参数错误' });
  }

  const result = await conversationSettingsModel.setPinned(
    uid,
    parseInt(convType),
    convId,
    !!isPinned
  );

  res.json({
    code: 0,
    message: isPinned ? '已置顶' : '已取消置顶',
    data: result,
  });
}

// 标星/取消标星会话
async function setStared(req, res) {
  const uid = req.user.uid;
  const { convType, convId, isStared } = req.body;

  if (!convType || !convId) {
    return res.json({ code: 400, message: '参数错误' });
  }

  const result = await conversationSettingsModel.setStared(
    uid,
    parseInt(convType),
    convId,
    !!isStared
  );

  res.json({
    code: 0,
    message: isStared ? '已标星' : '已取消标星',
    data: result,
  });
}

module.exports = {
  getMySettings,
  setPinned,
  setStared,
};
