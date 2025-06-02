const db = require('../config/test-database');

module.exports = {
  // 获取用户的统计信息
  getUserStats: (userId, callback) => {
    const sql = `
      SELECT 
        COUNT(*) as diaries_count,
        SUM(view_count) as total_views,
        SUM(like_count) as total_likes
      FROM travel_diaries 
      WHERE user_id = ? AND status = 2
    `;
    
    db.query(sql, [userId], (err, results) => {
      if (err) {
        console.error('获取用户统计信息失败:', err);
        return callback(err);
      }
      
      const stats = {
        diariesCount: results[0].diaries_count || 0,
        totalViews: results[0].total_views || 0,
        totalLikes: results[0].total_likes || 0,
        followers: 0, // TODO: 添加关注者统计
        following: 0  // TODO: 添加关注数统计
      };
      
      callback(null, stats);
    });
  },

  // 获取用户的游记列表
  getUserDiaries: (userId, limit = 10, offset = 0, callback) => {
    const sql = `
      SELECT 
        id,
        title,
        content,
        like_count,
        comment_count,
        status,
        cover_image,
        categories,
        created_at,
        view_count,
        location,
        duration,
        tags
      FROM travel_diaries 
      WHERE user_id = ? AND status = 2
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    db.query(sql, [userId, limit, offset], (err, diaries) => {
      if (err) {
        console.error('获取用户游记列表失败:', err);
        return callback(err);
      }

      const formattedDiaries = diaries.map(diary => ({
        ...diary,
        categories: diary.categories ? diary.categories.split(',') : [],
        tags: diary.tags ? JSON.parse(diary.tags) : []
      }));

      callback(null, formattedDiaries);
    });
  }
}; 