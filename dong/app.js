(function(){
  var DONGS = [
    { slug:'geomdan',     name:'검단동',      legal:'금곡동 일대 포함', lat:37.6063, lng:126.6650, ready:true  },
    { slug:'bulrodaegok', name:'불로대곡동',   legal:'불로동, 대곡동',   lat:37.6175, lng:126.6720, ready:false },
    { slug:'wondang',     name:'원당동',      legal:'',                 lat:37.5963, lng:126.6572, ready:false },
    { slug:'dangha',      name:'당하동',      legal:'백석동 일대 포함', lat:37.6042, lng:126.6459, ready:true  },
    { slug:'oryuwanggil', name:'오류왕길동',   legal:'오류동, 왕길동',   lat:37.5923, lng:126.6562, ready:true  },
    { slug:'maljeon',     name:'마전동',      legal:'',                 lat:37.6094, lng:126.6398, ready:true  },
    { slug:'ara',         name:'아라동',      legal:'아라1·2동',        lat:37.5900, lng:126.6780, ready:true  }
  ];
  window.DONGS = DONGS;

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
    navigator.geolocation.getCurrentPosition(function(pos){
      var result = nearestDong(pos.coords.latitude, pos.coords.longitude);
      var d = result.dong;
      var kmText = result.distanceKm.toFixed(1) + 'km';
      if(result.distanceKm > 10){
        setStatus(statusEl, 'info',
          '현재 위치가 검단구에서 ' + kmText + ' 떨어져 있어요.<br>' +
          '가장 가까운 <b>' + d.name + '</b> 페이지로 이동합니다.');
      } else {
        setStatus(statusEl, 'success',
          '📍 <b>' + d.name + '</b> 근처로 확인됐어요 (' + kmText + ')<br>잠시 후 이동합니다.');
      }
      setTimeout(function(){ location.href = d.slug + '.html'; }, 1400);
    }, function(err){
      var msg = '위치를 가져올 수 없어요.';
      if(err && err.code === 1) msg = '위치 권한이 거부되었어요. 아래에서 직접 선택해주세요.';
      else if(err && err.code === 3) msg = '위치 확인 시간이 초과됐어요. 아래에서 직접 선택해주세요.';
      setStatus(statusEl, 'error', msg);
    }, { enableHighAccuracy:true, timeout:8000, maximumAge:60000 });
  }

  document.addEventListener('DOMContentLoaded', function(){
    var gpsBtn = document.getElementById('gpsBtn');
    var gpsStatus = document.getElementById('gpsStatus');
    if(gpsBtn){
      gpsBtn.addEventListener('click', function(){ detectGPS(gpsStatus); });
    }
  });
})();
