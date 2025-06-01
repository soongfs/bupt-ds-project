const express = require('express');
const app = express.Router();
const homeController = require('../controllers/homeController');

// 主页路由
app.get('/', homeController.getHomePage);

module.exports = app;
