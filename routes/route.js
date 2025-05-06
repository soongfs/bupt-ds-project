// routes/route.js
const express = require("express");
const router = express.Router();
const { getRoute } = require("../controllers/routeController");

router.get("/route", getRoute);

module.exports = router;
