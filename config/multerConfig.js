const path = require('path');
const multer = require('multer');
const fs = require('fs');

// 配置multer用于文件上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // 根据字段名添加不同的前缀
        const prefix = file.fieldname === 'coverImage' ? 'cover-' : 'media-';
        cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // 允许的文件类型
    const allowedTypes = {
        'image/jpeg': true,
        'image/png': true,
        'image/gif': true,
        'image/webp': true,
        'video/mp4': true,
        'video/webm': true,
        'video/ogg': true
    };

    if (file.fieldname === 'coverImage') {
        // 封面图片只允许图片格式
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('封面图片只能上传图片文件'), false);
        }
    } else if (file.fieldname === 'mediaFiles' || file.fieldname === 'image') {
        // 媒体文件允许图片和视频
        if (allowedTypes[file.mimetype]) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传图片或视频文件'), false);
        }
    } else {
        cb(new Error('未知的文件字段'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 限制10MB
        files: 21 // 最大文件数（1个封面 + 20个媒体文件）
    },
    fileFilter: fileFilter
});

module.exports = upload;