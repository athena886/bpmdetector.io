(() => {
  'use strict';
  const button = document.querySelector('.menu-button');
  const nav = document.getElementById('site-nav');
  if (!button || !nav) return;
  button.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(open));
  });
})();
