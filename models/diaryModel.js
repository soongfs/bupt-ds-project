// models/diaryModel.js
const db = require("../config/dbConfig");

module.exports = {
  // 创建新日记，返回插入 ID
  createDiary: async ({
    user_id,
    title,
    content,
    status,
    cover_image,
    categories,
  }) => {
    const sql = `
      INSERT INTO travel_diaries
        (user_id, title, content, like_count, comment_count, status, cover_image, categories)
      VALUES (?, ?, ?, 0, 0, ?, ?, ?)
    `;
    const params = [user_id, title, content, status, cover_image, categories];
    const [result] = await db.query(sql, params);
    return result.insertId;
  },

  // 根据 ID 获取日记
  getDiaryById: async (id) => {
    const sql = `
      SELECT d.*, u.username, u.avatar
      FROM travel_diaries d
      JOIN user_information u ON d.user_id = u.id
      WHERE d.id = ?
    `;
    const [rows] = await db.query(sql, [id]);
    return rows[0];
  },

  // 更新日记任意字段, data 是一个对象，如 { title, content, status }
  updateDiary: async (id, data) => {
    // 自动拼接 SET 子句
    const fields = Object.keys(data)
      .map((k) => `${k} = ?`)
      .join(", ");
    const params = [...Object.values(data), id];
    const sql = `UPDATE travel_diaries SET ${fields} WHERE id = ?`;
    await db.query(sql, params);
  },

  // 点赞：把 like_count +1
  incrementLike: async (id) => {
    const sql = `
      UPDATE travel_diaries
      SET like_count = like_count + 1
      WHERE id = ?
    `;
    await db.query(sql, [id]);
  },
};
