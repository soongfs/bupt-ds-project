// routes/diary.js
const express = require("express");
const router = express.Router();
const diaryCtrl = require("../controllers/diaryController");

// 如果 diaryController.publish 需要 multer 中间件，传入 upload 实例
module.exports = (upload) => {
  // 发布新日记（带图片上传）
  router.post(
    "/api/diaries",
    upload.fields([
      { name: "coverImage", maxCount: 1 },
      { name: "mediaFiles", maxCount: 20 },
    ]),
    diaryCtrl.publish
  );

  // 编辑日记
  router.put(
    "/api/diaries/:id",
    upload.fields([
      { name: "coverImage", maxCount: 1 },
      { name: "mediaFiles", maxCount: 20 },
    ]),
    diaryCtrl.edit
  );

  // 日记详情页
  router.get("/diary-detail/:id", diaryCtrl.detail);

  // 添加评论
  router.post("/api/diaries/:id/comments", diaryCtrl.addComment);

  // 给日记点赞
  router.post("/api/diaries/:id/like", diaryCtrl.like);

  return router;
};
