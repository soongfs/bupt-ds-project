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