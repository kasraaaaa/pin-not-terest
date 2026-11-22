// One sign-in flow for everyone, on the shop and the creator page:
// 1) "Are you a shopper or a creator?"  2) the same options for both: Google or an email link.
// After signing in, shoppers return to what they were doing; creators go to setup or their dashboard.
(function () {
  var GOOGLE_SVG = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  var ROLES = {
    shopper: { title: 'I’m a shopper', text: 'Follow models’ styles and buy what they wear.', icon: '<path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/>' },
    creator: { title: 'I’m a creator', text: 'Build AI models and sell your own pieces.', icon: '<path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8 9.5 8z"/>' }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function setIntent(role) {
    try { localStorage.setItem('pnt_intent', JSON.stringify({ role: role, at: Date.now() })); } catch (e) {}
  }
  function takeIntent() {
    var v = null;
    try { v = JSON.parse(localStorage.getItem('pnt_intent') || 'null'); localStorage.removeItem('pnt_intent'); } catch (e) {}
    if (!v || Date.now() - (v.at || 0) > 2 * 60 * 60 * 1000) return null;
    return v.role;
  }

  // Renders the two steps into `box`. opts: { db, why, returnUrl, heading }
  function mount(box, opts) {
    var role = opts.role || null;   // a preset role skips the question (e.g. "Start selling my products")
    function step1() {
      box.innerHTML =
        '<div class="si">' +
          '<h2 class="si-title">' + esc(opts.heading || 'Welcome to Pin Not Terest') + '</h2>' +
          (opts.why ? '<p class="muted si-why">' + esc(opts.why) + '</p>' : '') +
          '<p class="si-q" id="si-q">Are you a shopper or a creator?</p>' +
          '<div class="si-roles" role="group" aria-labelledby="si-q">' +
            ['shopper', 'creator'].map(function (r) {
              var x = ROLES[r];
              return '<button type="button" class="si-role" data-role="' + r + '">' +
                '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + x.icon + '</svg>' +
                '<span><strong>' + x.title + '</strong><span class="muted">' + x.text + '</span></span></button>';
            }).join('') +
          '</div>' +
          '<p class="muted si-note">You can switch to creator mode later at any time.</p>' +
        '</div>';
      box.querySelectorAll('[data-role]').forEach(function (b) {
        b.addEventListener('click', function () { role = b.getAttribute('data-role'); step2(); });
      });
    }
    function step2() {
      var x = ROLES[role];
      box.innerHTML =
        '<div class="si">' +
          (opts.role ? '' : '<button type="button" class="link si-back" id="si-back">← Back</button>') +
          '<h2 class="si-title">' + (opts.role === 'creator' ? 'Start selling on Pin Not Terest' : role === 'creator' ? 'Sign in as a creator' : 'Sign in as a shopper') + '</h2>' +
          '<p class="muted si-why">New here? Signing in creates your account. No password needed.</p>' +
          '<button type="button" class="btn google-btn" id="si-google">' + GOOGLE_SVG + ' Continue with Google</button>' +
          '<div class="divider"><span>or</span></div>' +
          '<form id="si-form" class="stack" style="margin-top:0">' +
            '<label for="si-email">Email</label>' +
            '<input id="si-email" type="email" name="email" required autocomplete="email" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="send" class="field">' +
            '<button type="submit" class="btn btn-dark">Email me a sign-in link</button>' +
          '</form>' +
          '<p id="si-msg" class="muted" role="status" style="margin:0"></p>' +
        '</div>';
      window.pntPrefillEmail(box.querySelector('#si-email'));
      if (box.querySelector('#si-back')) box.querySelector('#si-back').addEventListener('click', step1);
      box.querySelector('#si-google').addEventListener('click', async function () {
        setIntent(role);
        var r = await opts.db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: opts.returnUrl, queryParams: { prompt: 'select_account' } } });
        if (r.error) box.querySelector('#si-msg').textContent = 'Google sign-in isn’t available yet. Please use the email link instead.';
      });
      box.querySelector('#si-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        setIntent(role);
        var email = box.querySelector('#si-email').value.trim();
        await window.pntEmailLink(opts.db, email, opts.returnUrl, box.querySelector('#si-msg'), e.target.querySelector('button[type=submit]'));
      });
      var first = box.querySelector('#si-google'); if (first) first.focus();
    }
    if (role) step2(); else step1();
  }

  window.pntSignIn = { mount: mount, takeIntent: takeIntent, setIntent: setIntent };
})();
