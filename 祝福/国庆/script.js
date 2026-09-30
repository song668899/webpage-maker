(function () {
  'use strict';

  /* ==========================================================
     1. 配置 —— 常改的东西都在这里
     ========================================================== */
  var CONFIG = {
    title: '国庆快乐',
    message: '国庆快乐',
    lines: [
      '此生无悔入华夏',
      '何其有幸，生于华夏',
      '如果信念有颜色，那一定是中国红',
      '山河虽无恙，吾辈当自强',
      '祖国有我，请放心'
    ],
    lineInterval: 3200,
    music: 'assets/music.mp3',
    palette: ['#ffd700', '#ff8c00', '#ff4d4d', '#ff2d55', '#ffb347', '#fff1a8'],
    autoFirework: [0.7, 1.9],
    lanterns: 5,
    confettiMax: 34
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
      /* 半透明清屏形成拖尾（底色 #0d0408） */
      ctx.fillStyle = 'rgba(13,4,8,0.30)';
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

  function makeSprite(hex, core) {
    var size = 64;
    var c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,' + (core || 1) + ')');
    grad.addColorStop(0.18, toRgba(hex, 1));
    grad.addColorStop(0.45, toRgba(hex, 0.42));
    grad.addColorStop(1, toRgba(hex, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
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
          c.globalAlpha = 0.10 + 0.32 * (0.5 + 0.5 * Math.sin(now * 0.001 * s.sp + s.ph));
          c.fillStyle = '#ffe9c0';
          c.beginPath();
          c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      }
    };
  }

  /* ==========================================================
     4. 通用粒子场（爆炸火星、金色彩带共用）
     ========================================================== */
  function createField(sprites) {
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
          if (p.sway) p.x += Math.sin(now * 0.002 + p.ph) * p.sway * ds;
          p.life -= p.decay * ds;
          if (p.life <= 0 || p.y > H + 40) items.splice(i, 1);
        }
      },
      draw: function (c, now) {
        for (var i = 0; i < items.length; i++) {
          var p = items[i];
          var spr = sprites[p.color];
          if (!spr) continue;
          var s = p.size * (p.breathe ? (1 + 0.25 * Math.sin(now * 0.006 + p.ph)) : 1) * 6;
          c.globalAlpha = Math.max(0, p.life);
          c.drawImage(spr, p.x - s / 2, p.y - s / 2, s, s);
        }
        c.globalAlpha = 1;
      },
      burst: function (x, y, mainColor) {
        var count = 60 + ((Math.random() * 30) | 0);
        var ring = Math.random() < 0.5;
        var base = 3 + Math.random() * 3.4;
        for (var i = 0; i < count; i++) {
          var a = (i / count) * Math.PI * 2 + Math.random() * 0.14;
          var v = ring ? base * (0.85 + Math.random() * 0.3) : base * (0.35 + Math.random() * 0.75);
          var color = Math.random() < 0.25 ? '#fff1a8' : mainColor;
          items.push({
            x: x,
            y: y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            size: 1 + Math.random() * 1.7,
            life: 1,
            decay: 0.010 + Math.random() * 0.010,
            gravity: 0.042,
            drag: 0.982,
            color: color
          });
        }
      }
    };
  }

  /* ==========================================================
     5. 烟花 —— 火箭升空 + 到顶爆炸
     ========================================================== */
  function createFireworks(field) {
    var rockets = [];
    var nextAuto = 0;

    function launch(tx, ty) {
      rockets.push({
        x: tx + (Math.random() - 0.5) * 30,
        y: H + 12,
        tx: tx,
        ty: ty,
        v: -(9 + Math.random() * 4),
        color: pick(CONFIG.palette),
        ph: Math.random() * Math.PI * 2
      });
    }

    function autoLaunch() {
      var tx = W * (0.12 + Math.random() * 0.76);
      var ty = H * (0.14 + Math.random() * 0.34);
      launch(tx, ty);
    }

    return {
      click: function (x, y) { launch(x, Math.max(40, y)); },
      update: function (now, ds) {
        if (started) {
          if (!nextAuto) nextAuto = now + 800;
          if (now >= nextAuto) {
            autoLaunch();
            nextAuto = now + (CONFIG.autoFirework[0] +
              Math.random() * (CONFIG.autoFirework[1] - CONFIG.autoFirework[0])) * 1000;
          }
        }
        for (var i = rockets.length - 1; i >= 0; i--) {
          var r = rockets[i];
          r.y += r.v * ds;
          r.x += Math.sin(now * 0.004 + r.ph) * 0.35 * ds;
          if (r.y <= r.ty) {
            field.burst(r.x, r.y, r.color);
            rockets.splice(i, 1);
          }
        }
      },
      draw: function (c, now) {
        for (var i = 0; i < rockets.length; i++) {
          var r = rockets[i];
          var spr = sprites[r.color];
          if (!spr) continue;
          var s = 14;
          c.globalAlpha = 0.95;
          c.drawImage(spr, r.x - s / 2, r.y - s / 2, s, s);
        }
        c.globalAlpha = 1;
      }
    };
  }

  /* ==========================================================
     6. 孔明灯 —— 底部升起，到顶循环
     ========================================================== */
  function createLanterns() {
    var lamps = [];
    var count = 0;

    function spawn(w, h, first) {
      lamps.push({
        x: Math.random() * w,
        y: first ? Math.random() * h : h + 20 + Math.random() * 40,
        v: 0.18 + Math.random() * 0.32,
        size: 7 + Math.random() * 6,
        ph: Math.random() * Math.PI * 2,
        warm: Math.random() < 0.5 ? '#ffc46b' : '#ffab4a'
      });
    }

    return {
      resize: function (w, h) {
        if (!count) {
          count = CONFIG.lanterns;
          for (var i = 0; i < count; i++) spawn(w, h, true);
        }
      },
      update: function (now, ds) {
        for (var i = 0; i < lamps.length; i++) {
          var l = lamps[i];
          l.y -= l.v * ds;
          l.x += Math.sin(now * 0.0012 + l.ph) * 0.35 * ds;
        }
        for (var j = lamps.length - 1; j >= 0; j--) {
          if (lamps[j].y < -40) {
            lamps.splice(j, 1);
            spawn(W, H, false);
          }
        }
      },
      draw: function (c, now) {
        for (var i = 0; i < lamps.length; i++) {
          var l = lamps[i];
          var spr = sprites[l.warm];
          if (!spr) continue;
          var breath = 1 + 0.18 * Math.sin(now * 0.004 + l.ph);
          var s = l.size * 6 * breath;
          c.globalAlpha = 0.5;
          c.drawImage(spr, l.x - s / 2, l.y - s / 2, s, s);
          c.globalAlpha = 0.9;
          c.drawImage(spr, l.x - s / 4, l.y - s / 4, s / 2, s / 2);
        }
        c.globalAlpha = 1;
      }
    };
  }

  /* ==========================================================
     7. 金色彩带 —— 顶部飘落，落地重生循环
     ========================================================== */
  function createConfetti() {
    var ready = false;

    function spawn(w, h, first) {
      field.add({
        x: Math.random() * w,
        y: first ? Math.random() * h : -12 - Math.random() * 30,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.35 + Math.random() * 0.65,
        size: 0.7 + Math.random() * 1.1,
        life: 1,
        decay: 0,
        gravity: 0.0015,
        drag: 0.999,
        sway: 0.5 + Math.random() * 0.8,
        breathe: true,
        ph: Math.random() * Math.PI * 2,
        color: Math.random() < 0.55 ? '#ffd700' : '#ffb347',
        confetti: true
      });
    }

    return {
      resize: function (w, h) {
        if (!ready) {
          ready = true;
          for (var i = 0; i < 16; i++) spawn(w, h, true);
        }
      },
      update: function (now, ds) {
        var n = 0;
        for (var i = 0; i < field.items.length; i++) {
          if (field.items[i].confetti) n++;
        }
        if (n < 16) spawn(W, H, false);
        /* 彩带不衰减，落地（field.update 里 y>H 判定）后由上面补生 */
        for (var j = field.items.length - 1; j >= 0; j--) {
          if (field.items[j].confetti && field.items[j].y > H + 20) {
            field.items.splice(j, 1);
          }
        }
      }
    };
  }

  /* ==========================================================
     8. 组装 —— 粒子精灵、图层、文字轮播
     ========================================================== */
  var sprites = {};
  CONFIG.palette.concat(['#ffc46b', '#ffab4a']).forEach(function (c) {
    sprites[c] = makeSprite(c);
  });

  document.title = CONFIG.title;
  document.getElementById('mainText').textContent = CONFIG.message;

  resize();

  var field = addLayer(createField(sprites));
  addLayer(createLanterns());
  var fireworks = createFireworks(field);
  addLayer(fireworks);
  addLayer(createConfetti());
  addLayer(createStarfield());

  window.addEventListener('resize', resize);

  /* 文字轮播 */
  var subEl = document.getElementById('subText');
  var lineIndex = 0;
  subEl.textContent = CONFIG.lines[0];
  setInterval(function () {
    subEl.classList.add('fade');
    setTimeout(function () {
      lineIndex = (lineIndex + 1) % CONFIG.lines.length;
      subEl.textContent = CONFIG.lines[lineIndex];
      subEl.classList.remove('fade');
    }, 500);
  }, CONFIG.lineInterval);

  /* 点击放烟花（启动后；点按钮不算） */
  window.addEventListener('pointerdown', function (e) {
    if (!started) return;
    if (e.target && e.target.closest && e.target.closest('button')) return;
    fireworks.click(e.clientX, e.clientY);
  });

  /* ==========================================================
     9. 启动与返回
     ========================================================== */
  var startEl = document.getElementById('start');
  var bgm = document.getElementById('bgm');

  document.getElementById('startBtn').addEventListener('click', function () {
    if (started) return;
    started = true;
    startEl.classList.add('hide');
    if (CONFIG.music) {
      bgm.src = CONFIG.music;
      var playing = bgm.play();
      if (playing && playing.catch) playing.catch(function () {});
    }
    /* 开场三连发 */
    fireworks.click(W * 0.3, H * 0.3);
    setTimeout(function () { fireworks.click(W * 0.7, H * 0.24); }, 350);
    setTimeout(function () { fireworks.click(W * 0.5, H * 0.36); }, 700);
  });

  var backBtn = document.getElementById('backBtn');
  if (window.top === window) {
    backBtn.style.display = 'none';
  } else {
    backBtn.addEventListener('click', function () {
      window.top.postMessage({ nav: '?m=wish' }, '*');
    });
  }

  requestAnimationFrame(tick);
})();
