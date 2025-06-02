const db = require('../config/test-database');

class Message {
    // 创建新消息
    static create(senderId, receiverId, content, callback) {
        const query = `
            INSERT INTO messages (sender_id, receiver_id, content, created_at, is_read)
            VALUES (?, ?, ?, NOW(), 0)
        `;
        db.query(query, [senderId, receiverId, content], (err, result) => {
            if (err) return callback(err);
            callback(null, result.insertId);
        });
    }

    // 获取两个用户之间的对话历史
    static getConversation(userId1, userId2, limit = 20, offset = 0, callback) {
        const query = `
            SELECT 
                m.*,
                sender.username as sender_name,
                sender.avatar as sender_avatar,
                receiver.username as receiver_name,
                receiver.avatar as receiver_avatar
            FROM messages m
            JOIN user_information sender ON m.sender_id = sender.id
            JOIN user_information receiver ON m.receiver_id = receiver.id
            WHERE (m.sender_id = ? AND m.receiver_id = ?)
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        `;
        db.query(query, [userId1, userId2, userId2, userId1, limit, offset], callback);
    }

    // 获取用户的所有对话列表
    static getConversationList(userId, callback) {
        const query = `
            SELECT 
                other_user_id,
                other_user_name,
                other_user_avatar,
                last_message_time,
                unread_count
            FROM (
                SELECT 
                    CASE 
                        WHEN m.sender_id = ? THEN m.receiver_id
                        ELSE m.sender_id
                    END as other_user_id,
                    CASE 
                        WHEN m.sender_id = ? THEN receiver.username
                        ELSE sender.username
                    END as other_user_name,
                    CASE 
                        WHEN m.sender_id = ? THEN receiver.avatar
                        ELSE sender.avatar
                    END as other_user_avatar,
                    m.created_at as last_message_time,
                    SUM(CASE WHEN m.is_read = 0 AND m.receiver_id = ? THEN 1 ELSE 0 END) as unread_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY 
                            CASE 
                                WHEN m.sender_id = ? THEN m.receiver_id
                                ELSE m.sender_id
                            END 
                        ORDER BY m.created_at DESC
                    ) as rn
                FROM messages m
                JOIN user_information sender ON m.sender_id = sender.id
                JOIN user_information receiver ON m.receiver_id = receiver.id
                WHERE m.sender_id = ? OR m.receiver_id = ?
                GROUP BY 
                    CASE 
                        WHEN m.sender_id = ? THEN m.receiver_id
                        ELSE m.sender_id
                    END,
                    m.created_at,
                    CASE 
                        WHEN m.sender_id = ? THEN receiver.username
                        ELSE sender.username
                    END,
                    CASE 
                        WHEN m.sender_id = ? THEN receiver.avatar
                        ELSE sender.avatar
                    END
            ) ranked
            WHERE rn = 1
            ORDER BY last_message_time DESC
        `;
        db.query(query, [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId], callback);
    }

    // 将消息标记为已读
    static markAsRead(messageId, callback) {
        const query = 'UPDATE messages SET is_read = 1 WHERE id = ?';
        db.query(query, [messageId], callback);
    }

    // 获取未读消息数量
    static getUnreadCount(userId, callback) {
        const query = 'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0';
        db.query(query, [userId], (err, results) => {
            if (err) return callback(err);
            callback(null, results[0].count);
        });
    }

    // 将所有来自特定发送者的消息标记为已读
    static markAllAsRead(receiverId, senderId, callback) {
        const query = `
            UPDATE messages 
            SET is_read = 1 
            WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
        `;
        db.query(query, [receiverId, senderId], callback);
    }
}

module.exports = Message; 