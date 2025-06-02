-- 用户景点浏览历史表
CREATE TABLE IF NOT EXISTS user_attraction_history (
    user_id INT NOT NULL,
    attraction_id INT NOT NULL,
    view_count INT DEFAULT 1,
    last_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, attraction_id),
    FOREIGN KEY (user_id) REFERENCES user_information(id) ON DELETE CASCADE,
    FOREIGN KEY (attraction_id) REFERENCES attractions(id) ON DELETE CASCADE,
    INDEX idx_user_views (user_id, view_count),
    INDEX idx_last_viewed (user_id, last_viewed_at)
);

-- 用户景点评分表
CREATE TABLE IF NOT EXISTS user_attraction_ratings (
    user_id INT NOT NULL,
    attraction_id INT NOT NULL,
    rating DECIMAL(2,1) NOT NULL CHECK (rating >= 0 AND rating <= 5),
    rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, attraction_id),
    FOREIGN KEY (user_id) REFERENCES user_information(id) ON DELETE CASCADE,
    FOREIGN KEY (attraction_id) REFERENCES attractions(id) ON DELETE CASCADE,
    INDEX idx_user_ratings (user_id, rating),
    INDEX idx_attraction_ratings (attraction_id, rating)
);

-- 为attractions表添加新的列和索引
-- 注意：这些语句可能会报错"列已存在"，这是正常的，可以忽略
ALTER TABLE attractions
ADD COLUMN price_level TINYINT DEFAULT 2,
ADD CONSTRAINT chk_price_level CHECK (price_level BETWEEN 1 AND 4);

ALTER TABLE attractions
ADD COLUMN duration INT DEFAULT 120 COMMENT '预计游览时间（分钟）';

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_category_rating ON attractions(category, rating);
CREATE INDEX IF NOT EXISTS idx_price_duration ON attractions(price_level, duration); 