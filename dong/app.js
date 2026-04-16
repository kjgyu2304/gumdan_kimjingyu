(function(){
  // lat/lng은 geodong.json polygon centroid (fallback용). 실제 판정은 경계 기반.
  var DONGS = [
    { slug:'geomdan',     name:'검단동',      legal:'금곡동 일대 포함', lat:37.6116, lng:126.6565, ready:true  },
    { slug:'bulrodaegok', name:'불로대곡동',   legal:'불로동, 대곡동',   lat:37.6188, lng:126.6739, ready:true  },
    { slug:'wondang',     name:'원당동',      legal:'',                 lat:37.5936, lng:126.6981, ready:true  },
    { slug:'dangha',      name:'당하동',      legal:'백석동 일대 포함', lat:37.5835, lng:126.6766, ready:true  },
    { slug:'oryuwanggil', name:'오류왕길동',   legal:'오류동, 왕길동',   lat:37.5907, lng:126.6373, ready:true  },
    { slug:'maljeon',     name:'마전동',      legal:'',                 lat:37.5968, lng:126.6765, ready:true  },
    { slug:'ara',         name:'아라동',      legal:'아라1·2동',        lat:37.5931, lng:126.7106, ready:true  }
  ];
  var DONG_MAP = DONGS.reduce(function(m,d){ m[d.slug]=d; return m; }, {});
  window.DONGS = DONGS;

  var geoFeatures = null;
  var geoPromise = null;

  function loadGeo(){
    if(geoFeatures) return Promise.resolve(geoFeatures);
    if(!geoPromise){
      geoPromise = fetch('geodong.json')
        .then(function(r){ return r.json(); })
        .then(function(g){ geoFeatures = g.features; return geoFeatures; })
        .catch(function(){ geoFeatures = []; return geoFeatures; });
    }
    return geoPromise;
  }

  // Ray casting — point [lng,lat] against ring of [lng,lat]
  function pointInRing(pt, ring){
    var x = pt[0], y = pt[1], inside = false;
    for(var i=0, j=ring.length-1; i<ring.length; j=i++){
      var xi = ring[i][0], yi = ring[i][1];
      var xj = ring[j][0], yj = ring[j][1];
      var hit = ((yi > y) !== (yj > y)) && (x < (xj - xi)*(y - yi)/(yj - yi || 1e-12) + xi);
      if(hit) inside = !inside;
    }
    return inside;
  }

  function pointInPolygon(pt, poly){
    // poly: [outerRing, hole1, hole2, ...]
    if(!pointInRing(pt, poly[0])) return false;
    for(var i=1; i<poly.length; i++){ if(pointInRing(pt, poly[i])) return false; }
    return true;
  }

  function pointInFeature(pt, feat){
    var g = feat.geometry;
    if(g.type === 'Polygon') return pointInPolygon(pt, g.coordinates);
    if(g.type === 'MultiPolygon'){
      for(var i=0; i<g.coordinates.length; i++){
        if(pointInPolygon(pt, g.coordinates[i])) return true;
      }
    }
    return false;
  }

  function findDongByPoint(lat, lng){
    if(!geoFeatures) return null;
    var pt = [lng, lat];
    for(var i=0; i<geoFeatures.length; i++){
      if(pointInFeature(pt, geoFeatures[i])){
        var slug = geoFeatures[i].properties.slug;
        return DONG_MAP[slug] || null;
      }
    }
    return null;
  }

  function haversine(lat1, lng1, lat2, lng2){
    var R = 6371;
    var dLat = (lat2-lat1)*Math.PI/180;
    var dLng = (lng2-lng1)*Math.PI/180;
    var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
            Math.sin(dLng/2)*Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function nearestDong(lat, lng){
    var min = Infinity, best = null;
    DONGS.forEach(function(d){
      var dist = haversine(lat, lng, d.lat, d.lng);
      if(dist < min){ min = dist; best = d; }
    });
    return { dong: best, distanceKm: min };
  }

  function setStatus(el, type, html){
    if(!el) return;
    el.className = 'gps-status show ' + type;
    el.innerHTML = html;
  }

  function detectGPS(statusEl){
    if(!navigator.geolocation){
      setStatus(statusEl, 'error', '이 브라우저에서는 위치 감지를 지원하지 않습니다.');
      return;
    }
    setStatus(statusEl, 'info', '📡 위치 확인 중…');
    loadGeo();
    navigator.geolocation.getCurrentPosition(function(pos){
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      loadGeo().then(function(){
        var hit = findDongByPoint(lat, lng);
        if(hit){
          setStatus(statusEl, 'success',
            '📍 <b>' + hit.name + '</b> 경계 안이네요!<br>잠시 후 이동합니다.');
          setTimeout(function(){ location.href = hit.slug + '.html'; }, 1200);
          return;
        }
        // 경계 밖 → 가장 가까운 동으로 안내
        var result = nearestDong(lat, lng);
        var d = result.dong;
        var kmText = result.distanceKm.toFixed(1) + 'km';
        if(result.distanceKm > 10){
          setStatus(statusEl, 'info',
            '현재 위치가 검단구에서 ' + kmText + ' 떨어져 있어요.<br>가장 가까운 <b>' + d.name + '</b> 페이지로 이동합니다.');
        } else {
          setStatus(statusEl, 'info',
            '검단구 경계 밖이지만 가까운 <b>' + d.name + '</b>(' + kmText + ')<br>페이지로 이동할게요.');
        }
        setTimeout(function(){ location.href = d.slug + '.html'; }, 1600);
      });
    }, function(err){
      var msg = '위치를 가져올 수 없어요.';
      if(err && err.code === 1) msg = '위치 권한이 거부되었어요. 아래에서 직접 선택해주세요.';
      else if(err && err.code === 3) msg = '위치 확인 시간이 초과됐어요. 아래에서 직접 선택해주세요.';
      setStatus(statusEl, 'error', msg);
    }, { enableHighAccuracy:true, timeout:10000, maximumAge:60000 });
  }

  document.addEventListener('DOMContentLoaded', function(){
    var gpsBtn = document.getElementById('gpsBtn');
    var gpsStatus = document.getElementById('gpsStatus');
    if(gpsBtn){
      loadGeo(); // 미리 로드해두기
      gpsBtn.addEventListener('click', function(){ detectGPS(gpsStatus); });
    }
  });
})();
