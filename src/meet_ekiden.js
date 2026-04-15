import { calcEventPower, calcTimeSecondsFromPower, formatTime } from "./rules.js";

// 駅伝区間定義
const SECTIONS = [
  { leg: 1, event: "10000" },
  { leg: 2, event: "3000" },
  { leg: 3, event: "8000" },
  { leg: 4, event: "8000" },
  { leg: 5, event: "3000" },
  { leg: 6, event: "5000" },
  { leg: 7, event: "5000" },
];

// チーム編成（重複なし）：各区間の種目総合値が高い選手を順に選ぶ（簡略）
function selectTeamAuto(athletes) {
  const unused = new Set(athletes);
  const team = [];

  for (const sec of SECTIONS) {
    let best = null;
    let bestPower = -1;

    for (const a of unused) {
      const p = calcEventPower(a, sec.event);
      if (p > bestPower) {
        bestPower = p;
        best = a;
      }
    }

    team.push({ ...sec, athlete: best, power: bestPower });
    unused.delete(best);
  }

  return team;
}

function runTeamTime(team) {
  const legs = team.map(x => {
    const t = calcTimeSecondsFromPower(x.event, x.power);
    return {
      leg: x.leg,
      event: x.event,
      athleteName: x.athlete.name,
      timeSec: t,
      timeText: formatTime(t, 1),
    };
  });

  const total = legs.reduce((s, x) => s + x.timeSec, 0);
  return { legs, totalSec: total, totalText: formatTime(total, 1) };
}

export function runEkiden(state, stageKey) {
  // stageKey: district/prefecture/region/national
  const rivals = state.rivals?.[stageKey] ?? [];

  const playerTeam = selectTeamAuto(state.athletes);
  const player = runTeamTime(playerTeam);

  const others = rivals.map(s => {
    const team = selectTeamAuto(s.athletes);
    const res = runTeamTime(team);
    return { school: s.name, ...res };
  });

  const all = [{ school: state.teamName, isPlayer: true, ...player }]
    .concat(others.map(x => ({ ...x, isPlayer: false })));

  all.sort((a, b) => a.totalSec - b.totalSec);

  const ranked = all.map((x, i) => ({ ...x, rank: i + 1 }));

  const result = {
    type: "ekiden",
    stage: stageKey,
    title: stageTitle(stageKey),
    when: `${state.month}月${state.week}週`,
    ranking: ranked,
  };

  // 5位以内で勝ち上がり
  const my = ranked.find(x => x.isPlayer);
  result.myRank = my?.rank ?? 999;
  result.cleared = result.myRank <= 5;

  state.lastMeetResult = result;
  return result;
}

function stageTitle(key) {
  if (key === "district") return "地区駅伝";
  if (key === "prefecture") return "県駅伝";
  if (key === "region") return "地域駅伝";
  if (key === "national") return "全国駅伝";
  return "駅伝";
}
