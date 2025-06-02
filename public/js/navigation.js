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
// Store waypoint markers if we decide to show them
let waypointMarkers = [];

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
  if (res.status !== 200 || !data.path || data.path.length === 0) {
    alert(data.error || "未找到路径");
    // Display suggestions if available
    if (data.suggestions) {
        let suggestionMessage = "建议的地点名称：\n";
        if (data.suggestions.from && data.suggestions.from.length > 0) {
            suggestionMessage += `起点 '${fromName}': ${data.suggestions.from.join(', ')}\n`;
        }
        if (data.suggestions.to && data.suggestions.to.length > 0) {
            suggestionMessage += `终点 '${toName}': ${data.suggestions.to.join(', ')}`;
        }
        alert(suggestionMessage);
    }
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
  document.getElementById("info-distance").innerText = `🗺️ 总距离：${(data.matchedNames ? (data.totalDistance !== undefined ? data.totalDistance / 1000 : (coords.length > 1 ? calculateRoughDistance(coords) / 1000 : 0)) : calculateRoughDistance(coords)/1000).toFixed(2)} 公里`;
  document.getElementById("info-time").innerText = `⏱️ 预计时间：步行 ${Math.ceil(((data.matchedNames ? (data.totalDistance !== undefined ? data.totalDistance / 1000 : (coords.length > 1 ? calculateRoughDistance(coords) / 1000 : 0)) : calculateRoughDistance(coords)/1000)) * 12)} 分钟`;
  document.getElementById("info-via").innerText = `🚩 起点: ${data.matchedNames ? data.matchedNames.from : fromName}, 终点: ${data.matchedNames ? data.matchedNames.to : toName}`;
};

// Helper function for rough distance calculation (used as fallback or for UI display consistency if backend doesn't send it for 2-point)
function calculateRoughDistance(coordsArray) {
    if (!coordsArray || coordsArray.length < 2) return 0;
    let totalDist = 0;
    for(let i=0; i < coordsArray.length - 1; i++) {
        // TMap.LatLng objects have getLat() and getLng()
        const lat1 = coordsArray[i].getLat();
        const lng1 = coordsArray[i].getLng();
        const lat2 = coordsArray[i+1].getLat();
        const lng2 = coordsArray[i+1].getLng();
        // Simple Haversine or spherical law of cosines approximation
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI/180; 
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lng2-lng1) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        totalDist += R * c; 
    }
    return totalDist; // in metres
}

document.getElementById("multiStopSearchBtn").onclick = async () => {
  const fromName = document.getElementById("from").value.trim();
  const waypointsString = document.getElementById("waypoints").value.trim();
  const toName = document.getElementById("to").value.trim();

  if (!fromName || !toName) {
    alert("请填写起点和终点名称");
    return;
  }

  const waypointNames = waypointsString === "" ? [] : waypointsString.split(",").map(name => name.trim()).filter(name => name !== "");

  // Request backend for multi-stop route
  try {
    const response = await fetch("/api/route/multi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startPointName: fromName,
        waypointNames: waypointNames,
        endPointName: toName,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.path || data.path.length === 0) {
      alert(data.error || "未找到多点路径或规划失败");
      return;
    }

    const coords = data.path.map((p) => new TMap.LatLng(p.lat, p.lon));

    // Clear old layers
    if (currentPolyline) currentPolyline.setMap(null);
    if (startMarker) startMarker.setMap(null);
    if (endMarker) endMarker.setMap(null);
    waypointMarkers.forEach(marker => marker.setMap(null));
    waypointMarkers = [];

    // Draw new polyline
    currentPolyline = new TMap.MultiPolyline({
      map,
      styles: {
        routeStyle: new TMap.PolylineStyle({
          color: "#FF0000", // Different color for multi-stop route
          width: 7,
          borderWidth: 2,
          borderColor: "#FFFFFF",
        }),
      },
      geometries: [
        {
          id: "multiRoute",
          styleId: "routeStyle",
          paths: coords,
        },
      ],
    });

    // Add start and end markers for the multi-stop route
    startMarker = new TMap.MultiMarker({
      map,
      styles: {
        startMarkerStyle: new TMap.MarkerStyle({
          width: 34, height: 34, anchor: { x: 17, y: 34 },
          src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerDefault.png", 
        }),
      },
      geometries: [{ id: "startMulti", styleId: "startMarkerStyle", position: coords[0] }],
    });

    endMarker = new TMap.MultiMarker({
      map,
      styles: {
        endMarkerStyle: new TMap.MarkerStyle({
          width: 34, height: 34, anchor: { x: 17, y: 34 },
          src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerRed.png",
        }),
      },
      geometries: [{ id: "endMulti", styleId: "endMarkerStyle", position: coords[coords.length - 1] }],
    });
    
    // Optionally, add markers for waypoints (if any)
    // We use data.matchedNames.waypoints from the backend which are the *names* of the waypoints in order.
    // The actual path `data.path` includes all nodes. We need to identify which of these are the waypoints.
    // For simplicity, we can map the waypoint names from `data.matchedNames.waypoints` to their coordinates
    // by finding them in the `data.path` (which should include names from the backend enhancement).
    
    if (data.matchedNames && data.matchedNames.waypoints && data.matchedNames.waypoints.length > 0) {
        const uniqueWaypointPathNodes = [];
        const visitedWaypointNames = new Set();

        for (const pathNode of data.path) {
            // Check if this pathNode corresponds to one of the matched waypoint names
            // And ensure we only mark each unique waypoint once (in its first appearance if names are not unique)
            if (data.matchedNames.waypoints.includes(pathNode.name) && !visitedWaypointNames.has(pathNode.name)) {
                // Avoid marking start/end if they happen to be named the same as a waypoint and are at the exact start/end of the *overall* path
                const isStartOrEnd = (pathNode.lat === coords[0].getLat() && pathNode.lon === coords[0].getLng()) || 
                                     (pathNode.lat === coords[coords.length-1].getLat() && pathNode.lon === coords[coords.length-1].getLng());
                if (!isStartOrEnd) {
                    uniqueWaypointPathNodes.push(pathNode);
                    visitedWaypointNames.add(pathNode.name);
                }
            }
        }

        if (uniqueWaypointPathNodes.length > 0) {
            const waypointMarkerGeometries = uniqueWaypointPathNodes.map((wpNode, index) => ({
                id: `waypoint_${index}`,
                styleId: "waypointMarkerStyle",
                position: new TMap.LatLng(wpNode.lat, wpNode.lon),
                properties: { title: wpNode.name }
            }));

            const newWaypointMarkers = new TMap.MultiMarker({
                map,
                styles: {
                    waypointMarkerStyle: new TMap.MarkerStyle({
                        width: 28, height: 28, anchor: { x: 14, y: 28 },
                        src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerGray.png", // A different marker for waypoints
                    })
                },
                geometries: waypointMarkerGeometries
            });
            waypointMarkers.push(newWaypointMarkers);
        }
    }


    // Fit bounds
    const bounds = coords.reduce((b, pt) => b.extend(pt), new TMap.LatLngBounds());
    map.fitBounds(bounds, { padding: 20 });

    // Update route info
    document.getElementById("info-distance").innerText = `🗺️ 总距离：${(data.totalDistance / 1000).toFixed(2)} 公里`;
    document.getElementById("info-time").innerText = `⏱️ 预计时间：步行 ${Math.ceil((data.totalDistance / 1000) * 12)} 分钟`; // Assuming 5km/h = 12min/km
    
    let viaText = "无";
    if (data.matchedNames && data.matchedNames.waypoints && data.matchedNames.waypoints.length > 0) {
        viaText = data.matchedNames.waypoints.join(" → ");
    }
    document.getElementById("info-via").innerText = `🚩 途经：${viaText}`;


  } catch (error) {
    console.error("Error fetching multi-stop route:", error);
    alert("请求多点路径失败，请检查网络或联系管理员。");
  }
};
