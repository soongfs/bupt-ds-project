const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'webuser',
    password: '}@)]72aMbPn5',
    database: 'tourism_db'
});

module.exports = db;
