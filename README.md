# Castorium

A low-poly industrial tycoon / clicker prototype starring beavers.

The core fantasy: start by doing every task manually, then hire workers who automate exactly the jobs you are tired of doing yourself.

## Design north star

Think **Monkey Mart**, but less childish and with a small industrial simulation underneath.

- Fun before realism.
- Visible physical flow before spreadsheets.
- Manual actions first; automation is the reward.
- Workers are characters, not anonymous percentage bonuses.
- A small plant with meaningful bottlenecks, not an ERP.
- Sandbox progression with a very long optimization tail.

Deliberately excluded: energy billing, insurance, taxes, financing and other business-accounting systems that do not create playful decisions.

## Current prototype

The first playable build uses Three.js with primitive low-poly geometry and a tiny HTML HUD. It is intentionally asset-free so the loop can be tuned before replacing geometry with final models.

### Run locally

Because the project uses ES modules, serve the repo with any static HTTP server instead of opening `index.html` directly.

Examples:

```bash
python -m http.server 8000
```

or

```bash
npx serve .
```

Then open the local URL shown by the server.

## Planned plant slots

- 1 raw-log yard
- 3 cutting-line slots
- 1 cut-stack buffer yard
- 2 packaging-line slots
- 1 finished-goods dispatch yard
- 1 maintenance office
- 1 supervisor office
- 1 dispatch office
- 1 safety office
- 1 engineering & development office
- future optional support/decorative slots if they add gameplay

## Prototype milestones

- **0.1:** complete manual production loop
- **0.2:** first workers and automation
- **0.3:** individual workers, aptitudes, absences and supervisor
- **0.4:** wear, breakdowns and maintenance
- **0.5:** safety events, engineering discoveries and richer events
- **0.6:** replace placeholder geometry with proper low-poly assets and polish spatial play
