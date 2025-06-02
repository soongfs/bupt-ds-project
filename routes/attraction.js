// routes/attraction.js
const express = require("express");
const router = express.Router();
const attrCtrl = require("../controllers/attractionController");

// 景点探索
router.get("/explorer", attrCtrl.explore);

// 景点详情
router.get("/detail/:id", attrCtrl.getDetail);

// 用户对景点评分
router.post("/detail/:id/rate", attrCtrl.rateAttraction);

module.exports = router;
