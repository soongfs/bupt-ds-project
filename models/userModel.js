// models/userModel.js
const db = require('../config/test-database');

module.exports = {
    // 通过ID查找用户
    findById: (id, callback) => {
        db.query(
            'SELECT id, username, email, avatar, gender, birthday, location, bio, interests FROM user_information WHERE id = ?',
            [id],
            (error, results) => {
                if (error) {
                    console.error('查询用户失败:', error);
                    return callback(error);
                }
                callback(null, results[0] || null);
            }
        );
    },

    // 更新用户信息
    update: (id, data, callback) => {
        db.query(
            'UPDATE user_information SET ? WHERE id = ?',
            [data, id],
            (error, result) => {
                if (error) {
                    console.error('更新用户失败:', error);
                    return callback(error);
                }
                callback(null, result.affectedRows > 0);
            }
        );
    },

    // 检查用户名是否存在
    isUsernameExists: (username, excludeId = null, callback) => {
        const sql = excludeId
            ? 'SELECT 1 FROM user_information WHERE username = ? AND id != ? LIMIT 1'
            : 'SELECT 1 FROM user_information WHERE username = ? LIMIT 1';
        const params = excludeId ? [username, excludeId] : [username];
        
        db.query(sql, params, (error, results) => {
            if (error) {
                console.error('检查用户名失败:', error);
                return callback(error);
            }
            callback(null, results.length > 0);
        });
    }
};
