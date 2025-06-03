// // controllers/routeController.js
// const { getAllNodes } = require("../models/nodeModel");
// const { getAllEdges } = require("../models/edgeModel");
// const { computeShortestPath } = require("../services/dijkstraService");

// async function getRoute(req, res) {
//   const fromName = req.query.from;
//   const toName = req.query.to;
//   if (!fromName || !toName) {
//     return res.status(400).json({ error: "必须提供 from 和 to 参数" });
//   }

//   // 1. 获取所有节点和按名索引
//   const { all: nodes, byName } = await getAllNodes();
//   // 2. 查找起终点
//   const fromNode = byName.get(fromName);
//   const toNode = byName.get(toName);
//   if (!fromNode || !toNode) {
//     return res.status(404).json({ error: "起点或终点名称不存在" });
//   }

//   // 3. 获取所有边
//   const edges = await getAllEdges();

//   // 4. 计算最短路径
//   const pathIds = await computeShortestPath(
//     fromNode.node_id,
//     toNode.node_id,
//     nodes,
//     edges
//   );
//   if (!pathIds) {
//     return res.status(404).json({ error: "无可达路径" });
//   }

//   // 5. 构造带经纬度的路径数组
//   const path = pathIds.map((id) => {
//     const n = nodes.find((x) => x.node_id === id);
//     return { node_id: id, lat: n.lat, lon: n.lon };
//   });

//   res.json({ path });
// }



// module.exports = { getRoute };
// controllers/routeController.js
const { getAllNodes } = require("../models/nodeModel");
const { getAllEdges } = require("../models/edgeModel");
// const { computeShortestPath } = require("../services/dijkstraService");
// 改用astar
const { computeShortestPath } = require("../services/astarService");

const WALKING_SPEED = 1.2; // m/s, approx 4.32 km/h
const BICYCLE_SPEED = 4.0; // m/s, approx 14.4 km/h

// Helper function to find permutations of an array
function permute(arr) {
  const result = [];
  const backtrack = (index, currentPermutation) => {
    if (index === arr.length) {
      result.push([...currentPermutation]);
      return;
    }
    for (let i = 0; i < arr.length; i++) {
      if (!currentPermutation.includes(arr[i])) { // Ensure element is not already used, simplistic for unique elements
        currentPermutation.push(arr[i]);
        backtrack(index + 1, currentPermutation);
        currentPermutation.pop();
      }
    }
  };
    // Correction for permutation generation:
    // The above backtrack has a flaw in how it ensures elements are not reused and progresses.
    // A more standard way to generate permutations:
    const permuteHelper = (currentArr, remainingArr) => {
        if (remainingArr.length === 0) {
            result.push(currentArr);
            return;
        }
        for (let i = 0; i < remainingArr.length; i++) {
            const nextCurrentArr = currentArr.concat(remainingArr[i]);
            const nextRemainingArr = remainingArr.slice(0, i).concat(remainingArr.slice(i + 1));
            permuteHelper(nextCurrentArr, nextRemainingArr);
        }
    };
    permuteHelper([], arr);
    return result;
}

async function getRoute(req, res) {
  const { from: fromName, to: toName, strategy = "distance" } = req.query;

  if (!fromName || !toName) {
    return res.status(400).json({ error: "必须提供 from 和 to 参数" });
  }

  try {
    const { all: nodes } = await getAllNodes();
    const edges = await getAllEdges();

    const findMatchingNode = (name) => {
      const regex = new RegExp(name, 'i');
      const matches = nodes.filter(node => node.name && regex.test(node.name));
      if (matches.length === 0) return null;
      if (matches.length === 1) return matches[0];
      const exactMatch = matches.find(node => node.name && node.name.toLowerCase() === name.toLowerCase());
      return exactMatch || matches[0];
    };

    const fromNode = findMatchingNode(fromName);
    const toNode = findMatchingNode(toName);

    if (!fromNode || !toNode) {
      const errors = [];
      if (!fromNode) errors.push(`找不到匹配的起点: ${fromName}`);
      if (!toNode) errors.push(`找不到匹配的终点: ${toName}`);
      const suggestions = {
        from: fromNode ? null : nodes.filter(n => n.name && n.name.toLowerCase().includes(fromName.toLowerCase())).map(n => n.name).slice(0, 5),
        to: toNode ? null : nodes.filter(n => n.name && n.name.toLowerCase().includes(toName.toLowerCase())).map(n => n.name).slice(0, 5)
      };
      return res.status(404).json({ error: errors.join("; "), suggestions });
    }

    const result = await computeShortestPath(
      fromNode.node_id,
      toNode.node_id,
      nodes,
      edges,
      strategy
    );

    if (!result || !result.pathNodeIds || result.pathNodeIds.length === 0) {
      if (fromNode.node_id === toNode.node_id) {
        const path = [{ node_id: fromNode.node_id, lat: fromNode.lat, lon: fromNode.lon, name: fromNode.name }];
        return res.json({
          path,
          totalDistance: 0,
          totalTime: 0,
          strategy,
          matchedNames: { from: fromNode.name, to: toNode.name }
        });
      }
      return res.status(404).json({ error: "无可达路径" });
    }

    const { pathNodeIds, totalCost, totalActualDistance } = result;

    const path = pathNodeIds.map((id) => {
      const n = nodes.find((x) => x.node_id === id);
      return { node_id: id, lat: n.lat, lon: n.lon, name: n.name };
    });

    let totalTime = 0;
    if (strategy === "time_walk") {
      totalTime = totalCost; // For time_walk, totalCost is already time-like (length * congestion)
      // To convert this to actual seconds, we might need to divide by WALKING_SPEED if totalCost is not already in time units.
      // Assuming totalCost for time_walk IS effectively (length * congestion), representing a weighted distance.
      // Time = (Weighted Distance) / Speed. If A* cost is already time, then this is fine.
      // Let's assume astarService for time_walk returns totalCost as sum(length * congestion).
      // So, time = sum(length * congestion) / WALKING_SPEED - this seems more consistent.
      // However, if astarService's weight IS ALREADY time, then totalTime = totalCost.
      // Given the current astar weight `length * congestion`, this is a weighted distance.
      // So, time should be `totalCost / WALKING_SPEED`.
      totalTime = totalCost / WALKING_SPEED; 

    } else if (strategy === "time_bike") {
      // Similar to time_walk, totalCost is sum(length * congestion)
      totalTime = totalCost / BICYCLE_SPEED;

    } else { // distance strategy or fallback
      // For "distance" strategy, totalActualDistance is the pure geometric distance.
      // We need to calculate the time along THIS path considering congestion for walking.
      let congestedTimeForDistancePath = 0;
      for (let i = 0; i < pathNodeIds.length - 1; i++) {
        const uNodeId = pathNodeIds[i];
        const vNodeId = pathNodeIds[i + 1];
        // Find the edge in allEdges. Edges are bidirectional in astarService's adj list construction, 
        // but allEdges is the original list.
        const edge = edges.find(
          (e) =>
            (e.from_node === uNodeId && e.to_node === vNodeId) ||
            (e.to_node === uNodeId && e.from_node === vNodeId)
        );
        if (edge) {
          const edgeLength = edge.length;
          const edgeCongestion = (edge.congestion !== null && typeof edge.congestion === 'number') ? edge.congestion : 1.0;
          congestedTimeForDistancePath += (edgeLength * edgeCongestion) / WALKING_SPEED;
        } else {
          // Fallback if edge not found (should not happen for a valid path)
          // Or, if a segment of the path was from nodeModel directly (e.g. start=end)
          // This part needs to be robust.
          // For now, let's assume edges are found.
        }
      }
      // If the path was just a single point (start=end), pathNodeIds.length is 1, loop won't run.
      if (pathNodeIds.length <= 1 && totalActualDistance === 0) {
        totalTime = 0; // No travel time if start and end are the same
      } else {
        totalTime = congestedTimeForDistancePath;
      }
    }

    res.json({
      path,
      totalDistance: totalActualDistance, // actual geometric distance
      totalTime: Math.round(totalTime), // seconds, rounded
      strategy,
      rawCost: totalCost, // For debugging or internal use
      matchedNames: { from: fromNode.name, to: toNode.name }
    });

  } catch (error) {
    console.error(`Error in getRoute (strategy: ${strategy}):`, error);
    res.status(500).json({ error: "服务器内部错误，获取路径失败" });
  }
}

async function getMultiStopRoute(req, res) {
  const { startPointName, waypointNames, endPointName, strategy = "distance" } = req.body;

  if (!startPointName || !waypointNames || !endPointName || !Array.isArray(waypointNames)) {
    return res.status(400).json({ error: "必须提供 startPointName, waypointNames (数组), 和 endPointName" });
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

    const startNode = findNodeByName(startPointName);
    const endNode = findNodeByName(endPointName);
    const waypointNodes = waypointNames.map(name => findNodeByName(name));

    if (!startNode) return res.status(404).json({ error: `找不到起点: ${startPointName}` });
    if (!endNode) return res.status(404).json({ error: `找不到终点: ${endPointName}` });
    const missingWaypointIndices = waypointNodes.reduce((acc, node, index) => {
      if (!node) acc.push(index);
      return acc;
    }, []);
    if (missingWaypointIndices.length > 0) {
      const missingNames = missingWaypointIndices.map(index => waypointNames[index]);
      return res.status(404).json({ error: `找不到以下途经点: ${missingNames.join(', ')}` });
    }

    const allPointObjects = [startNode, ...waypointNodes, endNode];
    const uniqueNodeIds = [...new Set(allPointObjects.map(n => n.node_id))];

    if (uniqueNodeIds.length <= 1) {
      const singleNode = nodes.find(n => n.node_id === uniqueNodeIds[0]);
      if (singleNode) {
        return res.json({
          path: [{ node_id: singleNode.node_id, lat: singleNode.lat, lon: singleNode.lon, name: singleNode.name }],
          totalDistance: 0,
          totalTime: 0,
          strategy,
          matchedNames: { start: startNode.name, waypoints: waypointNodes.map(n => n.name), end: endNode.name }
        });
      }
      return res.status(404).json({ error: "无法解析单点路径的节点" });
    }

    let bestOverallPathCoords = [];
    let minOverallCostForStrategy = Infinity;
    let totalActualDistanceForBestPath = 0;

    const uniqueWaypointNodesForPermutation = [...new Set(waypointNodes.map(w => w.node_id))]
      .map(id => waypointNodes.find(w => w.node_id === id))
      .filter(wn => wn.node_id !== startNode.node_id && wn.node_id !== endNode.node_id);

    if (uniqueWaypointNodesForPermutation.length === 0) {
      const result = await computeShortestPath(startNode.node_id, endNode.node_id, nodes, edges, strategy);
      if (result && result.pathNodeIds && result.pathNodeIds.length > 0) {
        minOverallCostForStrategy = result.totalCost;
        totalActualDistanceForBestPath = result.totalActualDistance;
        bestOverallPathCoords = result.pathNodeIds.map(id => {
          const n = nodes.find((x) => x.node_id === id);
          return { node_id: id, lat: n.lat, lon: n.lon, name: n.name };
        });
      } else if (startNode.node_id === endNode.node_id) {
        minOverallCostForStrategy = 0;
        totalActualDistanceForBestPath = 0;
        bestOverallPathCoords = [{ node_id: startNode.node_id, lat: startNode.lat, lon: startNode.lon, name: startNode.name }];
      } else {
        return res.status(404).json({ error: `无法规划从 ${startPointName} 到 ${endPointName} 的直接路径 (策略: ${strategy})` });
      }
    } else {
      const waypointPermutations = permute(uniqueWaypointNodesForPermutation);
      for (const perm of waypointPermutations) {
        let currentPermutationPathCoords = [];
        let currentPermutationTotalCost = 0;
        let currentPermutationTotalActualDistance = 0;
        let pathPossible = true;
        let lastVisitedNodeInPermutation = startNode;

        // 1. Start to first waypoint in permutation
        let segmentResult = await computeShortestPath(lastVisitedNodeInPermutation.node_id, perm[0].node_id, nodes, edges, strategy);
        if (!segmentResult || !segmentResult.pathNodeIds) { pathPossible = false; continue; }
        currentPermutationTotalCost += segmentResult.totalCost;
        currentPermutationTotalActualDistance += segmentResult.totalActualDistance;
        currentPermutationPathCoords.push(...segmentResult.pathNodeIds.slice(0, -1).map(id => nodes.find(n => n.node_id === id)));
        lastVisitedNodeInPermutation = perm[0];

        // 2. Between waypoints in permutation
        for (let i = 0; i < perm.length - 1; i++) {
          segmentResult = await computeShortestPath(lastVisitedNodeInPermutation.node_id, perm[i + 1].node_id, nodes, edges, strategy);
          if (!segmentResult || !segmentResult.pathNodeIds) { pathPossible = false; break; }
          currentPermutationTotalCost += segmentResult.totalCost;
          currentPermutationTotalActualDistance += segmentResult.totalActualDistance;
          currentPermutationPathCoords.push(...segmentResult.pathNodeIds.slice(0, -1).map(id => nodes.find(n => n.node_id === id)));
          lastVisitedNodeInPermutation = perm[i + 1];
        }
        if (!pathPossible) continue;

        // 3. Last waypoint in permutation to End
        segmentResult = await computeShortestPath(lastVisitedNodeInPermutation.node_id, endNode.node_id, nodes, edges, strategy);
        if (!segmentResult || !segmentResult.pathNodeIds) { pathPossible = false; continue; }
        currentPermutationTotalCost += segmentResult.totalCost;
        currentPermutationTotalActualDistance += segmentResult.totalActualDistance;
        currentPermutationPathCoords.push(...segmentResult.pathNodeIds.map(id => nodes.find(n => n.node_id === id)));

        if (pathPossible && currentPermutationTotalCost < minOverallCostForStrategy) {
          minOverallCostForStrategy = currentPermutationTotalCost;
          totalActualDistanceForBestPath = currentPermutationTotalActualDistance;
          bestOverallPathCoords = currentPermutationPathCoords.map(n => ({ node_id: n.node_id, lat: n.lat, lon: n.lon, name: n.name }));
        }
      }
    }

    if (bestOverallPathCoords.length === 0 && !(startNode.node_id === endNode.node_id && uniqueWaypointNodesForPermutation.length === 0)) {
      return res.status(404).json({ error: `无法规划经过所有指定途经点的有效路径 (策略: ${strategy})` });
    }
    if (bestOverallPathCoords.length === 0 && startNode.node_id === endNode.node_id && uniqueWaypointNodesForPermutation.length === 0) {
      bestOverallPathCoords = [{ node_id: startNode.node_id, lat: startNode.lat, lon: startNode.lon, name: startNode.name }];
      minOverallCostForStrategy = 0;
      totalActualDistanceForBestPath = 0;
    }

    let totalTime = 0;
    if (strategy === "time_walk") {
      totalTime = minOverallCostForStrategy / WALKING_SPEED;
    } else if (strategy === "time_bike") {
      totalTime = minOverallCostForStrategy / BICYCLE_SPEED;
    } else { // distance strategy or fallback
      totalTime = totalActualDistanceForBestPath / WALKING_SPEED;
    }

    res.json({
      path: bestOverallPathCoords,
      totalDistance: totalActualDistanceForBestPath,
      totalTime: Math.round(totalTime),
      strategy,
      rawCost: minOverallCostForStrategy, // For debugging or internal use
      matchedNames: { start: startNode.name, waypoints: waypointNodes.map(n => n.name), end: endNode.name }
    });

  } catch (error) {
    console.error(`Error in getMultiStopRoute (strategy: ${strategy}):`, error);
    res.status(500).json({ error: "服务器内部错误，多点路径规划失败" });
  }
}

module.exports = { getRoute, getMultiStopRoute };