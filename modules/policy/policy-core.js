/* =====================================================================================================================
   Vriddhi · POLICY MODULE · CORE        modules/policy/policy-core.js

   The SINGLE SOURCE OF TRUTH for insurance-policy data and for every policy calculation.

   * Data      : the policies live in the plan document (S.policies) so they are saved, synced, backed up and undone
                 together with the rest of the plan. Nothing outside this file reads or writes S.policies directly.
   * Other modules (Goal Planner, Retirement Planner, reports) only ever call the small API at the bottom of this file
     (window.VRPolicy). Each one can be switched off per module in the Policies > Dashboard settings.
   * Premiums are tracked here for the Policies module only; they never change a Goal Planner or Retirement Planner
     number. Payouts and maturity amounts are INCOME, not investment value: they never enter holding balances.

   A policy:  { id, name, amt, freq, start, yrs, lump, note, ca, ma,               payout side (unchanged since v2.6)
                insurer, no, sa, prem:{amt,freq,start,yrs}, paid:{'YYYY-MM-DD':1} }   optional, added by this module
     amt     paid every period (monthly | quarterly | halfyearly | yearly) from `start`, for `yrs` years
     lump    one maturity lump sum on start + yrs years (optional)
     prem    premium plan: amt every period (or once when freq is 'single') from prem.start for prem.yrs years
     paid    premium due dates the owner has marked as paid
   ===================================================================================================================== */
(function (root) {
  'use strict';

  var PFREQ = { monthly: 12, quarterly: 4, halfyearly: 2, yearly: 1 };
  var PSTEP = { monthly: 1, quarterly: 3, halfyearly: 6, yearly: 12 };
  var PFN = { monthly: 'Monthly', quarterly: 'Quarterly', halfyearly: 'Half-yearly', yearly: 'Yearly', single: 'Single premium' };
  var FREQ = [['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['halfyearly', 'Half-yearly'], ['yearly', 'Yearly']];
  var PMAX = 30;
  var MSN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- small helpers (no dependency on the rest of the app) ---------- */
  function num(v, lo, hi, dv) { v = +v; return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dv; }
  function todayISO() { var t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); }
  function pDate(t) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t || ''); if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1990 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    if (new Date(Date.UTC(y, mo - 1, d)).getUTCMonth() !== mo - 1) return null;
    return { y: y, mo: mo, d: d };
  }
  /* the date `add` months after st (day clipped to the month length); ix = year*12 + month0 */
  function pAt(st, add) {
    var ix = st.y * 12 + st.mo - 1 + add, y = Math.floor(ix / 12), mo = ix % 12;
    var dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate(), d = Math.min(st.d, dim);
    return { ix: ix, y: y, mo: mo + 1, d: d, date: y + '-' + String(mo + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0') };
  }
  function fmtDate(t) { var d = pDate(t); return d ? d.d + ' ' + MSN[d.mo - 1] + ' ' + d.y : '\u2014'; }
  function fyStart(ix) { return Math.floor((ix - 3) / 12); }               /* financial year (1 April) a month index falls in */
  function fyLabel(y) { return 'FY ' + y + '-' + String(y + 1).slice(2); }
  function cur() { return typeof S !== 'undefined' ? S : null; }           /* the open plan (S is the app's state) */
  function all() { var s = cur(); return s && Array.isArray(s.policies) ? s.policies : []; }

  /* ---------- schedules ---------- */
  /* payouts: `amt` every period from `start` for `yrs` years, then the optional maturity `lump` on start + yrs years */
  function schedule(p) {
    var out = [], st = p && pDate(p.start);
    if (!st || !PFREQ[p.freq]) return out;
    var yrs = Math.round(+p.yrs) || 0, n = PFREQ[p.freq] * yrs, step = PSTEP[p.freq];
    if (p.amt > 0) for (var k = 0; k < n; k++) { var t = pAt(st, k * step); out.push({ n: k + 1, ix: t.ix, date: t.date, amt: +p.amt, kind: 'payout' }); }
    if (p.lump > 0 && yrs > 0) { var u = pAt(st, yrs * 12); out.push({ n: n + 1, ix: u.ix, date: u.date, amt: +p.lump, kind: 'lump' }); }
    return out;
  }
  /* premiums: prem.amt every period from prem.start for prem.yrs years (a single premium is paid once) */
  function premSchedule(p) {
    var out = [], q = p && p.prem;
    if (!q || !(q.amt > 0)) return out;
    var st = pDate(q.start); if (!st) return out;
    if (q.freq === 'single') { var t0 = pAt(st, 0); out.push({ n: 1, ix: t0.ix, date: t0.date, amt: +q.amt, kind: 'premium' }); return out; }
    if (!PFREQ[q.freq]) return out;
    var yrs = Math.round(+q.yrs) || 0, n = PFREQ[q.freq] * yrs, step = PSTEP[q.freq];
    for (var k = 0; k < n; k++) { var t = pAt(st, k * step); out.push({ n: k + 1, ix: t.ix, date: t.date, amt: +q.amt, kind: 'premium' }); }
    return out;
  }
  function totals(p) {
    var L = schedule(p);
    return {
      count: L.filter(function (e) { return e.kind === 'payout'; }).length,
      pay: L.reduce(function (q, e) { return q + (e.kind === 'payout' ? e.amt : 0); }, 0),
      lump: L.reduce(function (q, e) { return q + (e.kind === 'lump' ? e.amt : 0); }, 0),
      first: L.length ? L[0].date : '', last: L.length ? L[L.length - 1].date : ''
    };
  }
  function premTotals(p) {
    var L = premSchedule(p), today = todayISO(), paid = 0, due = 0, total = 0, next = null, overdue = 0;
    L.forEach(function (e) {
      total += e.amt;
      if (p.paid && p.paid[e.date]) paid += e.amt;
      else if (e.date <= today) { due += e.amt; overdue++; }
      else if (!next) next = e;
    });
    return { count: L.length, total: total, paid: paid, due: due, overdue: overdue, remaining: total - paid, next: next, first: L.length ? L[0].date : '', last: L.length ? L[L.length - 1].date : '' };
  }
  /* maturity: one period after the last regular payout (start + duration); the lump sum, if any, is paid then */
  function maturity(p) {
    var st = p && pDate(p.start); if (!st) return null;
    var yrs = Math.round(+p.yrs) || 0; if (yrs < 1) return null;
    var t = pAt(st, yrs * 12), T = totals(p), P = premTotals(p);
    return { date: t.date, ix: t.ix, fy: fyStart(t.ix), amount: +p.lump || 0, payouts: T.pay, premiums: P.total,
             benefit: T.pay + T.lump, net: T.pay + T.lump - P.total, hasPremium: P.count > 0 };
  }
  /* where the policy stands today */
  function status(p, today) {
    today = today || todayISO();
    var m = maturity(p); if (m && m.date <= today) return 'matured';
    var T = totals(p); if (T.first && T.first <= today) return 'payout';
    var P = premTotals(p); if (P.first && P.first <= today) return 'paying';
    return 'upcoming';
  }
  var STATUS = { upcoming: 'Not started', paying: 'Paying premium', payout: 'Payout phase', matured: 'Matured' };

  /* ---------- consumer settings: every other module can be switched off ---------- */
  function usedBy(who, s) {
    s = s || cur(); if (!s) return true;
    return who === 'retirement' ? s.polFh !== false : who === 'goal' ? s.polGp !== false : true;
  }
  function setUsedBy(who, on) {
    var s = cur(); if (!s) return;
    if (who === 'retirement') s.polFh = !!on; else if (who === 'goal') s.polGp = !!on;
    persist();
  }
  /* true when the policies should show up in the Goal Planner (there is something to pay out and the module is switched on) */
  function hasPayouts(who) {
    return usedBy(who || 'goal') && all().some(function (p) { return p.amt > 0 || p.lump > 0; });
  }

  /* ---------- API for the Goal Planner: payouts by plan row (row 1 = today carries none; a row is a financial year from 1 April) ---------- */
  function rowOf(ix, s) { return Math.floor((ix - 3) / 12) - s.start + 2; }
  function listOf(s) { return s && s.polGp !== false ? (s.policies || []) : []; }
  function applyToRows(s, rows) {
    rows.forEach(function (r) { r.pay = 0; r.payR = 0; r.payL = 0; });
    listOf(s).forEach(function (p) {
      schedule(p).forEach(function (e) {
        var a = rowOf(e.ix, s); if (a < 2 || a > rows.length) return;
        var r = rows[a - 1]; r.pay += e.amt;
        if (e.kind === 'lump') r.payL += e.amt; else r.payR += e.amt;
      });
    });
  }
  /* payouts that fall in month m (0 = Apr .. 11 = Mar) of plan row a */
  function monthPayout(s, a, m) {
    var t = 0, ix = (m <= 8 ? s.start + a - 2 : s.start + a - 1) * 12 + (m + 3) % 12;
    listOf(s).forEach(function (p) { schedule(p).forEach(function (e) { if (e.ix === ix) t += e.amt; }); });
    return t;
  }
  /* payouts RECEIVED up to the end of plan row a (nothing for row 1): what the dashboard counts in the corpus */
  function receivedBy(s, a) {
    var t = 0;
    listOf(s).forEach(function (p) { schedule(p).forEach(function (e) { var r = rowOf(e.ix, s); if (r >= 2 && r <= a) t += e.amt; }); });
    return t;
  }
  /* the same payouts by calendar year of payment, plus the date of the first one still to come */
  function receivedByYear(s, a) {
    var m = {}, lump = {}, first = '';
    listOf(s).forEach(function (p) {
      schedule(p).forEach(function (e) {
        var r = rowOf(e.ix, s); if (r < 2) return;
        if (!first || e.date < first) first = e.date;
        if (r <= a) { var y = e.date.slice(0, 4); m[y] = (m[y] || 0) + e.amt; if (e.kind === 'lump') lump[y] = (lump[y] || 0) + e.amt; }
      });
    });
    return { m: m, lump: lump, first: first };
  }

  /* ---------- API for the Retirement Planner: fixed-rupee income streams by calendar year (the planner starts next calendar year) ---------- */
  function planStreams(cy) {
    var s = cur(); if (!s || s.polFh === false) return [];
    var out = [];
    all().forEach(function (p, k) {
      var by = {}, lo = 1e9, hi = 0;
      schedule(p).forEach(function (e) { var y = Math.floor(e.ix / 12); if (y <= cy) return; by[y] = (by[y] || 0) + e.amt; lo = Math.min(lo, y); hi = Math.max(hi, y); });
      if (hi) out.push({ k: 100 + k, name: 'Policy: ' + p.name, amount: 0, g: 0, byYear: by, fromY: lo, toY: hi });
    });
    return out;
  }

  /* ---------- reading across all policies ---------- */
  /* every dated event (payout, maturity lump sum, premium), oldest first */
  function events(opt) {
    opt = opt || {}; var want = opt.kinds || ['payout', 'lump', 'premium'], out = [];
    all().forEach(function (p, i) {
      var L = []; if (want.indexOf('payout') > -1 || want.indexOf('lump') > -1) L = L.concat(schedule(p));
      if (want.indexOf('premium') > -1) L = L.concat(premSchedule(p));
      L.forEach(function (e) {
        if (want.indexOf(e.kind) < 0) return;
        out.push({ policy: p, index: i, id: p.id, name: p.name, date: e.date, ix: e.ix, fy: fyStart(e.ix), amt: e.amt, kind: e.kind, n: e.n, paid: e.kind === 'premium' ? !!(p.paid && p.paid[e.date]) : undefined });
      });
    });
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.index - b.index; });
    return out;
  }
  /* headline numbers for the dashboard */
  function summary() {
    var today = todayISO(), P = all(), ev = events(), o = {
      count: P.length, today: today,
      payRegular: 0, payLump: 0, payReceived: 0, payToCome: 0, nextPayout: null, nextMaturity: null,
      premTotal: 0, premPaid: 0, premOverdue: 0, premOverdueCount: 0, premRemaining: 0, nextPremium: null, annualPremium: 0,
      byStatus: { upcoming: 0, paying: 0, payout: 0, matured: 0 }
    };
    ev.forEach(function (e) {
      if (e.kind === 'premium') {
        o.premTotal += e.amt;
        if (e.paid) o.premPaid += e.amt; else if (e.date <= today) { o.premOverdue += e.amt; o.premOverdueCount++; } else if (!o.nextPremium) o.nextPremium = e;
      } else {
        if (e.kind === 'lump') o.payLump += e.amt; else o.payRegular += e.amt;
        if (e.date <= today) o.payReceived += e.amt; else { o.payToCome += e.amt; if (!o.nextPayout) o.nextPayout = e; }
      }
    });
    o.premRemaining = o.premTotal - o.premPaid;
    P.forEach(function (p) {
      o.byStatus[status(p, today)]++;
      var m = maturity(p); if (m && m.date > today && (!o.nextMaturity || m.date < o.nextMaturity.date)) o.nextMaturity = { date: m.date, name: p.name, amount: m.amount, policy: p };
      var q = p.prem, ps = premSchedule(p);
      if (q && q.freq !== 'single' && ps.length && ps[0].date <= today && ps[ps.length - 1].date >= today) o.annualPremium += q.amt * PFREQ[q.freq];
    });
    return o;
  }
  /* by financial year: premiums due / paid, regular payouts, maturity lump sums */
  function byFinancialYear() {
    var m = {}, today = todayISO();
    events().forEach(function (e) {
      var r = m[e.fy] || (m[e.fy] = { fy: e.fy, label: fyLabel(e.fy), premDue: 0, premPaid: 0, payout: 0, lump: 0 });
      if (e.kind === 'premium') { r.premDue += e.amt; if (e.paid) r.premPaid += e.amt; }
      else if (e.kind === 'lump') r.lump += e.amt; else r.payout += e.amt;
    });
    return Object.keys(m).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { var r = m[k]; r.net = r.payout + r.lump - r.premDue; return r; });
  }
  /* calendar-year payout matrix (one column per policy): the "Policy Payout Details" report */
  function payoutMatrix() {
    var P = all(), names = [], ev = [];
    P.forEach(function (p) { var n = p.name || 'Policy', L = schedule(p); if (!L.length) return; if (names.indexOf(n) < 0) names.push(n); L.forEach(function (e) { ev.push({ policy: n, year: +e.date.slice(0, 4), amount: +e.amt || 0 }); }); });   /* policies with no payout (premium only) have no column */
    var now = new Date().getFullYear(), ys = ev.map(function (e) { return e.year; }), maxY = ys.length ? Math.max(now, Math.max.apply(null, ys)) : now, rows = [];
    for (var y = now; y <= maxY; y++) {
      var vals = {}; names.forEach(function (n) { vals[n] = 0; });
      ev.forEach(function (e) { if (e.year === y) vals[e.policy] = (vals[e.policy] || 0) + e.amount; });
      rows.push({ year: y, vals: vals, total: names.reduce(function (t, n) { return t + vals[n]; }, 0) });
    }
    return { names: names, rows: rows };
  }

  /* ---------- cleaning: the only gate through which policy data enters the plan ---------- */
  function cleanPrem(x, base) {
    if (!x || typeof x !== 'object') return undefined;
    var amt = Math.round(num(x.amt, 0, 1e10, 0) * 100) / 100, freq = x.freq === 'single' || PFREQ[x.freq] ? x.freq : 'yearly', st = pDate(x.start);
    if (!(amt > 0) || !st) return undefined;
    return { amt: amt, freq: freq, start: x.start, yrs: freq === 'single' ? 1 : Math.round(num(x.yrs, 1, 60, 1)) };
  }
  function clean(a) {
    var out = [], seen = {};
    (Array.isArray(a) ? a : []).forEach(function (x) {
      if (out.length >= PMAX || !x || typeof x !== 'object') return;
      var name = String(x.name == null ? '' : x.name).replace(/\s+/g, ' ').trim().slice(0, 40); if (!name) return;
      var prem = cleanPrem(x.prem);
      var startS = x.start, yrsIn = x.yrs;                          /* a policy with no payout dates borrows them from its premium plan */
      if (!pDate(startS) && prem) { startS = prem.start; yrsIn = prem.yrs; }
      if (!pDate(startS)) return;
      var frq = PFREQ[x.freq] ? x.freq : 'yearly';
      var id = String(x.id == null ? '' : x.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
      if (!id || seen[id]) id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      seen[id] = 1;
      var yrs = Math.round(num(yrsIn, 1, 60, 1)), amt = Math.round(num(x.amt, 0, 1e10, 0) * 100) / 100, lump = Math.round(num(x.lump, 0, 1e12, 0) * 100) / 100;
      if (!(amt > 0 || lump > 0 || prem)) return;                  /* something must be paid in or out */
      var p = { id: id, name: name, amt: amt, freq: frq, start: startS, yrs: yrs, lump: lump,
                note: String(x.note == null ? '' : x.note).replace(/\r\n?/g, '\n').trim().slice(0, 200),
                ca: num(x.ca, 0, 9e12, 0) || undefined, ma: num(x.ma, 0, 9e12, 0) || undefined };
      var insurer = String(x.insurer == null ? '' : x.insurer).replace(/\s+/g, ' ').trim().slice(0, 60); if (insurer) p.insurer = insurer;
      var no = String(x.no == null ? '' : x.no).replace(/\s+/g, ' ').trim().slice(0, 40); if (no) p.no = no;
      var sa = Math.round(num(x.sa, 0, 1e13, 0) * 100) / 100; if (sa > 0) p.sa = sa;
      if (prem) {
        p.prem = prem;
        var due = {}; premSchedule(p).forEach(function (e) { due[e.date] = 1; });
        var paid = {}, k = 0;
        if (x.paid && typeof x.paid === 'object') Object.keys(x.paid).forEach(function (d) { if (due[d] && x.paid[d] && k < 1000) { paid[d] = 1; k++; } });
        if (k) p.paid = paid;
      }
      out.push(p);
    });
    return out;
  }
  /* the plan's clean() hands over its raw document here: policies plus the two "use in other modules" switches */
  function cleanState(o, s) {
    s.policies = clean(o && o.policies);
    s.polFh = !o || o.polFh !== false;
    s.polGp = !o || o.polGp !== false;
  }

  /* ---------- changing the data (always through here) ---------- */
  function persist() {
    try { if (typeof save === 'function') save(); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('vr:policies')); } catch (e) {}
  }
  /* add (index == null) or update the policy at index; returns {ok, error?, policy?, isNew?} */
  function put(raw, index) {
    var arr = all(), isNew = index == null;
    if (isNew && arr.length >= PMAX) return { ok: false, error: 'Maximum ' + PMAX + ' policies. Delete one to add another.' };
    if (!isNew && !arr[index]) return { ok: false, error: 'That policy no longer exists.' };
    var now = Date.now(), base = isNew ? {} : arr[index];
    var id = isNew ? 'p' + now.toString(36) + Math.random().toString(36).slice(2, 6) : base.id;
    var c = clean([Object.assign({}, base, raw, { id: id, ca: isNew ? now : base.ca, ma: isNew ? undefined : now })]);
    if (!c.length) return { ok: false, error: 'These values could not be saved. Please check them.' };
    if (isNew) arr.push(c[0]); else arr[index] = c[0];
    persist();
    return { ok: true, policy: c[0], isNew: isNew };
  }
  function remove(index) { var arr = all(), p = arr[index]; if (!p) return null; arr.splice(index, 1); persist(); return p; }
  /* mark one premium due date paid / unpaid; upTo (a date) marks every unpaid premium on or before it */
  function setPaid(index, date, flag) {
    var p = all()[index]; if (!p || !p.prem) return false;
    var due = {}; premSchedule(p).forEach(function (e) { due[e.date] = 1; });
    if (!due[date]) return false;
    p.paid = p.paid || {};
    if (flag) p.paid[date] = 1; else delete p.paid[date];
    if (!Object.keys(p.paid).length) delete p.paid;
    persist(); return true;
  }
  function markPaidUpTo(index, upTo) {
    var p = all()[index]; if (!p || !p.prem) return 0;
    var n2 = 0; p.paid = p.paid || {};
    premSchedule(p).forEach(function (e) { if (e.date <= upTo && !p.paid[e.date]) { p.paid[e.date] = 1; n2++; } });
    if (!Object.keys(p.paid).length) delete p.paid;
    if (n2) persist(); return n2;
  }

  /* hand the retirement planner its income streams (the planner's engine looks for exactly this function) */
  root.__vrExtraStreams = planStreams;

  root.VRPolicy = {
    version: 1,
    /* constants and formatting */
    FREQ: FREQ, FREQ_NAME: PFN, STATUS: STATUS, MAX: PMAX, todayISO: todayISO, fmtDate: fmtDate, fyLabel: fyLabel, pDate: pDate,
    /* the data (read) and how to change it (write) */
    list: all, count: function () { return all().length; }, get: function (i) { return all()[i] || null; },
    put: put, remove: remove, setPaid: setPaid, markPaidUpTo: markPaidUpTo, clean: clean, cleanState: cleanState,
    /* calculations for one policy */
    schedule: schedule, premSchedule: premSchedule, totals: totals, premTotals: premTotals, maturity: maturity, status: status,
    /* calculations across policies */
    events: events, summary: summary, byFinancialYear: byFinancialYear, payoutMatrix: payoutMatrix,
    /* for other modules */
    usedBy: usedBy, setUsedBy: setUsedBy, hasPayouts: hasPayouts,
    applyToRows: applyToRows, monthPayout: monthPayout, receivedBy: receivedBy, receivedByYear: receivedByYear, planStreams: planStreams
  };
})(window);
