// 一次性迁移脚本：v1.1 打卡表（执行后可删除）
require('dotenv').config();
const db = require('./utils/db');

(async () => {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS checkins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      bar_id VARCHAR(36) NOT NULL,
      bar_name VARCHAR(128) NOT NULL DEFAULT '',
      content VARCHAR(255) NOT NULL DEFAULT '',
      images TEXT DEFAULT NULL,
      lat DECIMAL(10,6) NOT NULL,
      lng DECIMAL(10,6) NOT NULL,
      distance_meter INT NOT NULL DEFAULT 0,
      is_first TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_bar (user_id, bar_id),
      INDEX idx_user_time (user_id, updated_at),
      INDEX idx_bar_id (bar_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    console.log('✅ checkins 表已创建');

    try {
      await db.query('ALTER TABLE users ADD COLUMN checkin_count INT NOT NULL DEFAULT 0');
      console.log('✅ users.checkin_count 字段已添加');
    } catch (e) {
      console.log('⚠️ users.checkin_count:', e.message);
    }

    const r = await db.query('SELECT COUNT(*) AS c FROM checkins');
    console.log('✅ 验证通过，checkins 行数:', r[0].c);
  } catch (e) {
    console.error('❌ 迁移失败:', e.message);
  }
  process.exit(0);
})();
