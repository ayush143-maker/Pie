# PiLex

A mathematical art experiment: the first 20,000 digits of π computed live,
scattered as a living typographic field, translated into letters, and searched
like a dictionary.

## Run
    npm install
    npm run dev

## Interaction
- Type a word — matches appear as solid black bands inside the digit field.
- Click a № position (or press Enter / ←→) to glide the camera to a match.
- Hover or touch the field: digits drift away and reveal their letters.
- Click any digit to read its position and letter. Drag / scroll to descend.
- Switch mappings: A=1 · A=0 · Σ mod 26 · digit pairs mod 26.
- `/` focuses search · Esc clears.

## Performance notes
- One canvas, sprite-cached glyphs (rotation baked in), typed-array layout,
  row culling, DPR capped at 2 — thousands of glyphs at 60fps.
