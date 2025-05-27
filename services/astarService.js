// services/astarService.js
const { Graph } = require("graphlib");

/**
 * 计算启发式估价：使用节点的经纬度（lon, lat）
 * @param {{lat: number, lon: number}} a
 * @param {{lat: number, lon: number}} b
 * @returns {number}
 */
function heuristic(a, b) {
  const dx = a.lon - b.lon;
  const dy = a.lat - b.lat;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 基于 A* 算法计算最短路径，与 dijkstraService 接口保持一致
 * @param {number|string} startId 起点 ID
 * @param {number|string} endId 终点 ID
 * @param {Array<{node_id: number|string, name: string, lat: number, lon: number}>} nodes 节点列表
 * @param {Array<{from_node: number|string, to_node: number|string, length: number}>} edges 边列表
 * @returns {Array<number>} 路径上的节点 ID 顺序数组，未找到返回 null
 */
async function computeShortestPath(startId, endId, nodes, edges) {
  // 构建邻接表和坐标映射
  const adj = new Map();
  const coordMap = new Map();
  nodes.forEach((n) => {
    const id = n.node_id.toString();
    coordMap.set(id, { lat: n.lat, lon: n.lon });
    adj.set(id, []);
  });
  edges.forEach((e) => {
    const u = e.from_node.toString();
    const v = e.to_node.toString();
    const w = e.length;
    if (!adj.has(u)) adj.set(u, []);
    adj.get(u).push({ to: v, weight: w });
    // 双向图
    if (!adj.has(v)) adj.set(v, []);
    adj.get(v).push({ to: u, weight: w });
  });

  const start = startId.toString();
  const goal = endId.toString();
  // A* 初始化
  const openSet = new Set([start]);
  const cameFrom = {};
  const gScore = new Map();
  const fScore = new Map();
  nodes.forEach((n) => {
    const id = n.node_id.toString();
    gScore.set(id, Infinity);
    fScore.set(id, Infinity);
  });
  gScore.set(start, 0);
  fScore.set(start, heuristic(coordMap.get(start), coordMap.get(goal)));

  while (openSet.size > 0) {
    // 选出 fScore 最小的节点
    let current = null;
    let minF = Infinity;
    openSet.forEach((nodeId) => {
      const score = fScore.get(nodeId);
      if (score < minF) {
        minF = score;
        current = nodeId;
      }
    });
    if (current === goal) {
      // 重建路径
      const path = [];
      let u = current;
      while (u) {
        path.push(u);
        u = cameFrom[u];
      }
      return path.reverse().map((id) => parseInt(id, 10));
    }
    openSet.delete(current);
    const neighbors = adj.get(current) || [];
    neighbors.forEach(({ to: neighbor, weight }) => {
      const tentativeG = gScore.get(current) + weight;
      if (tentativeG < gScore.get(neighbor)) {
        cameFrom[neighbor] = current;
        gScore.set(neighbor, tentativeG);
        fScore.set(
          neighbor,
          tentativeG + heuristic(coordMap.get(neighbor), coordMap.get(goal))
        );
        openSet.add(neighbor);
      }
    });
  }

  return null;
}

module.exports = { computeShortestPath };
