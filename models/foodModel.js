const db = require("../config/dbConfig");

/**
 * Retrieves a list of food items based on filters and sorting criteria.
 * Distance-based sorting is handled in the controller after path calculations.
 * @param {object} filters - Filtering options (e.g., { cuisine_type: "川菜", keyword: "鸡" })
 * @param {object} sortBy - Sorting options (e.g., { field: "popularity_score", order: "DESC" })
 * @param {number} limit - Max number of items to return
 * @param {number} offset - Number of items to skip (for pagination)
 * @param {function} callback - Callback function(error, results)
 */
function getFoodItems({ filters = {}, sortBy = { field: "popularity_score", order: "DESC" }, limit = 50, offset = 0 } = {}, callback) {
  let query = "SELECT * FROM restaurants_dishes";
  const queryParams = [];
  const whereClauses = [];

  // Apply specific filters first
  if (filters.cuisine_type) {
    whereClauses.push("cuisine_type LIKE ?");
    queryParams.push(`%${filters.cuisine_type}%`);
  }

  // Apply keyword filter across multiple fields (name, restaurant_name, window_name)
  if (filters.keyword) {
    const keywordClause = "(name LIKE ? OR restaurant_name LIKE ? OR window_name LIKE ?)";
    whereClauses.push(keywordClause);
    queryParams.push(`%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`);
  }
  
  // Note: The previous individual filters for name, restaurant_name, window_name are now covered by 'keyword'
  // If you need separate, AND-ed filters for those, they would need to be distinct from 'keyword'

  if (whereClauses.length > 0) {
    query += " WHERE " + whereClauses.join(" AND ");
  }

  // Apply sorting (excluding distance, which is handled later)
  if (sortBy && sortBy.field && sortBy.field !== 'distance') {
    const validSortFields = ["name", "restaurant_name", "cuisine_type", "popularity_score", "rating_score", "average_price"];
    if (validSortFields.includes(sortBy.field)) {
      query += ` ORDER BY ${db.escapeId(sortBy.field)} ${sortBy.order === "ASC" ? "ASC" : "DESC"}`;
    } else {
      console.warn(`Invalid sort field provided to getFoodItems: ${sortBy.field}`);
      query += ` ORDER BY popularity_score DESC`;
    }
  } else if (!sortBy || !sortBy.field) { // Default sort if no sort object or field is provided
    query += ` ORDER BY popularity_score DESC`;
  }

  // Apply limit and offset for pagination
  query += " LIMIT ? OFFSET ?";
  queryParams.push(parseInt(limit, 10) || 50, parseInt(offset, 10) || 0);

  // console.log("Executing food query:", query, queryParams); // For debugging
  db.query(query, queryParams, (err, rows) => {
    if (err) {
      console.error("Error fetching food items from DB:", err);
      return callback(err);
    }
    callback(null, rows);
  });
}

// Potential future function if needed
// async function getFoodItemById(id) {
//   const [rows] = await db.query("SELECT * FROM restaurants_dishes WHERE id = ?", [id]);
//   return rows[0];
// }

module.exports = {
  getFoodItems,
  // getFoodItemById,
}; 