// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// 登录页面
router.get('/login', auth.requireGuest, authController.getLoginPage);

// 注册页面
router.get('/register', auth.requireGuest, authController.getRegisterPage);

// 处理登录请求
router.post('/login', authController.login);

// 处理注册请求
router.post('/register', authController.register);

// 退出登录
router.get('/logout', auth.requireLogin, authController.logout);

module.exports = router;
