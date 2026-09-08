(() => {
  const form = document.querySelector('#ai-question-form');
  const input = document.querySelector('#ai-question');
  const answer = document.querySelector('#ai-answer');
  const status = document.querySelector('#ai-status');
  const note = document.querySelector('#ai-connection-note');
  if (!form || !input || !answer || !status || !note) return;

  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));

  const showAnswer = (title, text, state = 'answer') => {
    answer.hidden = false;
    answer.className = `ai-answer ${state}`;
    answer.innerHTML = `<strong>${escapeHtml(title)}</strong><div>${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
  };

  document.querySelectorAll('[data-ai-prompt]').forEach((button) => {
    button.addEventListener('click', () => {
      input.value = button.dataset.aiPrompt || '';
      input.focus();
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    status.textContent = 'Analysing live data…';
    showAnswer('Preparing your answer', 'Reviewing the current operational records…', 'loading');

    try {
      const response = await fetch('/api/insights', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        status.textContent = result.code === 'AI_NOT_CONFIGURED' ? 'Connection needed' : 'Try again';
        showAnswer(result.code === 'AI_NOT_CONFIGURED' ? 'Connect AI Insights' : 'Unable to answer', result.error || 'Please try again.', 'error');
        return;
      }
      status.textContent = 'Insight ready';
      note.textContent = 'Answer generated from the live JE Oils operational data available at the time of your question.';
      showAnswer('AI insight', result.answer);
    } catch {
      status.textContent = 'Try again';
      showAnswer('Unable to answer', 'Check your connection and try again.', 'error');
    } finally {
      submit.disabled = false;
    }
  });
})();
