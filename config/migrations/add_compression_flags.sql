-- 显示所有 FULLTEXT 索引
SELECT DISTINCT index_name 
FROM information_schema.statistics 
WHERE table_schema = DATABASE() 
AND table_name = 'travel_diaries'
AND index_type = 'FULLTEXT';

-- 删除现有的 FULLTEXT 索引
ALTER TABLE travel_diaries
DROP INDEX diary_fulltext_idx;

-- 为travel_diaries表添加压缩标记
ALTER TABLE travel_diaries
ADD COLUMN is_compressed BOOLEAN DEFAULT FALSE,
MODIFY COLUMN content MEDIUMBLOB;

-- 为diary_sections表添加压缩标记
ALTER TABLE diary_sections
ADD COLUMN is_compressed BOOLEAN DEFAULT FALSE,
MODIFY COLUMN section_content MEDIUMBLOB;

-- 只在标题上创建 FULLTEXT 索引
ALTER TABLE travel_diaries
ADD FULLTEXT INDEX diary_fulltext_idx (title); 