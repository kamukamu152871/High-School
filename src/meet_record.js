import {
  calcEventPower,
  calcTimeSecondsFromPower,
  groupBySize,
  formatTime,
  randInt,
  shuffle,
} from "./rules.js";

// 相手校（同地区群）を state.rivals.district    使う（能力補正なし方針）
// ただし record は「同地区群」と仕様にあるため district を利用

function runEvent(entriesOfEvent, eventName) {
  const groups = groupBySize(entriesOfEvent, 30);
  const results = [];

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    const raced = group.map(e => {
      const power = calcEventPower(e.athlete, e.event);
      const timeSec = calcTimeSecondsFromPower(e.event, power);
      return { ...e, power, timeSec, groupIndex: g + 1 };
    });

    raced.sort((a, b) => a.timeSec - b.timeSec);

    for (let i = 0; i < raced.length; i++) {
      results.push({
        ...raced[i],
        rankInGroup: i + 1,
        timeText: formatTime(raced[i].timeSec, 1),
      });
    }
  }

  return results;
}

function pickRivalEntriesFromState(state) {
  const rivals = state.rivals?.district ?? [];
  const entries = [];
  const events = ["1500", "3000", "5000"];

  for (const s of rivals) {
    const shuffled = shuffle(s.athletes);
    for (let i = 0; i < shuffled.length; i++) {
      const event = events[i % events.length];
      entries.push({ school: s.name, isPlayer: false, athlete: shuffled[i], event });
    }
  }
  return entries;
}

// playerPicks: [{athlete, event}]（15人全員、1人1種目）
export function runRecordMeet(state, playerPicks) {
  const playerEntries = playerPicks.map(p => ({
    school: state.teamName,
    isPlayer: true,
    athlete: p.athlete,
    event: p.event,
  }));

  const rivalEntries = pickRivalEntriesFromState(state);
  const all = playerEntries.concat(rivalEntries);

  const byEvent = { "1500": [], "3000": [], "5000": [] };
  for (const e of all) byEvent[e.event].push(e);

  const results = {
    type: "record",
    title: "記録会",
    when: `${state.month}月${state.week}週`,
    events: {},
    playerOnly: {},
  };

  for (const ev of Object.keys(byEvent)) {
    results.events[ev] = runEvent(byEvent[ev], ev);
  }

  // 自校表示用（種目内の全体順位も付ける）
  for (const ev of Object.keys(byEvent)) {
    const allSorted = results.events[ev].slice().sort((a, b) => a.timeSec - b.timeSec);
    const indexMap = new Map(allSorted.map((x, i) => [x, i + 1]));
    const arr = results.events[ev]
      .filter(x => x.isPlayer)
      .map(x => ({ ...x, overallRank: indexMap.get(x) }))
      .sort((a, b) => a.overallRank - b.overallRank);

    results.playerOnly[ev] = arr;
  }

  state.lastMeetResult = results;
  return results;
}
