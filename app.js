(function () {
  var db = window.pntDb;
  var app = document.getElementById('app');
  var heights = [420, 320, 500, 360, 460, 340];
  var palettes = [
    { tones: ['#ecebe8', '#dcdbd7', '#e4e3df', '#d2d1cc', '#e9e8e5', '#d7d6d2'], label: '#555' },
    { tones: ['#161616', '#232323', '#1b1b1b', '#2b2b2b', '#121212', '#202020'], label: '#b5b5b5' },
    { tones: ['#9a9a9a', '#a7a7a7', '#8c8c8c', '#b1b1b1', '#949494', '#a0a0a0'], label: '#1a1a1a' }
  ];
  var chars = [];
  var filter = 'all';
  var following = {};
  var tab = 'looks';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(i) { return (i + 1 < 10 ? '0' : '') + (i + 1); }

  // Each character gets its live images, or 6 grey placeholders until it has some.
  function looksOf(ch) {
    if (ch.images.length) return ch.images.map(function (im) { return { url: im.url }; });
    return [0, 1, 2, 3, 4, 5].map(function () { return { url: null }; });
  }

  function tile(ch, i, look, opts) {
    var pal = palettes[ch.index % palettes.length];
    var alt = ch.name + ', look ' + num(i);
    var style = 'background:' + pal.tones[i % 6] + ';' + (opts.height ? 'height:' + opts.height + 'px' : '');
    if (look.url) {
      var src = window.pntImg(look.url, { w: opts.w || 600, crop: opts.crop, h: opts.h, gravity: 'auto' });
      return '<div class="img" style="' + style + '"><img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy"></div>';
    }
    return '<div class="img" role="img" aria-label="' + esc(alt) + ' (placeholder)" style="' + style + '">' +
      '<span class="label" style="color:' + pal.label + '">Image ' + num(i) + '</span></div>';
  }

  function avatarStyle(ch, size) {
    var pal = palettes[ch.index % palettes.length];
    var s = 'background-color:' + pal.tones[0];
    if (ch.avatar_url) s += ';background-image:url(\'' + esc(window.pntImg(ch.avatar_url, { w: size, h: size, crop: 'fill', gravity: 'face' })) + '\')';
    return s;
  }

  function renderHome() {
    document.title = 'Pin Not Terest — Discover';
    var opts = [{ slug: 'all', name: 'All' }].concat(chars);
    var chips = opts.map(function (o) {
      return '<button type="button" class="chip" data-filter="' + esc(o.slug) + '" aria-pressed="' + (filter === o.slug) + '">' + esc(o.name) + '</button>';
    }).join('');

    var shown = chars.filter(function (ch) { return filter === 'all' || filter === ch.slug; });
    var lists = shown.map(looksOf);
    var maxLen = Math.max.apply(null, [0].concat(lists.map(function (l) { return l.length; })));
    var pins = '';
    for (var i = 0; i < maxLen; i++) {
      shown.forEach(function (ch, c) {
        var look = lists[c][i];
        if (!look) return;
        var h = look.url ? null : heights[(i + ch.index * 2) % 6];
        pins += '<a class="pin" href="#/' + esc(ch.slug) + '">' +
          tile(ch, i, look, { height: h, w: 600 }) +
          '<div class="pin-meta"><span class="dot" aria-hidden="true" style="' + avatarStyle(ch, 60) + '"></span>' +
          '<strong>' + esc(ch.name) + '</strong><span>' + (ch.kind === 'brand' ? 'Brand' : 'Look ' + num(i)) + '</span></div></a>';
      });
    }
    if (!pins) pins = '<p class="empty">Nothing here yet.</p>';

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
    var body;
    if (tab === 'looks') {
      body = '<section class="grid" aria-label="Looks">' + looksOf(ch).map(function (look, i) {
        return '<div>' + tile(ch, i, look, { w: 600, h: 750, crop: 'fill' }) + '<p>Look ' + num(i) + '</p></div>';
      }).join('') + '</section>';
    } else {
      body = '<p class="empty">Nothing here yet.</p>';
    }

    app.innerHTML =
      '<div class="profile">' +
        '<a href="#/" class="back"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 3L5 8l5 5"/></svg>Back to Discover</a>' +
        '<section class="hero">' +
          '<div class="avatar" role="img" aria-label="' + esc(ch.name) + ' profile photo" style="' + avatarStyle(ch, 264) + '"></div>' +
          '<h1>' + esc(ch.name) + '</h1>' +
          '<p class="by">' + (ch.kind === 'brand' ? 'Brand' : 'AI character') + (ch.creator_handle ? ' · created by <strong>' + esc(ch.creator_handle) + '</strong>' : '') + '</p>' +
          (ch.bio ? '<p class="bio">' + esc(ch.bio) + '</p>' : '') +
          '<div class="actions">' +
            '<button type="button" id="follow" class="btn ' + (f ? '' : 'btn-dark') + '">' + (f ? 'Following' : 'Follow') + '</button>' +
            '<button type="button" id="share" class="btn">Share</button>' +
          '</div>' +
        '</section>' +
        '<nav class="tabs" aria-label="Profile sections">' + tabs + '</nav>' + body +
      '</div>';

    document.getElementById('follow').addEventListener('click', function () { following[ch.id] = !f; renderProfile(ch); });
    document.getElementById('share').addEventListener('click', function (e) {
      if (navigator.share) { navigator.share({ title: ch.name, url: location.href }).catch(function () {}); }
      else if (navigator.clipboard) { navigator.clipboard.writeText(location.href); e.target.textContent = 'Link copied'; }
    });
    app.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); renderProfile(ch); });
    });
  }

  function route() {
    var slug = location.hash.replace(/^#\/?/, '');
    var ch = chars.filter(function (c) { return c.slug === slug; })[0];
    tab = 'looks';
    if (ch) renderProfile(ch); else renderHome();
    window.scrollTo(0, 0);
  }

  async function load() {
    app.innerHTML = '<p class="empty">Loading…</p>';
    var res = await Promise.all([
      db.from('characters').select('id, slug, kind, name, bio, avatar_url, creator_handle, sort, created_at').order('sort').order('created_at'),
      db.from('images').select('character_id, url, sort, created_at').eq('is_live', true).order('sort').order('created_at')
    ]);
    if (res[0].error) { app.innerHTML = '<p class="empty">Could not load the feed. Please refresh.</p>'; return; }
    var imgs = res[1].data || [];
    chars = (res[0].data || []).map(function (c, i) {
      c.index = i;
      c.images = imgs.filter(function (im) { return im.character_id === c.id; });
      return c;
    });
    route();
  }

  window.addEventListener('hashchange', route);
  load();
})();
