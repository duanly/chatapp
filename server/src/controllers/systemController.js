const systemSettingModel = require('../models/systemSettingModel');

// 获取系统设置（公开，不需要登录）
async function getSettings(req, res) {
  try {
    const settings = await systemSettingModel.getAll();
    // 只返回前端需要的字段，防止敏感信息泄露
    const publicSettings = {
      app_name: settings.app_name || '轻聊',
      app_logo: settings.app_logo || '',
      app_description: settings.app_description || '',
    };
    res.json({ code: 0, data: publicSettings });
  } catch (err) {
    console.error('getSettings error:', err);
    res.json({ code: 500, message: '获取失败' });
  }
}

module.exports = {
  getSettings,
};
