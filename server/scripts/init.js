const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

async function init() {
  console.log('初始化数据...');

  // 创建默认管理员 admin/admin123
  const adminResult = await db.query('SELECT * FROM admins WHERE username = $1', ['admin']);
  if (adminResult.rows.length === 0) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await db.query(
      `INSERT INTO admins (username, password, nickname) VALUES ($1, $2, $3)`,
      ['admin', hashedPassword, '超级管理员']
    );
    console.log('✓ 创建管理员账号: admin / admin123');
  } else {
    console.log('ℹ 管理员账号已存在');
  }

  // 创建一个测试群
  const groupResult = await db.query('SELECT * FROM groups WHERE id = 1');
  if (groupResult.rows.length === 0) {
    console.log('提示: 可以通过管理后台创建群和用户');
  }

  console.log('\n初始化完成！');
  console.log('管理员账号: admin / admin123');
  process.exit(0);
}

init().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
