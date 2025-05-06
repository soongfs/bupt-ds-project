// routes/attraction.js
const express = require("express");
const router = express.Router();
const attrCtrl = require("../controllers/attractionController");

// 景点探索
router.get("/attraction-explorer", attrCtrl.explore);

module.exports = router;
