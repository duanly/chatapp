const config = require('../config');

// 根据 DB_TYPE 选择数据库驱动
// DB_TYPE=sqlite (默认，开发环境)
// DB_TYPE=postgres (生产环境)
const dbType = (config.db.type || 'sqlite').toLowerCase();

let db;

if (dbType === 'postgres') {
  db = require('./db_pg');
} else {
  db = require('./db_sqlite');
}

module.exports = db;
