// Forgiving search: typos, swapped letters, partial words and related words.
(function () {
  var SYNONYMS = {
    purse: ['bag', 'handbag', 'clutch', 'tote'], bag: ['purse', 'handbag', 'clutch', 'tote'],
    handbag: ['purse', 'bag'], clutch: ['purse', 'bag'], tote: ['bag', 'purse'],
    heels: ['heel', 'pumps', 'stilettos', 'shoes'], heel: ['heels', 'pumps', 'shoes'], hills: ['heels'],
    shoes: ['shoe', 'heels', 'sneakers', 'boots', 'loafers', 'sandals'], shoe: ['shoes'],
    sneakers: ['trainers', 'shoes'], trainers: ['sneakers'],
    necklace: ['chain', 'pendant', 'neckless'], neckless: ['necklace'], chain: ['necklace'], pendant: ['necklace'],
    earrings: ['earring', 'studs', 'hoops'], ring: ['rings'], rings: ['ring'],
    bracelet: ['bangle', 'cuff'], watch: ['watches', 'timepiece'], watches: ['watch'],
    dress: ['gown', 'dresses'], gown: ['dress'], dresses: ['dress'],
    jacket: ['blazer', 'coat'], blazer: ['jacket', 'suit'], coat: ['jacket', 'overcoat', 'trench'],
    pants: ['trousers'], trousers: ['pants'], top: ['shirt', 'blouse', 'tee'], shirt: ['top', 'blouse'],
    sunglasses: ['shades', 'glasses'], glasses: ['sunglasses'], hat: ['cap'], jewelry: ['necklace', 'ring', 'earrings', 'bracelet'],
    jewellery: ['necklace', 'ring', 'earrings', 'bracelet']
  };

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function words(s) { return norm(s).split(' ').filter(Boolean); }

  // Edit distance that counts a swap of two neighbouring letters as one typo.
  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var d = [];
    for (var i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (var j = 0; j <= b.length; j++) { d[0][j] = j; }
    for (i = 1; i <= a.length; i++) {
      var rowMin = Infinity;
      for (j = 1; j <= b.length; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        if (d[i][j] < rowMin) rowMin = d[i][j];
      }
      if (rowMin > max) return max + 1;
    }
    return d[a.length][b.length];
  }
  function allowed(len) { return len <= 3 ? 0 : len <= 5 ? 1 : 2; }

  // How well one typed word matches one word of the item (0 = no match).
  function wordScore(t, w) {
    if (t === w) return 3;
    if (t.length >= 2 && w.indexOf(t) === 0) return 2.5;
    if (t.length >= 3 && w.indexOf(t) > -1) return 2;
    var max = allowed(Math.max(t.length, w.length));
    if (max) {
      var dist = distance(t, w, max);
      if (dist <= max) return dist === 1 ? 1.6 : 1.1;
      // typo in a partly typed word: compare against the start of the word
      if (t.length >= 4 && w.length > t.length) {
        var pd = distance(t, w.slice(0, t.length), 1);
        if (pd <= 1) return 1.3;
      }
    }
    return 0;
  }
  function tokenScore(t, itemWords) {
    var best = 0, i;
    for (i = 0; i < itemWords.length; i++) best = Math.max(best, wordScore(t, itemWords[i]));
    if (best < 3) {
      // related words, using the typed word or the word it was probably meant to be
      var keys = Object.keys(SYNONYMS);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        if (key !== t && wordScore(t, key) < 1.6) continue;
        var rel = SYNONYMS[key];
        for (var r = 0; r < rel.length; r++) {
          for (i = 0; i < itemWords.length; i++) if (wordScore(rel[r], itemWords[i]) >= 2.5) best = Math.max(best, 1.0);
        }
      }
    }
    return best;
  }

  // items: [{ text: 'all searchable words', boost: number, ... }]
  window.pntSearch = function (query, items) {
    var tokens = words(query);
    if (!tokens.length) return [];
    var scored = items.map(function (it) {
      var w = it._w || (it._w = words(it.text));
      var per = tokens.map(function (t) { return tokenScore(t, w); });
      return { item: it, all: per.every(function (x) { return x > 0; }), score: per.reduce(function (a, b) { return a + b; }, 0) + (it.boost || 0) };
    });
    var strict = scored.filter(function (s) { return s.all; });
    var pool = strict.length ? strict : scored.filter(function (s) { return s.score > (s.item.boost || 0); });
    return pool.sort(function (a, b) { return b.score - a.score; }).map(function (s) { return s.item; });
  };
})();
