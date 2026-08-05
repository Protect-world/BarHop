const mysql = require('mysql2/promise');
const config = require('../config');

let pool = null;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000
    });

    try {
      const connection = await pool.getConnection();
      await connection.execute('SET NAMES utf8mb4');
      await connection.execute('SET CHARACTER SET utf8mb4');
      console.log('[MySQL] 连接成功');
      connection.release();
    } catch (error) {
      console.error('[MySQL] 连接失败:', error);
    }
  }
  return pool;
}

const db = {
  async query(sql, params = []) {
    const pool = await getPool();
    // 使用 query 而非 execute，支持 LIMIT ? 等动态参数
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async insert(table, data) {
    const pool = await getPool();
    const keys = Object.keys(data);
    const values = keys.map(key => data[key]);
    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
    const [result] = await pool.execute(sql, values);
    return result;
  },

  async insertMany(table, dataArray) {
    if (!dataArray || dataArray.length === 0) return;
    
    const pool = await getPool();
    const keys = Object.keys(dataArray[0]);
    const values = dataArray.map(item => keys.map(key => item[key]));
    const placeholders = dataArray.map(() => `(${keys.map(() => '?').join(',')})`).join(',');
    const flatValues = values.flat();
    const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES ${placeholders} ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`;
    await pool.execute(sql, flatValues);
  },

  async findById(table, id) {
    const pool = await getPool();
    const [rows] = await pool.execute(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    return rows[0] || null;
  },

  async findOne(table, where) {
    const pool = await getPool();
    const keys = Object.keys(where);
    const values = keys.map(key => where[key]);
    const conditions = keys.map(key => `${key} = ?`).join(' AND ');
    const [rows] = await pool.execute(`SELECT * FROM ${table} WHERE ${conditions}`, values);
    return rows[0] || null;
  },

  async update(table, id, data) {
    const pool = await getPool();
    const keys = Object.keys(data);
    const values = keys.map(key => data[key]);
    const setClause = keys.map(key => `${key} = ?`).join(',');
    const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
    const [result] = await pool.execute(sql, [...values, id]);
    return result;
  },

  async delete(table, id) {
    const pool = await getPool();
    const [result] = await pool.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
    return result;
  }
};

module.exports = db;