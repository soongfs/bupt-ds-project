-- 创建用户关注表
CREATE TABLE IF NOT EXISTS user_follows (
  id INT PRIMARY KEY AUTO_INCREMENT,
  follower_id INT NOT NULL,
  followed_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (follower_id) REFERENCES user_information(id) ON DELETE CASCADE,
  FOREIGN KEY (followed_id) REFERENCES user_information(id) ON DELETE CASCADE,
  UNIQUE KEY unique_follow (follower_id, followed_id)
);

-- 修改 travel_diaries 表，添加 tips 列
ALTER TABLE travel_diaries
ADD COLUMN tips TEXT DEFAULT NULL AFTER content;

-- 修改 travel_diaries 表，添加 updated_at 列
ALTER TABLE travel_diaries
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP; 