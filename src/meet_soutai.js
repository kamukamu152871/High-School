import { EVENTS_MEET, calcEventPower, calcTimeSecondsFromPower, groupBySize, formatTime, randInt, shuffle } from "./rules.js";

// 強さ群：地区<県<地域<全国（簡略：能力レンジを変える）
const GROUP_POWER = {
  district: { min: 25, max: 65 },
  prefecture: { min: 35, max: 75 },
  region: { min: 45, max: 85 },
  national: { min: 55, max: 95 },
};

function createRivalSchools(groupKey) {
  const { min, max } = GROUP_POWER[groupKey];
  const schools = [];
  for (let i = 0; i < 20; i++) {
    schools.push({
      name: `${groupKey}校${i + 1}`,
      athletes: createRivalAthletes15(min, max),
    });
  }
  return schools;
}

function createRivalAthletes15(min, max) {
  const athletes = [];
  for (let i = 0; i < 15; i++) {
    athletes.push({
      name: `相手選手${i + 1}`,
      abilities: {
        sprint: randInt(min, max),
        speed: randInt(min, max),
        stamina: randInt(min, max),
        toughness: randInt(min, max),
        technique: randInt(min, max),
      },
    });
  }
  return athletes;
}

// 出場：1種目最大3人、1人最大2種目（自動選出：種目総合値が高い順に埋める）
function selectEntriesAuto(teamName, athletes) {
  const maxPerEvent = 3;
  const maxEventsPerAthlete = 2;

  const eventCounts = Object.fromEntries(EVENTS_MEET.map(e => [e, 0]));
  const athleteCounts = new Map();

  // 候補（全選手×全種目をパワー順に並べる）
  const candidates = [];
  for (const a of athletes) {
    for (const ev of EVENTS_MEET) {
      candidates.push({
        school: teamName,
        isPlayer: true,
        athlete: a,
        event: ev,
        power: calcEventPower(a, ev),
      });
    }
  }
  candidates.sort((x, y) => y.power - x.power);

  const entries = [];
  for (const c of candidates) {
    if (eventCounts[c.event] >= maxPerEvent) continue;

    const used = athleteCounts.get(c.athlete) ?? 0;
    if (used >= maxEventsPerAthlete) continue;

    // 同一種目に同じ選手を二重登録しない
    if (entries.some(e => e.athlete === c.athlete && e.event === c.event)) continue;

    entries.push({ school: c.school, isPlayer: c.isPlayer, athlete: c.athlete, event: c.event });
    eventCounts[c.event] += 1;
    athleteCounts.set(c.athlete, used + 1);

    // 全種目が埋まったら終了
    if (EVENTS_MEET.every(ev => eventCounts[ev] >= maxPerEvent)) break;
  }

  return entries;
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

  // 総合順
  const sorted = school.athletes.slice().sort((a, b) => overall(b) - overall(a));

  const entries = [];
  for (const a of sorted) {
    // 各選手について種目パワーを高い順に試す（最大2種目まで）
    const powers = EVENTS_MEET.map(ev => ({ ev, p: calcEventPower(a, ev) }))
      .sort((x, y) => y.p - x.p);

    for (const { ev } of powers) {
      if (eventCounts[ev] >= maxPerEvent) continue;
      const used = athleteCounts.get(a) ?? 0;
      if (used >= maxEventsPerAthlete) break;

      entries.push({ school: school.name, isPlayer: false, athlete: a, event: ev });
      eventCounts[ev] += 1;
      athleteCounts.set(a, used + 1);

      // 2種目までなので、次の候補へ
    }

    if (EVENTS_MEET.every(ev => eventCounts[ev] >= maxPerEvent)) break;
  }

  return entries;
}

// --- 競技の進行（予選/決勝） ---

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
  // 8人ずつ予選 → 各組1位で決勝（想定8組くらい）
  const groups = groupBySize(allEntries, 8);
  const qualifiers = [];
  const heats = [];

  for (let i = 0; i < groups.length; i++) {
    const r = race(groups[i], "800");
    heats.push({ heat: i + 1, results: r });
    qualifiers.push(r[0]); // 1位
  }

  const final = race(qualifiers, "800");
  return { type: "withFinal", heats, final };
}

function run1500or3000sc(allEntries, event) {
  // 16人ずつ予選→全体上位15で決勝
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
  // 30人ずつ → 全体順位（＝全組まとめてタイム順）
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

export function runSoutai(state, stageKey) {
  // stageKey: district/prefecture/region/national
  const rivals = createRivalSchools(stageKey);

  // 自校出場（自動）
  const playerEntries = selectEntriesAuto(state.teamName, state.athletes);

  // 相手校出場
  const rivalEntries = [];
  for (const s of rivals) rivalEntries.push(...selectEntriesAI(s));

  const all = playerEntries.concat(rivalEntries);

  const byEvent = Object.fromEntries(EVENTS_MEET.map(e => [e, []]));
  for (const e of all) byEvent[e.event].push(e);

  const result = {
    type: "soutai",
    stage: stageKey,
    title: stageTitle(stageKey),
    when: `${state.month}月${state.week}週`,
    events: {},
  };

  // 種目ごとに実行
  result.events["800"] = run800(byEvent["800"]);
  result.events["1500"] = run1500or3000sc(byEvent["1500"], "1500");
  result.events["3000sc"] = run1500or3000sc(byEvent["3000sc"], "3000sc");
  result.events["5000"] = run5000like(byEvent["5000"], "5000");
  result.events["5000w"] = run5000like(byEvent["5000w"], "5000w");

  // 勝ち上がり判定（自校が条件を満たした種目が1つでもあればOKにする）
  // ※仕様が「各種目」勝ち上がりなので、本来は種目ごとの通過管理が必要。
  // 初期実装では「通過種目が1つ以上あれば次へ進める」→次ステップで厳密化します。
  const th = stageKey === "region" ? 5 : 7;
  const passedEvents = [];

  for (const ev of EVENTS_MEET) {
    const bestRank = getBestPlayerRank(result.events[ev], ev);
    if (bestRank !== null && bestRank <= th) passedEvents.push(ev);
  }

  result.passedEvents = passedEvents;
  result.cleared = passedEvents.length > 0;

  state.lastMeetResult = result;
  return result;
}

function getBestPlayerRank(eventResult, ev) {
  // 決勝がある種目：finalの順位
  if (eventResult.type === "withFinal") {
    const final = eventResult.final;
    const ranks = final
      .map((x, i) => ({ x, rank: i + 1 }))
      .filter(r => r.x.isPlayer)
      .map(r => r.rank);
    if (ranks.length === 0) return null;
    return Math.min(...ranks);
  }

  // 決勝なし：overall順位
  const overall = eventResult.overall;
  const ranks = overall
    .map((x, i) => ({ x, rank: i + 1 }))
    .filter(r => r.x.isPlayer)
    .map(r => r.rank);
  if (ranks.length === 0) return null;
  return Math.min(...ranks);
}

function stageTitle(key) {
  if (key === "district") return "地区総体";
  if (key === "prefecture") return "県総体";
  if (key === "region") return "地域総体";
  if (key === "national") return "全国総体";
  return "総体";
}
