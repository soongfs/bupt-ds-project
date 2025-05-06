// 初始化地图
const map = new TMap.Map(document.getElementById("map-container"), {
  center: new TMap.LatLng(39.96, 116.36),
  zoom: 16,
  pitch: 30,
  rotation: 0,
});
let currentPolyline = null;
let startMarker = null;
let endMarker = null;

document.getElementById("searchBtn").onclick = async () => {
  const fromName = document.getElementById("from").value.trim();
  const toName = document.getElementById("to").value.trim();
  if (!fromName || !toName) {
    alert("请填写起点和终点名称");
    return;
  }
  // 请求后端
  const res = await fetch(
    `/api/route?from=${encodeURIComponent(fromName)}&to=${encodeURIComponent(
      toName
    )}`
  );
  const data = await res.json();
  if (!data.path || data.path.length === 0) {
    alert(data.error || "未找到路径");
    return;
  }
  // 构造坐标
  const coords = data.path.map((p) => new TMap.LatLng(p.lat, p.lon));
  // 清除旧的线路与标记
  if (currentPolyline) currentPolyline.setMap(null);
  if (startMarker) startMarker.setMap(null);
  if (endMarker) endMarker.setMap(null);
  // 绘制路径
  currentPolyline = new TMap.MultiPolyline({
    map,
    styles: {
      routeStyle: new TMap.PolylineStyle({
        color: "#4CAF50",
        width: 6,
        borderWidth: 2,
        borderColor: "#FFFFFF",
      }),
    },
    geometries: [
      {
        id: "route",
        styleId: "routeStyle",
        paths: coords,
      },
    ],
  });
  // 添加起点和终点标记
  startMarker = new TMap.MultiMarker({
    map,
    styles: {
      startMarker: new TMap.MarkerStyle({
        width: 34,
        height: 34,
        anchor: { x: 17, y: 34 },
        src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerDefault.png",
      }),
    },
    geometries: [
      {
        id: "start",
        position: coords[0],
        styleId: "startMarker",
      },
    ],
  });
  endMarker = new TMap.MultiMarker({
    map,
    styles: {
      endMarker: new TMap.MarkerStyle({
        width: 34,
        height: 34,
        anchor: { x: 17, y: 34 },
        src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerRed.png",
      }),
    },
    geometries: [
      {
        id: "end",
        position: coords[coords.length - 1],
        styleId: "endMarker",
      },
    ],
  });
  // 调整视野到整个路径
  const bounds = coords.reduce(
    (b, pt) => b.extend(pt),
    new TMap.LatLngBounds()
  );
  map.fitBounds(bounds, { padding: 20 });

  // 更新路线信息（可按实际算法填充）
  const totalDist = data.path.slice(1).reduce((sum, p, i) => {
    const prev = data.path[i];
    const dx = prev.lat - p.lat;
    const dy = prev.lon - p.lon;
    return sum + Math.sqrt(dx * dx + dy * dy) * 111000; // 粗略换算米
  }, 0);
  document.getElementById("info-distance").innerText = `🗺️ 总距离：${(
    totalDist / 1000
  ).toFixed(2)} 公里`;
  document.getElementById(
    "info-time"
  ).innerText = `⏱️ 预计时间：步行 ${Math.ceil((totalDist / 1000) * 12)} 分钟`; // 假设 5km/h = 12min/km
  document.getElementById("info-via").innerText = `🚩 途径：${data.path
    .slice(1, -1)
    .map((p) => p.node_id)
    .join(" → ")}`;
};
