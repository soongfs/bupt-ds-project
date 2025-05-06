// controllers/diaryController.js
const Diary = require("../models/diaryModel");
// ... sections, media, comments 分别由各自 model/服务封装

// 发布
exports.publish = async (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).json({ success: false, message: "未登录" });
  const diaryId = await Diary.createDiary({
    user_id: user.id,
    title: req.body.title,
    content: req.body.content,
    status: req.body.status || 1,
    cover_image: req.files.coverImage
      ? "/uploads/" + req.files.coverImage[0].filename
      : null,
    categories: req.body.tags || "",
  });
  // TODO: 插入 sections/media 后 commit
  res.json({ success: true, diaryId });
};

// 详情
exports.detail = async (req, res) => {
  const diary = await Diary.getDiaryById(req.params.id);
  if (!diary) return res.status(404).render("error", { error: "未找到" });
  // TODO: fetch media, sections, comments
  res.render("diary-detail", { diary /* ... */ });
};

// 编辑日记
exports.edit = async (req, res, next) => {
  try {
    const diaryId = req.params.id;
    const { title, content, status } = req.body;
    // TODO: 如果还要处理上传的 coverImage/mediaFiles，复制 publish 里逻辑
    await require("../models/diaryModel").updateDiary(diaryId, {
      title,
      content,
      status,
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// 添加评论
exports.addComment = async (req, res, next) => {
  try {
    const diaryId = req.params.id;
    const { content } = req.body;
    const userId = req.session.user.id;
    await require("../models/commentModel").addComment({
      diary_id: diaryId,
      user_id: userId,
      content,
    });
    res.status(201).json({ message: "Comment added" });
  } catch (err) {
    next(err);
  }
};

// 点赞
exports.like = async (req, res, next) => {
  try {
    const diaryId = req.params.id;
    await require("../models/diaryModel").incrementLike(diaryId);
    res.json({ message: "Liked" });
  } catch (err) {
    next(err);
  }
};
