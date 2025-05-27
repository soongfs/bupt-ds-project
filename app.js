// const express = require('express');
// const mysql = require('mysql2');
// const bcrypt = require('bcrypt');
// const session = require('express-session');
// const path = require('path');
// const multer = require('multer'); // 新增：用于文件上传
// const fs = require('fs'); // 新增：文件系统操作

// const db = require('./config/test-database');
// // 文件上传功能
// const upload = require('./config/multerConfig'); // 确保你已经配置了multer

// const app = express();

// // 中间件配
// app.use(express.urlencoded({ extended: true }));  // 解析表单数据
// app.use(express.json());                          // 解析JSON数据
// app.use(session({
//   secret: 'your-secret-key',
//   resave: false,
//   saveUninitialized: false
// }));

// // 设置EJS为视图引擎
// app.set('views', path.join(__dirname, 'web/views'));
// app.set('view engine', 'ejs');

// // 配置静态文件服务
// app.use(express.static(path.join(__dirname, 'web')));  // 重要：设置静态目录

// // 优先处理静态文件
// app.use('/user/images', express.static(path.join(__dirname, 'web/images')));

// // 配置静态文件服务
// app.use(express.static(path.join(__dirname, 'web')));
// app.use('/user/images', express.static(path.join(__dirname, 'web/images')));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // 新增：上传文件静态目录

// // 在 Express 应用中添加错误处理中间件
// app.use((err, req, res, next) => {
//   console.error('Error:', err);

//   res.status(500).render('error', {
//     message: err.message || '服务器内部错误',
//     error: process.env.NODE_ENV === 'development' ? err : null
//   });
// });

// const indexRouter = require('./routes/index');
// const diaryRouter = require('./routes/diary');
// const attractionRouter = require('./routes/attraction');

// db.connect(err => {
//   if (err) throw err;
//   console.log('MySQL connected');
// });

// app.get("/error", (req, res) => {
//   res.status(500).render("error", {
//     message: "自定义错误信息",  // 必须传入
//     error: new Error("测试错误"),  // 可选（仅在开发环境显示）
//   });
// });

// //登录页面路由
// app.get('/login', (req, res) => {
//   // 如果已登录，重定向到首页
//   if (req.session.user) {
//     return res.redirect('/');
//   }
//   res.render('login'); // 渲染 views/login.ejs
// });

// // 新增：日记发布路由
// app.get('/publish', (req, res) => {
//   if (!req.session.user) {
//     return res.redirect('/login');
//   }
//   res.sendFile(path.join(__dirname, 'web/publish.html'));
// });

// // 用户路由
// // 它可能会拦截 /user/images/avatar1.jpg（因为 images 会被当作 :id）所以需要在文件的开头增加user的静态路由
// app.get('/user/:id', (req, res) => {
//   const userId = req.params.id;

//   // 查询用户信息
//   const userQuery = 'SELECT id, username, email, avatar FROM user_information WHERE id = ?';

//   db.query(userQuery, [userId], (err, userResults) => {
//     if (err) {
//       console.error('数据库查询错误:', err);
//       return res.status(500).send('服务器错误');
//     }

//     if (userResults.length === 0) {
//       return res.status(404).render('404', { message: '用户不存在' });
//     }

//     const user = userResults[0];
//     console.log("user information", user);

//     // 查询用户日记数据 (假设有diaries表)
//     const travel_diaries = 'SELECT * FROM travel_diaries WHERE user_id = ? ORDER BY id DESC LIMIT 5';

//     db.query(travel_diaries, [userId], (err, diaryResults) => {
//       if (err) {
//         console.error('日记查询错误:', err);
//         // 即使日记查询失败，仍然返回用户基本信息
//         return res.render('user', {
//           user: user,
//           diaries: [],
//           stats: {
//             followers: 0,
//             following: 0,
//             diariesCount: 0,
//             rating: 0
//           }
//         });
//       }
//       console.log("diary results", diaryResults);

//       // 查询用户统计数据 (假设有user_stats表)
//       const statsQuery = 'SELECT followers, following, diaries_count, rating FROM user_stats WHERE user_id = ?';

//       db.query(statsQuery, [userId], (err, statsResults) => {
//         const stats = statsResults.length > 0 ? statsResults[0] : {
//           followers: 0,
//           following: 0,
//           diariesCount: 0,
//           rating: 0
//         };
//         console.log("user stats", stats);

//         // 渲染页面并传递所有数据
//         res.render('user', {
//           user: user,
//           diaries: diaryResults,
//           stats: stats
//         });
//       });
//     });
//   });
// });

// // 获取用户编辑页面
// app.get('/user/:id/edit', (req, res) => {
//   const userId = req.params.id;

//   db.query(
//     'SELECT id, username, email, avatar FROM user_information WHERE id = ?',
//     [userId],
//     (err, rows) => {
//       if (err) {
//         console.error('数据库查询错误:', err);
//         return res.status(500).send('服务器错误');
//       }

//       if (rows.length === 0) {
//         return res.status(404).send('用户不存在');
//       }

//       const user = rows[0];

//       // 渲染编辑页面
//       res.render('user_edit', {
//         user: {
//           ...user,
//           avatar: user.avatar ? `/${user.avatar}` : null
//         }
//       });
//     }
//   );
// });

// // 更新用户信息
// app.put('/api/user/profile', upload.single('avatar'), (req, res) => {
//   console.log("req.user", req.session.user);
//   const userId = req.session.user.id; // 假设用户已通过认证
//   const {
//     username,
//     gender,
//     birthday,
//     location,
//     bio,
//     interests,
//     currentPassword,
//     newPassword
//   } = req.body;
//   console.log("req.body", req.body);
//   // 首先检查用户名是否已存在
//   db.query(
//     'SELECT id FROM user_information WHERE username = ? AND id != ?',
//     [username, userId],
//     (err, userRows) => {
//       if (err) {
//         console.error('数据库查询错误:', err);
//         return res.status(500).json({ success: false, message: '服务器错误' });
//       }

//       if (userRows.length > 0) {
//         return res.status(400).json({ success: false, message: '用户名已存在' });
//       }

//       // 准备更新数据
//       const updateData = {
//         username,
//         gender,
//         birthday: birthday || null,
//         location,
//         bio,
//         interests
//       };

//       // 处理头像上传
//       if (req.file) {
//         updateData.avatar = req.file.filename;

//         // 先查询旧头像以便删除
//         db.query(
//           'SELECT avatar FROM user_information WHERE id = ?',
//           [userId],
//           (err, oldUser) => {
//             if (err) {
//               console.error('数据库查询错误:', err);
//               return res.status(500).json({ success: false, message: '服务器错误' });
//             }

//             if (oldUser[0].avatar) {
//               const fs = require('fs');
//               const oldAvatarPath = path.join(__dirname, '../public/uploads/avatars', oldUser[0].avatar);
//               if (fs.existsSync(oldAvatarPath)) {
//                 fs.unlinkSync(oldAvatarPath);
//               }
//             }

//             // 继续处理密码更新
//             handlePasswordUpdate();
//           }
//         );
//       } else {
//         // 没有新头像，直接处理密码更新
//         handlePasswordUpdate();
//       }

//       function handlePasswordUpdate() {
//         // 如果需要修改密码
//         if (currentPassword && newPassword) {
//           // 验证当前密码
//           db.query(
//             'SELECT password FROM user_information WHERE id = ?',
//             [userId],
//             (err, user) => {
//               if (err) {
//                 console.error('数据库查询错误:', err);
//                 return res.status(500).json({ success: false, message: '服务器错误' });
//               }

//               bcrypt.compare(currentPassword, user[0].password, (err, isMatch) => {
//                 if (err) {
//                   console.error('密码比较错误:', err);
//                   return res.status(500).json({ success: false, message: '服务器错误' });
//                 }

//                 if (!isMatch) {
//                   return res.status(400).json({ success: false, message: '当前密码不正确' });
//                 }

//                 // 加密新密码
//                 bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
//                   if (err) {
//                     console.error('密码哈希错误:', err);
//                     return res.status(500).json({ success: false, message: '服务器错误' });
//                   }

//                   updateData.password = hashedPassword;
//                   updateUserInfo();
//                 });
//               });
//             }
//           );
//         } else {
//           // 不需要修改密码，直接更新用户信息
//           updateUserInfo();
//         }
//       }

//       function updateUserInfo() {
//         // 更新数据库
//         db.query(
//           'UPDATE user_information SET ? WHERE id = ?',
//           [updateData, userId],
//           (err) => {
//             if (err) {
//               console.error('数据库更新错误:', err);
//               return res.status(500).json({ success: false, message: '服务器错误' });
//             }

//             // 获取更新后的用户信息
//             db.query(
//               'SELECT id, username, email, avatar, gender, birthday, location, bio, interests FROM user_information WHERE id = ?',
//               [userId],
//               (err, updatedUser) => {
//                 if (err) {
//                   console.error('数据库查询错误:', err);
//                   return res.status(500).json({ success: false, message: '服务器错误' });
//                 }

//                 res.json({
//                   success: true,
//                   user: {
//                     ...updatedUser[0],
//                     avatar: updatedUser[0].avatar ? `/uploads/avatars/${updatedUser[0].avatar}` : null
//                   }
//                 });
//               }
//             );
//           }
//         );
//       }
//     }
//   );
// });

// // 登录提交路由
// app.post('/api/login', (req, res) => {
//   console.log("req.body:", req.body);
//   const { username, password } = req.body;

//   const sql = 'SELECT * FROM user_information WHERE username = ? LIMIT 1';
//   console.log(username);
//   db.query(sql, [username], async (err, results) => {
//     if (err) {
//       console.error(err);
//       return res.status(500).json({ success: false, message: '数据库错误' });
//     }
//     console.log("result:", results);
//     if (results.length === 0) {
//       return res.json({ success: false, message: '用户不存在' });
//     }

//     const user = results[0];

//     // 密码验证
//     const match = await bcrypt.compare(password, user.password);
//     console.log("password:", password, "user.password:", user.password);
//     if (!match) {
//       return res.json({ success: false, message: '密码错误' });
//     }

//     // 创建会话
//     req.session.user = {
//       id: user.id,
//       username: user.username,
//       email: user.email
//     };

//     res.json({ success: true });
//   });
// });

// //登出提交路由
// app.post('/api/logout', (req, res) => {
//   console.log("try /api/logout");
//   req.session.destroy(err => {
//     if (err) {
//       console.error('登出失败:', err);
//       return res.status(500).json({ success: false });
//     }
//     res.clearCookie('connect.sid');
//     res.json({ success: true });
//   });
// });

// // 用户名检查接口
// app.get('/api/check-username', (req, res) => {
//   const { username } = req.query;

//   db.query(
//     'SELECT 1 FROM user_information WHERE username = ? LIMIT 1',
//     [username],
//     (err, results) => {
//       res.json({ available: results.length === 0 });
//     }
//   );
// });

// //注册页面路由
// app.get('/register', (req, res) => {
//   console.log("get into register");
//   // 如果已登录，重定向到首页
//   if (req.session.user) {
//     return res.redirect('/');
//   }
//   res.render('register'); // 渲染 views/login.ejs
// });

// // 修改注册接口
// app.post('/api/register', async (req, res) => {
//   const { username, email, password } = req.body;

//   try {
//     // 先检查用户名是否已存在
//     const [users] = await db.promise().query(
//       'SELECT 1 FROM user_information WHERE username = ? LIMIT 1',
//       [username]
//     );

//     if (users.length > 0) {
//       return res.status(409).json({
//         success: false,
//         message: '用户名已被使用'
//       });
//     }

//     // 哈希密码
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // 插入新用户
//     await db.promise().query(
//       'INSERT INTO user_information (username, email, password) VALUES (?, ?, ?)',
//       [username, email, hashedPassword]
//     );

//     res.json({ success: true });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: '注册失败' });
//   }
// });

// // 添加测试路由检查服务器是否运行正常
// app.get('/test', (req, res) => {
//   console.log("测试路由被访问");
//   res.send("服务器运行正常");
// });

// async function getAttractions(category = 'all', sort = 'hot') {
//   return new Promise((resolve, reject) => {
//     let query = 'SELECT * FROM attractions';
//     const params = [];

//     if (category && category !== 'all') {
//       query += ' WHERE category = ?';
//       params.push(category);
//     }

//     if (sort === 'rating') {
//       query += ' ORDER BY rating DESC';
//     } else if (sort === 'distance') {
//       query += ' ORDER BY distance ASC';
//     } else {
//       query += ' ORDER BY comment_count DESC';
//     }

//     db.query(query, params, (err, results) => {
//       if (err) return reject(err);
//       resolve(results);
//     });
//   });
// }

// // 景点路由
// app.use('/', attractionRouter);

// // 主页路由
// app.use('/', indexRouter);

// // 日记相关路由
// app.use('/', diaryRouter);

// // 启动服务器
// app.listen(3001, () => {
//   console.log('Server running on http://localhost:3001');
// });
const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");
const multer = require("multer"); // 新增：用于文件上传
const fs = require("fs"); // 新增：文件系统操作

const app = express();

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
app.set("views", path.join(__dirname, "/views"));
app.set("view engine", "ejs");

// 配置静态文件服务
app.use(express.static(path.join(__dirname, "web"))); // 重要：设置静态目录

// 优先处理静态文件
app.use("/user/images", express.static(path.join(__dirname, "web/images")));

// 配置静态文件服务
app.use(express.static(path.join(__dirname, "web")));
app.use("/user/images", express.static(path.join(__dirname, "web/images")));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // 新增：上传文件静态目录

// 在 Express 应用中添加错误处理中间件
app.use((err, req, res, next) => {
  console.error("Error:", err);

  res.status(500).render("error", {
    message: err.message || "服务器内部错误",
    error: process.env.NODE_ENV === "development" ? err : null,
  });
});

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "diary-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 限制5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("只允许上传图片文件"), false);
    }
  },
});

// 数据库连接
const db = mysql.createConnection({
  // host: 'localhost',
  // 本地开发遇到问题时，检查此项是否需要改为localhost
  host: "152.136.239.207",
  user: "webuser",
  password: "}@)]72aMbPn5",
  database: "tourism_db",
});

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

// 新增：处理日记提交
// app.post('/api/diaries', upload.single('coverImage'), (req, res) => {
//   if (!req.session.user) {
//     return res.status(401).json({ success: false, message: '未登录' });
//   }
//
//   const { title, content, tags, allowComments, syncToProfile, fansOnly, status } = req.body;
//   const userId = req.session.user.id;
//   console.log("userid",userId);//可以成功读取到用户id
//
//   // 验证必要字段
//   if (!title || !content) {
//     return res.status(400).json({
//       success: false,
//       message: '标题和内容不能为空'
//     });
//   }
//
//   // 处理封面图片路径
//   let coverImagePath = null;
//   if (req.file) {
//     coverImagePath = '/uploads/' + req.file.filename;
//   }
//
//   // 插入数据库
//   const sql = `
//     INSERT INTO travel_diaries
//     (user_id, title, content, like_count, comment_count, status, cover_image, categories)
//     VALUES (?, ?, ?, 0, 0, ?, ?, ?)
//   `;
//
//   db.query(
//     sql,
//     [
//       userId,
//       title,
//       content,
//       status || 1, // 默认为草稿
//       coverImagePath,
//       tags || ''
//     ],
//     (err, result) => {
//       if (err) {
//         console.error('数据库错误:', err);
//         return res.status(500).json({
//           success: false,
//           message: '数据库错误'
//         });
//       }
//
//       res.json({
//         success: true,
//         diaryId: result.insertId,
//         message: status === '2' ? '日记发布成功' : '草稿保存成功'
//       });
//     }
//   );
// });

// 日记提交接口
app.post(
  "/api/diaries",
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "mediaFiles", maxCount: 20 },
  ]),
  (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: "未登录" });
    }

    const {
      title,
      content,
      tags,
      allowComments,
      syncToProfile,
      fansOnly,
      status,
      sections,
      mediaItems,
    } = req.body;

    const userId = req.session.user.id;

    // 验证必要字段
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: "标题和内容不能为空",
      });
    }

    // 开始数据库事务
    db.beginTransaction((beginErr) => {
      if (beginErr) {
        console.error("事务开始错误:", beginErr);
        return res.status(500).json({
          success: false,
          message: "数据库错误",
        });
      }

      // 1. 插入主日记记录
      let coverImagePath = null;
      if (req.files["coverImage"]?.[0]) {
        coverImagePath = "/uploads/" + req.files["coverImage"][0].filename;
      }

      db.query(
        `INSERT INTO travel_diaries 
            (user_id, title, content, like_count, comment_count, status, cover_image, categories) 
            VALUES (?, ?, ?, 0, 0, ?, ?, ?)`,
        [userId, title, content, status || 1, coverImagePath, tags || ""],
        (diaryErr, diaryResult) => {
          if (diaryErr) {
            return db.rollback(() => {
              console.error("日记插入错误:", diaryErr);
              res.status(500).json({
                success: false,
                message: "数据库错误",
              });
            });
          }

          const diaryId = diaryResult.insertId;
          let completedOperations = 0;
          const totalOperations = (sections ? 1 : 0) + (mediaItems ? 1 : 0);

          // 如果没有分段和媒体项，直接提交事务
          if (totalOperations === 0) {
            return db.commit((commitErr) => {
              if (commitErr) {
                return db.rollback(() => {
                  console.error("事务提交错误:", commitErr);
                  res.status(500).json({
                    success: false,
                    message: "数据库错误",
                  });
                });
              }
              res.json({
                success: true,
                diaryId: diaryId,
                message: status === "2" ? "日记发布成功" : "草稿保存成功",
              });
            });
          }

          // 2. 插入分段数据
          if (sections) {
            try {
              const parsedSections = JSON.parse(sections);
              let sectionsProcessed = 0;

              if (parsedSections.length === 0) {
                completedOperations++;
                checkAllDone();
              } else {
                parsedSections.forEach((section, index) => {
                  db.query(
                    `INSERT INTO diary_sections 
                                    (diary_id, day_number, section_title, section_content, section_order) 
                                    VALUES (?, ?, ?, ?, ?)`,
                    [
                      diaryId,
                      section.dayNumber,
                      section.title,
                      section.content,
                      section.order,
                    ],
                    (sectionErr) => {
                      if (sectionErr) {
                        return db.rollback(() => {
                          console.error("分段插入错误:", sectionErr);
                          res.status(500).json({
                            success: false,
                            message: "数据库错误",
                          });
                        });
                      }

                      sectionsProcessed++;
                      if (sectionsProcessed === parsedSections.length) {
                        completedOperations++;
                        checkAllDone();
                      }
                    }
                  );
                });
              }
            } catch (parseErr) {
              return db.rollback(() => {
                console.error("分段数据解析错误:", parseErr);
                res.status(400).json({
                  success: false,
                  message: "分段数据格式错误",
                });
              });
            }
          }

          // 3. 处理媒体数据
          if (mediaItems) {
            try {
              const parsedMedia = JSON.parse(mediaItems);
              const mediaFiles = req.files["mediaFiles"] || [];
              let mediaProcessed = 0;

              if (parsedMedia.length === 0) {
                completedOperations++;
                checkAllDone();
              } else {
                parsedMedia.forEach((media, index) => {
                  let mediaUrl = media.url;

                  // 如果是新上传的文件，更新路径
                  if (mediaFiles[index]) {
                    mediaUrl = "/uploads/" + mediaFiles[index].filename;
                  }

                  db.query(
                    `INSERT INTO diary_media 
                                    (diary_id, media_url, media_type, caption, display_order) 
                                    VALUES (?, ?, ?, ?, ?)`,
                    [diaryId, mediaUrl, media.type, media.caption, media.order],
                    (mediaErr) => {
                      if (mediaErr) {
                        return db.rollback(() => {
                          console.error("媒体插入错误:", mediaErr);
                          res.status(500).json({
                            success: false,
                            message: "数据库错误",
                          });
                        });
                      }

                      mediaProcessed++;
                      if (mediaProcessed === parsedMedia.length) {
                        completedOperations++;
                        checkAllDone();
                      }
                    }
                  );
                });
              }
            } catch (parseErr) {
              return db.rollback(() => {
                console.error("媒体数据解析错误:", parseErr);
                res.status(400).json({
                  success: false,
                  message: "媒体数据格式错误",
                });
              });
            }
          }

          // 检查所有操作是否完成
          function checkAllDone() {
            if (completedOperations === totalOperations) {
              db.commit((commitErr) => {
                if (commitErr) {
                  return db.rollback(() => {
                    console.error("事务提交错误:", commitErr);
                    res.status(500).json({
                      success: false,
                      message: "数据库错误",
                    });
                  });
                }
                res.json({
                  success: true,
                  diaryId: diaryId,
                  message: status === "2" ? "日记发布成功" : "草稿保存成功",
                });
              });
            }
          }
        }
      );
    });
  }
);

app.put("/api/diaries-edit/:id", (req, res) => {
  const diaryId = req.params.id;
  const {
    title,
    dayTitles = [],
    sectionTitles = [],
    sectionContents = [],
    tips,
    content,
  } = req.body;
  console.log("content ", req.body.content);
  // 1. 更新日记基本信息
  db.query(
    "UPDATE travel_diaries SET title = ?, content = ? WHERE id = ?",
    [title, content, diaryId],
    (err, results) => {
      if (err) {
        console.error("更新日记基本信息错误:", err);
        return res.status(500).json({ success: false, message: "服务器错误" });
      }

      // 2. 更新每日章节信息
      let completedDayUpdates = 0;
      if (dayTitles.length === 0) {
        updateSections();
      } else {
        dayTitles.forEach((dayTitle, i) => {
          db.query(
            "UPDATE diary_sections SET section_title = ? WHERE diary_id = ? AND day_number = ?",
            [dayTitle, diaryId, i + 1],
            (err, results) => {
              if (err) {
                console.error("更新每日章节错误:", err);
                return res
                  .status(500)
                  .json({ success: false, message: "服务器错误" });
              }

              completedDayUpdates++;
              if (completedDayUpdates === dayTitles.length) {
                updateSections();
              }
            }
          );
        });
      }

      function updateSections() {
        // 3. 更新具体章节内容
        let completedSectionUpdates = 0;
        if (sectionTitles.length === 0) {
          return res.json({ success: true });
        }

        sectionTitles.forEach((sectionTitle, i) => {
          db.query(
            "UPDATE diary_sections SET section_title = ?, section_content = ? WHERE diary_id = ? AND id = ?",
            [sectionTitle, sectionContents[i], diaryId, i + 1],
            (err, results) => {
              if (err) {
                console.error("更新章节内容错误:", err);
                return res
                  .status(500)
                  .json({ success: false, message: "服务器错误" });
              }

              completedSectionUpdates++;
              if (completedSectionUpdates === sectionTitles.length) {
                res.json({ success: true });
              }
            }
          );
        });
      }
    }
  );
});

// 用户路由
// 它可能会拦截 /user/images/avatar1.jpg（因为 images 会被当作 :id）所以需要在文件的开头增加user的静态路由
app.get("/user/:id", (req, res) => {
  const userId = req.params.id;

  // 查询用户信息
  const userQuery =
    "SELECT id, username, email, avatar FROM user_information WHERE id = ?";

  db.query(userQuery, [userId], (err, userResults) => {
    if (err) {
      console.error("数据库查询错误:", err);
      return res.status(500).send("服务器错误");
    }

    if (userResults.length === 0) {
      return res.status(404).render("404", { message: "用户不存在" });
    }

    const user = userResults[0];
    console.log("user information", user);

    // 查询用户日记数据 (假设有diaries表)
    const travel_diaries =
      "SELECT * FROM travel_diaries WHERE user_id = ? ORDER BY id DESC LIMIT 5";

    db.query(travel_diaries, [userId], (err, diaryResults) => {
      if (err) {
        console.error("日记查询错误:", err);
        // 即使日记查询失败，仍然返回用户基本信息
        return res.render("user", {
          user: user,
          diaries: [],
          stats: {
            followers: 0,
            following: 0,
            diariesCount: 0,
            rating: 0,
          },
        });
      }
      console.log("diary results", diaryResults);

      // 查询用户统计数据 (假设有user_stats表)
      const statsQuery =
        "SELECT followers, following, diaries_count, rating FROM user_stats WHERE user_id = ?";

      db.query(statsQuery, [userId], (err, statsResults) => {
        const stats =
          statsResults.length > 0
            ? statsResults[0]
            : {
                followers: 0,
                following: 0,
                diariesCount: 0,
                rating: 0,
              };
        console.log("user stats", stats);

        // 渲染页面并传递所有数据
        res.render("user", {
          user: user,
          diaries: diaryResults,
          stats: stats,
        });
      });
    });
  });
});

// 获取用户编辑页面
app.get("/user/:id/edit", (req, res) => {
  const userId = req.params.id;

  db.query(
    "SELECT id, username, email, avatar FROM user_information WHERE id = ?",
    [userId],
    (err, rows) => {
      if (err) {
        console.error("数据库查询错误:", err);
        return res.status(500).send("服务器错误");
      }

      if (rows.length === 0) {
        return res.status(404).send("用户不存在");
      }

      const user = rows[0];

      // 渲染编辑页面
      res.render("user_edit", {
        user: {
          ...user,
          avatar: user.avatar ? `/${user.avatar}` : null,
        },
      });
    }
  );
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
app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // 先检查用户名是否已存在
    const [users] = await db
      .promise()
      .query("SELECT 1 FROM user_information WHERE username = ? LIMIT 1", [
        username,
      ]);

    if (users.length > 0) {
      return res.status(409).json({
        success: false,
        message: "用户名已被使用",
      });
    }

    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 插入新用户
    await db
      .promise()
      .query(
        "INSERT INTO user_information (username, email, password) VALUES (?, ?, ?)",
        [username, email, hashedPassword]
      );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "注册失败" });
  }
});

// 添加测试路由检查服务器是否运行正常
app.get("/test", (req, res) => {
  console.log("测试路由被访问");
  res.send("服务器运行正常");
});

async function getAttractions(category = "all", sort = "hot") {
  return new Promise((resolve, reject) => {
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
      if (err) return reject(err);
      resolve(results);
    });
  });
}

// 景点探索路由
app.get("/attraction-explorer", async (req, res) => {
  try {
    const { category = "all", sort = "hot" } = req.query;
    const attractions = await getAttractions(category, sort);

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
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

// 获取日记列表
app.get("/diary-discovery", (req, res) => {
  // 获取查询参数
  const {
    page = 1,
    q: searchQuery = "",
    category = "全部主题",
    sort = "hot",
  } = req.query;
  const userId = req.session.user ? req.session.user.id : null;
  const limit = 12; // 每页显示的日记数量
  const offset = (page - 1) * limit;

  // 构建基础查询条件
  let whereClause = "";
  const params = [];

  // 添加搜索条件
  if (searchQuery) {
    whereClause +=
      " AND (d.title LIKE ? OR d.content LIKE ? OR u.username LIKE ?)";
    const queryParam = `%${searchQuery}%`;
    params.push(queryParam, queryParam, queryParam);
  }

  // 添加分类条件
  if (category !== "全部主题") {
    whereClause += " AND d.categories LIKE ?";
    params.push(`%${category}%`);
  }

  // 构建排序条件
  let orderBy = "";
  switch (sort) {
    case "hot":
      orderBy =
        "ORDER BY d.like_count DESC, d.view_count DESC, d.created_at DESC";
      break;
    case "newest":
      orderBy = "ORDER BY d.created_at DESC";
      break;
    case "featured":
      orderBy = "ORDER BY d.is_featured DESC, d.created_at DESC";
      break;
    default:
      orderBy =
        "ORDER BY d.like_count DESC, d.view_count DESC, d.created_at DESC";
  }
  console.log("succuss");
  // 查询日记总数（用于分页）
  const countQuery = `
        SELECT COUNT(*) as total 
        FROM travel_diaries d
        JOIN user_information u ON d.user_id = u.id
        ${whereClause}
    `;

  // 查询日记列表
  const diariesQuery = `
        SELECT 
            d.*, 
            u.username, 
            u.avatar,
            (SELECT COUNT(*) FROM travel_diaries) as like_count,
            (SELECT COUNT(*) FROM travel_diaries) as comment_count
        FROM travel_diaries d
        JOIN user_information u ON d.user_id = u.id
        ${whereClause}
        ${orderBy}
        LIMIT 6
    `;

  // 执行查询
  db.query(countQuery, params, (err, countResults) => {
    if (err) {
      console.error(err);
      return res.status(500).render("error", { error: "数据库查询错误" });
    }

    const total = countResults[0].total;
    const totalPages = Math.ceil(total / limit);

    // 添加用户ID到参数中（用于检查是否收藏）
    const diariesParams = [...params, userId || null, limit, offset];

    db.query(diariesQuery, diariesParams, (err, diaryResults) => {
      if (err) {
        console.error(err);
        return res.status(500).render("error", { error: "数据库查询错误" });
      }

      // 处理标签数据
      const diariesWithTags = diaryResults.map((diary) => {
        const tags = [];
        if (diary.tag_names && diary.tag_icons) {
          const tagNames = diary.tag_names.split(",");
          const tagIcons = diary.tag_icons.split(",");

          for (let i = 0; i < tagNames.length; i++) {
            tags.push({
              name: tagNames[i],
              icon: tagIcons[i],
            });
          }
        }

        return {
          ...diary,
          tags: tags,
          // 处理封面图片
          cover_image: diary.cover_image || null,
          // 处理是否精选
          is_featured: diary.is_featured || false,
        };
      });

      // 渲染页面
      // console.log("diaries",diariesWithTags);
      res.render("diary-discovery", {
        diaries: diariesWithTags,
        currentPage: parseInt(page),
        totalPages,
        searchQuery,
        currentCategory: category,
        sortBy: sort,
        user: req.session.user || null,
        formatDate: (date) => {
          // 这里可以添加日期格式化函数
          if (!date) return "";
          const d = new Date(date);
          return `${d.getFullYear()}-${(d.getMonth() + 1)
            .toString()
            .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
        },
      });
    });
  });
});

// 创建新日记的路由（对应发布按钮）
app.get("/diaries/new", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  res.render("diary-edit", {
    user: req.session.user,
    diary: null,
    isEdit: false,
  });
});

// 获取日记详情
app.get("/diary-detail/:id", (req, res) => {
  const diaryId = req.params.id;

  // 获取日记基本信息
  db.query(
    `
    SELECT d.*, u.username, u.avatar 
    FROM travel_diaries d
    JOIN user_information u ON d.user_id = u.id
    WHERE d.id = ?
  `,
    [diaryId],
    (err, diaryResults) => {
      if (err) {
        console.error(err);
        return res.status(500).render("error", { error: "Database error" });
      }

      if (!diaryResults[0]) {
        return res.status(404).render("error", { error: "Diary not found" });
      }

      const diary = diaryResults[0];

      // 获取媒体内容
      db.query(
        `
      SELECT * FROM diary_media
      WHERE diary_id = ?
      ORDER BY display_order
    `,
        [diaryId],
        (err, mediaResults) => {
          if (err) {
            console.error(err);
            return res.status(500).render("error", { error: "Database error" });
          }

          // 获取日记章节
          db.query(
            `
        SELECT * FROM diary_sections
        WHERE diary_id = ?
        ORDER BY section_order
      `,
            [diaryId],
            (err, sectionResults) => {
              if (err) {
                console.error(err);
                return res
                  .status(500)
                  .render("error", { error: "Database error" });
              }

              // 获取评论
              db.query(
                `
          SELECT c.*, u.username, u.avatar
          FROM comments c
          JOIN user_information u ON c.comment_user_id = u.id
          WHERE c.diary_id = ?
          ORDER BY c.created_at DESC
        `,
                [diaryId],
                (err, commentResults) => {
                  if (err) {
                    console.error(err);
                    return res
                      .status(500)
                      .render("error", { error: "Database error" });
                  }

                  // 更新浏览量
                  db.query(
                    `
            UPDATE travel_diaries 
            SET view_count = view_count + 1 
            WHERE id = ?
          `,
                    [diaryId],
                    (err) => {
                      if (err) console.error(err);

                      console.log("req.session.user ", req.session.user);
                      if (req.session.user) {
                        res.render("diary-detail", {
                          diary: diary,
                          media: mediaResults,
                          sections: sectionResults,
                          comments: commentResults,
                          user: req.session.user,
                        });
                      } else {
                        res.render("diary-detail", {
                          diary: diary,
                          media: mediaResults,
                          sections: sectionResults,
                          comments: commentResults,
                          user: 0,
                        });
                      }
                      // 渲染 EJS 模板并传递数据
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

// 添加评论
app.post("/api/diaries/:id/comments", (req, res) => {
  const { content } = req.body;
  console.log("content", req.body);
  const diaryId = req.params.id;
  console.log("diaryID", req.params.id);
  const userId = req.session.user.id;

  console.log("userID", req.session.user.id);
  db.query(
    `
    INSERT INTO comments (diary_id, comment_user_id, content)
    VALUES (?, ?, ?)
  `,
    [diaryId, userId, content],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      // 更新日记评论数
      db.query(
        `
      UPDATE travel_diaries 
      SET comment_count = comment_count + 1 
      WHERE id = ?
    `,
        [diaryId],
        (err) => {
          if (err) {
            console.error(err);
            // 即使评论数更新失败，仍然返回成功
          }

          res.status(201).json({ message: "Comment added" });
        }
      );
    }
  );
});

// 点赞日记
app.post("/api/diaries/:id/like", (req, res) => {
  const diaryId = req.params.id;

  db.query(
    `
    UPDATE travel_diaries 
    SET like_count = like_count + 1 
    WHERE id = ?
  `,
    [diaryId],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      res.json({ message: "Liked" });
    }
  );
});

// 主页路由
app.get("/", (req, res) => {
  console.log("try to load in index");
  console.log("当前会话用户:", req.session.user);

  // 使用连接池查询，通过回调处理结果
  db.query(
    `
    SELECT d.*, u.username, u.email, u.avatar
    FROM travel_diaries d
    JOIN user_information u ON d.user_id = u.id
    -- ORDER BY d.id DESC
    LIMIT 6
  `,
    (error, results) => {
      if (error) {
        console.error("Error fetching diaries:", error);
        return res.status(500).render("error", {
          message: "服务器错误，请稍后再试",
          error: process.env.NODE_ENV === "development" ? error : null,
        });
      }

      // console.log("Fetched diaries:", results);

      // 格式化数据
      const formattedDiaries = results.map((diary) => ({
        ...diary,
        like_count:
          diary.like_count >= 1000
            ? `${(diary.like_count / 1000).toFixed(1)}k`
            : diary.like_count,
        comment_count:
          diary.comment_count >= 1000
            ? `${(diary.comment_count / 1000).toFixed(1)}k`
            : diary.comment_count,
        badge:
          diary.like_count > 1000
            ? "🔥 热门"
            : diary.like_count > 500
            ? "🌟 精选"
            : "🆕 最新",
      }));

      if (req.session.user) {
        db.query(
          "SELECT avatar FROM user_information WHERE id = ?",
          [req.session.user.id],
          (userError, userResults) => {
            const userWithAvatar = {
              ...req.session.user,
              avatar: userResults[0]?.avatar || null,
            };
            console.log("当前会话用户:", userWithAvatar);
            res.render("index", {
              diaries: formattedDiaries,
              user: userWithAvatar,
            });
          }
        );
      } else {
        res.render("index", {
          diaries: formattedDiaries,
          user: null,
        });
      }

      //res.render('index', { diaries: formattedDiaries });
    }
  );
});

// 启动服务器
app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
