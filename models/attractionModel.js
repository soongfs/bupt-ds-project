// models/attractionModel.js
const db = require("../config/test-database");

// 根据tags和景点名称推断实际分类
function inferCategory(tags, name, originalCategory) {
  try {
    // 安全地转换为字符串并转为小写
    let tagStr = '';
    let nameStr = '';
    
    // 处理tags字段的多种可能类型
    if (tags !== null && tags !== undefined) {
      if (typeof tags === 'string') {
        tagStr = tags.toLowerCase();
      } else if (Array.isArray(tags)) {
        tagStr = tags.join(',').toLowerCase();
      } else if (typeof tags === 'object') {
        tagStr = JSON.stringify(tags).toLowerCase();
      } else {
        tagStr = String(tags).toLowerCase();
      }
    }
    
    // 处理name字段
    if (name !== null && name !== undefined) {
      nameStr = String(name).toLowerCase();
    }
    
    // 自然风光
    if (tagStr.includes('公园') || tagStr.includes('植物园') || tagStr.includes('山') || 
        tagStr.includes('湖') || tagStr.includes('园林') || tagStr.includes('避暑') ||
        nameStr.includes('公园') || nameStr.includes('园') || nameStr.includes('山') ||
        nameStr.includes('湖') || nameStr.includes('森林') || nameStr.includes('峡谷')) {
      return 'natural';
    }
    
    // 历史人文
    if (tagStr.includes('历史建筑') || tagStr.includes('展馆') || tagStr.includes('博物') ||
        tagStr.includes('寺庙') || tagStr.includes('古迹') || tagStr.includes('故宫') ||
        nameStr.includes('博物') || nameStr.includes('宫') || nameStr.includes('寺') ||
        nameStr.includes('庙') || nameStr.includes('陵') || nameStr.includes('古') ||
        nameStr.includes('文化') || nameStr.includes('纪念')) {
      return 'historical';
    }
    
    // 城市地标
    if (tagStr.includes('场馆') || tagStr.includes('地标') || tagStr.includes('观景') ||
        tagStr.includes('体育') || tagStr.includes('商业') || tagStr.includes('建筑') ||
        nameStr.includes('中心') || nameStr.includes('广场') || nameStr.includes('大厦') ||
        nameStr.includes('塔') || nameStr.includes('站') || nameStr.includes('街')) {
      return 'landmark';
    }
    
    // 娱乐休闲
    if (tagStr.includes('游乐') || tagStr.includes('娱乐') || tagStr.includes('乐园') ||
        tagStr.includes('动物园') || tagStr.includes('水族') || tagStr.includes('演出') ||
        nameStr.includes('乐园') || nameStr.includes('游乐') || nameStr.includes('动物园') ||
        nameStr.includes('演唱会') || nameStr.includes('剧院')) {
      return 'entertainment';
    }
    
    // 默认分类
    return 'landmark';
  } catch (error) {
    console.error('Error in inferCategory:', error, { tags, name, originalCategory });
    return 'landmark';
  }
}

// 处理景点数据的辅助函数
function processAttractionData(attraction) {
  try {
    attraction.rating = parseFloat(attraction.aaa_rating) || 0;
    attraction.comment_count = parseInt(attraction.popularity) || 0;
    attraction.price_level = parseInt(attraction.price_level) || 1;
    attraction.duration = parseInt(attraction.duration) || 180;
    attraction.distance = parseFloat(attraction.distance) || 0;

    // 推断实际分类 - 添加错误处理
    try {
      attraction.inferred_category = inferCategory(attraction.tags, attraction.name, attraction.category);
    } catch (error) {
      console.error('Error inferring category for attraction:', attraction.id, error);
      attraction.inferred_category = 'landmark';
    }

    // Ensure user-specific fields from JOINs are also numbers if they exist
    attraction.user_rating = parseFloat(attraction.user_rating_val) || 0;
    attraction.user_views = parseInt(attraction.user_views_val) || 0;
    attraction.last_viewed = attraction.last_viewed_val || '1970-01-01';
    
    // For personalized sort fields, ensure they are numbers
    attraction.preference_score = parseFloat(attraction.preference_score) || 0;
    attraction.category_preference = parseFloat(attraction.category_preference) || 0;
  } catch (error) {
    console.error('Error processing attraction data:', attraction.id, error);
    // 设置默认值以防止崩溃
    attraction.rating = 0;
    attraction.comment_count = 0;
    attraction.price_level = 1;
    attraction.duration = 180;
    attraction.distance = 0;
    attraction.inferred_category = 'landmark';
    attraction.user_rating = 0;
    attraction.user_views = 0;
    attraction.last_viewed = '1970-01-01';
    attraction.preference_score = 0;
    attraction.category_preference = 0;
  }
  return attraction;
}

exports.getAttractions = (category, sort, userId = null, callback) => {
  let selectFields = ["a.*", "a.aaa_rating", "a.popularity"];
  let fromClause = "FROM attractions a";
  let joinClause = "";
  const whereConditions = [];
  const queryParams = [];
  let orderByClause = "";

  if (userId) {
    joinClause += ` LEFT JOIN user_attraction_ratings ur ON a.id = ur.attraction_id AND ur.user_id = ?`;
    queryParams.push(userId);
    joinClause += ` LEFT JOIN user_attraction_history uh ON a.id = uh.attraction_id AND uh.user_id = ?`;
    queryParams.push(userId);

    selectFields.push("COALESCE(ur.rating, 0) as user_rating_val");
    selectFields.push("COALESCE(uh.view_count, 0) as user_views_val");
    selectFields.push("COALESCE(uh.last_viewed_at, '1970-01-01') as last_viewed_val");
  }

  if (sort === 'personalized' && userId) {
    selectFields.push(`(
      COALESCE(ur.rating, 0) * 0.5 +
      CAST(NULLIF(a.aaa_rating, '') AS DECIMAL(3,1)) / 5 * 0.2 +
      LEAST(COALESCE(uh.view_count, 0) / 10, 1) * 0.2 +
      CASE 
        WHEN DATEDIFF(NOW(), COALESCE(uh.last_viewed_at, '1970-01-01')) < 7 THEN 0.1
        WHEN DATEDIFF(NOW(), COALESCE(uh.last_viewed_at, '1970-01-01')) < 30 THEN 0.05
        ELSE 0 
      END
    ) as preference_score`);
    
    selectFields.push(`(
      SELECT AVG(r2.rating) * 1.5
      FROM user_attraction_ratings r2
      JOIN attractions a2 ON r2.attraction_id = a2.id
      WHERE r2.user_id = ? AND a2.category = a.category
    ) as category_preference`);
    
    queryParams.push(userId);
    orderByClause = "ORDER BY category_preference DESC, preference_score DESC";
  } else if (sort === "rating") {
    selectFields.push(`(
      CAST(NULLIF(a.aaa_rating, '') AS DECIMAL(3,1)) * 0.7 +
      COALESCE(
        (SELECT AVG(rating) FROM user_attraction_ratings WHERE attraction_id = a.id),
        0
      ) * 0.3 +
      RAND() * 0.1
    ) as overall_rating`);
    orderByClause = "ORDER BY overall_rating DESC, CAST(NULLIF(REGEXP_REPLACE(a.popularity, '[^0-9]', ''), '') AS DECIMAL(10,0)) DESC";
  } else if (sort === "distance") {
    orderByClause = "ORDER BY CAST(NULLIF(REGEXP_REPLACE(a.distance, '[^0-9.]', ''), '') AS DECIMAL(10,2)) ASC";
  } else if (sort === 'my_ratings' && userId) {
    selectFields.push(`(
      COALESCE(ur.rating, 0) * 0.8 +
      CAST(NULLIF(a.aaa_rating, '') AS DECIMAL(3,1)) * 0.2 +
      RAND() * 0.1
    ) as user_rating_score`);
    orderByClause = "ORDER BY user_rating_score DESC";
  } else if (sort === 'my_views' && userId) {
    selectFields.push(`(
      COALESCE(uh.view_count, 0) * 0.6 +
      CASE 
        WHEN DATEDIFF(NOW(), COALESCE(uh.last_viewed_at, '1970-01-01')) < 7 THEN 40
        WHEN DATEDIFF(NOW(), COALESCE(uh.last_viewed_at, '1970-01-01')) < 30 THEN 20
        ELSE 0 
      END +
      RAND() * 5
    ) as view_score`);
    orderByClause = "ORDER BY view_score DESC";
  } else {  // 默认为热度排序
    selectFields.push(`(
      CAST(NULLIF(REGEXP_REPLACE(a.popularity, '[^0-9]', ''), '') AS DECIMAL(10,0)) * 0.4 +
      CAST(COALESCE(a.comment_count, 0) AS DECIMAL(10,0)) * 0.3 +
      COALESCE(
        (SELECT SUM(view_count) FROM user_attraction_history WHERE attraction_id = a.id),
        0
      ) * 0.3 +
      CAST(NULLIF(a.aaa_rating, '') AS DECIMAL(3,1)) * 10 +
      RAND() * 100
    ) as hot_score`);
    orderByClause = "ORDER BY hot_score DESC";
  }

  let sql = `SELECT ${selectFields.join(', ')} ${fromClause} ${joinClause}`;
  if (whereConditions.length > 0) {
    sql += ` WHERE ${whereConditions.join(' AND ')}`;
  }
  sql += ` ${orderByClause}`;

  db.query(sql, queryParams, (err, results) => {
    if (err) return callback(err);
    
    results = results.map(processAttractionData);
    
    // 根据推断的分类进行筛选
    if (category && category !== "all") {
      results = results.filter(attraction => attraction.inferred_category === category);
    }
    
    callback(null, results);
  });
};

// 获取推荐景点 - 改进算法以产生不同的推荐分数
exports.getRecommendedAttractions = (userId, limit = 5, callback) => {
  if (!userId) {
    return callback(null, []);
  }

  const sql = `
    SELECT 
      a.*,
      a.aaa_rating,
      a.popularity,
      (
        (CAST(NULLIF(a.aaa_rating, '') AS DECIMAL(3,1)) / 5) * 0.25 + 
        COALESCE(up.avg_category_rating / 5, 0.4) * 0.35 + 
        LEAST(COALESCE(up.category_visit_count / 10, 0), 1) * 0.2 +
        (CAST(NULLIF(REGEXP_REPLACE(a.popularity, '[^0-9]', ''), '') AS DECIMAL(10,0)) / 10) * 0.1 +
        RAND() * 0.1
      ) as recommendation_score
    FROM attractions a
    LEFT JOIN (
      SELECT
        a2.category,
        AVG(r.rating) as avg_category_rating,
        COUNT(DISTINCT h.attraction_id) as category_visit_count
      FROM attractions a2
      LEFT JOIN user_attraction_history h ON h.attraction_id = a2.id AND h.user_id = ?
      LEFT JOIN user_attraction_ratings r ON r.attraction_id = a2.id AND r.user_id = ?
      GROUP BY a2.category
    ) up ON a.category = up.category
    WHERE a.id NOT IN (
      SELECT DISTINCT attraction_id 
      FROM user_attraction_history 
      WHERE user_id = ?
    )
    ORDER BY recommendation_score DESC
    LIMIT ?
  `;

  db.query(sql, [userId, userId, userId, limit], (err, results) => {
    if (err) return callback(err);
    results = results.map(attraction => {
      const processed = processAttractionData(attraction);
      processed.recommendation_score = parseFloat(attraction.recommendation_score) || 0;
      return processed;
    });
    callback(null, results);
  });
};

// 获取相似景点
exports.getSimilarAttractions = (attractionId, limit = 5, callback) => {
  const sql = `
    WITH target_attraction AS (
      SELECT 
        category, 
        CAST(NULLIF(aaa_rating, '') AS DECIMAL(3,1)) as rating_val,
        price_level,
        duration,
        tags,
        name
      FROM attractions
      WHERE id = ?
    )
    SELECT 
      a.*,
      a.aaa_rating,
      a.popularity,
      (
        CASE WHEN a.category = ta.category THEN 0.3 ELSE 0 END +
        (1 - ABS(CAST(NULLIF(a.aaa_rating, '') AS DECIMAL(3,1)) - ta.rating_val) / 5) * 0.3 +
        (1 - ABS(COALESCE(a.price_level, 1) - COALESCE(ta.price_level, 1)) / 4) * 0.2 +
        (1 - ABS(COALESCE(a.duration, 180) - COALESCE(ta.duration, 180)) / 480) * 0.1 +
        CASE 
          WHEN a.tags LIKE CONCAT('%', SUBSTRING_INDEX(ta.tags, ',', 1), '%') THEN 0.1
          ELSE 0
        END +
        RAND() * 0.1
      ) as similarity_score
    FROM attractions a
    CROSS JOIN target_attraction ta
    WHERE a.id != ?
    ORDER BY similarity_score DESC
    LIMIT ?
  `;

  db.query(sql, [attractionId, attractionId, limit], (err, results) => {
    if (err) return callback(err);
    results = results.map(attraction => {
      const processed = processAttractionData(attraction);
      processed.similarity_score = parseFloat(attraction.similarity_score) || 0;
      return processed;
    });
    callback(null, results);
  });
};

// 根据ID获取景点详情
exports.getAttractionById = (id, userId = null, callback) => {
  let sql = `
    SELECT 
      a.*,
      a.aaa_rating,
      a.popularity`;

  const selectFieldsForDetail = ["a.*", "a.aaa_rating", "a.popularity"];
  let joinClauseForDetail = "";
  const queryParamsForDetail = [];

  if (userId) {
    joinClauseForDetail += ` LEFT JOIN user_attraction_ratings ur ON a.id = ur.attraction_id AND ur.user_id = ?`;
    queryParamsForDetail.push(userId);
    joinClauseForDetail += ` LEFT JOIN user_attraction_history uh ON a.id = uh.attraction_id AND uh.user_id = ?`;
    queryParamsForDetail.push(userId);
    selectFieldsForDetail.push("COALESCE(ur.rating, 0) as user_rating_val");
    selectFieldsForDetail.push("COALESCE(uh.view_count, 0) as user_views_val");
    selectFieldsForDetail.push("COALESCE(uh.last_viewed_at, '1970-01-01') as last_viewed_val");
  }
  
  sql = `SELECT ${selectFieldsForDetail.join(', ')} FROM attractions a ${joinClauseForDetail} WHERE a.id = ?`;
  queryParamsForDetail.push(id);

  db.query(sql, queryParamsForDetail, (err, results) => {
    if (err) return callback(err);
    if (!results[0]) {
      return callback(null, null);
    }
    let attraction = processAttractionData(results[0]);
    callback(null, attraction);
  });
};

// 根据名称搜索景点，支持精确和模糊匹配
exports.searchAttractionsByName = (name, callback) => {
  // 1. 尝试精确匹配
  const exactSql = "SELECT id, name, rating, popularity FROM attractions WHERE name = ? LIMIT 1";
  db.query(exactSql, [name], (err, exactResults) => {
    if (err) return callback(err);

    if (exactResults && exactResults.length > 0) {
      // 找到精确匹配
      return callback(null, { matchType: 'exact', attraction: exactResults[0] });
    }

    // 2. 如果没有精确匹配，进行模糊匹配
    // 改进搜索算法，包含更多信息
    const fuzzySql = `
      SELECT 
        id, 
        name, 
        rating, 
        popularity,
        aaa_rating,
        tags,
        (
          CASE 
            WHEN name LIKE ? THEN 100
            WHEN name LIKE ? THEN 80
            WHEN tags LIKE ? THEN 60
            ELSE 40
          END +
          CAST(NULLIF(REGEXP_REPLACE(popularity, '[^0-9]', ''), '') AS DECIMAL(10,0)) / 100 +
          CAST(NULLIF(aaa_rating, '') AS DECIMAL(3,1)) * 5
        ) as relevance_score
      FROM attractions 
      WHERE (name LIKE ? OR tags LIKE ? OR name LIKE ?)
      ORDER BY relevance_score DESC 
      LIMIT 15
    `;
    
    const searchPattern = `%${name}%`;
    const exactPattern = `${name}%`;
    
    db.query(fuzzySql, [
      exactPattern,  // 完全匹配开头
      searchPattern, // 包含搜索词
      searchPattern, // 标签匹配
      searchPattern, // WHERE子句中的条件
      searchPattern,
      searchPattern
    ], (err, fuzzyResults) => {
      if (err) return callback(err);

      if (fuzzyResults && fuzzyResults.length > 0) {
        // 处理搜索结果，添加推断的分类
        const processedResults = fuzzyResults.map(attraction => {
          return {
            ...attraction,
            inferred_category: inferCategory(attraction.tags, attraction.name)
          };
        });
        
        return callback(null, { matchType: 'fuzzy', attractions: processedResults });
      } else {
        // 没有找到任何匹配项
        return callback(null, { matchType: 'none' });
      }
    });
  });
};

// 搜索景点并按综合指标排序
exports.searchAttractionsByNameWithRanking = (name, userId = null, callback) => {
  let selectFields = [
    "a.*",
    "a.aaa_rating",
    "a.popularity",
    `(
      CAST(NULLIF(REGEXP_REPLACE(a.popularity, '[^0-9]', ''), '') AS DECIMAL(10,0)) * 0.3 +
      CAST(COALESCE(a.comment_count, 0) AS DECIMAL(10,0)) * 0.2 +
      COALESCE(
        (SELECT SUM(view_count) FROM user_attraction_history WHERE attraction_id = a.id),
        0
      ) * 0.2 +
      CAST(NULLIF(a.aaa_rating, '') AS DECIMAL(3,1)) * 20 +
      CASE 
        WHEN a.name LIKE ? THEN 50
        WHEN a.name LIKE ? THEN 30
        WHEN a.tags LIKE ? THEN 20
        ELSE 10
      END +
      RAND() * 10
    ) as ranking_score`
  ];
  
  let fromClause = "FROM attractions a";
  let joinClause = "";
  const queryParams = [`${name}%`, `%${name}%`, `%${name}%`];
  
  if (userId) {
    joinClause += ` LEFT JOIN user_attraction_ratings ur ON a.id = ur.attraction_id AND ur.user_id = ?`;
    queryParams.push(userId);
    joinClause += ` LEFT JOIN user_attraction_history uh ON a.id = uh.attraction_id AND uh.user_id = ?`;
    queryParams.push(userId);
    
    selectFields.push("COALESCE(ur.rating, 0) as user_rating_val");
    selectFields.push("COALESCE(uh.view_count, 0) as user_views_val");
    selectFields.push("COALESCE(uh.last_viewed_at, '1970-01-01') as last_viewed_val");
  }

  queryParams.push(name); // 最后的WHERE条件参数

  const sql = `
    SELECT ${selectFields.join(', ')}
    ${fromClause}
    ${joinClause}
    WHERE a.name LIKE CONCAT('%', ?, '%')
    ORDER BY ranking_score DESC
    LIMIT 20
  `;

  db.query(sql, queryParams, (err, results) => {
    if (err) return callback(err);
    results = results.map(processAttractionData);
    callback(null, results);
  });
};
