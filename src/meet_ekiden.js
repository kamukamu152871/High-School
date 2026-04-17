import { calcEventPower, calcTimeSecondsFromPower, formatTime } from "./rules.js";
import { recommendEkidenPicks } from "./recommend.js";

function formatHMS(totalSec) {
  const s = Math.floor(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}時間${m}分${sec}秒`;
}

// teamPicks: [{leg,event,athlete}] 7つ
function runTeamTime(teamPicks) {
  const legs = teamPicks.map(x => {
    const power = calcEventPower(x.athlete, x.event);
    const t = calcTimeSecondsFromPower(x.event, power);
    return {
      leg: x.leg,
      event: x.event,

      // ★追加：区間記録の重複排除に使う
      athleteId: x.athlete?.id ?? null,
      grade: x.athlete?.grade ?? null,

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

// legごとに「区間順位」「累積順位」を計算して返す
function buildSplits(rankedTeams) {
  // rankedTeams: [{school,isPlayer,legs:[{leg,timeSec...}], ...}]
  const splits = [];

  for (let leg = 1; leg <= 7; leg++) {
    const withCum = rankedTeams.map(team => {
      const cum = team.legs
        .filter(x => x.leg <= leg)
        .reduce((sum, x) => sum + x.timeSec, 0);

      const legObj = team.legs.find(x => x.leg === leg);
      return {
        school: team.school,
        isPlayer: team.isPlayer,
        leg,
        event: legObj?.event ?? "",
        legTimeSec: legObj?.timeSec ?? 99999,
        legTimeText: legObj?.timeText ?? "",
        cumSec: cum,
      };
    });

    // 区間順位（その区間タイム順）
    const legRanked = withCum
      .slice()
      .sort((a, b) => a.legTimeSec - b.legTimeSec)
      .map((x, i) => ({ ...x, legRank: i + 1 }));

    // 累積順位（その時点の合計順）
    const cumRanked = withCum
      .slice()
      .sort((a, b) => a.cumSec - b.cumSec)
      .map((x, i) => ({ ...x, cumRank: i + 1 }));

    // 同じ学校で合流
    const map = new Map();
    for (const x of legRanked) map.set(x.school, { ...x });
    for (const x of cumRanked) {
      const cur = map.get(x.school);
      map.set(x.school, { ...cur, cumRank: x.cumRank, cumSec: x.cumSec });
    }

    const rows = Array.from(map.values())
      .sort((a, b) => a.cumRank - b.cumRank)
      .map(x => ({
        school: x.school,
        isPlayer: x.isPlayer,
        leg: x.leg,
        event: x.event,
        legRank: x.legRank,
        cumRank: x.cumRank,
        legTimeText: x.legTimeText,
        cumText: formatHMS(x.cumSec),
      }));

    splits.push({
      leg,
      event: rows[0]?.event ?? "",
      rows,
    });
  }

  return splits;
}

// playerPicks: [{leg,event,athlete}] 7つ
export function runEkiden(state, stageKey, playerPicks) {
  const rivals = state.rivals?.[stageKey] ?? [];

  const player = runTeamTime(playerPicks);

  const others = rivals.map(s => {
    const picks = recommendEkidenPicks(s.athletes);
    const res = runTeamTime(picks);
    return { school: s.name, isPlayer: false, schoolObj: s, ...res };
  });

  const all = [{ school: state.teamName, isPlayer: true, schoolObj: null, ...player }]
    .concat(others);

  all.sort((a, b) => a.totalSec - b.totalSec);

  const ranked = all.map((x, i) => ({ ...x, rank: i + 1 }));

  const result = {
    type: "ekiden",
    stage: stageKey,
    title: stageTitle(stageKey),
    when: `${state.month}月${state.week}週`,
    ranking: ranked,

    // ��間ごとの順位（区間順位＆累積順位）
    splits: buildSplits(ranked),

    // 次大会へ持ち越す上位5チーム（学校オブジェクトを保持）
    top5Teams: [],
  };

  const my = ranked.find(x => x.isPlayer);
  result.myRank = my?.rank ?? 999;
  result.cleared = result.myRank <= 5;

  const toStage = nextStageKey(stageKey);
  if (toStage) {
    result.top5Teams = ranked.slice(0, 5).map(x => {
      if (x.isPlayer) {
        return {
          fromStage: stageKey,
          toStage,
          isPlayer: true,
          team: { name: state.teamName, athletes: state.athletes },
        };
      }
      return {
        fromStage: stageKey,
        toStage,
        isPlayer: false,
        team: x.schoolObj,
      };
    });
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
