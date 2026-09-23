(() => {
  const root = document.querySelector('#admin-view');
  const grid = root?.querySelector('.admin-section-grid');
  if (!root || !grid || document.querySelector('#ai-settings-panel')) return;

  grid.insertAdjacentHTML('beforeend', `<section class="panel admin-section-panel" id="ai-settings-panel" hidden>
    <div class="panel-head"><div><p class="ai-kicker">AI INTEGRATION</p><h3>AI Settings</h3><p>Replace and verify the dashboard AI key without opening Cloudflare. Only administrators can make changes.</p></div><span class="ai-status" id="ai-settings-status">Checking…</span></div>
    <div class="ai-settings-message" id="ai-settings-message" hidden aria-live="polite"></div>
    <form id="ai-settings-form" class="ai-settings-form">
      <label>New OpenAI API key<input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-…" required></label>
      <p class="item-note">The key is tested before saving, then stored only as an encrypted Cloudflare Worker secret. It is never retained in the ERP database or shown again.</p>
      <button type="submit" class="primary">Save &amp; test connection</button>
    </form>
    <p class="item-note" id="ai-settings-help"></p>
  </section>`);

  if (!document.querySelector('#ai-settings-style')) {
    const style = document.createElement('style'); style.id = 'ai-settings-style';
    style.textContent = `.operations-app #ai-settings-panel{max-width:760px}.ai-settings-form{display:grid;gap:12px;padding:0}.ai-settings-form label{display:grid;gap:6px;font-size:12px;font-weight:700;color:#536257}.ai-settings-form input{width:100%;border:1px solid #cfc6a7;border-radius:4px;background:#fffefa;padding:11px 12px;font:14px/1.4 'DM Sans',Arial,sans-serif}.ai-settings-message{margin:0 0 14px;padding:11px 13px;border-left:3px solid #b49b53;background:#fffdf7;color:#3e4038}.ai-settings-message.error{border-left-color:#a94737}`;
    document.head.append(style);
  }

  const status = document.querySelector('#ai-settings-status');
  const message = document.querySelector('#ai-settings-message');
  const form = document.querySelector('#ai-settings-form');
  const help = document.querySelector('#ai-settings-help');
  const show = (text, failed = false) => { message.textContent = text; message.hidden = !text; message.classList.toggle('error', failed); };

  async function load() {
    status.textContent = 'Checking…';
    try {
      const response = await fetch('/api/admin/ai-settings');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not check AI Settings.');
      status.textContent = result.configured ? 'Key configured' : 'Key needed';
      if (!result.automationConfigured) {
        help.textContent = 'One-time owner setup needed: add the Cloudflare secret CF_WORKER_SECRETS_API_TOKEN before this page can securely save keys.';
        form.querySelector('button').disabled = true;
      } else {
        help.textContent = `Connection uses ${result.model}. Replacing a key is recorded in the user activity log.`;
        form.querySelector('button').disabled = false;
      }
    } catch (error) { status.textContent = 'Unavailable'; show(error.message, true); }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    const input = form.elements.apiKey;
    button.disabled = true; show('Verifying the key and saving it as an encrypted Cloudflare secret…');
    try {
      const response = await fetch('/api/admin/ai-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: input.value }) });
      const result = await response.json();
      input.value = '';
      if (!response.ok) throw new Error(result.error || 'AI Settings could not save the key.');
      show(result.message); status.textContent = 'Connection verified';
    } catch (error) { input.value = ''; show(error.message, true); status.textContent = 'Not updated'; }
    finally { button.disabled = false; }
  });

  document.querySelector('[data-admin-section="ai-settings"]')?.addEventListener('click', load);
  root.querySelector('[data-admin-section="ai-settings"]')?.addEventListener('click', load);
})();
