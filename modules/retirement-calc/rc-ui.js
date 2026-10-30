/* =====================================================================================================================
   Vriddhi · RETIREMENT CALCULATOR MODULE · SCREEN        modules/retirement-calc/rc-ui.js

   One screen: the ten NISM inputs, the three NISM answers, and how the answer was reached. It is independent of every other
   module: it reads no plan data, writes nothing to the plan, and keeps what you type only in memory (nothing is stored, so
   one client's figures can never show up in another client's plan). Every number comes from window.VRRetCalc (rc-core.js).
   It registers itself with the app through window.VRMODULES.
   ===================================================================================================================== */
(function () {
  'use strict';
  var C = window.VRRetCalc, TAB = 'Retirement Calculator';
  var ST = { v: blank() };

  function blank() { var o = {}; C.FIELDS.forEach(function (k) { o[k] = ''; }); return o; }
  var $$ = function (id) { return document.getElementById(id); };

  /* the ten inputs, in NISM's order: [key, label, unit, help, step] */
  var GROUPS = [
    ['About you', [
      ['age', 'Present age', 'years', 'Your age today.', 1],
      ['retAge', 'Retirement age', 'years', 'The age at which you will retire.', 1],
      ['life', 'Life expectancy', 'years', 'The age up to which you expect to live. It must be above the retirement age.', 1]]],
    ['Expenses and inflation', [
      ['exp', 'Present living expenses per month', '\u20b9', 'What you spend each month today and want to keep spending after retirement.', 'any'],
      ['infl', 'Long-term inflation', '%', 'Average yearly rise in prices. NISM advises 4% to 7%.', 'any'],
      ['red', 'Reduction in expenses after retirement', '%', 'Costs such as travel to work that stop after retirement. Enter 0 for none.', 'any']]],
    ['Returns', [
      ['rWork', 'Expected return during working years', '%', 'Yearly return on your investments until you retire. NISM: 6% to 9% fixed income, 10% to 15% equity.', 'any'],
      ['rRet', 'Expected return during retired life', '%', 'Yearly return on the corpus after you retire, in low-risk products. NISM: 5% to 7%.', 'any']]],
    ['Money you already have', [
      ['sav', 'Current savings for retirement', '\u20b9', 'Existing savings you will set aside for retirement. Enter 0 if none.', 'any'],
      ['ben', 'Retirement benefits received at retirement', '\u20b9', 'EPF, gratuity and similar money received when you retire. Enter 0 if none.', 'any']]]
  ];

  function field(f) {
    return '<div class="rc-f"><label for="rc-' + f[0] + '">' + esc(f[1]) + '</label><div class="rc-in"><input id="rc-' + f[0] + '" data-rc="' + f[0]
      + '" type="number" inputmode="decimal" min="0" step="' + f[4] + '" value="' + esc(ST.v[f[0]]) + '" autocomplete="off"><span aria-hidden="true">' + esc(f[2]) + '</span></div><small>' + esc(f[3]) + '</small></div>';
  }

  /* ---------- results ---------- */
  function kpi(cls, k, v, s) { return '<div class="rc-kpi ' + cls + '"><div class="rc-k">' + k + '</div><div class="rc-v">' + v + '</div><div class="rc-s">' + s + '</div></div>'; }
  function row(a, b, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + a + '</td><td>' + b + '</td></tr>'; }

  function results() {
    var r = C.calc(ST.v);
    var anyTyped = C.FIELDS.some(function (k) { return String(ST.v[k]).trim() !== ''; });
    if (!anyTyped) return '<div class="rc-card rc-empty"><h2>Your result will appear here</h2><p class="mu">Fill in the details on the left. The answer updates as you type. You can also try the NISM sample to see how it works.</p></div>';
    if (!r.ok) return '<div class="rc-card"><h2>Complete the details</h2><ul class="rc-err">' + r.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';

    var inv = r.covered ? kpi('ok', 'Investment required per month', C.inr(0), 'Your current savings and retirement benefits are enough. No separate investment is needed.')
      : r.retiringNow ? kpi('late', 'Investment required', 'Not possible monthly', 'You retire today, so there is no time to invest. You are short by ' + C.inr(r.shortfall) + ' right now.')
      : kpi('', 'Investment required per month', C.inr(r.out.invest), 'Invested every month for ' + r.yearsToRetire + ' year' + (r.yearsToRetire === 1 ? '' : 's') + ' at ' + r.input.rWork + '% a year to cover the shortfall.');
    var h = '<div class="rc-kpis">'
      + kpi('', 'Per month amount required during retired life', C.inr(r.out.monthly), 'Your ' + C.inr(r.monthlyNow) + ' today, grown by inflation to the day you retire' + (r.input.red ? ', less ' + r.input.red + '%' : '') + '.')
      + kpi('', 'Corpus required at retirement', C.inr(r.out.corpus) + '<small> (' + C.short(r.out.corpus) + ')</small>', 'Needed on the day you retire to keep your standard of living until age ' + r.input.life + '.')
      + inv + '</div>';

    h += '<div class="rc-card"><div class="rc-h"><h2>How this was worked out</h2></div><div class="rc-tw"><table class="rc-t"><tbody>'
      + row('Years until retirement', r.yearsToRetire) + row('Years in retired life', r.yearsRetired + ' (' + r.monthsRetired + ' months)')
      + row('Monthly expense needed at retirement', C.inr(r.monthlyAtRetirement))
      + row('Corpus required at retirement', C.inr(r.corpus), 'rc-b')
      + row('Current savings, grown to retirement', C.inr(r.savingsAtRetirement)) + row('Retirement benefits received', C.inr(r.benefits))
      + row('Money you will already have', C.inr(r.haveAtRetirement), 'rc-b')
      + (r.covered ? row('Surplus over the corpus required', C.inr(r.surplus), 'rc-ok') : row('Shortfall to be built by investing', C.inr(r.shortfall), 'rc-b'))
      + '</tbody></table></div></div>';

    if (r.advice.length) h += '<div class="rc-card rc-adv"><h2>Check your assumptions</h2><ul>' + r.advice.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></div>';
    return h;
  }

  /* ---------- shell ---------- */
  function page() {
    return '<div id="rc-pg"><div class="rph"><div><h1>Retirement Calculator</h1><p class="rc-sub">Find the corpus you need on the day you retire and what to invest each month to reach it. Based on the NISM retirement planning calculator. Nothing you type here is saved.</p></div>'
      + '<div class="rpr"><button type="button" data-rcact="sample">Try NISM sample</button><button type="button" data-rcact="reset">Clear</button></div></div>'
      + '<div class="rc-two"><div class="rc-card rc-form">' + GROUPS.map(function (g) {
        return '<section><h3>' + esc(g[0]) + '</h3><div class="rc-grid">' + g[1].map(field).join('') + '</div></section>'; }).join('')
      + '</div><div id="rc-out">' + results() + '</div></div>'
      + '<p class="rc-note">All calculations assume payments at the end of each period. Results are estimates built on your assumptions, not a guarantee or financial advice.</p></div>';
  }
  function refreshOut() { var el = $$('rc-out'); if (el) el.innerHTML = results(); }

  document.addEventListener('input', function (e) {
    var t = e.target, k = t && t.dataset && t.dataset.rc; if (!k) return;
    ST.v[k] = t.value; refreshOut();
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-rcact]'); if (!b || (typeof UI !== 'undefined' && UI.tab !== TAB)) return;
    if (b.dataset.rcact === 'sample') { C.FIELDS.forEach(function (k) { ST.v[k] = String(C.SAMPLE[k]); }); }
    else ST.v = blank();
    render();
  });

  /* register with the app: it adds the tab; this module has one screen, so no sub-bar and no bottom navigation */
  window.VRMODULES = (window.VRMODULES || []).concat([{ tab: TAB, label: 'Retirement Calculator', bar: function () { return ''; }, page: page, nav: function () { return ''; } }]);
})();
