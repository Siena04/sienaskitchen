(() => {
  const button = document.querySelector('.pantry-open-button');
  const dialog = document.getElementById('pantryPreview');
  if (!button || !dialog) return;
  button.addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
})();
