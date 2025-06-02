const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// 查看用户主页
router.get('/:id', userController.viewUserProfile);

// 关注/取消关注用户（需要登录）
router.post('/:id/follow', auth.requireLogin, userController.followUser);

module.exports = router; 