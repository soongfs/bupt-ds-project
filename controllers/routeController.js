// controllers/routeController.js
const { getAllNodes } = require("../models/nodeModel");
const { getAllEdges } = require("../models/edgeModel");
// const { computeShortestPath } = require("../services/dijkstraService");
// 改用astar
const { computeShortestPath } = require("../services/astarService");

async function getRoute(req, res) {
  const fromName = req.query.from;
  const toName = req.query.to;
  if (!fromName || !toName) {
    return res.status(400).json({ error: "必须提供 from 和 to 参数" });
  }

  // 1. 获取所有节点和按名索引
  const { all: nodes, byName } = await getAllNodes();
  // 2. 查找起终点
  const fromNode = byName.get(fromName);
  const toNode = byName.get(toName);
  if (!fromNode || !toNode) {
    return res.status(404).json({ error: "起点或终点名称不存在" });
  }

  // 3. 获取所有边
  const edges = await getAllEdges();

  // 4. 计算最短路径
  const pathIds = await computeShortestPath(
    fromNode.node_id,
    toNode.node_id,
    nodes,
    edges
  );
  if (!pathIds) {
    return res.status(404).json({ error: "无可达路径" });
  }

  // 5. 构造带经纬度的路径数组
  const path = pathIds.map((id) => {
    const n = nodes.find((x) => x.node_id === id);
    return { node_id: id, lat: n.lat, lon: n.lon };
  });

  res.json({ path });
}

module.exports = { getRoute };
