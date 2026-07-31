CREATE TABLE IF NOT EXISTS bars (
  id VARCHAR(36) PRIMARY KEY COMMENT '酒吧唯一标识',
  name VARCHAR(100) NOT NULL COMMENT '酒吧名称',
  address VARCHAR(255) NOT NULL COMMENT '酒吧地址',
  lat DECIMAL(10,7) NOT NULL COMMENT '纬度(GCJ-02)',
  lng DECIMAL(10,7) NOT NULL COMMENT '经度(GCJ-02)',
  phone VARCHAR(20) DEFAULT NULL COMMENT '联系电话',
  hours VARCHAR(100) DEFAULT NULL COMMENT '营业时间',
  avg_rating DECIMAL(2,1) DEFAULT 0.0 COMMENT '平均评分',
  tags VARCHAR(255) DEFAULT NULL COMMENT '分类标签，逗号分隔',
  photos TEXT DEFAULT NULL COMMENT '照片URL，JSON数组',
  distance INT DEFAULT 0 COMMENT '距离(米)',
  source VARCHAR(20) NOT NULL DEFAULT 'lbs' COMMENT '数据来源: lbs/mock',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_lat_lng (lat, lng),
  INDEX idx_name (name),
  INDEX idx_tags (tags),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='酒吧表';

INSERT IGNORE INTO bars (id, name, address, lat, lng, phone, hours, avg_rating, tags, photos, distance, source) VALUES
('real_001', 'Chengdu Pub', 'No.15 Yulin Road, Wuhou District, Chengdu', 30.562854, 104.036782, '028-85561234', '19:00-02:00', 4.8, '清吧', '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cozy%20bar%20interior%20with%20warm%20lighting&image_size=square\"]', 0, 'manual'),
('real_002', 'Helens', 'No.88 Chunxi Road Pedestrian Street, Jinjiang District, Chengdu', 30.571283, 104.066285, '028-86661234', '17:00-04:00', 4.6, '清吧', '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20bar%20with%20neon%20lights&image_size=square\"]', 0, 'manual'),
('real_003', 'Erma Pub', 'Jiuyanqiao Bar Street, Jinjiang District, Chengdu', 30.554628, 104.082163, '028-84441234', '18:00-03:00', 4.7, '清吧', '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=traditional%20Chinese%20bar%20decor&image_size=square\"]', 0, 'manual'),
('real_004', 'Panda Craft Beer', 'No.288 Tianfu Third Street, High-tech Zone, Chengdu', 30.540682, 104.051782, '028-87771234', '16:00-02:00', 4.9, '精酿吧', '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=craft%20beer%20taproom%20with%20wooden%20furniture&image_size=square\"]', 0, 'manual'),
('real_005', 'The Tides', 'Tongzilin South Road, Wuhou District, Chengdu', 30.548621, 104.042736, '028-83331234', '18:30-02:30', 4.5, '鸡尾酒吧', '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=elegant%20cocktail%20bar%20with%20marble%20counter&image_size=square\"]', 0, 'manual'),
('real_006', 'Langqiao Bar', 'No.66 Binjiang Middle Road, Jinjiang District, Chengdu', 30.562183, 104.065728, '028-82221234', '17:00-04:00', 4.4, '鸡尾酒吧', '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=riverside%20bar%20with%20city%20view&image_size=square\"]', 0, 'manual'),
('real_007', 'COMMUNE', 'No.56 Jianshe Road, Chenghua District, Chengdu', 30.601283, 104.071282, '028-89991234', '15:00-04:00', 4.6, '精酿吧', '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=industrial%20style%20bar%20with%20exposed%20bricks&image_size=square\"]', 0, 'manual'),
('real_008', 'SPACE', 'Kuanzhai Alley, Qingyang District, Chengdu', 30.579283, 104.036285, '028-81111234', '20:00-05:00', 4.3, '鸡尾酒吧', '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=luxury%20nightclub%20with%20disco%20ball&image_size=square\"]', 0, 'manual'),
('real_009', 'Doujiu Pub', 'Guangchang Road, Hongguang Town, Pidu District, Chengdu', 30.701283, 103.996285, '028-86664321', '18:00-02:00', 4.5, '清吧', '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=casual%20neighborhood%20bar%20atmosphere&image_size=square\"]', 0, 'manual'),
('real_010', '1903 Music Bar', 'Huayang Street, Shuangliu District, Chengdu', 30.511283, 104.056285, '028-85554321', '19:00-03:00', 4.4, '精酿吧', '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=live%20music%20bar%20stage&image_size=square\"]', 0, 'manual');

CREATE TABLE IF NOT EXISTS bar_search_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  query_key VARCHAR(255) NOT NULL UNIQUE COMMENT '搜索缓存键',
  data TEXT NOT NULL COMMENT '缓存数据(JSON)',
  ttl INT NOT NULL COMMENT '过期时间(秒)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_query_key (query_key),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='搜索缓存表';

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY COMMENT '用户唯一标识',
  openid VARCHAR(100) NOT NULL UNIQUE COMMENT '微信openid',
  nickname VARCHAR(50) DEFAULT NULL COMMENT '昵称',
  avatar VARCHAR(500) DEFAULT NULL COMMENT '头像URL',
  signature VARCHAR(200) DEFAULT NULL COMMENT '个性签名',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

CREATE TABLE IF NOT EXISTS favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
  bar_id VARCHAR(36) NOT NULL COMMENT '酒吧ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_bar (user_id, bar_id),
  INDEX idx_user_id (user_id),
  INDEX idx_bar_id (bar_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收藏表';

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
  bar_id VARCHAR(36) NOT NULL COMMENT '酒吧ID',
  rating DECIMAL(2,1) NOT NULL COMMENT '评分 1-5',
  content TEXT DEFAULT NULL COMMENT '评价内容',
  images TEXT DEFAULT NULL COMMENT '图片JSON数组',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_bar_id (bar_id),
  INDEX idx_rating (rating),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评价表';