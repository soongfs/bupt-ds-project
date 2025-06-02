// routes/foodRoutes.js
const express = require("express");
const foodController = require("../controllers/foodController");

const router = express.Router();

// POST /api/food/search - Search for food items
router.post("/search", foodController.searchFood);

module.exports = router; 