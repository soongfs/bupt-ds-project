// routes/route.js
const express = require("express");
const router = express.Router();
const { getRoute, getMultiStopRoute } = require("../controllers/routeController");

router.get("/route", getRoute);
router.post("/route/multi", getMultiStopRoute);

module.exports = router;
