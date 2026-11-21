// Public settings. The Supabase publishable key is safe to expose: row-level security protects the data.
window.PNT_CONFIG = {
  supabaseUrl: 'https://fpgktoqgkehvwrevcfyr.supabase.co',
  supabaseKey: 'sb_publishable_4epinU41OovBfw-6Xivxeg_aavw6HXm',
  cloudinaryCloud: 'zpxojdqe',
  cloudinaryPreset: 'pin_not_terest_unsigned',
  cloudinaryFolder: 'pin-not-terest'
};
window.pntDb = window.supabase.createClient(window.PNT_CONFIG.supabaseUrl, window.PNT_CONFIG.supabaseKey);

// Cloudinary delivery helper: resize/crop on the fly.
window.pntImg = function (url, opts) {
  if (!url || url.indexOf('/image/upload/') === -1) return url;
  var t = ['f_auto', 'q_auto'];
  if (opts && opts.w) t.push('w_' + opts.w);
  if (opts && opts.h) t.push('h_' + opts.h);
  if (opts && opts.crop) t.push('c_' + opts.crop);
  if (opts && opts.gravity && opts.crop) t.push('g_' + opts.gravity);
  return url.replace('/image/upload/', '/image/upload/' + t.join(',') + '/');
};

// Friendly sign-in email errors + a short cooldown so repeated taps don't burn the email allowance.
window.pntEmailLink = async function (db, email, redirect, msgEl, btn) {
  var key = 'pnt_last_link_' + email.toLowerCase();
  var last = 0; try { last = Number(localStorage.getItem(key) || 0); } catch (e) {}
  var wait = 60 - Math.floor((Date.now() - last) / 1000);
  if (wait > 0) { msgEl.textContent = 'We just sent a link to ' + email + '. Check your inbox and spam folder. You can ask for a new one in ' + wait + ' seconds.'; return; }
  msgEl.textContent = 'Sending…';
  if (btn) btn.disabled = true;
  var r = await db.auth.signInWithOtp({ email: email, options: { emailRedirectTo: redirect } });
  if (btn) setTimeout(function () { btn.disabled = false; }, 3000);
  if (!r.error) {
    try { localStorage.setItem(key, String(Date.now())); localStorage.setItem('pnt_last_email', email); } catch (e) {}
    msgEl.textContent = 'Check your email for the sign-in link (also your spam folder). The link works once; if you use it in a different browser tab, close the old tabs.';
    return;
  }
  var m = (r.error.message || '').toLowerCase();
  if (r.error.status === 429 || m.indexOf('rate limit') > -1) {
    msgEl.textContent = 'Too many sign-in emails have been sent in the last hour. Please try again in a little while' + (document.getElementById('google-login') || document.getElementById('signin-google') ? ', or use Continue with Google.' : '.');
  } else if (m.indexOf('invalid') > -1 && m.indexOf('email') > -1) {
    msgEl.textContent = 'That email address doesn\u2019t look right. Please check it.';
  } else {
    msgEl.textContent = 'We couldn\u2019t send the link right now. Please try again in a minute.';
  }
};

// "Welcome back, Name" — a 1-second banner at the top, once per visit.
window.pntWelcome = async function (db, user) {
  if (!user) return;
  var key = 'pnt_welcomed_' + user.id;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (e) {}
  var name = '';
  try {
    var r = await db.from('creators').select('display_name').eq('id', user.id).maybeSingle();
    name = (r.data && r.data.display_name) || '';
  } catch (e) {}
  var emailName = (user.email || '').split('@')[0];
  var googleName = user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name);
  // Shoppers' saved name defaults to their email; a real name from Google reads better.
  if (googleName && (!name || name === emailName)) name = googleName;
  if (!name) name = emailName;
  name = String(name).trim().split(/[\s._-]+/)[0] || '';
  if (name) name = name.charAt(0).toUpperCase() + name.slice(1);
  var el = document.createElement('div');
  el.className = 'welcome-pop';
  el.setAttribute('role', 'status');
  el.textContent = name ? 'Welcome back ' + name : 'Welcome back';
  document.body.appendChild(el);
  requestAnimationFrame(function () { el.classList.add('in'); });
  setTimeout(function () { el.classList.remove('in'); }, 1200);
  setTimeout(function () { el.remove(); }, 1600);
};

// Fill in the email last used on this device, so people don't retype it.
window.pntPrefillEmail = function (input) {
  if (!input || input.value) return;
  try { var e = localStorage.getItem('pnt_last_email'); if (e) input.value = e; } catch (err) {}
};
