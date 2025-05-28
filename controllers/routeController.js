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
const { computeShortestPath } = require("../services/dijkstraService");

async function getRoute(req, res) {
  const fromName = req.query.from;
  const toName = req.query.to;
  if (!fromName || !toName) {
    return res.status(400).json({ error: "必须提供 from 和 to 参数" });
  }

  // 1. 获取所有节点和按名索引
  const { all: nodes, byName } = await getAllNodes();

  // 2. 使用正则表达式进行模糊匹配查找起终点
  const findMatchingNode = (name) => {
    // 创建不区分大小写的正则表达式
    const regex = new RegExp(name, 'i');
    // 查找所有匹配的节点
    const matches = nodes.filter(node => regex.test(node.name));

    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    // 如果有多个匹配，尝试找到最精确的匹配
    const exactMatch = matches.find(node => node.name.toLowerCase() === name.toLowerCase());
    return exactMatch || matches[0]; // 返回精确匹配或第一个匹配项
  };

  const fromNode = findMatchingNode(fromName);
  const toNode = findMatchingNode(toName);

  if (!fromNode || !toNode) {
    const errors = [];
    if (!fromNode) errors.push(`找不到匹配的起点: ${fromName}`);
    if (!toNode) errors.push(`找不到匹配的终点: ${toName}`);
    return res.status(404).json({
      error: errors.join("; "),
      suggestions: {
        from: fromNode ? null : nodes.filter(n => n.name.toLowerCase().includes(fromName.toLowerCase())).map(n => n.name).slice(0, 5),
        to: toNode ? null : nodes.filter(n => n.name.toLowerCase().includes(toName.toLowerCase())).map(n => n.name).slice(0, 5)
      }
    });
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

  res.json({
    path,
    matchedNames: {
      from: fromNode.name,
      to: toNode.name
    }
  });
}

module.exports = { getRoute };