# Castorium — Game Design Notes

## Core feel

Reference: **Monkey Mart**, but less childish, more industrial and with more emergent simulation.

Castorium must remain a game, not become management software.

The player should spend most of their attention on:

- moving material through the plant;
- fixing visible bottlenecks;
- doing satisfying repetitive actions;
- deciding what to automate next;
- handling memorable workers and operational events;
- improving throughput over a very long sandbox run.

Avoid systems that mainly add bookkeeping.

## Player avatar: the boss beaver

The player is represented by one boss beaver.

In the final visual version the boss does not need elaborate traversal animation. Clicking/choosing a workplace can simply make the boss appear at that task.

Examples:

1. Player selects the forklift.
2. Boss appears on the forklift.
3. Player chooses a cut stack.
4. Forklift travels to it and picks it up.
5. Player chooses a destination yard.
6. Forklift drops it.
7. Player chooses a packaging line.
8. Forklift returns to its parking position and the boss appears at packaging.
9. Each click performs one packaging action.

This establishes a central rule:

> Before a worker is hired, the boss personally performs that worker's job.

Automation is therefore not an abstract percentage boost. It removes a task the player already understands and has personally performed.

## Manual work

Manual means manual.

Examples:

- unloading logs one at a time;
- moving individual loads;
- holding the cutting control to operate a line;
- performing each packaging step separately;
- loading dispatch trucks.

Repetition is intentional, but should become mildly annoying just before the player can reasonably afford to automate it.

## Material flow

Supplier truck
→ incoming raw material
→ raw-log yard
→ cutting line
→ cut stack
→ cut-stack buffer yard
→ packaging line
→ finished package
→ finished-goods yard
→ dispatch truck
→ Ramitas

Material should remain physically/conceptually persistent throughout this chain.

## Orders

Finished packages can be produced and stockpiled before customer orders arrive.

Orders request a simple quantity of packages and provide an immediate production goal.

The player can therefore choose between:

- produce only for current demand;
- build buffer inventory;
- overbuild capacity for future orders.

## Failure state

The game is relaxed and sandbox-oriented.

Bankruptcy can exist, but ordinary mistakes should not easily destroy a long-running game. A player should need to manage the plant very badly to truly fail.

## Time

Use a readable compressed schedule:

- Day number
- Morning / Afternoon / Night
- pause
- x1
- x2
- x4

Exact industrial realism is unnecessary.

## Plant layout

The plant begins almost empty.

Fixed production/support spaces:

### Production

- 1 raw-log yard
- 3 cutting-line spaces
- 1 cut-stack buffer yard
- 2 packaging-line spaces
- 1 finished-goods / dispatch yard

### Support

- 1 maintenance office
- 1 supervisor office
- 1 dispatch office
- 1 Safety & Hygiene office
- 1 Engineering & Development office
- personnel/hiring access

Additional spaces should only be added when they unlock a fun system, not for architectural completeness.

## Economy pacing

The first cutting line must consume most of the starting capital so the second line is a genuine production milestone instead of an opening purchase.

Current prototype values:

- starting capital: 50,000 Ramitas;
- cutting line: 35,000;
- packaging line: 8,000;
- truck of 5 logs: 1,000.

This leaves enough room to establish one complete production chain, but not to immediately buy a second cutting line.

## Machine upgrades

Machine upgrades belong to the individual machine, not to one giant global technology menu.

Each installed line has its own **Upgrades** menu. Two nominally identical machines can therefore evolve differently over a long game.

Early cutting-line upgrades:

- faster cutting rhythm;
- larger output accumulator so one finished stack does not immediately block production.

Early packaging-line upgrades:

- larger input queue, allowing multiple cut stacks to wait on the line and be processed consecutively;
- larger finished-output accumulator.

Costs increase by level. A heavily upgraded old line should feel materially more valuable than a newly installed stock machine.

Later Engineering & Development can discover additional upgrade families instead of exposing everything at game start.

## Sandbox progression

There is no final campaign victory condition.

A player can continue optimizing for a very long time until the original empty warehouse becomes a nearly autonomous, absurdly optimized timber plant.

A theoretical completionist run should take a long time: many upgrades, highly experienced workers, automated logistics, optimized machines and rare improvements.

## Workers

Workers are individual named characters from the moment they appear.

Each can eventually have:

- name;
- nickname;
- aptitudes by role;
- concentration;
- experience;
- traits;
- salary;
- history/events;
- temporary or permanent absences.

Naming pool should use playful references to:

- tree species;
- trunks;
- saws;
- wood;
- incisors;
- paddles;
- flat tails;
- rodents;
- dams;
- rivers.

Provisional examples:

- Tito Álamo
- Beto Incisivo
- Marta Serrucho
- Raúl Castiñeiro
- Nora Viruta
- Pipo Dientón
- Elsa Nogal
- Omar Represa
- Cacho Quebracho
- Lidia Paleta
- René Roedor
- Susana Astilla

## Workers and wrong jobs

Any employee can temporarily cover another job.

Aptitude matters. Putting an unsuitable employee into a role should sharply increase the chance of mistakes, breakdowns or accidents.

This creates useful emergency decisions without requiring a giant HR system.

## Automation order

First automation targets:

1. crane operator / raw material unloading and line loading;
2. cutting-line operator;
3. forklift operator;
4. packaging operator;
5. dispatcher;
6. supervisor for reassignment and repetitive administration.

The first workers should create dramatic quality-of-life improvements rather than tiny efficiency bonuses.

Current prototype first hires:

- Tito Álamo — crane operator: unloads incoming trucks and feeds empty cutting lines;
- Nora Viruta — cutting operator: runs loaded cutting lines;
- Beto Incisivo — forklift operator: moves cut stacks, feeds packaging, clears finished outputs and loads dispatch;
- Marta Serrucho — packaging operator: performs packaging steps automatically.

Workers currently have a hiring cost and a simple recurring monthly salary. Rich aptitudes and traits come later.

## Future machine problems

Machines will eventually track health/wear and can be run to failure.

Preventive maintenance restores condition and reduces severe failures.

Ignoring maintenance remains a valid gamble.

Repair speed depends on maintenance personnel. Without them, the boss can perform an intentionally tedious manual repair action.

## Safety

Safety staff reduce accident probability rather than making accidents impossible.

Accident probability can later depend on:

- worker aptitude;
- concentration/fatigue;
- machine condition;
- operational pressure;
- safety coverage.

Humor should target the fictional workplace and characters, not serious injuries.

## Engineering

Engineering should preferably unlock improvements in response to real plant problems.

Examples:

- forklifts are constantly overloaded → double-load proposal;
- output buffers keep blocking → larger output buffer;
- repeated bearing failures → improved bearings;
- long transport paths → route optimization.

This is preferable to a giant arbitrary tech tree because upgrades feel like solutions to the player's own factory history.

## Prototype rule

For now: buttons, drag & drop, icons and progress bars only.

Do not spend time on graphical polish until the complete simulation loop is fun and stable.
