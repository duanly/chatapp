// 简单的 JSON 文件数据库，开发环境用，零依赖
const fs = require('fs');
const path = require('path');
const { generateId } = require('../utils/id');

const DB_PATH = path.join(__dirname, '../../data.json');

let data = {
  users: [],
  groups: [],
  group_members: [],
  messages: [],
  conversations: [],
  robots: [],
  robot_groups: [],
  admins: [],
};

let autoIncrement = {
  users: 1,
  groups: 1,
  group_members: 1,
  conversations: 1,
  robots: 1,
  robot_groups: 1,
  admins: 1,
};

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const saved = JSON.parse(raw);
      data = { ...data, ...saved.data };
      autoIncrement = { ...autoIncrement, ...saved.autoIncrement };
    }
  } catch (e) {
    console.warn('Load db file failed, using empty:', e.message);
  }
}

function save() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify({ data, autoIncrement }, null, 2));
  } catch (e) {
    console.error('Save db failed:', e.message);
  }
}

// 加载
load();

// 兼容 pg 的 query 接口
function query(sql, params = []) {
  sql = sql.trim();
  const upper = sql.toUpperCase();

  // SELECT
  if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
    const rows = execSelect(sql, params);
    return { rows, rowCount: rows.length };
  }

  // INSERT
  if (upper.startsWith('INSERT')) {
    const result = execInsert(sql, params);
    return result;
  }

  // UPDATE
  if (upper.startsWith('UPDATE')) {
    const result = execUpdate(sql, params);
    return result;
  }

  // DELETE
  if (upper.startsWith('DELETE')) {
    const result = execDelete(sql, params);
    return result;
  }

  // CREATE / CREATE INDEX 等 DDL，直接忽略
  return { rows: [], rowCount: 0 };
}

// ---- 简单解析器 ----

function execSelect(sql, params) {
  // 提取 FROM 后的表名
  const fromMatch = sql.match(/FROM\s+(\w+)/i);
  if (!fromMatch) return [];
  const table = fromMatch[1];
  let rows = data[table] || [];

  // WHERE (简单支持 AND 连接的 = 条件)
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|OFFSET|$)/i);
  if (whereMatch) {
    const whereStr = whereMatch[1].trim();
    const conditions = parseWhere(whereStr, params);
    rows = rows.filter(row => {
      return conditions.every(cond => {
        const val = getParamValue(params, cond.paramIndex);
        if (cond.op === '=') return String(row[cond.field]) === String(val);
        if (cond.op === '!=') return String(row[cond.field]) !== String(val);
        if (cond.op === '>') return Number(row[cond.field]) > Number(val);
        if (cond.op === '<') return Number(row[cond.field]) < Number(val);
        if (cond.op === '>=') return Number(row[cond.field]) >= Number(val);
        if (cond.op === '<=') return Number(row[cond.field]) <= Number(val);
        if (cond.op === 'LIKE') {
          const pattern = String(val).replace(/%/g, '.*');
          return new RegExp(pattern, 'i').test(String(row[cond.field]));
        }
        return true;
      });
    });
  }

  // ORDER BY
  const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
  if (orderMatch) {
    const field = orderMatch[1];
    const dir = (orderMatch[2] || 'ASC').toUpperCase();
    rows.sort((a, b) => {
      const va = a[field];
      const vb = b[field];
      if (va < vb) return dir === 'ASC' ? -1 : 1;
      if (va > vb) return dir === 'ASC' ? 1 : -1;
      return 0;
    });
  }

  // LIMIT + OFFSET
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
  if (limitMatch) {
    const limit = parseInt(limitMatch[1]);
    const offset = offsetMatch ? parseInt(offsetMatch[1]) : 0;
    rows = rows.slice(offset, offset + limit);
  }

  // JOIN users 简单处理
  const joinMatch = sql.match(/JOIN\s+(\w+)\s+ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/i);
  if (joinMatch) {
    const joinTable = joinMatch[1];
    const leftField = joinMatch[3];
    const rightField = joinMatch[5];
    const leftTable = joinMatch[2];
    const rightTable = joinMatch[4];
    const joinData = data[joinTable] || [];
    rows = rows.map(row => {
      const joined = joinData.find(j => {
        const leftVal = leftTable === table ? row[leftField] : j[leftField];
        const rightVal = rightTable === joinTable ? j[rightField] : row[rightField];
        return String(leftVal) === String(rightVal);
      });
      return { ...row, ...joined };
    });
  }

  // COUNT(*)
  if (/SELECT\s+COUNT\(\*\)/i.test(sql)) {
    return [{ count: String(rows.length) }];
  }

  return rows;
}

function execInsert(sql, params) {
  const tableMatch = sql.match(/INTO\s+(\w+)/i);
  if (!tableMatch) return { rows: [], rowCount: 0 };
  const table = tableMatch[1];

  const fieldsMatch = sql.match(/\(([^)]+)\)/);
  const fields = fieldsMatch ? fieldsMatch[1].split(',').map(s => s.trim()) : [];

  const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
  const values = valuesMatch ? valuesMatch[1].split(',').map(s => s.trim()) : [];

  const row = {};
  fields.forEach((field, i) => {
    const val = values[i];
    if (val === '$1'.replace('1', i + 1) || val === '?') {
      row[field] = getParamValue(params, i);
    } else if (val.toUpperCase() === 'DEFAULT' || val === 'CURRENT_TIMESTAMP') {
      // skip, use default
    } else {
      row[field] = val.replace(/'/g, '');
    }
  });

  // 自增 ID
  if (!row.id && data[table] && autoIncrement[table] !== undefined) {
    row.id = autoIncrement[table]++;
  }

  // 雪花 ID（messages 表）
  if (table === 'messages' && !row.id) {
    row.id = generateId();
  }

  // 时间戳
  const now = new Date().toISOString();
  if (data[table] && data[table].length > 0 && 'created_at' in data[table][0]) {
    if (!row.created_at) row.created_at = now;
    if (!row.updated_at) row.updated_at = now;
  }
  if (!row.joined_at && table === 'group_members') row.joined_at = now;

  if (!data[table]) data[table] = [];
  data[table].push(row);
  save();

  return { rows: [row], rowCount: 1 };
}

function execUpdate(sql, params) {
  const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
  if (!tableMatch) return { rows: [], rowCount: 0 };
  const table = tableMatch[1];

  const setMatch = sql.match(/SET\s+(.+?)(?:WHERE|$)/i);
  if (!setMatch) return { rows: [], rowCount: 0 };

  const setStr = setMatch[1].trim();
  const setPairs = setStr.split(',').map(s => {
    const [field, val] = s.trim().split(/\s*=\s*/);
    return { field: field.trim(), val: val.trim() };
  });

  const whereMatch = sql.match(/WHERE\s+(.+)$/i);
  let conditions = [];
  if (whereMatch) {
    conditions = parseWhere(whereMatch[1].trim(), params);
  }

  let count = 0;
  const updated = [];
  data[table] = (data[table] || []).map(row => {
    if (conditions.every(cond => {
      const val = getParamValue(params, cond.paramIndex);
      return String(row[cond.field]) === String(val);
    })) {
      const newRow = { ...row };
      setPairs.forEach(pair => {
        if (pair.val.startsWith('$')) {
          const idx = parseInt(pair.val.slice(1)) - 1;
          newRow[pair.field] = getParamValue(params, idx);
        } else if (pair.val === 'NOW()' || pair.val === 'CURRENT_TIMESTAMP') {
          newRow[pair.field] = new Date().toISOString();
        } else if (pair.val.match(/^['"].*['"]$/)) {
          newRow[pair.field] = pair.val.replace(/['"]/g, '');
        } else if (!isNaN(pair.val)) {
          newRow[pair.field] = Number(pair.val);
        } else {
          // 可能是字段引用，比如 member_count + 1
          const incMatch = pair.val.match(/(\w+)\s*\+\s*(\d+)/);
          if (incMatch) {
            newRow[pair.field] = Number(row[incMatch[1]]) + Number(incMatch[2]);
          } else {
            newRow[pair.field] = pair.val;
          }
        }
      });
      newRow.updated_at = new Date().toISOString();
      count++;
      updated.push(newRow);
      return newRow;
    }
    return row;
  });

  save();
  return { rows: updated, rowCount: count };
}

function execDelete(sql, params) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) return { rows: [], rowCount: 0 };
  const table = tableMatch[1];

  const whereMatch = sql.match(/WHERE\s+(.+)$/i);
  let conditions = [];
  if (whereMatch) {
    conditions = parseWhere(whereMatch[1].trim(), params);
  }

  const before = data[table]?.length || 0;
  const deleted = [];
  data[table] = (data[table] || []).filter(row => {
    const match = conditions.every(cond => {
      const val = getParamValue(params, cond.paramIndex);
      return String(row[cond.field]) === String(val);
    });
    if (match) deleted.push(row);
    return !match;
  });
  const count = before - (data[table]?.length || 0);

  // 如果是群成员删除，更新 member_count
  if (table === 'group_members' && deleted.length > 0) {
    deleted.forEach(d => {
      const group = data.groups.find(g => g.id === d.group_id);
      if (group) group.member_count = Math.max(0, group.member_count - 1);
    });
  }

  save();
  return { rows: deleted, rowCount: count };
}

function parseWhere(whereStr, params) {
  const parts = whereStr.split(/\s+AND\s+/i);
  let paramIdx = 0;
  return parts.map(part => {
    part = part.trim();
    const likeMatch = part.match(/(\w+)\s+LIKE\s+\$(\d+)/i);
    if (likeMatch) {
      return { field: likeMatch[1], op: 'LIKE', paramIndex: parseInt(likeMatch[2]) - 1 };
    }
    const eqMatch = part.match(/(\w+)\s*=\s*\$(\d+)/);
    if (eqMatch) {
      return { field: eqMatch[1], op: '=', paramIndex: parseInt(eqMatch[2]) - 1 };
    }
    const neqMatch = part.match(/(\w+)\s*!=\s*\$(\d+)/);
    if (neqMatch) {
      return { field: neqMatch[1], op: '!=', paramIndex: parseInt(neqMatch[2]) - 1 };
    }
    // ANY 数组匹配 (pg 语法)，简化处理
    const anyMatch = part.match(/(\w+)\s*=\s*ANY\(\$(\d+)\)/i);
    if (anyMatch) {
      return { field: anyMatch[1], op: 'ANY', paramIndex: parseInt(anyMatch[2]) - 1 };
    }
    // id < $1 之类
    const cmpMatch = part.match(/(\w+)\s*(<|>|<=|>=)\s*\$(\d+)/);
    if (cmpMatch) {
      return { field: cmpMatch[1], op: cmpMatch[2], paramIndex: parseInt(cmpMatch[3]) - 1 };
    }
    return { field: '', op: '=', paramIndex: paramIdx++, value: part };
  });
}

function getParamValue(params, index) {
  if (params && Array.isArray(params) && index < params.length) {
    return params[index];
  }
  return null;
}

function initTables() {
  console.log('JSON file database initialized');
}

module.exports = {
  query,
  getClient: () => ({ query, release: () => {} }),
  pool: { query },
  initTables,
  _data: data,
  _save: save,
};
