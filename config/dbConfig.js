// config/dbConfig.js
require("dotenv").config();
const mysql = require("mysql2");

// const pool = mysql
//   .createPool({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASS,
//     database: process.env.DB_NAME,
//     waitForConnections: true,
//     connectionLimit: 10,
//   })
//   .promise();

// module.exports = pool;

const pool = mysql.createPool({
  host: "152.136.239.207",
  user: "webuser",
  password: "}@)]72aMbPn5",
  database: "pathfinder",
  waitForConnections: true,
  connectionLimit: 10,
}).promise();

module.exports = pool;
