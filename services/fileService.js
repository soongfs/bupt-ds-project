// services/fileService.js
const path = require("path");
const fs = require("fs");

exports.ensureUploadDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

exports.getUniqueFilename = (prefix, originalname) =>
  prefix + "-" + Date.now() + path.extname(originalname);
