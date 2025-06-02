-- 用户景点评分表
CREATE TABLE IF NOT EXISTS user_attraction_ratings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    attraction_id INT NOT NULL,
    rating DECIMAL(2,1) NOT NULL CHECK (rating >= 0 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user_information(id) ON DELETE CASCADE,
    FOREIGN KEY (attraction_id) REFERENCES attractions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_attraction_rating (user_id, attraction_id),
    INDEX idx_user_rating (user_id),
    INDEX idx_attraction_rating (attraction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户景点浏览历史表
CREATE TABLE IF NOT EXISTS user_attraction_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    attraction_id INT NOT NULL,
    view_count INT DEFAULT 1,
    last_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    first_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user_information(id) ON DELETE CASCADE,
    FOREIGN KEY (attraction_id) REFERENCES attractions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_attraction_history (user_id, attraction_id),
    INDEX idx_user_history (user_id),
    INDEX idx_attraction_history (attraction_id),
    INDEX idx_last_viewed (last_viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; 