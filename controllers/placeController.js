const { getAllNodes } = require("../models/nodeModel");
const { getAllEdges } = require("../models/edgeModel");
const { computeShortestPath } = require("../services/astarService");

const DEFAULT_SEARCH_RADIUS = 500; // Default search radius in meters, e.g., 500m

/**
 * Finds nearby facilities/places based on a source location, categories, and radius.
 * Sorts results by actual path distance.
 */
async function findNearbyPlaces(req, res) {
  const { 
    sourceNodeName, 
    categories, // Array of category strings, e.g., ["超市", "卫生间"]
    customCategory, // Single string for user-input category
    searchRadius = DEFAULT_SEARCH_RADIUS 
  } = req.body;

  if (!sourceNodeName) {
    return res.status(400).json({ error: "必须提供源地点名称 (sourceNodeName)。" });
  }

  try {
    const { all: nodes } = await getAllNodes();
    const edges = await getAllEdges();

    const findNodeByName = (name) => {
      const regex = new RegExp(name, 'i');
      const matches = nodes.filter(node => node.name && regex.test(node.name));
      if (matches.length === 0) return null;
      if (matches.length === 1) return matches[0];
      const exactMatch = matches.find(node => node.name && node.name.toLowerCase() === name.toLowerCase());
      return exactMatch || matches[0];
    };

    const sourceNode = findNodeByName(sourceNodeName);
    if (!sourceNode) {
      return res.status(404).json({ error: `找不到源地点: ${sourceNodeName}` });
    }

    let targetCategories = [];
    if (categories && Array.isArray(categories) && categories.length > 0) {
      targetCategories = categories.map(cat => cat.trim().toLowerCase());
    }
    if (customCategory && typeof customCategory === 'string' && customCategory.trim() !== "") {
      targetCategories.push(customCategory.trim().toLowerCase());
    }
    // Remove duplicates if any
    if (targetCategories.length > 0) {
        targetCategories = [...new Set(targetCategories)];
    }


    const potentialPlaces = nodes.filter(node => 
      node.is_facility && // Check the new boolean/tinyint field
      (targetCategories.length === 0 || (node.category && targetCategories.includes(node.category.toLowerCase()))) && // Filter by category if specified
      node.node_id !== sourceNode.node_id // Exclude the source node itself
    );

    if (potentialPlaces.length === 0) {
      return res.json({ 
        message: "在指定类别中没有找到符合条件的场所。", 
        places: [],
        sourceNode: { name: sourceNode.name, lat: sourceNode.lat, lon: sourceNode.lon}
      });
    }

    const nearbyPlacesWithPath = [];

    for (const place of potentialPlaces) {
      // Calculate path from sourceNode to this place using "distance" strategy
      const pathResult = await computeShortestPath(
        sourceNode.node_id,
        place.node_id,
        nodes,
        edges,
        "distance" // Always use shortest actual distance for finding nearby places
      );

      if (pathResult && pathResult.pathNodeIds && pathResult.totalActualDistance <= searchRadius) {
        nearbyPlacesWithPath.push({
          node_id: place.node_id,
          name: place.name,
          category: place.category,
          lat: place.lat,
          lon: place.lon,
          distance: pathResult.totalActualDistance, // Actual path distance
          // path_to_place: pathResult.pathNodeIds, // Optionally include path IDs
        });
      }
    }

    // Sort places by actual path distance
    nearbyPlacesWithPath.sort((a, b) => a.distance - b.distance);

    res.json({
      places: nearbyPlacesWithPath,
      sourceNode: { name: sourceNode.name, lat: sourceNode.lat, lon: sourceNode.lon, node_id: sourceNode.node_id },
      searchCriteria: { sourceNodeName, categories, customCategory, searchRadius }
    });

  } catch (error) {
    console.error("Error in findNearbyPlaces:", error);
    res.status(500).json({ error: "查找附近场所时发生服务器内部错误。" });
  }
}

module.exports = {
  findNearbyPlaces,
}; 