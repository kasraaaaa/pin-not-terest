(function () {
  var db = window.pntDb;
  var cfg = window.PNT_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var user = null;
  var chars = [];
  var current = null;
  var maxSort = 0;
  var view = 'chars';
  var products = [];
  var editingProduct = null;

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
  $('google-login').addEventListener('click', async function () {
    $('google-msg').textContent = '';
    var res = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } }
    });
    if (res.error) $('google-msg').textContent = 'Google sign-in is not available yet: ' + res.error.message;
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
    if (!current && location.hash.length > 1) {
      var want = decodeURIComponent(location.hash.slice(1));
      current = chars.filter(function (c) { return c.slug === want; })[0] || null;
    }
    var list = $('char-list');
    if (!chars.length) {
      list.innerHTML = '<li class="muted">Nothing yet.</li>';
    } else {
      list.innerHTML = chars.map(function (c) {
        return '<li><button type="button" class="char-btn" data-id="' + c.id + '" aria-pressed="' + (current && current.id === c.id) + '">' +
          '<span class="dot" style="background-color:#ddd' + (c.avatar_url ? ';background-image:url(\'' + esc(window.pntImg(c.avatar_url, { w: 80, h: 80, crop: 'thumb', gravity: 'face' })) + '\')' : '') + '"></span>' +
          '<span>' + esc(c.name) + '</span><span class="kind">' + c.kind + '</span></button></li>';
      }).join('');
      list.querySelectorAll('[data-id]').forEach(function (b) {
        b.addEventListener('click', function () {
          current = chars.filter(function (c) { return c.id === b.getAttribute('data-id'); })[0];
          view = 'chars';
          loadChars();
        });
      });
    }
    if (current) {
      current = chars.filter(function (c) { return c.id === current.id; })[0] || null;
    }
    var pr = await db.from('products').select('*').eq('creator_id', user.id).order('created_at', { ascending: false });
    products = pr.data || [];
    $('product-count').textContent = products.length ? String(products.length) : '';
    $('products-btn').setAttribute('aria-pressed', String(view === 'products'));
    if (view === 'products') { renderProducts(); return; }
    if (current) loadDetail(); else $('detail').innerHTML = '<p class="muted">Pick a character or brand on the left, or create one. Add what the models wear under <strong>Products</strong>.</p>';
  }
  $('products-btn').addEventListener('click', function () { view = 'products'; current = null; loadChars(); });

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
      creator_handle: '@' + (user.email || 'creator').split('@')[0]
    };
    var res = await db.from('characters').insert(row).select().single();
    if (res.error) { $('new-msg').textContent = 'Could not create: ' + res.error.message; return; }
    $('new-msg').textContent = '';
    e.target.reset();
    current = res.data;
    view = 'chars';
    loadChars();
  });

  // ---------- 3 + 4. Image upload and go-live picker ----------
  async function loadDetail() {
    var c = current;
    var res = await db.from('images').select('*, image_products(product_id)').eq('character_id', c.id).order('sort').order('created_at');
    var imgs = res.data || [];
    maxSort = imgs.reduce(function (m, i) { return Math.max(m, i.sort || 0); }, 0);
    var live = imgs.filter(function (i) { return i.is_live; }).length;

    $('detail').innerHTML =
      '<div class="detail-head">' +
        '<div><p class="eyebrow">' + c.kind + '</p><h1>' + esc(c.name) + '</h1>' +
        (c.bio ? '<p class="muted" style="margin:0 0 6px">' + esc(c.bio) + '</p>' : '') +
        '<p class="muted">' + imgs.length + ' images · ' + live + ' live · <a href="./#/' + esc(c.slug) + '" target="_blank" rel="noopener">View public profile</a></p></div>' +
        '<div class="actions" style="margin:0"><button type="button" id="edit-details" class="btn">Edit name</button>' +
        '<button type="button" id="upload" class="btn btn-dark">Upload images</button></div>' +
      '</div>' +
      '<form id="details-form" class="stack" hidden style="max-width:460px;margin:0 0 28px">' +
        '<label for="d-name">Name</label><input id="d-name" class="field" required maxlength="80" value="' + esc(c.name) + '">' +
        '<label for="d-bio">One-line bio</label><input id="d-bio" class="field" maxlength="300" value="' + esc(c.bio || '') + '">' +
        '<p id="d-msg" class="muted" role="status"></p>' +
        '<div class="actions" style="margin:0"><button type="button" id="d-cancel" class="btn">Cancel</button><button type="submit" class="btn btn-dark">Save</button></div>' +
      '</form>' +
      (imgs.length ? '<p class="muted" style="margin:-12px 0 16px">Drag images to reorder, or use the arrows. The first image shows first on the profile and in the feed.</p><div class="admin-grid" id="admin-grid">' + imgs.map(function (i, idx) {
        var isAvatar = c.avatar_url === i.url;
        return '<figure class="admin-card' + (i.is_live ? ' is-live' : '') + '" draggable="true" data-card="' + i.id + '">' +
          '<div class="card-top"><span class="pos">' + (idx + 1) + '</span>' +
            '<span class="move">' +
              '<button type="button" class="icon-btn" data-move="-1" data-for="' + i.id + '" aria-label="Move image ' + (idx + 1) + ' earlier"' + (idx === 0 ? ' disabled' : '') + '>&larr;</button>' +
              '<button type="button" class="icon-btn" data-move="1" data-for="' + i.id + '" aria-label="Move image ' + (idx + 1) + ' later"' + (idx === imgs.length - 1 ? ' disabled' : '') + '>&rarr;</button>' +
            '</span></div>' +
          '<img src="' + esc(window.pntImg(i.url, { w: 400, h: 500, crop: 'fill', gravity: 'auto' })) + '" alt="" loading="lazy" draggable="false">' +
          '<figcaption>' +
            '<label class="switch"><input type="checkbox" data-live="' + i.id + '"' + (i.is_live ? ' checked' : '') + '> <span>' + (i.is_live ? 'Live' : 'Hidden') + '</span></label>' +
            '<button type="button" class="tag-btn" data-tag="' + i.id + '">' + (i.image_products && i.image_products.length ? 'Products tagged: ' + i.image_products.length : '+ Tag products') + '</button>' +
            '<button type="button" class="link" data-avatar="' + i.id + '"' + (isAvatar ? ' disabled' : '') + '>' + (isAvatar ? 'Profile photo' : 'Use as profile photo') + '</button>' +
            '<button type="button" class="link danger" data-del="' + i.id + '">Remove</button>' +
          '</figcaption></figure>';
      }).join('') + '</div>'
      : '<p class="empty">No images yet. Upload full-body looks, then switch on the ones you want live.</p>');

    $('upload').addEventListener('click', function () { openUpload(c); });

    // ---------- Reorder: drag and drop + arrow buttons ----------
    var order = imgs.map(function (i) { return i.id; });
    async function saveOrder(ids) {
      $('detail').setAttribute('aria-busy', 'true');
      var changed = ids.map(function (id, n) { return { id: id, sort: n + 1 }; }).filter(function (r) {
        var orig = imgs.filter(function (i) { return i.id === r.id; })[0];
        return !orig || orig.sort !== r.sort;
      });
      var results = await Promise.all(changed.map(function (r) {
        return db.from('images').update({ sort: r.sort }).eq('id', r.id);
      }));
      var failed = results.filter(function (r) { return r.error; });
      if (failed.length) alert('Could not save the new order. Please try again.');
      loadDetail();
    }
    var grid = $('admin-grid');
    if (grid) {
      var dragId = null;
      grid.querySelectorAll('[data-card]').forEach(function (card) {
        card.addEventListener('dragstart', function (e) {
          dragId = card.getAttribute('data-card');
          card.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', dragId);
        });
        card.addEventListener('dragend', function () {
          card.classList.remove('dragging');
          grid.querySelectorAll('.drop-before, .drop-after').forEach(function (el) { el.classList.remove('drop-before', 'drop-after'); });
        });
        card.addEventListener('dragover', function (e) {
          if (!dragId || card.getAttribute('data-card') === dragId) return;
          e.preventDefault();
          var r = card.getBoundingClientRect();
          var after = (e.clientX - r.left) > r.width / 2;
          card.classList.toggle('drop-after', after);
          card.classList.toggle('drop-before', !after);
        });
        card.addEventListener('dragleave', function () { card.classList.remove('drop-before', 'drop-after'); });
        card.addEventListener('drop', function (e) {
          e.preventDefault();
          var target = card.getAttribute('data-card');
          if (!dragId || target === dragId) return;
          var after = card.classList.contains('drop-after');
          var ids = order.filter(function (id) { return id !== dragId; });
          var at = ids.indexOf(target) + (after ? 1 : 0);
          ids.splice(at, 0, dragId);
          dragId = null;
          var byId = {};
          grid.querySelectorAll('[data-card]').forEach(function (el) { byId[el.getAttribute('data-card')] = el; });
          ids.forEach(function (id) { grid.appendChild(byId[id]); });
          saveOrder(ids);
        });
      });
      grid.querySelectorAll('[data-move]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-for');
          var step = parseInt(b.getAttribute('data-move'), 10);
          var ids = order.slice();
          var n = ids.indexOf(id);
          var m = n + step;
          if (m < 0 || m >= ids.length) return;
          ids[n] = ids[m]; ids[m] = id;
          saveOrder(ids);
        });
      });
    }
    $('edit-details').addEventListener('click', function () { $('details-form').hidden = false; $('d-name').focus(); });
    $('d-cancel').addEventListener('click', function () { $('details-form').hidden = true; });
    $('details-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var name = $('d-name').value.trim();
      if (!name) return;
      $('d-msg').textContent = 'Saving…';
      var r = await db.from('characters').update({ name: name, bio: $('d-bio').value.trim() || null }).eq('id', c.id);
      if (r.error) { $('d-msg').textContent = 'Could not save: ' + r.error.message; return; }
      loadChars();
    });
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
    document.querySelectorAll('[data-tag]').forEach(function (b) {
      b.addEventListener('click', function () {
        var img = imgs.filter(function (i) { return i.id === b.getAttribute('data-tag'); })[0];
        openTagger(img);
      });
    });
  }

  // ---------- Tag products on a picture ----------
  var tagging = null;
  function openTagger(img) {
    tagging = img;
    var have = {};
    (img.image_products || []).forEach(function (t) { have[t.product_id] = true; });
    $('tag-msg').textContent = '';
    $('tag-list').innerHTML = products.length
      ? '<div class="tag-row tag-photo"><img src="' + esc(window.pntImg(img.url, { w: 160, h: 200, crop: 'fill', gravity: 'auto' })) + '" alt=""></div>' +
        products.map(function (p) {
          return '<label class="tag-row"><input type="checkbox" value="' + p.id + '"' + (have[p.id] ? ' checked' : '') + '>' +
            '<span class="thumb" style="' + (p.image_url ? 'background-image:url(\'' + esc(window.pntImg(p.image_url, { w: 80, h: 80, crop: 'fill' })) + '\')' : '') + '"></span>' +
            '<span class="grow"><strong>' + esc(p.name) + '</strong>' + (p.category ? '<br><span class="muted">' + esc(p.category) + '</span>' : '') + '</span>' +
            '<span>' + money(p.price, p.currency) + '</span></label>';
        }).join('')
      : '<p class="empty" style="padding:24px 0">No products yet. Add them under <strong>Products</strong> first.</p>';
    $('tag-dialog').showModal();
  }
  $('tag-cancel').addEventListener('click', function () { $('tag-dialog').close(); });
  $('tag-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!tagging) return;
    var picked = Array.prototype.map.call($('tag-list').querySelectorAll('input:checked'), function (cb) { return cb.value; });
    var had = (tagging.image_products || []).map(function (t) { return t.product_id; });
    var add = picked.filter(function (id) { return had.indexOf(id) === -1; });
    var remove = had.filter(function (id) { return picked.indexOf(id) === -1; });
    $('tag-msg').textContent = 'Saving…';
    var errs = [];
    if (remove.length) {
      var r1 = await db.from('image_products').delete().eq('image_id', tagging.id).in('product_id', remove);
      if (r1.error) errs.push(r1.error.message);
    }
    if (add.length) {
      var r2 = await db.from('image_products').insert(add.map(function (id) {
        return { image_id: tagging.id, product_id: id, sort: picked.indexOf(id) };
      }));
      if (r2.error) errs.push(r2.error.message);
    }
    if (errs.length) { $('tag-msg').textContent = 'Could not save: ' + errs[0]; return; }
    $('tag-dialog').close();
    loadDetail();
  });

  // ---------- Product inventory ----------
  function money(v, cur) {
    try { return new Intl.NumberFormat('en-CA', { style: 'currency', currency: cur || 'CAD' }).format(Number(v)); }
    catch (e) { return '$' + Number(v).toFixed(2); }
  }
  var productPhoto = null;
  var renamingBrand = null;
  function brandsList() { return chars.filter(function (c) { return c.kind === 'brand'; }); }
  function brandName(id) { var b = chars.filter(function (c) { return c.id === id; })[0]; return b ? b.name : ''; }
  async function createBrand(name) {
    return db.from('characters').insert({
      creator_id: user.id, kind: 'brand', name: name,
      slug: slugify(name) + '-' + Math.random().toString(36).slice(2, 6),
      creator_handle: '@' + (user.email || 'creator').split('@')[0]
    }).select().single();
  }
  function renderProducts() {
    var p = editingProduct;
    productPhoto = p ? p.image_url : null;
    var brands = brandsList();
    $('detail').innerHTML =
      '<div class="detail-head"><div><p class="eyebrow">Inventory</p><h1>Products</h1>' +
      '<p class="muted">Everything your models wear that customers can buy. Tag products on pictures from each character\'s page.</p></div></div>' +
      '<form id="product-form" class="product-form">' +
        '<h2>' + (p ? 'Edit product' : 'Add a product') + '</h2>' +
        '<div class="pf-grid">' +
          '<div class="pf-field pf-wide"><label for="pf-name">Name</label><input id="pf-name" class="field" required maxlength="120" placeholder="e.g. Grey wool blazer" value="' + esc(p ? p.name : '') + '"></div>' +
          '<div class="pf-field"><label for="pf-price">Price (CAD)</label><input id="pf-price" class="field" required type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" value="' + (p ? Number(p.price).toFixed(2) : '') + '"></div>' +
          '<div class="pf-field"><label for="pf-cat">Category</label><input id="pf-cat" class="field" maxlength="40" list="pf-cats" placeholder="Dress, Heels, Watch…" value="' + esc(p && p.category ? p.category : '') + '">' +
            '<datalist id="pf-cats"><option>Dress</option><option>Top</option><option>Jacket</option><option>Coat</option><option>Trousers</option><option>Skirt</option><option>Heels</option><option>Shoes</option><option>Sneakers</option><option>Boots</option><option>Bag</option><option>Purse</option><option>Watch</option><option>Ring</option><option>Necklace</option><option>Earrings</option><option>Bracelet</option><option>Sunglasses</option><option>Hat</option></datalist></div>' +
          '<div class="pf-field"><label for="pf-brand">Brand</label><select id="pf-brand" class="field">' +
            '<option value="">No brand</option>' +
            brands.map(function (b) { return '<option value="' + b.id + '"' + (p && p.brand_id === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') +
            '<option value="__new">+ New brand…</option></select></div>' +
          '<div class="pf-field" id="pf-newbrand-wrap" hidden><label for="pf-newbrand">New brand name</label><input id="pf-newbrand" class="field" maxlength="80" placeholder="e.g. Maison Vale"></div>' +
        '</div>' +
        '<div class="pf-photo"><span id="pf-thumb" class="thumb big" style="' + (productPhoto ? 'background-image:url(\'' + esc(window.pntImg(productPhoto, { w: 160, h: 160, crop: 'fill' })) + '\')' : '') + '"></span>' +
          '<button type="button" id="pf-upload" class="btn">' + (productPhoto ? 'Change photo' : 'Add product photo (optional)') + '</button></div>' +
        '<p id="pf-msg" class="muted" role="status"></p>' +
        '<div class="actions" style="margin:0">' + (p ? '<button type="button" id="pf-cancel" class="btn">Cancel</button>' : '') +
          '<button type="submit" class="btn btn-dark">' + (p ? 'Save changes' : 'Add product') + '</button></div>' +
      '</form>' +
      (products.length
        ? '<div class="product-list" role="list">' + products.map(function (x) {
            return '<div class="product-row" role="listitem">' +
              '<span class="thumb" style="' + (x.image_url ? 'background-image:url(\'' + esc(window.pntImg(x.image_url, { w: 96, h: 96, crop: 'fill' })) + '\')' : '') + '"></span>' +
              '<span class="grow">' + (x.brand_id ? '<span class="brand-label">' + esc(brandName(x.brand_id)) + '</span><br>' : '') + '<strong>' + esc(x.name) + '</strong>' + (x.category ? '<br><span class="muted">' + esc(x.category) + '</span>' : '') + '</span>' +
              '<span class="price">' + money(x.price, x.currency) + '</span>' +
              '<button type="button" class="link" data-pedit="' + x.id + '">Edit</button>' +
              '<button type="button" class="link danger" data-pdel="' + x.id + '">Delete</button>' +
            '</div>';
          }).join('') + '</div>'
        : '<p class="empty">No products yet. Add the first one above.</p>') +
      '<section class="brands-box" aria-labelledby="brands-h"><h2 id="brands-h">Brands</h2>' +
        '<p class="muted" style="margin:0 0 12px">Brands you sell. Each one also has its own page under Brands on the website.</p>' +
        (brands.length ? '<div class="product-list" role="list">' + brands.map(function (b) {
          var count = products.filter(function (x) { return x.brand_id === b.id; }).length;
          if (renamingBrand === b.id) {
            return '<form class="product-row brand-rename" role="listitem" data-bform="' + b.id + '">' +
              '<label class="sr" for="br-' + b.id + '">Brand name</label>' +
              '<input id="br-' + b.id + '" class="field grow" required maxlength="80" value="' + esc(b.name) + '">' +
              '<button type="button" class="link" data-bcancel>Cancel</button><button type="submit" class="btn btn-dark" style="height:40px">Save</button></form>';
          }
          return '<div class="product-row" role="listitem"><span class="grow"><strong>' + esc(b.name) + '</strong><br><span class="muted">' + count + ' product' + (count === 1 ? '' : 's') + '</span></span>' +
            '<button type="button" class="link" data-brename="' + b.id + '">Rename</button>' +
            '<button type="button" class="link danger" data-bdel="' + b.id + '">Delete</button></div>';
        }).join('') + '</div>' : '<p class="muted">No brands yet. Pick "+ New brand…" in the Brand menu above to add one.</p>') +
        '<form id="brand-add" class="brand-add"><label class="sr" for="brand-add-name">New brand name</label>' +
          '<input id="brand-add-name" class="field grow" maxlength="80" placeholder="Add a brand name">' +
          '<button type="submit" class="btn">Add brand</button></form>' +
        '<p id="brand-msg" class="muted" role="status"></p>' +
      '</section>';

    $('pf-brand').addEventListener('change', function () {
      var isNew = $('pf-brand').value === '__new';
      $('pf-newbrand-wrap').hidden = !isNew;
      if (isNew) $('pf-newbrand').focus();
    });
    $('brand-add').addEventListener('submit', async function (e) {
      e.preventDefault();
      var name = $('brand-add-name').value.trim();
      if (!name) return;
      var r = await createBrand(name);
      if (r.error) { $('brand-msg').textContent = 'Could not add: ' + r.error.message; return; }
      loadChars();
    });
    document.querySelectorAll('[data-brename]').forEach(function (b) {
      b.addEventListener('click', function () { renamingBrand = b.getAttribute('data-brename'); renderProducts(); $('br-' + renamingBrand).focus(); });
    });
    document.querySelectorAll('[data-bcancel]').forEach(function (b) {
      b.addEventListener('click', function () { renamingBrand = null; renderProducts(); });
    });
    document.querySelectorAll('[data-bform]').forEach(function (f) {
      f.addEventListener('submit', async function (e) {
        e.preventDefault();
        var id = f.getAttribute('data-bform');
        var name = $('br-' + id).value.trim();
        if (!name) return;
        var r = await db.from('characters').update({ name: name }).eq('id', id);
        if (r.error) { $('brand-msg').textContent = 'Could not rename: ' + r.error.message; return; }
        renamingBrand = null;
        loadChars();
      });
    });
    document.querySelectorAll('[data-bdel]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.getAttribute('data-bdel');
        var count = products.filter(function (x) { return x.brand_id === id; }).length;
        var msg = 'Delete the brand "' + brandName(id) + '"?\n\n' +
          (count ? count + ' product' + (count === 1 ? '' : 's') + ' will be kept but show no brand.\n' : '') +
          'The brand\'s page and any pictures uploaded to it will be removed.';
        if (!confirm(msg)) return;
        var r = await db.from('characters').delete().eq('id', id);
        if (r.error) { $('brand-msg').textContent = 'Could not delete: ' + r.error.message; return; }
        if (editingProduct && editingProduct.brand_id === id) editingProduct.brand_id = null;
        loadChars();
      });
    });

    $('pf-upload').addEventListener('click', function () {
      if (!window.cloudinary) { alert('The uploader did not load. Refresh and try again.'); return; }
      window.cloudinary.createUploadWidget({
        cloudName: cfg.cloudinaryCloud, uploadPreset: cfg.cloudinaryPreset,
        folder: cfg.cloudinaryFolder + '/products', sources: ['local', 'url'], multiple: false,
        maxFileSize: 10000000, clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp']
      }, function (err, result) {
        if (!err && result.event === 'success') {
          productPhoto = result.info.secure_url;
          $('pf-thumb').style.backgroundImage = "url('" + window.pntImg(productPhoto, { w: 160, h: 160, crop: 'fill' }) + "')";
          $('pf-upload').textContent = 'Change photo';
        }
      }).open();
    });
    if ($('pf-cancel')) $('pf-cancel').addEventListener('click', function () { editingProduct = null; renderProducts(); });
    $('product-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var row = {
        name: $('pf-name').value.trim(),
        price: Math.round(parseFloat($('pf-price').value) * 100) / 100,
        category: $('pf-cat').value.trim() || null,
        image_url: productPhoto || null
      };
      if (!row.name || !(row.price >= 0)) { $('pf-msg').textContent = 'Enter a name and a price.'; return; }
      $('pf-msg').textContent = 'Saving…';
      var brandSel = $('pf-brand').value;
      if (brandSel === '__new') {
        var bn = $('pf-newbrand').value.trim();
        if (!bn) { $('pf-msg').textContent = 'Type the new brand name, or pick a brand.'; return; }
        var nb = await createBrand(bn);
        if (nb.error) { $('pf-msg').textContent = 'Could not add brand: ' + nb.error.message; return; }
        row.brand_id = nb.data.id;
      } else {
        row.brand_id = brandSel || null;
      }
      var r = editingProduct
        ? await db.from('products').update(row).eq('id', editingProduct.id)
        : await db.from('products').insert(Object.assign({ creator_id: user.id, currency: 'CAD' }, row));
      if (r.error) { $('pf-msg').textContent = 'Could not save: ' + r.error.message; return; }
      editingProduct = null;
      loadChars();
    });
    document.querySelectorAll('[data-pedit]').forEach(function (b) {
      b.addEventListener('click', function () {
        editingProduct = products.filter(function (x) { return x.id === b.getAttribute('data-pedit'); })[0];
        renderProducts();
        $('pf-name').focus();
      });
    });
    document.querySelectorAll('[data-pdel]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('Delete this product? It will also be removed from every picture it is tagged on.')) return;
        await db.from('products').delete().eq('id', b.getAttribute('data-pdel'));
        loadChars();
      });
    });
  }

  function openUpload(c) {
    if (!window.cloudinary) { alert('The uploader did not load. Refresh and try again.'); return; }
    var nextSort = maxSort;
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
        nextSort += 1;
        await db.from('images').insert({
          sort: nextSort,
          character_id: c.id, creator_id: user.id, url: info.secure_url,
          public_id: info.public_id, width: info.width, height: info.height, is_live: false
        });
      }
      if (result.event === 'close' || result.event === 'queues-end') loadDetail();
    });
    widget.open();
  }
})();
