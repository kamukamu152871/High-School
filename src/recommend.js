import { EVENTS_MEET, calcEventPower } from "./rules.js";

// 総合値（あなたの定義）
function overall(a) {
  const ab = a.abilities;
  return Math.round((ab.sprint + ab.speed + ab.stamina + ab.toughness + ab.technique) / 5);
}

// ==============================
// 記録会おすすめ：全選手が一人一種目（1500/3000/5000）
// 仕様：相手校は「種目総合値が一番高い種目」を選ぶ（同値は先勝ち）
// ただし各選手は1種目だけ。全員出す。
// ==============================
export function recommendRecordPicks(athletes) {
  const events = ["1500", "3000", "5000"];
  return athletes.map(a => {
    let bestEv = events[0];
    let bestP = -Infinity;
    for (const ev of events) {
      const p = calcEventPower(a, ev);
      if (p > bestP) { bestP = p; bestEv = ev; }
    }
    return { athlete: a, event: bestEv };
  });
}

// ==============================
// 総体おすすめ：総合値が高い順→得意種目→埋まってたら次の得意種目
// 条件：各種目3人まで / 1人2種目まで
// allowedEvents がある場合はその種目だけ対象
// ==============================
export function recommendSoutaiPicks(athletes, allowedEvents = null) {
  const events = allowedEvents ?? EVENTS_MEET;

  const maxPerEvent = 3;
  const maxPerAthlete = 2;

  const eventCounts = Object.fromEntries(events.map(e => [e, 0]));
  const athleteCounts = new Map();

  const sorted = athletes.slice().sort((a, b) => overall(b) - overall(a));
  const picks = [];

  for (const a of sorted) {
    const prefs = events
      .map(ev => ({ ev, p: calcEventPower(a, ev) }))
      .sort((x, y) => y.p - x.p);

    for (const { ev } of prefs) {
      if (eventCounts[ev] >= maxPerEvent) continue;

      const used = athleteCounts.get(a) ?? 0;
      if (used >= maxPerAthlete) break;

      // 二重登録防止
      if (picks.some(x => x.athlete === a && x.event === ev)) continue;

      picks.push({ athlete: a, event: ev });
      eventCounts[ev] += 1;
      athleteCounts.set(a, used + 1);
    }

    // 全種目埋まったら終わり
    if (events.every(ev => eventCounts[ev] >= maxPerEvent)) break;
  }

  return picks;
}

// ==============================
// 駅伝おすすめ：各区間に最適な選手を重複なしで選ぶ（貪欲）
// ==============================
export function recommendEkidenPicks(athletes) {
  const sections = [
    { leg: 1, event: "10000" },
    { leg: 2, event: "3000" },
    { leg: 3, event: "8000" },
    { leg: 4, event: "8000" },
    { leg: 5, event: "3000" },
    { leg: 6, event: "5000" },
    { leg: 7, event: "5000" },
  ];

  const unused = new Set(athletes);
  const picks = [];

  for (const s of sections) {
    if (unused.size === 0) break;
    let best = null;
    let bestP = -Infinity;
    for (const a of unused) {
      const p = calcEventPower(a, s.event);
      if (p > bestP) { bestP = p; best = a; }
    }
    if (!best) break;
    picks.push({ leg: s.leg, event: s.event, athlete: best });
    unused.delete(best);
  }

  return picks;
}
