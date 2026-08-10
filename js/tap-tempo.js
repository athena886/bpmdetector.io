(() => {
  'use strict';
  const button = document.getElementById('tap-button');
  const resetButton = document.getElementById('reset-tap');
  const output = document.getElementById('tap-output').querySelector('strong');
  let taps = [];

  function reset() { taps = []; output.textContent = '—'; }
  function tap() {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2500) taps = [];
    taps.push(now);
    taps = taps.slice(-9);
    if (taps.length > 1) {
      const intervals = taps.slice(1).map((time, index) => time - taps[index]).filter(value => value > 220 && value < 2500);
      if (intervals.length) {
        intervals.sort((a, b) => a - b);
        const trimmed = intervals.length > 4 ? intervals.slice(1, -1) : intervals;
        const average = trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length;
        output.textContent = Math.round(60000 / average);
      }
    }
    button.classList.add('is-tapped');
    setTimeout(() => button.classList.remove('is-tapped'), 90);
  }
  button.addEventListener('click', tap);
  resetButton.addEventListener('click', reset);
  document.addEventListener('keydown', event => {
    const tag = document.activeElement.tagName;
    if (event.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'SUMMARY'].includes(tag)) { event.preventDefault(); tap(); }
  });
})();
