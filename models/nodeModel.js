// models/nodeModel.js
const db = require("../config/dbConfig");

async function getAllNodes() {
  try {
    const [rows] = await db.query(
      "SELECT node_id, name, lat, lon, is_facility, category FROM nodes"
    );
    
    const mapByName = new Map();
    rows.forEach((r) => mapByName.set(r.name, r));
    
    return { all: rows, byName: mapByName };
  } catch (err) {
    console.error("Error in getAllNodes model:", err);
    throw err;
  }
}

module.exports = {
  getAllNodes
};
