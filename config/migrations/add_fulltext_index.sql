-- 为日记表添加全文搜索索引
ALTER TABLE travel_diaries ADD FULLTEXT INDEX diary_fulltext_idx (title, content);

-- 为日记浏览记录创建表（如果不存在）
CREATE TABLE IF NOT EXISTS diary_views (
  id INT PRIMARY KEY AUTO_INCREMENT,
  diary_id INT NOT NULL,
  user_id INT NOT NULL,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (diary_id) REFERENCES travel_diaries(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user_information(id) ON DELETE CASCADE,
  UNIQUE KEY unique_view (diary_id, user_id)
); 