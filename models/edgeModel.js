// models/edgeModel.js
const db = require("../config/dbConfig");

async function getAllEdges() {
  const [rows] = await db.query("SELECT from_node, to_node, length FROM edges");
  return rows;
}

module.exports = { getAllEdges };
