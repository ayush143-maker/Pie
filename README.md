# PiLex

π printed as a real sheet of numbers — starting at 3.14159… and scrolling
towards infinity. Type any word and its number-form (PI → 169) gets
**marker-highlighted** everywhere it appears in π, like highlighting a notebook.

## Run
    npm install
    npm run dev

## Use
- Type a word → its digits are searched in π, matches get drawn with an
  animated marker stroke. Typing raw digits (e.g. `169` or `31415`) also works.
- Click a № position, a black band, or use Enter / ‹ › to jump between matches.
- Hover any digit to see its position. Drag / scroll to descend.
- Pick a digit count (10K → 200K); π computes in a worker with live progress.
- Encoders: A1Z26 (A=1…Z=26) or phone keypad.

## Note on 10 million digits
A 10M-digit run is minutes of BigInt work + heavy RAM in a browser tab;
the tier list caps at 200K by default. Add a bigger tier in `src/pi/digits.js`
(`TIERS`) if you want to push it on a desktop machine.
