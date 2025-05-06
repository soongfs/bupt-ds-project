// controllers/userController.js
const User = require("../models/userModel");

// 渲染用户主页
exports.viewProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).render("404", { message: "用户不存在" });
    // TODO: 查询日记、统计等并传入
    res.render("user", { user, diaries: [], stats: {} });
  } catch (err) {
    next(err);
  }
};

// 渲染用户编辑页面
exports.editPage = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).render("404", { message: "用户不存在" });
    res.render("user_edit", { user });
  } catch (err) {
    next(err);
  }
};

// 处理资料更新
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const data = {
      username: req.body.username,
      gender: req.body.gender,
      birthday: req.body.birthday || null,
      location: req.body.location,
      bio: req.body.bio,
      interests: req.body.interests,
    };
    if (req.file) data.avatar = `/uploads/${req.file.filename}`;
    await User.update(userId, data);
    const updated = await User.findById(userId);
    res.json({ success: true, user: updated });
  } catch (err) {
    next(err);
  }
};
