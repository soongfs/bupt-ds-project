const db = require('../config/test-database');
const compressionService = require('./compressionService');

// TF-IDF计算工具
class TFIDFCalculator {
  constructor() {
    this.documents = new Map();
    this.documentCount = 0;
  }

  // 计算词频 (TF)
  calculateTF(text) {
    const words = this.tokenize(text);
    const wordCount = new Map();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
    
    // 归一化TF值
    const maxCount = Math.max(...wordCount.values());
    const tf = new Map();
    wordCount.forEach((count, word) => {
      tf.set(word, count / maxCount);
    });
    
    return tf;
  }

  // 计算逆文档频率 (IDF)
  async calculateIDF(keyword) {
    const query = `
      SELECT COUNT(DISTINCT id) as docCount 
      FROM travel_diaries 
      WHERE MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE)
    `;
    
    return new Promise((resolve, reject) => {
      db.query(query, [keyword], (err, results) => {
        if (err) {
          reject(err);
          return;
        }
        const docsWithTerm = results[0].docCount;
        // IDF = log(总文档数 / (包含该词的文档数 + 1))
        const idf = Math.log(this.documentCount / (docsWithTerm + 1));
        resolve(idf);
      });
    });
  }

  // 分词
  tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, '') // 保留中文字符和英文单词
      .split(/\s+/)
      .filter(word => word.length > 1); // 过滤掉单字符
  }
}

// 推荐评分计算
class RecommendationScorer {
  constructor(userId) {
    this.userId = userId;
    this.userPreferences = null;
  }

  // 初始化用户偏好
  async initUserPreferences() {
    if (this.userId) {
      const query = `
        SELECT 
          DISTINCT d.categories,
          COUNT(*) as visit_count,
          AVG(dr.rating) as avg_rating
        FROM travel_diaries d
        LEFT JOIN diary_views dv ON d.id = dv.diary_id
        LEFT JOIN diary_ratings dr ON d.id = dr.diary_id
        WHERE dv.user_id = ? OR dr.user_id = ?
        GROUP BY d.categories
      `;

      return new Promise((resolve, reject) => {
        db.query(query, [this.userId, this.userId], (err, results) => {
          if (err) {
            reject(err);
            return;
          }
          this.userPreferences = results;
          resolve(results);
        });
      });
    }
    return Promise.resolve(null);
  }

  // 计算用户兴趣匹配分数 (0-1)
  calculateUserInterestScore(diary) {
    if (!this.userPreferences || !diary.categories) return 0.5;
    
    let interestScore = 0;
    let maxScore = 0;
    
    // 将日记分类转换为数组
    const diaryCategories = diary.categories.split(',').map(c => c.trim());
    
    this.userPreferences.forEach(pref => {
      if (pref.categories && diaryCategories.some(cat => cat === pref.categories)) {
        interestScore += (pref.visit_count * 0.3 + (pref.avg_rating || 0) * 0.7);
      }
      maxScore += 5; // 最大可能分数
    });
    
    return maxScore > 0 ? interestScore / maxScore : 0.5;
  }

  // 计算热度分数 (0-1)
  calculateHotScore(diary) {
    const now = new Date();
    const createdAt = new Date(diary.created_at);
    const daysDiff = (now - createdAt) / (1000 * 60 * 60 * 24);
    
    // 计算时间衰减因子
    const timeDecay = Math.exp(-daysDiff / 30); // 30天半衰期
    
    // 归一化的互动分数
    const interactionScore = (
      (diary.view_count || 0) * 1 +
      (diary.like_count || 0) * 2 +
      (diary.comment_count || 0) * 3 +
      (diary.rating || 0) * 5
    ) / 1000; // 假设1000是一个合理的最大值
    
    return (interactionScore * 0.7 + timeDecay * 0.3);
  }

  // 计算内容相关度分数 (0-1)
  calculateContentRelevance(diary, searchKeywords) {
    if (!searchKeywords) return 1;
    
    const keywords = searchKeywords.toLowerCase().split(/\s+/);
    const content = ((diary.title || '') + ' ' + (diary.content || '')).toLowerCase();
    
    let matchCount = 0;
    keywords.forEach(keyword => {
      if (content.includes(keyword)) matchCount++;
    });
    
    return matchCount / keywords.length;
  }

  // 计算最终推荐分数
  calculateFinalScore(diary, searchKeywords) {
    const contentRelevance = this.calculateContentRelevance(diary, searchKeywords);
    const hotScore = this.calculateHotScore(diary);
    const userInterestScore = this.calculateUserInterestScore(diary);
    
    // 权重配置
    const weights = {
      contentRelevance: 0.4,
      hotScore: 0.3,
      userInterest: 0.3
    };
    
    return (
      contentRelevance * weights.contentRelevance +
      hotScore * weights.hotScore +
      userInterestScore * weights.userInterest
    );
  }
}

// 搜索服务
class SearchService {
  constructor() {
    this.db = db;
    this.tfidf = new TFIDFCalculator();
  }

  searchDiaries(searchQuery, userId = null, options = {}, callback) {
    if (typeof callback !== 'function') {
      console.error('Callback is not provided or not a function');
      return;
    }

    const {
      page = 1,
      limit = 12,
      category = null,
      sort = 'relevance'
    } = options;

    const offset = (page - 1) * limit;
    
    // 基础查询，增加内容长度检查和相关性评分
    let query = `
      SELECT 
        d.*,
        u.username,
        u.avatar,
        COUNT(DISTINCT dl.id) as like_count,
        COUNT(DISTINCT c.id) as comment_count,
        COUNT(DISTINCT df.id) as favorite_count,
        COALESCE(AVG(dr.rating), 0) as avg_rating,
        GROUP_CONCAT(DISTINCT t.name) as tag_names,
        GROUP_CONCAT(DISTINCT t.icon) as tag_icons,
        GROUP_CONCAT(DISTINCT t.category) as tag_categories,
        CASE 
          WHEN ? != ''
          THEN MATCH(d.title, d.search_content) AGAINST(? IN NATURAL LANGUAGE MODE WITH QUERY EXPANSION)
          ELSE 1
        END as relevance_score,
        d.created_at
      FROM travel_diaries d
      JOIN user_information u ON d.user_id = u.id
      LEFT JOIN diary_likes dl ON d.id = dl.diary_id
      LEFT JOIN comments c ON d.id = c.diary_id
      LEFT JOIN diary_favorites df ON d.id = df.diary_id
      LEFT JOIN diary_ratings dr ON d.id = dr.diary_id
      LEFT JOIN diary_tag_relations tr ON d.id = tr.diary_id
      LEFT JOIN diary_tags t ON tr.tag_id = t.id
    `;

    const queryParams = [searchQuery, searchQuery];
    
    // 添加WHERE子句
    let whereConditions = [];
    if (searchQuery) {
      whereConditions.push(`MATCH(d.title, d.search_content) AGAINST(? IN NATURAL LANGUAGE MODE WITH QUERY EXPANSION)`);
      queryParams.push(searchQuery);
    }
    
    if (category && category !== '全部主题') {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM diary_tag_relations tr2 
        JOIN diary_tags t2 ON tr2.tag_id = t2.id 
        WHERE tr2.diary_id = d.id AND t2.name = ?
      )`);
      queryParams.push(category);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // 分组
    query += ' GROUP BY d.id';
    
    // 排序
    switch (sort) {
      case 'hot':
        query += ` ORDER BY (
          COUNT(DISTINCT dl.id) * 0.4 + 
          COUNT(DISTINCT c.id) * 0.3 + 
          COUNT(DISTINCT df.id) * 0.2 + 
          COALESCE(AVG(dr.rating), 0) * 0.1
        ) DESC`;
        break;
      case 'newest':
        query += ' ORDER BY d.created_at DESC';
        break;
      case 'featured':
        query += ' ORDER BY d.is_featured DESC, d.created_at DESC';
        break;
      default:
        query += ' ORDER BY relevance_score DESC, d.created_at DESC';
    }
    
    // 分页
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    // 获取总数的查询
    let countQuery = `
      SELECT COUNT(DISTINCT d.id) as total
      FROM travel_diaries d
    `;
    
    if (whereConditions.length > 0) {
      countQuery += ' WHERE ' + whereConditions.join(' AND ');
    }

    // 执行查询
    this.db.query(query, queryParams, (err, diaries) => {
      if (err) {
        console.error('搜索日记失败:', err);
        return callback(err);
      }

      // 获取总数
      this.db.query(countQuery, queryParams.slice(0, -2), (err, countResult) => {
        if (err) {
          console.error('获取总数失败:', err);
          return callback(err);
        }

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        // 处理搜索结果
        let processedCount = 0;
        const processedDiaries = [];

        const processDiary = (diary, index) => {
          // 如果日记内容是压缩的，解压缩
          if (diary.is_compressed) {
            compressionService.decompressDiary(diary, (err, decompressedDiary) => {
              if (!err && decompressedDiary) {
                diary.content = decompressedDiary.content;
              }
              processedDiaries[index] = diary;
              processedCount++;
              checkComplete();
            });
          } else {
            processedDiaries[index] = diary;
            processedCount++;
            checkComplete();
          }
        };

        const checkComplete = () => {
          if (processedCount === diaries.length) {
            callback(null, {
              diaries: processedDiaries,
              total,
              totalPages,
              currentPage: page
            });
          }
        };

        if (diaries.length === 0) {
          callback(null, {
            diaries: [],
            total: 0,
            totalPages: 0,
            currentPage: page
          });
        } else {
          diaries.forEach(processDiary);
        }
      });
    });
  }
}

module.exports = new SearchService(); 