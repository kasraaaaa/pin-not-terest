(function () {
  var chars = window.CHARACTERS;
  var app = document.getElementById('app');
  var heights = [420, 320, 500, 360, 460, 340];
  var filter = 'all';
  var following = {};
  var tab = 'looks';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(i) { return (i + 1 < 10 ? '0' : '') + (i + 1); }

  function tile(ch, i, extraStyle) {
    var src = ch.looks[i];
    var alt = ch.name + ', look ' + num(i);
    var inner = src
      ? '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy">'
      : '<span class="label" style="color:' + ch.labelColor + '">Image ' + num(i) + '</span>';
    var role = src ? '' : ' role="img" aria-label="' + esc(alt) + ' (placeholder)"';
    return '<div class="img"' + role + ' style="background:' + ch.tones[i] + ';' + (extraStyle || '') + '">' + inner + '</div>';
  }

  function avatarStyle(ch) {
    return 'background-color:' + ch.avatarTone + (ch.avatar ? ';background-image:url(\'' + esc(ch.avatar) + '\')' : '');
  }

  function renderHome() {
    document.title = 'Pin Not Terest — Discover';
    var opts = [{ id: 'all', name: 'All' }].concat(chars);
    var chips = opts.map(function (o) {
      return '<button type="button" class="chip" data-filter="' + o.id + '" aria-pressed="' + (filter === o.id) + '">' + esc(o.name) + '</button>';
    }).join('');

    var pins = '';
    for (var i = 0; i < 6; i++) {
      chars.forEach(function (ch, c) {
        if (filter !== 'all' && filter !== ch.id) return;
        pins += '<a class="pin" href="#/' + ch.id + '">' +
          tile(ch, i, 'height:' + heights[(i + c * 2) % 6] + 'px') +
          '<div class="pin-meta"><span class="dot" aria-hidden="true" style="' + avatarStyle(ch) + '"></span>' +
          '<strong>' + esc(ch.name) + '</strong><span>Look ' + num(i) + '</span></div></a>';
      });
    }

    app.innerHTML =
      '<div class="home">' +
        '<section class="intro"><div><p class="eyebrow">Discover</p>' +
        '<h1>AI characters, dressed<br>by human creators.</h1></div>' +
        '<div class="chips" role="group" aria-label="Filter by character">' + chips + '</div></section>' +
        '<section class="feed" aria-label="Feed">' + pins + '</section>' +
      '</div>';

    app.querySelectorAll('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () { filter = b.getAttribute('data-filter'); renderHome(); });
    });
  }

  function renderProfile(ch) {
    document.title = ch.name + ' — Pin Not Terest';
    var f = !!following[ch.id];
    var tabs = [['looks', 'Looks'], ['brands', 'Brands'], ['boards', 'Boards']].map(function (t) {
      return '<button type="button" class="tab" data-tab="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</button>';
    }).join('');
    var body = '';
    if (tab === 'looks') {
      body = '<section class="grid" aria-label="Looks">' + ch.looks.map(function (_, i) {
        return '<a href="#/' + ch.id + '">' + tile(ch, i) + '<p>Look ' + num(i) + '</p></a>';
      }).join('') + '</section>';
    } else {
      body = '<p class="empty">Nothing here yet.</p>';
    }

    app.innerHTML =
      '<div class="profile">' +
        '<a href="#/" class="back"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 3L5 8l5 5"/></svg>Back to Discover</a>' +
        '<section class="hero">' +
          '<div class="avatar" role="img" aria-label="' + esc(ch.name) + ' avatar" style="' + avatarStyle(ch) + '"></div>' +
          '<h1>' + esc(ch.name) + '</h1>' +
          '<p class="by">AI character · created by <a href="#/' + ch.id + '">' + esc(ch.creator) + '</a></p>' +
          '<p class="bio">' + esc(ch.bio) + '</p>' +
          '<div class="actions">' +
            '<button type="button" id="follow" class="btn ' + (f ? '' : 'btn-dark') + '">' + (f ? 'Following' : 'Follow') + '</button>' +
            '<button type="button" id="share" class="btn">Share</button>' +
          '</div>' +
        '</section>' +
        '<nav class="tabs" aria-label="Profile sections">' + tabs + '</nav>' + body +
      '</div>';

    document.getElementById('follow').addEventListener('click', function () {
      following[ch.id] = !f; renderProfile(ch);
    });
    document.getElementById('share').addEventListener('click', function (e) {
      var url = location.href;
      if (navigator.share) { navigator.share({ title: ch.name, url: url }).catch(function () {}); }
      else if (navigator.clipboard) { navigator.clipboard.writeText(url); e.target.textContent = 'Link copied'; }
    });
    app.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); renderProfile(ch); });
    });
  }

  function route() {
    var id = location.hash.replace(/^#\/?/, '');
    var ch = chars.filter(function (c) { return c.id === id; })[0];
    tab = 'looks';
    if (ch) renderProfile(ch); else renderHome();
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', route);
  route();
})();
