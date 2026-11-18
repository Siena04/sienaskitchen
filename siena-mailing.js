document.addEventListener('DOMContentLoaded', () => {
  const slot = document.querySelector('[data-mailing-slot]');
  if (!slot) return;
  const card = document.createElement('section');
  card.className = 'mailing-card';
  card.innerHTML = `<h2>Sign up for my mailing list</h2><p>Recipes and kitchen inspiration, straight to your inbox.</p><div class="mailing-preview"><button type="button" class="mailing-preview-field">Your email address</button><button type="button" class="mailing-preview-submit">Sign up →</button></div><small>Coming soon · Preview only</small>`;
  slot.append(card);
  const dialog = document.createElement('dialog');
  dialog.className = 'mailing-dialog';
  dialog.setAttribute('aria-labelledby', 'mailing-title');
  dialog.innerHTML = `<div class="mailing-dialog-top"><h2 id="mailing-title">Join my mailing list</h2><button type="button" class="mailing-close" aria-label="Close">×</button></div><p class="mailing-notice">Preview only: this form isn’t accepting subscriptions yet.</p><form class="mailing-form"><label>Name <input name="name" autocomplete="name" required /></label><label>Email <input name="email" type="email" autocomplete="email" required /></label><fieldset><legend>How did you find me? <small>(select any)</small></legend><label><input type="checkbox" name="source" value="Instagram" /> Instagram</label><label><input type="checkbox" name="source" value="Search" /> Search engine</label><label><input type="checkbox" name="source" value="Friend" /> Friend or family</label><label><input type="checkbox" name="source" value="Other" /> Other</label><label>Tell me more <input name="source-other" placeholder="Optional" /></label></fieldset><fieldset><legend>What recipes are you into? <small>(select any)</small></legend><label><input type="checkbox" name="recipes" value="Dinner" /> Dinners</label><label><input type="checkbox" name="recipes" value="Baking" /> Baking &amp; sweets</label><label><input type="checkbox" name="recipes" value="Breakfast" /> Breakfast</label><label><input type="checkbox" name="recipes" value="Meal prep" /> Meal prep</label><label><input type="checkbox" name="recipes" value="Sides" /> Sides</label></fieldset><button class="mailing-submit" type="submit">Sign me up →</button></form><div class="mailing-thanks" hidden role="status"><h3>Thanks for your interest!</h3><p>This is a preview, so your details haven’t been saved and you won’t receive notifications yet.</p></div>`;
  document.body.append(dialog);
  let opener;
  card.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { opener = button; dialog.showModal(); }));
  dialog.querySelector('.mailing-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => { if (opener) opener.focus(); });
  dialog.querySelector('form').addEventListener('submit', (event) => { event.preventDefault(); event.currentTarget.hidden = true; dialog.querySelector('.mailing-thanks').hidden = false; });
});
