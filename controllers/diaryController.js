const db = require('../config/test-database');
const upload = require('../config/multerConfig');

const diaryController = {

  // 日记提交


  // 获取日记发现页
  getDiaryDiscovery: (req, res) => {
    const { page = 1, q: searchQuery = '', category = '全部主题', sort = 'hot' } = req.query;
    const userId = req.session.user ? req.session.user.id : null;
    const limit = 12;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];

    if (searchQuery) {
      whereClause += ' AND (d.title LIKE ? OR d.content LIKE ? OR u.username LIKE ?)';
      const queryParam = `%${searchQuery}%`;
      params.push(queryParam, queryParam, queryParam);
    }

    if (category !== '全部主题') {
      whereClause += ' AND d.categories LIKE ?';
      params.push(`%${category}%`);
    }

    let orderBy = '';
    switch (sort) {
      case 'hot':
        orderBy = 'ORDER BY d.like_count DESC, d.view_count DESC, d.created_at DESC';
        break;
      case 'newest':
        orderBy = 'ORDER BY d.created_at DESC';
        break;
      case 'featured':
        orderBy = 'ORDER BY d.view_count DESC, d.created_at DESC';
        break;
      default:
        orderBy = 'ORDER BY d.like_count DESC, d.view_count DESC, d.created_at DESC';
    }

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM travel_diaries d
      JOIN user_information u ON d.user_id = u.id
      ${whereClause}
    `;

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

    db.query(countQuery, params, (err, countResults) => {
      if (err) {
        console.error(err);
        return res.status(500).render('error', { error: '数据库查询错误' });
      }

      const total = countResults[0].total;
      const totalPages = Math.ceil(total / limit);

      const diariesParams = [...params, userId || null, limit, offset];

      db.query(diariesQuery, diariesParams, (err, diaryResults) => {
        if (err) {
          console.error(err);
          return res.status(500).render('error', { error: '数据库查询错误' });
        }

        const diariesWithTags = diaryResults.map(diary => {
          const tags = [];
          if (diary.tag_names && diary.tag_icons) {
            const tagNames = diary.tag_names.split(',');
            const tagIcons = diary.tag_icons.split(',');

            for (let i = 0; i < tagNames.length; i++) {
              tags.push({
                name: tagNames[i],
                icon: tagIcons[i]
              });
            }
          }

          return {
            ...diary,
            tags: tags,
            cover_image: diary.cover_image || null,
            is_featured: diary.is_featured || false
          };
        });

        res.render('diary-discovery', {
          diaries: diariesWithTags,
          currentPage: parseInt(page),
          totalPages,
          searchQuery,
          currentCategory: category,
          sortBy: sort,
          user: req.session.user || null,
          formatDate: (date) => {
            if (!date) return '';
            const d = new Date(date);
            return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
          }
        });
      });
    });
  },

  // 创建新日记页面
  getNewDiary: (req, res) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    res.render('diary-edit', {
      user: req.session.user,
      diary: null,
      isEdit: false
    });
  },

  // 获取日记详情
  getDiaryDetail: (req, res) => {
    const diaryId = req.params.id;

    db.query(`
      SELECT d.*, u.username, u.avatar 
      FROM travel_diaries d
      JOIN user_information u ON d.user_id = u.id
      WHERE d.id = ?
    `, [diaryId], (err, diaryResults) => {
      if (err) {
        console.error(err);
        return res.status(500).render('error', { error: 'Database error' });
      }

      if (!diaryResults[0]) {
        return res.status(404).render('error', { error: 'Diary not found' });
      }

      const diary = diaryResults[0];

      db.query(`
        SELECT * FROM diary_media
        WHERE diary_id = ?
        ORDER BY display_order
      `, [diaryId], (err, mediaResults) => {
        if (err) {
          console.error(err);
          return res.status(500).render('error', { error: 'Database error' });
        }

        db.query(`
          SELECT * FROM diary_sections
          WHERE diary_id = ?
          ORDER BY section_order
        `, [diaryId], (err, sectionResults) => {
          if (err) {
            console.error(err);
            return res.status(500).render('error', { error: 'Database error' });
          }

          db.query(`
            SELECT c.*, u.username, u.avatar
            FROM comments c
            JOIN user_information u ON c.comment_user_id = u.id
            WHERE c.diary_id = ?
            ORDER BY c.created_at DESC
          `, [diaryId], (err, commentResults) => {
            if (err) {
              console.error(err);
              return res.status(500).render('error', { error: 'Database error' });
            }

            db.query(`
              UPDATE travel_diaries 
              SET view_count = view_count + 1 
              WHERE id = ?
            `, [diaryId], (err) => {
              if (err) console.error(err);

              res.render('diary-detail', {
                diary: diary,
                media: mediaResults,
                sections: sectionResults,
                comments: commentResults,
                user: req.session.user || 0
              });
            });
          });
        });
      });
    });
  },

  // 添加评论
  addComment: (req, res) => {
    const { content } = req.body;
    const diaryId = req.params.id;
    const userId = req.session.user.id;

    db.query(`
      INSERT INTO comments (diary_id, comment_user_id, content)
      VALUES (?, ?, ?)
    `, [diaryId, userId, content], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }

      db.query(`
        UPDATE travel_diaries 
        SET comment_count = comment_count + 1 
        WHERE id = ?
      `, [diaryId], (err) => {
        if (err) {
          console.error(err);
        }
        res.status(201).json({ message: 'Comment added' });
      });
    });
  },

  // 点赞日记
  likeDiary: (req, res) => {
    const diaryId = req.params.id;

    db.query(`
      UPDATE travel_diaries 
      SET like_count = like_count + 1 
      WHERE id = ?
    `, [diaryId], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ message: 'Liked' });
    });
  },

  // 提交新日记
  createDiary: (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: '未登录' });
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
      mediaItems
    } = req.body;

    const userId = req.session.user.id;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '标题和内容不能为空'
      });
    }

    db.beginTransaction((beginErr) => {
      if (beginErr) {
        console.error('事务开始错误:', beginErr);
        return res.status(500).json({
          success: false,
          message: '数据库错误'
        });
      }

      let coverImagePath = null;
      if (req.files['coverImage']?.[0]) {
        coverImagePath = '/uploads/' + req.files['coverImage'][0].filename;
      }

      db.query(
        `INSERT INTO travel_diaries 
              (user_id, title, content, like_count, comment_count, status, cover_image, categories) 
              VALUES (?, ?, ?, 0, 0, ?, ?, ?)`,
        [userId, title, content, status || 1, coverImagePath, tags || ''],
        (diaryErr, diaryResult) => {
          if (diaryErr) {
            return db.rollback(() => {
              console.error('日记插入错误:', diaryErr);
              res.status(500).json({
                success: false,
                message: '数据库错误'
              });
            });
          }

          const diaryId = diaryResult.insertId;
          let completedOperations = 0;
          const totalOperations = (sections ? 1 : 0) + (mediaItems ? 1 : 0);

          if (totalOperations === 0) {
            return db.commit((commitErr) => {
              if (commitErr) {
                return db.rollback(() => {
                  console.error('事务提交错误:', commitErr);
                  res.status(500).json({
                    success: false,
                    message: '数据库错误'
                  });
                });
              }
              res.json({
                success: true,
                diaryId: diaryId,
                message: status === '2' ? '日记发布成功' : '草稿保存成功'
              });
            });
          }

          // 处理分段数据
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
                    [diaryId, section.dayNumber, section.title, section.content, section.order],
                    (sectionErr) => {
                      if (sectionErr) {
                        return db.rollback(() => {
                          console.error('分段插入错误:', sectionErr);
                          res.status(500).json({
                            success: false,
                            message: '数据库错误'
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
                console.error('分段数据解析错误:', parseErr);
                res.status(400).json({
                  success: false,
                  message: '分段数据格式错误'
                });
              });
            }
          }

          // 处理媒体数据
          if (mediaItems) {
            try {
              const parsedMedia = JSON.parse(mediaItems);
              const mediaFiles = req.files['mediaFiles'] || [];
              let mediaProcessed = 0;

              if (parsedMedia.length === 0) {
                completedOperations++;
                checkAllDone();
              } else {
                parsedMedia.forEach((media, index) => {
                  let mediaUrl = media.url;

                  if (mediaFiles[index]) {
                    mediaUrl = '/uploads/' + mediaFiles[index].filename;
                  }

                  db.query(
                    `INSERT INTO diary_media 
                                      (diary_id, media_url, media_type, caption, display_order) 
                                      VALUES (?, ?, ?, ?, ?)`,
                    [diaryId, mediaUrl, media.type, media.caption, media.order],
                    (mediaErr) => {
                      if (mediaErr) {
                        return db.rollback(() => {
                          console.error('媒体插入错误:', mediaErr);
                          res.status(500).json({
                            success: false,
                            message: '数据库错误'
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
                console.error('媒体数据解析错误:', parseErr);
                res.status(400).json({
                  success: false,
                  message: '媒体数据格式错误'
                });
              });
            }
          }

          function checkAllDone() {
            if (completedOperations === totalOperations) {
              db.commit((commitErr) => {
                if (commitErr) {
                  return db.rollback(() => {
                    console.error('事务提交错误:', commitErr);
                    res.status(500).json({
                      success: false,
                      message: '数据库错误'
                    });
                  });
                }
                res.json({
                  success: true,
                  diaryId: diaryId,
                  message: status === '2' ? '日记发布成功' : '草稿保存成功'
                });
              });
            }
          }
        }
      );
    });
  },

  // 编辑日记
  updateDiary: (req, res) => {
    const diaryId = req.params.id;
    const {
      title,
      dayTitles = [],
      sectionTitles = [],
      sectionContents = [],
      tips,
      content
    } = req.body;

    db.query(
      'UPDATE travel_diaries SET title = ?, content = ? WHERE id = ?',
      [title, content, diaryId],
      (err, results) => {
        if (err) {
          console.error('更新日记基本信息错误:', err);
          return res.status(500).json({ success: false, message: '服务器错误' });
        }

        let completedDayUpdates = 0;
        if (dayTitles.length === 0) {
          updateSections();
        } else {
          dayTitles.forEach((dayTitle, i) => {
            db.query(
              'UPDATE diary_sections SET section_title = ? WHERE diary_id = ? AND day_number = ?',
              [dayTitle, diaryId, i + 1],
              (err, results) => {
                if (err) {
                  console.error('更新每日章节错误:', err);
                  return res.status(500).json({ success: false, message: '服务器错误' });
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
          let completedSectionUpdates = 0;
          if (sectionTitles.length === 0) {
            return res.json({ success: true });
          }

          sectionTitles.forEach((sectionTitle, i) => {
            db.query(
              'UPDATE diary_sections SET section_title = ?, section_content = ? WHERE diary_id = ? AND id = ?',
              [sectionTitle, sectionContents[i], diaryId, i + 1],
              (err, results) => {
                if (err) {
                  console.error('更新章节内容错误:', err);
                  return res.status(500).json({ success: false, message: '服务器错误' });
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
  }

};

module.exports = diaryController;