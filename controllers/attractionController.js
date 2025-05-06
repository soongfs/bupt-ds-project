// controllers/attractionController.js
const Attraction = require("../models/attractionModel");

exports.explore = async (req, res, next) => {
  try {
    const category = req.query.category || "all";
    const sort = req.query.sort || "hot";
    const attractions = await Attraction.getAttractions(category, sort);
    res.render("attraction-explorer", {
      attractions,
      currentCategory: category,
      currentSort: sort,
      helpers: {
        formatNumber: (num) => {
          if (num >= 10000) return (num / 10000).toFixed(1) + "万";
          return num.toString();
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
