const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { isAuthenticated } = require('../middleware/auth');

// 应用认证中间件到所有消息路由
router.use(isAuthenticated);

// 发送消息页面
router.get('/new/:userId', messageController.newMessage);

// 发送消息
router.post('/send', messageController.sendMessage);

// 获取与特定用户的对话历史
router.get('/conversation/:userId', messageController.getConversation);

// 获取所有对话列表
router.get('/conversations', messageController.getConversationList);

// 标记消息为已读
router.put('/:messageId/read', messageController.markAsRead);

// 获取未读消息数量
router.get('/unread/count', messageController.getUnreadCount);

// 聊天页面
router.get('/chat/:userId', messageController.chatPage);

module.exports = router; 