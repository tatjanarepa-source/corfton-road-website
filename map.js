// Proximity map and schools table for the Case file page.
// Distances, the table and the headline counts are all worked out from the data below,
// so if a location is corrected here, every number on the page follows.
(function () {
  // W5 2HS postcode point (ONS Postcode Directory, via postcodes.io).
  // Move this if we pin down the exact building.
  var AP = { lat: 51.519744, lng: -0.297569 };

  // Schools and nurseries within 1 km. Positions are the centre of each site's grounds in OpenStreetMap.
  var SCHOOLS = [
    { name: "Ada Lovelace Church of England High School", kind: "Secondary school and sixth form", lat: 51.519245, lng: -0.293047 },
    { name: "St Augustine's Priory", kind: "Independent girls' school", lat: 51.523111, lng: -0.293281 },
    { name: "New World Montessori Nursery", kind: "Nursery", lat: 51.522487, lng: -0.304493 },
    { name: "Montpelier Primary School", kind: "Primary school", lat: 51.523488, lng: -0.303385 },
    { name: "St Benedict's School", kind: "Independent school", lat: 51.520846, lng: -0.307549 },
    { name: "Durston House", kind: "Independent prep school", lat: 51.516811, lng: -0.307317 },
    { name: "Buttercups & Montessori School", kind: "Nursery", lat: 51.512482, lng: -0.298005 },
    { name: "Christ the Saviour CE Primary School", kind: "Primary school", lat: 51.513957, lng: -0.305274 },
    { name: "St Gregory's Catholic Primary School", kind: "Primary school", lat: 51.524898, lng: -0.306401 },
    { name: "The Ellen Wilkinson School for Girls", kind: "Secondary school", lat: 51.516243, lng: -0.286596 },
    { name: "Holy Family Catholic Primary School", kind: "Primary school", lat: 51.521147, lng: -0.283575 }
  ];

  var RINGS = [400, 800, 1000];       // metres
  var WALK_M_PER_MIN = 80;            // 4.8 km/h

  function metres(a, b) {
    var R = 6371000, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function round10(m) { return Math.round(m / 10) * 10; }

  SCHOOLS.forEach(function (s) { s.m = metres(AP, s); });
  SCHOOLS.sort(function (a, b) { return a.m - b.m; });
  SCHOOLS.forEach(function (s, i) { s.n = i + 1; });

  // Headline numbers.
  var stats = {
    "nearest-m": "≈" + round10(SCHOOLS[0].m) + " m",
    "nearest-name": SCHOOLS[0].name,
    "within-400": SCHOOLS.filter(function (s) { return s.m <= 400; }).length,
    "within-800": SCHOOLS.filter(function (s) { return s.m <= 800; }).length,
    "within-1000": SCHOOLS.filter(function (s) { return s.m <= 1000; }).length
  };
  document.querySelectorAll("[data-stat]").forEach(function (el) {
    var v = stats[el.getAttribute("data-stat")];
    if (v !== undefined) el.textContent = v;
  });

  // Table.
  var tbody = document.getElementById("school-rows");
  if (tbody) {
    tbody.innerHTML = "";
    SCHOOLS.forEach(function (s) {
      var tr = document.createElement("tr");
      if (s.m <= 800) tr.className = "inner";
      tr.innerHTML =
        '<td class="n"><span>' + s.n + '</span></td>' +
        '<td><span class="name"></span><span class="kind"></span></td>' +
        '<td class="num"><b>' + round10(s.m) + ' m</b></td>' +
        '<td class="num">~' + Math.max(1, Math.round(s.m / WALK_M_PER_MIN)) + ' min</td>';
      tr.querySelector(".name").textContent = s.name;
      tr.querySelector(".kind").textContent = s.kind;
      tbody.appendChild(tr);
    });
  }

  // Short list of the schools within 800 m (used on the poster).
  var list = document.getElementById("school-list");
  if (list) {
    list.innerHTML = "";
    SCHOOLS.filter(function (s) { return s.m <= 800; }).forEach(function (s) {
      var li = document.createElement("li");
      li.innerHTML = '<span class="sl-name"></span><span class="sl-m">' + round10(s.m) + " m</span>";
      li.querySelector(".sl-name").textContent = s.name;
      list.appendChild(li);
    });
  }

  // Map (needs Leaflet; the table above works without it).
  var el = document.getElementById("map");
  if (!el || !window.L) return;
  el.parentNode.querySelector(".map-fallback") && el.parentNode.querySelector(".map-fallback").remove();

  var css = getComputedStyle(document.documentElement);
  var red = css.getPropertyValue("--alarm").trim() || "#c90d23";
  var ink = css.getPropertyValue("--ink").trim() || "#0d0d0d";

  var map = L.map(el, {
    scrollWheelZoom: false,
    dragging: !L.Browser.mobile,
    tap: false,
    zoomSnap: 0.25,
    attributionControl: true
  });

  // Street map drawn from our own copy of OpenStreetMap data (basemap.js), so nothing loads from
  // other servers and it works anywhere, including inside sandboxed previews.
  map.attributionControl.addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors');
  map.createPane("base").style.zIndex = 200;
  map.createPane("baseLabels").style.zIndex = 450;
  map.getPane("baseLabels").style.pointerEvents = "none";
  var baseRenderer = L.canvas({ pane: "base", padding: 0.5 });
  var baseLayers = {};
  // Labels come in at two stages, relative to the starting view (which depends on screen size):
  // stations and through roads from the start; residential streets after one step of zooming in.
  var majorLabels = L.layerGroup();
  var midLabels = L.layerGroup();
  var minorLabels = L.layerGroup();
  var startZoom = null;

  function mapColours() {
    var s = getComputedStyle(document.documentElement);
    var v = function (n) { return s.getPropertyValue(n).trim(); };
    return {
      green: v("--map-green"), water: v("--map-water"), rail: v("--map-rail"),
      minor: v("--map-minor"), mid: v("--map-mid"), major: v("--map-major")
    };
  }
  function roadWeights(z) {
    var k = Math.max(0.6, Math.pow(1.6, z - 15));
    return { minor: 1.4 * k, mid: 2.6 * k, major: 4 * k, rail: 1.6 * k };
  }
  function styleBase() {
    var c = mapColours(), w = roadWeights(map.getZoom() || 15);
    if (baseLayers.green) baseLayers.green.setStyle({ fillColor: c.green, fillOpacity: 1, stroke: false });
    if (baseLayers.water) baseLayers.water.setStyle({ fillColor: c.water, fillOpacity: 1, stroke: false });
    ["minor", "mid", "major"].forEach(function (k) {
      if (baseLayers[k]) baseLayers[k].setStyle({ color: c[k], weight: w[k], opacity: 1, lineCap: "round", lineJoin: "round" });
    });
    if (baseLayers.rail) baseLayers.rail.setStyle({ color: c.rail, weight: w.rail, opacity: 1, dashArray: "7 5" });
  }

  var B = window.BASEMAP;
  if (B) {
    var opts = { renderer: baseRenderer, interactive: false };
    baseLayers.green = L.polygon(B.green, opts).addTo(map);
    baseLayers.water = L.polygon(B.water, opts).addTo(map);
    baseLayers.minor = L.polyline(B.minor, opts).addTo(map);
    baseLayers.rail = L.polyline(B.rail, opts).addTo(map);
    baseLayers.mid = L.polyline(B.mid, opts).addTo(map);
    baseLayers.major = L.polyline(B.major, opts).addTo(map);

    // Priority decides which label wins when two would overlap (lower number wins).
    function addLabel(group, p, text, html, priority) {
      var m = L.marker(p, {
        pane: "baseLabels", interactive: false, keyboard: false,
        icon: L.divIcon({ className: "map-label-wrap", iconSize: [0, 0], html: html })
      });
      m.on("add", function () {
        var el = m.getElement().firstChild;
        el.textContent = text;
        el.dataset.priority = priority;
      });
      group.addLayer(m);
    }
    B.stations.forEach(function (s) {
      addLabel(majorLabels, s.p, s.name, '<span class="station-label"></span>', 0);
    });
    B.labels.forEach(function (l) {
      var key = l.name === "Corfton Road";
      var cls = "road-label road-" + l.cls + (key ? " road-key" : "");
      var html = '<span class="' + cls + '" style="transform:translate(-50%,-50%) rotate(' + l.a + 'deg)"></span>';
      var group = key || l.cls === "major" ? majorLabels : l.cls === "mid" ? midLabels : minorLabels;
      addLabel(group, l.p, l.name, html, key ? 1 : l.cls === "major" ? 2 : l.cls === "mid" ? 3 : 4);
    });
    majorLabels.addTo(map);

    function showLabelsForZoom() {
      var z = map.getZoom();
      if (startZoom === null) startZoom = z;
      midLabels.addTo(map);
      if (z >= startZoom + 0.75) minorLabels.addTo(map); else minorLabels.remove();
    }

    // Hide any label that would overlap a pin, a ring label or a more important label.
    function declutter() {
      var frame = el.getBoundingClientRect();
      var kept = [];
      el.querySelectorAll(".pin-ap, .pin-school, .ring-label").forEach(function (n) { kept.push(n.getBoundingClientRect()); });
      var labels = Array.prototype.slice.call(el.querySelectorAll(".road-label, .station-label"));
      labels.sort(function (a, b) { return a.dataset.priority - b.dataset.priority; });
      labels.forEach(function (n) {
        n.style.visibility = "";
        var r = n.getBoundingClientRect();
        var off = r.right < frame.left || r.left > frame.right || r.bottom < frame.top || r.top > frame.bottom;
        var hit = !off && kept.some(function (k) {
          return r.left < k.right + 2 && r.right > k.left - 2 && r.top < k.bottom + 2 && r.bottom > k.top - 2;
        });
        if (hit) n.style.visibility = "hidden";
        else if (!off) kept.push(r);
      });
    }
    // Labels glide into place after a zoom (a ~0.25 s CSS transition), so measure once they've settled.
    var declutterTimer = null;
    function declutterSoon() {
      clearTimeout(declutterTimer);
      declutterTimer = setTimeout(declutter, 320);
    }
    function relabel() { showLabelsForZoom(); declutterSoon(); }

    map.on("zoomend", function () { styleBase(); relabel(); });
    map.on("moveend", declutterSoon);
    var scheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (scheme && scheme.addEventListener) scheme.addEventListener("change", styleBase);
    new MutationObserver(styleBase).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  // Point r metres from the AP on a compass bearing (fine at this scale).
  function offset(r, bearing) {
    var b = bearing * Math.PI / 180;
    return [AP.lat + r * Math.cos(b) / 111320, AP.lng + r * Math.sin(b) / (111320 * Math.cos(AP.lat * Math.PI / 180))];
  }
  // Where each ring's label sits (compass bearing), chosen to stay clear of the school pins.
  var LABEL_BEARING = { 400: 180, 800: 0, 1000: 0 };

  // Rings, largest first so the inner ones sit on top.
  RINGS.slice().reverse().forEach(function (r) {
    L.circle([AP.lat, AP.lng], {
      radius: r,
      color: red,
      weight: r === 1000 ? 1 : 2,
      dashArray: r === 1000 ? "4 6" : null,
      fillColor: red,
      fillOpacity: r === 1000 ? 0.03 : 0.07,
      interactive: false
    }).addTo(map);
    var label = r === 1000 ? "1 km" : r + " m · " + Math.round(r / WALK_M_PER_MIN) + " min";
    L.marker(offset(r, LABEL_BEARING[r]), {
      interactive: false,
      icon: L.divIcon({ className: "ring-label-wrap", html: '<span class="ring-label">' + label + '</span>', iconSize: [0, 0] })
    }).addTo(map);
  });

  SCHOOLS.forEach(function (s) {
    L.polyline([[AP.lat, AP.lng], [s.lat, s.lng]], {
      color: ink, weight: 1.5, dashArray: "5 5", opacity: 0.8, interactive: false
    }).addTo(map);
  });

  SCHOOLS.forEach(function (s) {
    L.marker([s.lat, s.lng], {
      title: s.name,
      keyboard: true,
      icon: L.divIcon({ className: "", html: '<span class="pin-school">' + s.n + '</span>', iconSize: [26, 26], iconAnchor: [13, 13] })
    })
      .bindTooltip(s.n + ". " + s.name + " — " + round10(s.m) + " m", { className: "school-tip", direction: "top", offset: [0, -14] })
      .addTo(map);
  });

  L.marker([AP.lat, AP.lng], {
    title: "2 Corfton Road",
    zIndexOffset: 1000,
    icon: L.divIcon({ className: "", html: '<span class="pin-ap">AP</span>', iconSize: [38, 38], iconAnchor: [19, 19] })
  })
    .bindTooltip("2 Corfton Road — Approved Premises", { className: "school-tip", direction: "top", offset: [0, -20], permanent: false })
    .addTo(map);

  map.fitBounds(L.latLng(AP.lat, AP.lng).toBounds(2 * 1000 + 120), { padding: [8, 8] });
  // Keep people within the area we have street data for.
  map.setMaxBounds(L.latLng(AP.lat, AP.lng).toBounds(3000));
  map.setMinZoom(map.getZoom());
  map.setMaxZoom(17);
  if (B) {
    styleBase();
    relabel();
  }
})();
