-- 删除现有的 FULLTEXT 索引
ALTER TABLE travel_diaries
DROP INDEX diary_fulltext_idx;

-- 添加用于搜索的内容列（使用VARCHAR限制长度）
ALTER TABLE travel_diaries
ADD COLUMN search_content VARCHAR(500);

-- 创建组合全文索引
ALTER TABLE travel_diaries
ADD FULLTEXT INDEX diary_fulltext_idx (title, search_content);

-- 更新现有数据的搜索内容
UPDATE travel_diaries
SET search_content = LEFT(REGEXP_REPLACE(content, '<[^>]*>', ' '), 500)
WHERE content IS NOT NULL; 