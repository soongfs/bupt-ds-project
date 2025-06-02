const express = require('express');
const router = express.Router();
const diaryController = require('../controllers/diaryController');
const upload = require('../config/multerConfig');
const auth = require('../middleware/auth');

// 提交新日记
router.post('/api/diaries', auth.requireLogin, upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'mediaFiles', maxCount: 20 }
]), diaryController.createDiary);

// 编辑日记
router.put('/api/diaries-edit/:id', auth.requireLogin, diaryController.updateDiary);

// 日记发现页
router.get('/diary-discovery', diaryController.getDiaryDiscovery);

// 创建新日记页面
router.get('/diaries/new', auth.requireLogin, diaryController.getNewDiary);

// 日记详情页
router.get('/diary-detail/:id', diaryController.getDiaryDetail);

// 添加评论
router.post('/api/diaries/:id/comments', auth.requireLogin, diaryController.addComment);

// 点赞日记
router.post('/api/diaries/:id/like', auth.requireLogin, diaryController.likeDiary);

// 评分日记
router.post('/api/diaries/:id/rate', auth.authenticate, diaryController.rateDiary);

// 收藏日记
router.post('/api/diaries/:id/favorite', auth.authenticate, diaryController.favoriteDiary);

// 获取分享链接
router.get('/api/diaries/:id/share', diaryController.getShareLink);

module.exports = router;