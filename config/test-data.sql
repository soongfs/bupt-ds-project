-- 插入用户浏览历史数据
INSERT INTO user_attraction_history (user_id, attraction_id, view_count, last_viewed_at, first_viewed_at) VALUES
(1, 1, 3, NOW(), DATE_SUB(NOW(), INTERVAL 30 DAY)),
(1, 2, 5, NOW(), DATE_SUB(NOW(), INTERVAL 25 DAY)),
(1, 3, 2, NOW(), DATE_SUB(NOW(), INTERVAL 20 DAY)),
(2, 1, 4, NOW(), DATE_SUB(NOW(), INTERVAL 15 DAY)),
(2, 4, 1, NOW(), DATE_SUB(NOW(), INTERVAL 10 DAY)),
(3, 2, 2, NOW(), DATE_SUB(NOW(), INTERVAL 5 DAY));

-- 插入用户评分数据
INSERT INTO user_attraction_ratings (user_id, attraction_id, rating, created_at, updated_at) VALUES
(1, 1, 4.5, NOW(), NOW()),
(1, 2, 5.0, NOW(), NOW()),
(1, 3, 3.5, NOW(), NOW()),
(2, 1, 4.0, NOW(), NOW()),
(2, 4, 4.8, NOW(), NOW()),
(3, 2, 4.2, NOW(), NOW()); 