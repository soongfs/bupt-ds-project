// middleware/auth.js

// 检查用户是否已登录的中间件
exports.requireLogin = (req, res, next) => {
  if (!req.session.user) {
    // 如果是 API 请求，返回 JSON 响应
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(401).json({
        success: false,
        message: '请先登录'
      });
    }
    // 如果是普通请求，重定向到登录页面
    return res.redirect('/login');
  }
  next();
};

// 检查用户是否未登录的中间件（用于登录、注册页面）
exports.requireGuest = (req, res, next) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  next();
};

// 将当前用户信息添加到响应locals中，使其在所有视图中可用
exports.setCurrentUser = (req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
};

// 验证用户是否已登录
exports.isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
};

// 验证用户是否未登录
exports.isNotAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    next();
  } else {
    res.redirect('/');
  }
}; 