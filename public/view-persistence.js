// Keep the operator in the same workspace area after a browser refresh.
// This is UI state only; it is deliberately separate from operational data.
const activeWorkspaceViewKey = 'je-oils.active-workspace-view';
const workspaceViews = new Set([...document.querySelectorAll('.nav-item')].map((button) => button.dataset.view));

function rememberWorkspaceView(view) {
  if (workspaceViews.has(view)) localStorage.setItem(activeWorkspaceViewKey, view);
}

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => rememberWorkspaceView(button.dataset.view));
});

const rememberedWorkspaceView = localStorage.getItem(activeWorkspaceViewKey);
if (workspaceViews.has(rememberedWorkspaceView)) {
  document.querySelector(`.nav-item[data-view="${rememberedWorkspaceView}"]`)?.click();
}
