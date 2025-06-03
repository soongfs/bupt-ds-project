const path = require('path');
const fs = require('fs');
const multer = require('multer');
const doubaoService = require('../services/doubaoService');

// 确保 uploads/animations 目录存在
const ANIMATIONS_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'animations');
if (!fs.existsSync(ANIMATIONS_UPLOAD_DIR)) {
    fs.mkdirSync(ANIMATIONS_UPLOAD_DIR, { recursive: true });
}

// Multer 配置，用于处理动画图片上传
const animationStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, ANIMATIONS_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'animation-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const animationFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('只允许上传图片文件!'), false);
    }
};

const uploadAnimationImage = multer({
    storage: animationStorage,
    fileFilter: animationFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 限制 5MB
    }
}).single('image'); // 'image' 对应于表单中的文件字段名

// 渲染创建动画页面
exports.renderCreateAnimationPage = (req, res) => {
    res.render('create-animation', {
        currentUser: req.session.user // 传递用户信息，如果视图需要的话
    });
};

// 处理生成动画请求
exports.handleGenerateAnimation = (req, res) => {
    // Multer 中间件 uploadAnimationImage 会先运行
    uploadAnimationImage(req, res, async (err) => {
        if (err && req.body.imageSource === 'upload') { // 只在尝试上传文件时关心上传错误
            console.error('[AnimationController] File upload error:', err);
            return res.status(400).json({ success: false, message: err.message });
        }

        const textInput = req.body.text;
        const imageSource = req.body.imageSource;
        let imageUrlForApi;

        if (!textInput) {
            return res.status(400).json({ success: false, message: '请输入动画描述' });
        }

        if (imageSource === 'url') {
            if (!req.body.imageUrl) {
                return res.status(400).json({ success: false, message: '请输入图片URL' });
            }
            imageUrlForApi = req.body.imageUrl;
            console.log(`[AnimationController] Using provided image URL: ${imageUrlForApi}`);
        } else if (imageSource === 'upload') {
            if (!req.file) {
                // 如果 multer 之前的错误检查没捕获到，这里再检查一次
                return res.status(400).json({ success: false, message: '请上传图片文件' });
            }
            imageUrlForApi = `${req.protocol}://${req.get('host')}/uploads/animations/${req.file.filename}`;
            console.log(`[AnimationController] Using uploaded image, URL: ${imageUrlForApi}`);
        } else {
            return res.status(400).json({ success: false, message: '无效的图片来源' });
        }

        try {
            console.log(`[AnimationController] Forwarding to Doubao Service with text: "${textInput}" and image URL: "${imageUrlForApi}"`);
            const apiResponse = await doubaoService.generateAnimationApi(textInput, imageUrlForApi);
            res.json({ success: true, data: apiResponse });
        } catch (error) {
            console.error('[AnimationController] Error calling Doubao service:', error);
            // 只有在上传文件且API调用失败时才删除文件
            if (imageSource === 'upload' && req.file) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error('[AnimationController] Error deleting uploaded file after API failure:', unlinkErr);
                    }
                });
            }
            res.status(500).json({ success: false, message: error.message });
        }
    });
};

// 新增：处理获取动画任务状态的请求
exports.getAnimationStatus = async (req, res) => {
    const taskId = req.params.taskId;
    if (!taskId) {
        return res.status(400).json({ success: false, message: '缺少任务ID' });
    }

    try {
        console.log(`[AnimationController] Requesting task status for ID: ${taskId}`);
        // 注意：这里直接将豆包API的原始响应返回给前端
        // 您可能希望根据实际需要，在后端进行一些处理或格式化后再返回
        const apiResponse = await doubaoService.getAnimationTaskStatus(taskId);
        res.json({ success: true, data: apiResponse }); 
    } catch (error) {
        console.error(`[AnimationController] Error getting task status for ID ${taskId}:`, error);
        res.status(500).json({ success: false, message: error.message });
    }
}; 