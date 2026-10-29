/* =====================================================================================================================
   Vriddhi · POLICY MODULE · SCREENS        modules/policy/policy-ui.js

   The Policies section: its own navigation and six screens (Dashboard, Policies, Premiums, Maturity, Payouts, Reports).
   It reads and changes policy data ONLY through window.VRPolicy (modules/policy/policy-core.js) and registers itself with
   the app through window.VRMODULES, so nothing else in the app needs to know how the Policies section works.
   ===================================================================================================================== */
(function () {
  'use strict';
  var V = window.VRPolicy, TAB = 'Policies';
  var PAGES = [['dash', 'Dashboard', '\ud83d\udcca'], ['list', 'Policies', '\ud83d\udee1\ufe0f'], ['prem', 'Premiums', '\ud83d\udcb3'],
               ['mat', 'Maturity', '\ud83c\udfaf'], ['pay', 'Payouts', '\ud83d\udcc5'], ['rep', 'Reports', '\ud83d\udcc4']];
  var ST = { page: 'dash', q: '', grp: false, gc: {}, sf: 'all', prP: 'all', prS: 'open', prN: 60, mat: 'all', pyV: 'events', pyP: 'all', pyS: 'all', pyK: 'all', pyN: 60, rep: 'payout', rq: '' };

  /* ---------- helpers ---------- */
  var $$ = function (id) { return document.getElementById(id); };
  var EN = function (v) { return typeof escn === 'function' ? escn(v) : esc(v); };
  var today = function () { return V.todayISO(); };
  var days = function (a, b) { var A = V.pDate(a), B = V.pDate(b); return A && B ? Math.round((Date.UTC(B.y, B.mo - 1, B.d) - Date.UTC(A.y, A.mo - 1, A.d)) / 864e5) : 0; };
  var plural = function (n, w, ws) { return n + ' ' + (n === 1 ? w : (ws || w + 's')); };
  var fl = function (k) { return V.FREQ_NAME[k] || k; };
  var ic = function (d) { return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var addBtn = function () { return '<button type="button" class="p hp-add" id="padd" data-vp="add">' + ic('<path d="M12 5v14M5 12h14"/>') + '<span>Add policy</span></button>'; };
  var chip = function (s) { return '<span class="vp-chip ' + s + '">' + esc(V.STATUS[s] || s) + '</span>'; };
  var sorted = function () { return V.list().map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return a.x.start < b.x.start ? -1 : a.x.start > b.x.start ? 1 : a.i - b.i; }); };
  var csvq = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
  var toCsv = function (rows) { return rows.map(function (r) { return r.map(csvq).join(','); }).join('\n'); };
  /* a plain-English line describing the payouts of a policy */
  function line(x) {
    var T = V.totals(x), n = T.count, S0 = V.schedule(x), pay = S0.filter(function (e) { return e.kind === 'payout'; }), lump = S0.filter(function (e) { return e.kind === 'lump'; });
    return (x.amt > 0 ? n + ' payout' + (n === 1 ? '' : 's') + ' of ' + f(x.amt) + ' (' + fl(x.freq).toLowerCase() + '), ' + V.fmtDate(x.start) + ' to ' + V.fmtDate(pay.length ? pay[pay.length - 1].date : x.start) : '')
         + (x.lump > 0 ? (x.amt > 0 ? ', then a ' : 'A ') + 'lump sum of ' + f(x.lump) + ' on ' + V.fmtDate(lump.length ? lump[0].date : x.start) : '');
  }
  function premLine(x) {
    var q = x.prem; if (!q) return '';
    return q.freq === 'single' ? 'A single premium of ' + f(q.amt) + ' on ' + V.fmtDate(q.start)
      : f(q.amt) + ' ' + fl(q.freq).toLowerCase() + ' for ' + plural(q.yrs, 'year') + ' from ' + V.fmtDate(q.start);
  }
  function kpi(k, v, s, cls) { return '<div class="vp-kpi ' + (cls || '') + '"><div class="vp-k">' + esc(k) + '</div><div class="vp-v">' + v + '</div><div class="vp-s">' + s + '</div></div>'; }
  function head(title, sub, extra) { return '<div class="rph"><div><h1>' + esc(title) + '</h1><p class="vp-sub">' + sub + '</p></div><div class="rpr">' + (extra || '') + '</div></div>'; }
  function empty() {
    return '<div class="vp-card vp-empty"><h2>No policies yet</h2><p class="mu">Keep every insurance policy in one place: its premiums, its payouts and its maturity. Other parts of the app use this data only if you allow it.</p>' + addBtn() + '</div>';
  }
  /* the two switches that decide which other modules may use the policy data */
  function sharing() {
    return '<div class="vp-card" id="vp-share"><div class="vp-h"><h2>Use policy data in other modules</h2></div><p class="mu" style="margin:0 0 4px">The Policies module owns all policy data. Other modules read it only when you allow it here. Premiums are never passed on.</p>'
      + '<label class="vp-sw"><input type="checkbox" data-vpset="goal" ' + (V.usedBy('goal') ? 'checked' : '') + '><span><b>Goal Planner</b><small>Adds payouts as income columns in the Yearly, Monthly and Interest reports, and counts payouts already received in the Summary corpus and allocation.</small></span></label>'
      + '<label class="vp-sw"><input type="checkbox" data-vpset="retirement" ' + (V.usedBy('retirement') ? 'checked' : '') + '><span><b>Retirement Planner</b><small>Counts future payouts as fixed-rupee income in the year each one arrives, which lowers the money you need today.</small></span></label></div>';
  }

  /* ---------- shell: top bar, bottom navigation, page router ---------- */
  function bar() {
    return '<div class="seg gpb vp-bar" role="group" aria-label="Policy sections">' + PAGES.map(function (p) {
      return '<button type="button" data-vpp="' + p[0] + '" aria-pressed="' + (ST.page === p[0]) + '">' + p[1] + '</button>'; }).join('') + '</div>';
  }
  function nav() {
    return '<div class="rp2-nav vp-nav" role="navigation" aria-label="Policies">' + PAGES.map(function (p) {
      return '<button type="button" data-vpp="' + p[0] + '"' + (ST.page === p[0] ? ' aria-current="page"' : '') + '><span aria-hidden="true">' + p[2] + '</span><span>' + p[1] + '</span></button>'; }).join('') + '</div>';
  }
  function body() {
    switch (ST.page) {
      case 'list': return pList(); case 'prem': return pPrem(); case 'mat': return pMat(); case 'pay': return pPay(); case 'rep': return pRep(); default: return pDash();
    }
  }
  function page() { return '<div id="vp-pg">' + body() + '</div>'; }
  function refresh() { var el = $$('vp-pg'); if (el) el.innerHTML = body(); else render(); }
  function go(p) { ST.page = p; render(); window.scrollTo(0, 0); }

  /* ---------- DASHBOARD ---------- */
  function pDash() {
    var P = V.list(), top = head('Policies', 'Premiums, payouts and maturity of every policy, in one place.', addBtn());
    if (!P.length) return top + empty() + sharing();
    var s = V.summary(), t = today(), hasPrem = s.premTotal > 0, bs = s.byStatus;
    var stText = [bs.paying && bs.paying + ' paying premium', bs.payout && bs.payout + ' in payout phase', bs.upcoming && bs.upcoming + ' not started', bs.matured && bs.matured + ' matured'].filter(Boolean).join(' · ');
    var np = s.nextPayout, nm = s.nextMaturity, nx = s.nextPremium;
    var html = top;
    if (s.premOverdueCount) html += '<div class="vp-alert" role="alert"><b>' + plural(s.premOverdueCount, 'premium') + ' overdue</b> <span>' + f(s.premOverdue) + ' not yet marked as paid.</span><button type="button" data-vpp="prem">Review premiums</button></div>';
    html += '<div class="vp-kpis n6">'
      + kpi('Policies', String(s.count), esc(stText))
      + kpi('Premium per year', hasPrem ? f(s.annualPremium) : '\u2014', hasPrem ? 'Paid so far ' + f(s.premPaid) + ' of ' + f(s.premTotal) : 'Add premium details to a policy to track them')
      + kpi('Payouts received', f(s.payReceived), 'of ' + f(s.payRegular + s.payLump) + ' expected in all')
      + kpi('Still to receive', f(s.payToCome), np ? 'Next ' + f(np.amt) + ' on ' + V.fmtDate(np.date) : 'Nothing scheduled')
      + kpi('Next maturity', nm ? V.fmtDate(nm.date) : '\u2014', nm ? EN(nm.name) + (nm.amount > 0 ? ' · ' + f(nm.amount) : '') : 'No upcoming maturity')
      + kpi('Next premium due', nx ? V.fmtDate(nx.date) : '\u2014', nx ? EN(nx.name) + ' · ' + f(nx.amt) : hasPrem ? 'All premiums are up to date' : 'No premiums tracked')
      + '</div>';
    /* by financial year */
    var rows = V.byFinancialYear(), fy0 = Math.floor((new Date().getFullYear() * 12 + new Date().getMonth() - 3) / 12);
    rows = rows.filter(function (r) { return r.fy >= fy0; }).slice(0, 18);
    var mx = Math.max.apply(null, rows.map(function (r) { return Math.max(r.payout + r.lump, r.premDue); }).concat([1]));
    var chart = rows.length ? '<div class="vp-bars" role="img" aria-label="Payouts and premiums by financial year">' + rows.map(function (r) {
        var pv = r.payout + r.lump;
        return '<div class="vp-bg" title="' + esc(r.label + ': payouts ' + f(pv) + ', premiums ' + f(r.premDue)) + '"><div class="vp-bp"><div class="vp-b pay" style="height:' + (pv / mx * 100).toFixed(1) + '%"></div><div class="vp-b prem" style="height:' + (r.premDue / mx * 100).toFixed(1) + '%"></div></div></div>'; }).join('')
      + '</div><div class="vp-bl">' + rows.map(function (r) { return '<span>' + String(r.fy).slice(2) + '-' + String(r.fy + 1).slice(2) + '</span>'; }).join('') + '</div>'
      : '<p class="mu">Nothing is scheduled from this financial year onwards.</p>';
    /* the next 12 months */
    var end = new Date(); end.setFullYear(end.getFullYear() + 1);
    var endS = end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0') + '-' + String(end.getDate()).padStart(2, '0');
    var up = V.events().filter(function (e) { return e.date > t && e.date <= endS && !(e.kind === 'premium' && e.paid); }).slice(0, 12);
    var list = up.length ? '<ul class="vp-up">' + up.map(function (e) {
        var k = e.kind === 'premium' ? ['', '\ud83d\udcb3', 'Premium due'] : e.kind === 'lump' ? ['mat', '\ud83c\udfaf', 'Maturity'] : ['pay', '\ud83d\udcb0', 'Payout'], d = days(t, e.date);
        return '<li><span class="vp-ic ' + k[0] + '" aria-hidden="true">' + k[1] + '</span><span class="vp-tt"><b>' + EN(e.name) + '</b><small>' + k[2] + ' · ' + V.fmtDate(e.date) + '</small></span><span class="vp-ta">' + (e.kind === 'premium' ? '\u2212' : '+') + f(e.amt) + '<small>' + (d === 1 ? 'tomorrow' : 'in ' + d + ' days') + '</small></span></li>'; }).join('') + '</ul>'
      : '<p class="mu">No premiums, payouts or maturities fall in the next 12 months.</p>';
    html += '<div class="vp-two"><div class="vp-card"><div class="vp-h"><h2>By financial year</h2><div class="vp-leg"><span><i style="background:var(--vp-pay)"></i>Payouts and maturity</span><span><i style="background:var(--vp-prem)"></i>Premiums</span></div></div>' + chart + '</div>'
      + '<div class="vp-card"><div class="vp-h"><h2>Coming up</h2><button type="button" class="tbs" data-vpp="pay">All payouts</button></div>' + list + '</div></div>';
    /* policies at a glance */
    html += '<div class="vp-card"><div class="vp-h"><h2>Policies at a glance</h2><button type="button" class="tbs" data-vpp="list">Manage policies</button></div><div class="vp-tw"><table class="vp-t" aria-label="Policies at a glance"><tr><th>Policy</th><th>Status</th><th>Next event</th><th class="vp-r">Total expected</th></tr>'
      + sorted().map(function (o) {
          var T = V.totals(o.x), nxt = V.events().filter(function (e) { return e.index === o.i && e.date > t && !(e.kind === 'premium' && e.paid); })[0];
          return '<tr><td><b>' + EN(o.x.name) + '</b>' + (o.x.insurer ? '<div class="mu">' + EN(o.x.insurer) + '</div>' : '') + '</td><td>' + chip(V.status(o.x, t)) + '</td><td class="nw">' + (nxt ? V.fmtDate(nxt.date) + '<div class="mu">' + (nxt.kind === 'premium' ? 'Premium ' : nxt.kind === 'lump' ? 'Maturity ' : 'Payout ') + f(nxt.amt) + '</div>' : '\u2014') + '</td><td class="vp-r nw"><b>' + f(T.pay + T.lump) + '</b></td></tr>'; }).join('')
      + '</table></div></div>' + sharing();
    return html;
  }

  /* ---------- POLICIES (management) ---------- */
  function pList() {
    var P = sorted(), t = today(), q = ST.q.trim().toLowerCase();
    var L = P.filter(function (o) {
      if (ST.sf !== 'all' && V.status(o.x, t) !== ST.sf) return false;
      return !q || [o.x.name, o.x.insurer, o.x.no, o.x.note].join(' ').toLowerCase().indexOf(q) > -1;
    });
    var tp = L.reduce(function (a, o) { return a + V.totals(o.x).pay; }, 0), tl = L.reduce(function (a, o) { return a + V.totals(o.x).lump; }, 0);
    var tools = '<div class="vp-tools"><input type="search" id="vp-q" placeholder="Search name, insurer, policy number\u2026" aria-label="Search policies" value="' + esc(ST.q) + '">'
      + '<select id="vp-sf" aria-label="Filter by status"><option value="all">All statuses</option>' + Object.keys(V.STATUS).map(function (k) { return '<option value="' + k + '"' + (ST.sf === k ? ' selected' : '') + '>' + esc(V.STATUS[k]) + '</option>'; }).join('') + '</select>'
      + '<button type="button" class="tbs" data-vp="grp" aria-pressed="' + ST.grp + '">' + (ST.grp ? 'Ungroup' : 'Group by frequency') + '</button></div>';
    var sub = P.length ? plural(P.length, 'policy', 'policies') + ' · ' + f(tp) + ' regular payouts' + (tl ? ' + ' + f(tl) + ' maturity' : '') : 'Add the insurance policies you hold.';
    var out = head('Policies', esc(sub), addBtn());
    if (!P.length) return out + empty() + sharing();
    return out + tools + '<div id="vp-list">' + listBody(L, P.length) + '</div>' + sharing();
  }
  function listBody(L, all) {
    if (!L.length) return '<div class="card"><div class="em">No policy matches. Clear the search or the status filter.</div></div>';
    var t = today();
    var bt = function (o) {
      return '<button type="button" class="tbs" data-vp="sched" data-i="' + o.i + '" aria-label="Payout schedule of ' + esc(o.x.name) + '">Schedule</button> '
        + (o.x.prem ? '<button type="button" class="tbs" data-vp="premsch" data-i="' + o.i + '" aria-label="Premiums of ' + esc(o.x.name) + '">Premiums</button> ' : '')
        + '<button type="button" class="tbs" data-vp="edit" data-i="' + o.i + '" aria-label="Edit ' + esc(o.x.name) + '">Edit</button> '
        + '<button type="button" class="tbs d" data-vp="del" data-i="' + o.i + '" aria-label="Delete ' + esc(o.x.name) + '">Delete</button>'; };
    var nm = function (o) {
      return '<div class="nm"><div><b>' + EN(o.x.name) + '</b><div>' + chip(V.status(o.x, t)) + (o.x.amt > 0 ? ' <span class="pill" style="--c:#7c3aed">' + esc(fl(o.x.freq)) + '</span>' : '') + '</div>'
        + (o.x.insurer || o.x.no ? '<div class="mu tsx">' + EN([o.x.insurer, o.x.no && ('No. ' + o.x.no)].filter(Boolean).join(' · ')) + '</div>' : '') + (o.x.note ? '<div class="mu tsx">' + EN(o.x.note) + '</div>' : '') + '</div></div>'; };
    var lump = function (x) { var m = V.maturity(x); return x.lump > 0 ? f(x.lump) + '<br><span class="mu">on ' + V.fmtDate(m.date) + '</span>' : (m ? '<span class="mu">ends ' + V.fmtDate(m.date) + '</span>' : '\u2014'); };
    var tot = function (o) { var T = V.totals(o.x); return T.pay + T.lump; };
    var key = function (o) { return o.x.amt > 0 ? o.x.freq : 'none'; };
    var grouped = function (fn, kind) {
      if (!ST.grp) return L.map(fn);
      var gs = [], ix = {}; L.forEach(function (o) { var c = key(o); if (!(c in ix)) { ix[c] = gs.length; gs.push({ c: c, a: [] }); } gs[ix[c]].a.push(o); });
      var tc = L.reduce(function (a, o) { return a + tot(o); }, 0) || 1, sum = function (g) { return g.a.reduce(function (a, o) { return a + tot(o); }, 0); };
      gs.sort(function (a, b) { return sum(b) - sum(a); });
      var out = [];
      gs.forEach(function (g) {
        var cl = !!ST.gc[g.c], n = g.a.length, name = g.c === 'none' ? 'No regular payouts' : fl(g.c);
        var lab = '<button type="button" class="gtg" data-vp="gtog" data-g="' + esc(g.c) + '" aria-expanded="' + !cl + '"><span class="gar" aria-hidden="true">' + (cl ? '\u25b8' : '\u25be') + '</span><span class="pill" style="--c:#7c3aed">' + esc(name) + '</span><small>' + n + ' polic' + (n === 1 ? 'y' : 'ies') + ' \u00b7 ' + (sum(g) / tc * 100).toFixed(1) + '%</small></button>';
        out.push(kind === 't' ? '<tr class="gh" style="--c:#7c3aed"><td colspan="6">' + lab + '</td><td class="vp-r"><b>' + f(sum(g)) + '</b></td></tr>' : '<div class="hgh" style="--c:#7c3aed">' + lab + '<b>' + f(sum(g)) + '</b></div>');
        if (!cl) g.a.forEach(function (o) { out.push(fn(o)); });
      });
      return out;
    };
    var rowT = function (o) {
      var T = V.totals(o.x);
      return '<tr><td>' + nm(o) + '</td><td>' + (o.x.prem ? esc(premLine(o.x)) : '<span class="mu">\u2014</span>') + '</td><td>' + (o.x.amt > 0 ? f(o.x.amt) + '<br><span class="mu">' + esc(fl(o.x.freq)).toLowerCase() + '</span>' : '\u2014') + '</td><td class="nw">' + V.fmtDate(o.x.start) + '<br><span class="mu">' + plural(o.x.yrs, 'year') + (T.count ? ' \u00b7 ' + plural(T.count, 'payout') : '') + '</span></td><td>' + lump(o.x) + '</td><td class="vp-r"><b>' + f(T.pay + T.lump) + '</b></td><td class="nw">' + bt(o) + '</td></tr>'; };
    var rowC = function (o) {
      var T = V.totals(o.x), m = V.maturity(o.x);
      return '<div class="hcard" style="--c:#7c3aed"><div class="hh">' + nm(o) + '<div class="vv"><b>' + f(T.pay + T.lump) + '</b><div class="mu">Total expected</div></div></div><div class="kv">'
        + (o.x.prem ? '<span>Premium</span><b>' + esc(premLine(o.x)) + '</b>' : '') + '<span>Payout</span><b>' + (o.x.amt > 0 ? f(o.x.amt) + ' \u00b7 ' + esc(fl(o.x.freq)).toLowerCase() : '\u2014') + '</b><span>Starts</span><b>' + V.fmtDate(o.x.start) + '</b><span>Duration</span><b>' + plural(o.x.yrs, 'year') + (T.count ? ' \u00b7 ' + plural(T.count, 'payout') : '') + '</b><span>Maturity</span><b>' + (m ? V.fmtDate(m.date) + (o.x.lump > 0 ? ' \u00b7 ' + f(o.x.lump) : '') : '\u2014') + '</b></div><div class="tb">' + bt(o) + '</div></div>'; };
    var tl = L.reduce(function (a, o) { return a + V.totals(o.x).lump; }, 0), tp = L.reduce(function (a, o) { return a + V.totals(o.x).pay; }, 0);
    return '<div class="card hp-card" id="pol"><div class="ht tw"><table aria-label="Policies"><tr><th>Policy</th><th>Premium</th><th>Payout</th><th>Starts</th><th>Maturity</th><th class="vp-r">Total expected</th><th>Actions</th></tr>'
      + grouped(rowT, 't').join('') + '<tr class="t"><td>Total (' + L.length + (L.length !== all ? ' of ' + all : '') + ')</td><td></td><td></td><td></td><td>' + f(tl) + '</td><td class="vp-r">' + f(tp + tl) + '</td><td></td></tr></table></div><div class="hc">' + grouped(rowC, 'c').join('') + '</div></div>';
  }

  /* ---------- PREMIUMS (tracking) ---------- */
  var PSL = { paid: 'Paid', overdue: 'Overdue', soon: 'Due soon', upcoming: 'Upcoming' };
  function addYear(t) { var d = V.pDate(t); return (d.y + 1) + '-' + String(d.mo).padStart(2, '0') + '-' + String(d.d).padStart(2, '0'); }
  function pstat(e, t) { return e.paid ? 'paid' : e.date < t ? 'overdue' : days(t, e.date) <= 30 ? 'soon' : 'upcoming'; }
  function polOpts(sel) { return '<option value="all">All policies</option>' + sorted().map(function (o) { return '<option value="' + o.i + '"' + (String(sel) === String(o.i) ? ' selected' : '') + '>' + esc(o.x.name) + '</option>'; }).join(''); }
  function pPrem() {
    var P = sorted(), t = today(), top = head('Premiums', 'Track the premium of every policy and mark each one as paid.', addBtn());
    if (!P.length) return top + empty();
    var withP = P.filter(function (o) { return o.x.prem; });
    if (!withP.length) return top + '<div class="vp-card vp-empty"><h2>No premium details yet</h2><p class="mu">Edit a policy and fill in its premium (amount, how often, first date and how many years) to track every due date here.</p></div>'
      + '<div class="vp-card"><div class="vp-h"><h2>Your policies</h2></div>' + P.map(function (o) { return '<div class="vp-sw"><span style="flex:1"><b>' + EN(o.x.name) + '</b><small>' + EN(o.x.insurer || 'No premium recorded') + '</small></span><button type="button" class="tbs" data-vp="edit" data-i="' + o.i + '">Add premium</button></div>'; }).join('') + '</div>';
    var s = V.summary();
    var html = top + '<div class="vp-kpis n5">' + kpi('Total premiums', f(s.premTotal), 'Over the full term of ' + plural(withP.length, 'policy', 'policies'))
      + kpi('Paid', f(s.premPaid), s.premTotal ? Math.round(s.premPaid / s.premTotal * 100) + '% of the total' : '')
      + kpi('Remaining', f(s.premRemaining), 'Still to be paid')
      + kpi('Overdue', f(s.premOverdue), s.premOverdueCount ? plural(s.premOverdueCount, 'premium') + ' not marked as paid' : 'Nothing overdue', s.premOverdueCount ? 'late' : '')
      + kpi('Next due', s.nextPremium ? V.fmtDate(s.nextPremium.date) : '\u2014', s.nextPremium ? EN(s.nextPremium.name) + ' · ' + f(s.nextPremium.amt) : 'No upcoming premium') + '</div>';
    html += '<div class="vp-card"><div class="vp-h"><h2>By policy</h2></div><div class="vp-tw"><table class="vp-t" aria-label="Premiums by policy"><tr><th>Policy</th><th>Premium plan</th><th class="vp-r">Total</th><th class="vp-r">Paid</th><th class="vp-r">Remaining</th><th>Next due</th><th>Actions</th></tr>'
      + withP.map(function (o) {
          var T = V.premTotals(o.x);
          return '<tr><td><b>' + EN(o.x.name) + '</b></td><td>' + esc(premLine(o.x)) + '</td><td class="vp-r nw">' + f(T.total) + '</td><td class="vp-r nw">' + f(T.paid) + '</td><td class="vp-r nw"><b>' + f(T.remaining) + '</b></td><td class="nw">' + (T.overdue ? '<span class="vp-chip overdue">' + plural(T.overdue, 'overdue', 'overdue') + '</span>' : T.next ? V.fmtDate(T.next.date) : '\u2014') + '</td><td class="nw">'
            + (T.overdue ? '<button type="button" class="tbs" data-vp="paidall" data-i="' + o.i + '">Mark due as paid</button> ' : '') + '<button type="button" class="tbs" data-vp="premsch" data-i="' + o.i + '">Schedule</button></td></tr>'; }).join('') + '</table></div></div>';
    var ev = V.events({ kinds: ['premium'] }).filter(function (e) { return ST.prP === 'all' || String(e.index) === ST.prP; }), end = addYear(t);
    ev = ev.filter(function (e) {
      var st = pstat(e, t);
      return ST.prS === 'all' ? true : ST.prS === 'paid' ? e.paid : ST.prS === 'overdue' ? st === 'overdue' : ST.prS === 'upcoming' ? (!e.paid && e.date >= t) : (!e.paid && e.date <= end);
    });
    var shown = ev.slice(0, ST.prN);
    html += '<div class="vp-card"><div class="vp-h"><h2>Premium due dates</h2></div><div class="vp-tools"><select id="vp-prP" aria-label="Policy">' + polOpts(ST.prP) + '</select><select id="vp-prS" aria-label="Show">'
      + [['open', 'Unpaid, next 12 months'], ['overdue', 'Overdue'], ['upcoming', 'All upcoming'], ['paid', 'Paid'], ['all', 'Everything']].map(function (k) { return '<option value="' + k[0] + '"' + (ST.prS === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select></div>'
      + (shown.length ? '<div class="vp-tw"><table class="vp-t" aria-label="Premium due dates"><tr><th>Due date</th><th>Policy</th><th>Financial year</th><th class="vp-r">Amount</th><th>Status</th><th></th></tr>'
        + shown.map(function (e) {
            var st = pstat(e, t);
            return '<tr><td class="nw"><b>' + V.fmtDate(e.date) + '</b></td><td>' + EN(e.name) + '</td><td class="nw">' + V.fyLabel(e.fy) + '</td><td class="vp-r nw">' + f(e.amt) + '</td><td><span class="vp-chip ' + st + '">' + PSL[st] + '</span></td><td class="nw"><button type="button" class="tbs" data-vp="paid" data-i="' + e.index + '" data-d="' + e.date + '" data-v="' + (e.paid ? 0 : 1) + '" aria-label="' + (e.paid ? 'Mark unpaid' : 'Mark paid') + ' ' + esc(e.name) + ' ' + e.date + '">' + (e.paid ? 'Undo' : 'Mark paid') + '</button></td></tr>'; }).join('') + '</table></div>'
        + (ev.length > shown.length ? '<div class="vp-more"><button type="button" class="tbs" data-vp="prmore">Show more (' + (ev.length - shown.length) + ' left)</button></div>' : '')
        : '<div class="em">No premiums match this filter.</div>') + '</div>';
    return html;
  }

  /* ---------- MATURITY ---------- */
  function pMat() {
    var P = sorted(), t = today(), top = head('Maturity', 'When each policy matures and what it is worth in all.', addBtn());
    if (!P.length) return top + empty();
    var R = P.map(function (o) { return { o: o, m: V.maturity(o.x), T: V.totals(o.x), st: V.status(o.x, t) }; }).filter(function (r) { return r.m; })
      .sort(function (a, b) { return a.m.date < b.m.date ? -1 : a.m.date > b.m.date ? 1 : a.o.i - b.o.i; });
    var live = R.filter(function (r) { return r.m.date > t; }), s = V.summary(), end = addYear(t);
    var in12 = live.filter(function (r) { return r.m.date <= end; });
    var html = top + '<div class="vp-kpis">' + kpi('Next maturity', live[0] ? V.fmtDate(live[0].m.date) : '\u2014', live[0] ? EN(live[0].o.x.name) + (live[0].m.amount > 0 ? ' · ' + f(live[0].m.amount) : '') : 'None upcoming')
      + kpi('Maturing in 12 months', String(in12.length), in12.length ? f(in12.reduce(function (a, r) { return a + r.m.amount; }, 0)) + ' lump sums' : 'Nothing matures soon')
      + kpi('Maturity amounts to come', f(live.reduce(function (a, r) { return a + r.m.amount; }, 0)), plural(live.length, 'policy', 'policies') + ' still to mature')
      + kpi('Matured', String(s.byStatus.matured), 'Policies past their maturity date') + '</div>';
    html += '<div class="vp-card"><div class="vp-h"><h2>Maturity details</h2></div><div class="vp-tw"><table class="vp-t" aria-label="Maturity details"><tr><th>Policy</th><th>Status</th><th>Maturity date</th><th>Term</th><th class="vp-r">Maturity amount</th><th class="vp-r">Regular payouts</th><th class="vp-r">Total benefit</th><th class="vp-r">Premiums</th><th class="vp-r">Net gain</th></tr>'
      + R.map(function (r) {
          var x = r.o.x, begin = [x.start, x.prem && x.prem.start].filter(Boolean).sort()[0], span = Math.max(1, days(begin, r.m.date)), pct = Math.max(0, Math.min(100, days(begin, t) / span * 100)), left = days(t, r.m.date);
          return '<tr><td><b>' + EN(x.name) + '</b>' + (x.insurer ? '<div class="mu">' + EN(x.insurer) + '</div>' : '') + '</td><td>' + chip(r.st) + '</td><td class="nw"><b>' + V.fmtDate(r.m.date) + '</b><div class="mu">' + (left > 0 ? (left > 365 ? (left / 365.25).toFixed(1) + ' years left' : plural(left, 'day') + ' left') : 'Matured') + '</div></td>'
            + '<td><div class="vp-prog" role="img" aria-label="' + Math.round(pct) + '% of the term has passed"><i style="width:' + pct.toFixed(0) + '%"></i></div><div class="mu">' + plural(x.yrs, 'year') + '</div></td><td class="vp-r nw">' + (r.m.amount > 0 ? f(r.m.amount) : '\u2014') + '</td><td class="vp-r nw">' + (r.T.pay > 0 ? f(r.T.pay) : '\u2014') + '</td><td class="vp-r nw"><b>' + f(r.m.benefit) + '</b></td><td class="vp-r nw">' + (r.m.hasPremium ? f(r.m.premiums) : '\u2014') + '</td><td class="vp-r nw">' + (r.m.hasPremium ? '<b>' + f(r.m.net) + '</b>' : '\u2014') + '</td></tr>'; }).join('')
      + '</table></div><p class="mu" style="margin:8px 0 0">Maturity is one period after the last regular payout (start date + duration). Net gain is the total benefit minus all premiums, shown when premiums are recorded.</p></div>';
    return html;
  }

  /* ---------- PAYOUTS (schedules) ---------- */
  function pPay() {
    var t = today(), top = head('Payouts', 'Every payout and maturity amount, with its date and status.', addBtn());
    if (!V.count()) return top + empty();
    var s = V.summary(), all = V.events({ kinds: ['payout', 'lump'] });
    var html = top + '<div class="vp-kpis">' + kpi('Received so far', f(s.payReceived), 'Payouts and maturity dated up to today')
      + kpi('Still to receive', f(s.payToCome), s.nextPayout ? 'Next ' + f(s.nextPayout.amt) + ' on ' + V.fmtDate(s.nextPayout.date) : 'Nothing scheduled')
      + kpi('Regular payouts', f(s.payRegular), 'In all') + kpi('Maturity lump sums', f(s.payLump), 'In all') + '</div>';
    html += '<div class="seg" role="group" aria-label="Payout view" style="margin-bottom:12px">' + [['events', 'All payouts'], ['fy', 'By financial year']].map(function (k) { return '<button type="button" data-vp="pyview" data-t="' + k[0] + '" aria-pressed="' + (ST.pyV === k[0]) + '">' + k[1] + '</button>'; }).join('') + '</div>';
    if (ST.pyV === 'fy') {
      var m = {}; all.forEach(function (e) { var r = m[e.fy] || (m[e.fy] = { fy: e.fy, pay: 0, lump: 0, got: 0, left: 0 }); if (e.kind === 'lump') r.lump += e.amt; else r.pay += e.amt; if (e.date <= t) r.got += e.amt; else r.left += e.amt; });
      var rows = Object.keys(m).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return m[k]; }), tt = { pay: 0, lump: 0, got: 0, left: 0 };
      rows.forEach(function (r) { tt.pay += r.pay; tt.lump += r.lump; tt.got += r.got; tt.left += r.left; });
      return html + '<div class="vp-card"><div class="vp-h"><h2>Payouts by financial year</h2></div><div class="vp-tw"><table class="vp-t" aria-label="Payouts by financial year"><tr><th>Financial year</th><th class="vp-r">Regular payouts</th><th class="vp-r">Maturity</th><th class="vp-r">Total</th><th class="vp-r">Received</th><th class="vp-r">To come</th></tr>'
        + rows.map(function (r) { return '<tr><td class="nw"><b>' + V.fyLabel(r.fy) + '</b></td><td class="vp-r nw">' + (r.pay ? f(r.pay) : '') + '</td><td class="vp-r nw">' + (r.lump ? f(r.lump) : '') + '</td><td class="vp-r nw"><b>' + f(r.pay + r.lump) + '</b></td><td class="vp-r nw">' + (r.got ? f(r.got) : '') + '</td><td class="vp-r nw">' + (r.left ? f(r.left) : '') + '</td></tr>'; }).join('')
        + '<tr class="t"><td>Total</td><td class="vp-r">' + f(tt.pay) + '</td><td class="vp-r">' + f(tt.lump) + '</td><td class="vp-r">' + f(tt.pay + tt.lump) + '</td><td class="vp-r">' + f(tt.got) + '</td><td class="vp-r">' + f(tt.left) + '</td></tr></table></div></div>';
    }
    var ev = all.filter(function (e) {
      return (ST.pyP === 'all' || String(e.index) === ST.pyP) && (ST.pyK === 'all' || e.kind === ST.pyK) && (ST.pyS === 'all' || (ST.pyS === 'received' ? e.date <= t : e.date > t));
    }), shown = ev.slice(0, ST.pyN);
    html += '<div class="vp-card"><div class="vp-h"><h2>Payout schedule</h2><button type="button" class="tbs" data-vp="paycsv">Export CSV</button></div><div class="vp-tools"><select id="vp-pyP" aria-label="Policy">' + polOpts(ST.pyP) + '</select>'
      + '<select id="vp-pyK" aria-label="Type">' + [['all', 'Payouts and maturity'], ['payout', 'Regular payouts'], ['lump', 'Maturity only']].map(function (k) { return '<option value="' + k[0] + '"' + (ST.pyK === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select>'
      + '<select id="vp-pyS" aria-label="Status">' + [['all', 'Received and upcoming'], ['received', 'Received'], ['upcoming', 'Upcoming']].map(function (k) { return '<option value="' + k[0] + '"' + (ST.pyS === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select></div>'
      + (shown.length ? '<div class="vp-tw"><table class="vp-t" aria-label="Payout schedule"><tr><th>Date</th><th>Financial year</th><th>Policy</th><th>Type</th><th class="vp-r">Amount</th><th>Status</th></tr>'
        + shown.map(function (e) { return '<tr><td class="nw"><b>' + V.fmtDate(e.date) + '</b></td><td class="nw">' + V.fyLabel(e.fy) + '</td><td>' + EN(e.name) + '</td><td>' + (e.kind === 'lump' ? 'Maturity lump sum' : 'Payout') + '</td><td class="vp-r nw"><b>' + f(e.amt) + '</b></td><td><span class="vp-chip ' + (e.date <= t ? 'paid' : 'upcoming') + '">' + (e.date <= t ? 'Received' : 'Upcoming') + '</span></td></tr>'; }).join('') + '</table></div>'
        + (ev.length > shown.length ? '<div class="vp-more"><button type="button" class="tbs" data-vp="pymore">Show more (' + (ev.length - shown.length) + ' left)</button></div>' : '') : '<div class="em">No payouts match this filter.</div>') + '</div>';
    return html;
  }
  function payCsv() {
    var t = today(); return toCsv([['Date', 'Financial year', 'Policy', 'Type', 'Amount', 'Status']].concat(V.events({ kinds: ['payout', 'lump'] }).map(function (e) {
      return [e.date, V.fyLabel(e.fy), e.name, e.kind === 'lump' ? 'Maturity lump sum' : 'Payout', e.amt, e.date <= t ? 'Received' : 'Upcoming']; })));
  }

  /* ---------- REPORTS ---------- */
  var REPS = [['payout', 'Policy Payout Details'], ['fy', 'Premiums & Payouts by Year'], ['mat', 'Maturity Report'], ['sum', 'Policy Summary']];
  function pRep() {
    var top = head('Policy reports', 'Reports built from your policy data. Export any of them as CSV.', '');
    if (!V.count()) return top + empty();
    var search = ST.rep === 'payout' ? '<div class="tb"><input id="vp-rq" type="search" placeholder="Search year or policy\u2026" aria-label="Search policy payout report" value="' + esc(ST.rq) + '"></div>' : '';
    return top + '<div class="seg" role="group" aria-label="Report type" style="margin-bottom:14px">' + REPS.map(function (k) { return '<button type="button" data-vp="rtype" data-t="' + k[0] + '" aria-pressed="' + (ST.rep === k[0]) + '">' + k[1] + '</button>'; }).join('') + '</div>'
      + '<div class="card"><div class="rph2"><h2>' + esc(REPS.filter(function (k) { return k[0] === ST.rep; })[0][1]) + '</h2><button type="button" id="csv" data-vp="csv">Export CSV</button></div>' + search + '<div id="vpr">' + repHtml() + '</div></div>';
  }
  function repHtml() {
    var t = today();
    if (ST.rep === 'payout') {
      var M = V.payoutMatrix(), names = M.names, q = ST.rq.trim().toLowerCase(), fmt = function (v) { return v ? f(v) : ''; };
      if (!names.length) return '<div class="em">No policies added yet. Add a policy in the Policies section to see its scheduled payouts here.</div>';
      var L = M.rows.filter(function (r) { return !q || String(r.year).indexOf(q) > -1 || names.some(function (n) { return n.toLowerCase().indexOf(q) > -1 || String(r.vals[n]).indexOf(q) > -1; }); });
      if (!L.length) return '<div class="em">No years match your search.</div>';
      return '<div class="mu" style="margin:0 0 8px">Annual policy payouts by calendar year. Blank cells mean no payout is scheduled for that policy in that year.</div><div style="overflow-x:auto"><table class="vp-t" aria-label="Policy payouts by year"><thead><tr><th>Year</th>' + names.map(function (n) { return '<th>' + EN(n) + '</th>'; }).join('') + '<th>Total</th></tr></thead><tbody>'
        + L.map(function (r) { return '<tr><td><b>' + r.year + '</b></td>' + names.map(function (n) { return '<td class="nw">' + fmt(r.vals[n]) + '</td>'; }).join('') + '<td class="nw"><b>' + fmt(r.total) + '</b></td></tr>'; }).join('') + '</tbody></table></div>';
    }
    if (ST.rep === 'fy') {
      var R = V.byFinancialYear(), tt = { d: 0, p: 0, a: 0, l: 0, n: 0 };
      R.forEach(function (r) { tt.d += r.premDue; tt.p += r.premPaid; tt.a += r.payout; tt.l += r.lump; tt.n += r.net; });
      return '<div class="vp-tw"><table class="vp-t" aria-label="Premiums and payouts by financial year"><tr><th>Financial year</th><th class="vp-r">Premiums due</th><th class="vp-r">Premiums paid</th><th class="vp-r">Regular payouts</th><th class="vp-r">Maturity</th><th class="vp-r">Net (payouts \u2212 premiums)</th></tr>'
        + R.map(function (r) { return '<tr><td class="nw"><b>' + r.label + '</b></td><td class="vp-r nw">' + (r.premDue ? f(r.premDue) : '') + '</td><td class="vp-r nw">' + (r.premPaid ? f(r.premPaid) : '') + '</td><td class="vp-r nw">' + (r.payout ? f(r.payout) : '') + '</td><td class="vp-r nw">' + (r.lump ? f(r.lump) : '') + '</td><td class="vp-r nw"><b>' + f(r.net) + '</b></td></tr>'; }).join('')
        + '<tr class="t"><td>Total</td><td class="vp-r">' + f(tt.d) + '</td><td class="vp-r">' + f(tt.p) + '</td><td class="vp-r">' + f(tt.a) + '</td><td class="vp-r">' + f(tt.l) + '</td><td class="vp-r">' + f(tt.n) + '</td></tr></table></div>';
    }
    var P = sorted();
    if (ST.rep === 'mat') {
      return '<div class="vp-tw"><table class="vp-t" aria-label="Maturity report"><tr><th>Policy</th><th>Insurer</th><th>Maturity date</th><th class="vp-r">Maturity amount</th><th class="vp-r">Regular payouts</th><th class="vp-r">Total benefit</th><th class="vp-r">Premiums</th><th class="vp-r">Net gain</th></tr>'
        + P.map(function (o) { var m = V.maturity(o.x); return m ? '<tr><td><b>' + EN(o.x.name) + '</b></td><td>' + EN(o.x.insurer || '') + '</td><td class="nw">' + V.fmtDate(m.date) + '</td><td class="vp-r nw">' + (m.amount ? f(m.amount) : '') + '</td><td class="vp-r nw">' + (m.payouts ? f(m.payouts) : '') + '</td><td class="vp-r nw"><b>' + f(m.benefit) + '</b></td><td class="vp-r nw">' + (m.hasPremium ? f(m.premiums) : '') + '</td><td class="vp-r nw">' + (m.hasPremium ? f(m.net) : '') + '</td></tr>' : ''; }).join('') + '</table></div>';
    }
    return '<div class="vp-tw"><table class="vp-t" aria-label="Policy summary"><tr><th>Policy</th><th>Insurer</th><th>Policy no.</th><th class="vp-r">Sum assured</th><th>Status</th><th>Premium</th><th>Payout</th><th>Maturity</th><th class="vp-r">Premiums paid</th><th class="vp-r">Total expected</th></tr>'
      + P.map(function (o) { var x = o.x, T = V.totals(x), m = V.maturity(x), pt = V.premTotals(x); return '<tr><td><b>' + EN(x.name) + '</b></td><td>' + EN(x.insurer || '') + '</td><td>' + EN(x.no || '') + '</td><td class="vp-r nw">' + (x.sa ? f(x.sa) : '') + '</td><td>' + chip(V.status(x, t)) + '</td><td>' + esc(premLine(x)) + '</td><td>' + esc(x.amt > 0 ? f(x.amt) + ' ' + fl(x.freq).toLowerCase() : '') + '</td><td class="nw">' + (m ? V.fmtDate(m.date) : '') + '</td><td class="vp-r nw">' + (pt.count ? f(pt.paid) : '') + '</td><td class="vp-r nw"><b>' + f(T.pay + T.lump) + '</b></td></tr>'; }).join('') + '</table></div>';
  }
  function repCsv() {
    var t = today();
    if (ST.rep === 'payout') {
      var M = V.payoutMatrix(), names = M.names;
      if (!names.length) return toCsv([['Year', 'Total']]);
      return toCsv([['Year'].concat(names, ['Total'])].concat(M.rows.map(function (r) { return [r.year].concat(names.map(function (n) { return r.vals[n] || ''; }), [r.total || '']); })));
    }
    if (ST.rep === 'fy') return toCsv([['Financial year', 'Premiums due', 'Premiums paid', 'Regular payouts', 'Maturity', 'Net']].concat(V.byFinancialYear().map(function (r) { return [r.label, r.premDue, r.premPaid, r.payout, r.lump, r.net]; })));
    var P = sorted();
    if (ST.rep === 'mat') return toCsv([['Policy', 'Insurer', 'Maturity date', 'Maturity amount', 'Regular payouts', 'Total benefit', 'Premiums', 'Net gain']].concat(P.map(function (o) { var m = V.maturity(o.x); return m ? [o.x.name, o.x.insurer || '', m.date, m.amount, m.payouts, m.benefit, m.hasPremium ? m.premiums : '', m.hasPremium ? m.net : ''] : null; }).filter(Boolean)));
    return toCsv([['Policy', 'Insurer', 'Policy no.', 'Sum assured', 'Status', 'Premium', 'Payout', 'Maturity date', 'Premiums paid', 'Total expected']].concat(P.map(function (o) { var x = o.x, T = V.totals(x), m = V.maturity(x), pt = V.premTotals(x); return [x.name, x.insurer || '', x.no || '', x.sa || '', V.STATUS[V.status(x, t)], premLine(x), x.amt > 0 ? x.amt + ' ' + fl(x.freq).toLowerCase() : '', m ? m.date : '', pt.count ? pt.paid : '', T.pay + T.lump]; })));
  }

  /* ---------- add / edit form ---------- */
  function form(i) {
    var isNew = i == null, P = V.list();
    if (isNew && P.length >= V.MAX) { toast('Maximum ' + V.MAX + ' policies. Delete one to add another.'); return; }
    var x = isNew ? { name: '', insurer: '', no: '', sa: '', note: '', amt: '', freq: 'yearly', start: today(), yrs: 10, lump: '', prem: null } : P[i];
    var q = x.prem || { amt: '', freq: 'yearly', start: today(), yrs: 10 };
    var hf = function (id, l, v, ex, help) { return '<div class="hf1"><label for="' + id + '">' + l + '</label><input id="' + id + '" type="number" inputmode="decimal" value="' + esc(v == null ? '' : v) + '" ' + (ex || '') + '><small class="hh">' + (help || '') + '</small></div>'; };
    var tx = function (id, l, v, ph, max) { return '<div class="hf1"><label for="' + id + '">' + l + '</label><input id="' + id + '" type="text" maxlength="' + max + '" value="' + esc(v || '') + '" placeholder="' + esc(ph) + '"></div>'; };
    var fopts = function (sel, single) { return V.FREQ.concat(single ? [['single', 'Single premium']] : []).map(function (k) { return '<option value="' + k[0] + '"' + (sel === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join(''); };
    open('<form id="pfm" novalidate><h2>' + (isNew ? 'Add' : 'Edit') + ' Policy</h2>' + (!isNew && x.ca && typeof stampTxt === 'function' ? '<div class="tsx">' + esc(stampTxt(x)) + '</div>' : '')
      + '<section class="hs"><h3>Policy Details</h3><div class="hg">' + tx('pn', 'Policy name', x.name, 'e.g. Tata AIG money-back', 40).replace('<input ', '<input required ') + tx('pins', 'Insurer (optional)', x.insurer, 'e.g. LIC, HDFC Life', 60) + tx('pno', 'Policy number (optional)', x.no, 'Policy number', 40) + hf('psa', 'Sum assured (\u20b9, optional)', x.sa, 'min=0 step=any', 'The cover amount.') + tx('pnt', 'Note (optional)', x.note, 'Payout account, nominee\u2026', 200) + '</div></section>'
      + '<section class="hs"><h3>Premium <small>optional, to track what you pay</small></h3><div class="hg">' + hf('pma', 'Premium amount (\u20b9 each time)', q.amt, 'min=0 step=any', 'Leave empty if you do not want to track premiums.')
      + '<div class="hf1"><label for="pmf">Frequency</label><select id="pmf">' + fopts(q.freq, true) + '</select></div><div class="hf1"><label for="pms">First premium date</label><input id="pms" type="date" value="' + esc(q.start) + '" min="1990-01-01" max="2200-12-31"></div>' + hf('pmy', 'Premium paying term (years)', q.yrs, 'min=1 max=60 step=1', 'How many years premiums are paid.') + '</div></section>'
      + '<section class="hs"><h3>Payout <small>optional, money the policy pays you</small></h3><div class="hg">' + hf('pa', 'Payout amount (\u20b9 each time)', x.amt, 'min=0 step=any', 'Amount received at every payout.')
      + '<div class="hf1"><label for="pf">Frequency</label><select id="pf">' + fopts(x.freq, false) + '</select></div><div class="hf1"><label for="ps">First payout date</label><input id="ps" type="date" value="' + esc(x.start) + '" min="1990-01-01" max="2200-12-31"><small class="hh">Later payouts follow the frequency from this date.</small></div>' + hf('py', 'Duration (years)', x.yrs, 'min=1 max=60 step=1', 'How many years the regular payouts run.') + '</div></section>'
      + '<section class="hs"><h3>Maturity Lump Sum</h3><div class="hg">' + hf('pl', 'Lump sum at the end (\u20b9, optional)', x.lump, 'min=0 step=any', 'Paid once, one period after the last regular payout (start date + duration). Enter 0 if none.') + '</div></section>'
      + '<div id="pp" class="pvbox" aria-live="polite"></div><div id="pe" class="er" role="alert"></div><div class="tb"><button type="button" id="pcn">Cancel</button><button class="p">Save Policy</button></div></form>');
    dg.classList.add('hf');
    var g = $$, val = function () {
      return { name: g('pn').value.replace(/\s+/g, ' ').trim(), insurer: g('pins').value.trim(), no: g('pno').value.trim(), sa: +g('psa').value || 0, note: g('pnt').value.trim(),
               ma: +g('pma').value || 0, mf: g('pmf').value, ms: g('pms').value, my: Math.round(+g('pmy').value), amt: +g('pa').value || 0, freq: g('pf').value, start: g('ps').value, yrs: Math.round(+g('py').value), lump: +g('pl').value || 0 };
    };
    var err = function (v) {
      if (!v.name) return ['pn', 'Enter a policy name.'];
      if (!(v.sa >= 0) || v.sa > 1e13) return ['psa', 'Sum assured must be 0 or more.'];
      if (!(v.ma >= 0) || v.ma > 1e10) return ['pma', 'Premium amount must be between 0 and 1,00,00,00,000.'];
      if (v.ma > 0) { if (!V.pDate(v.ms)) return ['pms', 'Enter a valid first premium date (year 1990 to 2200).']; if (v.mf !== 'single' && !(v.my >= 1 && v.my <= 60)) return ['pmy', 'Premium paying term must be a whole number from 1 to 60 years.']; }
      if (!(v.amt >= 0) || v.amt > 1e10) return ['pa', 'Payout amount must be between 0 and 1,00,00,00,000.'];
      if (!(v.lump >= 0) || v.lump > 1e12) return ['pl', 'Lump sum must be 0 or more.'];
      if (v.amt > 0 || v.lump > 0) { if (!V.pDate(v.start)) return ['ps', 'Enter a valid first payout date (year 1990 to 2200).']; if (!(v.yrs >= 1 && v.yrs <= 60)) return ['py', 'Duration must be a whole number from 1 to 60 years.']; }
      if (!(v.ma > 0 || v.amt > 0 || v.lump > 0)) return ['pma', 'Enter a premium, a payout amount or a maturity lump sum.'];
      return null;
    };
    /* what is stored: a policy with no payout takes its dates from the premium plan */
    var raw = function (v) {
      var prem = v.ma > 0 ? { amt: v.ma, freq: v.mf, start: v.ms, yrs: v.mf === 'single' ? 1 : v.my } : null, pays = v.amt > 0 || v.lump > 0;
      return { name: v.name, insurer: v.insurer, no: v.no, sa: v.sa, note: v.note, prem: prem, amt: pays ? v.amt : 0, lump: pays ? v.lump : 0, freq: pays ? v.freq : 'yearly', start: pays ? v.start : (prem ? prem.start : v.start), yrs: pays ? v.yrs : (prem ? prem.yrs : 1) };
    };
    var pv = function () {
      var v = val(), e = err(v), b = g('pp'); if (e) { b.innerHTML = ''; return; }
      var r = raw(v), T = V.totals(r), m = V.maturity(r), out = [];
      if (r.prem) out.push('Premium: ' + esc(premLine(r)) + ' \u00b7 ' + f(V.premTotals(r).total) + ' in all');
      if (r.amt > 0 || r.lump > 0) out.push(esc(line(r)));
      if (m) out.push('Matures on ' + V.fmtDate(m.date));
      out.push('<span class="mu">Total expected: ' + f(T.pay + T.lump) + '</span>');
      b.innerHTML = '<b>Preview</b><br>' + out.join('<br>');
    };
    pv(); g('pcn').onclick = function () { dg.close(); }; g('pn').focus();
    ['pn', 'pins', 'pno', 'psa', 'pma', 'pmf', 'pms', 'pmy', 'pa', 'pf', 'ps', 'py', 'pl'].forEach(function (id) { g(id).addEventListener('input', pv); g(id).addEventListener('change', pv); });
    g('pmf').addEventListener('change', function () { g('pmy').disabled = g('pmf').value === 'single'; }); g('pmy').disabled = g('pmf').value === 'single';
    g('pfm').addEventListener('submit', function (ev) {
      ev.preventDefault(); var v = val(), e = err(v); if (e) { g('pe').textContent = e[1]; g(e[0]).focus(); return; }
      var r = V.put(raw(v), isNew ? null : i); if (!r.ok) { g('pe').textContent = r.error; return; }
      dg.close(); refresh(); toast(isNew ? 'Policy added' : 'Policy updated');
    });
  }

  /* ---------- schedule dialogs ---------- */
  function sched(i) {
    var x = V.get(i); if (!x) return;
    var L = V.schedule(x), t = today(), T = V.totals(x);
    open('<div class="pol-sch"><h2>' + EN(x.name) + ' \u00b7 payout schedule</h2><p class="mu">' + esc(line(x) || 'No payouts: this policy only has premiums.') + '</p><div class="rsum" style="margin:10px 0"><div><span class="mu">Regular payouts</span><b>' + f(T.pay) + '</b></div><div><span class="mu">Maturity lump sum</span><b>' + f(T.lump) + '</b></div><div><span class="mu">Total expected</span><b>' + f(T.pay + T.lump) + '</b></div></div>'
      + '<div class="tw"><table class="vp-t" aria-label="Payout schedule"><tr><th>#</th><th>Date</th><th>Financial year</th><th>Type</th><th>Amount</th><th>Status</th></tr>' + L.map(function (e) { return '<tr><td>' + e.n + '</td><td class="nw">' + V.fmtDate(e.date) + '</td><td class="nw">' + V.fyLabel(Math.floor((e.ix - 3) / 12)) + '</td><td>' + (e.kind === 'lump' ? 'Maturity lump sum' : 'Payout') + '</td><td class="nw"><b>' + f(e.amt) + '</b></td><td>' + (e.date <= t ? 'Received' : 'Upcoming') + '</td></tr>'; }).join('') + '</table></div><div class="tb"><button type="button" class="p" id="psc">Close</button></div></div>');
    dg.classList.add('hf'); $$('psc').onclick = function () { dg.close(); };
  }
  function premBody(i) {
    var x = V.get(i); if (!x || !x.prem) return '<p class="mu">This policy has no premium plan.</p>';
    var L = V.premSchedule(x), t = today(), T = V.premTotals(x);
    return '<p class="mu">' + esc(premLine(x)) + '</p><div class="rsum" style="margin:10px 0"><div><span class="mu">Total premiums</span><b>' + f(T.total) + '</b></div><div><span class="mu">Paid</span><b>' + f(T.paid) + '</b></div><div><span class="mu">Remaining</span><b>' + f(T.remaining) + '</b></div></div>'
      + (T.overdue ? '<div class="vp-alert"><b>' + plural(T.overdue, 'premium') + ' overdue</b><button type="button" data-vp="paidall" data-i="' + i + '">Mark due as paid</button></div>' : '')
      + '<div class="tw"><table class="vp-t" aria-label="Premium schedule"><tr><th>#</th><th>Due date</th><th>Financial year</th><th>Amount</th><th>Status</th><th></th></tr>' + L.map(function (e) {
          var paid = !!(x.paid && x.paid[e.date]), st = pstat({ paid: paid, date: e.date }, t);
          return '<tr><td>' + e.n + '</td><td class="nw">' + V.fmtDate(e.date) + '</td><td class="nw">' + V.fyLabel(Math.floor((e.ix - 3) / 12)) + '</td><td class="nw"><b>' + f(e.amt) + '</b></td><td><span class="vp-chip ' + st + '">' + PSL[st] + '</span></td><td class="nw"><button type="button" class="tbs" data-vp="paid" data-i="' + i + '" data-d="' + e.date + '" data-v="' + (paid ? 0 : 1) + '">' + (paid ? 'Undo' : 'Mark paid') + '</button></td></tr>'; }).join('') + '</table></div>';
  }
  function premsch(i) {
    var x = V.get(i); if (!x) return;
    open('<div class="pol-sch" data-pi="' + i + '"><h2>' + EN(x.name) + ' \u00b7 premiums</h2><div id="vp-psd">' + premBody(i) + '</div><div class="tb"><button type="button" class="p" id="psc">Close</button></div></div>');
    dg.classList.add('hf'); $$('psc').onclick = function () { dg.close(); };
  }
  function redrawPremDlg() { var w = $$('vp-psd'), h = w && w.closest('[data-pi]'); if (w && h && dg.open) w.innerHTML = premBody(+h.dataset.pi); }

  /* ---------- behaviour ---------- */
  function listRefresh() { var el = $$('vp-list'); if (!el) return; var t = today(), q = ST.q.trim().toLowerCase(), P = sorted(); el.innerHTML = listBody(P.filter(function (o) { return (ST.sf === 'all' || V.status(o.x, t) === ST.sf) && (!q || [o.x.name, o.x.insurer, o.x.no, o.x.note].join(' ').toLowerCase().indexOf(q) > -1); }), P.length); }
  function act(a, b) {
    var i = b.dataset.i != null ? +b.dataset.i : null;
    switch (a) {
      case 'add': form(null); break;
      case 'edit': form(i); break;
      case 'sched': sched(i); break;
      case 'premsch': premsch(i); break;
      case 'del': { var x = V.get(i); if (!x) return; confirmBox('Delete policy \u201c' + x.name + '\u201d? Its premiums, payouts and maturity will be removed from every report and forecast.', function () { var u = undoer(); V.remove(i); refresh(); toast('Policy deleted', u); }); break; }
      case 'grp': ST.grp = !ST.grp; refresh(); break;
      case 'gtog': ST.gc[b.dataset.g] = !ST.gc[b.dataset.g]; listRefresh(); { var nb = document.querySelector('[data-vp="gtog"][data-g="' + b.dataset.g + '"]'); if (nb) nb.focus(); } break;
      case 'paid': if (V.setPaid(i, b.dataset.d, b.dataset.v === '1')) { refresh(); redrawPremDlg(); } break;
      case 'paidall': { var n = V.markPaidUpTo(i, today()); toast(n ? plural(n, 'premium') + ' marked as paid' : 'Nothing to mark'); refresh(); redrawPremDlg(); break; }
      case 'prmore': ST.prN += 60; refresh(); break;
      case 'pymore': ST.pyN += 60; refresh(); break;
      case 'pyview': ST.pyV = b.dataset.t; refresh(); break;
      case 'rtype': ST.rep = b.dataset.t; refresh(); break;
      case 'csv': text(REPS.filter(function (k) { return k[0] === ST.rep; })[0][1] + ' CSV', repCsv()); break;
      case 'paycsv': text('Payout schedule CSV', payCsv()); break;
    }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-vp],[data-vpp]'); if (!b) return;
    if (b.dataset.vpp) { if (typeof UI !== 'undefined' && UI.tab === TAB) go(b.dataset.vpp); return; }
    act(b.dataset.vp, b);
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.id) return;
    if (t.id === 'vp-q') { ST.q = t.value; listRefresh(); }
    else if (t.id === 'vp-rq') { ST.rq = t.value; var el = $$('vpr'); if (el) el.innerHTML = repHtml(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t) return;
    if (t.dataset && t.dataset.vpset) { V.setUsedBy(t.dataset.vpset, t.checked); toast((t.dataset.vpset === 'goal' ? 'Goal Planner' : 'Retirement Planner') + (t.checked ? ' now uses your policy data' : ' no longer uses your policy data')); render(); return; }
    var m = { 'vp-sf': ['sf'], 'vp-prP': ['prP'], 'vp-prS': ['prS'], 'vp-pyP': ['pyP'], 'vp-pyK': ['pyK'], 'vp-pyS': ['pyS'] }[t.id];
    if (m) { ST[m[0]] = t.value; if (t.id === 'vp-prP' || t.id === 'vp-prS') ST.prN = 60; if (t.id.indexOf('vp-py') === 0) ST.pyN = 60; refresh(); }
  });

  /* register with the app: it adds the Policies tab, and shows our bar, page and bottom navigation on it */
  window.VRMODULES = (window.VRMODULES || []).concat([{ tab: TAB, label: 'Policies', bar: bar, page: page, nav: nav }]);
  window.VRPolicyUI = { open: function (p) { if (p) ST.page = p; UI.tab = TAB; render(); window.scrollTo(0, 0); } };
})();
