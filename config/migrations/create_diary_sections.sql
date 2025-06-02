-- 创建日记章节表
CREATE TABLE IF NOT EXISTS diary_sections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  diary_id INT NOT NULL,
  section_title VARCHAR(255),
  section_content TEXT,
  day_number INT,
  section_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (diary_id) REFERENCES travel_diaries(id) ON DELETE CASCADE,
  INDEX idx_diary_order (diary_id, section_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; 