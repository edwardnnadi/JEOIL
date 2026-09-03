document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => document.querySelector('#record-dialog').close());
});
