# Sunday Table

This is a lightweight Node app that serves a recipe website and can also be deployed to static hosting like GitHub Pages.

## What is included

- A public homepage with recipe cards, search, filtering, and recipe popups.
- An admin page where you can add, edit, and delete recipes in your browser.
- Export of a `recipes.json` file so you can publish new recipes without changing the page layout.

## How to use it

1. Run `npm start`.
2. Open `http://localhost:3000/admin.html`.
3. Add or edit recipes.
4. Use `Preview draft` if you want to see the unpublished version in the same browser.
5. Click `Download recipes.json`.
6. Replace the file at `data/recipes.json` with the downloaded file.
7. Publish the repository to GitHub Pages if you want a free public host.

## Local development

- This project has no external npm dependencies.
- `npm start` runs a small Node server on port `3000` by default.
- You can change the port with `PORT=4000 npm start`.

## Important limitation

GitHub Pages is static hosting. That means the admin page cannot securely save changes directly to the live website. This version uses a browser-based editor plus JSON export so you can start simply and cheaply.

If you later want online logins, direct image uploads, scheduled posts, subscriber emails, or paid content, the natural next step is moving the same design onto a CMS-backed platform such as Astro + Sanity, Next.js + Supabase, or a hosted website builder.

## GitHub Pages setup

1. Create a new GitHub repository.
2. Upload all files from this folder.
3. In GitHub, open `Settings > Pages`.
4. Under `Build and deployment`, choose `Deploy from a branch`.
5. Select your main branch and the root folder.
6. Save. GitHub will give you a public website URL.

## Customisation ideas

- Replace the placeholder about section with your story.
- Update the social links in `index.html`.
- Change the site name from `Sunday Table` to your brand name.
- Swap the starter recipes for your own Apple Notes recipes and photos.
