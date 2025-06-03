// routes/attraction.js
const express = require("express");
const router = express.Router();
const attrCtrl = require("../controllers/attractionController");
const auth = require("../middleware/auth");

// 景点探索
router.get("/explorer", auth.setCurrentUser, attrCtrl.explore);

// 景点详情
router.get("/detail/:id", auth.setCurrentUser, attrCtrl.getDetail);

// 用户对景点评分 (需要登录)
router.post("/detail/:id/rate", auth.requireLogin, attrCtrl.rateAttraction);

// 景点搜索
router.get("/search", attrCtrl.searchAttraction);

module.exports = router;
