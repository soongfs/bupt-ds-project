const db = require("../config/test-database");

module.exports = {
    // 关注用户
    followUser: (followerId, followingId, callback) => {
        const sql = `
            INSERT INTO user_follows (follower_id, following_id)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP
        `;
        db.query(sql, [followerId, followingId], (err) => {
            if (err) {
                console.error('关注用户失败:', err);
                return callback(err);
            }
            callback(null);
        });
    },

    // 取消关注
    unfollowUser: (followerId, followingId, callback) => {
        const sql = `
            DELETE FROM user_follows
            WHERE follower_id = ? AND following_id = ?
        `;
        db.query(sql, [followerId, followingId], (err) => {
            if (err) {
                console.error('取消关注失败:', err);
                return callback(err);
            }
            callback(null);
        });
    },

    // 检查是否已关注
    isFollowing: (followerId, followingId, callback) => {
        const sql = `
            SELECT COUNT(*) as count
            FROM user_follows
            WHERE follower_id = ? AND following_id = ?
        `;
        db.query(sql, [followerId, followingId], (err, results) => {
            if (err) {
                console.error('检查关注状态失败:', err);
                return callback(err);
            }
            callback(null, results[0].count > 0);
        });
    },

    // 获取用户的粉丝数
    getFollowersCount: (userId, callback) => {
        const sql = `
            SELECT COUNT(*) as count
            FROM user_follows
            WHERE following_id = ?
        `;
        db.query(sql, [userId], (err, results) => {
            if (err) {
                console.error('获取粉丝数失败:', err);
                return callback(err);
            }
            callback(null, results[0].count);
        });
    },

    // 获取用户关注的人数
    getFollowingCount: (userId, callback) => {
        const sql = `
            SELECT COUNT(*) as count
            FROM user_follows
            WHERE follower_id = ?
        `;
        db.query(sql, [userId], (err, results) => {
            if (err) {
                console.error('获取关注数失败:', err);
                return callback(err);
            }
            callback(null, results[0].count);
        });
    },

    // 获取用户的粉丝列表
    getFollowers: (userId, limit = 10, offset = 0, callback) => {
        const sql = `
            SELECT u.*
            FROM user_follows f
            JOIN user_information u ON f.follower_id = u.id
            WHERE f.following_id = ?
            ORDER BY f.created_at DESC
            LIMIT ? OFFSET ?
        `;
        db.query(sql, [userId, limit, offset], (err, results) => {
            if (err) {
                console.error('获取粉丝列表失败:', err);
                return callback(err);
            }
            callback(null, results);
        });
    },

    // 获取用户关注的人列表
    getFollowing: (userId, limit = 10, offset = 0, callback) => {
        const sql = `
            SELECT u.*
            FROM user_follows f
            JOIN user_information u ON f.following_id = u.id
            WHERE f.follower_id = ?
            ORDER BY f.created_at DESC
            LIMIT ? OFFSET ?
        `;
        db.query(sql, [userId, limit, offset], (err, results) => {
            if (err) {
                console.error('获取关注列表失败:', err);
                return callback(err);
            }
            callback(null, results);
        });
    }
}; 