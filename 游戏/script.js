(function () {
  'use strict';

  /* 游戏模块：读 ?p= 参数决定进哪个游戏，不带则显示列表 */
  var ITEMS = [
    { id: 'mines', name: '扫雷', desc: '三档难度，长按或标记模式插旗', path: '扫雷/index.html', ready: true }
  ];

  var sp = new URLSearchParams(window.location.search);
  var p = sp.get('p');
  var direct = sp.get('direct') === '1';
  var view = document.getElementById('view');
  var menu = document.getElementById('menu');
  var list = document.getElementById('list');
  var current = null;
  var i;

  for (i = 0; i < ITEMS.length; i++) {
    if (ITEMS[i].id === p) current = ITEMS[i];
  }

  if (current && current.ready) {
    document.title = current.name;
    view.src = current.path + (direct ? '?direct=1' : '');
    view.style.display = 'block';
    return;
  }

  menu.style.display = 'block';
  for (i = 0; i < ITEMS.length; i++) {
    bindCard(ITEMS[i]);
  }

  function bindCard(item) {
    var a = document.createElement('a');
    var row = document.createElement('div');
    var label = document.createElement('span');
    var ico = document.createElement('span');
    var desc = document.createElement('div');

    row.className = 'row';
    label.className = 'label';
    ico.className = 'ico';
    ico.textContent = item.ready ? '🎮' : '🎁';
    label.appendChild(ico);
    label.appendChild(document.createTextNode(item.name));
    desc.className = 'desc';
    desc.textContent = item.desc;

    row.appendChild(label);
    a.appendChild(row);
    a.appendChild(desc);

    if (item.ready) {
      a.href = '?p=' + item.id;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.top !== window) {
          window.top.postMessage({ nav: '?m=game&p=' + item.id }, '*');
        } else {
          window.location.href = '?p=' + item.id;
        }
      });
    } else {
      a.className = 'pending';
    }
    list.appendChild(a);
  }
})();
