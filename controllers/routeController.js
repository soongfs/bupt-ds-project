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

// Helper function to calculate path distance given node IDs and edges
function calculatePathDistance(pathNodeIds, edges) {
  if (!pathNodeIds || pathNodeIds.length < 2) {
    return 0;
  }
  let distance = 0;

  for (let i = 0; i < pathNodeIds.length - 1; i++) {
    const u = pathNodeIds[i].toString();
    const v = pathNodeIds[i + 1].toString();
    // Find the edge between u and v
    const edge = edges.find(
      (e) =>
        (e.from_node.toString() === u && e.to_node.toString() === v) ||
        (e.from_node.toString() === v && e.to_node.toString() === u)
    );
    if (edge) {
      distance += edge.length;
    } else {
      // This case should ideally not happen if computeShortestPath returns a valid path based on these edges
      console.warn(`Edge not found between ${u} and ${v} for distance calculation.`);
      // Fallback or error handling - for now, let's assume edges are always found for valid paths
      // Or, if a path segment is just one node (start=end), its length is 0.
      // But computeShortestPath should return at least [startId] if startId=endId.
    }
  }
  return distance;
}

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
  const fromName = req.query.from;
  const toName = req.query.to;
  if (!fromName || !toName) {
    return res.status(400).json({ error: "必须提供 from 和 to 参数" });
  }

  try {
    const { all: nodes, byName } = await getAllNodes();
    const edges = await getAllEdges();

    const findMatchingNode = (name) => {
      const regex = new RegExp(name, 'i');
      const matches = nodes.filter(node => regex.test(node.name));
      if (matches.length === 0) return null;
      if (matches.length === 1) return matches[0];
      const exactMatch = matches.find(node => node.name.toLowerCase() === name.toLowerCase());
      return exactMatch || matches[0];
    };

    const fromNode = findMatchingNode(fromName);
    const toNode = findMatchingNode(toName);

    if (!fromNode || !toNode) {
      const errors = [];
      if (!fromNode) errors.push(`找不到匹配的起点: ${fromName}`);
      if (!toNode) errors.push(`找不到匹配的终点: ${toName}`);
      const suggestions = {
        from: fromNode ? null : nodes.filter(n => n.name.toLowerCase().includes(fromName.toLowerCase())).map(n => n.name).slice(0, 5),
        to: toNode ? null : nodes.filter(n => n.name.toLowerCase().includes(toName.toLowerCase())).map(n => n.name).slice(0, 5)
      };
      return res.status(404).json({
        error: errors.join("; "),
        suggestions
      });
    }

    const pathIds = await computeShortestPath(
      fromNode.node_id,
      toNode.node_id,
      nodes,
      edges
    );

    if (!pathIds || pathIds.length === 0) {
      // If start and end node are the same, pathIds might be just [node_id]
      if (fromNode.node_id === toNode.node_id) {
        const path = [{ node_id: fromNode.node_id, lat: fromNode.lat, lon: fromNode.lon, name: fromNode.name }];
        return res.json({
          path,
          totalDistance: 0,
          matchedNames: {
            from: fromNode.name,
            to: toNode.name
          }
        });
      }
      return res.status(404).json({ error: "无可达路径" });
    }

    const totalDistance = calculatePathDistance(pathIds, edges);

    const path = pathIds.map((id) => {
      const n = nodes.find((x) => x.node_id === id);
      return { node_id: id, lat: n.lat, lon: n.lon, name: n.name };
    });

    res.json({
      path,
      totalDistance,
      matchedNames: {
        from: fromNode.name,
        to: toNode.name
      }
    });
  } catch (error) {
    console.error("Error in getRoute:", error);
    res.status(500).json({ error: "服务器内部错误，获取路径失败" });
  }
}

async function getMultiStopRoute(req, res) {
  const { startPointName, waypointNames, endPointName } = req.body;

  if (!startPointName || !waypointNames || !endPointName || !Array.isArray(waypointNames)) {
    return res.status(400).json({ error: "必须提供 startPointName, waypointNames (数组), 和 endPointName" });
  }

  try {
    const { all: nodes, byName } = await getAllNodes();
    const edges = await getAllEdges();

    const findNodeByName = (name) => {
      const regex = new RegExp(name, 'i');
      const matches = nodes.filter(node => regex.test(node.name));
      if (matches.length === 0) return null;
      if (matches.length === 1) return matches[0];
      const exactMatch = matches.find(node => node.name.toLowerCase() === name.toLowerCase());
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
    
    // Handle cases with very few unique points (e.g. start=A, waypoints=[], end=A)
    const allPointObjects = [startNode, ...waypointNodes, endNode];
    const uniqueNodeIds = [...new Set(allPointObjects.map(n => n.node_id))];

    if (uniqueNodeIds.length <= 1) {
        const singleNode = nodes.find(n => n.node_id === uniqueNodeIds[0]);
        if (singleNode) {
            return res.json({
                path: [{ node_id: singleNode.node_id, lat: singleNode.lat, lon: singleNode.lon, name: singleNode.name }],
                totalDistance: 0,
                matchedNames: {
                    start: startNode.name,
                    waypoints: waypointNodes.map(n => n.name),
                    end: endNode.name
                }
            });
        } else { // Should not happen if nodes were found initially
             return res.status(404).json({ error: "无法解析单点路径的节点" });
        }
    }


    let refinedMinPathCoords = [];
    let minTotalDistance = Infinity;

    const actualWaypointsForPermutation = waypointNodes.filter(
        (wn) => wn.node_id !== startNode.node_id || wn.node_id !== endNode.node_id // this logic seems a bit off
                                                                                // It should be unique waypoints not overlapping with start/end IF start/end are distinct
                                                                                // If start=A, end=A, waypoints=[B,C], permute [B,C]
                                                                                // If start=A, end=A, waypoints=[A,B,C,A], permute [B,C] (effectively)
    );
     // A better way for `actualWaypointsForPermutation`:
     // These are the nodes that must be visited *between* start and end.
     // We need to ensure we are permuting the *unique* waypoint nodes that are not the start or end node if start and end are part of the "journey"
     // but for TSP, we usually define a set of cities to visit, starting from one and ending at another (or same).
     // Let's assume waypointNodes are the distinct places to visit *in addition* to start and end.
     // And the problem asks for start -> waypoints -> end.

    const uniqueWaypointNodesForPermutation = [...new Set(waypointNodes.map(w => w.node_id))]
        .map(id => waypointNodes.find(w => w.node_id === id))
        .filter(wn => wn.node_id !== startNode.node_id && wn.node_id !== endNode.node_id);


    if (uniqueWaypointNodesForPermutation.length === 0) { // Direct path from start to end, or start -> (nodes that are start/end) -> end
        const pathIds = await computeShortestPath(startNode.node_id, endNode.node_id, nodes, edges);
        if (pathIds && pathIds.length > 0) {
            minTotalDistance = calculatePathDistance(pathIds, edges);
            refinedMinPathCoords = pathIds.map(id => {
                const n = nodes.find((x) => x.node_id === id);
                return { node_id: id, lat: n.lat, lon: n.lon, name: n.name };
            });
        } else if (startNode.node_id === endNode.node_id) { // If start and end are same, no waypoints in between, path is just the point
            minTotalDistance = 0;
            refinedMinPathCoords = [{ node_id: startNode.node_id, lat: startNode.lat, lon: startNode.lon, name: startNode.name}];
        }
         else {
            return res.status(404).json({ error: `无法规划从 ${startPointName} 到 ${endPointName} 的直接路径` });
        }
    } else {
        const waypointPermutations = permute(uniqueWaypointNodesForPermutation);

        for (const perm of waypointPermutations) {
            let currentFullPathNodeObjects = [];
            let currentTotalPathDistance = 0;
            let pathPossible = true;
            let lastVisitedNode = startNode;

            // 1. Start to first waypoint in permutation
            let segmentPathIds = await computeShortestPath(lastVisitedNode.node_id, perm[0].node_id, nodes, edges);
            if (!segmentPathIds) { pathPossible = false; continue; } // No path to first waypoint
            currentTotalPathDistance += calculatePathDistance(segmentPathIds, edges);
            currentFullPathNodeObjects.push(...segmentPathIds.slice(0, -1).map(id => nodes.find(n=>n.node_id === id)));
            lastVisitedNode = perm[0];
            
            // 2. Between waypoints in permutation
            for (let i = 0; i < perm.length - 1; i++) {
                segmentPathIds = await computeShortestPath(lastVisitedNode.node_id, perm[i+1].node_id, nodes, edges);
                if (!segmentPathIds) { pathPossible = false; break; }
                currentTotalPathDistance += calculatePathDistance(segmentPathIds, edges);
                currentFullPathNodeObjects.push(...segmentPathIds.slice(0, -1).map(id => nodes.find(n=>n.node_id === id)));
                lastVisitedNode = perm[i+1];
            }
            if (!pathPossible) continue;

            // 3. Last waypoint in permutation to End
            segmentPathIds = await computeShortestPath(lastVisitedNode.node_id, endNode.node_id, nodes, edges);
            if (!segmentPathIds) { pathPossible = false; continue; }
            currentTotalPathDistance += calculatePathDistance(segmentPathIds, edges);
            // Add all nodes of the last segment, including the endNode
            currentFullPathNodeObjects.push(...segmentPathIds.map(id => nodes.find(n=>n.node_id === id))); 

            if (pathPossible && currentTotalPathDistance < minTotalDistance) {
                minTotalDistance = currentTotalPathDistance;
                refinedMinPathCoords = currentFullPathNodeObjects.map(n => ({ node_id: n.node_id, lat: n.lat, lon: n.lon, name: n.name }));
            }
        }
    }

    if (refinedMinPathCoords.length === 0 && !(startNode.node_id === endNode.node_id && uniqueWaypointNodesForPermutation.length === 0)) {
      return res.status(404).json({ error: "无法规划经过所有指定途经点的有效路径" });
    }
    
    // Ensure the final path is not empty, even for start=end case handled earlier for direct path
    if (refinedMinPathCoords.length === 0 && startNode.node_id === endNode.node_id && uniqueWaypointNodesForPermutation.length === 0) {
        refinedMinPathCoords = [{ node_id: startNode.node_id, lat: startNode.lat, lon: startNode.lon, name: startNode.name}];
        minTotalDistance = 0;
    }


    res.json({
      path: refinedMinPathCoords,
      totalDistance: minTotalDistance,
      matchedNames: {
        start: startNode.name,
        waypoints: waypointNodes.map(n => n.name), // original requested waypoints
        end: endNode.name,
      }
    });

  } catch (error) {
    console.error("Error in getMultiStopRoute:", error);
    res.status(500).json({ error: "服务器内部错误，路径规划失败" });
  }
}

module.exports = { getRoute, getMultiStopRoute };