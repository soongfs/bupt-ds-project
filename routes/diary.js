const express = require('express');
const router = express.Router();
const diaryController = require('../controllers/diaryController');
const upload = require('../config/multerConfig');

// 提交新日记
router.post('/api/diaries', upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'mediaFiles', maxCount: 20 }
]), diaryController.createDiary);

// 编辑日记
router.put('/api/diaries-edit/:id', diaryController.updateDiary);

// 日记发现页
router.get('/diary-discovery', diaryController.getDiaryDiscovery);

// 创建新日记页面
router.get('/diaries/new', diaryController.getNewDiary);

// 日记详情页
router.get('/diary-detail/:id', diaryController.getDiaryDetail);

// 添加评论
router.post('/api/diaries/:id/comments', diaryController.addComment);

// 点赞日记
router.post('/api/diaries/:id/like', diaryController.likeDiary);

module.exports = router;