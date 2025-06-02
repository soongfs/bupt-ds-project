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
  let orderByClause = "ORDER BY CAST(a.popularity AS DECIMAL(10,0)) DESC"; // Default

  if (userId) {
    // Always join user tables if userId is present, simplifies logic and makes data available
    joinClause += ` LEFT JOIN user_attraction_ratings ur ON a.id = ur.attraction_id AND ur.user_id = ?`;
    queryParams.push(userId);
    joinClause += ` LEFT JOIN user_attraction_history uh ON a.id = uh.attraction_id AND uh.user_id = ?`;
    queryParams.push(userId);

    // Add fields for user rating, views, last_viewed, using aliases to avoid conflicts
    selectFields.push("COALESCE(ur.rating, 0) as user_rating_val");
    selectFields.push("COALESCE(uh.view_count, 0) as user_views_val");
    selectFields.push("COALESCE(uh.last_viewed_at, '1970-01-01') as last_viewed_val");
  }

  if (sort === 'personalized' && userId) {
    selectFields.push(`(
        COALESCE(ur.rating, 0) * 0.4 + 
        (CAST(a.aaa_rating AS DECIMAL(3,1)) / 5) * 0.3 +
        LEAST(COALESCE(uh.view_count, 0) / 5, 1) * 0.2 +
        CASE WHEN DATEDIFF(NOW(), COALESCE(uh.last_viewed_at, '1970-01-01')) < 30 THEN 0.1 ELSE 0 END
      ) as preference_score`);
    selectFields.push(`(
        SELECT COALESCE(AVG(r2.rating), 0)
        FROM user_attraction_ratings r2
        JOIN attractions a2 ON r2.attraction_id = a2.id
        WHERE r2.user_id = ? AND a2.category = a.category
      ) as category_preference`);
    queryParams.push(userId); // For category_preference subquery
    orderByClause = "ORDER BY category_preference DESC, preference_score DESC, CAST(a.aaa_rating AS DECIMAL(3,1)) DESC";
  } else if (sort === "rating") {
    orderByClause = "ORDER BY CAST(a.aaa_rating AS DECIMAL(3,1)) DESC";
  } else if (sort === "distance") {
    orderByClause = "ORDER BY CAST(a.distance AS DECIMAL(10,2)) ASC";
  } else if (sort === 'my_ratings' && userId) {
    orderByClause = "ORDER BY user_rating_val DESC, CAST(a.aaa_rating AS DECIMAL(3,1)) DESC";
  } else if (sort === 'my_views' && userId) {
    orderByClause = "ORDER BY user_views_val DESC, last_viewed_val DESC, CAST(a.aaa_rating AS DECIMAL(3,1)) DESC";
  } // Default is popularity (hot)

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
    
    // The user_rating, user_views, and last_viewed are now directly populated by processAttractionData
    // using the _val aliases if userId was present. No separate userData query needed here anymore.
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
