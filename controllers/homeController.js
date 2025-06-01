const db = require('../config/test-database');

const homeController = {
    getHomePage: (req, res) => {
        console.log("try to load in index");
        console.log("当前会话用户:", req.session.user);

        // 使用连接池查询，通过回调处理结果
        db.query(`
            SELECT d.*, u.username, u.email, u.avatar
            FROM travel_diaries d
            JOIN user_information u ON d.user_id = u.id
            -- ORDER BY d.id DESC
            LIMIT 6
        `, (error, results) => {
            if (error) {
                console.error('Error fetching diaries:', error);
                return res.status(500).render('error', {
                    message: '服务器错误，请稍后再试',
                    error: process.env.NODE_ENV === 'development' ? error : null
                });
            }

            // 格式化数据
            const formattedDiaries = results.map(diary => ({
                ...diary,
                like_count: diary.like_count >= 1000 ? `${(diary.like_count / 1000).toFixed(1)}k` : diary.like_count,
                comment_count: diary.comment_count >= 1000 ? `${(diary.comment_count / 1000).toFixed(1)}k` : diary.comment_count,
                badge: diary.like_count > 1000 ? '🔥 热门' :
                    diary.like_count > 500 ? '🌟 精选' : '🆕 最新'
            }));

            if (req.session.user) {
                db.query(
                    'SELECT avatar FROM user_information WHERE id = ?',
                    [req.session.user.id],
                    (userError, userResults) => {
                        const userWithAvatar = {
                            ...req.session.user,
                            avatar: userResults[0]?.avatar || null
                        };
                        console.log("当前会话用户:", userWithAvatar);
                        res.render('index', {
                            diaries: formattedDiaries,
                            user: userWithAvatar
                        });
                    }
                );
            } else {
                res.render('index', {
                    diaries: formattedDiaries,
                    user: null
                });
            }
        });
    }
};

module.exports = homeController;