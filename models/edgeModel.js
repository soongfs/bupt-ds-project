// models/edgeModel.js
const db = require("../config/dbConfig");

function getAllEdges(callback) {
  db.query("SELECT from_node, to_node, length FROM edges", (err, rows) => {
    if (err) {
      return callback(err);
    }
    callback(null, rows);
  });
}

module.exports = {
  getAllEdges
};
