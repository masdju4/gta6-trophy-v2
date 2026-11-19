// roadmap.js — the six-stage platinum route: stage definitions, grouping trophies by
// their roadmap stage, and rendering the roadmap view with missable flags.

export const ROADMAP_STAGES = [
  {
    stage: 1,
    title: "Prologue & Chapters 1–2",
    blurb: "Play the opening story straight through: Gone Fishing, the first two chapter cards and the early missions. Start letting the passive counters (stunts, choices, vehicle discoveries) tick up in the background.",
  },
  {
    stage: 2,
    title: "Chapters 3–4 & the duo's window",
    blurb: "Push the main chain into Vice City. While both leads are still together, clear the partner trophies and the airport escape — their windows can close as the story splits the duo. Sample every activity type once.",
  },
  {
    stage: 3,
    title: "Strands, story scenes & the finale",
    blurb: "Finish all stranger strands and let every one-time story scene play out before the point of no return. Save manually before the finale, then complete the final mission for the first gold.",
  },
  {
    stage: 4,
    title: "The Leonida sweep",
    blurb: "Post-story free roam: open the whole map and sweep it once — areas, meditation spots, WAiNK check-ins, card sets, vehicles and the venue visits all ride along on the same route.",
  },
  {
    stage: 5,
    title: "The grind: challenges, races & rackets",
    blurb: "Work the tracked counters: shooting-range golds, drone-race wins, distinct race wins, stunts, challenges, robberies, laundering, spending and properties. Stack overlapping tasks so one run feeds several trophies.",
  },
  {
    stage: 6,
    title: "100% & the platinum",
    blurb: "Audit the in-game completion stats, top up whatever is under 100% for the second gold, and the platinum registers the moment the other 54 are earned.",
  },
];

export function groupTrophiesByStage(trophies) {
  const groups = new Map(ROADMAP_STAGES.map((stage) => [stage.stage, []]));
  for (const trophy of trophies) {
    if (groups.has(trophy.stage)) groups.get(trophy.stage).push(trophy);
  }
  for (const list of groups.values()) list.sort((a, b) => a.id - b.id);
  return groups;
}

function isMasked(trophy, earnedNames, spoilersOn) {
  return spoilersOn && trophy.kind === "story" && !earnedNames.has(trophy.name);
}

export function renderRoadmap(container, trophies, earnedNames, spoilersOn, openTrophy) {
  const groups = groupTrophiesByStage(trophies);
  container.replaceChildren();

  const intro = document.createElement("p");
  intro.className = "roadmap-intro";
  intro.textContent = "The platinum route in six stages, built from the official trophy descriptions: story chapters first, the missable windows while they are open, collectible sweeps mid-game, the counter grind after the credits, and the platinum last. Amber flags mark every missable trophy.";
  container.append(intro);

  for (const stage of ROADMAP_STAGES) {
    const stageTrophies = groups.get(stage.stage);
    const earnedHere = stageTrophies.filter((t) => earnedNames.has(t.name)).length;

    const card = document.createElement("article");
    card.className = "stage-card";

    const number = document.createElement("span");
    number.className = "stage-number";
    number.textContent = String(stage.stage);

    const title = document.createElement("h3");
    title.className = "stage-title";
    title.textContent = stage.title;
    const progress = document.createElement("span");
    progress.className = "stage-progress";
    progress.textContent = `${earnedHere}/${stageTrophies.length}`;
    title.append(progress);

    const blurb = document.createElement("p");
    blurb.className = "stage-blurb";
    blurb.textContent = stage.blurb;

    const list = document.createElement("ul");
    list.className = "stage-trophies";
    for (const trophy of stageTrophies) {
      const masked = isMasked(trophy, earnedNames, spoilersOn);
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stage-trophy" + (earnedNames.has(trophy.name) ? " earned" : "");

      const dot = document.createElement("span");
      dot.className = `grade-dot dot-${trophy.grade}`;
      dot.title = trophy.grade;

      const text = document.createElement("span");
      const name = document.createElement("span");
      name.className = "stage-trophy-name" + (masked ? " masked" : "");
      name.textContent = masked ? "???" : trophy.name;
      const note = document.createElement("span");
      note.className = "stage-trophy-note";
      if (trophy.missable) {
        const flag = document.createElement("span");
        flag.className = "missable-flag";
        flag.textContent = "MISSABLE · ";
        note.append(flag);
      }
      note.append(document.createTextNode(masked ? "Hidden story trophy — earn it or lift the spoiler guard to see its plan." : trophy.roadmapNote));
      text.append(name, note);

      button.append(dot, text);
      button.addEventListener("click", () => openTrophy(trophy.name));
      item.append(button);
      list.append(item);
    }

    card.append(number, title, blurb, list);
    container.append(card);
  }
}