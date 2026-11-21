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
