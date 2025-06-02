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
let facilityMarkers = []; // For facility search
let foodMarkers = []; // For food search

// DOM Elements for Facility Search
const facilitySourceLocationInput = document.getElementById("facilitySourceLocation");
const quickSearchButtons = document.querySelectorAll(".quick-search-btn");
const customFacilityCategoryInput = document.getElementById("customFacilityCategory");
const searchRadiusInput = document.getElementById("searchRadius");
const findNearbyBtn = document.getElementById("findNearbyBtn");
const facilityListUl = document.getElementById("facilityList");
const facilitySearchMessageP = document.getElementById("facilitySearchMessage");

// DOM Elements for Food Search
const foodSourceLocationInput = document.getElementById("foodSourceLocation");
const foodKeywordInput = document.getElementById("foodKeyword");
const cuisineTypeInput = document.getElementById("cuisineType");
const foodSortBySelect = document.getElementById("foodSortBy");
const foodSortOrderSelect = document.getElementById("foodSortOrder");
const searchFoodBtn = document.getElementById("searchFoodBtn");
const foodListUl = document.getElementById("foodList");
const foodSearchMessageP = document.getElementById("foodSearchMessage");

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

    clearFacilityResults();
    clearFoodResults(); // Clear food results when planning a new route

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

    clearFacilityResults();
    clearFoodResults(); // Clear food results when planning a new multi-stop route

  } catch (error) {
    console.error("Error fetching multi-stop route:", error);
    alert("请求多点路径失败，请检查网络或联系管理员。");
  }
};

// --- Facility Search Logic ---
async function performFacilitySearch(sourceName, categoriesArray, customCategory, radius) {
  clearFacilityMarkers();
  facilityListUl.innerHTML = "";
  facilitySearchMessageP.textContent = "正在搜索...";

  const payload = {
    sourceNodeName: sourceName,
    searchRadius: parseInt(radius, 10) || 500, // Ensure radius is an int
  };

  if (categoriesArray && categoriesArray.length > 0) {
    payload.categories = categoriesArray;
  }
  if (customCategory && customCategory.trim() !== "") {
    payload.customCategory = customCategory.trim();
  }
  
  // If no categories are specified by quick search or custom input, 
  // the backend will search for all facility types (is_facility = true).

  try {
    const response = await fetch("/api/places/nearby", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      facilitySearchMessageP.textContent = data.error || "搜索附近设施失败。";
      return;
    }

    if (data.places && data.places.length > 0) {
      facilitySearchMessageP.textContent = `找到 ${data.places.length} 个设施：`;
      data.places.forEach(place => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${place.name}</strong> (${place.category}) - 距离约 ${place.distance.toFixed(0)} 米`;
        li.style.cursor = "pointer";
        li.onclick = () => {
          // Optional: Highlight on map or draw path from source to this place
          // For now, just log or pan to it.
          console.log("Clicked place:", place);
          map.panTo(new TMap.LatLng(place.lat, place.lon));
          // You could also draw a temporary path here if path_to_place was returned and handled
          // For example: drawTemporaryPath(data.sourceNode, place, place.path_to_place_nodes)
        };
        facilityListUl.appendChild(li);
        
        // Add marker for the facility
        const facilityMarker = new TMap.MultiMarker({
            map,
            styles: {
                facilityStyle: new TMap.MarkerStyle({
                    width: 25, height: 25, बीमारियों: {x: 12.5, y: 25},
                    src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerGray.png" // Example icon
                })
            },
            geometries: [{
                id: `facility_${place.node_id}`,
                styleId: "facilityStyle",
                position: new TMap.LatLng(place.lat, place.lon),
                properties: { title: `${place.name} (${place.category})` }
            }]
        });
        facilityMarkers.push(facilityMarker);
      });
    } else {
      facilitySearchMessageP.textContent = data.message || "未找到符合条件的设施。";
    }

  } catch (error) {
    console.error("Facility search error:", error);
    facilitySearchMessageP.textContent = "搜索请求失败，请检查网络或联系管理员。";
  }
}

function clearFacilityMarkers() {
    facilityMarkers.forEach(marker => marker.setMap(null));
    facilityMarkers = [];
}

// Event listener for the main "查找周边" button
findNearbyBtn.addEventListener("click", () => {
  const sourceName = facilitySourceLocationInput.value.trim();
  const customCategory = customFacilityCategoryInput.value.trim();
  const radius = searchRadiusInput.value;

  if (!sourceName) {
    alert("请输入您的位置（场所名称）。");
    return;
  }
  // Categories array is null here, customCategory will be used if provided.
  // If customCategory is empty, backend searches all facility types.
  performFacilitySearch(sourceName, null, customCategory, radius);
});

// Event listeners for quick search buttons
quickSearchButtons.forEach(button => {
  button.addEventListener("click", () => {
    const sourceName = facilitySourceLocationInput.value.trim();
    const category = button.dataset.category; // Get category from data-* attribute
    const radius = searchRadiusInput.value; // Use current radius input

    if (!sourceName) {
      alert("请输入您的位置（场所名称）。");
      return;
    }
    if (category) {
      customFacilityCategoryInput.value = ""; // Clear custom category if quick search is used
      performFacilitySearch(sourceName, [category], null, radius);
    }
  });
});

function clearFacilityResults() {
  clearFacilityMarkers();
  facilityListUl.innerHTML = "";
  if(facilitySearchMessageP) facilitySearchMessageP.textContent = "";
}

// --- Food Search Logic ---
function clearFoodMarkers() {
  foodMarkers.forEach((marker) => marker.setMap(null));
  foodMarkers = [];
}

function clearFoodResults() {
  clearFoodMarkers();
  if (foodListUl) foodListUl.innerHTML = "";
  if (foodSearchMessageP) foodSearchMessageP.textContent = "";
}

async function performFoodSearch() {
  const sourceNodeName = foodSourceLocationInput.value.trim();
  const keyword = foodKeywordInput.value.trim();
  const cuisine = cuisineTypeInput.value.trim();
  const sortBy = foodSortBySelect.value;
  const sortOrder = foodSortOrderSelect.value;

  if (sortBy === "distance" && !sourceNodeName) {
    alert("按距离排序时，请输入您的位置。");
    foodSearchMessageP.textContent = "按距离排序时，请输入您的位置。";
    return;
  }

  clearFoodResults();
  foodSearchMessageP.textContent = "正在搜索美食...";

  try {
    const response = await fetch("/api/food/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceNodeName: sourceNodeName || undefined, // Send undefined if empty, so backend uses default or handles it
        name: keyword || undefined, // For food name
        restaurant_name: keyword || undefined, // Also use keyword for restaurant
        window_name: keyword || undefined, // and window name. Or have separate inputs.
        cuisine_type: cuisine || undefined,
        sortBy: sortBy,
        sortOrder: sortOrder,
        limit: 10, // You can make this configurable if needed
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      foodSearchMessageP.textContent = data.error || "美食搜索失败，请稍后再试。";
      alert(data.error || "美食搜索失败，请稍后再试。");
      return;
    }

    if (!data.results || data.results.length === 0) {
      foodSearchMessageP.textContent = data.message || "未找到符合条件的美食。";
      return;
    }

    foodSearchMessageP.textContent = `找到了 ${data.results.length} 个美食结果：`;
    const foodGeometries = [];

    data.results.forEach((food, index) => {
      const li = document.createElement("li");
      let content = `<strong>${food.name}</strong> (餐厅: ${food.restaurant_name || 'N/A'}, 窗口: ${food.window_name || 'N/A'})`;
      content += `<br>菜系: ${food.cuisine_type || '未知'}, 评分: ${food.rating_score || 'N/A'}, 人气: ${food.popularity_score || 'N/A'}, 均价: ¥${food.average_price || 'N/A'}`;
      if (food.location && food.location.name) {
        content += `<br>位置: ${food.location.name}`;
      }
      if (food.distance !== null && food.distance !== undefined) {
        content += `, 距离: ${food.distance.toFixed(0)}米`;
      }
      li.innerHTML = content;

      if (food.location && food.location.lat && food.location.lon) {
        const position = new TMap.LatLng(food.location.lat, food.location.lon);
        foodGeometries.push({
          id: `food_${index}`,
          styleId: "foodMarkerStyle",
          position: position,
          properties: { title: `${food.name} (${food.restaurant_name})` },
        });
        li.onclick = () => {
          map.panTo(position, { duration: 300 });
          map.setZoom(18);
        };
      }
      foodListUl.appendChild(li);
    });

    if (foodGeometries.length > 0) {
      const newFoodMarkers = new TMap.MultiMarker({
        map,
        styles: {
          foodMarkerStyle: new TMap.MarkerStyle({
            width: 25,
            height: 35,
            anchor: { x: 12.5, y: 35 },
            src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerCustom.png", // A different marker for food
          }),
        },
        geometries: foodGeometries,
      });
      foodMarkers.push(newFoodMarkers);

      // Fit map to food markers if source location was not given, or just show them.
      // If source location is given, map might be already focused there.
      // For simplicity, let's fit to new markers if they exist.
      const bounds = foodGeometries.reduce((b, geo) => b.extend(geo.position), new TMap.LatLngBounds());
      if (data.sourceNode && data.sourceNode.lat && data.sourceNode.lon){
         bounds.extend(new TMap.LatLng(data.sourceNode.lat, data.sourceNode.lon));
      }
      if (!bounds.isEmpty()){
        map.fitBounds(bounds, { padding: {top:50, bottom:50, left:50, right:50} });
      }
    }

  } catch (error) {
    console.error("Error performing food search:", error);
    foodSearchMessageP.textContent = "美食搜索请求失败，请检查网络或联系管理员。";
    alert("美食搜索请求失败，请检查网络或联系管理员。");
  }
}

if (searchFoodBtn) {
  searchFoodBtn.onclick = performFoodSearch;
}

// Also, clear food results if a facility search is performed
const originalPerformFacilitySearch = performFacilitySearch;
performFacilitySearch = async (sourceName, categoriesArray, customCategory, radius) => {
    clearFoodResults();
    await originalPerformFacilitySearch(sourceName, categoriesArray, customCategory, radius);
}
