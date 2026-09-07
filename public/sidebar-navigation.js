(() => {
  const toggle = document.querySelector('#sidebar-toggle');
  const scrim = document.querySelector('#sidebar-scrim');
  const storageKey = 'je-oils-sidebar-collapsed';

  if (!toggle || !scrim) return;

  const setCollapsed = (collapsed) => {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Show navigation menu' : 'Hide navigation menu');
    localStorage.setItem(storageKey, String(collapsed));
  };

  setCollapsed(localStorage.getItem(storageKey) === 'true');
  toggle.addEventListener('click', () => setCollapsed(!document.body.classList.contains('sidebar-collapsed')));
  scrim.addEventListener('click', () => setCollapsed(true));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setCollapsed(true);
  });
})();
