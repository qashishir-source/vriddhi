# Retirement Calculator module

An independent, one-screen calculator modelled on the NISM Retirement Planning Calculator. It does not use plan data, the
Retirement Planner, or the Policies module, and it stores nothing.

```
modules/retirement-calc/
  rc-core.js   pure calculation (window.VRRetCalc) - the single source of truth for the numbers
  rc-ui.js     the screen; registers {tab:'Retirement Calculator'} in window.VRMODULES
  rc.css       styles (app theme variables only)
tests/rc-core.test.js   node tests/rc-core.test.js
```
Run the test after changing `rc-core.js`. To change the method, edit only `rc-core.js` and its header comment.
