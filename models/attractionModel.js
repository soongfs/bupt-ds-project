// models/attractionModel.js
const db = require("../config/dbConfig");

exports.getAttractions = (category, sort) => {
  let sql = "SELECT * FROM attractions";
  const params = [];
  if (category && category !== "all") {
    sql += " WHERE category = ?";
    params.push(category);
  }
  if (sort === "rating") sql += " ORDER BY rating DESC";
  else if (sort === "distance") sql += " ORDER BY distance ASC";
  else sql += " ORDER BY comment_count DESC";
  return db.query(sql, params).then(([rows]) => rows);
};
