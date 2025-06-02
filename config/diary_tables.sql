-- 日记评分表
CREATE TABLE IF NOT EXISTS diary_ratings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  diary_id INT NOT NULL,
  user_id INT NOT NULL,
  rating DECIMAL(2,1) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_diary_user_rating (diary_id, user_id),
  FOREIGN KEY (diary_id) REFERENCES travel_diaries(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user_information(id) ON DELETE CASCADE
);

-- 日记收藏表
CREATE TABLE IF NOT EXISTS diary_favorites (
  id INT PRIMARY KEY AUTO_INCREMENT,
  diary_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_diary_user_favorite (diary_id, user_id),
  FOREIGN KEY (diary_id) REFERENCES travel_diaries(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user_information(id) ON DELETE CASCADE
);

-- 日记点赞表
CREATE TABLE IF NOT EXISTS diary_likes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  diary_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_diary_user_like (diary_id, user_id),
  FOREIGN KEY (diary_id) REFERENCES travel_diaries(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user_information(id) ON DELETE CASCADE
);

-- 为travel_diaries表添加新字段
ALTER TABLE travel_diaries
ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS favorite_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS like_count INT DEFAULT 0; 