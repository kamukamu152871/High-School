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
function runTeamTime(state, teamPicks, isPlayerTeam) {
  const legs = teamPicks.map(x => {
    const power = calcEventPower(x.athlete, x.event);

    // ★重要：自校だけ state を渡して乱数レンジ（キャプテン）を反映
    const t = isPlayerTeam
      ? calcTimeSecondsFromPower(x.event, power, state)
      : calcTimeSecondsFromPower(x.event, power, null);

    return {
      leg: x.leg,
      event: x.event,

      // 区間記録の重複排除に使う
      athleteId: x.athlete?.id ?? null,
      grade: x.athlete?.grade ?? null,

      athleteName: x.athlete?.name ?? "",
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

    const legRanked = withCum
      .slice()
      .sort((a, b) => a.legTimeSec - b.legTimeSec)
      .map((x, i) => ({ ...x, legRank: i + 1 }));

    const cumRanked = withCum
      .slice()
      .sort((a, b) => a.cumSec - b.cumSec)
      .map((x, i) => ({ ...x, cumRank: i + 1 }));

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
export function runEkiden(state, stageKey, playerPicks, options = {}) {
  const type = options.type ?? "ekiden";
  const title = options.title ?? stageTitle(stageKey);
  const eligibleSchools = options.eligibleSchools ?? null;
  const excludeGrade3 = !!options.excludeGrade3;

  const eligibleSet = eligibleSchools ? new Set(eligibleSchools) : null;
  const rivals = (state.rivals?.[stageKey] ?? []).filter(s => {
    if (!eligibleSet) return true;
    return eligibleSet.has(s.name);
  });

  const player = runTeamTime(state, playerPicks, true);

  const others = rivals.map(s => {
    const athletes = excludeGrade3
      ? (s.athletes ?? []).filter(a => a.grade !== 3)
      : (s.athletes ?? []);
    const picks = recommendEkidenPicks(athletes);
    const res = runTeamTime(state, picks, false);
    return { school: s.name, isPlayer: false, schoolObj: s, ...res };
  });

  const all = [{ school: state.teamName, isPlayer: true, schoolObj: null, ...player }]
    .concat(others);

  all.sort((a, b) => a.totalSec - b.totalSec);

  const ranked = all.map((x, i) => ({ ...x, rank: i + 1 }));

  const result = {
    type,
    stage: stageKey,
    title,
    when: `${state.month}月${state.week}週`,
    ranking: ranked,

    // 区間ごとの順位（区間順位＆累積順位）
    splits: buildSplits(ranked),

    // 次大会へ持ち越す上位5チーム（学校オブジェクトを保持）
    top5Teams: [],
  };

  const my = ranked.find(x => x.isPlayer);
  result.myRank = my?.rank ?? 999;
  result.cleared = type === "ekiden" ? (result.myRank <= 5) : null;

  const toStage = nextStageKey(stageKey);
  if (type === "ekiden" && toStage) {
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
  if (key === "newcomer") return "新人駅伝";
  return "駅伝";
}
