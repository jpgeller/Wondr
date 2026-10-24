# Wondr main design

A self-contained copy of the minimal black design. Everything needed to display
and interact with it is in this folder. No dependencies, installation, or build step.
It uses system fonts, so there are no font downloads.

## Open

From the repository root:

```sh
open -a "Google Chrome" main-design/index.html
```

Or run a local server:

```sh
python3 -m http.server 4179 --bind 127.0.0.1 --directory main-design
```

Then visit http://localhost:4179.

## Files

- `index.html` — page and form.
- `styles.css` — layout, background overlay, and responsive styles.
- `app.js` — form validation, simulated generation, and place reveals.
- `assets/wander-background.png` — your original background image, unchanged.
- `assets/park.jpg`, `restaurant.jpg`, `chess.jpg` — reveal photographs.
- `assets/favicon.svg` — browser icon.

This is a design prototype. Generate uses fixed sample San Francisco places and
illustrative travel times; it does not call the agent or other APIs. The displayed
account is a placeholder. Only the optional “View place” links leave this folder.

## Image credits

The reveal photographs are illustrative, not verified photos of every venue.

- Park: https://unsplash.com/photos/a-group-of-people-sitting-on-top-of-a-lush-green-hillside-qV7ndx2V0Go
- Restaurant: Gerrie van der Walt, https://unsplash.com/photos/restaurant-interior-design-yM4GL3REtsU
- Chess: Hassan Pasha, https://unsplash.com/photos/7SjEuEF06Zw
- Photo license: https://unsplash.com/license
- Background: supplied by you.
