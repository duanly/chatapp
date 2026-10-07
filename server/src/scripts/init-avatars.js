// 给所有没有头像的用户分配默认头像
const db = require('../config/db');
const { getAvatarByUid } = require('../utils/avatar');

async function main() {
  try {
    const result = await db.query('SELECT uid, avatar FROM users');
    const users = result.rows;
    console.log(`共 ${users.length} 个用户`);

    let updated = 0;
    for (const user of users) {
      if (!user.avatar) {
        const avatar = getAvatarByUid(user.uid);
        await db.query('UPDATE users SET avatar = $1 WHERE uid = $2', [avatar, user.uid]);
        updated++;
        console.log(`  ${user.uid} -> ${avatar}`);
      }
    }

    console.log(`\n完成！更新了 ${updated} 个用户的默认头像`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
