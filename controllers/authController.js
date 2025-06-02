// controllers/authController.js
const bcrypt = require("bcrypt");
const User = require("../models/userModel");
const db = require('../config/test-database');

const authController = {
  // 获取登录页面
  getLoginPage: (req, res) => {
    res.render('login', {
      error: null,
      user: null
    });
  },

  // 获取注册页面
  getRegisterPage: (req, res) => {
    res.render('register', {
      error: null,
      user: null
    });
  },

  // 处理登录
  login: async (req, res) => {
    const { username, password } = req.body;

    try {
      // 查找用户
      db.query(
        'SELECT * FROM user_information WHERE username = ?',
        [username],
        async (err, results) => {
          if (err) {
            console.error('数据库查询错误:', err);
            return res.status(500).json({
              success: false,
              message: '服务器错误'
            });
          }

          if (results.length === 0) {
            return res.status(401).json({
              success: false,
              message: '用户名或密码错误'
            });
          }

          const user = results[0];

          // 验证密码
          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            return res.status(401).json({
              success: false,
              message: '用户名或密码错误'
            });
          }

          // 设置session
          req.session.user = {
            id: user.id,
            username: user.username,
            avatar: user.avatar
          };

          res.json({
            success: true,
            message: '登录成功',
            user: {
              id: user.id,
              username: user.username,
              avatar: user.avatar
            }
          });
        }
      );
    } catch (error) {
      console.error('登录错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误'
      });
    }
  },

  // 处理注册
  register: async (req, res) => {
    const { username, password, email } = req.body;

    try {
      // 检查用户名是否已存在
      db.query(
        'SELECT * FROM user_information WHERE username = ?',
        [username],
        async (err, results) => {
          if (err) {
            console.error('数据库查询错误:', err);
            return res.status(500).json({
              success: false,
              message: '服务器错误'
            });
          }

          if (results.length > 0) {
            return res.status(400).json({
              success: false,
              message: '用户名已存在'
            });
          }

          // 加密密码
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, salt);

          // 创建新用户
          db.query(
            'INSERT INTO user_information (username, password, email) VALUES (?, ?, ?)',
            [username, hashedPassword, email],
            (err, result) => {
              if (err) {
                console.error('创建用户错误:', err);
                return res.status(500).json({
                  success: false,
                  message: '服务器错误'
                });
              }

              // 设置session
              req.session.user = {
                id: result.insertId,
                username,
                avatar: null
              };

              res.json({
                success: true,
                message: '注册成功',
                user: {
                  id: result.insertId,
                  username,
                  avatar: null
                }
              });
            }
          );
        }
      );
    } catch (error) {
      console.error('注册错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误'
      });
    }
  },

  // 退出登录
  logout: (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('退出登录错误:', err);
        return res.status(500).json({
          success: false,
          message: '服务器错误'
        });
      }
      res.redirect('/');
    });
  }
};

module.exports = authController;
