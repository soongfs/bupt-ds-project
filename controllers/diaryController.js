const db = require('../config/test-database');
const upload = require('../config/multerConfig');
const searchService = require('../services/searchService');
const compressionService = require('../services/compressionService');

const diaryController = {
  prepareContentForDisplay: function(diary, callback) {
    if (!diary) return callback(null, null);
    
    const decompressedDiary = { ...diary };
    decompressedDiary.is_actually_decompressed = false; // Default to not successfully decompressed
    
    if (diary.is_compressed && diary.content != null) {
      let contentToDecompress = diary.content;
      let originalContentType = typeof diary.content;
      let isBuffer = Buffer.isBuffer(diary.content);

      // 检查内容是否看起来像HTML/文本（未压缩）
      let contentPreview = '';
      if (typeof diary.content === 'string') {
        contentPreview = diary.content.substring(0, 100);
      } else if (Buffer.isBuffer(diary.content)) {
        contentPreview = diary.content.toString().substring(0, 100);
      }
      
      // 如果内容看起来像HTML标签，可能实际上没有被压缩
      if (contentPreview.includes('<') && contentPreview.includes('>')) {
        console.warn(`Diary ID ${diary.id}: Content marked as compressed but appears to be HTML/text. Using as-is.`);
        decompressedDiary.content = Buffer.isBuffer(diary.content) ? diary.content.toString() : diary.content;
        decompressedDiary.is_actually_decompressed = false; // Mark as not actually compressed
        return callback(null, decompressedDiary);
      }

      if (typeof diary.content === 'string') {
        let isJsonBuffer = false;
        try {
          const parsed = JSON.parse(diary.content);
          if (parsed && parsed.type === 'Buffer' && Array.isArray(parsed.data)) {
            contentToDecompress = Buffer.from(parsed.data);
            isJsonBuffer = true;
            isBuffer = true; // Now it is a buffer
          }
        } catch (e) { /* Not a JSON buffer string */ }

        if (!isJsonBuffer) {
          contentToDecompress = Buffer.from(diary.content); // Try converting simple string to Buffer
          isBuffer = true; // Now it is a buffer
        }
      } else if (!isBuffer) {
        console.warn(`Diary ID ${diary.id}: Content marked compressed but is not Buffer or String. Type: ${originalContentType}. Skipping decompression.`);
        decompressedDiary.content = diary.content;
        return callback(null, decompressedDiary);
      }

      compressionService.decompressText(contentToDecompress, function(err, decompressedContent) {
        if (err) {
          console.error(`解压日记内容失败 (ID: ${diary.id}): ${err.message}. Original type: ${originalContentType}, IsBuffer: ${isBuffer}. Content snippet: ${(diary.content || '').toString().substring(0, 50)}`);
          // 如果解压失败，使用原内容
          if (Buffer.isBuffer(diary.content)) {
            decompressedDiary.content = diary.content.toString();
          } else {
            decompressedDiary.content = diary.content;
          }
          decompressedDiary.is_actually_decompressed = false; // Mark as failed decompression
          return callback(null, decompressedDiary);
        }
        decompressedDiary.content = decompressedContent;
        decompressedDiary.is_actually_decompressed = true; // Successfully decompressed
        callback(null, decompressedDiary);
      });
    } else if (diary.content != null) { // Not compressed or content is null
      decompressedDiary.content = Buffer.isBuffer(diary.content) ? diary.content.toString() : diary.content;
      callback(null, decompressedDiary);
    } else {
      decompressedDiary.content = '';
      callback(null, decompressedDiary);
    }
  },

  getDiaryDiscovery: function(req, res) {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const userId = req.query.userId;
    const category = req.query.category || '全部主题';
    const sort = req.query.sort || 'latest';
    
    // 添加调试日志
    console.log('日记发现页面请求参数:', {
      page, limit, offset, userId, category, sort,
      originalQuery: req.query
    });

    let query = `
      SELECT 
        d.*, u.username, u.avatar,
        (SELECT COUNT(*) FROM diary_likes WHERE diary_id = d.id) as like_count,
        (SELECT COUNT(*) FROM comments WHERE diary_id = d.id) as comment_count,
        (SELECT AVG(rating) FROM diary_ratings WHERE diary_id = d.id) as rating
      FROM travel_diaries d
      JOIN user_information u ON d.user_id = u.id
    `;
    const params = [];
    let whereClauses = [];

    if (userId) {
      whereClauses.push('d.user_id = ?');
      params.push(userId);
    }
    if (category && category !== '全部主题') {
      whereClauses.push('d.categories LIKE ?');
      params.push(`%${category}%`);
      console.log(`添加分类筛选: ${category}`);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }
    
    console.log('最终SQL查询:', query);
    console.log('查询参数:', params);

    let countQuery = `SELECT COUNT(DISTINCT d.id) as total FROM travel_diaries d`;
    const countParamsInitial = []; // Separate params for count query before whereClauses
    if (userId) { countParamsInitial.push(userId); }
    if (category && category !== '全部主题') { countParamsInitial.push(`%${category}%`); }

    if (whereClauses.length > 0) {
      let countWhere = whereClauses.join(' AND ');
      countQuery += ' WHERE ' + countWhere;
    }

    switch (sort) {
      case 'hot':
        query += ' ORDER BY ( (SELECT COUNT(*) FROM diary_likes WHERE diary_id = d.id) * 0.4 + (SELECT COUNT(*) FROM comments WHERE diary_id = d.id) * 0.3 + COALESCE((SELECT AVG(rating) FROM diary_ratings WHERE diary_id = d.id), 0) * 0.3) DESC';
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
    
    const finalCountParams = params.slice(0, params.length - 2); // These are the params for the main query, minus limit/offset

    db.query(query, params, function(err, diaries) {
      if (err) {
        console.error('获取日记列表失败:', err);
        return res.status(500).json({ success: false, message: '获取日记列表失败' });
      }
      db.query(countQuery, finalCountParams, function(err, countResult) {
        if (err) {
          console.error('获取日记总数失败:', err);
          return res.status(500).json({ success: false, message: '获取日记总数失败' });
        }
        const total = countResult[0] ? countResult[0].total : 0;
        const totalPages = Math.ceil(total / limit);
        
        // Process diaries asynchronously since prepareContentForDisplay is now async
        let processedCount = 0;
        const processedDiaries = [];
        
        if (diaries.length === 0) {
          return res.render('diary-discovery', {
            diaries: [],
            currentPage: page,
            totalPages,
            total,
            currentCategory: category,
            sortBy: sort,
            user: req.session.user || null,
            searchQuery: req.query.q || '',
            formatDate: function(date) {
              if (!date) return '';
              const d = new Date(date);
              return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
            }
          });
        }

        diaries.forEach(function(diary, index) {
          diaryController.prepareContentForDisplay(diary, function(err, processedDiary) {
            if (err) {
              console.error('处理日记内容失败:', err);
              processedDiaries[index] = diary; // Use original diary if processing fails
            } else {
              processedDiaries[index] = processedDiary;
            }
            
            processedCount++;
            if (processedCount === diaries.length) {
              res.render('diary-discovery', {
                diaries: processedDiaries,
                currentPage: page,
                totalPages,
                total,
                currentCategory: category,
                sortBy: sort,
                user: req.session.user || null,
                searchQuery: req.query.q || '',
                formatDate: function(date) {
                  if (!date) return '';
                  const d = new Date(date);
                  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
                }
              });
            }
          });
        });
      });
    });
  },

  getNewDiary: function(req, res) {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    res.render('diary-edit', {
      user: req.session.user,
      diary: null,
      isEdit: false
    });
  },

  getDiaryDetail: function(req, res) {
    const diaryId = req.params.id;
    const userId = req.session.user ? req.session.user.id : null;

    const mainQuery = `
      SELECT 
        d.*, u.username, u.avatar,
        (SELECT COUNT(*) FROM diary_likes WHERE diary_id = d.id AND user_id = ?) as user_liked_count,
        (SELECT COUNT(*) FROM diary_favorites WHERE diary_id = d.id AND user_id = ?) as user_favorited_count,
        (SELECT rating FROM diary_ratings WHERE diary_id = d.id AND user_id = ?) as user_specific_rating
      FROM travel_diaries d
      JOIN user_information u ON d.user_id = u.id
      WHERE d.id = ?
    `;
    db.query(mainQuery, [userId, userId, userId, diaryId], function(err, results) {
      if (err) {
        console.error('获取日记详情主信息失败:', err);
        return res.status(500).json({ success: false, message: '获取日记详情失败' });
      }
      if (results.length === 0) {
        return res.status(404).render('error', { message: '日记不存在' });
      }
      
      let diary = results[0];
      diary.is_liked = diary.user_liked_count > 0;
      diary.is_favorited = diary.user_favorited_count > 0;
      diary.user_rating = diary.user_specific_rating;

      // Use async prepareContentForDisplay
      diaryController.prepareContentForDisplay(diary, function(err, processedDiary) {
        if (err) {
          console.error('处理日记主内容失败:', err);
          processedDiary = diary; // Use original if processing fails
        }
        diary = processedDiary;

        db.query('SELECT * FROM diary_sections WHERE diary_id = ? ORDER BY section_order', [diaryId], function(err, sections) {
          if (err) { 
              console.error('获取日记章节失败:', err);
              return res.status(500).render('error', { message: '获取章节信息失败' });
          }
          
          let sectionsProcessed = 0;
          if (sections.length === 0) {
              fetchMediaAndComments(sections); 
          } else {
              sections.forEach(function(section, index) {
                  section.is_actually_decompressed = false; // Default
                  if (section.is_compressed && section.section_content != null) {
                      let sectionContentToDecompress = section.section_content;
                      let sectionOriginalContentType = typeof section.section_content;
                      let sectionIsBuffer = Buffer.isBuffer(section.section_content);

                      // 检查章节内容是否看起来像HTML/文本（未压缩）
                      let sectionContentPreview = '';
                      if (typeof section.section_content === 'string') {
                        sectionContentPreview = section.section_content.substring(0, 100);
                      } else if (Buffer.isBuffer(section.section_content)) {
                        sectionContentPreview = section.section_content.toString().substring(0, 100);
                      }
                      
                      // 如果内容看起来像HTML标签，可能实际上没有被压缩
                      if (sectionContentPreview.includes('<') && sectionContentPreview.includes('>')) {
                        console.warn(`Section ID ${section.id}: Content marked as compressed but appears to be HTML/text. Using as-is.`);
                        sections[index].section_content = Buffer.isBuffer(section.section_content) ? section.section_content.toString() : section.section_content;
                        sections[index].is_actually_decompressed = false; // Mark as not actually compressed
                        sectionsProcessed++;
                        if (sectionsProcessed === sections.length) { fetchMediaAndComments(sections); }
                        return; // continue to next section in forEach
                      }

                      if (typeof section.section_content === 'string') {
                          let isJsonBuffer = false;
                          try {
                              const parsedSection = JSON.parse(section.section_content);
                              if (parsedSection && parsedSection.type === 'Buffer' && Array.isArray(parsedSection.data)) {
                                  sectionContentToDecompress = Buffer.from(parsedSection.data);
                                  isJsonBuffer = true;
                                  sectionIsBuffer = true;
                              }
                          } catch(e) { /* Not a JSON buffer string */ }
                          if (!isJsonBuffer) {
                              sectionContentToDecompress = Buffer.from(section.section_content);
                              sectionIsBuffer = true;
                          }
                      } else if (!sectionIsBuffer) {
                         console.warn(`Section ID ${section.id}: Content marked compressed but not Buffer or String. Type: ${sectionOriginalContentType}. Skipping.`);
                         sections[index].section_content = section.section_content;
                         sectionsProcessed++;
                         if (sectionsProcessed === sections.length) { fetchMediaAndComments(sections); }
                         return; // continue to next section in forEach
                      }

                      compressionService.decompressText(sectionContentToDecompress, function(err, decompressedContent) {
                          if (err) {
                              console.error(`解压章节内容失败 (DiaryID: ${diaryId}, SectionID: ${section.id}): ${err.message}. OriginalType: ${sectionOriginalContentType}, IsBuffer: ${sectionIsBuffer}. Snippet: ${(section.section_content || '').toString().substring(0,50)}`);
                              // 如果解压失败，使用原内容
                              if(Buffer.isBuffer(section.section_content)) {
                                   sections[index].section_content = section.section_content.toString();
                              } else {
                                   sections[index].section_content = section.section_content;
                              }
                              sections[index].is_actually_decompressed = false; // Mark as failed decompression
                          } else {
                              sections[index].section_content = decompressedContent;
                              sections[index].is_actually_decompressed = true;
                          }
                          sectionsProcessed++;
                          if (sectionsProcessed === sections.length) { fetchMediaAndComments(sections); }
                      });
                  } else if (section.section_content != null) { // Not compressed or content is null
                      sections[index].section_content = Buffer.isBuffer(section.section_content) ? section.section_content.toString() : section.section_content;
                      sectionsProcessed++;
                      if (sectionsProcessed === sections.length) { fetchMediaAndComments(sections); }
                  } else {
                      sections[index].section_content = '';
                      sectionsProcessed++;
                      if (sectionsProcessed === sections.length) { fetchMediaAndComments(sections); }
                  }
              });
          }

          function fetchMediaAndComments(processedSections) {
              db.query('SELECT * FROM diary_media WHERE diary_id = ? ORDER BY display_order', [diaryId], function(err, media) {
                  if (err) { 
                      console.error('获取媒体文件失败:', err);
                      return res.status(500).render('error', { message: '获取媒体文件失败' });
                  }
                  const processedMedia = media.map(function(item) {
                      let mediaUrl = item.media_url || '';
                      if (mediaUrl && !mediaUrl.startsWith('/') && !mediaUrl.startsWith('http')) {
                          mediaUrl = '/uploads/' + mediaUrl;
                      }
                      return { ...item, media_url: mediaUrl };
                  });

                  db.query('SELECT c.*, u.username, u.avatar FROM comments c JOIN user_information u ON c.comment_user_id = u.id WHERE c.diary_id = ? ORDER BY c.created_at DESC', [diaryId], function(err, comments) {
                      if (err) { 
                          console.error('获取评论失败:', err);
                          return res.status(500).render('error', { message: '获取评论失败' });
                      }
                      
                      db.query('UPDATE travel_diaries SET view_count = view_count + 1 WHERE id = ?', [diaryId], function(err) {
                          if (err) console.error('更新浏览次数失败:', err);
                          if (userId) {
                              db.query('INSERT INTO diary_views (diary_id, user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE viewed_at = CURRENT_TIMESTAMP', [diaryId, userId], function(err) {
                                  if (err) console.error('记录浏览历史失败:', err);
                                  renderPage(processedSections, processedMedia, comments);
                              });
                          } else {
                              renderPage(processedSections, processedMedia, comments);
                          }
                      });
                  });
              });
          }
          function renderPage(finalSections, finalMedia, finalComments){
              res.render('diary-detail', {
                  diary: diary,
                  sections: finalSections,
                  media: finalMedia,
                  comments: finalComments,
                  user: req.session.user || null
              });
          }
        });
      });
    });
  },

  addComment: function(req, res) {
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

  likeDiary: function(req, res) {
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

  createDiary: function(req, res) {
    const { title, content, sections, tags } = req.body;
    const userId = req.session.user.id;
    
    // 添加调试日志
    console.log('创建日记请求参数:', {
      title,
      content: content ? content.substring(0, 100) + '...' : '',
      sections: sections ? JSON.parse(sections).length + ' sections' : '0 sections',
      tags: tags || '无标签',
      hasFiles: req.files ? Object.keys(req.files) : '无文件'
    });

    compressionService.compressDiary({
      content: content || '', // Ensure content is not undefined
      sections: JSON.parse(sections || '[]').map(function(s){ return {...s, content: s.content || ''};})
    }, function(err, compressedDiary) {
      if (err) {
        console.error('压缩日记内容失败:', err);
        return res.status(500).json({ success: false, message: '内容压缩失败' });
      }

      db.beginTransaction(function(err) {
        if (err) {
          console.error('事务开始失败:', err);
          return res.status(500).json({ success: false, message: '数据库错误' });
        }

        // 处理封面图片
        let coverImagePath = null;
        if (req.files && req.files['coverImage'] && req.files['coverImage'][0]) {
          coverImagePath = req.files['coverImage'][0].filename;
        }

        // 处理分类标签 - 将前端的tags转换为categories
        const categories = tags || '';
        console.log('保存的分类:', categories);

        db.query(
          `INSERT INTO travel_diaries 
           (user_id, title, content, search_content, categories, cover_image, is_compressed, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [userId, title, compressedDiary.content, compressedDiary.search_content, categories, coverImagePath, true],
          function(err, result) {
            if (err) {
              return db.rollback(function() {
                console.error('插入日记主内容失败:', err);
                res.status(500).json({ success: false, message: '数据库错误' });
              });
            }

            const diaryId = result.insertId;
            console.log('日记创建成功，ID:', diaryId, '分类:', categories);

            // 处理章节
            if (!compressedDiary.sections || compressedDiary.sections.length === 0) {
              // 没有章节，直接处理媒体文件
              handleMediaFiles(diaryId);
            } else {
              // 插入章节
              let insertedSections = 0;
              compressedDiary.sections.forEach(function(section) {
                db.query(
                  `INSERT INTO diary_sections 
                   (diary_id, section_title, section_content, day_number, section_order, is_compressed) 
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [diaryId, section.title, section.content, section.dayNumber, section.order, true],
                  function(err) {
                    if (err) {
                      return db.rollback(function() {
                        console.error('插入日记章节失败:', err);
                        res.status(500).json({ success: false, message: '数据库错误' });
                      });
                    }
                    insertedSections++;
                    if (insertedSections === compressedDiary.sections.length) {
                      handleMediaFiles(diaryId);
                    }
                  }
                );
              });
            }

            function handleMediaFiles(diaryId) {
              const mediaFiles = (req.files && req.files['mediaFiles']) ? req.files['mediaFiles'] : [];
              
              if (mediaFiles.length === 0) {
                // 没有媒体文件，直接提交事务
                return db.commit(function(err) {
                  if (err) {
                    return db.rollback(function() {
                      console.error('提交事务失败 (无媒体):', err);
                      res.status(500).json({ success: false, message: '数据库错误' });
                    });
                  }
                  res.json({ success: true, diaryId });
                });
              }

              // 插入媒体文件记录
              let insertedMedia = 0;
              mediaFiles.forEach(function(file, index) {
                const mediaUrl = `/uploads/${file.filename}`;
                const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
                
                db.query(
                  `INSERT INTO diary_media 
                   (diary_id, media_url, media_type, caption, display_order) 
                   VALUES (?, ?, ?, ?, ?)`,
                  [diaryId, mediaUrl, mediaType, '', index + 1],
                  function(err) {
                    if (err) {
                      return db.rollback(function() {
                        console.error('插入媒体文件失败:', err);
                        res.status(500).json({ success: false, message: '数据库错误' });
                      });
                    }
                    insertedMedia++;
                    if (insertedMedia === mediaFiles.length) {
                      db.commit(function(err) {
                        if (err) {
                          return db.rollback(function() {
                            console.error('提交事务失败 (有媒体):', err);
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
          }
        );
      });
    });
  },

  updateDiary: function(req, res) {
    const diaryId = req.params.id;
    const userId = req.session.user.id;
    const { title, content, tips, cover_image, sections, media } = req.body;

    const parsedSectionsForCompression = JSON.parse(sections || '[]').map(function(s) {
      return { ...s, content: s.content || '' };
    });

    compressionService.compressDiary({
      content: content || '',
      sections: parsedSectionsForCompression
    }, function(err, compressedDiary) {
      if (err) {
        console.error('更新时压缩日记内容失败:', err);
        return res.status(500).json({ success: false, message: '内容压缩失败' });
      }

      db.query(
        'SELECT user_id FROM travel_diaries WHERE id = ?',
        [diaryId],
        function(err, results) {
          if (err) {
            console.error('更新前查询日记失败:', err);
            return res.status(500).json({ success: false, message: '服务器错误' });
          }
          if (!results.length || results[0].user_id !== userId) {
            return res.status(403).json({ success: false, message: '你没有权限编辑这篇日记' });
          }

          db.beginTransaction(function(beginErr) {
            if (beginErr) {
              console.error('更新事务开始错误:', beginErr);
              return res.status(500).json({ success: false, message: '数据库错误' });
            }

            let coverImagePath = cover_image;
            if (req.files && req.files['coverImage'] && req.files['coverImage'][0]) {
              // 用户上传了新的封面图片，只保存文件名
              coverImagePath = req.files['coverImage'][0].filename;
            } else if (cover_image) {
              // 用户没有上传新图片，但前端发送了现有图片的文件名
              // 从完整路径中提取文件名，或直接使用传入的值
              if (cover_image.startsWith('/uploads/')) {
                coverImagePath = cover_image.replace('/uploads/', '');
              } else {
                coverImagePath = cover_image; // 已经是文件名
              }
            } else {
              // 没有封面图片信息，保持原有值（不更新封面字段）
              coverImagePath = null;
            }

            const updateDiaryQuery = coverImagePath !== null ? `
              UPDATE travel_diaries 
              SET title = ?, content = ?, search_content = ?, tips = ?, cover_image = ?, is_compressed = ?, updated_at = NOW()
              WHERE id = ? AND user_id = ?` : `
              UPDATE travel_diaries 
              SET title = ?, content = ?, search_content = ?, tips = ?, is_compressed = ?, updated_at = NOW()
              WHERE id = ? AND user_id = ?`;
            
            const updateParams = coverImagePath !== null ? 
              [title, compressedDiary.content, compressedDiary.search_content, tips, coverImagePath, true, diaryId, userId] :
              [title, compressedDiary.content, compressedDiary.search_content, tips, true, diaryId, userId];

            db.query(
              updateDiaryQuery,
              updateParams,
              function(err) {
                if (err) {
                  return db.rollback(function() {
                    console.error('更新日记基本信息操作失败:', err);
                    res.status(500).json({ success: false, message: '数据库错误 (更新日记)' });
                  });
                }

                const parsedMediaForUpdate = JSON.parse(media || '[]');
                const mediaFiles = (req.files && req.files['mediaFiles']) ? req.files['mediaFiles'] : [];

                function finishTransaction() {
                  db.commit(function(commitErr) {
                    if (commitErr) {
                      return db.rollback(function() {
                        console.error('更新事务提交错误:', commitErr);
                        res.status(500).json({ success: false, message: '数据库错误 (提交)' });
                      });
                    }
                    console.log('日记已成功更新', diaryId);
                    res.json({ success: true, message: '日记更新成功', diaryId });
                  });
                }

                function updateSectionsAndMedia() {
                  db.query('DELETE FROM diary_sections WHERE diary_id = ?', [diaryId], function(err) {
                    if (err) {
                      return db.rollback(function() { console.error('删除旧章节失败 (更新):', err); res.status(500).json({m:'db err delete sections'}); });
                    }
                    
                    let sectionsToInsert = compressedDiary.sections || [];
                    let sectionsProcessed = 0;

                    if (sectionsToInsert.length === 0) {
                      updateMedia();
                    } else {
                      sectionsToInsert.forEach(function(section) {
                        db.query(
                          `INSERT INTO diary_sections (diary_id, section_title, section_content, day_number, section_order, is_compressed) VALUES (?, ?, ?, ?, ?, ?)`,                          
                          [diaryId, section.title, section.content, section.dayNumber, section.order, true],
                          function(err) {
                            if (err) {
                              return db.rollback(function() { console.error('插入新章节失败 (更新):', err); res.status(500).json({m:'db err insert section'}); });
                            }
                            sectionsProcessed++;
                            if (sectionsProcessed === sectionsToInsert.length) {
                              updateMedia();
                            }
                          }
                        );
                      });
                    }
                  });
                }
                
                function updateMedia() {
                  db.query('SELECT id, media_url FROM diary_media WHERE diary_id = ?', [diaryId], function(err, existingMedia) {
                    if (err) {
                      return db.rollback(function() { console.error('获取现有媒体失败 (更新):', err); res.status(500).json({m:'db err get media'}); });
                    }

                    const newMediaUrls = parsedMediaForUpdate.map(function(m) { return m.url ? m.url.split('/').pop() : null; }).filter(Boolean);
                    const mediaToDelete = existingMedia.filter(function(em) {
                      const fileName = em.media_url.split('/').pop();
                      return !newMediaUrls.includes(fileName) && !parsedMediaForUpdate.some(function(nm) { return nm.url && nm.url.includes(fileName); });
                    });
                    
                    const mediaPromises = [];

                    if (mediaToDelete.length > 0) {
                        const fs = require('fs');
                        const path = require('path');
                        const uploadDir = path.join(__dirname, '..', 'uploads');
                        mediaToDelete.forEach(function(m) {
                            const mediaFileName = m.media_url.split('/').pop();
                            if (mediaFileName) { // Ensure filename is not empty
                                const filePath = path.join(uploadDir, mediaFileName);
                                if (fs.existsSync(filePath)) {
                                    try { fs.unlinkSync(filePath); console.log('已删除物理文件:', filePath); } catch(e){ console.error('删除物理文件失败:', filePath, e); }
                                } else {
                                    console.warn('尝试删除但物理文件未找到:', filePath);
                                }
                            }
                        });
                        const deleteIds = mediaToDelete.map(function(m) { return m.id; });
                        if (deleteIds.length > 0) {
                            mediaPromises.push(new Promise(function(resolve, reject) {
                                db.query('DELETE FROM diary_media WHERE id IN (?)', [deleteIds], function(err) {
                                    if (err) { console.error('删除媒体记录失败:', err); reject(err); } else { console.log('已删除媒体记录:', deleteIds); resolve(); }
                                });
                            }));
                        }
                    }

                    parsedMediaForUpdate.forEach(function(item) {
                        mediaPromises.push(new Promise(function(resolve, reject) {
                            if (item.id && !String(item.id).startsWith('new_')) {
                                db.query(
                                    `UPDATE diary_media SET caption = ?, display_order = ? WHERE id = ? AND diary_id = ?`,
                                    [item.caption, item.order, item.id, diaryId],
                                    function(err) { if (err) {console.error('更新媒体记录失败:', err); reject(err);} else {resolve();}}
                                );
                            } else {
                                let mediaUrl = item.url;
                                const matchingFile = mediaFiles.find(function(f) { return f.originalname === item.url; });
                                if (matchingFile) {
                                    mediaUrl = "/uploads/" + matchingFile.filename;
                                } else if (item.url && !item.url.includes('/uploads/') && !item.url.startsWith('http')) {
                                     mediaUrl = "/uploads/" + item.url.split('/').pop();
                                }
                                db.query(
                                    `INSERT INTO diary_media (diary_id, media_url, media_type, caption, display_order) VALUES (?, ?, ?, ?, ?)`, 
                                    [diaryId, mediaUrl, item.type, item.caption, item.order],
                                    function(err) { if (err) {console.error('插入媒体记录失败:', err); reject(err);} else {resolve();}}
                                );
                            }
                        }));
                    });

                    Promise.all(mediaPromises)
                        .then(function() {
                            finishTransaction();
                        })
                        .catch(function(err) {
                            db.rollback(function() {
                                console.error('更新中处理媒体文件操作失败:', err);
                                res.status(500).json({ success: false, message: '数据库错误 (媒体处理)' });
                            });
                        });
                  });
                }
                updateSectionsAndMedia(); 
              }
            );
          });
        }
      );
    });
  },

  rateDiary: function(req, res) {
    const diaryId = req.params.id;
    const userId = req.session.user.id;
    const { rating } = req.body;

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: '评分必须是1-5之间的数字' });
    }

    db.query(
      `INSERT INTO diary_ratings (diary_id, user_id, rating) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rating = ?`,
      [diaryId, userId, rating, rating],
      function(err) {
        if (err) {
          console.error('评分数据库错误:', err);
          return res.status(500).json({ error: '数据库错误' });
        }
        // Fetch updated average rating to send back to client
        db.query('SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count FROM diary_ratings WHERE diary_id = ?', [diaryId], function(err, results) {
            if (err) {
                console.error('获取平均评分失败:', err);
                return res.status(500).json({ message: '评分成功但获取平均分失败' });
            }
            const avgRating = results[0] ? results[0].avg_rating : 0;
            const ratingCount = results[0] ? results[0].rating_count : 0;
            // Update the main diary table as well (optional, but good for denormalization)
            db.query('UPDATE travel_diaries SET rating = ?, rating_count = ? WHERE id = ?', [avgRating, ratingCount, diaryId], function(err) {
                if (err) console.error('更新日记主表评分失败:', err);
                res.json({ message: '评分成功', newRating: rating, avgRating: avgRating, ratingCount: ratingCount });
            });
        });
      }
    );
  },

  favoriteDiary: function(req, res) {
    const diaryId = req.params.id;
    const userId = req.session.user.id;
    db.query('SELECT id FROM diary_favorites WHERE diary_id = ? AND user_id = ?', [diaryId, userId], function(err, results) {
        if (err) {
            console.error('查询收藏状态失败:', err);
            return res.status(500).json({ error: '数据库错误' });
        }
        if (results.length > 0) { 
            db.query('DELETE FROM diary_favorites WHERE diary_id = ? AND user_id = ?', [diaryId, userId], function(err) {
                if (err) {
                    console.error('取消收藏失败:', err);
                    return res.status(500).json({ error: '数据库错误' });
                }
                // Update count on main table
                db.query('UPDATE travel_diaries SET favorite_count = GREATEST(0, favorite_count - 1) WHERE id = ?', [diaryId], function(err){ if(err) console.error('更新收藏数失败:', err); });
                res.json({ message: '取消收藏成功', favorited: false });
            });
        } else { 
            db.query('INSERT INTO diary_favorites (diary_id, user_id) VALUES (?, ?)', [diaryId, userId], function(err) {
                if (err) {
                    console.error('添加收藏失败:', err);
                    return res.status(500).json({ error: '数据库错误' });
                }
                // Update count on main table
                db.query('UPDATE travel_diaries SET favorite_count = favorite_count + 1 WHERE id = ?', [diaryId], function(err){ if(err) console.error('更新收藏数失败:', err); });
                res.json({ message: '收藏成功', favorited: true });
            });
        }
    });
  },

  getShareLink: function(req, res) {
    const diaryId = req.params.id;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const shareUrl = `${baseUrl}/diary-detail/${diaryId}`;
    res.json({
      success: true,
      shareUrl
    });
  }
};

module.exports = diaryController;