-- 更新travel_diaries表结构
ALTER TABLE travel_diaries
  MODIFY COLUMN categories VARCHAR(255) DEFAULT NULL,
  MODIFY COLUMN view_count INT DEFAULT 0,
  MODIFY COLUMN like_count INT DEFAULT 0,
  MODIFY COLUMN comment_count INT DEFAULT 0,
  MODIFY COLUMN rating DECIMAL(3,2) DEFAULT 0.00;

-- 确保所有计数字段不为NULL
UPDATE travel_diaries 
SET 
  categories = IFNULL(categories, ''),
  view_count = IFNULL(view_count, 0),
  like_count = IFNULL(like_count, 0),
  comment_count = IFNULL(comment_count, 0),
  rating = IFNULL(rating, 0.00); 