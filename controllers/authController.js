// controllers/authController.js
const bcrypt = require("bcrypt");
const User = require("../models/userModel");

exports.login = async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findByUsername(username);
  if (!user) return res.json({ success: false, message: "用户不存在" });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.json({ success: false, message: "密码错误" });
  req.session.user = { id: user.id, username: user.username };
  res.json({ success: true });
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid").json({ success: true });
  });
};

exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  if (await User.findByUsername(username)) {
    return res.status(409).json({ success: false, message: "用户名已被使用" });
  }
  const hash = await bcrypt.hash(password, 10);
  await User.create({ username, email, password: hash });
  res.json({ success: true });
};
