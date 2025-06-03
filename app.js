const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");
const multer = require("multer"); // 新增：用于文件上传
const fs = require("fs"); // 新增：文件系统操作
const http = require("http");
const initializeSocket = require("./config/socket");
const maintenanceService = require('./services/maintenanceService');

const db = require("./config/test-database");
// 文件上传功能
const upload = require("./config/multerConfig"); // 确保你已经配置了multer
const routeRouter = require("./routes/route"); // 路径规划新增
const auth = require("./middleware/auth"); // 新增：身份验证中间件

const app = express();
const server = http.createServer(app);
const io = initializeSocket(server);

// 中间件配
app.use(express.urlencoded({ extended: true })); // 解析表单数据
app.use(express.json()); // 解析JSON数据
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

// 设置EJS为视图引擎
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// 配置静态文件服务
app.use(express.static(path.join(__dirname, "public"))); // 重要：设置静态目录

// 优先处理静态文件
app.use("/user/images", express.static(path.join(__dirname, "public/images")));

// 配置静态文件服务
app.use("/user/images", express.static(path.join(__dirname, "public/images")));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // 新增：上传文件静态目录

// 添加全局身份验证中间件
app.use(auth.setCurrentUser);

// 在 Express 应用中添加错误处理中间件
app.use((err, req, res, next) => {
  console.error("Error:", err);

  res.status(500).render("error", {
    message: err.message || "服务器内部错误",
    error: process.env.NODE_ENV === "development" ? err : null,
  });
});

const indexRouter = require("./routes/index");
const diaryRouter = require("./routes/diary");
const userRouter = require("./routes/userRoutes"); // 新增：用户路由
const attractionRouter = require("./routes/attraction");
const messageRouter = require("./routes/messageRoutes"); // 新增：消息路由
const authRouter = require('./routes/auth');  // 添加认证路由
const placeRouter = require("./routes/placeRoutes"); // 新增：场所查询路由
const foodRouter = require("./routes/foodRoutes"); // 新增：美食搜索路由
const animationRoutes = require('./routes/animationRoutes'); // 新增：动画生成路由

// 注册路由
app.use("/", indexRouter);
app.use("/", authRouter);  // 添加认证路由
app.use("/diary", diaryRouter);
app.use("/user", userRouter); // 新增：注册用户路由
app.use("/attraction", attractionRouter);
app.use("/api", routeRouter); // 路径规划新增
app.use("/messages", messageRouter); // 新增：注册消息路由
app.use("/api/places", placeRouter); // 新增：注册场所查询路由, e.g., /api/places/nearby
app.use("/api/food", foodRouter); // 新增：注册美食搜索路由, e.g., /api/food/search
app.use('/animation', animationRoutes); // 新增：注册动画生成路由

db.connect((err) => {
  if (err) throw err;
  console.log("MySQL connected");
});

app.get("/error", (req, res) => {
  res.status(500).render("error", {
    message: "自定义错误信息", // 必须传入
    error: new Error("测试错误"), // 可选（仅在开发环境显示）
  });
});

//登录页面路由
app.get("/login", (req, res) => {
  // 如果已登录，重定向到首页
  if (req.session.user) {
    return res.redirect("/");
  }
  res.render("login"); // 渲染 views/login.ejs
});

// 新增：日记发布路由
app.get("/publish", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  res.sendFile(path.join(__dirname, "web/publish.html"));
});

// 更新用户信息
app.put("/api/user/profile", upload.single("avatar"), (req, res) => {
  console.log("req.user", req.session.user);
  const userId = req.session.user.id; // 假设用户已通过认证
  const {
    username,
    gender,
    birthday,
    location,
    bio,
    interests,
    currentPassword,
    newPassword,
  } = req.body;
  console.log("req.body", req.body);
  // 首先检查用户名是否已存在
  db.query(
    "SELECT id FROM user_information WHERE username = ? AND id != ?",
    [username, userId],
    (err, userRows) => {
      if (err) {
        console.error("数据库查询错误:", err);
        return res.status(500).json({ success: false, message: "服务器错误" });
      }

      if (userRows.length > 0) {
        return res
          .status(400)
          .json({ success: false, message: "用户名已存在" });
      }

      // 准备更新数据
      const updateData = {
        username,
        gender,
        birthday: birthday || null,
        location,
        bio,
        interests,
      };

      // 处理头像上传
      if (req.file) {
        updateData.avatar = req.file.filename;

        // 先查询旧头像以便删除
        db.query(
          "SELECT avatar FROM user_information WHERE id = ?",
          [userId],
          (err, oldUser) => {
            if (err) {
              console.error("数据库查询错误:", err);
              return res
                .status(500)
                .json({ success: false, message: "服务器错误" });
            }

            if (oldUser[0].avatar) {
              const fs = require("fs");
              const oldAvatarPath = path.join(
                __dirname,
                "../public/uploads/avatars",
                oldUser[0].avatar
              );
              if (fs.existsSync(oldAvatarPath)) {
                fs.unlinkSync(oldAvatarPath);
              }
            }

            // 继续处理密码更新
            handlePasswordUpdate();
          }
        );
      } else {
        // 没有新头像，直接处理密码更新
        handlePasswordUpdate();
      }

      function handlePasswordUpdate() {
        // 如果需要修改密码
        if (currentPassword && newPassword) {
          // 验证当前密码
          db.query(
            "SELECT password FROM user_information WHERE id = ?",
            [userId],
            (err, user) => {
              if (err) {
                console.error("数据库查询错误:", err);
                return res
                  .status(500)
                  .json({ success: false, message: "服务器错误" });
              }

              bcrypt.compare(
                currentPassword,
                user[0].password,
                (err, isMatch) => {
                  if (err) {
                    console.error("密码比较错误:", err);
                    return res
                      .status(500)
                      .json({ success: false, message: "服务器错误" });
                  }

                  if (!isMatch) {
                    return res
                      .status(400)
                      .json({ success: false, message: "当前密码不正确" });
                  }

                  // 加密新密码
                  bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
                    if (err) {
                      console.error("密码哈希错误:", err);
                      return res
                        .status(500)
                        .json({ success: false, message: "服务器错误" });
                    }

                    updateData.password = hashedPassword;
                    updateUserInfo();
                  });
                }
              );
            }
          );
        } else {
          // 不需要修改密码，直接更新用户信息
          updateUserInfo();
        }
      }

      function updateUserInfo() {
        // 更新数据库
        db.query(
          "UPDATE user_information SET ? WHERE id = ?",
          [updateData, userId],
          (err) => {
            if (err) {
              console.error("数据库更新错误:", err);
              return res
                .status(500)
                .json({ success: false, message: "服务器错误" });
            }

            // 获取更新后的用户信息
            db.query(
              "SELECT id, username, email, avatar, gender, birthday, location, bio, interests FROM user_information WHERE id = ?",
              [userId],
              (err, updatedUser) => {
                if (err) {
                  console.error("数据库查询错误:", err);
                  return res
                    .status(500)
                    .json({ success: false, message: "服务器错误" });
                }

                res.json({
                  success: true,
                  user: {
                    ...updatedUser[0],
                    avatar: updatedUser[0].avatar
                      ? `/uploads/avatars/${updatedUser[0].avatar}`
                      : null,
                  },
                });
              }
            );
          }
        );
      }
    }
  );
});

// 登录提交路由
app.post("/api/login", (req, res) => {
  console.log("req.body:", req.body);
  const { username, password } = req.body;

  const sql = "SELECT * FROM user_information WHERE username = ? LIMIT 1";
  console.log(username);
  db.query(sql, [username], async (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "数据库错误" });
    }
    console.log("result:", results);
    if (results.length === 0) {
      return res.json({ success: false, message: "用户不存在" });
    }

    const user = results[0];

    // 密码验证
    const match = await bcrypt.compare(password, user.password);
    console.log("password:", password, "user.password:", user.password);
    if (!match) {
      return res.json({ success: false, message: "密码错误" });
    }

    // 创建会话
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
    };

    res.json({ success: true });
  });
});

//登出提交路由
app.post("/api/logout", (req, res) => {
  console.log("try /api/logout");
  req.session.destroy((err) => {
    if (err) {
      console.error("登出失败:", err);
      return res.status(500).json({ success: false });
    }
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

// 用户名检查接口
app.get("/api/check-username", (req, res) => {
  const { username } = req.query;

  db.query(
    "SELECT 1 FROM user_information WHERE username = ? LIMIT 1",
    [username],
    (err, results) => {
      res.json({ available: results.length === 0 });
    }
  );
});

//注册页面路由
app.get("/register", (req, res) => {
  console.log("get into register");
  // 如果已登录，重定向到首页
  if (req.session.user) {
    return res.redirect("/");
  }
  res.render("register"); // 渲染 views/login.ejs
});

// 修改注册接口
app.post("/api/register", (req, res) => {
  const { username, email, password } = req.body;

  // 先检查用户名是否已存在
  db.query(
    "SELECT 1 FROM user_information WHERE username = ? LIMIT 1",
    [username],
    (err, users) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "注册失败" });
      }

      if (users.length > 0) {
        return res.status(409).json({
          success: false,
          message: "用户名已被使用",
        });
      }

      // 哈希密码
      bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ success: false, message: "注册失败" });
        }

        // 插入新用户
        db.query(
          "INSERT INTO user_information (username, email, password) VALUES (?, ?, ?)",
          [username, email, hashedPassword],
          (err) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ success: false, message: "注册失败" });
            }

            res.json({ success: true });
          }
        );
      });
    }
  );
});

// 添加测试路由检查服务器是否运行正常
app.get("/test", (req, res) => {
  console.log("测试路由被访问");
  res.send("服务器运行正常");
});

function getAttractions(category = "all", sort = "hot", callback) {
  let query = "SELECT * FROM attractions";
  const params = [];

  if (category && category !== "all") {
    query += " WHERE category = ?";
    params.push(category);
  }

  if (sort === "rating") {
    query += " ORDER BY rating DESC";
  } else if (sort === "distance") {
    query += " ORDER BY distance ASC";
  } else {
    query += " ORDER BY comment_count DESC";
  }

  db.query(query, params, (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
}

app.get("/attraction-explorer", async (req, res) => {
  try {
    const { category = "all", sort = "hot" } = req.query;
    getAttractions(category, sort, (err, attractions) => {
      if (err) {
        console.error(err);
        res.status(500).send("Server Error");
      } else {
        res.render("attraction-explorer", {
          attractions,
          currentCategory: category,
          currentSort: sort,
          helpers: {
            formatNumber: (num) => {
              if (num >= 10000) return (num / 10000).toFixed(1) + "万";
              return num.toString();
            },
          },
        });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

// 主页路由
app.use("/", indexRouter);

// 日记相关路由
app.use("/", diaryRouter);

// 设置定时维护任务
function scheduleMaintenance() {
  // 每天凌晨3点运行维护任务
  const maintenanceTime = new Date();
  maintenanceTime.setHours(3, 0, 0, 0);
  
  // 如果当前时间已经过了今天的维护时间，设置为明天
  if (maintenanceTime < new Date()) {
    maintenanceTime.setDate(maintenanceTime.getDate() + 1);
  }
  
  const timeUntilMaintenance = maintenanceTime - new Date();
  
  // 设置定时器
  setTimeout(() => {
    // 运行维护任务
    maintenanceService.runMaintenance((err, results) => {
      if (err) {
        console.error('维护任务运行失败:', err);
      } else {
        console.log('维护任务完成:', results);
      }
      
      // 重新调度下一次维护
      scheduleMaintenance();
    });
  }, timeUntilMaintenance);
  
  console.log(`下次维护任务将在 ${maintenanceTime.toLocaleString()} 运行`);
}

// 启动维护任务调度
scheduleMaintenance();

// 立即运行一次维护任务
maintenanceService.runMaintenance((err, results) => {
  if (err) {
    console.error('初始维护任务运行失败:', err);
  } else {
    console.log('初始维护任务完成:', results);
  }
});

// 修改服务器启动代码
server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
