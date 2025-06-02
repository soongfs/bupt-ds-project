const db = require('../config/test-database');
const upload = require('../config/multerConfig');
const searchService = require('../services/searchService');
const compressionService = require('../services/compressionService');

const diaryController = {
  getDiaryDiscovery: (req, res) => {
    try {
      const { page = 1, q: searchQuery = '', category = '全部主题', sort = 'hot' } = req.query;
      const userId = req.session.user ? req.session.user.id : null;

      searchService.searchDiaries(searchQuery, userId, {
        page: parseInt(page),
        category,
        sort
      }, (err, searchResults) => {
        if (err) {
          console.error('搜索日记失败:', err);
          return res.status(500).render('error', { error: '搜索失败，请稍后重试' });
        }

        const diariesWithTags = searchResults.diaries.map(diary => {
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
          totalPages: searchResults.totalPages,
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
    } catch (error) {
      console.error('处理请求失败:', error);
      res.status(500).render('error', { error: '服务器错误，请稍后重试' });
    }
  },

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

  getDiaryDetail: (req, res) => {
    const diaryId = req.params.id;
    const userId = req.session.user ? req.session.user.id : null;

    // 获取日记基本信息
    db.query(`
      SELECT 
        d.*, 
        u.username, 
        u.avatar,
        COALESCE(r.rating, 0) as user_rating,
        CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END as user_favorited,
        CASE WHEN l.user_id IS NOT NULL THEN 1 ELSE 0 END as user_liked
      FROM travel_diaries d
      JOIN user_information u ON d.user_id = u.id
      LEFT JOIN diary_ratings r ON d.id = r.diary_id AND r.user_id = ?
      LEFT JOIN diary_favorites f ON d.id = f.diary_id AND f.user_id = ?
      LEFT JOIN diary_likes l ON d.id = l.diary_id AND l.user_id = ?
      WHERE d.id = ?
    `, [userId, userId, userId, diaryId], (err, diaryResults) => {
      if (err) {
        console.error('获取日记基本信息失败:', err);
        return res.status(500).render('error', { message: '服务器错误' });
      }

      if (!diaryResults[0]) {
        return res.status(404).render('error', { message: '未找到该日记' });
      }

      const diary = diaryResults[0];

      // 解压日记内容
      if (diary.is_compressed) {
        compressionService.decompressDiary(diary, (err, decompressedDiary) => {
          if (err) {
            console.error('解压日记内容失败:', err);
            return res.status(500).render('error', { message: '服务器错误' });
          }
          diary.content = decompressedDiary.content;
          continueWithSections();
        });
      } else {
        continueWithSections();
      }

      // 获取章节内容
      function continueWithSections() {
        db.query(
          'SELECT * FROM diary_sections WHERE diary_id = ? ORDER BY section_order',
          [diaryId],
          (err, sections) => {
            if (err) {
              console.error('获取章节内容失败:', err);
              return res.status(500).render('error', { message: '服务器错误' });
            }

            // 解压章节内容
            let sectionsProcessed = 0;
            if (sections.length === 0) {
              continueWithMedia();
            } else {
              sections.forEach((section, index) => {
                if (section.is_compressed) {
                  compressionService.decompressText(section.section_content, (err, decompressedContent) => {
                    if (err) {
                      console.error('解压章节内容失败:', err);
                      return res.status(500).render('error', { message: '服务器错误' });
                    }
                    sections[index].section_content = decompressedContent;
                    sectionsProcessed++;
                    if (sectionsProcessed === sections.length) {
                      continueWithMedia();
                    }
                  });
                } else {
                  sectionsProcessed++;
                  if (sectionsProcessed === sections.length) {
                    continueWithMedia();
                  }
                }
              });
            }

            // 获取媒体文件
            function continueWithMedia() {
              db.query(`
                SELECT * FROM diary_media
                WHERE diary_id = ?
                ORDER BY display_order
              `, [diaryId], (err, mediaResults) => {
                if (err) {
                  console.error('查询媒体文件失败:', err);
                  return res.status(500).render('error', { message: '获取媒体文件失败' });
                }

                // 处理媒体文件的URL
                const processedMedia = mediaResults.map(item => ({
                  ...item,
                  media_url: item.media_url.startsWith('/') ? item.media_url : '/uploads/' + item.media_url
                }));

                // 获取评论
                db.query(`
                  SELECT c.*, u.username, u.avatar
                  FROM comments c
                  JOIN user_information u ON c.comment_user_id = u.id
                  WHERE c.diary_id = ?
                  ORDER BY c.created_at DESC
                `, [diaryId], (err, commentResults) => {
                  if (err) {
                    console.error('查询评论失败:', err);
                    return res.status(500).render('error', { message: '获取评论失败' });
                  }

                  // 更新浏览次数并记录浏览历史
                  db.query(`
                    UPDATE travel_diaries 
                    SET view_count = view_count + 1 
                    WHERE id = ?
                  `, [diaryId], (err) => {
                    if (err) {
                      console.error('更新浏览次数失败:', err);
                    }

                    // 记录用户浏览历史
                    if (userId) {
                      db.query(`
                        INSERT INTO diary_views (diary_id, user_id)
                        VALUES (?, ?)
                        ON DUPLICATE KEY UPDATE viewed_at = CURRENT_TIMESTAMP
                      `, [diaryId, userId], (err) => {
                        if (err) {
                          console.error('记录浏览历史失败:', err);
                        }
                      });
                    }

                    res.render('diary-detail', {
                      diary,
                      sections,
                      media: processedMedia,
                      comments: commentResults,
                      user: req.session.user || null
                    });
                  });
                });
              });
            }
          }
        );
      }
    });
  },

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

  createDiary: (req, res) => {
    const { title, content, sections } = req.body;
    const userId = req.session.user.id;

    // 压缩日记内容
    compressionService.compressDiary({
      content,
      sections: JSON.parse(sections || '[]')
    }, (err, compressedDiary) => {
      if (err) {
        console.error('压缩日记内容失败:', err);
        return res.status(500).json({ success: false, message: '内容压缩失败' });
      }

      // 开始数据库事务
      db.beginTransaction((err) => {
        if (err) {
          console.error('事务开始失败:', err);
          return res.status(500).json({ success: false, message: '数据库错误' });
        }

        // 插入主日记内容
        db.query(
          `INSERT INTO travel_diaries 
           (user_id, title, content, search_content, is_compressed, created_at) 
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [userId, title, compressedDiary.content, compressedDiary.search_content, true],
          (err, result) => {
            if (err) {
              return db.rollback(() => {
                console.error('插入日记失败:', err);
                res.status(500).json({ success: false, message: '数据库错误' });
              });
            }

            const diaryId = result.insertId;

            // 如果没有章节，直接提交事务
            if (!compressedDiary.sections || !compressedDiary.sections.length) {
              return db.commit((err) => {
                if (err) {
                  return db.rollback(() => {
                    console.error('提交事务失败:', err);
                    res.status(500).json({ success: false, message: '数据库错误' });
                  });
                }
                res.json({ success: true, diaryId });
              });
            }

            // 插入章节内容
            let insertedSections = 0;
            compressedDiary.sections.forEach((section) => {
              db.query(
                `INSERT INTO diary_sections 
                 (diary_id, section_title, section_content, day_number, section_order, is_compressed) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [diaryId, section.title, section.content, section.dayNumber, section.order, true],
                (err) => {
                  if (err) {
                    return db.rollback(() => {
                      console.error('插入章节失败:', err);
                      res.status(500).json({ success: false, message: '数据库错误' });
                    });
                  }

                  insertedSections++;
                  if (insertedSections === compressedDiary.sections.length) {
                    // 所有章节插入完成，提交事务
                    db.commit((err) => {
                      if (err) {
                        return db.rollback(() => {
                          console.error('提交事务失败:', err);
                          res.status(500).json({ success: false, message: '数据库错误' });
                        });
                      }
                      res.json({ success: true, diaryId });
                    });
                  }
                }
              );
            });
          }
        );
      });
    });
  },

  updateDiary: (req, res) => {
    const diaryId = req.params.id;
    const userId = req.session.user.id;
    const { title, content, tips, cover_image, sections, media } = req.body;

    console.log('收到更新请求:', {
      title,
      content,
      tips,
      cover_image,
      sections: JSON.parse(sections || '[]'),
      media: JSON.parse(media || '[]'),
      files: req.files
    });

    // 首先检查用户是否有权限编辑这篇日记
    db.query(
      'SELECT user_id FROM travel_diaries WHERE id = ?',
      [diaryId],
      (err, results) => {
        if (err) {
          console.error('查询日记失败:', err);
          return res.status(500).json({
            success: false,
            message: '服务器错误'
          });
        }

        if (!results.length || results[0].user_id !== userId) {
          return res.status(403).json({
            success: false,
            message: '你没有权限编辑这篇日记'
          });
        }

        // 开始事务
        db.beginTransaction((beginErr) => {
          if (beginErr) {
            console.error('事务开始错误:', beginErr);
            return res.status(500).json({
              success: false,
              message: '数据库错误'
            });
          }

          // 更新日记基本信息
          let coverImagePath = cover_image;
          if (req.files && req.files['coverImage'] && req.files['coverImage'][0]) {
            coverImagePath = req.files['coverImage'][0].filename;
          }

          db.query(
            `UPDATE travel_diaries 
             SET title = ?, 
                 content = ?, 
                 search_content = ?,
                 tips = ?,
                 cover_image = ?,
                 is_compressed = ?,
                 updated_at = NOW()
             WHERE id = ? AND user_id = ?`,
            [title, compressedDiary.content, compressedDiary.search_content, tips, coverImagePath, true, diaryId, userId],
            (err) => {
              if (err) {
                return db.rollback(() => {
                  console.error('更新日记基本信息失败:', err);
                  res.status(500).json({
                    success: false,
                    message: '数据库错误'
                  });
                });
              }

              // 更新章节数据
              if (sections) {
                const parsedSections = JSON.parse(sections);
                
                // 删除旧的章节
                db.query(
                  'DELETE FROM diary_sections WHERE diary_id = ?',
                  [diaryId],
                  (err) => {
                    if (err) {
                      return db.rollback(() => {
                        console.error('删除旧章节失败:', err);
                        res.status(500).json({
                          success: false,
                          message: '数据库错误'
                        });
                      });
                    }

                    // 插入新的章节
                    let sectionsProcessed = 0;
                    
                    if (parsedSections.length === 0) {
                      handleMediaUpdate();
                    } else {
                      parsedSections.forEach((section) => {
                        db.query(
                          `INSERT INTO diary_sections 
                           (diary_id, section_title, section_content, day_number, section_order) 
                           VALUES (?, ?, ?, ?, ?)`,
                          [diaryId, section.title, section.content, section.dayNumber, section.order],
                          (err) => {
                            if (err) {
                              return db.rollback(() => {
                                console.error('插入新章节失败:', err);
                                res.status(500).json({
                                  success: false,
                                  message: '数据库错误'
                                });
                              });
                            }

                            sectionsProcessed++;
                            if (sectionsProcessed === parsedSections.length) {
                              handleMediaUpdate();
                            }
                          }
                        );
                      });
                    }
                  }
                );
              } else {
                handleMediaUpdate();
              }

              // 处理媒体文件更新
              function handleMediaUpdate() {
                if (!media) {
                  return finishTransaction();
                }

                const parsedMedia = JSON.parse(media);
                const mediaFiles = req.files && req.files['mediaFiles'] ? req.files['mediaFiles'] : [];

                // 获取现有的媒体文件
                db.query(
                  'SELECT id, media_url FROM diary_media WHERE diary_id = ?',
                  [diaryId],
                  (err, existingMedia) => {
                    if (err) {
                      return db.rollback(() => {
                        console.error('获取现有媒体文件失败:', err);
                        res.status(500).json({
                          success: false,
                          message: '数据库错误'
                        });
                      });
                    }

                    // 找出要删除的媒体文件
                    const newMediaUrls = parsedMedia.map(m => m.url.split('/').pop());
                    const mediaToDelete = existingMedia.filter(m => {
                      // 检查文件是否在新的媒体列表中（考虑完整URL和文件名两种情况）
                      const fileName = m.media_url.split('/').pop();
                      return !newMediaUrls.includes(fileName) && !parsedMedia.some(p => p.url.includes(fileName));
                    });

                    // 删除不再使用的媒体文件（包括物理文件）
                    if (mediaToDelete.length > 0) {
                      const fs = require('fs');
                      const path = require('path');
                      const uploadDir = path.join(__dirname, '..', 'uploads');

                      // 先删除物理文件
                      mediaToDelete.forEach(media => {
                        const filePath = path.join(uploadDir, media.media_url);
                        if (fs.existsSync(filePath)) {
                          fs.unlinkSync(filePath);
                          console.log('已删除文件:', filePath);
                        }
                      });

                      // 然后删除数据库记录
                      db.query(
                        'DELETE FROM diary_media WHERE id IN (?)',
                        [mediaToDelete.map(m => m.id)],
                        (err) => {
                          if (err) {
                            return db.rollback(() => {
                              console.error('删除旧媒体文件失败:', err);
                              res.status(500).json({
                                success: false,
                                message: '数据库错误'
                              });
                            });
                          }
                          processNewMedia();
                        }
                      );
                    } else {
                      processNewMedia();
                    }

                    // 处理新的媒体文件
                    function processNewMedia() {
                      let mediaProcessed = 0;
                      const mediaPromises = [];
                      
                      if (parsedMedia.length === 0) {
                        finishTransaction();
                      } else {
                        parsedMedia.forEach((item) => {
                          const promise = new Promise((resolve, reject) => {
                            if (item.id.startsWith('new_')) {
                              // 新增的媒体
                              let mediaUrl = item.url;
                              
                              // 如果是新上传的文件，使用新的文件名
                              const matchingFile = mediaFiles.find(f => f.originalname === item.url);
                              if (matchingFile) {
                                mediaUrl = matchingFile.filename;
                              }

                              db.query(
                                `INSERT INTO diary_media 
                                 (diary_id, media_url, media_type, caption, display_order) 
                                 VALUES (?, ?, ?, ?, ?)`,
                                [diaryId, mediaUrl, item.type, item.caption, item.order],
                                (err) => {
                                  if (err) {
                                    reject(err);
                                  } else {
                                    resolve();
                                  }
                                }
                              );
                            } else {
                              // 更新现有媒体
                              db.query(
                                `UPDATE diary_media 
                                 SET caption = ?, 
                                     display_order = ? 
                                 WHERE id = ? AND diary_id = ?`,
                                [item.caption, item.order, item.id, diaryId],
                                (err) => {
                                  if (err) {
                                    reject(err);
                                  } else {
                                    resolve();
                                  }
                                }
                              );
                            }
                          });
                          mediaPromises.push(promise);
                        });

                        // 等待所有媒体文件处理完成
                        Promise.all(mediaPromises)
                          .then(() => {
                            finishTransaction();
                          })
                          .catch((err) => {
                            return db.rollback(() => {
                              console.error('处理媒体文件失败:', err);
                              res.status(500).json({
                                success: false,
                                message: '数据库错误'
                              });
                            });
                          });
                      }
                    }
                  }
                );
              }

              // 完成事务
              function finishTransaction() {
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

                  console.log('更新成功');
                  res.json({
                    success: true,
                    message: '日记更新成功'
                  });
                });
              }
            }
          );
        });
      }
    );
  },

  rateDiary: (req, res) => {
    const diaryId = req.params.id;
    const userId = req.session.user.id;
    const { rating } = req.body;

    // 验证评分值
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: '评分必须在1-5之间' });
    }

    // 首先检查是否已经评分过
    db.query(
      'SELECT * FROM diary_ratings WHERE diary_id = ? AND user_id = ?',
      [diaryId, userId],
      (err, results) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: '数据库错误' });
        }

        const isUpdate = results.length > 0;
        const query = isUpdate
          ? 'UPDATE diary_ratings SET rating = ?, updated_at = NOW() WHERE diary_id = ? AND user_id = ?'
          : 'INSERT INTO diary_ratings (diary_id, user_id, rating, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())';
        
        const params = isUpdate
          ? [rating, diaryId, userId]
          : [diaryId, userId, rating];

        db.query(query, params, (err) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: '数据库错误' });
          }

          // 更新日记的平均评分和评分数量
          db.query(
            `SELECT 
              COUNT(*) as count,
              AVG(rating) as avg_rating 
            FROM diary_ratings 
            WHERE diary_id = ?`,
            [diaryId],
            (err, results) => {
              if (err) {
                console.error(err);
                return res.status(500).json({ error: '数据库错误' });
              }

              const { count, avg_rating } = results[0];

              db.query(
                'UPDATE travel_diaries SET rating = ?, rating_count = ? WHERE id = ?',
                [avg_rating || 0, count, diaryId],
                (err) => {
                  if (err) {
                    console.error(err);
                    return res.status(500).json({ error: '数据库错误' });
                  }

                  res.json({ 
                    message: isUpdate ? '评分更新成功' : '评分成功',
                    rating: rating,
                    avgRating: avg_rating || 0,
                    ratingCount: count
                  });
                }
              );
            }
          );
        });
      }
    );
  },

  favoriteDiary: (req, res) => {
    const diaryId = req.params.id;
    const userId = req.session.user.id;

    // 检查是否已经收藏
    db.query(
      'SELECT * FROM diary_favorites WHERE diary_id = ? AND user_id = ?',
      [diaryId, userId],
      (err, results) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: '数据库错误' });
        }

        if (results.length > 0) {
          // 如果已收藏，则取消收藏
          db.query(
            'DELETE FROM diary_favorites WHERE diary_id = ? AND user_id = ?',
            [diaryId, userId],
            (err) => {
              if (err) {
                console.error(err);
                return res.status(500).json({ error: '数据库错误' });
              }

              // 更新日记的收藏数
              db.query(
                'UPDATE travel_diaries SET favorite_count = favorite_count - 1 WHERE id = ?',
                [diaryId],
                (err) => {
                  if (err) {
                    console.error(err);
                    return res.status(500).json({ error: '数据库错误' });
                  }

                  res.json({ message: '取消收藏成功' });
                }
              );
            }
          );
        } else {
          // 如果未收藏，则添加收藏
          db.query(
            'INSERT INTO diary_favorites (diary_id, user_id, created_at) VALUES (?, ?, NOW())',
            [diaryId, userId],
            (err) => {
              if (err) {
                console.error(err);
                return res.status(500).json({ error: '数据库错误' });
              }

              // 更新日记的收藏数
              db.query(
                'UPDATE travel_diaries SET favorite_count = favorite_count + 1 WHERE id = ?',
                [diaryId],
                (err) => {
                  if (err) {
                    console.error(err);
                    return res.status(500).json({ error: '数据库错误' });
                  }

                  res.json({ message: '收藏成功' });
                }
              );
            }
          );
        }
      }
    );
  },

  getShareLink: (req, res) => {
    const diaryId = req.params.id;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const shareUrl = `${baseUrl}/diary-detail/${diaryId}`;
    
    res.json({ 
      url: shareUrl,
      title: '分享成功',
      message: '链接已生成'
    });
  }
};

// 在发送到模板前处理日记内容
function prepareContentForDisplay(diary) {
  if (!diary) return diary;

  // 创建一个新对象，避免修改原始数据
  const processed = { ...diary };

  // 处理内容
  if (processed.content) {
    if (Buffer.isBuffer(processed.content)) {
      processed.content = processed.content.toString();
    } else if (typeof processed.content !== 'string') {
      processed.content = String(processed.content);
    }

    // 生成摘要
    if (!processed.excerpt) {
      const cleanContent = processed.content
        .replace(/<[^>]*>/g, ' ')  // 移除 HTML 标签
        .replace(/\s+/g, ' ')      // 规范化空白字符
        .trim();
      processed.excerpt = cleanContent.length > 100 ? 
        cleanContent.substring(0, 100) + '...' : 
        cleanContent;
    }
  } else {
    processed.content = '';
    processed.excerpt = '暂无内容预览';
  }

  return processed;
}

// 修改获取日记列表的函数
exports.getDiaries = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const userId = req.query.userId;
  const category = req.query.category;
  const sort = req.query.sort || 'latest';

  let query = `
    SELECT 
      d.*,
      u.username,
      u.avatar,
      COUNT(DISTINCT dl.id) as like_count,
      COUNT(DISTINCT c.id) as comment_count,
      AVG(dr.rating) as rating
    FROM travel_diaries d
    JOIN user_information u ON d.user_id = u.id
    LEFT JOIN diary_likes dl ON d.id = dl.diary_id
    LEFT JOIN comments c ON d.id = c.diary_id
    LEFT JOIN diary_ratings dr ON d.id = dr.diary_id
  `;

  const params = [];
  let whereClause = ' WHERE 1=1';

  if (userId) {
    whereClause += ' AND d.user_id = ?';
    params.push(userId);
  }

  if (category && category !== '全部主题') {
    whereClause += ' AND d.categories LIKE ?';
    params.push(`%${category}%`);
  }

  query += whereClause + ' GROUP BY d.id';

  // 添加排序
  switch (sort) {
    case 'hot':
      query += ' ORDER BY (like_count * 0.4 + comment_count * 0.3 + COALESCE(rating, 0) * 0.3) DESC';
      break;
    case 'rating':
      query += ' ORDER BY rating DESC';
      break;
    case 'latest':
    default:
      query += ' ORDER BY d.created_at DESC';
  }

  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  // 获取总数的查询
  const countQuery = `
    SELECT COUNT(DISTINCT d.id) as total 
    FROM travel_diaries d 
    ${whereClause}
  `;

  db.query(query, params, (err, diaries) => {
    if (err) {
      console.error('获取日记列表失败:', err);
      return res.status(500).json({ success: false, message: '获取日记列表失败' });
    }

    db.query(countQuery, params.slice(0, -2), (err, countResult) => {
      if (err) {
        console.error('获取日记总数失败:', err);
        return res.status(500).json({ success: false, message: '获取日记总数失败' });
      }

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / limit);

      // 处理每个日记的内容
      const processedDiaries = diaries.map(diary => prepareContentForDisplay(diary));

      res.render('diary-discovery', {
        diaries: processedDiaries,
        currentPage: page,
        totalPages,
        total,
        category: category || '全部主题',
        sort
      });
    });
  });
};

// 修改获取单个日记的函数
exports.getDiary = (req, res) => {
  const diaryId = req.params.id;
  const userId = req.session.user ? req.session.user.id : null;

  const query = `
    SELECT 
      d.*,
      u.username,
      u.avatar,
      COUNT(DISTINCT dl.id) as like_count,
      COUNT(DISTINCT c.id) as comment_count,
      AVG(dr.rating) as rating,
      CASE WHEN dl2.id IS NOT NULL THEN 1 ELSE 0 END as is_liked,
      CASE WHEN df.id IS NOT NULL THEN 1 ELSE 0 END as is_favorited,
      dr2.rating as user_rating
    FROM travel_diaries d
    JOIN user_information u ON d.user_id = u.id
    LEFT JOIN diary_likes dl ON d.id = dl.diary_id
    LEFT JOIN comments c ON d.id = c.diary_id
    LEFT JOIN diary_ratings dr ON d.id = dr.diary_id
    LEFT JOIN diary_likes dl2 ON d.id = dl2.diary_id AND dl2.user_id = ?
    LEFT JOIN diary_favorites df ON d.id = df.diary_id AND df.user_id = ?
    LEFT JOIN diary_ratings dr2 ON d.id = dr2.diary_id AND dr2.user_id = ?
    WHERE d.id = ?
    GROUP BY d.id
  `;

  db.query(query, [userId, userId, userId, diaryId], (err, results) => {
    if (err) {
      console.error('获取日记详情失败:', err);
      return res.status(500).json({ success: false, message: '获取日记详情失败' });
    }

    if (results.length === 0) {
      return res.status(404).render('error', { message: '日记不存在' });
    }

    const diary = prepareContentForDisplay(results[0]);
    
    // 增加浏览次数
    db.query(
      'UPDATE travel_diaries SET view_count = view_count + 1 WHERE id = ?',
      [diaryId]
    );

    // 记录用户浏览历史
    if (userId) {
      db.query(
        'INSERT INTO diary_views (diary_id, user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE viewed_at = CURRENT_TIMESTAMP',
        [diaryId, userId]
      );
    }

    res.render('diary-detail', {
      diary,
      user: req.session.user || null
    });
  });
};

module.exports = diaryController; 