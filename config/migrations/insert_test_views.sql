-- 插入测试浏览记录
INSERT INTO diary_views (diary_id, user_id, viewed_at)
SELECT 
    d.id as diary_id,
    u.id as user_id,
    DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 30) DAY) as viewed_at
FROM travel_diaries d
CROSS JOIN user_information u
WHERE RAND() < 0.3  -- 30%的概率生成浏览记录
ON DUPLICATE KEY UPDATE viewed_at = VALUES(viewed_at);

-- 更新日记的浏览次数
UPDATE travel_diaries d
SET view_count = (
    SELECT COUNT(*)
    FROM diary_views
    WHERE diary_id = d.id
); 