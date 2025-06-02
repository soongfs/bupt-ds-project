const express = require('express');
const router = express.Router();
const diaryController = require('../controllers/diaryController');
const upload = require('../config/multerConfig');
const auth = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

// 提交新日记
router.post('/api/diaries', auth.requireLogin, upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'mediaFiles', maxCount: 20 }
]), diaryController.createDiary);

// 编辑日记
router.put('/api/diaries/:id', auth.requireLogin, upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'mediaFiles', maxCount: 20 }
]), diaryController.updateDiary);

// 上传图片
router.post('/api/upload-image', auth.requireLogin, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '没有上传文件' });
  }
  res.json({ 
    success: true, 
    url: `/uploads/${req.file.filename}`,
    filename: req.file.filename
  });
});

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

// 获取媒体库文件列表
router.get('/api/media-library', async (req, res) => {
  const { type = 'all', search = '' } = req.query;
  const publicDir = path.join(__dirname, '..', 'public');
  const mediaDir = path.join(publicDir, 'media');

  try {
    // 确保媒体目录存在
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }

    // 递归获取所有文件
    const getFiles = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      
      list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          results = results.concat(getFiles(filePath));
        } else {
          const ext = path.extname(file).toLowerCase();
          const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
          const isVideo = ['.mp4', '.webm', '.ogg'].includes(ext);
          
          if ((type === 'all' && (isImage || isVideo)) ||
              (type === 'image' && isImage) ||
              (type === 'video' && isVideo)) {
            
            const relativePath = path.relative(publicDir, filePath).replace(/\\/g, '/');
            const fileName = path.basename(file);
            
            if (search && !fileName.toLowerCase().includes(search.toLowerCase())) {
              return;
            }

            results.push({
              url: '/' + relativePath,
              name: fileName,
              type: isVideo ? 'video' : 'image',
              size: stat.size,
              modified: stat.mtime
            });
          }
        }
      });
      
      return results;
    };

    const files = getFiles(mediaDir);
    
    // 按修改时间排序，最新的在前
    files.sort((a, b) => b.modified - a.modified);

    res.json({
      success: true,
      files: files
    });
  } catch (error) {
    console.error('获取媒体库文件失败:', error);
    res.status(500).json({
      success: false,
      message: '获取媒体库文件失败'
    });
  }
});

module.exports = router;