# Where I've Been

Static GitHub Pages travel-day tracker.

## Files
- `index.html` — page structure
- `styles.css` — appearance
- `app.js` — application logic
- `supabase-setup.sql` — optional Supabase setup for encrypted transfer codes and legacy cloud sync
- `.nojekyll` — keeps GitHub Pages serving the project as a plain static site

## Important
The actual travel history entered in the website is stored in the browser under `whereIveBeen.data.v2`. Replacing these repository files does not intentionally delete that browser data.

Never put a Supabase secret/service-role key into this repository. Only the publishable key belongs in browser-side code.
