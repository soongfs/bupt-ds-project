const Message = require('../models/messageModel');
const User = require('../models/userModel');

// 新增：渲染发送消息页面
exports.newMessage = (req, res) => {
    const recipientId = req.params.userId;
    
    User.findById(recipientId, (err, recipient) => {
        if (err) {
            console.error('加载发送消息页面失败:', err);
            return res.status(500).render('error', {
                message: '服务器错误'
            });
        }

        if (!recipient) {
            return res.status(404).render('error', {
                message: '用户不存在'
            });
        }

        res.render('message_new', {
            recipient
        });
    });
};

exports.sendMessage = (req, res) => {
    const senderId = req.session.user.id;
    const { receiverId, content } = req.body;

    // 验证消息内容
    if (!content || content.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: '消息内容不能为空'
        });
    }

    // 创建新消息
    Message.create(senderId, receiverId, content, (err, messageId) => {
        if (err) {
            console.error('发送消息失败:', err);
            return res.status(500).json({
                success: false,
                message: '发送消息失败'
            });
        }

        res.json({
            success: true,
            message: '消息发送成功',
            messageId
        });
    });
};

exports.getConversation = (req, res) => {
    const userId1 = req.session.user.id;
    const userId2 = req.params.userId;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    Message.getConversation(userId1, userId2, limit, offset, (err, messages) => {
        if (err) {
            console.error('获取对话历史失败:', err);
            return res.status(500).json({
                success: false,
                message: '获取对话历史失败'
            });
        }

        res.json({
            success: true,
            messages
        });
    });
};

exports.getConversationList = (req, res) => {
    const userId = req.session.user.id;

    Message.getConversationList(userId, (err, conversations) => {
        if (err) {
            console.error('获取对话列表失败:', err);
            return res.status(500).json({
                success: false,
                message: '获取对话列表失败'
            });
        }

        res.json({
            success: true,
            conversations
        });
    });
};

exports.markAsRead = (req, res) => {
    const messageId = req.params.messageId;

    Message.markAsRead(messageId, (err) => {
        if (err) {
            console.error('标记消息已读失败:', err);
            return res.status(500).json({
                success: false,
                message: '标记消息已读失败'
            });
        }

        res.json({
            success: true,
            message: '消息已标记为已读'
        });
    });
};

exports.getUnreadCount = (req, res) => {
    const userId = req.session.user.id;

    Message.getUnreadCount(userId, (err, count) => {
        if (err) {
            console.error('获取未读消息数量失败:', err);
            return res.status(500).json({
                success: false,
                message: '获取未读消息数量失败'
            });
        }

        res.json({
            success: true,
            count
        });
    });
};

// 聊天页面
exports.chatPage = (req, res) => {
    const currentUser = req.session.user;
    const otherUserId = req.params.userId;
    
    User.findById(otherUserId, (err, otherUser) => {
        if (err) {
            console.error('加载聊天页面失败:', err);
            return res.status(500).render('error', {
                message: '服务器错误'
            });
        }

        if (!otherUser) {
            return res.status(404).render('error', {
                message: '用户不存在'
            });
        }

        // 将所有未读消息标记为已读
        Message.markAllAsRead(currentUser.id, otherUserId, (err) => {
            if (err) {
                console.error('标记消息已读失败:', err);
            }
        });

        res.render('chat', {
            currentUser,
            otherUser
        });
    });
}; 