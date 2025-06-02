// routes/placeRoutes.js
const express = require("express");
const router = express.Router();
const { findNearbyPlaces } = require("../controllers/placeController");

// Route for finding nearby places/facilities
// POST because the query parameters can be complex (arrays, multiple optionals)
router.post("/nearby", findNearbyPlaces);

module.exports = router; 