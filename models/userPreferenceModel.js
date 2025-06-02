const db = require('../config/test-database');

const UserPreference = {};

// 记录用户浏览景点的历史
UserPreference.recordAttractionView = (userId, attractionId, callback) => {
    // 首先检查表结构
    db.query(`
        SELECT GROUP_CONCAT(COLUMN_NAME) as existing_columns
        FROM information_schema.COLUMNS 
        WHERE TABLE_NAME = 'user_attraction_history' 
        AND COLUMN_NAME IN ('first_viewed_at', 'last_viewed_at')
    `, (err, results) => {
        if (err) return callback(err);

        const existingColumns = results[0].existing_columns ? results[0].existing_columns.split(',') : [];
        const columnsToAdd = [];

        if (!existingColumns.includes('first_viewed_at')) {
            columnsToAdd.push('ADD COLUMN first_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
        }
        if (!existingColumns.includes('last_viewed_at')) {
            columnsToAdd.push('ADD COLUMN last_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
        }

        // 如果需要添加字段
        if (columnsToAdd.length > 0) {
            const alterQuery = `ALTER TABLE user_attraction_history ${columnsToAdd.join(', ')}`;
            db.query(alterQuery, (err) => {
                if (err) return callback(err);
                insertOrUpdateHistory();
            });
        } else {
            insertOrUpdateHistory();
        }
    });

    // 插入或更新浏览记录
    function insertOrUpdateHistory() {
        const sql = `
            INSERT INTO user_attraction_history 
                (user_id, attraction_id, view_count, last_viewed_at, first_viewed_at)
            VALUES (?, ?, 1, NOW(), NOW())
            ON DUPLICATE KEY UPDATE 
                view_count = view_count + 1,
                last_viewed_at = NOW()
        `;
        db.query(sql, [userId, attractionId], (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    }
};

// 记录用户对景点的评分
UserPreference.saveAttractionRating = (userId, attractionId, rating, callback) => {
    // 首先检查表结构
    db.query(`
        SELECT GROUP_CONCAT(COLUMN_NAME) as existing_columns
        FROM information_schema.COLUMNS 
        WHERE TABLE_NAME = 'user_attraction_ratings' 
        AND COLUMN_NAME IN ('created_at', 'updated_at')
    `, (err, results) => {
        if (err) return callback(err);

        const existingColumns = results[0].existing_columns ? results[0].existing_columns.split(',') : [];
        const columnsToAdd = [];

        if (!existingColumns.includes('created_at')) {
            columnsToAdd.push('ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
        }
        if (!existingColumns.includes('updated_at')) {
            columnsToAdd.push('ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
        }

        // 如果需要添加字段
        if (columnsToAdd.length > 0) {
            const alterQuery = `ALTER TABLE user_attraction_ratings ${columnsToAdd.join(', ')}`;
            db.query(alterQuery, (err) => {
                if (err) return callback(err);
                insertOrUpdateRating();
            });
        } else {
            insertOrUpdateRating();
        }
    });

    // 插入或更新评分
    function insertOrUpdateRating() {
        const sql = `
            INSERT INTO user_attraction_ratings
                (user_id, attraction_id, rating, created_at, updated_at)
            VALUES (?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                rating = VALUES(rating),
                updated_at = NOW()
        `;
        // Ensure rating is within a valid range, e.g., 0-5
        const validRating = Math.max(0, Math.min(5, parseFloat(rating)));
        db.query(sql, [userId, attractionId, validRating], (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    }
};

// 获取用户的景点偏好
UserPreference.getUserPreferences = (userId, callback) => {
    const sql = `
        SELECT 
            a.category,
            COUNT(DISTINCT h.attraction_id) as attractions_viewed_in_category,
            SUM(h.view_count) as total_views_in_category,
            AVG(r.rating) as avg_rating_in_category
        FROM attractions a
        LEFT JOIN user_attraction_history h ON a.id = h.attraction_id AND h.user_id = ?
        LEFT JOIN user_attraction_ratings r ON a.id = r.attraction_id AND r.user_id = ?
        WHERE a.id IN (SELECT DISTINCT attraction_id FROM user_attraction_history WHERE user_id = ?) 
           OR a.id IN (SELECT DISTINCT attraction_id FROM user_attraction_ratings WHERE user_id = ?)
        GROUP BY a.category
    `;
    db.query(sql, [userId, userId, userId, userId], (err, rows) => {
        if (err) return callback(err);
        callback(null, rows);
    });
};

// 获取相似用户喜欢的景点
UserPreference.getSimilarUsersAttractions = (userId, limit = 10, callback) => {
    // This query is quite complex and might be slow. 
    // Consider simplifying or using a different recommendation strategy if performance is an issue.
    const sql = `
        SELECT a.*, AVG(r.rating) as avg_rating_from_others
        FROM attractions a
        JOIN user_attraction_ratings r ON a.id = r.attraction_id
        WHERE r.user_id != ? 
        AND r.rating >= 4  -- Example: consider highly rated by others
        AND a.id NOT IN (SELECT attraction_id FROM user_attraction_history WHERE user_id = ?) -- Not viewed by current user
        GROUP BY a.id
        ORDER BY AVG(r.rating) DESC, COUNT(DISTINCT r.user_id) DESC -- Popular among others
        LIMIT ?;
    `;
    db.query(sql, [userId, userId, limit], (err, rows) => {
        if (err) return callback(err);
        callback(null, rows);
    });
};

module.exports = UserPreference; 