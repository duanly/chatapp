// 给所有没有短号的用户生成短号
const db = require('../config/db');
const { generateShortNo } = require('../utils/id');

async function main() {
  try {
    const result = await db.query('SELECT uid, short_no FROM users WHERE short_no IS NULL');
    const users = result.rows;
    console.log(`共 ${users.length} 个用户没有短号`);

    let updated = 0;
    for (const user of users) {
      // 生成唯一短号，最多尝试 20 次
      let shortNo = null;
      for (let i = 0; i < 20; i++) {
        const candidate = generateShortNo();
        const existing = await db.query('SELECT id FROM users WHERE short_no = $1', [candidate]);
        if (existing.rows.length === 0) {
          shortNo = candidate;
          break;
        }
      }
      if (!shortNo) {
        console.log(`  ${user.uid} -> 生成失败`);
        continue;
      }
      await db.query('UPDATE users SET short_no = $1 WHERE uid = $2', [shortNo, user.uid]);
      updated++;
      console.log(`  ${user.uid} -> ${shortNo}`);
    }

    console.log(`完成，更新了 ${updated} 个用户`);
    process.exit(0);
  } catch (err) {
    console.error('出错：', err);
    process.exit(1);
  }
}

main();
