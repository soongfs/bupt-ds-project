// models/nodeModel.js
const db = require("../config/dbConfig");

async function getAllNodes() {
  const [rows] = await db.query("SELECT node_id, name, lat, lon, is_facility, category FROM nodes");
  // 构建一个 Map: name -> node object
  const mapByName = new Map();
  rows.forEach((r) => mapByName.set(r.name, r));
  return { all: rows, byName: mapByName };
}

module.exports = { getAllNodes };
