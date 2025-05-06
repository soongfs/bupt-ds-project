// routes/auth.js
const router = require("express").Router();
const auth = require("../controllers/authController");

router.post("/api/login", auth.login);
router.post("/api/logout", auth.logout);
router.post("/api/register", auth.register);

module.exports = router;
