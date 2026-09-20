(() => {
  const toggle = document.querySelector('#sidebar-toggle');
  const scrim = document.querySelector('#sidebar-scrim');
  const sidebar = document.querySelector('#sidebar');
  const medium = window.matchMedia('(max-width: 75rem)');
  const small = window.matchMedia('(max-width: 42rem)');
  const preferenceKey = 'je-oils-navigation-collapsed';

  if (!toggle || !scrim || !sidebar) return;

  const navItems = [...sidebar.querySelectorAll('.nav-item')];
  const isCollapsed = () => document.body.classList.contains('sidebar-collapsed');
  // Medium and small screens show the expanded menu over the page, so it closes after use.
  const isOverlay = () => medium.matches;

  const readPreference = () => {
    try { return window.localStorage.getItem(preferenceKey) === 'true'; } catch { return false; }
  };
  const writePreference = (collapsed) => {
    try { window.localStorage.setItem(preferenceKey, String(collapsed)); } catch { /* storage unavailable */ }
  };

  const setCollapsed = (collapsed, { persist = false } = {}) => {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    const label = small.matches
      ? (collapsed ? 'Open navigation menu' : 'Close navigation menu')
      : (collapsed ? 'Expand navigation' : 'Collapse navigation');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
    sidebar.inert = small.matches && collapsed;
    // Icon-only rail: show each destination's name on hover.
    navItems.forEach((item) => {
      if (collapsed && !small.matches) item.setAttribute('title', item.textContent.replace(/[^\p{L}\p{N}&\s]/gu, '').trim());
      else item.removeAttribute('title');
    });
    if (persist) writePreference(collapsed);
  };

  const applyLayout = () => setCollapsed(medium.matches || readPreference());
  applyLayout();
  medium.addEventListener('change', applyLayout);
  small.addEventListener('change', applyLayout);

  toggle.addEventListener('click', () => setCollapsed(!isCollapsed(), { persist: !isOverlay() }));
  scrim.addEventListener('click', () => setCollapsed(true));

  sidebar.addEventListener('click', (event) => {
    const target = event.target.closest('.nav-item, [data-admin-section]');
    if (!target) return;
    if (target.classList.contains('admin-parent')) {
      // The admin submenu has no room in the rail, so open the full menu to reveal it.
      if (isCollapsed()) setCollapsed(false);
      return;
    }
    if (isOverlay() && !isCollapsed()) setCollapsed(true);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOverlay() && !isCollapsed()) {
      setCollapsed(true);
      toggle.focus();
    }
  });
})();
