(() => {
  const root = document.querySelector('#admin-view');
  const grid = root?.querySelector('.admin-section-grid');
  if (!root || !grid || document.querySelector('#activity-log-panel')) return;

  grid.insertAdjacentHTML('beforeend', `<section class="panel table-panel admin-section-panel" id="activity-log-panel" hidden>
    <div class="panel-head"><div><h3>User activity log</h3><p>Read-only record of sign-ins and changes. Entries cannot be edited or deleted.</p></div></div>
    <div class="activity-log-message" id="activity-log-message" hidden></div>
    <table class="activity-log-table"><thead><tr><th>Date & time</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody id="activity-log-table"><tr><td colspan="4">Open this section to load activity.</td></tr></tbody></table>
  </section>`);

  if (!document.querySelector('#activity-log-layout')) {
    const style = document.createElement('style');
    style.id = 'activity-log-layout';
    style.textContent = `
      .operations-app #admin-view .admin-section-grid > #activity-log-panel { max-width: none; }
      .operations-app #activity-log-panel { width: 100%; }
      .operations-app #activity-log-panel .activity-log-table { min-width: 0; table-layout: fixed; }
      .operations-app #activity-log-panel th:nth-child(1), .operations-app #activity-log-panel td:nth-child(1) { width: 14%; }
      .operations-app #activity-log-panel th:nth-child(2), .operations-app #activity-log-panel td:nth-child(2) { width: 29%; }
      .operations-app #activity-log-panel th:nth-child(3), .operations-app #activity-log-panel td:nth-child(3) { width: 15%; }
      .operations-app #activity-log-panel th:nth-child(4), .operations-app #activity-log-panel td:nth-child(4) { width: 42%; }
      .operations-app #activity-log-panel td { overflow-wrap: anywhere; word-break: normal; }
      .operations-app #activity-log-panel .item-note { overflow-wrap: anywhere; }
      @media (max-width: 760px) {
        .operations-app #activity-log-panel .activity-log-table,
        .operations-app #activity-log-panel .activity-log-table tbody,
        .operations-app #activity-log-panel .activity-log-table tr,
        .operations-app #activity-log-panel .activity-log-table td { display: block; width: 100%; }
        .operations-app #activity-log-panel .activity-log-table thead { display: none; }
        .operations-app #activity-log-panel .activity-log-table tr { padding: 12px 16px; border-top: 1px solid var(--line); }
        .operations-app #activity-log-panel .activity-log-table tr:first-child { border-top: 0; }
        .operations-app #activity-log-panel .activity-log-table td { display: grid; grid-template-columns: minmax(88px, .55fr) minmax(0, 1.45fr); gap: 10px; padding: 6px 0; border: 0; }
        .operations-app #activity-log-panel .activity-log-table td[data-label]::before { content: attr(data-label); color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
        .operations-app #activity-log-panel .activity-log-table td[colspan] { display: block; }
      }
    `;
    document.head.append(style);
  }

  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const load = async () => {
    const table = document.querySelector('#activity-log-table');
    const message = document.querySelector('#activity-log-message');
    table.innerHTML = '<tr><td colspan="4">Loading activity…</td></tr>';
    try {
      const response = await fetch('/api/activity-log');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load activity.');
      message.hidden = true;
      table.innerHTML = result.entries.map((entry) => `<tr><td data-label="Date &amp; time">${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(entry.occurredAt))}</td><td data-label="User"><strong>${escape(entry.userName)}</strong><div class="item-note">${escape(entry.userEmail)}</div></td><td data-label="Action">${escape(entry.action)}</td><td data-label="Details">${escape(entry.details)}</td></tr>`).join('') || '<tr><td colspan="4">No activity has been recorded yet.</td></tr>';
    } catch (error) {
      message.textContent = error.message;
      message.hidden = false;
      table.innerHTML = '<tr><td colspan="4">Activity log unavailable.</td></tr>';
    }
  };
  document.querySelector('[data-admin-section="activity"]')?.addEventListener('click', load);
  root.querySelector('[data-admin-section="activity"]')?.addEventListener('click', load);
})();
