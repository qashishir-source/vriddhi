/* =====================================================================================================================
   Vriddhi · RETIREMENT CALCULATOR MODULE · CALCULATION        modules/retirement-calc/rc-core.js

   A stand-alone, pure calculator (no app state, no storage, no DOM) modelled on the NISM Retirement Planning Calculator.
   It is the SINGLE SOURCE OF TRUTH for the numbers; rc-ui.js only draws them.         →  window.VRRetCalc

   Method (all payments at the END of each period, as NISM states):
     1. Monthly need at retirement  = present monthly expense × (1 + inflation)^(years to retirement) × (1 − reduction%)
     2. Corpus at retirement        = present value of that need, withdrawn monthly for (life − retirement) × 12 months,
                                      the need rising with inflation and the corpus earning the post-retirement return.
                                      Monthly real rate = ((1 + post-retirement return) / (1 + inflation))^(1/12) − 1
                                      (this reproduces the NISM sample exactly: 85,000 / 48→49→80 / 6% / 20% / 8% = 2,03,35,327)
     3. Existing money at retirement = (current savings) grown for the working years at the working return
                                      + (retirement benefits, already received at retirement, not grown)
     4. Shortfall                   = max(0, corpus − existing money at retirement)
     5. Monthly investment          = shortfall ÷ future-value factor of a month-end SIP at the working return
                                      (monthly rate = (1 + working return)^(1/12) − 1, so every % is an effective yearly %)
   Step 3 and 5 compounding is not published by NISM; the choice above is documented here and unit-tested.
   ===================================================================================================================== */
(function () {
  'use strict';

  var LIMITS = { age: [0, 100], pct: [0, 30], money: [0, 1e10] };

  /* NISM's own guidance, used only for soft, non-blocking advice on the screen */
  var ADVICE = {
    inflation: { lo: 4, hi: 7, text: 'NISM suggests 4% to 7% long-term inflation.' },
    retRet: { lo: 5, hi: 7, text: 'NISM suggests 5% to 7% after retirement, because that money should carry little risk.' },
    workRet: { lo: 6, hi: 15, text: 'NISM suggests 6% to 9% for fixed income and 10% to 15% for equity while working.' }
  };

  var SAMPLE = { age: 48, retAge: 49, life: 80, infl: 6, exp: 85000, red: 20, rWork: 8, rRet: 8, sav: 200000, ben: 0 };
  var FIELDS = ['age', 'retAge', 'life', 'infl', 'exp', 'red', 'rWork', 'rRet', 'sav', 'ben'];

  var num = function (v) { var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : NaN; };
  var round = function (v) { return Math.round(v); };

  /* present value of `pmt` paid at the end of each of `n` periods at rate `r` (r may be 0 or negative) */
  function pvAnnuity(pmt, r, n) { return Math.abs(r) < 1e-12 ? pmt * n : pmt * (1 - Math.pow(1 + r, -n)) / r; }
  /* future value of `pmt` paid at the end of each of `n` periods at rate `r` */
  function fvFactor(r, n) { return Math.abs(r) < 1e-12 ? n : (Math.pow(1 + r, n) - 1) / r; }

  /* turn raw form values into numbers; '' is "not entered" (NaN) except the three optional money/percent fields */
  function parse(raw) {
    var o = {}, r = raw || {};
    FIELDS.forEach(function (k) { o[k] = num(r[k]); });
    ['red', 'sav', 'ben'].forEach(function (k) { if (String(r[k] == null ? '' : r[k]).trim() === '') o[k] = 0; });
    return o;
  }

  /* returns a list of plain-English problems; an empty list means the inputs can be calculated */
  function validate(i) {
    var e = [], need = { age: 'Present age', retAge: 'Retirement age', life: 'Life expectancy', infl: 'Long-term inflation', exp: 'Present living expenses',
                         rWork: 'Return during working years', rRet: 'Return during retired life' };
    Object.keys(need).forEach(function (k) { if (!isFinite(i[k])) e.push(need[k] + ' is required.'); });
    if (e.length) return e;
    [['age', 'Present age'], ['retAge', 'Retirement age'], ['life', 'Life expectancy']].forEach(function (a) {
      if (i[a[0]] < LIMITS.age[0] || i[a[0]] > LIMITS.age[1]) e.push(a[1] + ' must be between 0 and 100.'); });
    if (i.retAge < i.age) e.push('Retirement age cannot be less than present age.');
    if (i.life <= i.retAge) e.push('Life expectancy must be greater than retirement age.');
    [['infl', 'Inflation'], ['rWork', 'Return during working years'], ['rRet', 'Return during retired life']].forEach(function (a) {
      if (i[a[0]] < -5 || i[a[0]] > LIMITS.pct[1]) e.push(a[1] + ' must be between -5% and ' + LIMITS.pct[1] + '%.'); });
    if (i.red < 0 || i.red > 100) e.push('Reduction in expenses must be between 0% and 100%.');
    if (i.exp <= 0) e.push('Present living expenses must be more than 0.');
    ['exp', 'sav', 'ben'].forEach(function (k) { if (i[k] < 0 || i[k] > LIMITS.money[1]) e.push('Amounts must be between 0 and 1,00,00,00,000.'); });
    return e;
  }

  /* soft advice (never blocks a result) */
  function advise(i) {
    var out = [];
    if (isFinite(i.infl) && (i.infl < ADVICE.inflation.lo || i.infl > ADVICE.inflation.hi)) out.push(ADVICE.inflation.text);
    if (isFinite(i.rRet) && (i.rRet < ADVICE.retRet.lo || i.rRet > ADVICE.retRet.hi)) out.push(ADVICE.retRet.text);
    if (isFinite(i.rWork) && (i.rWork < ADVICE.workRet.lo || i.rWork > ADVICE.workRet.hi)) out.push(ADVICE.workRet.text);
    if (isFinite(i.rRet) && isFinite(i.infl) && i.rRet < i.infl) out.push('Your return after retirement is below inflation, so the corpus needed grows quickly.');
    return out;
  }

  /* the three NISM outputs plus the working behind them */
  function calc(raw) {
    var i = parse(raw), errors = validate(i);
    if (errors.length) return { ok: false, errors: errors, advice: advise(i) };
    var yrsTo = i.retAge - i.age, yrsIn = i.life - i.retAge, months = round(yrsIn * 12);
    var mAtRet = i.exp * Math.pow(1 + i.infl / 100, yrsTo) * (1 - i.red / 100);
    var rReal = Math.pow((1 + i.rRet / 100) / (1 + i.infl / 100), 1 / 12) - 1;
    var corpus = pvAnnuity(mAtRet, rReal, months);
    var savFv = i.sav * Math.pow(1 + i.rWork / 100, yrsTo);
    var have = savFv + i.ben, gap = Math.max(0, corpus - have);
    var rm = Math.pow(1 + i.rWork / 100, 1 / 12) - 1, nm = round(yrsTo * 12), sip = 0;
    if (gap > 0) sip = nm > 0 ? gap / fvFactor(rm, nm) : NaN;       /* NaN: retiring now, a monthly plan is not possible */
    return {
      ok: true, input: i, advice: advise(i), yearsToRetire: yrsTo, yearsRetired: yrsIn, monthsRetired: months, monthsToRetire: nm,
      monthlyNow: i.exp, monthlyAtRetirement: mAtRet, corpus: corpus, savingsAtRetirement: savFv, benefits: i.ben, haveAtRetirement: have,
      shortfall: gap, surplus: Math.max(0, have - corpus), monthlyInvestment: sip, covered: gap <= 0,
      retiringNow: gap > 0 && nm <= 0,
      out: { monthly: round(mAtRet), corpus: round(corpus), invest: isFinite(sip) ? round(Math.ceil(sip - 1e-9)) : null }
    };
  }

  /* Indian digit grouping and the short lakh / crore wording */
  function inr(v) { var n = round(+v || 0); return '\u20b9 ' + n.toLocaleString('en-IN'); }
  function short(v) {
    var n = Math.abs(+v || 0), s = (+v < 0 ? '-' : '');
    if (n >= 1e7) return s + '\u20b9' + (n / 1e7).toFixed(2) + ' Cr';
    if (n >= 1e5) return s + '\u20b9' + (n / 1e5).toFixed(2) + ' L';
    return s + '\u20b9' + Math.round(n).toLocaleString('en-IN');
  }

  window.VRRetCalc = { SAMPLE: SAMPLE, FIELDS: FIELDS, ADVICE: ADVICE, parse: parse, validate: validate, advise: advise, calc: calc, inr: inr, short: short,
                       pvAnnuity: pvAnnuity, fvFactor: fvFactor };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.VRRetCalc;
})();
