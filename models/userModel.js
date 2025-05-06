// models/userModel.js
const db = require("../config/dbConfig");

exports.findByUsername = (username) =>
  db
    .query("SELECT * FROM user_information WHERE username = ? LIMIT 1", [
      username,
    ])
    .then(([rows]) => rows[0]);

exports.create = ({ username, email, password }) =>
  db.query(
    "INSERT INTO user_information (username, email, password) VALUES (?, ?, ?)",
    [username, email, password]
  );

exports.findById = (id) =>
  db
    .query("SELECT * FROM user_information WHERE id = ?", [id])
    .then(([rows]) => rows[0]);

exports.update = (id, data) =>
  db.query("UPDATE user_information SET ? WHERE id = ?", [data, id]);
