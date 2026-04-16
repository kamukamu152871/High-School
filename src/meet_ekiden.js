import { calcEventPower, calcTimeSecondsFromPower, formatTime } from "./rules.js";
import { recommendEkidenPicks } from "./recommend.js";

function runTeamTime(teamPicks) {
  const legs = teamPicks.map(x => {
    const power = calcEventPower(x.athlete, x.event);
    const t = calcTimeSecondsFromPower(x.event, power);
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

// playerPicks: [{leg,event,athlete}] 7つ
export function runEkiden(state, stageKey, playerPicks) {
  const rivals = state.rivals?.[stageKey] ?? [];

  const player = runTeamTime(playerPicks);

  const others = rivals.map(s => {
    // ★他校も自校おすすめと同じ：区間最適＋重複なし
    const picks = recommendEkidenPicks(s.athletes);
    const res = runTeamTime(picks);
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
