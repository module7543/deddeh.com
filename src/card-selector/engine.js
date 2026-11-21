// Read-only excerpt of CardSelector's search, grouping, sort and reward logic.
// The demo uses its own wallet and a fixed statement date.
import { data, wallet, statementDate } from './wallet.js';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const CHANNEL_OK = { store: ['in_store', 'in_store_and_online', 'in_store_and_app', 'pay_at_pump'], online: ['online', 'in_store_and_online', 'in_store_and_app'] };
const ACT_OK = { ready: ['already_activated', 'auto_enrolled', 'none_shown'], needs: ['needs_activation', 'add_to_card'] };
const cards = new Map(wallet.map(card => [card.name, card]));

function chanIn(mode, o) {
  if (mode === "any") return true;
  let c = o.channel || "none_shown";
  return c === "none_shown" || CHANNEL_OK[mode].indexOf(c) !== -1;
}

const actOf = offer => offer.activation || 'none_shown';

function actIn(mode, o) { return mode === "any" || ACT_OK[mode].indexOf(actOf(o)) !== -1; }

function spaced(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}
function compact(s) { return spaced(s).replace(/ /g, ""); }

function bonusRank(text) {
  let s = (text || "").toLowerCase(), m, up = isUpTo(s);
  if (isDiscount(s)) {
    if ((m = /(\d+(?:\.\d+)?)\s*%/.exec(s))) return [0.6, +m[1]];
    if ((m = /\$\s*(\d+(?:\.\d+)?)/.exec(s))) return [0.4, +m[1]];
    return [0, 0];
  }
  if ((m = /(\d+(?:\.\d+)?)\s*%/.exec(s)) || (m = /(\d+(?:\.\d+)?)\s*x\b/.exec(s))) return [up ? 4 : 5, +m[1]];
  if ((m = /earn\s*\$\s*(\d+(?:\.\d+)?)/.exec(s)) || (m = /\$\s*(\d+(?:\.\d+)?)/.exec(s))) return [up ? 2 : 3, +m[1]];
  return [1, 0];
}
function isDiscount(lower) { return /^\s*save\b/.test(lower); }
function isUpTo(lower) { return /^\s*up to\b/.test(lower); }
function rankOf(o) { return o._rank || (o._rank = bonusRank(o.bonus)); }
function byBonusDesc(a, b) {
  let x = rankOf(a), y = rankOf(b);
  return (y[0] - x[0]) || (y[1] - x[1]) || byMerchant(a, b);
}

function metrics(o) {
  if (o._m) return o._m;
  let s = (o.bonus || "").toLowerCase(), m, pct = null, dollar = null, rate = null;
  if (isDiscount(s)) return (o._m = { percent: null, dollar: null, rate: null, upTo: false });
  if ((m = /(\d+(?:\.\d+)?)\s*%/.exec(s))) pct = +m[1];
  if ((m = /earn\s*\$\s*(\d+(?:\.\d+)?)/.exec(s)) || (pct === null && (m = /\$\s*(\d+(?:\.\d+)?)/.exec(s)))) dollar = +m[1];
  let sp = /spend\s*\$\s*(\d+(?:\.\d+)?)/.exec(s);
  if (pct !== null) rate = pct;
  else if (dollar !== null && sp && +sp[1] > 0) rate = dollar / +sp[1] * 100;
  return (o._m = { percent: pct, dollar: dollar, rate: rate, upTo: isUpTo(s) });
}

function byMerchant(a, b) {
  return collator.compare(a.merchant, b.merchant) ||
         (a.merchant < b.merchant ? -1 : a.merchant > b.merchant ? 1 : 0) || collator.compare(a.card, b.card);
}

function wordForm(s) { return spaced(s.replace(/['\u2018\u2019\u02bc`\u00b4]/g, "")); }

function sameWord(a, b, strict) { return !!a && !!b && (a === b || (!strict && (a === b + "s" || b === a + "s"))); }
function wholeQuery(query) {
  let s = wordForm(query || "");
  return { words: s ? s.split(" ") : [], c: s.replace(/ /g, "") };
}

function wholeWordName(n, q, strict) {
  let ws = n.w.split(" ");
  if (q.words.length && q.words.every(function (w) { return ws.some(function (x) { return sameWord(w, x, strict); }); })) return true;
  for (let i = 0; i < ws.length; i++) {
    for (let j = i, acc = ""; j < ws.length && acc.length < q.c.length; j++) { acc += ws[j]; if (sameWord(acc, q.c, strict)) return true; }
  }
  return false;
}

function wholeLevel(count) {
  let n = count(false);
  if (n >= 1 && n <= 3) return "loose";
  if (n > 3) { let m = count(true); if (m >= 1 && m <= 3) return "strict"; }
  return null;
}

function bestKey(o) {
  let r = rankOf(o), t = (r[0] === 5 || r[0] === 4) ? offerTotal(o) : null;
  return t ? [r[0], t.total] : r;
}
function byTotalDesc() {
  return function (a, b) {
    let x = bestKey(a), y = bestKey(b);
    return (y[0] - x[0]) || (y[1] - x[1]) || byMerchant(a, b);
  };
}

function comparator(mode, query, pool) {
  let val, dir = -1, upTo = mode === "percent" || mode === "dollar" || mode === "rate";
  if (mode === "best") {
    let wq = wholeQuery(query);
    let byTotal = byTotalDesc();
    if (!compact(query || "") || !pool) return byTotal;
    let missBy = function (strict) {
      let memo = {};
      return function (o) {
        if (!(o.id in memo)) memo[o.id] = nameKeys(o).some(function (n) { return wholeWordName(n, wq, strict); }) ? 0 : 1;
        return memo[o.id];
      };
    };
    let miss = { loose: missBy(false), strict: missBy(true) };
    let level = wholeLevel(function (strict) {
      let keys = {}, n = 0, m = miss[strict ? "strict" : "loose"];
      pool.forEach(function (o) { if (!m(o) && !keys[containerKey(o)]) { keys[containerKey(o)] = 1; n++; } });
      return n;
    });
    if (!level) return byTotal;
    let mx = miss[level];
    return function (a, b) { return (mx(a) - mx(b)) || byTotal(a, b); };
  }
  if (mode === "percent" || mode === "dollar" || mode === "rate") val = function (o) { return metrics(o)[mode]; };
  else if (mode === "newest") val = function (o) { return o.first_seen || null; };
  else if (mode === "oldest") { val = function (o) { return o.first_seen || null; }; dir = 1; }
  else if (mode === "expiring") { val = function (o) { return o.expires || null; }; dir = 1; }
  else if (mode === "az") return function (a, b) { return byMerchant(a, b) || byBonusDesc(a, b); };
  else if (mode === "za") return function (a, b) { return byMerchant(b, a) || byBonusDesc(a, b); };
  else return byBonusDesc;
  return function (a, b) {
    let x = val(a), y = val(b);
    if (x === null || y === null) return x === y ? byBonusDesc(a, b) : (x === null ? 1 : -1);
    if (upTo && metrics(a).upTo !== metrics(b).upTo) return metrics(a).upTo ? 1 : -1;
    return x === y ? byMerchant(a, b) : (x < y ? -dir : dir);
  };
}

function isLive(o, today) {
  return o.status === "active" && !(o.expires && o.expires < today);
}

function nameKeys(o) {
  if (!o._names) {
    o._names = [o.merchant].concat(o.aliases || []).map(function (n) { return { c: compact(n), s: spaced(n), w: wordForm(n) }; });
  }
  return o._names;
}

function containerKey(o) { return compact(o.merchant.replace(/\.(com|net|org)\b/gi, '')); }

function search(query, keep) {
  let qc = compact(query), qs = spaced(query);
  let words = qs ? qs.split(" ") : [], multi = words.length > 1;
  let groups = {};
  data.offers.forEach(function (o) {
    if (!keep(o)) return;
    let names = nameKeys(o), rank = 4;
    for (let i = 0; i < names.length; i++) {
      let at = names[i].c.indexOf(qc), r;
      if (at !== -1) r = at === 0 ? 0 : (" " + names[i].s).indexOf(" " + qs) !== -1 ? 1 : 2;
      else if (multi && words.every(function (w) { return names[i].c.indexOf(w) !== -1; })) r = 2.5;
      else continue;
      if (r < rank) rank = r;
    }
    if (rank === 4) return;
    let key = containerKey(o);
    let g = groups[key] || (groups[key] = { rank: rank, name: names[0].s, offers: [] });
    g.rank = Math.min(g.rank, rank);
    g.offers.push(o);
  });
  let list = Object.keys(groups).map(function (k) { return groups[k]; })
    .sort(function (a, b) { return (a.rank - b.rank) || a.name.localeCompare(b.name); });
  let out = list.reduce(function (acc, g) { return acc.concat(g.offers.sort(byBonusDesc)); }, []);
  return out;
}

export function activation(o) {
  if (actOf(o) === "add_to_card") return ["Add to card", "needs"];
  if (o.activation === "needs_activation") return ["Needs activation", "needs"];
  if (o.activation === "already_activated") return ["Already activated", "done"];
  if (o.activation === "auto_enrolled") return ["Auto-enrolled", "done"];
  if (o.activation === "via_shop_link") return ["Via shop link", "needs"];
  return ["Activation not listed", ""];
}
export function channel(o) {
  if (o.channel === "in_store") return "In-store";
  if (o.channel === "online") return "Online";
  if (o.channel === "pay_at_pump") return "Pay at pump";
  if (o.channel === "in_store_and_online") return "In-store & online";
  if (o.channel === "in_store_and_app") return "In-store & in-app";
  return null;
}

function containersOf(list, mode) {
  let by = Object.create(null), out = [];
  list.forEach(function (o) {
    let k = containerKey(o), c = by[k];
    if (!c) { c = by[k] = { key: k, rows: [], at: out.length }; out.push(c); }
    c.rows.push(o);
  });
  out.forEach(function (c) { c.name = mcName(c.rows); });
  if (mode === "az" || mode === "za") {
    let dir = mode === "az" ? 1 : -1;
    out.sort(function (a, b) {
      return dir * (collator.compare(a.name, b.name) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) || a.at - b.at;
    });
  }
  return out;
}

function mcName(rows) {
  let n = {};
  rows.forEach(function (o) { n[o.merchant] = (n[o.merchant] || 0) + 1; });
  return Object.keys(n).sort(function (a, b) { return (n[b] - n[a]) || collator.compare(a, b) || (a < b ? -1 : 1); })[0];
}

function offerValue(o) {
  let s = (o.bonus || "").toLowerCase(), m = metrics(o), up = /^\s*up to\b/.test(s);
  if (isDiscount(s)) return { kind: "discount" };
  if (m.percent !== null) return { kind: "pct", pct: m.percent, upTo: up };
  if (m.dollar !== null) {
    let sp = /spend\s*\$\s*(\d+(?:\.\d+)?)/.exec(s);
    let min = sp ? +sp[1] : /^\d+(\.\d+)?$/.test(o.minimum_spend || "") && +o.minimum_spend > 0 ? +o.minimum_spend : null;
    return { kind: "dollar", amt: m.dollar, min: min, upTo: up };
  }
  return { kind: "other" };
}

// The sample wallet has standing and everyday rates. A quick pick matches the
// purchase topic directly. A merchant gets its category from its offers.
function rateAt(C, M) {
  let ready = { rate: C.base_rate, label: null, cat: false };
  for (const group of C.standing) {
    const matches = M.topic ? M.topic === group.name : (M.all || M.offers).some(o => group.app_categories.includes(o.category));
    if (matches && group.rate > ready.rate) ready = { rate: group.rate, label: group.name, cat: true };
  }
  return ready;
}

function offerTotal(o) {
  const v = offerValue(o), C = cards.get(o.card);
  if (v.kind !== 'pct' || !C) return null;
  const base = rateAt(C, { offers: [o] });
  return { total: v.pct + base.rate, pct: v.pct, rate: base.rate, C };
}

function pick(list) {
  if (!list.length) return null;
  let top = Math.max.apply(null, list.map(function (c) { return c.total; }));
  let seen = [], wins = [];
  list.map(function (c, i) { return { c: c, i: i }; }).filter(function (w) { return w.c.total === top; })
    .sort(function (a, b) {
      return ((a.c.act ? 1 : 0) - (b.c.act ? 1 : 0)) ||
        ((b.c.o ? 1 : 0) - (a.c.o ? 1 : 0)) || (wallet.indexOf(a.c.C) - wallet.indexOf(b.c.C)) || a.i - b.i;
    })
    .forEach(function (w) { if (seen.indexOf(w.c.C) === -1) { seen.push(w.c.C); wins.push(w.c); } });
  return { total: top, wins: wins };
}

// As in the phone app, every card's standing rate is a ready candidate. A
// percent offer adds to that rate. A dollar reward keeps its minimum spend.
function merchantTotals(merchant, scope) {
  const ready = scope.map(C => {
    const base = rateAt(C, merchant);
    return { C, base, total: base.rate };
  });
  const after = [], deals = [];
  for (const o of merchant.offers) {
    const C = cards.get(o.card);
    if (!scope.includes(C)) continue;
    const base = rateAt(C, merchant), v = offerValue(o);
    const candidate = { C, base, o, v };
    if (v.kind === 'pct' && !v.upTo) {
      candidate.total = base.rate + v.pct;
      (actIn('ready', o) ? ready : after).push(candidate);
    } else if (v.kind === 'dollar' && !v.upTo) {
      candidate.value = v.min ? v.amt / v.min * 100 + base.rate : null;
      deals.push(candidate);
    }
  }
  return { ready: pick(ready), after: pick(after), deals };
}

export function lookup({ query = '', where = 'any', active = 'any', sort = 'best', card = '', category = '' } = {}) {
  const keep = o => isLive(o, statementDate) && (!card || o.card === card) && (!category || o.category === category);
  const pool = search(query, keep);
  const hits = pool.filter(o => chanIn(where, o) && actIn(active, o));
  const groups = containersOf(hits.sort(comparator(sort, query, hits)), sort);
  const candidates = card ? [cards.get(card)] : wallet;
  const matching = containersOf(pool, 'best');
  let recommendation = null;
  if (query.trim() && matching.length === 1) {
    const group = matching[0];
    recommendation = merchantTotals({ all: group.rows, offers: group.rows.filter(o => chanIn(where, o)) }, candidates);
    recommendation.merchant = group.name;
  }
  return { groups, recommendation, count: hits.length };
}

export function quickPick(topic) {
  return merchantTotals({ topic, offers: [] }, wallet).ready;
}
