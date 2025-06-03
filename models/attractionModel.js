// models/attractionModel.js
const db = require("../config/test-database");

// 处理景点数据的辅助函数
function processAttractionData(attraction) {
  attraction.rating = parseFloat(attraction.aaa_rating) || 0;
  attraction.comment_count = parseInt(attraction.popularity) || 0;
  attraction.price_level = parseInt(attraction.price_level) || 0;
  attraction.duration = parseInt(attraction.duration) || 0;
  attraction.distance = parseFloat(attraction.distance) || 0;

  // Ensure user-specific fields from JOINs are also numbers if they exist
  attraction.user_rating = parseFloat(attraction.user_rating_val) || 0;
  attraction.user_views = parseInt(attraction.user_views_val) || 0;
  attraction.last_viewed = attraction.last_viewed_val || '1970-01-01';
  
  // For personalized sort fields, ensure they are numbers
  attraction.preference_score = parseFloat(attraction.preference_score) || 0;
  attraction.category_preference = parseFloat(attraction.category_preference) || 0;
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
      ) * 0.3
    ) as overall_rating`);
    orderByClause = "ORDER BY overall_rating DESC, CAST(NULLIF(REGEXP_REPLACE(a.popularity, '[^0-9]', ''), '') AS DECIMAL(10,0)) DESC";
  } else if (sort === "distance") {
    orderByClause = "ORDER BY CAST(NULLIF(REGEXP_REPLACE(a.distance, '[^0-9.]', ''), '') AS DECIMAL(10,2)) ASC";
  } else if (sort === 'my_ratings' && userId) {
    selectFields.push(`(
      COALESCE(ur.rating, 0) * 0.8 +
      CAST(NULLIF(a.aaa_rating, '') AS DECIMAL(3,1)) * 0.2
    ) as user_rating_score`);
    orderByClause = "ORDER BY user_rating_score DESC";
  } else if (sort === 'my_views' && userId) {
    selectFields.push(`(
      COALESCE(uh.view_count, 0) * 0.6 +
      CASE 
        WHEN DATEDIFF(NOW(), COALESCE(uh.last_viewed_at, '1970-01-01')) < 7 THEN 40
        WHEN DATEDIFF(NOW(), COALESCE(uh.last_viewed_at, '1970-01-01')) < 30 THEN 20
        ELSE 0 
      END
    ) as view_score`);
    orderByClause = "ORDER BY view_score DESC";
  } else {  // 默认为热度排序
    selectFields.push(`(
      CAST(NULLIF(REGEXP_REPLACE(a.popularity, '[^0-9]', ''), '') AS DECIMAL(10,0)) * 0.4 +
      CAST(COALESCE(a.comment_count, 0) AS DECIMAL(10,0)) * 0.3 +
      COALESCE(
        (SELECT SUM(view_count) FROM user_attraction_history WHERE attraction_id = a.id),
        0
      ) * 0.3
    ) as hot_score`);
    orderByClause = "ORDER BY hot_score DESC";
  }

  if (category && category !== "all") {
    whereConditions.push("a.category = ?");
    queryParams.push(category);
  }

  let sql = `SELECT ${selectFields.join(', ')} ${fromClause} ${joinClause}`;
  if (whereConditions.length > 0) {
    sql += ` WHERE ${whereConditions.join(' AND ')}`;
  }
  sql += ` ${orderByClause}`;

  db.query(sql, queryParams, (err, results) => {
    if (err) return callback(err);
    results = results.map(processAttractionData);
    callback(null, results);
  });
};

// 获取推荐景点
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
        (CAST(a.aaa_rating AS DECIMAL(3,1)) / 5) * 0.3 + 
        COALESCE(up.avg_category_rating / 5, 0.5) * 0.4 + 
        LEAST(COALESCE(up.category_visit_count / 10, 0), 1) * 0.3
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
        CAST(aaa_rating AS DECIMAL(3,1)) as rating_val,
        price_level,
        duration
      FROM attractions
      WHERE id = ?
    )
    SELECT 
      a.*,
      a.aaa_rating,
      a.popularity,
      (
        CASE WHEN a.category = ta.category THEN 0.4 ELSE 0 END +
        (1 - ABS(CAST(a.aaa_rating AS DECIMAL(3,1)) - ta.rating_val) / 5) * 0.3 +
        (1 - ABS(COALESCE(a.price_level, 0) - COALESCE(ta.price_level, 0)) / 4) * 0.2 +
        (1 - ABS(COALESCE(a.duration, 0) - COALESCE(ta.duration, 0)) / 480) * 0.1
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
    // 按热度（popularity）降序，然后按评分（rating）降序排序
    const fuzzySql = "SELECT id, name, rating, popularity FROM attractions WHERE name LIKE ? ORDER BY CAST(popularity AS DECIMAL(10,0)) DESC, rating DESC LIMIT 10";
    db.query(fuzzySql, [`%${name}%`], (err, fuzzyResults) => {
      if (err) return callback(err);

      if (fuzzyResults && fuzzyResults.length > 0) {
        // 找到模糊匹配项
        return callback(null, { matchType: 'fuzzy', attractions: fuzzyResults });
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
      CAST(NULLIF(REGEXP_REPLACE(a.popularity, '[^0-9]', ''), '') AS DECIMAL(10,0)) * 0.4 +
      CAST(COALESCE(a.comment_count, 0) AS DECIMAL(10,0)) * 0.3 +
      COALESCE(
        (SELECT SUM(view_count) FROM user_attraction_history WHERE attraction_id = a.id),
        0
      ) * 0.3
    ) as ranking_score`
  ];
  
  let fromClause = "FROM attractions a";
  let joinClause = "";
  const queryParams = [name];
  
  if (userId) {
    joinClause += ` LEFT JOIN user_attraction_ratings ur ON a.id = ur.attraction_id AND ur.user_id = ?`;
    queryParams.push(userId);
    joinClause += ` LEFT JOIN user_attraction_history uh ON a.id = uh.attraction_id AND uh.user_id = ?`;
    queryParams.push(userId);
    
    selectFields.push("COALESCE(ur.rating, 0) as user_rating_val");
    selectFields.push("COALESCE(uh.view_count, 0) as user_views_val");
    selectFields.push("COALESCE(uh.last_viewed_at, '1970-01-01') as last_viewed_val");
  }

  const sql = `
    SELECT ${selectFields.join(', ')}
    ${fromClause}
    ${joinClause}
    WHERE a.name LIKE CONCAT('%', ?, '%')
    ORDER BY ranking_score DESC
    LIMIT 10
  `;

  db.query(sql, queryParams, (err, results) => {
    if (err) return callback(err);
    results = results.map(processAttractionData);
    callback(null, results);
  });
};
