const foodModel = require("../models/foodModel");
const { getAllNodes } = require("../models/nodeModel");
const { getAllEdges } = require("../models/edgeModel");
const { computeShortestPath } = require("../services/astarService");

const DEFAULT_FOOD_SEARCH_LIMIT = 10; // Default number of food items to return if distance sorting is primary

async function searchFood(req, res) {
  const {
    sourceNodeName, // User's current location name
    cuisine_type,   // Filter by cuisine
    name,           // Fuzzy search for food name
    restaurant_name, // Fuzzy search for restaurant name
    window_name,     // Fuzzy search for window name
    sortBy = "popularity_score", // Default sort: popularity_score, rating_score, average_price, distance
    sortOrder = "DESC", // ASC or DESC
    limit = DEFAULT_FOOD_SEARCH_LIMIT, // Max results
    offset = 0, // For pagination
  } = req.body;

  if (sortBy === "distance" && !sourceNodeName) {
    return res.status(400).json({
      error: "进行距离排序时，必须提供源位置名称 (sourceNodeName)。",
    });
  }

  try {
    const { all: allNodes, byName: nodesByName } = await getAllNodes();
    const allEdges = await getAllEdges();

    let sourceNode = null;
    if (sourceNodeName) {
      // Use a similar robust name matching as in routeController
      const findMatchingNode = (sName, nodesArr) => {
        const regex = new RegExp(sName, 'i');
        const matches = nodesArr.filter(node => node.name && regex.test(node.name));
        if (matches.length === 0) return null;
        if (matches.length === 1) return matches[0];
        const exactMatch = matches.find(node => node.name && node.name.toLowerCase() === sName.toLowerCase());
        return exactMatch || matches[0]; // Prioritize exact match, then first fuzzy match
      };
      sourceNode = findMatchingNode(sourceNodeName, allNodes);
      if (!sourceNode) {
        return res.status(404).json({ error: `找不到源位置: ${sourceNodeName}` });
      }
    }

    // Build a map for quick node lookup by ID
    const nodesById = new Map();
    allNodes.forEach(node => nodesById.set(node.node_id, node));

    // 1. Get initial food items based on non-distance filters and sorting
    // If sorting by distance, we might fetch more initially to sort them later.
    // Otherwise, the database can handle sorting and limiting.
    const initialLimit = sortBy === "distance" ? 50 : parseInt(limit, 10); // Fetch more if we sort by distance in app layer
    
    const foodItems = await foodModel.getFoodItems({
      filters: { 
        cuisine_type, 
        keyword: name, // Pass the 'name' from request body (intended as general keyword) as 'keyword' filter
        // restaurant_name, // These are now covered by the keyword search in foodModel
        // window_name 
      },
      sortBy: { field: sortBy === "distance" ? "popularity_score" : sortBy, order: sortOrder }, // Initial sort by DB if not distance
      limit: initialLimit,
      offset: parseInt(offset, 10),
    });

    if (!foodItems || foodItems.length === 0) {
      return res.json({
        message: "未找到符合条件的美食。",
        results: [],
        sourceNode: sourceNode ? { name: sourceNode.name, lat: sourceNode.lat, lon: sourceNode.lon } : null,
      });
    }

    // 2. Enhance with location details and calculate path distance if sourceNode is provided
    const foodItemsWithDetails = [];
    for (const item of foodItems) {
      const locationNode = nodesById.get(item.node_id);
      if (!locationNode) {
        console.warn(`Food item ${item.name} (ID: ${item.id}) references non-existent node_id: ${item.node_id}. Skipping.`);
        continue;
      }

      const itemWithDetails = {
        ...item,
        location: {
          node_id: locationNode.node_id,
          name: locationNode.name,
          lat: locationNode.lat,
          lon: locationNode.lon,
        },
        distance: null, // To be filled
        // path_to_food: null // Optional: path details
      };

      if (sourceNode) {
        // Ensure sourceNode.node_id and locationNode.node_id are valid before path calculation
        if (sourceNode.node_id === locationNode.node_id) {
            itemWithDetails.distance = 0;
        } else {
            const pathResult = await computeShortestPath(
              sourceNode.node_id,
              locationNode.node_id,
              allNodes,
              allEdges,
              "distance" // Always use 'distance' strategy for calculating actual distance to food
            );
            if (pathResult && typeof pathResult.totalActualDistance === 'number') {
              itemWithDetails.distance = pathResult.totalActualDistance;
              // itemWithDetails.path_to_food = pathResult.pathNodeIds; // Optionally add path
            } else {
              // Could not find path, treat distance as Infinity for sorting, or skip
              itemWithDetails.distance = Infinity; 
              console.warn(`Could not calculate path from ${sourceNode.name} to ${locationNode.name} for food ${item.name}`);
            }
        }
      }
      foodItemsWithDetails.push(itemWithDetails);
    }
    
    // Filter out items with Infinity distance if sourceNode was provided (meaning no path found)
    let finalResults = sourceNode ? foodItemsWithDetails.filter(item => item.distance !== Infinity) : foodItemsWithDetails;


    // 3. Sort by distance if requested (and sourceNode was provided)
    if (sortBy === "distance" && sourceNode) {
      finalResults.sort((a, b) => {
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1; // items without distance go last
        if (b.distance === null) return -1; // items without distance go last
        return (sortOrder === "ASC" ? a.distance - b.distance : b.distance - a.distance);
      });
    }
    // If not sorting by distance, results are already sorted by DB or default.

    // 4. Apply limit *after* distance sorting
    if (sortBy === "distance" || finalResults.length > parseInt(limit, 10)) {
        finalResults = finalResults.slice(0, parseInt(limit, 10));
    }


    res.json({
      results: finalResults,
      sourceNode: sourceNode ? { name: sourceNode.name, lat: sourceNode.lat, lon: sourceNode.lon, node_id: sourceNode.node_id } : null,
      query: { sourceNodeName, cuisine_type, name, restaurant_name, window_name, sortBy, sortOrder, limit, offset }
    });

  } catch (error) {
    console.error("Error in searchFood controller:", error);
    res.status(500).json({ error: "服务器内部错误，美食搜索失败。" });
  }
}

module.exports = {
  searchFood,
}; 