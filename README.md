# Castorium

Industrial tycoon / clicker about beavers running a timber-processing plant.

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

The current build is deliberately **UI-first**: plain HTML/CSS/JavaScript, buttons, drag & drop, icons and progress bars. No final graphical interface and no 3D yet.

The goal is to tune and harden the simulation loop before investing in presentation. A future visual version may use low-poly 3D assets and Three.js, but the simulation should remain independent from rendering.

### Implemented now

- 50,000 starting Ramitas.
- Buy trucks of 5 logs.
- Manually drag logs from the truck to the raw-log yard.
- Three fixed cutting-line slots.
- Buy cutting lines.
- Manually load logs into cutting lines.
- Hold to cut; 10 cuts produce one cut stack.
- Each log contains 80 cuts / 8 stacks.
- A cutting line stops while its output is occupied.
- Intermediate cut-stack yard.
- Two packaging-line slots.
- Buy packaging lines.
- Five manual packaging steps: wrap, corner protectors, strap, label, release.
- Finished-goods yard.
- Customer orders.
- Manually load dispatch trucks and collect Ramitas.
- Day / shift / time clock with pause and speed controls.
- Contextual tutorial and event log.

### Run locally

Serve the repository with any static HTTP server, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

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
- personnel / hiring access
- future optional slots only if they create actual gameplay

## Prototype milestones

- **0.1:** complete manual production loop
- **0.2:** first workers and automation
- **0.3:** individual workers, aptitudes, absences and supervisor
- **0.4:** wear, breakdowns and maintenance
- **0.5:** safety events, engineering discoveries and richer events
- **0.6:** visual plant, routes and eventual low-poly assets
