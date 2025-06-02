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
  const strategy = document.getElementById("strategy").value; // Get selected strategy

  if (!fromName || !toName) {
    alert("请填写起点和终点名称");
    return;
  }

  const apiUrl = `/api/route?from=${encodeURIComponent(fromName)}&to=${encodeURIComponent(toName)}&strategy=${encodeURIComponent(strategy)}`;

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    if (!res.ok || !data.path || data.path.length === 0) {
      let errorMsg = data.error || "未找到路径";
      if (data.suggestions) {
        errorMsg += "\n建议的地点名称：\n";
        if (data.suggestions.from && data.suggestions.from.length > 0) {
          errorMsg += `起点 '${fromName}': ${data.suggestions.from.join(', ')}\n`;
        }
        if (data.suggestions.to && data.suggestions.to.length > 0) {
          errorMsg += `终点 '${toName}': ${data.suggestions.to.join(', ')}`;
        }
      }
      alert(errorMsg);
      return;
    }

    const coords = data.path.map((p) => new TMap.LatLng(p.lat, p.lon));

    if (currentPolyline) currentPolyline.setMap(null);
    if (startMarker) startMarker.setMap(null);
    if (endMarker) endMarker.setMap(null);
    waypointMarkers.forEach(marker => marker.setMap(null)); // Clear any old waypoint markers
    waypointMarkers = [];

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
      geometries: [{ id: "route", styleId: "routeStyle", paths: coords }],
    });
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
      geometries: [{ id: "start", position: coords[0], styleId: "startMarker" }],
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
      geometries: [{ id: "end", position: coords[coords.length - 1], styleId: "endMarker" }],
    });

    const bounds = coords.reduce((b, pt) => b.extend(pt), new TMap.LatLngBounds());
    map.fitBounds(bounds, { padding: 20 });

    // Update route info using new data structure from backend
    document.getElementById("info-distance").innerText = `🗺️ 总距离：${(data.totalDistance / 1000).toFixed(2)} 公里`;
    const totalMinutes = Math.round(data.totalTime / 60);
    document.getElementById("info-time").innerText = `⏱️ 预计时间：${totalMinutes} 分钟 (策略: ${data.strategy})`;
    
    // Display the full path node names
    const fullPathNames = data.path.map(p => p.name).join(" → ");
    document.getElementById("info-via").innerText = `🚩 详细路线：${fullPathNames}`;

  } catch (error) {
    console.error("Error fetching two-point route:", error);
    alert("请求两点路径失败，请检查网络或联系管理员。");
  }
};

// Helper function for rough distance calculation (remains for now, but backend provides accurate data)
function calculateRoughDistance(coordsArray) {
    if (!coordsArray || coordsArray.length < 2) return 0;
    let totalDist = 0;
    for(let i=0; i < coordsArray.length - 1; i++) {
        const lat1 = coordsArray[i].getLat();
        const lng1 = coordsArray[i].getLng();
        const lat2 = coordsArray[i+1].getLat();
        const lng2 = coordsArray[i+1].getLng();
        const R = 6371e3; 
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
    return totalDist; 
}

document.getElementById("multiStopSearchBtn").onclick = async () => {
  const fromName = document.getElementById("from").value.trim();
  const waypointsString = document.getElementById("waypoints").value.trim();
  const toName = document.getElementById("to").value.trim();
  const strategy = document.getElementById("strategy").value; // Get selected strategy

  if (!fromName || !toName) {
    alert("请填写起点和终点名称");
    return;
  }

  const waypointNames = waypointsString === "" ? [] : waypointsString.split(",").map(name => name.trim()).filter(name => name !== "");

  try {
    const response = await fetch("/api/route/multi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startPointName: fromName,
        waypointNames: waypointNames,
        endPointName: toName,
        strategy: strategy, // Include strategy in the POST body
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.path || data.path.length === 0) {
      alert(data.error || "未找到多点路径或规划失败");
      return;
    }

    const coords = data.path.map((p) => new TMap.LatLng(p.lat, p.lon));

    if (currentPolyline) currentPolyline.setMap(null);
    if (startMarker) startMarker.setMap(null);
    if (endMarker) endMarker.setMap(null);
    waypointMarkers.forEach(marker => marker.setMap(null));
    waypointMarkers = [];

    currentPolyline = new TMap.MultiPolyline({
      map,
      styles: {
        routeStyle: new TMap.PolylineStyle({
          color: "#FF0000",
          width: 7,
          borderWidth: 2,
          borderColor: "#FFFFFF",
        }),
      },
      geometries: [{ id: "multiRoute", styleId: "routeStyle", paths: coords }],
    });
    startMarker = new TMap.MultiMarker({
      map,
      styles: {
        startMarkerStyle: new TMap.MarkerStyle({
          width: 34,
          height: 34,
          anchor: { x: 17, y: 34 },
          src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerDefault.png",
        }),
      },
      geometries: [{ id: "startMulti", styleId: "startMarkerStyle", position: coords[0] }],
    });
    endMarker = new TMap.MultiMarker({
      map,
      styles: {
        endMarkerStyle: new TMap.MarkerStyle({
          width: 34,
          height: 34,
          anchor: { x: 17, y: 34 },
          src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerRed.png",
        }),
      },
      geometries: [{ id: "endMulti", styleId: "endMarkerStyle", position: coords[coords.length - 1] }],
    });
    
    if (data.matchedNames && data.matchedNames.waypoints && data.matchedNames.waypoints.length > 0) {
        const uniqueWaypointPathNodes = [];
        const visitedWaypointNames = new Set();
        for (const pathNode of data.path) {
            if (data.matchedNames.waypoints.includes(pathNode.name) && !visitedWaypointNames.has(pathNode.name)) {
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
                        width: 28,
                        height: 28,
                        anchor: { x: 14, y: 28 },
                        src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerGray.png"
                    })
                },
                geometries: waypointMarkerGeometries
            });
            waypointMarkers.push(newWaypointMarkers);
        }
    }

    const bounds = coords.reduce((b, pt) => b.extend(pt), new TMap.LatLngBounds());
    map.fitBounds(bounds, { padding: 20 });

    document.getElementById("info-distance").innerText = `🗺️ 总距离：${(data.totalDistance / 1000).toFixed(2)} 公里`;
    const totalMinutes = Math.round(data.totalTime / 60);
    document.getElementById("info-time").innerText = `⏱️ 预计时间：${totalMinutes} 分钟 (策略: ${data.strategy})`;
    
    // Display the full path node names for multi-stop route
    const fullPathNamesMulti = data.path.map(p => p.name).join(" → ");
    document.getElementById("info-via").innerText = `🚩 详细路线：${fullPathNamesMulti}`;

  } catch (error) {
    console.error("Error fetching multi-stop route:", error);
    alert("请求多点路径失败，请检查网络或联系管理员。");
  }
};
