import {
  EVENTS_RECORD,
  calcEventPower,
  calcTimeSecondsFromPower,
  groupBySize,
  formatTime,
  randInt,
  shuffle,
} from "./rules.js";

// 相手校（同地区群）を簡略生成：20校、各15人
function createRivalSchoolsForRecord() {
  const schools = [];
  for (let i = 0; i < 20; i++) {
    schools.push({
      name: `地区高校${i + 1}`,
      athletes: createRivalAthletes15(),
    });
  }
  return schools;
}

function createRivalAthletes15() {
  // 自校に近い強さにしたいので、全員 30〜70 の間でランダム（簡略）
  const athletes = [];
  for (let i = 0; i < 15; i++) {
    athletes.push({
      name: `相手選手${i + 1}`,
      abilities: {
        sprint: randInt(30, 70),
        speed: randInt(30, 70),
        stamina: randInt(30, 70),
        toughness: randInt(30, 70),
        technique: randInt(30, 70),
      },
    });
  }
  return athletes;
}

function autoAssignPlayerEntries(state) {
  // 自校の全選手が「1人1種目」：15人を 1500/3000/5000 に均等割り
  const events = ["1500", "3000", "5000"];
  const shuffled = shuffle(state.athletes);

  const entries = [];
  for (let i = 0; i < shuffled.length; i++) {
    const event = events[i % events.length];
    entries.push({
      school: state.teamName,
      isPlayer: true,
      athlete: shuffled[i],
      event,
    });
  }
  return entries;
}

function pickRivalEntries(schools) {
  // 各校の選手：1人1種目（同じく均等割りで簡略）
  const entries = [];
  const events = ["1500", "3000", "5000"];

  for (const s of schools) {
    const shuffled = shuffle(s.athletes);
    for (let i = 0; i < shuffled.length; i++) {
      const event = events[i % events.length];
      entries.push({
        school: s.name,
        isPlayer: false,
        athlete: shuffled[i],
        event,
      });
    }
  }
  return entries;
}

function runEvent(entriesOfEvent) {
  // 30人グループに分けて、それぞれタイム計算して順位
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
        timeText: formatTime(raced[i].timeSec),
      });
    }
  }

  return results;
}

export function runRecordMeet(state) {
  const rivals = createRivalSchoolsForRecord();

  const playerEntries = autoAssignPlayerEntries(state);
  const rivalEntries = pickRivalEntries(rivals);
  const all = playerEntries.concat(rivalEntries);

  const byEvent = {};
  for (const ev of EVENTS_RECORD) byEvent[ev] = [];

  for (const e of all) byEvent[e.event].push(e);

  const results = {
    type: "record",
    title: "記録会",
    when: `${state.month}月${state.week}週`,
    events: {},
  };

  for (const ev of EVENTS_RECORD) {
    results.events[ev] = runEvent(byEvent[ev]);
  }

  // 自校の結果だけ抜き出し（表示用）
  results.playerOnly = {};
  for (const ev of EVENTS_RECORD) {
    const arr = results.events[ev].filter(x => x.isPlayer);
    // グループ順位だけだと比較しにくいので、種目内での全体順位も付ける（簡略：全体で並べた順位）
    const allSorted = results.events[ev].slice().sort((a, b) => a.timeSec - b.timeSec);
    const indexMap = new Map(allSorted.map((x, i) => [x, i + 1]));
    results.playerOnly[ev] = arr
      .map(x => ({ ...x, overallRank: indexMap.get(x) }))
      .sort((a, b) => a.overallRank - b.overallRank);
  }

  state.lastMeetResult = results;
  return results;
}
