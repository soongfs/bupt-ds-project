// services/dijkstraService.js
const { Graph, alg } = require("graphlib");

async function computeShortestPath(startId, endId, nodes, edges) {
  // 构建有向图
  const g = new Graph({ directed: true });
  nodes.forEach((n) => g.setNode(n.node_id.toString()));
  edges.forEach((e) => {
    g.setEdge(e.from_node.toString(), e.to_node.toString(), e.length);
    // 如果是双向图，可同时添加反向边：
    g.setEdge(e.to_node.toString(), e.from_node.toString(), e.length);
  });

  // Dijkstra
  const result = alg.dijkstra(g, startId.toString(), (edge) => g.edge(edge));
  // 回溯路径
  const path = [];
  let cursor = endId.toString();
  if (!result[cursor] || result[cursor].distance === Infinity) {
    return null;
  }
  while (cursor !== undefined) {
    path.push(cursor);
    cursor = result[cursor].predecessor;
  }
  path.reverse(); // 从起点到终点
  return path.map((id) => parseInt(id, 10));
}

module.exports = { computeShortestPath };
