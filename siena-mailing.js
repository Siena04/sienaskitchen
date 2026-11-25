document.addEventListener('DOMContentLoaded', () => {
  const slot = document.querySelector('[data-mailing-slot]');
  if (!slot) return;
  const card = document.createElement('section');
  card.className = 'mailing-card';
  card.id = 'mailing-list';
  card.setAttribute('aria-labelledby', 'mailing-card-heading');
  card.innerHTML = `
    <div class="mailing-copy">
      <h2 id="mailing-card-heading">From my kitchen to your inbox</h2>
      <p>Get new recipes and ideas for what to cook next.</p>
    </div>
    <form class="mailing-preview" novalidate>
      <label class="sr-only" for="mailing-preview-email">Email address</label>
      <input class="mailing-preview-field" id="mailing-preview-email" name="email" type="email" autocomplete="email" placeholder="Your email address" />
      <button class="mailing-preview-submit" type="submit" aria-haspopup="dialog">Join the list</button>
    </form>`;
  slot.append(card);
  if (location.hash === '#mailing-list') {
    requestAnimationFrame(() => card.scrollIntoView({ block: 'center' }));
  }
  const dialog = document.createElement('dialog');
  dialog.className = 'mailing-dialog';
  dialog.setAttribute('aria-labelledby', 'mailing-title');
  dialog.innerHTML = `
    <div class="mailing-dialog-top">
      <h2 id="mailing-title">Join my mailing list</h2>
      <button type="button" class="mailing-close" aria-label="Close">×</button>
    </div>
    <form class="mailing-form">
      <label>Name <input name="name" autocomplete="name" required /></label>
      <label>Email <input name="email" type="email" autocomplete="email" required /></label>
      <fieldset>
        <legend>How did you find me? <small>(select any)</small></legend>
        <label><input type="checkbox" name="source" value="Instagram" /> Instagram</label>
        <label><input type="checkbox" name="source" value="Search" /> Search engine</label>
        <label><input type="checkbox" name="source" value="Friend" /> Friend or family</label>
        <label><input type="checkbox" name="source" value="Other" /> Other</label>
      </fieldset>
      <fieldset>
        <legend>What recipes are you into? <small>(select any)</small></legend>
        <label><input type="checkbox" name="recipes" value="Dinner" /> Dinners</label>
        <label><input type="checkbox" name="recipes" value="Baking" /> Baking &amp; sweets</label>
        <label><input type="checkbox" name="recipes" value="Breakfast" /> Breakfast</label>
        <label><input type="checkbox" name="recipes" value="Meal prep" /> Meal prep</label>
        <label><input type="checkbox" name="recipes" value="Sides" /> Sides</label>
      </fieldset>
      <button class="mailing-submit" type="submit">Sign me up</button>
    </form>
    <div class="mailing-thanks" hidden role="status">
      <h3>Thanks for your interest!</h3>
      <p>This is a preview, so your details haven’t been saved and you won’t receive notifications yet.</p>
    </div>`;
  document.body.append(dialog);
  const previewForm = card.querySelector('form');
  const previewButton = previewForm.querySelector('button');
  const form = dialog.querySelector('form');
  const thanks = dialog.querySelector('.mailing-thanks');

  card.addEventListener('click', (event) => {
    if (!previewButton.contains(event.target)) previewForm.requestSubmit();
  });
  previewForm.addEventListener('submit', (event) => {
    event.preventDefault();
    form.elements.namedItem('email').value = previewForm.elements.namedItem('email').value;
    dialog.showModal();
    form.elements.namedItem('name').focus();
  });
  dialog.querySelector('.mailing-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => {
    if (form.hidden) {
      form.reset();
      form.hidden = false;
      thanks.hidden = true;
    }
    previewButton.focus();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    form.hidden = true;
    thanks.hidden = false;
  });
});
