// routes/user.js
// const express = require("express");
// const router = express.Router();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const multer = require('multer'); // 新增：用于文件上传
const fs = require('fs'); // 新增：文件系统操作

const db = require('./config/test-database');
const indexRouter = require('./routes/index');


const app = express();

// 中间件配
app.use(express.urlencoded({ extended: true }));  // 解析表单数据
app.use(express.json());                          // 解析JSON数据
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// 设置EJS为视图引擎
app.set('views', path.join(__dirname, 'web/views'));
app.set('view engine', 'ejs');

// 配置静态文件服务
app.use(express.static(path.join(__dirname, 'web')));  // 重要：设置静态目录

// 优先处理静态文件
app.use('/user/images', express.static(path.join(__dirname, 'web/images')));


// 配置静态文件服务
app.use(express.static(path.join(__dirname, 'web')));
app.use('/user/images', express.static(path.join(__dirname, 'web/images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // 新增：上传文件静态目录

// 在 Express 应用中添加错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);

  res.status(500).render('error', {
    message: err.message || '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err : null
  });
});


const userCtrl = require("../controllers/userController");

module.exports = (upload) => {
  // 用户主页
  router.get("/user/:id", userCtrl.viewProfile);

  // 用户编辑页
  router.get("/user/:id/edit", userCtrl.editPage);

  // 更新用户资料（带头像上传）
  router.put(
    "/api/user/profile",
    upload.single("avatar"),
    userCtrl.updateProfile
  );

  return router;
};
