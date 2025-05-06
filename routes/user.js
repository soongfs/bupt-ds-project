// routes/user.js
const express = require("express");
const router = express.Router();
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
