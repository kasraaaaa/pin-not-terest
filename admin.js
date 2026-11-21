(function () {
  var db = window.pntDb;
  var cfg = window.PNT_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var user = null;
  var chars = [];
  var current = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function slugify(s) {
    return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item';
  }

  // ---------- 1. Creator login (email magic link) ----------
  $('login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = $('email').value.trim();
    $('login-msg').textContent = 'Sending…';
    var redirect = location.origin + location.pathname;
    var res = await db.auth.signInWithOtp({ email: email, options: { emailRedirectTo: redirect } });
    $('login-msg').textContent = res.error ? ('Could not send link: ' + res.error.message) : 'Check your email for the sign-in link.';
  });
  $('signout').addEventListener('click', async function () { await db.auth.signOut(); });

  db.auth.onAuthStateChange(function (_evt, session) {
    user = session ? session.user : null;
    render();
  });

  function render() {
    $('login').hidden = !!user;
    $('dash').hidden = !user;
    $('signout').hidden = !user;
    $('who').textContent = user ? user.email : '';
    if (user) loadChars();
  }

  // ---------- 2. Dashboard: characters and brands ----------
  async function loadChars() {
    var res = await db.from('characters').select('*').eq('creator_id', user.id).order('sort').order('created_at');
    chars = res.data || [];
    var list = $('char-list');
    if (!chars.length) {
      list.innerHTML = '<li class="muted">Nothing yet.</li>';
    } else {
      list.innerHTML = chars.map(function (c) {
        return '<li><button type="button" class="char-btn" data-id="' + c.id + '" aria-pressed="' + (current && current.id === c.id) + '">' +
          '<span class="dot" style="background-color:#ddd' + (c.avatar_url ? ';background-image:url(\'' + esc(window.pntImg(c.avatar_url, { w: 80, h: 80, crop: 'fill', gravity: 'face' })) + '\')' : '') + '"></span>' +
          '<span>' + esc(c.name) + '</span><span class="kind">' + c.kind + '</span></button></li>';
      }).join('');
      list.querySelectorAll('[data-id]').forEach(function (b) {
        b.addEventListener('click', function () {
          current = chars.filter(function (c) { return c.id === b.getAttribute('data-id'); })[0];
          loadChars();
        });
      });
    }
    if (current) {
      current = chars.filter(function (c) { return c.id === current.id; })[0] || null;
    }
    if (current) loadDetail(); else $('detail').innerHTML = '<p class="muted">Pick a character or brand on the left, or create one.</p>';
  }

  $('new-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var name = $('new-name').value.trim();
    if (!name) return;
    var row = {
      creator_id: user.id,
      kind: $('new-kind').value,
      name: name,
      bio: $('new-bio').value.trim() || null,
      slug: slugify(name) + '-' + Math.random().toString(36).slice(2, 6),
      creator_handle: '@' + user.email.split('@')[0]
    };
    var res = await db.from('characters').insert(row).select().single();
    if (res.error) { $('new-msg').textContent = 'Could not create: ' + res.error.message; return; }
    $('new-msg').textContent = '';
    e.target.reset();
    current = res.data;
    loadChars();
  });

  // ---------- 3 + 4. Image upload and go-live picker ----------
  async function loadDetail() {
    var c = current;
    var res = await db.from('images').select('*').eq('character_id', c.id).order('sort').order('created_at');
    var imgs = res.data || [];
    var live = imgs.filter(function (i) { return i.is_live; }).length;

    $('detail').innerHTML =
      '<div class="detail-head">' +
        '<div><p class="eyebrow">' + c.kind + '</p><h1>' + esc(c.name) + '</h1>' +
        '<p class="muted">' + imgs.length + ' images · ' + live + ' live · <a href="./#/' + esc(c.slug) + '" target="_blank" rel="noopener">View public profile</a></p></div>' +
        '<button type="button" id="upload" class="btn btn-dark">Upload images</button>' +
      '</div>' +
      (imgs.length ? '<div class="admin-grid">' + imgs.map(function (i) {
        var isAvatar = c.avatar_url === i.url;
        return '<figure class="admin-card' + (i.is_live ? ' is-live' : '') + '">' +
          '<img src="' + esc(window.pntImg(i.url, { w: 400, h: 500, crop: 'fill', gravity: 'auto' })) + '" alt="" loading="lazy">' +
          '<figcaption>' +
            '<label class="switch"><input type="checkbox" data-live="' + i.id + '"' + (i.is_live ? ' checked' : '') + '> <span>' + (i.is_live ? 'Live' : 'Hidden') + '</span></label>' +
            '<button type="button" class="link" data-avatar="' + i.id + '"' + (isAvatar ? ' disabled' : '') + '>' + (isAvatar ? 'Profile photo' : 'Use as profile photo') + '</button>' +
            '<button type="button" class="link danger" data-del="' + i.id + '">Remove</button>' +
          '</figcaption></figure>';
      }).join('') + '</div>'
      : '<p class="empty">No images yet. Upload full-body looks, then switch on the ones you want live.</p>');

    $('upload').addEventListener('click', function () { openUpload(c); });
    document.querySelectorAll('[data-live]').forEach(function (cb) {
      cb.addEventListener('change', async function () {
        await db.from('images').update({ is_live: cb.checked }).eq('id', cb.getAttribute('data-live'));
        loadDetail();
      });
    });
    document.querySelectorAll('[data-avatar]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var img = imgs.filter(function (i) { return i.id === b.getAttribute('data-avatar'); })[0];
        await db.from('characters').update({ avatar_url: img.url }).eq('id', c.id);
        loadChars();
      });
    });
    document.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('Remove this image from the profile?')) return;
        await db.from('images').delete().eq('id', b.getAttribute('data-del'));
        loadDetail();
      });
    });
  }

  function openUpload(c) {
    if (!window.cloudinary) { alert('The uploader did not load. Refresh and try again.'); return; }
    var widget = window.cloudinary.createUploadWidget({
      cloudName: cfg.cloudinaryCloud,
      uploadPreset: cfg.cloudinaryPreset,
      folder: cfg.cloudinaryFolder + '/' + c.slug,
      sources: ['local', 'url'],
      multiple: true,
      maxFileSize: 10000000,
      clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      styles: { palette: { window: '#FFFFFF', windowBorder: '#111111', tabIcon: '#111111', menuIcons: '#111111', textDark: '#111111', textLight: '#FFFFFF', link: '#111111', action: '#111111', inactiveTabIcon: '#888888', error: '#B00020', inProgress: '#111111', complete: '#111111', sourceBg: '#F6F6F6' } }
    }, async function (err, result) {
      if (err) { console.error(err); return; }
      if (result.event === 'success') {
        var info = result.info;
        await db.from('images').insert({
          character_id: c.id, creator_id: user.id, url: info.secure_url,
          public_id: info.public_id, width: info.width, height: info.height, is_live: false
        });
      }
      if (result.event === 'close' || result.event === 'queues-end') loadDetail();
    });
    widget.open();
  }
})();
