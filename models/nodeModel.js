// models/nodeModel.js
const db = require("../config/dbConfig");

function getAllNodes(callback) {
  db.query("SELECT node_id, name, lat, lon, is_facility, category FROM nodes", (err, rows) => {
    if (err) {
      return callback(err);
    }
    // 构建一个 Map: name -> node object
    const mapByName = new Map();
    rows.forEach((r) => mapByName.set(r.name, r));
    callback(null, { all: rows, byName: mapByName });
  });
}

module.exports = {
  getAllNodes
};
