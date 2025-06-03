// controllers/attractionController.js
const Attraction = require("../models/attractionModel");
const UserPreference = require("../models/userPreferenceModel");

exports.explore = (req, res, next) => {
  const category = req.query.category || "all";
  const sort = req.query.sort || "hot";
  const userId = req.session?.user?.id || null;

  // 获取主列表景点
  Attraction.getAttractions(category, sort, userId, (err, attractions) => {
    if (err) return next(err);

    // 如果用户已登录，获取推荐景点
    if (userId) {
      Attraction.getRecommendedAttractions(userId, 5, (err, recommendedAttractions) => {
        if (err) return next(err);

        renderExplorerPage(res, attractions, recommendedAttractions, category, sort, req.session.user);
      });
    } else {
      renderExplorerPage(res, attractions, [], category, sort, null);
    }
  });
};

// 获取景点详情
exports.getDetail = (req, res, next) => {
  const attractionId = req.params.id;
  const userId = req.session?.user?.id || null;

  // 获取景点详情
  Attraction.getAttractionById(attractionId, userId, (err, attraction) => {
    if (err) return next(err);
    
    if (!attraction) {
      return res.status(404).render('error', {
        message: '未找到该景点',
        error: { status: 404 }
      });
    }

    // 如果用户已登录，记录浏览历史
    if (userId) {
      UserPreference.recordAttractionView(userId, attractionId, (err) => {
        if (err) return next(err);
        
        // 获取相似景点推荐
        Attraction.getSimilarAttractions(attractionId, 5, (err, similarAttractions) => {
          if (err) return next(err);
          
          renderDetailPage(res, attraction, similarAttractions, req.session.user);
        });
      });
    } else {
      // 获取相似景点推荐
      Attraction.getSimilarAttractions(attractionId, 5, (err, similarAttractions) => {
        if (err) return next(err);
        
        renderDetailPage(res, attraction, similarAttractions, null);
      });
    }
  });
};

// 辅助函数：渲染探索页面
function renderExplorerPage(res, attractions, recommendedAttractions, category, sort, currentUser) {
  res.render("attraction-explorer", {
    attractions,
    recommendedAttractions,
    currentCategory: category,
    currentSort: sort,
    currentUser,
    helpers: {
      formatNumber: (num) => {
        if (num >= 10000) return (num / 10000).toFixed(1) + "万";
        return num.toString();
      },
    },
  });
}

// 辅助函数：渲染详情页面
function renderDetailPage(res, attraction, similarAttractions, currentUser) {
  res.render("attraction-detail", {
    attraction,
    similarAttractions,
    currentUser,
    helpers: {
      formatNumber: (num) => {
        if (num >= 10000) return (num / 10000).toFixed(1) + "万";
        return num.toString();
      },
    },
  });
}

// 用户对景点评分
exports.rateAttraction = (req, res, next) => {
  const attractionId = req.params.id;
  const userId = req.session?.user?.id;
  const { rating } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, message: "用户未登录" }); 
  }

  if (!rating || isNaN(parseFloat(rating)) || parseFloat(rating) < 0 || parseFloat(rating) > 5) {
    return res.status(400).json({ success: false, message: "无效的评分值" });
  }

  UserPreference.saveAttractionRating(userId, attractionId, parseFloat(rating), (err, result) => {
    if (err) {
      console.error("Error saving attraction rating:", err);
      return res.status(500).json({ success: false, message: "保存评分失败" });
    }
    res.json({ success: true, message: "评分已保存" }); 
  });
};

// 搜索景点
exports.searchAttraction = (req, res, next) => {
  const { name } = req.query;
  const userId = req.session?.user?.id || null;

  if (!name) {
    return res.status(400).json({ success: false, message: "缺少搜索关键词" });
  }

  Attraction.searchAttractionsByNameWithRanking(name, userId, (err, attractions) => {
    if (err) return next(err);
    if (!attractions || attractions.length === 0) {
      return res.status(404).json({ success: false, message: "未找到相关景点" });
    }
    res.json({ 
      success: true, 
      attractions: attractions.map(attraction => ({
        id: attraction.id,
        name: attraction.name,
        description: attraction.description,
        image_url: attraction.image_url,
        rating: attraction.rating,
        popularity: attraction.popularity,
        comment_count: attraction.comment_count,
        view_count: attraction.view_count,
        ranking_score: attraction.ranking_score,
        user_rating: attraction.user_rating,
        user_views: attraction.user_views
      }))
    });
  });
};
