import { calcEventPower, calcTimeSecondsFromPower, formatTime } from "./rules.js";
import { recommendEkidenPicks } from "./recommend.js";

function formatHMS(totalSec) {
  const s = Math.floor(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}時間${m}分${sec}秒`;
}

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

  const total = legs.reduce((sum, x) => sum + x.timeSec, 0);
  return {
    legs,
    totalSec: total,
    totalText: formatHMS(total),
  };
}

function nextStageKey(stageKey) {
  if (stageKey === "district") return "prefecture";
  if (stageKey === "prefecture") return "region";
  if (stageKey === "region") return "national";
  return null;
}

// playerPicks: [{leg,event,athlete}] 7つ
export function runEkiden(state, stageKey, playerPicks) {
  const rivals = state.rivals?.[stageKey] ?? [];

  const player = runTeamTime(playerPicks);

  const others = rivals.map(s => {
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

    // ★新仕様：次大会へ混ぜる「上位5校」
    top5Schools: [],
  };

  const my = ranked.find(x => x.isPlayer);
  result.myRank = my?.rank ?? 999;
  result.cleared = result.myRank <= 5;

  const toStage = nextStageKey(stageKey);
  if (toStage) {
    result.top5Schools = ranked
      .slice(0, 5)
      .map(x => ({
        fromStage: stageKey,
        toStage,
        schoolName: x.school,
        // 将来「学校の中身を持ち越す」拡張用（今は名前で十分）
      }));
  }

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
