const express = require('express');
const router = express.Router();
const animationController = require('../controllers/animationController');
const auth = require('../middleware/auth'); // 引入认证中间件，如果需要登录访问

// GET 路由，用于显示创建动画的页面
// auth.requireLogin, // 如果需要登录才能访问此页面，取消此行注释
router.get('/create', auth.setCurrentUser, animationController.renderCreateAnimationPage);

// POST 路由，用于处理动画生成请求
// 这个路由已经由 animationController.handleGenerateAnimation 中的 uploadAnimationImage 中间件处理了文件上传
// auth.requireLogin, // 如果需要登录才能调用此API，取消此行注释
router.post('/api/generate-animation', auth.setCurrentUser, animationController.handleGenerateAnimation);

// 新增：GET 路由，用于查询动画任务的状态
// auth.requireLogin, // 如果需要登录才能调用此API，取消此行注释
router.get('/api/status/:taskId', auth.setCurrentUser, animationController.getAnimationStatus);

module.exports = router; 