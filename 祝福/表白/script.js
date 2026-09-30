(function () {
  'use strict';

  /* ==========================================================
     1. 配置 —— 常改的东西都在这里
     ========================================================== */
  var CONFIG = {
    title: '遇见你，真好',
    message: '遇见你，真好',
    subMessage: '',
    music: 'assets/music.mp3',
    heartParticles: 820,
    flowSpeed: 18,
    pointerRadius: 0.17,
    pointerForce: 3.4,
    palette: ['#ff5fa2', '#ff8ec4', '#ffb3d9', '#ff3d8b', '#ffd6ea']
  };

  /* ==========================================================
     2. 渲染舞台 —— 画布、尺寸、主循环、指针
     ========================================================== */
  var canvas = document.getElementById('scene');
  var ctx = canvas.getContext('2d');
  var W = 0;
  var H = 0;
  var layers = [];
  var started = false;
  var lastFrame = 0;
  var pointer = { x: 0, y: 0, active: false };

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].resize) layers[i].resize(W, H);
    }
  }

  function addLayer(layer) {
    layers.push(layer);
    if (layer.resize) layer.resize(W, H);
    return layer;
  }

  function tick(now) {
    if (!lastFrame) lastFrame = now;
    var dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    var ds = dt * 60;

    try {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(5,0,12,0.30)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < layers.length; i++) {
        if (layers[i].update) layers[i].update(now, ds);
        if (layers[i].draw) layers[i].draw(ctx, now);
      }
      ctx.globalCompositeOperation = 'source-over';
    } catch (err) {
      if (window.console && console.error) console.error(err);
    }

    requestAnimationFrame(tick);
  }

  function toRgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function makeSprite(hex) {
    var size = 64;
    var c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.18, toRgba(hex, 1));
    grad.addColorStop(0.45, toRgba(hex, 0.42));
    grad.addColorStop(1, toRgba(hex, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  function gauss() {
    return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 0.9;
  }

  function sampleByArc(poly, n) {
    var segs = [];
    var total = 0;
    for (var i = 0; i < poly.length - 1; i++) {
      var dx = poly[i + 1][0] - poly[i][0];
      var dy = poly[i + 1][1] - poly[i][1];
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        segs.push([poly[i][0], poly[i][1], dx, dy, total, len]);
        total += len;
      }
    }
    var out = [];
    var si = 0;
    for (var k = 0; k < n; k++) {
      var d = (k + 0.5) / n * total;
      while (si < segs.length - 1 && segs[si + 1][4] <= d) si++;
      var s = segs[si];
      var u = s[5] > 0 ? (d - s[4]) / s[5] : 0;
      out.push([s[0] + s[2] * u, s[1] + s[3] * u]);
    }
    return out;
  }

  /* ==========================================================
     3. 星空
     ========================================================== */
  function createStarfield() {
    var stars = [];
    return {
      resize: function (w, h) {
        stars.length = 0;
        var n = Math.max(40, Math.round((w * h) / 9000));
        for (var i = 0; i < n; i++) {
          stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: 0.3 + Math.random() * 1.2,
            ph: Math.random() * Math.PI * 2,
            sp: 0.4 + Math.random()
          });
        }
      },
      draw: function (c, now) {
        for (var i = 0; i < stars.length; i++) {
          var s = stars[i];
          c.globalAlpha = 0.10 + 0.30 * (0.5 + 0.5 * Math.sin(now * 0.001 * s.sp + s.ph));
          c.fillStyle = '#ffffff';
          c.beginPath();
          c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      }
    };
  }

  /* ==========================================================
     4. 散落粒子（飘落、点击爆开都用它）
     ========================================================== */
  function createParticleField(sprites) {
    var items = [];
    return {
      items: items,
      add: function (p) { items.push(p); },
      update: function (now, ds) {
        for (var i = items.length - 1; i >= 0; i--) {
          var p = items[i];
          p.x += p.vx * ds;
          p.y += p.vy * ds;
          p.vy += (p.gravity || 0) * ds;
          if (p.drag) {
            var d = Math.pow(p.drag, ds);
            p.vx *= d;
            p.vy *= d;
          }
          p.life -= p.decay * ds;
          if (p.life <= 0) items.splice(i, 1);
        }
      },
      draw: function (c) {
        for (var i = 0; i < items.length; i++) {
          var p = items[i];
          var spr = sprites[p.color];
          if (!spr) continue;
          var s = p.size * 6;
          c.globalAlpha = p.life;
          c.drawImage(spr, p.x - s / 2, p.y - s / 2, s, s);
        }
        c.globalAlpha = 1;
      },
      burst: function (x, y, palette, count) {
        count = count || 16;
        for (var i = 0; i < count; i++) {
          var a = Math.random() * Math.PI * 2;
          var v = 1 + Math.random() * 4;
          items.push({
            x: x,
            y: y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            size: 0.9 + Math.random() * 2,
            life: 1,
            decay: 0.014 + Math.random() * 0.02,
            gravity: 0.02,
            drag: 0.97,
            color: palette[(Math.random() * palette.length) | 0]
          });
        }
      }
    };
  }

  /* ==========================================================
     5. 爱心 —— 弧长均匀采样、弹簧物理、沿轮廓流动、触摸推开
     ========================================================== */
  var HEART = {
    springMin: 0.020,
    springMax: 0.050,
    dampingMin: 0.82,
    dampingMax: 0.90,
    sizeMin: 1.4,
    sizeMax: 3.1,
    pulseSpeed: 0.0021,
    pulseAmount: 0.035,
    swaySpeed: 0.00045,
    swayAmount: 0.05,
    jitter: 0.12,
    haloJitter: 0.75,
    haloRatio: 0.16,
    centerY: 2.6,
    fallMax: 70,
    fallRate: 0.55
  };

  function createHeart(sprites) {
    var pts = [];
    var particles = [];
    var fallers = createParticleField(sprites);
    var active = false;
    var cx = 0;
    var cy = 0;
    var scale = 10;
    var N = 0;

    function buildPoints() {
      var poly = [];
      var steps = 720;
      for (var i = 0; i <= steps; i++) {
        var t = i / steps * Math.PI * 2;
        var x = 16 * Math.pow(Math.sin(t), 3);
        var y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        poly.push([x, -y]);
      }
      pts = sampleByArc(poly, CONFIG.heartParticles);
      N = pts.length;
    }

    function buildParticles() {
      particles.length = 0;
      for (var i = 0; i < N; i++) {
        var halo = Math.random() < HEART.haloRatio;
        var sigma = halo ? HEART.haloJitter : HEART.jitter;
        particles.push({
          i: i,
          x: W * 0.5 + (Math.random() - 0.5) * W * 1.4,
          y: H * 0.5 + (Math.random() - 0.5) * H * 1.4,
          vx: 0,
          vy: 0,
          spring: HEART.springMin + Math.random() * (HEART.springMax - HEART.springMin),
          damping: HEART.dampingMin + Math.random() * (HEART.dampingMax - HEART.dampingMin),
          size: HEART.sizeMin + Math.random() * (HEART.sizeMax - HEART.sizeMin),
          color: CONFIG.palette[(Math.random() * CONFIG.palette.length) | 0],
          ph: Math.random() * Math.PI * 2,
          sp: 0.6 + Math.random() * 1.4,
          jx: gauss() * sigma,
          jy: gauss() * sigma,
          flow: halo ? 0.7 : 1
        });
      }
    }

    function spawnFaller() {
      var spread = Math.min(W, H) * 0.26;
      fallers.add({
        x: cx + (Math.random() - 0.5) * spread,
        y: cy + scale * 15 + Math.random() * 18,
        vx: (Math.random() - 0.5) * 0.3,
        vy: 0.25 + Math.random() * 0.7,
        size: 0.9 + Math.random() * 1.8,
        life: 1,
        decay: 0.0035 + Math.random() * 0.006,
        gravity: 0.012,
        color: CONFIG.palette[(Math.random() * CONFIG.palette.length) | 0]
      });
    }

    return {
      start: function () { active = true; },
      resize: function (w, h) {
        cx = w / 2;
        cy = h * 0.47;
        scale = Math.min(w, h) / 44;
        buildPoints();
        if (!particles.length) buildParticles();
      },
      update: function (now, ds) {
        if (!active) return;
        var tSec = now * 0.001;
        var pulse = 1 + Math.sin(now * HEART.pulseSpeed) * HEART.pulseAmount;
        var ang = Math.sin(now * HEART.swaySpeed) * HEART.swayAmount;
        var cosA = Math.cos(ang);
        var sinA = Math.sin(ang);
        var off = tSec * CONFIG.flowSpeed;
        var R = Math.min(W, H) * CONFIG.pointerRadius;
        var R2 = R * R;

        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          var fi = (p.i + off * p.flow) % N;
          if (fi < 0) fi += N;
          var j = fi | 0;
          var u = fi - j;
          var a = pts[j];
          var b = pts[(j + 1) % N];
          var nx = a[0] + (b[0] - a[0]) * u + p.jx;
          var ny = a[1] + (b[1] - a[1]) * u + p.jy;

          var rx = nx * cosA - ny * sinA;
          ny = nx * sinA + ny * cosA;
          nx = rx;

          var tx = cx + nx * scale * pulse;
          var ty = cy + (ny - HEART.centerY) * scale * pulse;
          tx += Math.sin(tSec * 0.7 + p.ph) * 1.6;
          ty += Math.cos(tSec * 0.6 + p.ph) * 1.6;

          p.vx += (tx - p.x) * p.spring * ds;
          p.vy += (ty - p.y) * p.spring * ds;

          if (pointer.active) {
            var dx = p.x - pointer.x;
            var dy = p.y - pointer.y;
            var d2 = dx * dx + dy * dy;
            if (d2 < R2) {
              var d = Math.sqrt(d2) || 1;
              var f = Math.pow(1 - d / R, 2) * CONFIG.pointerForce * ds;
              p.vx += dx / d * f;
              p.vy += dy / d * f;
            }
          }

          var dm = Math.pow(p.damping, ds);
          p.vx *= dm;
          p.vy *= dm;
          p.x += p.vx * ds;
          p.y += p.vy * ds;

          if (!isFinite(p.x) || !isFinite(p.y)) {
            p.x = tx;
            p.y = ty;
            p.vx = 0;
            p.vy = 0;
          }
        }

        if (fallers.items.length < HEART.fallMax && Math.random() < HEART.fallRate * ds) spawnFaller();
        fallers.update(now, ds);
      },
      draw: function (c, now) {
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          var spr = sprites[p.color];
          if (!spr) continue;
          var s = p.size * 6;
          c.globalAlpha = 0.6 + 0.4 * Math.sin(now * 0.004 * p.sp + p.ph);
          c.drawImage(spr, p.x - s / 2, p.y - s / 2, s, s);
        }
        c.globalAlpha = 1;
        fallers.draw(c);
      }
    };
  }

  /* ==========================================================
     6. 启动与交互
     ========================================================== */
  var sprites = {};
  CONFIG.palette.forEach(function (c) { sprites[c] = makeSprite(c); });

  document.title = CONFIG.title;
  document.getElementById('mainText').textContent = CONFIG.message;
  document.getElementById('subText').textContent = CONFIG.subMessage;

  resize();

  var heart = addLayer(createHeart(sprites));
  var bursts = addLayer(createParticleField(sprites));
  addLayer(createStarfield());

  window.addEventListener('resize', resize);

  window.addEventListener('pointermove', function (e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
  });

  window.addEventListener('pointerdown', function (e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
  });

  window.addEventListener('pointerup', function (e) {
    if (e.pointerType !== 'mouse') pointer.active = false;
  });

  window.addEventListener('pointercancel', function () {
    pointer.active = false;
  });

  window.addEventListener('blur', function () {
    pointer.active = false;
  });

  var startEl = document.getElementById('start');
  var bgm = document.getElementById('bgm');

  document.getElementById('startBtn').addEventListener('click', function () {
    if (started) return;
    started = true;
    startEl.classList.add('hide');
    heart.start();
    if (CONFIG.music) {
      bgm.src = CONFIG.music;
      var playing = bgm.play();
      if (playing && playing.catch) playing.catch(function () {});
    }
  });

  document.addEventListener('click', function (e) {
    if (started) bursts.burst(e.clientX, e.clientY, CONFIG.palette, 16);
  });

  /* 返回模块菜单（在 iframe 内时可用，独立打开则隐藏） */
  var backBtn = document.getElementById('backBtn');
  if (window.top === window) {
    backBtn.style.display = 'none';
  } else {
    backBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      window.top.postMessage({ nav: '?m=wish' }, '*');
    });
  }

  requestAnimationFrame(tick);
})();