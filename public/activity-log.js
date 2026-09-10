(() => {
  const root = document.querySelector('#admin-view');
  const grid = root?.querySelector('.admin-section-grid');
  if (!root || !grid || document.querySelector('#activity-log-panel')) return;

  grid.insertAdjacentHTML('beforeend', `<section class="panel table-panel admin-section-panel" id="activity-log-panel" hidden>
    <div class="panel-head"><div><h3>User activity log</h3><p>Read-only record of sign-ins and changes. Entries cannot be edited or deleted.</p></div></div>
    <div class="activity-log-message" id="activity-log-message" hidden></div>
    <table><thead><tr><th>Date & time</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody id="activity-log-table"><tr><td colspan="4">Open this section to load activity.</td></tr></tbody></table>
  </section>`);

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
      table.innerHTML = result.entries.map((entry) => `<tr><td>${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(entry.occurredAt))}</td><td><strong>${escape(entry.userName)}</strong><div class="item-note">${escape(entry.userEmail)}</div></td><td>${escape(entry.action)}</td><td>${escape(entry.details)}</td></tr>`).join('') || '<tr><td colspan="4">No activity has been recorded yet.</td></tr>';
    } catch (error) {
      message.textContent = error.message;
      message.hidden = false;
      table.innerHTML = '<tr><td colspan="4">Activity log unavailable.</td></tr>';
    }
  };
  document.querySelector('[data-admin-section="activity"]')?.addEventListener('click', load);
  root.querySelector('[data-admin-section="activity"]')?.addEventListener('click', load);
})();
