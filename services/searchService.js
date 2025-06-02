const db = require('../config/test-database');

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
    this.tfidf = new TFIDFCalculator();
  }

  // 全文搜索
  async searchDiaries(searchQuery, userId = null, options = {}) {
    const {
      page = 1,
      limit = 12,
      category = null,
      sort = 'relevance'
    } = options;

    console.log('Search parameters:', { searchQuery, userId, page, limit, category, sort });

    const offset = (page - 1) * limit;
    const scorer = new RecommendationScorer(userId);
    await scorer.initUserPreferences();

    // 构建基础查询
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

    // 添加全文搜索条件
    if (searchQuery) {
      whereClause += ' AND (MATCH(d.title, d.content) AGAINST(? IN NATURAL LANGUAGE MODE) OR d.title LIKE ? OR d.content LIKE ?)';
      params.push(searchQuery, `%${searchQuery}%`, `%${searchQuery}%`);
    }

    // 添加分类筛选
    if (category && category !== '全部主题') {
      whereClause += ' AND d.categories LIKE ?';
      params.push(`%${category}%`);
    }

    query += whereClause + ' GROUP BY d.id';
    
    console.log('Final SQL query:', query);
    console.log('Query parameters:', params);

    return new Promise((resolve, reject) => {
      db.query(query, params, async (err, results) => {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
          return;
        }

        console.log('Raw search results:', results);

        // 计算每篇日记的推荐分数
        const scoredResults = await Promise.all(results.map(async diary => {
          const score = await scorer.calculateFinalScore(diary, searchQuery);
          return { ...diary, score };
        }));

        // 根据排序方式排序
        let sortedResults;
        switch (sort) {
          case 'relevance':
            sortedResults = scoredResults.sort((a, b) => b.score - a.score);
            break;
          case 'hot':
            sortedResults = scoredResults.sort((a, b) => b.like_count - a.like_count);
            break;
          case 'newest':
            sortedResults = scoredResults.sort((a, b) => 
              new Date(b.created_at) - new Date(a.created_at)
            );
            break;
          default:
            sortedResults = scoredResults.sort((a, b) => b.score - a.score);
        }

        // 分页
        const paginatedResults = sortedResults.slice(offset, offset + limit);
        
        resolve({
          diaries: paginatedResults,
          total: results.length,
          page,
          totalPages: Math.ceil(results.length / limit)
        });
      });
    });
  }
}

module.exports = new SearchService(); 