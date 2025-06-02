const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const upload = require('../config/multerConfig');

// 查看用户主页
router.get('/:id', auth.setCurrentUser, userController.viewUserProfile);

// 编辑用户资料页面
router.get('/:id/edit', auth.requireLogin, userController.editProfile);

// 更新用户资料
router.post('/:id/edit', auth.requireLogin, upload.single('avatar'), userController.updateProfile);

// 关注/取消关注用户
router.post('/:id/follow', auth.requireLogin, userController.followUser);

// 获取用户游记列表
router.get('/:id/diaries', auth.setCurrentUser, userController.getUserDiaries);

// 获取用户收藏列表
router.get('/:id/favorites', auth.setCurrentUser, userController.getUserFavorites);

module.exports = router; 