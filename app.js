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
  var lastSeen = 0;
  var amCreator = false;
  var tab = 'looks';
  var user = null;
  var editing = false;
  var allProducts = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(i) { return (i + 1 < 10 ? '0' : '') + (i + 1); }

  // Each character gets its live images, or 6 grey placeholders until it has some.
  function looksOf(ch) {
    if (ch.images.length) return ch.images.map(function (im) { return { url: im.url, id: im.id, products: im.products }; });
    return [0, 1, 2, 3, 4, 5].map(function () { return { url: null }; });
  }

  function tile(ch, i, look, opts) {
    var pal = palettes[ch.index % palettes.length];
    var alt = ch.name + ', look ' + num(i);
    var style = 'background:' + pal.tones[i % 6] + ';' + (opts.height ? 'height:' + opts.height + 'px' : '');
    if (look.url) {
      var src = window.pntImg(look.url, { w: opts.w || 600, crop: opts.crop, h: opts.h, gravity: 'auto' });
      return '<div class="img has-img" style="background:' + pal.tones[i % 6] + '"><img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy"></div>';
    }
    return '<div class="img" role="img" aria-label="' + esc(alt) + ' (placeholder)" style="' + style + '">' +
      '<span class="label" style="color:' + pal.label + '">Image ' + num(i) + '</span></div>';
  }

  // Profile photo: the chosen avatar, else the first live picture cropped to the face.
  function avatarUrl(ch) {
    return ch.avatar_url || (ch.images && ch.images[0] && ch.images[0].url) || null;
  }
  function avatarStyle(ch, size) {
    var pal = palettes[ch.index % palettes.length];
    var s = 'background-color:' + pal.tones[0];
    var u = avatarUrl(ch);
    if (u) s += ';background-image:url(\'' + esc(window.pntImg(u, { w: size, h: size, crop: 'thumb', gravity: 'face' })) + '\')';
    return s;
  }

  function openButton(ch, i, look, inner) {
    var n = (look.products || []).length;
    return '<button type="button" class="pin-open" data-open="' + look.id + '" aria-label="Open ' + esc(ch.name) + ' look ' + num(i) + (n ? ', shop ' + n + ' items' : '') + '">' +
      inner + (n ? '<span class="shop-badge" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>' + n + ' item' + (n === 1 ? '' : 's') + '</span>' : '') +
      '</button>';
  }

  function renderHome() {
    document.title = 'Pin Not Terest — Discover';
    // Brands only appear in the feed once they have pictures; they live on the Brands page.
    var feedChars = chars.filter(function (ch) { return ch.kind !== 'brand' || ch.images.length; });
    var opts = [{ slug: 'all', name: 'All' }].concat(feedChars);
    var chips = opts.map(function (o) {
      return '<button type="button" class="chip" data-filter="' + esc(o.slug) + '" aria-pressed="' + (filter === o.slug) + '">' + esc(o.name) + '</button>';
    }).join('');

    var shown = feedChars.filter(function (ch) { return filter === 'all' || filter === ch.slug; });
    var lists = shown.map(looksOf);
    var maxLen = Math.max.apply(null, [0].concat(lists.map(function (l) { return l.length; })));
    var pins = '';
    for (var i = 0; i < maxLen; i++) {
      shown.forEach(function (ch, c) {
        var look = lists[c][i];
        if (!look) return;
        var h = look.url ? null : heights[(i + ch.index * 2) % 6];
        var meta = '<strong>' + esc(ch.name) + '</strong><span>' + (ch.kind === 'brand' ? 'Brand' : 'Look ' + num(i)) + '</span>';
        if (look.url) {
          pins += '<div class="pin">' + openButton(ch, i, look, tile(ch, i, look, { w: 600 })) +
            '<a class="pin-meta" href="#/' + esc(ch.slug) + '">' + meta + '</a></div>';
        } else {
          pins += '<a class="pin" href="#/' + esc(ch.slug) + '">' + tile(ch, i, look, { height: h, w: 600 }) +
            '<div class="pin-meta">' + meta + '</div></a>';
        }
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

  function setNav(key) {
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      var on = a.getAttribute('data-nav') === key;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  // Characters and Brands pages: a directory of profile cards for one kind.
  function productCard(p) {
    var inCart = cart.some(function (x) { return x.id === p.id; });
    return '<div class="shop-card">' +
      (p.image_url
        ? '<img class="shop-photo" src="' + esc(window.pntImg(p.image_url, { w: 500, h: 625, crop: 'fill' })) + '" alt="' + esc(p.name) + '" loading="lazy">'
        : '<div class="shop-photo shop-photo-empty" aria-hidden="true"><span>' + esc(p.category || 'Product') + '</span></div>') +
      '<div class="shop-info">' + (p.brand && p.brand.name ? '<span class="brand-label">' + esc(p.brand.name) + '</span>' : '') +
        '<strong>' + esc(p.name) + '</strong>' + (p.category ? '<span class="muted">' + esc(p.category) + '</span>' : '') +
        '<span class="price">' + money(p.price, p.currency) + '</span></div>' +
      '<button type="button" class="btn btn-dark add-btn' + (inCart ? ' added' : '') + '" data-shop-add="' + p.id + '">' + (inCart ? 'Added ✓' : 'Add to cart') + '</button>' +
    '</div>';
  }
  function wireShopButtons(rerender) {
    app.querySelectorAll('[data-shop-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = allProducts.filter(function (x) { return x.id === b.getAttribute('data-shop-add'); })[0];
        if (p) { addToCart(p); rerender(); }
      });
    });
  }

  function renderBrands() {
    document.title = 'Brands — Pin Not Terest';
    var list = chars.filter(function (ch) { return ch.kind === 'brand' && ch.products.length; });
    var cards = list.map(function (b) {
      var photos = b.products.filter(function (p) { return p.image_url; }).slice(0, 4);
      var cover = photos.length
        ? '<div class="brand-cover">' + photos.map(function (p) { return '<img src="' + esc(window.pntImg(p.image_url, { w: 300, h: 300, crop: 'fill' })) + '" alt="" loading="lazy">'; }).join('') + '</div>'
        : '<div class="brand-cover brand-cover-empty" aria-hidden="true"><span>' + esc(b.name) + '</span></div>';
      var n = b.products.length;
      return '<a class="brand-card" href="#/' + esc(b.slug) + '">' + cover +
        '<div class="dir-meta"><div><strong>' + esc(b.name) + '</strong><span>' + n + ' product' + (n === 1 ? '' : 's') + ' for sale</span></div></div></a>';
    }).join('');
    app.innerHTML =
      '<div class="home">' +
        '<section class="intro"><div><p class="eyebrow">Brands</p><h1>Shop by brand.</h1></div>' +
        '<p class="dir-count">' + list.length + ' brand' + (list.length === 1 ? '' : 's') + '</p></section>' +
        (cards ? '<section class="dir-grid" aria-label="Brands">' + cards + '</section>' : '<p class="empty">No brands with products for sale yet.</p>') +
      '</div>';
  }

  function renderBrandPage(b) {
    document.title = b.name + ' — Pin Not Terest';
    var mine = !!(user && b.creator_id === user.id);
    var n = b.products.length;
    app.innerHTML =
      '<div class="profile">' +
        '<a href="#/brands" class="back"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 3L5 8l5 5"/></svg>All brands</a>' +
        '<section class="hero brand-hero"><p class="eyebrow" style="margin:0">Brand</p><h1>' + esc(b.name) + '</h1>' +
          (b.bio ? '<p class="bio">' + esc(b.bio) + '</p>' : '') +
          '<p class="muted">' + n + ' product' + (n === 1 ? '' : 's') + ' for sale</p>' +
          (mine ? '<div class="actions"><a href="admin.html" class="btn" style="display:inline-flex;align-items:center">Manage products</a></div>' : '') +
        '</section>' +
        (n ? '<section class="shop-grid" aria-label="Products">' + b.products.map(productCard).join('') + '</section>'
           : '<p class="empty">No products for sale yet.</p>') +
        (b.images.length ? '<h2 class="section-h">Looks</h2><section class="grid" aria-label="Looks">' + looksOf(b).map(function (look, i) {
            return '<div>' + openButton(b, i, look, tile(b, i, look, { w: 600, h: 750, crop: 'fill' })) + '</div>';
          }).join('') + '</section>' : '') +
      '</div>';
    wireShopButtons(function () { renderBrandPage(b); });
  }

  // ---------- Search ----------
  function renderSearch(q) {
    document.title = 'Search: ' + q + ' — Pin Not Terest';
    var productItems = allProducts.map(function (p) {
      return { kind: 'product', p: p, text: [p.name, p.category, p.brand && p.brand.name].join(' '), boost: 0.2 };
    });
    var products = window.pntSearch(q, productItems).map(function (x) { return x.p; });
    var lookItems = [];
    chars.forEach(function (ch) {
      ch.images.forEach(function (im, i) {
        var ptext = (im.products || []).map(function (p) { return [p.name, p.category, p.brand && p.brand.name].join(' '); }).join(' ');
        lookItems.push({ ch: ch, im: im, i: i, text: ch.name + ' ' + ptext });
      });
    });
    var looks = window.pntSearch(q, lookItems).slice(0, 24);
    var people = window.pntSearch(q, chars.filter(function (c) { return c.kind !== 'brand'; }).map(function (c) {
      return { c: c, text: [c.name, c.bio, c.creator_handle].join(' ') };
    })).map(function (x) { return x.c; });
    var brands = window.pntSearch(q, chars.filter(function (c) { return c.kind === 'brand' && c.products.length; }).map(function (c) {
      return { c: c, text: c.name };
    })).map(function (x) { return x.c; });

    var total = products.length + looks.length + people.length + brands.length;
    var html = '<div class="home"><section class="intro"><div><p class="eyebrow">Search</p>' +
      '<h1>' + (total ? 'Results for “' + esc(q) + '”' : 'Nothing found for “' + esc(q) + '”') + '</h1></div></section>';
    if (!total) html += '<p class="empty">Try another word, like a category (dress, heels, purse), a brand or a character name.</p>';
    if (brands.length) html += '<h2 class="section-h">Brands</h2><div class="chips search-chips">' + brands.map(function (b) {
      return '<a class="chip" style="display:inline-flex;align-items:center" href="#/' + esc(b.slug) + '">' + esc(b.name) + '</a>';
    }).join('') + '</div>';
    if (products.length) html += '<h2 class="section-h">Products <span class="muted">(' + products.length + ')</span></h2><section class="shop-grid" aria-label="Products">' + products.map(productCard).join('') + '</section>';
    if (looks.length) html += '<h2 class="section-h">Looks</h2><section class="feed" aria-label="Looks">' + looks.map(function (l) {
      return '<div class="pin">' + openButton(l.ch, l.i, { url: l.im.url, id: l.im.id, products: l.im.products }, tile(l.ch, l.i, { url: l.im.url }, { w: 600 })) +
        '<a class="pin-meta" href="#/' + esc(l.ch.slug) + '"><strong>' + esc(l.ch.name) + '</strong><span>Look ' + num(l.i) + '</span></a></div>';
    }).join('') + '</section>';
    if (people.length) html += '<h2 class="section-h">Characters</h2><div class="chips search-chips">' + people.map(function (c) {
      return '<a class="chip" style="display:inline-flex;align-items:center" href="#/' + esc(c.slug) + '">' + esc(c.name) + '</a>';
    }).join('') + '</div>';
    app.innerHTML = html + '</div>';
    wireShopButtons(function () { renderSearch(q); });
  }

  function renderDirectory(kind) {
    if (kind === 'brand') { renderBrands(); return; }
    var isBrand = kind === 'brand';
    var title = isBrand ? 'Brands' : 'Characters';
    document.title = title + ' — Pin Not Terest';
    var list = chars.filter(function (ch) { return (ch.kind || 'character') === kind; });
    var cards = list.map(function (ch) {
      var looks = looksOf(ch);
      var count = ch.images.length;
      return '<a class="dir-card" href="#/' + esc(ch.slug) + '">' +
        tile(ch, 0, looks[0], { w: 600, h: 800, crop: 'fill', height: looks[0].url ? null : 360 }) +
        '<div class="dir-meta">' +
        '<div><strong>' + esc(ch.name) + '</strong>' +
        '<span>' + (count ? count + (count === 1 ? ' look' : ' looks') : 'No looks yet') +
        (ch.creator_handle ? ' · by ' + esc(ch.creator_handle) : '') + '</span></div></div></a>';
    }).join('');
    if (!cards) cards = '<p class="empty">No ' + title.toLowerCase() + ' yet.</p>';
    app.innerHTML =
      '<div class="home">' +
        '<section class="intro"><div><p class="eyebrow">' + title + '</p>' +
        '<h1>' + (isBrand ? 'Brands, styled<br>on AI models.' : 'Every AI character,<br>in one place.') + '</h1></div>' +
        '<p class="dir-count">' + list.length + ' ' + (list.length === 1 ? title.slice(0, -1).toLowerCase() : title.toLowerCase()) + '</p></section>' +
        '<section class="dir-grid" aria-label="' + title + '">' + cards + '</section>' +
      '</div>';
  }

  function renderProfile(ch) {
    document.title = ch.name + ' — Pin Not Terest';
    var f = !!following[ch.id];
    var mine = !!(user && amCreator && ch.creator_id === user.id);
    var tabs = [['looks', 'Looks'], ['brands', 'Brands'], ['boards', 'Boards']].map(function (t) {
      return '<button type="button" class="tab" data-tab="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</button>';
    }).join('');
    var body;
    if (tab === 'looks') {
      body = '<section class="grid" aria-label="Looks">' + looksOf(ch).map(function (look, i) {
        var t = tile(ch, i, look, { w: 600, h: 750, crop: 'fill' });
        return '<div>' + (look.url ? openButton(ch, i, look, t) : t) + '<p>Look ' + num(i) + '</p></div>';
      }).join('') + '</section>';
    } else {
      body = '<p class="empty">Nothing here yet.</p>';
    }

    app.innerHTML =
      '<div class="profile">' +
        '<a href="#/" class="back"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 3L5 8l5 5"/></svg>Back to Discover</a>' +
        '<section class="hero">' +
          '<div class="avatar" role="img" aria-label="' + esc(ch.name) + ' profile photo" style="' + avatarStyle(ch, 264) + '"></div>' +
          (mine && editing ?
            '<form id="edit-form" class="edit-form">' +
              '<label for="ed-name">Name</label><input id="ed-name" class="field" required maxlength="80" value="' + esc(ch.name) + '">' +
              '<label for="ed-bio">One-line bio</label><input id="ed-bio" class="field" maxlength="300" value="' + esc(ch.bio || '') + '">' +
              '<p id="ed-msg" class="muted" role="status"></p>' +
              '<div class="actions"><button type="button" id="ed-cancel" class="btn">Cancel</button><button type="submit" class="btn btn-dark">Save</button></div>' +
            '</form>'
          :
            '<h1>' + esc(ch.name) + '</h1>' +
            '<p class="by">' + (ch.kind === 'brand' ? 'Brand' : 'AI character') + (ch.creator_handle ? ' · created by <strong>' + esc(ch.creator_handle) + '</strong>' : '') + '</p>' +
            (ch.bio ? '<p class="bio">' + esc(ch.bio) + '</p>' : '') +
            '<div class="actions">' +
              (mine
                ? '<button type="button" id="edit" class="btn btn-dark">Edit profile</button><a href="admin.html#' + esc(ch.slug) + '" class="btn" style="display:inline-flex;align-items:center">Manage images</a>'
                : '<button type="button" id="follow" class="btn ' + (f ? '' : 'btn-dark') + '" aria-pressed="' + f + '">' + (f ? 'Following ✓' : 'Follow style') + '</button>') +
              '<button type="button" id="share" class="btn">Share</button>' +
            '</div>' +
            (mine ? '<p class="owner-note">You created this</p>' : '')
          ) +
        '</section>' +
        '<nav class="tabs" aria-label="Profile sections">' + tabs + '</nav>' + body +
      '</div>';

    var followBtn = document.getElementById('follow');
    if (followBtn) followBtn.addEventListener('click', async function () {
      var ok = await toggleFollow(ch);
      if (ok) renderProfile(ch);
    });
    var editBtn = document.getElementById('edit');
    if (editBtn) editBtn.addEventListener('click', function () { editing = true; renderProfile(ch); document.getElementById('ed-name').focus(); });
    var editForm = document.getElementById('edit-form');
    if (editForm) {
      document.getElementById('ed-cancel').addEventListener('click', function () { editing = false; renderProfile(ch); });
      editForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var name = document.getElementById('ed-name').value.trim();
        var bio = document.getElementById('ed-bio').value.trim();
        if (!name) return;
        document.getElementById('ed-msg').textContent = 'Saving…';
        var res = await db.from('characters').update({ name: name, bio: bio || null }).eq('id', ch.id).select().single();
        if (res.error) { document.getElementById('ed-msg').textContent = 'Could not save: ' + res.error.message; return; }
        ch.name = res.data.name; ch.bio = res.data.bio;
        editing = false;
        renderProfile(ch);
      });
    }
    var shareBtn = document.getElementById('share');
    if (shareBtn) shareBtn.addEventListener('click', function (e) {
      if (navigator.share) { navigator.share({ title: ch.name, url: location.href }).catch(function () {}); }
      else if (navigator.clipboard) { navigator.clipboard.writeText(location.href); e.target.textContent = 'Link copied'; }
    });
    app.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); renderProfile(ch); });
    });
  }

  // ---------- Shopper accounts and following ----------
  function seenKey() { return 'pnt_seen_' + (user ? user.id : ''); }
  function readSeen() { try { return Number(localStorage.getItem(seenKey()) || 0); } catch (e) { return 0; } }
  function writeSeen(t) { try { localStorage.setItem(seenKey(), String(t)); } catch (e) {} }

  async function loadFollows() {
    following = {};
    amCreator = false;
    if (!user) return;
    var cr = await db.from('creators').select('is_creator').eq('id', user.id).maybeSingle();
    amCreator = !!(cr.data && cr.data.is_creator);
    var r = await db.from('follows').select('character_id').eq('user_id', user.id);
    (r.data || []).forEach(function (x) { following[x.character_id] = true; });
  }
  // The real sign-in the database will see (not just what this page remembers).
  async function liveUser() {
    var r = await db.auth.getSession();
    var session = r.data && r.data.session;
    if (!session) {
      var rr = await db.auth.refreshSession();
      session = rr.data && rr.data.session;
    }
    return session ? session.user : null;
  }
  function rememberAfterSignIn(o) {
    try { localStorage.setItem('pnt_after_signin', JSON.stringify(Object.assign({ at: Date.now() }, o))); } catch (e) {}
  }
  // After signing in (often in a new tab from the email link), go back and finish what was started.
  async function finishAfterSignIn() {
    if (!user) return;
    var intent = window.pntSignIn.takeIntent();
    var p = null;
    try { p = JSON.parse(localStorage.getItem('pnt_after_signin') || 'null'); localStorage.removeItem('pnt_after_signin'); } catch (e) {}
    if (intent === 'creator') {
      // finish a follow they started, then go to creator setup (or their dashboard)
      if (p && p.follow && !following[p.follow]) {
        var fc = chars.filter(function (c) { return c.id === p.follow; })[0];
        if (fc) await toggleFollow(fc);
      }
      location.replace('admin.html?setup=1');
      return;
    }
    if (!p || Date.now() - (p.at || 0) > 2 * 60 * 60 * 1000) return;
    if (p.follow && !following[p.follow]) {
      var ch = chars.filter(function (c) { return c.id === p.follow; })[0];
      if (ch) await toggleFollow(ch);
    }
    if (p.route && location.hash !== p.route) { history.replaceState(null, '', p.route); }
    route();
    if (p.follow) toast('You\u2019re now following this style. New looks will show under Following.');
  }
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 3500);
    setTimeout(function () { t.remove(); }, 4200);
  }
  function signedOutAgain(ch) {
    rememberAfterSignIn({ route: '#/' + ch.slug, follow: ch.id });
    user = null;
    following = {};
    updateHeader();
    openSignIn('Your sign-in on this page has expired. Please sign in again to follow ' + ch.name + '\u2019s style.');
  }
  async function toggleFollow(ch) {
    if (!user) {
      rememberAfterSignIn({ route: '#/' + ch.slug, follow: ch.id });
      openSignIn('Sign in to follow ' + ch.name + '\u2019s style. You\u2019ll see their newest looks under Following.');
      return false;
    }
    var me = await liveUser();
    if (!me) { signedOutAgain(ch); return false; }
    if (me.id !== user.id) { user = me; await loadFollows(); }
    async function attempt() {
      if (following[ch.id]) return db.from('follows').delete().eq('user_id', me.id).eq('character_id', ch.id);
      return db.from('follows').insert({ user_id: me.id, character_id: ch.id });
    }
    var r = await attempt();
    if (r.error && r.error.code !== '23505') {
      // sign-in may have gone stale: refresh once and retry
      var rr = await db.auth.refreshSession();
      if (!rr.data || !rr.data.session) { signedOutAgain(ch); return false; }
      me = rr.data.session.user;
      r = await attempt();
      if (r.error && r.error.code !== '23505') {
        if (r.error.code === '42501' || r.status === 401) { signedOutAgain(ch); return false; }
        alert('Could not update. Please try again.');
        return false;
      }
    }
    if (following[ch.id]) delete following[ch.id]; else following[ch.id] = true;
    updateHeader();
    return true;
  }
  function followedLooks() {
    var list = [];
    chars.forEach(function (ch) {
      if (!following[ch.id]) return;
      ch.images.forEach(function (im, i) { list.push({ ch: ch, im: im, i: i, t: Date.parse(im.created_at) || 0 }); });
    });
    return list.sort(function (a, b) { return b.t - a.t; });
  }
  function updateHeader() {
    var acct = document.getElementById('account-btn');
    acct.textContent = user ? 'Account' : 'Sign in';
    var isCreator = !!(user && amCreator);
    document.getElementById('create-btn').hidden = !isCreator;
    document.getElementById('account-creator').textContent = isCreator ? 'Creator dashboard' : 'Switch to creator mode';
    document.getElementById('account-creator-note').hidden = isCreator;
    var badge = document.getElementById('new-count');
    var fresh = (user && lastSeen) ? followedLooks().filter(function (l) { return l.t > lastSeen; }).length : 0;
    badge.hidden = !fresh || location.hash === '#/following';
    badge.textContent = fresh > 99 ? '99+' : String(fresh);
  }
  function dateLabel(t) {
    if (!t) return '';
    try { return new Date(t).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }); } catch (e) { return ''; }
  }

  function renderFollowing() {
    document.title = 'Following — Pin Not Terest';
    if (!user) {
      app.innerHTML = '<div class="home"><section class="intro"><div><p class="eyebrow">Following</p><h1>Keep up with the<br>styles you like.</h1></div></section>' +
        '<div class="panel narrow" style="text-align:center"><p>Follow models whose outfits you like. Their newest looks show up here, ready to shop.</p>' +
        '<button type="button" class="btn btn-dark" id="following-signin">Sign in to start following</button></div></div>';
      document.getElementById('following-signin').addEventListener('click', function () { rememberAfterSignIn({ route: '#/following' }); openSignIn(); });
      return;
    }
    var followed = chars.filter(function (c) { return following[c.id]; });
    var looks = followedLooks();
    var seenBefore = lastSeen;
    var html = '<div class="home"><section class="intro"><div><p class="eyebrow">Following</p><h1>New from the styles<br>you follow.</h1></div></section>';
    if (!followed.length) {
      html += '<div class="panel narrow" style="text-align:center"><p>You\u2019re not following anyone yet. Open a model\u2019s profile and choose <strong>Follow style</strong>.</p>' +
        '<a href="#/characters" class="btn btn-dark" style="display:inline-flex;align-items:center">Browse characters</a></div></div>';
      app.innerHTML = html; return;
    }
    html += '<div class="following-list" aria-label="Models you follow">' + followed.map(function (c) {
      return '<span class="follow-chip"><a href="#/' + esc(c.slug) + '">' + esc(c.name) + '</a>' +
        '<button type="button" class="link" data-unfollow="' + c.id + '" aria-label="Unfollow ' + esc(c.name) + '">Unfollow</button></span>';
    }).join('') + '</div>';
    if (!looks.length) html += '<p class="empty">No looks posted yet by the models you follow.</p>';
    else html += '<section class="feed" aria-label="Newest looks">' + looks.map(function (l) {
      var isNew = seenBefore && l.t > seenBefore;
      var look = { url: l.im.url, id: l.im.id, products: l.im.products };
      return '<div class="pin">' + (isNew ? '<span class="new-badge">New</span>' : '') +
        openButton(l.ch, l.i, look, tile(l.ch, l.i, look, { w: 600 })) +
        '<a class="pin-meta" href="#/' + esc(l.ch.slug) + '"><strong>' + esc(l.ch.name) + '</strong><span>' + (isNew ? 'New · ' : '') + 'Added ' + dateLabel(l.t) + '</span></a></div>';
    }).join('') + '</section>';
    app.innerHTML = html + '</div>';
    app.querySelectorAll('[data-unfollow]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var c = chars.filter(function (x) { return x.id === b.getAttribute('data-unfollow'); })[0];
        if (c && await toggleFollow(c)) renderFollowing();
      });
    });
    // everything currently shown counts as seen on the next visit
    var newest = looks.length ? looks[0].t : 0;
    if (newest > lastSeen) { lastSeen = newest; writeSeen(newest); }
    updateHeader();
  }

  var signinDialog = document.getElementById('signin-dialog');
  function openSignIn(why) {
    window.pntSignIn.mount(document.getElementById('signin-mount'), { db: db, why: why || '', returnUrl: returnUrl() });
    signinDialog.showModal();
  }
  function returnUrl() { return location.origin + location.pathname; }
  document.getElementById('signin-close').addEventListener('click', function () { signinDialog.close(); });
  var accountDialog = document.getElementById('account-dialog');
  document.getElementById('account-btn').addEventListener('click', function () {
    if (!user) { rememberAfterSignIn({ route: location.hash || '#/' }); openSignIn(); return; }
    document.getElementById('account-email').textContent = 'Signed in as ' + (user.email || '');
    accountDialog.showModal();
  });
  document.getElementById('account-close').addEventListener('click', function () { accountDialog.close(); });
  document.getElementById('account-following').addEventListener('click', function () { accountDialog.close(); });
  document.getElementById('account-signout').addEventListener('click', async function () { await db.auth.signOut(); accountDialog.close(); });
  [signinDialog, accountDialog].forEach(function (d) { d.addEventListener('click', function (e) { if (e.target === d) d.close(); }); });

  function route() {
    var slug = location.hash.replace(/^#\/?/, '');
    tab = 'looks';
    editing = false;
    if (slug.indexOf('search/') === 0) {
      var q = decodeURIComponent(slug.slice(7));
      var box = document.getElementById('search');
      if (box && document.activeElement !== box) box.value = q;
      setNav('');
      renderSearch(q);
      return;
    }
    if (slug === 'following') {
      setNav('following');
      renderFollowing();
      window.scrollTo(0, 0);
      return;
    }
    if (slug === 'characters' || slug === 'brands') {
      setNav(slug);
      renderDirectory(slug === 'brands' ? 'brand' : 'character');
    } else {
      var ch = chars.filter(function (c) { return c.slug === slug; })[0];
      if (ch && ch.kind === 'brand') { setNav('brands'); renderBrandPage(ch); }
      else if (ch) { setNav('characters'); renderProfile(ch); }
      else { setNav('discover'); renderHome(); }
    }
    window.scrollTo(0, 0);
    updateHeader();
  }

  async function load() {
    app.innerHTML = '<p class="empty">Loading…</p>';
    var res = await Promise.all([
      db.from('characters').select('id, creator_id, slug, kind, name, bio, avatar_url, creator_handle, sort, created_at').order('sort').order('created_at'),
      db.from('images').select('id, character_id, url, sort, created_at, image_products(sort, products(id, name, price, currency, category, image_url, is_active, brand:characters(name)))').eq('is_live', true).order('sort').order('created_at'),
      db.from('products').select('id, name, price, currency, category, image_url, brand_id, created_at').eq('is_active', true).order('created_at', { ascending: false })
    ]);
    allProducts = (res[2] && res[2].data) || [];
    if (res[0].error) { app.innerHTML = '<p class="empty">Could not load the feed. Please refresh.</p>'; return; }
    var imgs = res[1].data || [];
    chars = (res[0].data || []).map(function (c, i) {
      c.index = i;
      c.images = imgs.filter(function (im) { return im.character_id === c.id; }).map(function (im) {
        im.products = (im.image_products || []).slice().sort(function (a, b) { return a.sort - b.sort; })
          .map(function (t) { return t.products; }).filter(function (p) { return p && p.is_active !== false; });
        return im;
      });
      c.products = allProducts.filter(function (p) { return p.brand_id === c.id; });
      return c;
    });
    allProducts.forEach(function (p) {
      var b = chars.filter(function (c) { return c.id === p.brand_id; })[0];
      p.brand = b ? { name: b.name } : null;
    });
    route();
    finishAfterSignIn();
  }

  // ---------- New character from the website ----------
  function slugify(str) {
    return str.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 34) || 'item';
  }
  var dialog = document.getElementById('new-dialog');
  document.getElementById('create-btn').addEventListener('click', function () {
    if (!user) { location.href = 'admin.html'; return; }
    document.getElementById('nc-msg').textContent = '';
    dialog.showModal();
    document.getElementById('nc-name').focus();
  });
  document.getElementById('nc-cancel').addEventListener('click', function () { dialog.close(); });
  document.getElementById('new-char-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var name = document.getElementById('nc-name').value.trim();
    if (!name) return;
    document.getElementById('nc-msg').textContent = 'Creating…';
    var row = {
      creator_id: user.id,
      kind: document.getElementById('nc-kind').value,
      name: name,
      bio: document.getElementById('nc-bio').value.trim() || null,
      slug: slugify(name) + '-' + Math.random().toString(36).slice(2, 6),
      creator_handle: '@' + (user.email || 'creator').split('@')[0],
      sort: chars.length + 1
    };
    var res = await db.from('characters').insert(row).select().single();
    if (res.error) { document.getElementById('nc-msg').textContent = 'Could not create: ' + res.error.message; return; }
    e.target.reset();
    dialog.close();
    await load();
    location.hash = '#/' + res.data.slug;
  });

  // When you come back to this tab, or sign in/out in another tab, re-check the real sign-in.
  async function resyncUser() {
    var r = await db.auth.getSession();
    var now = r.data && r.data.session ? r.data.session.user : null;
    if ((now && now.id) === (user && user.id)) return;
    user = now;
    lastSeen = readSeen();
    await loadFollows();
    if (chars.length) route(); else updateHeader();
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) resyncUser(); });
  window.addEventListener('storage', function (e) { if (e.key && e.key.indexOf('sb-') === 0) resyncUser(); });

  db.auth.onAuthStateChange(function (_evt, session) {
    var was = user && user.id;
    user = session ? session.user : null;
    if ((user && user.id) === was) return;
    window.pntWelcome(db, user);
    lastSeen = readSeen();
    loadFollows().then(function () {
      if (signinDialog.open && user) signinDialog.close();
      if (chars.length) { route(); finishAfterSignIn(); } else updateHeader();
    });
  });

  // ---------- Shop the look: pop-up ----------
  function money(v, cur) {
    try { return new Intl.NumberFormat('en-CA', { style: 'currency', currency: cur || 'CAD' }).format(Number(v)); }
    catch (e) { return '$' + Number(v).toFixed(2); }
  }
  var lookDialog = document.getElementById('look-dialog');
  var openLook = null;
  function findImage(id) {
    for (var c = 0; c < chars.length; c++) {
      for (var k = 0; k < chars[c].images.length; k++) {
        if (chars[c].images[k].id === id) return { ch: chars[c], im: chars[c].images[k], i: k };
      }
    }
    return null;
  }
  function renderLookItems() {
    if (!openLook) return;
    var items = openLook.im.products || [];
    var box = document.getElementById('look-items');
    if (!items.length) { box.innerHTML = '<p class="empty">No items tagged on this look yet.</p>'; return; }
    box.innerHTML = items.map(function (p) {
      var inCart = cart.some(function (x) { return x.id === p.id; });
      return '<div class="look-item">' +
        '<span class="thumb" style="' + (p.image_url ? 'background-image:url(\'' + esc(window.pntImg(p.image_url, { w: 112, h: 112, crop: 'fill' })) + '\')' : '') + '"></span>' +
        '<span class="grow">' + (p.brand && p.brand.name ? '<span class="brand-label">' + esc(p.brand.name) + '</span><br>' : '') + '<strong>' + esc(p.name) + '</strong>' + (p.category ? '<br><span class="muted">' + esc(p.category) + '</span>' : '') +
        '<span class="price">' + money(p.price, p.currency) + '</span></span>' +
        '<button type="button" class="btn btn-dark add-btn' + (inCart ? ' added' : '') + '" data-add="' + p.id + '">' + (inCart ? 'Added ✓' : 'Add to cart') + '</button>' +
      '</div>';
    }).join('');
    box.querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = items.filter(function (x) { return x.id === b.getAttribute('data-add'); })[0];
        addToCart(p);
        renderLookItems();
      });
    });
  }
  function showLook(id) {
    var f = findImage(id);
    if (!f) return;
    openLook = f;
    var src = window.pntImg(f.im.url, { w: 1100 });
    document.getElementById('look-img').innerHTML = '<img src="' + esc(src) + '" alt="' + esc(f.ch.name + ', look ' + num(f.i)) + '">';
    document.getElementById('look-name').textContent = f.ch.name;
    document.getElementById('look-sub').textContent = (f.ch.kind === 'brand' ? 'Brand' : 'Look ' + num(f.i)) + ' · View profile';
    document.getElementById('look-profile').setAttribute('href', '#/' + f.ch.slug);
    renderLookItems();
    lookDialog.showModal();
  }
  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-open]');
    if (b) showLook(b.getAttribute('data-open'));
  });
  document.getElementById('look-close').addEventListener('click', function () { lookDialog.close(); });
  document.getElementById('look-profile').addEventListener('click', function () { lookDialog.close(); });
  document.getElementById('look-cart').addEventListener('click', function () { lookDialog.close(); showCart(); });
  [lookDialog, document.getElementById('cart-dialog')].forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });

  // ---------- Cart (kept in this browser) ----------
  var cart = [];
  try { cart = JSON.parse(localStorage.getItem('pnt_cart') || '[]') || []; } catch (e) { cart = []; }
  function saveCart() {
    try { localStorage.setItem('pnt_cart', JSON.stringify(cart)); } catch (e) {}
    var n = cart.reduce(function (t, x) { return t + x.qty; }, 0);
    document.getElementById('cart-count').textContent = n;
    document.getElementById('cart-btn').setAttribute('aria-label', 'Shopping cart, ' + n + ' item' + (n === 1 ? '' : 's'));
    document.getElementById('look-cart').textContent = n ? 'View cart (' + n + ')' : 'View cart';
  }
  function addToCart(p) {
    var hit = cart.filter(function (x) { return x.id === p.id; })[0];
    if (hit) hit.qty += 1;
    else cart.push({ id: p.id, brand: (p.brand && p.brand.name) || null, name: p.name, price: Number(p.price), currency: p.currency || 'CAD', image_url: p.image_url || null, category: p.category || null, qty: 1 });
    saveCart();
  }
  var cartDialog = document.getElementById('cart-dialog');
  function renderCart() {
    var box = document.getElementById('cart-items');
    if (!cart.length) {
      box.innerHTML = '<p class="empty">Your cart is empty. Click any picture to shop what the model is wearing.</p>';
    } else {
      box.innerHTML = cart.map(function (x) {
        return '<div class="cart-item">' +
          '<span class="thumb" style="' + (x.image_url ? 'background-image:url(\'' + esc(window.pntImg(x.image_url, { w: 96, h: 96, crop: 'fill' })) + '\')' : '') + '"></span>' +
          '<span class="grow">' + (x.brand ? '<span class="brand-label">' + esc(x.brand) + '</span><br>' : '') + '<strong>' + esc(x.name) + '</strong><br><span class="muted">' + money(x.price, x.currency) + '</span>' +
          '<span class="qty"><button type="button" class="icon-btn" data-dec="' + x.id + '" aria-label="One less ' + esc(x.name) + '">&minus;</button>' +
          '<span aria-live="polite">' + x.qty + '</span>' +
          '<button type="button" class="icon-btn" data-inc="' + x.id + '" aria-label="One more ' + esc(x.name) + '">+</button></span></span>' +
          '<button type="button" class="link danger" data-rm="' + x.id + '">Remove</button>' +
        '</div>';
      }).join('');
    }
    var total = cart.reduce(function (t, x) { return t + x.price * x.qty; }, 0);
    document.getElementById('cart-subtotal').textContent = money(total, 'CAD');
    document.getElementById('checkout').disabled = !cart.length;
    box.querySelectorAll('[data-inc],[data-dec],[data-rm]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-inc') || b.getAttribute('data-dec') || b.getAttribute('data-rm');
        var hit = cart.filter(function (x) { return x.id === id; })[0];
        if (!hit) return;
        if (b.hasAttribute('data-inc')) hit.qty += 1;
        else if (b.hasAttribute('data-dec')) hit.qty -= 1;
        else hit.qty = 0;
        cart = cart.filter(function (x) { return x.qty > 0; });
        saveCart(); renderCart();
      });
    });
  }
  function showCart() {
    document.getElementById('checkout-msg').textContent = '';
    renderCart();
    cartDialog.showModal();
  }
  document.getElementById('cart-btn').addEventListener('click', showCart);
  document.getElementById('cart-close').addEventListener('click', function () { cartDialog.close(); });
  document.getElementById('checkout').addEventListener('click', function () {
    document.getElementById('checkout-msg').textContent = 'Checkout is coming soon. Your cart is saved in this browser.';
  });
  saveCart();

  // Search box: results update as you type
  var searchBox = document.getElementById('search');
  var searchTimer = null;
  function runSearch(push) {
    var q = searchBox.value.trim();
    var target = q ? '#/search/' + encodeURIComponent(q) : '#/';
    if (location.hash === target) return;
    if (push) location.hash = target;
    else { history.replaceState(null, '', target); route(); }
  }
  searchBox.addEventListener('input', function () {
    clearTimeout(searchTimer);
    var fresh = location.hash.indexOf('#/search/') !== 0;
    searchTimer = setTimeout(function () { runSearch(fresh); }, 200);
  });
  searchBox.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); clearTimeout(searchTimer); runSearch(location.hash.indexOf('#/search/') !== 0); }
  });

  window.addEventListener('hashchange', route);
  db.auth.getSession().then(async function (r) {
    user = r.data.session ? r.data.session.user : null;
    window.pntWelcome(db, user);
    lastSeen = readSeen();
    await loadFollows();
    load();
  });
})();
