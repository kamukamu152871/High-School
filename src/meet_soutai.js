import {
  EVENTS_MEET,
  calcEventPower,
  calcTimeSecondsFromPower,
  groupBySize,
  formatTime,
  shuffle,
} from "./rules.js";

// 重要：地区/県/地域/全国で能力補正は付けない（同一のライバル群を使う）
// → ライバルは state.rivals の該当群（district/prefecture/region/national）を利用する。
// ※ rivals.js 側も同一レンジに後で統一します。

// --- 自校：手動選出（UIで作る）を受け取る前提 ---
// entries: [{school,isPlayer,athlete,event}, ...]
function normalizePlayerEntries(state, picked) {
  return picked.map(p => ({
    school: state.teamName,
    isPlayer: true,
    athlete: p.athlete,
    event: p.event,
  }));
}

// 相手校の選出（仕様：総合値が高い順→最も高い種目に割当、埋まってたら次へ）
function overall(a) {
  const ab = a.abilities;
  return Math.round((ab.sprint + ab.speed + ab.stamina + ab.toughness + ab.technique) / 5);
}

function selectEntriesAI(school) {
  const maxPerEvent = 3;
  const maxEventsPerAthlete = 2;

  const eventCounts = Object.fromEntries(EVENTS_MEET.map(e => [e, 0]));
  const athleteCounts = new Map();

  const sorted = school.athletes.slice().sort((a, b) => overall(b) - overall(a));

  const entries = [];
  for (const a of sorted) {
    const powers = EVENTS_MEET
      .map(ev => ({ ev, p: calcEventPower(a, ev) }))
      .sort((x, y) => y.p - x.p);

    for (const { ev } of powers) {
      if (eventCounts[ev] >= maxPerEvent) continue;
      const used = athleteCounts.get(a) ?? 0;
      if (used >= maxEventsPerAthlete) break;

      // 同一種目に同じ選手を二重登録しない
      if (entries.some(e => e.athlete === a && e.event === ev)) continue;

      entries.push({ school: school.name, isPlayer: false, athlete: a, event: ev });
      eventCounts[ev] += 1;
      athleteCounts.set(a, used + 1);
    }

    if (EVENTS_MEET.every(ev => eventCounts[ev] >= maxPerEvent)) break;
  }

  return entries;
}

// --- 競技進行（予選/決勝） ---
function race(entries, event) {
  const raced = entries.map(e => {
    const power = calcEventPower(e.athlete, event);
    const timeSec = calcTimeSecondsFromPower(event, power);
    const digits = event === "800" ? 2 : 1;
    return { ...e, power, timeSec, timeText: formatTime(timeSec, digits) };
  });
  raced.sort((a, b) => a.timeSec - b.timeSec);
  return raced;
}

function run800(allEntries) {
  const groups = groupBySize(allEntries, 8);
  const qualifiers = [];
  const heats = [];

  for (let i = 0; i < groups.length; i++) {
    const r = race(groups[i], "800");
    heats.push({ heat: i + 1, results: r });
    if (r[0]) qualifiers.push(r[0]); // 各組1位
  }

  const final = race(qualifiers, "800");
  return { type: "withFinal", heats, final };
}

function run1500or3000sc(allEntries, event) {
  const groups = groupBySize(allEntries, 16);
  const heats = [];
  const all = [];

  for (let i = 0; i < groups.length; i++) {
    const r = race(groups[i], event);
    heats.push({ heat: i + 1, results: r });
    all.push(...r);
  }

  const top15 = all.slice().sort((a, b) => a.timeSec - b.timeSec).slice(0, 15);
  const final = race(top15, event);
  return { type: "withFinal", heats, final };
}

function run5000like(allEntries, event) {
  const groups = groupBySize(allEntries, 30);
  const heats = [];
  const all = [];

  for (let i = 0; i < groups.length; i++) {
    const r = race(groups[i], event);
    heats.push({ heat: i + 1, results: r });
    all.push(...r);
  }

  const overall = all.slice().sort((a, b) => a.timeSec - b.timeSec);
  return { type: "noFinal", heats, overall };
}

function getPlayerRanks(eventResult) {
  if (eventResult.type === "withFinal") {
    return eventResult.final
      .map((x, i) => ({ x, rank: i + 1 }))
      .filter(r => r.x.isPlayer)
      .map(r => r.rank);
  }
  return eventResult.overall
    .map((x, i) => ({ x, rank: i + 1 }))
    .filter(r => r.x.isPlayer)
    .map(r => r.rank);
}

export function runSoutai(state, stageKey, playerPickedEntries, allowedEvents = null) {
  // allowedEvents: 通過した種目だけ実施したい時に使用（県/地域/全国）
  const rivals = (state.rivals?.[stageKey] ?? []).slice();

  // 相手校もシャッフル（雰囲気）
  shuffle(rivals);

  const playerEntriesAll = normalizePlayerEntries(state, playerPickedEntries);

  // 通過種目限定がある場合はフィルタ
  const playerEntries = allowedEvents
    ? playerEntriesAll.filter(e => allowedEvents.includes(e.event))
    : playerEntriesAll;

  const rivalEntries = [];
  for (const s of rivals) rivalEntries.push(...selectEntriesAI(s));

  const all = playerEntries.concat(rivalEntries);

  const byEvent = Object.fromEntries(EVENTS_MEET.map(e => [e, []]));
  for (const e of all) {
    if (allowedEvents && !allowedEvents.includes(e.event)) continue;
    byEvent[e.event].push(e);
  }

  const result = {
    type: "soutai",
    stage: stageKey,
    title: stageTitle(stageKey),
    when: `${state.month}月${state.week}週`,
    events: {},
    // 種目別通過
    qualifiedEvents: [],
    threshold: stageKey === "region" ? 5 : 7,
  };

  // 種目ごと
  if (!allowedEvents || allowedEvents.includes("800")) result.events["800"] = run800(byEvent["800"]);
  if (!allowedEvents || allowedEvents.includes("1500")) result.events["1500"] = run1500or3000sc(byEvent["1500"], "1500");
  if (!allowedEvents || allowedEvents.includes("3000sc")) result.events["3000sc"] = run1500or3000sc(byEvent["3000sc"], "3000sc");
  if (!allowedEvents || allowedEvents.includes("5000")) result.events["5000"] = run5000like(byEvent["5000"], "5000");
  if (!allowedEvents || allowedEvents.includes("5000w")) result.events["5000w"] = run5000like(byEvent["5000w"], "5000w");

  // 通過判定（全国は通過不要）
  if (stageKey !== "national") {
    for (const ev of EVENTS_MEET) {
      if (allowedEvents && !allowedEvents.includes(ev)) continue;
      const er = result.events[ev];
      if (!er) continue;

      const ranks = getPlayerRanks(er);
      const best = ranks.length ? Math.min(...ranks) : null;
      if (best !== null && best <= result.threshold) {
        result.qualifiedEvents.push(ev);
      }
    }
  }

  state.lastMeetResult = result;
  return result;
}

function stageTitle(key) {
  if (key === "district") return "地区総体";
  if (key === "prefecture") return "県総体";
  if (key === "region") return "地域総体";
  if (key === "national") return "全国総体";
  return "総体";
}
