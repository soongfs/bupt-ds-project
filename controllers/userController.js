// controllers/userController.js
const User = require("../models/userModel");
const Follow = require("../models/followModel");
const UserStats = require("../models/userStatsModel");

// 渲染用户主页
exports.viewUserProfile = (req, res) => {
  const targetUserId = req.params.id;
  const currentUser = req.session.user;

  // 如果用户未登录，重定向到登录页面
  if (!currentUser) {
    return res.redirect('/login');
  }

  // 获取目标用户信息
  User.findById(targetUserId, (err, targetUser) => {
    if (err) {
      console.error('查询用户失败:', err);
      return res.status(500).render('error', { message: '服务器错误' });
    }

    if (!targetUser) {
      return res.status(404).render('error', { message: '用户不存在' });
    }

    // 获取用户统计信息
    UserStats.getUserStats(targetUserId, (err, stats) => {
      if (err) {
        console.error('获取用户统计信息失败:', err);
        stats = {
          diariesCount: 0,
          totalViews: 0,
          totalLikes: 0,
          followers: 0,
          following: 0
        };
      }

      // 合并统计信息到用户对象
      targetUser.diaryCount = stats.diariesCount;
      targetUser.totalViews = stats.totalViews;
      targetUser.totalLikes = stats.totalLikes;
      targetUser.followersCount = stats.followers;
      targetUser.followingCount = stats.following;

      // 获取用户游记列表
      UserStats.getUserDiaries(targetUserId, 10, 0, (err, diaries) => {
        if (err) {
          console.error('获取用户游记列表失败:', err);
          diaries = [];
        }

        targetUser.diaries = diaries;

        // 如果是访问自己的主页，使用user_edit模板
        if (String(currentUser.id) === String(targetUserId)) {
          console.log('Rendering user_edit template');
          console.log('currentUser.id:', currentUser.id, 'type:', typeof currentUser.id);
          console.log('targetUserId:', targetUserId, 'type:', typeof targetUserId);
          return res.render('user_edit', {
            user: targetUser,
            stats,
            diaries
          });
        }

        // 检查是否已关注
        Follow.isFollowing(currentUser.id, targetUserId, (err, isFollowing) => {
          if (err) {
            console.error('检查关注状态失败:', err);
            isFollowing = false;
          }

          console.log('Rendering user_view template');
          console.log('currentUser.id:', currentUser.id, 'type:', typeof currentUser.id);
          console.log('targetUserId:', targetUserId, 'type:', typeof targetUserId);
          
          // 访问他人主页，使用user_view模板
          res.render('user_view', {
            targetUser,
            currentUser,
            isFollowing
          });
        });
      });
    });
  });
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

exports.followUser = async (req, res) => {
  try {
    const currentUser = req.user;
    const targetUserId = req.params.id;

    // 检查用户是否已登录
    if (!currentUser) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }

    // 不能关注自己
    if (currentUser.id === targetUserId) {
      return res.status(400).json({ success: false, message: '不能关注自己' });
    }

    // 检查目标用户是否存在
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 检查是否已经关注
    const isFollowing = await Follow.isFollowing(currentUser.id, targetUserId);

    if (isFollowing) {
      // 如果已关注，则取消关注
      await Follow.unfollowUser(currentUser.id, targetUserId);
    } else {
      // 如果未关注，则添加关注
      await Follow.followUser(currentUser.id, targetUserId);
    }

    res.json({ 
      success: true, 
      message: isFollowing ? '已取消关注' : '关注成功',
      isFollowing: !isFollowing
    });
  } catch (error) {
    console.error('关注用户失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};
