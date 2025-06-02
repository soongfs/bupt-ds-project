// services/astarService.js
// const { Graph } = require("graphlib"); // graphlib 似乎没有实际使用，可以考虑移除

/**
 * 计算启发式估价：使用节点的经纬度（lon, lat）
 * @param {{lat: number, lon: number}} a
 * @param {{lat: number, lon: number}} b
 * @param {string} strategy - The routing strategy.
 * @param {object} nodes - All nodes, potentially for strategy-specific heuristic adjustments.
 * @param {object} edges - All edges, potentially for strategy-specific heuristic adjustments.
 * @returns {number}
 */
function heuristic(a, b, strategy, nodes, edges) { // Heuristic might need adjustment based on strategy for optimality
  const dx = a.lon - b.lon;
  const dy = a.lat - b.lat;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // For time-based strategies, the heuristic should ideally estimate time.
  // This is a simplification; a better heuristic would use average (speed / congestion).
  // If strategy involves time, and weights are length*congestion, heuristic should reflect that.
  // For now, we keep it as distance-based, which is admissible if edge costs are always >= direct distance.
  return distance; 
}

/**
 * 基于 A* 算法计算最短路径
 * @param {number|string} startId 起点 ID
 * @param {number|string} endId 终点 ID
 * @param {Array<{node_id: number|string, name: string, lat: number, lon: number}>} allNodes 节点列表
 * @param {Array<{from_node: number|string, to_node: number|string, length: number, congestion?: number, isCycleable?: boolean}>} allEdges 边列表
 * @param {string} strategy - "distance", "time_walk", "time_bike"
 * @returns {{pathNodeIds: Array<number>|null, totalCost: number, totalActualDistance: number} | null}
 */
async function computeShortestPath(startId, endId, allNodes, allEdges, strategy = "distance") {
  const adj = new Map();
  const coordMap = new Map();
  const edgeDetailsMap = new Map(); // To store full edge details for distance calculation later: key "u-v"

  allNodes.forEach((n) => {
    const id = n.node_id.toString();
    coordMap.set(id, { lat: n.lat, lon: n.lon });
    // adj.set(id, []); // Initialize later if needed, or with Map for weighted edges
  });

  allEdges.forEach((edge) => {
    const u = edge.from_node.toString();
    const v = edge.to_node.toString();
    const length = edge.length;
    // Ensure congestion is a number, default to 1.0 if null or undefined
    const congestion = (edge.congestion !== null && typeof edge.congestion === 'number') ? edge.congestion : 1.0;
    
    // Correctly interpret isCycleable from DB (0 or 1) to boolean
    // Default to true for non-bike strategies if undefined/null, default to false for bike strategy if undefined/null
    let isCycleable;
    if (edge.isCycleable === null || typeof edge.isCycleable === 'undefined') {
        isCycleable = strategy === "time_bike" ? false : true;
    } else {
        isCycleable = !!edge.isCycleable; // Converts 0 to false, 1 (or any non-zero) to true
    }

    let weight;
    let actualEdgeData = { from: u, to: v, length: length, congestion: congestion, isCycleable: isCycleable };
    
    if (strategy === "time_bike" && !isCycleable) {
      // For bike strategy, if not cycleable, simply don't add this edge to the graph for this direction
      // No 'return' here, as it would skip adding the reverse edge if it's two-way and cycleable
    } else {
      switch (strategy) {
        case "time_walk":
          weight = length * congestion; 
          break;
        case "time_bike":
          // This case is now only hit if isCycleable is true
          weight = length * congestion; 
          break;
        case "distance":
        default:
          weight = length; 
          break;
      }

      if (!adj.has(u)) adj.set(u, new Map()); 
      adj.get(u).set(v, { weight, originalEdge: actualEdgeData });
      
      // Assuming edges are bidirectional for routing unless specified otherwise
      // If an edge is not cycleable for bikes, it applies to both directions
      if (!adj.has(v)) adj.set(v, new Map());
      adj.get(v).set(u, { weight, originalEdge: actualEdgeData }); 
    }

    const edgeKey1 = `${u}-${v}`;
    const edgeKey2 = `${v}-${u}`;
    if (!edgeDetailsMap.has(edgeKey1)) edgeDetailsMap.set(edgeKey1, actualEdgeData);
    if (!edgeDetailsMap.has(edgeKey2)) edgeDetailsMap.set(edgeKey2, actualEdgeData);
  });

  const start = startId.toString();
  const goal = endId.toString();
  
  if (!coordMap.has(start) || !coordMap.has(goal)) {
      console.error("Start or goal node not found in coordMap. Nodes available:", Array.from(coordMap.keys()));
      return null; 
  }
  if (!adj.has(start)) {
    console.error(`Start node ${start} has no outgoing edges based on the selected strategy.`);
    return null;
  }

  const openSet = new Set([start]);
  const cameFrom = {}; 
  const gScore = new Map(); 
  const fScore = new Map(); 

  allNodes.forEach((n) => {
    const id = n.node_id.toString();
    gScore.set(id, Infinity);
    fScore.set(id, Infinity);
  });

  gScore.set(start, 0);
  fScore.set(start, heuristic(coordMap.get(start), coordMap.get(goal), strategy, allNodes, allEdges));

  while (openSet.size > 0) {
    let current = null;
    let minF = Infinity;
    openSet.forEach((nodeId) => {
      const score = fScore.get(nodeId);
      if (score < minF) {
        minF = score;
        current = nodeId;
      }
    });

    if (current === null) { 
        console.error("A* Error: Current node is null, openSet might be empty or contain only Infinity fScores.");
        return null;
    }
    
    if (current === goal) {
      const pathNodeIdsStr = [];
      let temp = current;
      while (temp) {
        pathNodeIdsStr.push(temp);
        temp = cameFrom[temp];
      }
      const pathNodeIdsNum = pathNodeIdsStr.reverse().map((id) => parseInt(id, 10));
      
      let totalActualDistance = 0;
      for (let i = 0; i < pathNodeIdsNum.length - 1; i++) {
          const uNodeId = pathNodeIdsNum[i].toString();
          const vNodeId = pathNodeIdsNum[i+1].toString();
          const anEdge = edgeDetailsMap.get(`${uNodeId}-${vNodeId}`) || edgeDetailsMap.get(`${vNodeId}-${uNodeId}`);
          if (anEdge) {
              totalActualDistance += anEdge.length;
          } else {
              console.warn(`Edge not found in edgeDetailsMap between ${uNodeId} and ${vNodeId} for actual distance sum. Path segment may be invalid or data missing.`);
          }
      }
      
      return {
        pathNodeIds: pathNodeIdsNum,
        totalCost: gScore.get(goal),
        totalActualDistance: totalActualDistance
      };
    }

    openSet.delete(current);
    // Ensure 'current' node exists in 'adj' before trying to get its neighbors
    if (!adj.has(current)) {
        // This might happen if a node is isolated or only reachable via edges filtered out by strategy
        continue; 
    }
    const neighbors = adj.get(current); // neighbors is a Map of {neighborId: {weight, originalEdge}}

    neighbors.forEach((data, neighborId) => { 
      const edgeWeight = data.weight;
      const tentativeG = gScore.get(current) + edgeWeight;

      if (tentativeG < gScore.get(neighborId)) {
        cameFrom[neighborId] = current;
        gScore.set(neighborId, tentativeG);
        if (coordMap.has(neighborId) && coordMap.has(goal)) {
            fScore.set(neighborId, tentativeG + heuristic(coordMap.get(neighborId), coordMap.get(goal), strategy, allNodes, allEdges));
        } else {
            fScore.set(neighborId, tentativeG); 
        }
        openSet.add(neighborId);
      }
    });
  }
  console.log(`No path found from ${start} to ${goal} with strategy ${strategy}`);
  return null; 
}

module.exports = { computeShortestPath };
