// controllers/userController.js
const User = require("../models/userModel");
const Follow = require("../models/followModel");
const UserStats = require("../models/userStatsModel");
const db = require('../config/test-database');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

// 渲染用户主页
exports.viewUserProfile = (req, res) => {
  const targetUserId = req.params.id;
  const currentUser = req.session.user;

  console.log('访问用户主页:', {
    targetUserId,
    currentUser: currentUser ? { id: currentUser.id, username: currentUser.username } : null
  });

  // 如果用户未登录，重定向到登录页面
  if (!currentUser) {
    console.log('用户未登录，重定向到登录页面');
    return res.redirect('/login');
  }

  // 获取用户基本信息和统计数据
  const userQuery = `
    SELECT 
      u.*, 
      (SELECT COUNT(*) FROM travel_diaries WHERE user_id = u.id) as diaries_count,
      (SELECT COUNT(*) FROM user_follows WHERE followed_id = u.id) as followers,
      (SELECT COUNT(*) FROM user_follows WHERE follower_id = u.id) as following
    FROM user_information u 
    WHERE u.id = ?
  `;

  console.log('执行用户查询:', { query: userQuery, params: [targetUserId] });

  db.query(userQuery, [targetUserId], (err, userResults) => {
    if (err) {
      console.error('查询用户信息失败:', {
        error: err.message,
        stack: err.stack,
        query: userQuery,
        params: [targetUserId]
      });
      return res.status(500).render('error', { 
        message: '服务器错误，请稍后重试',
        error: process.env.NODE_ENV === 'development' ? err : null
      });
    }

    if (userResults.length === 0) {
      console.log('用户不存在:', { targetUserId });
      return res.status(404).render('error', { 
        message: '用户不存在',
        error: null
      });
    }

    const user = userResults[0];
    console.log('找到用户:', { 
      userId: user.id, 
      username: user.username,
      diariesCount: user.diaries_count,
      followers: user.followers,
      following: user.following
    });

    const stats = {
      diaries_count: user.diaries_count || 0,
      followers: user.followers || 0,
      following: user.following || 0
    };

    // 获取用户的游记列表
    const diaryQuery = `
      SELECT d.*, u.username, u.avatar,
        (SELECT COUNT(*) FROM diary_likes WHERE diary_id = d.id) as like_count,
        (SELECT COUNT(*) FROM comments WHERE diary_id = d.id) as comment_count
      FROM travel_diaries d
      JOIN user_information u ON d.user_id = u.id
      WHERE d.user_id = ?
      ORDER BY d.created_at DESC
      LIMIT 6
    `;

    console.log('执行游记查询:', { query: diaryQuery, params: [targetUserId] });

    db.query(diaryQuery, [targetUserId], (err, diaryResults) => {
      if (err) {
        console.error('查询游记列表失败:', {
          error: err.message,
          stack: err.stack,
          query: diaryQuery,
          params: [targetUserId]
        });
        return res.status(500).render('error', { 
          message: '服务器错误，请稍后重试',
          error: process.env.NODE_ENV === 'development' ? err : null
        });
      }

      console.log('找到游记:', { count: diaryResults.length });

      // 获取用户的收藏列表
      const favoriteQuery = `
        SELECT d.*, u.username as author
        FROM travel_diaries d
        JOIN diary_favorites f ON d.id = f.diary_id
        JOIN user_information u ON d.user_id = u.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
        LIMIT 6
      `;

      console.log('执行收藏查询:', { query: favoriteQuery, params: [targetUserId] });

      db.query(favoriteQuery, [targetUserId], (err, favoriteResults) => {
        if (err) {
          console.error('查询收藏列表失败:', {
            error: err.message,
            stack: err.stack,
            query: favoriteQuery,
            params: [targetUserId]
          });
          return res.status(500).render('error', { 
            message: '服务器错误，请稍后重试',
            error: process.env.NODE_ENV === 'development' ? err : null
          });
        }

        console.log('找到收藏:', { count: favoriteResults.length });

        // 检查当前用户是否关注了目标用户
        const followQuery = 'SELECT 1 FROM user_follows WHERE follower_id = ? AND followed_id = ?';
        console.log('执行关注查询:', { 
          query: followQuery, 
          params: [currentUser.id, targetUserId] 
        });

        db.query(followQuery, [currentUser.id, targetUserId], (err, followResults) => {
          if (err) {
            console.error('查询关注状态失败:', {
              error: err.message,
              stack: err.stack,
              query: followQuery,
              params: [currentUser.id, targetUserId]
            });
            return res.status(500).render('error', { 
              message: '服务器错误，请稍后重试',
              error: process.env.NODE_ENV === 'development' ? err : null
            });
          }

          console.log('准备渲染页面:', {
            user: { id: user.id, username: user.username },
            currentUser: { id: currentUser.id, username: currentUser.username },
            stats,
            diariesCount: diaryResults.length,
            favoritesCount: favoriteResults.length,
            isFollowing: followResults && followResults.length > 0
          });

          try {
            res.render('user', {
              user: user,
              currentUser: currentUser,
              stats: stats,
              diaries: diaryResults,
              favorites: favoriteResults,
              isFollowing: followResults && followResults.length > 0
            });
          } catch (renderError) {
            console.error('渲染页面失败:', {
              error: renderError.message,
              stack: renderError.stack
            });
            return res.status(500).render('error', { 
              message: '渲染页面失败',
              error: process.env.NODE_ENV === 'development' ? renderError : null
            });
          }
        });
      });
    });
  });
};

// 渲染用户编辑页面
exports.editProfile = (req, res) => {
  const userId = req.params.id;
  
  // 确保用户只能编辑自己的资料
  if (req.session.user.id !== parseInt(userId)) {
    return res.status(403).render('error', { 
      message: '没有权限编辑此用户资料',
      error: null
    });
  }

  db.query('SELECT * FROM user_information WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error('查询用户信息失败:', err);
      return res.status(500).render('error', { 
        message: '服务器错误，请稍后重试',
        error: process.env.NODE_ENV === 'development' ? err : null
      });
    }

    if (results.length === 0) {
      return res.status(404).render('error', { 
        message: '用户不存在',
        error: null
      });
    }

    res.render('user_edit', {
      user: results[0],
      currentUser: req.session.user
    });
  });
};

// 更新用户资料
exports.updateProfile = async (req, res) => {
  const userId = req.params.id;
  const { username, bio, location, interests } = req.body;

  // 确保用户只能更新自己的资料
  if (req.session.user.id !== parseInt(userId)) {
    return res.status(403).json({ success: false, message: '没有权限更新此用户资料' });
  }

  try {
    let updateData = {
      username,
      bio: bio || null,
      location: location || null,
      interests: interests || null
    };

    // 如果上传了新头像
    if (req.file) {
      updateData.avatar = req.file.filename;

      // 删除旧头像
      db.query('SELECT avatar FROM user_information WHERE id = ?', [userId], (err, results) => {
        if (err) {
          console.error('查询旧头像失败:', err);
        } else if (results[0].avatar) {
          const oldAvatarPath = path.join(__dirname, '../uploads', results[0].avatar);
          fs.unlink(oldAvatarPath, (err) => {
            if (err && err.code !== 'ENOENT') {
              console.error('删除旧头像失败:', err);
            }
          });
        }
      });
    }

    db.query(
      'UPDATE user_information SET ? WHERE id = ?',
      [updateData, userId],
      (err) => {
        if (err) {
          console.error('更新用户资料失败:', err);
          return res.status(500).json({ success: false, message: '服务器错误' });
        }

        res.json({ success: true, message: '资料更新成功' });
      }
    );
  } catch (error) {
    console.error('更新用户资料失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

// 关注/取消关注用户
exports.followUser = (req, res) => {
  const followerId = req.session.user.id;
  const followedId = req.params.id;

  if (followerId === parseInt(followedId)) {
    return res.status(400).json({ success: false, message: '不能关注自己' });
  }

  // 检查是否已经关注
  db.query(
    'SELECT * FROM user_follows WHERE follower_id = ? AND followed_id = ?',
    [followerId, followedId],
    (err, results) => {
      if (err) {
        console.error('查询关注状态失败:', err);
        return res.status(500).json({ success: false, message: '服务器错误' });
      }

      if (results.length > 0) {
        // 取消关注
        db.query(
          'DELETE FROM user_follows WHERE follower_id = ? AND followed_id = ?',
          [followerId, followedId],
          (err) => {
            if (err) {
              console.error('取消关注失败:', err);
              return res.status(500).json({ success: false, message: '服务器错误' });
            }

            res.json({ success: true, message: '已取消关注', isFollowing: false });
          }
        );
      } else {
        // 添加关注
        db.query(
          'INSERT INTO user_follows (follower_id, followed_id) VALUES (?, ?)',
          [followerId, followedId],
          (err) => {
            if (err) {
              console.error('添加关注失败:', err);
              return res.status(500).json({ success: false, message: '服务器错误' });
            }

            res.json({ success: true, message: '关注成功', isFollowing: true });
          }
        );
      }
    }
  );
};

// 获取用户游记列表
exports.getUserDiaries = (req, res) => {
  const userId = req.params.id;
  const page = parseInt(req.query.page) || 1;
  const limit = 12;
  const offset = (page - 1) * limit;

  db.query(
    `SELECT d.*, u.username, u.avatar,
      (SELECT COUNT(*) FROM diary_likes WHERE diary_id = d.id) as like_count,
      (SELECT COUNT(*) FROM comments WHERE diary_id = d.id) as comment_count
    FROM travel_diaries d
    JOIN user_information u ON d.user_id = u.id
    WHERE d.user_id = ?
    ORDER BY d.created_at DESC
    LIMIT ? OFFSET ?`,
    [userId, limit, offset],
    (err, results) => {
      if (err) {
        console.error('查询游记列表失败:', err);
        return res.status(500).json({ success: false, message: '服务器错误' });
      }

      // 获取总数以计算分页
      db.query(
        'SELECT COUNT(*) as total FROM travel_diaries WHERE user_id = ?',
        [userId],
        (err, countResults) => {
          if (err) {
            console.error('查询游记总数失败:', err);
            return res.status(500).json({ success: false, message: '服务器错误' });
          }

          const total = countResults[0].total;
          const totalPages = Math.ceil(total / limit);

          res.json({
            success: true,
            diaries: results,
            pagination: {
              current: page,
              total: totalPages,
              hasMore: page < totalPages
            }
          });
        }
      );
    }
  );
};

// 获取用户收藏列表
exports.getUserFavorites = (req, res) => {
  const userId = req.params.id;
  const page = parseInt(req.query.page) || 1;
  const limit = 12;
  const offset = (page - 1) * limit;

  db.query(
    `SELECT d.*, u.username as author
    FROM travel_diaries d
    JOIN diary_favorites f ON d.id = f.diary_id
    JOIN user_information u ON d.user_id = u.id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
    LIMIT ? OFFSET ?`,
    [userId, limit, offset],
    (err, results) => {
      if (err) {
        console.error('查询收藏列表失败:', err);
        return res.status(500).json({ success: false, message: '服务器错误' });
      }

      // 获取总数以计算分页
      db.query(
        'SELECT COUNT(*) as total FROM diary_favorites WHERE user_id = ?',
        [userId],
        (err, countResults) => {
          if (err) {
            console.error('查询收藏总数失败:', err);
            return res.status(500).json({ success: false, message: '服务器错误' });
          }

          const total = countResults[0].total;
          const totalPages = Math.ceil(total / limit);

          res.json({
            success: true,
            favorites: results,
            pagination: {
              current: page,
              total: totalPages,
              hasMore: page < totalPages
            }
          });
        }
      );
    }
  );
};

// 获取关注状态
exports.getFollowStatus = (req, res) => {
  const followerId = req.session.user.id;
  const followedId = req.params.id;

  if (followerId === parseInt(followedId)) {
    return res.json({ success: false, message: '不能关注自己' });
  }

  db.query(
    'SELECT * FROM user_follows WHERE follower_id = ? AND followed_id = ?',
    [followerId, followedId],
    (err, results) => {
      if (err) {
        console.error('查询关注状态失败:', err);
        return res.status(500).json({ success: false, message: '查询关注状态失败' });
      }

      res.json({ 
        success: true, 
        isFollowing: results.length > 0 
      });
    }
  );
};
