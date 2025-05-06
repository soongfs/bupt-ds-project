// models/commentModel.js
const db = require("../config/dbConfig");

module.exports = {
  // 添加一条评论，传入 diary_id, user_id, content
  addComment: async ({ diary_id, user_id, content }) => {
    const sql = `
      INSERT INTO comments
        (diary_id, comment_user_id, content)
      VALUES (?, ?, ?)
    `;
    const [result] = await db.query(sql, [diary_id, user_id, content]);
    return result.insertId;
  },

  // （可选）获取某日记的所有评论
  getCommentsByDiary: async (diary_id) => {
    const sql = `
      SELECT c.*, u.username, u.avatar
      FROM comments c
      JOIN user_information u ON c.comment_user_id = u.id
      WHERE c.diary_id = ?
      ORDER BY c.created_at DESC
    `;
    const [rows] = await db.query(sql, [diary_id]);
    return rows;
  },
};
