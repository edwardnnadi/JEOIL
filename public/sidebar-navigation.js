(() => {
  const toggle = document.querySelector('#sidebar-toggle');
  const scrim = document.querySelector('#sidebar-scrim');
  const mobile = window.matchMedia('(max-width: 900px)');

  if (!toggle || !scrim) return;

  const setCollapsed = (collapsed) => {
    document.body.classList.toggle('sidebar-collapsed', mobile.matches && collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Show navigation menu' : 'Hide navigation menu');
  };

  const applyLayout = () => setCollapsed(mobile.matches);
  applyLayout();
  mobile.addEventListener('change', applyLayout);
  toggle.addEventListener('click', () => setCollapsed(!document.body.classList.contains('sidebar-collapsed')));
  scrim.addEventListener('click', () => setCollapsed(true));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setCollapsed(true);
  });
})();
