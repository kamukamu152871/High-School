import {
  createNewGameState,
  saveGame,
  loadGame,
  clearSave,
  applyYearUpdateToState,
  createScoutFreshman,
  ensureAchievements as ensureAchievementsState,
} from "./state.js";

import { TRAININGS, applyTraining, getCaptain, recalcOverall, withRaceRandomMode } from "./rules.js";
import { ensureRivals, rivalsWeeklyTraining, rivalsYearUpdate } from "./rivals.js";
import { renderPicker } from "./ui_pick.js";

import { runRecordMeet } from "./meet_record.js";
import { runSoutai } from "./meet_soutai.js";
import { runEkiden } from "./meet_ekiden.js";
import { BLOCKS, blockName } from "./data/regions.js";

const app = document.querySelector("#app");

// --- スケジュール（練習後に大会） ---
function getMeetOfWeek(state) {
  if (state.month === 4 && state.week === 4) return { type: "record" };
  if (state.month === 9 && state.week === 3) return { type: "record" };
  if (state.month === 3 && state.week === 3) return { type: "record" };

  if (state.month === 5 && state.week === 1) return { type: "soutai", stage: "district" };
  if (state.month === 5 && state.week === 4) return { type: "soutai", stage: "prefecture" };
  if (state.month === 6 && state.week === 3) return { type: "soutai", stage: "region" };
  if (state.month === 7 && state.week === 4) return { type: "soutai", stage: "national" };

  if (state.month === 10 && state.week === 2) return { type: "ekiden", stage: "district" };
  if (state.month === 10 && state.week === 4) return { type: "ekiden", stage: "prefecture" };
  if (state.month === 11 && state.week === 2) return { type: "ekiden", stage: "region" };
  if (state.month === 12 && state.week === 3) return { type: "ekiden", stage: "national" };
  if (state.month === 2 && state.week === 4) return { type: "newcomer_ekiden" };

  return null;
}

function isYearUpdateWeek(state) {
  return state.month === 3 && state.week === 4;
}

function advanceWeek(state) {
  state.week += 1;
  if (state.week > 4) {
    state.week = 1;
    state.month += 1;
    if (state.month > 12) state.month = 1;
  }
}

// --- 旧：通過管理（駅伝条件チェックに使う） ---
function ensureQualify(state) {
  state.qualify ??= {
    soutai: { prefecturePairs: [], regionPairs: [], nationalPairs: [] },
    ekiden: { prefecture: false, region: false, national: false },
  };

  if (state.qualify.soutai && ("prefecture" in state.qualify.soutai)) {
    state.qualify = {
      soutai: { prefecturePairs: [], regionPairs: [], nationalPairs: [] },
      ekiden: state.qualify.ekiden ?? { prefecture: false, region: false, national: false },
    };
  }
}

function ensureFacilities(state) {
  state.facilities ??= { nagashi: 1, tt: 1, jog: 1, interval: 1, circuit: 1 };
}

function ensureCarry(state) {
  state.carry ??= { soutai: { next: [] }, ekiden: { next: [] } };
  state.carry.soutai ??= { next: [] };
  state.carry.ekiden ??= { next: [] };
  state.carry.soutai.next ??= [];
  state.carry.ekiden.next ??= [];
}

function ensureScout(state) {
  state.scout ??= { pool: [], selected: [], max: 1, lastEkidenTier: "none" };
  state.scout.pool ??= [];
  state.scout.selected ??= [];
  state.scout.max ??= 1;
  state.scout.lastEkidenTier ??= "none";
}

function ensureRecords(state) {
  state.records ??= {
    events: { "800": [], "1500": [], "3000": [], "3000sc": [], "5000": [], "5000w": [] },
    ekidenLegs: { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [], "7": [] },
    ekidenTotal: [],
  };
  state.records.events ??= {};
  for (const ev of ["800", "1500", "3000", "3000sc", "5000", "5000w"]) state.records.events[ev] ??= [];
  state.records.ekidenLegs ??= {};
  for (const leg of ["1", "2", "3", "4", "5", "6", "7"]) state.records.ekidenLegs[leg] ??= [];
  state.records.ekidenTotal ??= [];
}

function ensureAchievements(state) {
  ensureAchievementsState(state);
  state.newcomerEkiden ??= { eligibleSchools: [], top10: [], sourceWhen: null };
  state.newcomerEkiden.eligibleSchools ??= [];
  state.newcomerEkiden.top10 ??= [];
  state.newcomerEkiden.sourceWhen ??= null;
}

function ensureWorldSeasonResults(state) {
  state.world ??= { schools: null, season: {}, history: [] };
  state.world.season ??= {};
  state.world.season.otherResults ??= {
    soutai: { hyogoDistrict: {}, kinkiPrefecture: {}, regionBlocks: {} },
    ekiden: {
      hyogoDistrict: {},
      kinkiPrefecture: {},
      regionBlocks: {},
      nationalSourceBySchool: {},
      nationalWinnerBySchool: {},
      nationalQualifiedBySchool: {},
    },
  };
  state.world.season.otherResults.soutai ??= { hyogoDistrict: {}, kinkiPrefecture: {}, regionBlocks: {} };
  state.world.season.otherResults.ekiden ??= {
    hyogoDistrict: {},
    kinkiPrefecture: {},
    regionBlocks: {},
    nationalSourceBySchool: {},
    nationalWinnerBySchool: {},
    nationalQualifiedBySchool: {},
  };
  state.world.season.otherResults.soutai.hyogoDistrict ??= {};
  state.world.season.otherResults.soutai.kinkiPrefecture ??= {};
  state.world.season.otherResults.soutai.regionBlocks ??= {};
  state.world.season.otherResults.ekiden.hyogoDistrict ??= {};
  state.world.season.otherResults.ekiden.kinkiPrefecture ??= {};
  state.world.season.otherResults.ekiden.regionBlocks ??= {};
  state.world.season.otherResults.ekiden.nationalSourceBySchool ??= {};
  state.world.season.otherResults.ekiden.nationalWinnerBySchool ??= {};
  state.world.season.otherResults.ekiden.nationalQualifiedBySchool ??= {};
}

function clearOtherResultsCache(state) {
  ensureWorldSeasonResults(state);
  const sourceKeep = { ...(state.world.season.otherResults?.ekiden?.nationalSourceBySchool ?? {}) };
  const winnerKeep = { ...(state.world.season.otherResults?.ekiden?.nationalWinnerBySchool ?? {}) };
  const qualifiedKeep = { ...(state.world.season.otherResults?.ekiden?.nationalQualifiedBySchool ?? {}) };
  state.world.season.otherResults = {
    soutai: { hyogoDistrict: {}, kinkiPrefecture: {}, regionBlocks: {} },
    ekiden: {
      hyogoDistrict: {},
      kinkiPrefecture: {},
      regionBlocks: {},
      nationalSourceBySchool: sourceKeep,
      nationalWinnerBySchool: winnerKeep,
      nationalQualifiedBySchool: qualifiedKeep,
    },
  };
}

function safeSaveGame(state) {
  try {
    saveGame(state);
    return true;
  } catch (e) {
    // localStorage容量超過時は重い「他大会結果キャッシュ」を削って再保存
    clearOtherResultsCache(state);
    try {
      saveGame(state);
      return true;
    } catch {
      return false;
    }
  }
}

function districtName(key) {
  if (key === "kobe") return "神戸";
  if (key === "hanshin") return "阪神";
  if (key === "toban") return "東播";
  if (key === "seiban") return "西播";
  if (key === "tanyu") return "丹有";
  if (key === "tajima") return "但馬";
  if (key === "awaji") return "淡路";
  return key;
}

function worldSchoolToLegacyRival(s) {
  return {
    name: s.name,
    athletes: s.athletes,
    facilityLevel: 1,
    groupKey: s.prefecture ?? "other",
  };
}

function worldSchoolsByFilter(state, predicate) {
  return (state.world?.schools ?? []).filter(predicate);
}

function runSoutaiSimulation(state, stageKey, schools, title) {
  ensureRivals(state);
  const prevRivals = state.rivals?.[stageKey] ?? [];
  const prevLast = state.lastMeetResult;

  state.rivals[stageKey] = schools.map(worldSchoolToLegacyRival);
  const res = runSoutai(state, stageKey, [], null);
  res.title = title;

  state.rivals[stageKey] = prevRivals;
  state.lastMeetResult = prevLast;
  return res;
}

function runEkidenSimulation(state, stageKey, schools, title) {
  ensureRivals(state);
  const prevRivals = state.rivals?.[stageKey] ?? [];
  const prevLast = state.lastMeetResult;
  const prevTeamName = state.teamName;
  const simTeamName = "__other_result_sim__";

  state.teamName = simTeamName;
  state.rivals[stageKey] = schools.map(worldSchoolToLegacyRival);
  const raw = runEkiden(state, stageKey, [], { title });

  const ranking = (raw.ranking ?? [])
    .filter(x => x.school !== simTeamName)
    .map((x, i) => ({ ...x, rank: i + 1 }));

  const splits = (raw.splits ?? []).map(sp => {
    const rows = (sp.rows ?? [])
      .filter(r => r.school !== simTeamName)
      .map((r, i) => ({ ...r, cumRank: i + 1 }));
    return { ...sp, rows };
  });

  const res = {
    ...raw,
    ranking,
    splits,
    myRank: null,
    cleared: null,
  };

  state.teamName = prevTeamName;
  state.rivals[stageKey] = prevRivals;
  state.lastMeetResult = prevLast;
  return res;
}

function prefectureOfSchool(state, schoolName) {
  if (schoolName === state.teamName) return "兵庫";
  const found = (state.world?.schools ?? []).find(s => s.name === schoolName);
  return found?.prefecture ?? "";
}

function generateOtherSoutaiAfterDistrict(state) {
  ensureWorldSeasonResults(state);
  const out = {};
  for (const d of ["hanshin", "toban", "seiban", "tanyu", "tajima", "awaji"]) {
    const schools = worldSchoolsByFilter(state, s => s.prefecture === "兵庫" && s.districtKey === d);
    out[d] = {
      label: `${districtName(d)}地区`,
      result: runSoutaiSimulation(state, "district", schools, `${districtName(d)}地区総体`),
    };
  }
  state.world.season.otherResults.soutai.hyogoDistrict = out;
}

function generateKinkiPrefSoutaiAfterPrefecture(state, hyogoResult) {
  ensureWorldSeasonResults(state);
  const prefs = ["兵庫", "大阪", "京都", "和歌山", "滋賀", "奈良"];
  const out = {};
  for (const pref of prefs) {
    if (pref === "兵庫") {
      out[pref] = { label: pref, result: hyogoResult };
      continue;
    }
    const schools = worldSchoolsByFilter(state, s => s.prefecture === pref);
    out[pref] = {
      label: pref,
      result: runSoutaiSimulation(state, "prefecture", schools, `${pref}県総体`),
    };
  }
  state.world.season.otherResults.soutai.kinkiPrefecture = out;
}

function generateRegionSoutaiAfterRegion(state, kinkiResult) {
  ensureWorldSeasonResults(state);
  const out = {};
  for (const [key, block] of Object.entries(BLOCKS)) {
    if (key === "kinki") {
      out[key] = { label: block.name, result: kinkiResult };
      continue;
    }
    const schools = worldSchoolsByFilter(state, s => block.prefectures.includes(s.prefecture));
    out[key] = {
      label: block.name,
      result: runSoutaiSimulation(state, "region", schools, `${block.name}地域総体`),
    };
  }
  state.world.season.otherResults.soutai.regionBlocks = out;
}

function generateOtherEkidenAfterDistrict(state, kobeResult = null) {
  ensureWorldSeasonResults(state);
  const out = {};
  for (const d of ["hanshin", "toban", "seiban", "tanyu", "tajima", "awaji"]) {
    const schools = worldSchoolsByFilter(state, s => s.prefecture === "兵庫" && s.districtKey === d);
    out[d] = {
      label: `${districtName(d)}地区`,
      result: runEkidenSimulation(state, "district", schools, `${districtName(d)}地区駅伝`),
    };
  }
  if (kobeResult) {
    out.kobe = { label: "神戸地区", result: kobeResult };
  } else {
    const kobeSchools = worldSchoolsByFilter(state, s => s.prefecture === "兵庫" && s.districtKey === "kobe");
    out.kobe = {
      label: "神戸地区",
      result: runEkidenSimulation(state, "district", kobeSchools, "神戸地区駅伝"),
    };
  }
  state.world.season.otherResults.ekiden.hyogoDistrict = out;
}

// 兵庫県駅伝の出場条件：各地区で定められた順位以内の高校を選抜
function buildHyogoPrefEkidenTeams(state, options = {}) {
  const excludePlayer = options.excludePlayer ?? true;
  ensureWorldSeasonResults(state);
  const districtResults = state.world.season.otherResults?.ekiden?.hyogoDistrict ?? {};
  
  // 地区ごとのカットオフ：阪神8位、神戸9位、東播7位、西播6位、丹有3位、淡路2位、但馬2位
  const cutoffByDistrict = {
    hanshin: 8,
    kobe: 9,
    toban: 7,
    seiban: 6,
    tanyu: 3,
    awaji: 2,
    tajima: 2,
  };
  
  const qualifiedSchoolNames = new Set();
  for (const [districtKey, cutoff] of Object.entries(cutoffByDistrict)) {
    const districtResult = districtResults[districtKey];
    if (districtResult?.result?.ranking) {
      const ranked = districtResult.result.ranking.slice(0, cutoff);
      for (const r of ranked) {
        if (!r?.school) continue;
        if (excludePlayer && r.school === state.teamName) continue;
        qualifiedSchoolNames.add(r.school);
      }
    }
  }

  const worldByName = new Map((state.world?.schools ?? []).map(s => [s.name, s]));
  return Array.from(qualifiedSchoolNames.values())
    .map(name => worldByName.get(name))
    .filter(Boolean);
}

function buildNewcomerEligibleSchoolsFromNationalResult(state, nationalResult) {
  const ranking = nationalResult?.ranking ?? [];

  // 学校重複を除去した順位表を作る（同一校が二重にいるケースを防ぐ）
  const uniqRank = [];
  const seen = new Set();
  for (const x of ranking) {
    if (!x?.school || seen.has(x.school)) continue;
    seen.add(x.school);
    uniqRank.push(x);
  }

  // 全国枠: 上位10校
  const nationalTop10 = uniqRank.slice(0, 10);
  const nationalSchoolSet = new Set(nationalTop10.map(x => x.school));

  // 兵庫枠: 兵庫県駅伝上位10校（全国枠重複は除外し繰り上げ）
  ensureWorldSeasonResults(state);
  let hyogoPrefRanking = state.world.season.otherResults?.ekiden?.kinkiPrefecture?.["兵庫"]?.result?.ranking ?? [];
  if (hyogoPrefRanking.length === 0) {
    hyogoPrefRanking = (state.world.season.lastHyogoEkidenTop10 ?? []).map(x => ({
      school: x.school,
      rank: x.rank,
    }));
  }
  if (hyogoPrefRanking.length === 0) {
    generateKinkiPrefEkidenAfterPrefecture(state);
    hyogoPrefRanking = state.world.season.otherResults?.ekiden?.kinkiPrefecture?.["兵庫"]?.result?.ranking ?? [];
  }
  const hyogoRanked = [];
  const hyogoSeen = new Set();
  for (const x of hyogoPrefRanking) {
    if (!x?.school || hyogoSeen.has(x.school)) continue;
    hyogoSeen.add(x.school);
    hyogoRanked.push(x);
  }
  const hyogoQuota = [];
  for (const x of hyogoRanked) {
    if (hyogoQuota.length >= 10) break;
    if (nationalSchoolSet.has(x.school)) continue;
    hyogoQuota.push(x);
  }

  const eligibleSchools = nationalTop10
    .map(x => x.school)
    .concat(hyogoQuota.map(x => x.school));

  return {
    nationalTop10: nationalTop10.map(x => ({
      school: x.school,
      isPlayer: !!x.isPlayer,
      schoolObj: x.schoolObj ?? null,
    })),
    eligibleSchools,
  };
}

function generateKinkiPrefEkidenAfterPrefecture(state, hyogoResult = null) {
  ensureWorldSeasonResults(state);
  const prefs = ["兵庫", "大阪", "京都", "和歌山", "滋賀", "奈良"];
  const out = {};

  for (const pref of prefs) {
    if (pref === "兵庫") {
      // 実大会の兵庫県駅伝結果がある場合はそれを使う
      if (hyogoResult) {
        out[pref] = { label: pref, result: hyogoResult };
      } else {
        let hyogoTeams = buildHyogoPrefEkidenTeams(state, { excludePlayer: true });
        if (hyogoTeams.length === 0) {
          hyogoTeams = worldSchoolsByFilter(state, s => s.prefecture === "兵庫");
        }
        const hyogoPrefResult = runEkidenSimulation(state, "prefecture", hyogoTeams, "兵庫県駅伝");
        out[pref] = { label: pref, result: hyogoPrefResult };
      }
      continue;
    }
    const schools = worldSchoolsByFilter(state, s => s.prefecture === pref);
    out[pref] = {
      label: pref,
      result: runEkidenSimulation(state, "prefecture", schools, `${pref}県駅伝`),
    };
  }
  state.world.season.otherResults.ekiden.kinkiPrefecture = out;
}

function buildNationalEkidenSourceMaps(state, prefResults, regionResults) {
  const winnerBySchool = {};
  const selectedSchoolSet = new Set();

  // 県駅伝優先: 各都道府県1校、北海道のみ2校
  for (const [pref, res] of Object.entries(prefResults)) {
    const ranked = res?.ranking ?? [];
    const need = pref === "北海道" ? 2 : 1;

    let added = 0;
    for (const x of ranked) {
      if (!x?.school || selectedSchoolSet.has(x.school)) continue;
      winnerBySchool[x.school] = pref;
      selectedSchoolSet.add(x.school);
      added += 1;
      if (added >= need) break;
    }
  }

  // キャッシュ削除後でも、直近の兵庫県駅伝実結果があれば県代表を優先固定する
  const lastHyogoWinner = state.world?.season?.lastHyogoEkidenWinnerSchool
    ?? state.world?.season?.lastHyogoEkidenTop10?.[0]?.school
    ?? null;
  if (lastHyogoWinner) {
    for (const [school, pref] of Object.entries(winnerBySchool)) {
      if (pref === "兵庫") {
        delete winnerBySchool[school];
        selectedSchoolSet.delete(school);
      }
    }
    winnerBySchool[lastHyogoWinner] = "兵庫";
    selectedSchoolSet.add(lastHyogoWinner);
  }

  // 地域駅伝優先: 各地域で最上位（県駅伝枠と重複する学校は除外し繰り上げ）
  const qualifiedBySchool = {};
  for (const [key, info] of Object.entries(regionResults)) {
    const ranked = info?.result?.ranking ?? [];
    const q = ranked.find(x => x?.school && !selectedSchoolSet.has(x.school));
    if (!q?.school) continue;
    qualifiedBySchool[q.school] = blockName(key);
    selectedSchoolSet.add(q.school);
  }

  const sourceBySchool = { ...winnerBySchool, ...qualifiedBySchool };
  return { winnerBySchool, qualifiedBySchool, sourceBySchool };
}

function generateRegionEkidenAfterRegion(state, kinkiResult) {
  ensureWorldSeasonResults(state);

  const allPrefs = Array.from(new Set((state.world?.schools ?? []).map(s => s.prefecture))).sort((a, b) => a.localeCompare(b, "ja"));
  const prefResults = {};
  for (const pref of allPrefs) {
    if (pref === "兵庫") {
      prefResults[pref] = state.world.season.otherResults.ekiden.kinkiPrefecture?.["兵庫"]?.result ??
        runEkidenSimulation(state, "prefecture", worldSchoolsByFilter(state, s => s.prefecture === "兵庫"), "兵庫県駅伝");
      continue;
    }
    const schools = worldSchoolsByFilter(state, s => s.prefecture === pref);
    prefResults[pref] = runEkidenSimulation(state, "prefecture", schools, `${pref}県駅伝`);
  }

  const out = {};
  for (const [key, block] of Object.entries(BLOCKS)) {
    if (key === "kinki") {
      out[key] = { label: block.name, result: kinkiResult };
      continue;
    }

    const schoolSet = new Set();
    for (const pref of block.prefectures) {
      const ranked = prefResults[pref]?.ranking ?? [];
      for (const x of ranked.slice(0, 6)) schoolSet.add(x.school);
    }
    const schools = Array.from(schoolSet.values())
      .map(name => (state.world?.schools ?? []).find(s => s.name === name))
      .filter(Boolean);

    out[key] = {
      label: block.name,
      result: runEkidenSimulation(state, "region", schools, `${block.name}地域駅伝`),
    };
  }

  const maps = buildNationalEkidenSourceMaps(state, prefResults, out);

  state.world.season.otherResults.ekiden.regionBlocks = out;
  state.world.season.otherResults.ekiden.nationalSourceBySchool = maps.sourceBySchool;
  state.world.season.otherResults.ekiden.nationalWinnerBySchool = maps.winnerBySchool;
  state.world.season.otherResults.ekiden.nationalQualifiedBySchool = maps.qualifiedBySchool;
}

function getOtherResultsConfig(state) {
  const m = state.month;
  const w = state.week;

  if (m === 5 && (w === 2 || w === 3)) {
    return { kind: "soutai", bucket: "hyogoDistrict", title: "兵庫 各地区総体（神戸以外）" };
  }
  if (m === 6 && (w === 1 || w === 2)) {
    return { kind: "soutai", bucket: "kinkiPrefecture", title: "近畿 各県総体" };
  }
  if ((m === 6 && w === 4) || (m === 7 && (w === 1 || w === 2 || w === 3))) {
    return { kind: "soutai", bucket: "regionBlocks", title: "各地域総体" };
  }

  if (m === 10 && w === 3) {
    return { kind: "ekiden", bucket: "hyogoDistrict", title: "兵庫 各地区駅伝" };
  }
  if (m === 11 && w === 1) {
    return { kind: "ekiden", bucket: "kinkiPrefecture", title: "近畿 各県駅伝" };
  }
  if ((m === 11 && (w === 3 || w === 4)) || (m === 12 && (w === 1 || w === 2))) {
    return { kind: "ekiden", bucket: "regionBlocks", title: "各地域駅伝" };
  }

  return null;
}

function renderOtherResults(state, selectedKey = null) {
  ensureWorldSeasonResults(state);
  const cfg = getOtherResultsConfig(state);

  if (!cfg) {
    app.innerHTML = `
      <div class="card">
        <h2>他大会結果</h2>
        <p style="color:#555;">この期間に表示できる他大会結果はありません。</p>
        <div class="row" style="margin-top:12px;">
          <button class="secondary" id="back">戻る</button>
        </div>
      </div>
    `;
    document.querySelector("#back").onclick = () => renderHome(state);
    return;
  }

  if (cfg.kind === "ekiden" && cfg.bucket === "kinkiPrefecture") {
    const prefMap = state.world.season.otherResults?.ekiden?.kinkiPrefecture ?? {};
    if (Object.keys(prefMap).length === 0) {
      generateKinkiPrefEkidenAfterPrefecture(state);
    }
  }

  const map = state.world.season.otherResults?.[cfg.kind]?.[cfg.bucket] ?? {};
  const keys = Object.keys(map);

  if (keys.length === 0) {
    app.innerHTML = `
      <div class="card">
        <h2>${cfg.title}</h2>
        <p style="color:#555;">まだ結果データがありません。</p>
        <div class="row" style="margin-top:12px;">
          <button class="secondary" id="back">戻る</button>
        </div>
      </div>
    `;
    document.querySelector("#back").onclick = () => renderHome(state);
    return;
  }

  const key = (selectedKey && map[selectedKey]) ? selectedKey : keys[0];
  const active = map[key];
  const result = active.result;

  const table = cfg.kind === "soutai"
    ? (() => {
      const rows = (result.overallRanking ?? []).slice(0, 10).map(x => {
        const pref = prefectureOfSchool(state, x.school);
        return `
          <tr>
            <td>${x.rank}</td>
            <td>${x.school}</td>
            <td>${pref}</td>
            <td>${x.points}</td>
          </tr>
        `;
      }).join("") || `<tr><td colspan="4" style="color:#777;">結果なし</td></tr>`;

      return `
        <div style="overflow:auto;">
          <table style="width:100%; border-collapse:collapse; min-width:560px;">
            <thead><tr><th>順位</th><th>学校</th><th>都道府県</th><th>得点</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    })()
    : (() => {
      const rows = (result.ranking ?? []).slice(0, 10).map(x => {
        const pref = prefectureOfSchool(state, x.school);
        return `
          <tr>
            <td>${x.rank}</td>
            <td>${x.school}</td>
            <td>${pref}</td>
            <td>${x.totalText}</td>
          </tr>
        `;
      }).join("") || `<tr><td colspan="4" style="color:#777;">結果なし</td></tr>`;

      return `
        <div style="overflow:auto;">
          <table style="width:100%; border-collapse:collapse; min-width:560px;">
            <thead><tr><th>順位</th><th>学校</th><th>都道府県</th><th>総合タイム</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    })();

  const switchButtons = keys.map(k => {
    const label = map[k]?.label ?? k;
    const cls = k === key ? "" : "secondary";
    return `<button class="${cls}" data-sw="${k}">${label}</button>`;
  }).join("");

  app.innerHTML = `
    <div class="card">
      <h2>${cfg.title}</h2>
      <p style="color:#555;">表示中：${active.label}</p>
      ${table}
      <div class="row" style="margin-top:12px;">${switchButtons}</div>
      <div class="row" style="margin-top:12px;">
        <button id="detail">詳細リザルト</button>
        <button class="secondary" id="back">戻る</button>
      </div>
    </div>
  `;

  app.querySelectorAll("button[data-sw]").forEach(b => {
    b.onclick = () => renderOtherResults(state, b.getAttribute("data-sw"));
  });
  document.querySelector("#detail").onclick = () => {
    if (cfg.kind === "soutai") {
      renderSoutaiResult(state, result, {
        save: false,
        okLabel: "他大会結果へ戻る",
        onOk: () => renderOtherResults(state, key),
      });
      return;
    }

    renderEkidenResult(state, result, {
      okLabel: "他大会結果へ戻る",
      onOk: () => renderOtherResults(state, key),
    });
  };
  document.querySelector("#back").onclick = () => renderHome(state);
}

function ekidenSourceLabel(state, result, school) {
  if (result.stage === "region") {
    return prefectureOfSchool(state, school);
  }
  if (result.stage === "national") {
    ensureWorldSeasonResults(state);
    const winners = state.world.season.otherResults.ekiden.nationalWinnerBySchool ?? {};
    const qualified = state.world.season.otherResults.ekiden.nationalQualifiedBySchool ?? {};
    
    if (winners[school]) {
      return winners[school];
    } else if (qualified[school]) {
      return qualified[school];
    } else {
      return state.world.season.otherResults.ekiden.nationalSourceBySchool?.[school] ?? "-";
    }
  }
  return "";
}

function ensureCaptain(state) {
  // state.captainId: string | null
  state.captainId ??= null;

  // 既存セーブ救済：存在しないIDならnullに戻す
  if (state.captainId) {
    const found = (state.athletes ?? []).some(a => a.id === state.captainId);
    if (!found) state.captainId = null;
  }
}

function isDebugSchoolName(name) {
  return (name ?? "").trim() === "デバッグ";
}

function applyDebugCheatIfNeeded(state, schoolName) {
  if (!isDebugSchoolName(schoolName)) return;

  for (const a of (state.athletes ?? [])) {
    a.abilities.sprint = 110;
    a.abilities.speed = 110;
    a.abilities.stamina = 110;
    a.abilities.toughness = 110;
    a.abilities.technique = 110;
    recalcOverall(a);
  }
}

// 速いほど良い（timeSecが小さいほど上）
// 同一選手は1ランキング内で重複禁止：良い記録なら置換、悪いなら無視
function upsertTop10NoDupByAthlete(list, entry, keyTime = "timeSec") {
  const arr = (list ?? []).slice();

  const idx = arr.findIndex(x => x.athleteId === entry.athleteId);
  if (idx >= 0) {
    if (entry[keyTime] < arr[idx][keyTime]) arr[idx] = entry;
  } else {
    arr.push(entry);
  }

  arr.sort((a, b) => a[keyTime] - b[keyTime]);
  return arr.slice(0, 10);
}

function pushTop10(list, entry, keyTime) {
  const arr = (list ?? []).slice();
  arr.push(entry);
  arr.sort((a, b) => a[keyTime] - b[keyTime]);
  return arr.slice(0, 10);
}

function updateRecordsFromSoutai(state, result) {
  ensureRecords(state);

  for (const [ev, er] of Object.entries(result.events ?? {})) {
    if (!state.records.events[ev]) continue;

    const ranked = er.type === "withFinal" ? (er.final ?? []) : (er.overall ?? []);
    for (const x of ranked) {
      if (!x.isPlayer) continue;

      const entry = {
        athleteId: x.athlete?.id ?? `${x.athlete?.name ?? "unknown"}`,
        athleteName: x.athlete?.name ?? "",
        grade: x.athlete?.grade ?? null,        // ★当時学年
        schoolYear: state.year ?? null,         // ★何年目
        timeSec: x.timeSec,
        timeText: x.timeText,
        when: result.when,
      };

      state.records.events[ev] = upsertTop10NoDupByAthlete(state.records.events[ev], entry, "timeSec");
    }
  }
}

function updateRecordsFromRecordMeet(state, result) {
  ensureRecords(state);

  for (const ev of ["1500", "3000", "5000"]) {
    if (!state.records.events[ev]) continue;
    for (const x of (result.events?.[ev] ?? [])) {
      if (!x.isPlayer) continue;
      const entry = {
        athleteId: x.athlete?.id ?? `${x.athlete?.name ?? "unknown"}`,
        athleteName: x.athlete?.name ?? "",
        grade: x.athlete?.grade ?? null,        // ★当時学年
        schoolYear: state.year ?? null,         // ★何年目
        timeSec: x.timeSec,
        timeText: x.timeText,
        when: result.when,
      };
      state.records.events[ev] = upsertTop10NoDupByAthlete(state.records.events[ev], entry, "timeSec");
    }
  }
}

function updateRecordsFromEkiden(state, result) {
  ensureRecords(state);

  const my = (result.ranking ?? []).find(x => x.isPlayer);
  if (!my) return;

  state.records.ekidenTotal = pushTop10(
    state.records.ekidenTotal,
    {
      totalSec: my.totalSec,
      totalText: my.totalText,
      schoolYear: state.year ?? null,          // ★何年目
      when: result.when
    },
    "totalSec"
  );

  for (const leg of (my.legs ?? [])) {
    const key = String(leg.leg);
    const entry = {
      athleteId: leg.athleteId ?? leg.athleteName,
      athleteName: leg.athleteName,
      grade: leg.grade ?? null,                // ★当時学年（無い場合null）
      schoolYear: state.year ?? null,          // ★何年目
      timeSec: leg.timeSec,
      timeText: leg.timeText,
      when: result.when,
      event: leg.event,
    };
    state.records.ekidenLegs[key] = upsertTop10NoDupByAthlete(state.records.ekidenLegs[key], entry, "timeSec");
  }
}

function updateAchievementsFromSoutai(state, stageKey, result) {
  ensureAchievements(state);
  for (const ev of ["800", "1500", "3000sc", "5000", "5000w"]) {
    const er = result.events?.[ev];
    if (!er) continue;
    const ranked = er.type === "withFinal" ? (er.final ?? []) : (er.overall ?? []);
    if (ranked[0]?.isPlayer) state.achievements.soutaiWins[stageKey][ev] += 1;
  }

  if (result.overallWinner === state.teamName) {
    state.achievements.soutaiOverallWins[stageKey] += 1;
  }
}

function updateAchievementsFromEkiden(state, stageKey, result, category = "ekiden") {
  ensureAchievements(state);
  const isNewcomer = category === "newcomer_ekiden";

  if (result.myRank === 1) {
    if (isNewcomer) state.achievements.newcomerEkidenWins += 1;
    else state.achievements.ekidenWins[stageKey] += 1;
  }

  for (const sp of (result.splits ?? [])) {
    const r = (sp.rows ?? []).find(x => x.isPlayer);
    if (!r || r.legRank !== 1) continue;
    const key = String(sp.leg);
    if (isNewcomer) state.achievements.newcomerEkidenLegAwards[key] += 1;
    else state.achievements.ekidenLegAwards[stageKey][key] += 1;
  }
}

function buildNationalSoutaiCarryFromOtherRegions(state) {
  ensureWorldSeasonResults(state);

  let blockMap = state.world.season.otherResults?.soutai?.regionBlocks ?? {};
  if (Object.keys(blockMap).length === 0) {
    const kinkiSchools = worldSchoolsByFilter(state, s => BLOCKS.kinki.prefectures.includes(s.prefecture));
    const kinkiResult = runSoutaiSimulation(state, "region", kinkiSchools, "近畿地域総体");
    generateRegionSoutaiAfterRegion(state, kinkiResult);
    blockMap = state.world.season.otherResults?.soutai?.regionBlocks ?? {};
  }
  const out = [];

  for (const info of Object.values(blockMap)) {
    const res = info?.result;
    if (!res?.events) continue;

    for (const ev of ["800", "1500", "3000sc", "5000", "5000w"]) {
      const er = res.events?.[ev];
      if (!er) continue;

      const ranked = er.type === "withFinal" ? (er.final ?? []) : (er.overall ?? []);
      for (const x of ranked.slice(0, 5)) {
        if (!x?.school || x.school === state.teamName) continue;
        out.push({
          fromStage: "region",
          toStage: "national",
          event: ev,
          schoolName: x.school,
          isPlayer: false,
          athlete: x.athlete,
          timeSec: x.timeSec,
          timeText: x.timeText,
          rank: x.rank ?? null,
        });
      }
    }
  }

  return out;
}

function buildRegionSoutaiCarryFromKinkiPrefectures(state) {
  ensureWorldSeasonResults(state);

  let prefMap = state.world.season.otherResults?.soutai?.kinkiPrefecture ?? {};
  if (Object.keys(prefMap).length === 0) {
    const hyogoSchools = worldSchoolsByFilter(state, s => s.prefecture === "兵庫");
    const hyogoResult = runSoutaiSimulation(state, "prefecture", hyogoSchools, "兵庫県総体");
    generateKinkiPrefSoutaiAfterPrefecture(state, hyogoResult);
    prefMap = state.world.season.otherResults?.soutai?.kinkiPrefecture ?? {};
  }
  const out = [];

  for (const [pref, info] of Object.entries(prefMap)) {
    const res = info?.result;
    if (!res?.events) continue;

    for (const ev of ["800", "1500", "3000sc", "5000", "5000w"]) {
      const er = res.events?.[ev];
      if (!er) continue;

      const ranked = er.type === "withFinal" ? (er.final ?? []) : (er.overall ?? []);
      for (const x of ranked.slice(0, 7)) {
        if (!x?.school || x.school === state.teamName) continue;
        out.push({
          fromStage: "prefecture",
          toStage: "region",
          event: ev,
          schoolName: x.school,
          isPlayer: false,
          athlete: x.athlete,
          timeSec: x.timeSec,
          timeText: x.timeText,
          rank: x.rank ?? null,
          prefecture: pref,
        });
      }
    }
  }

  return out;
}

function buildNationalEkidenQualifiedTeamsFromWorld(state) {
  ensureWorldSeasonResults(state);

  const winners = state.world.season.otherResults?.ekiden?.nationalWinnerBySchool ?? {};
  const qualified = state.world.season.otherResults?.ekiden?.nationalQualifiedBySchool ?? {};
  const schoolNames = Array.from(new Set(
    Object.keys(winners).concat(Object.keys(qualified))
  )).filter(name => name !== state.teamName);
  const worldByName = new Map((state.world?.schools ?? []).map(s => [s.name, s]));

  return schoolNames
    .map(name => worldByName.get(name))
    .filter(Boolean)
    .map(worldSchoolToLegacyRival);
}

function buildRegionEkidenQualifiedTeamsFromKinkiPrefectures(state) {
  ensureWorldSeasonResults(state);

  let prefMap = state.world.season.otherResults?.ekiden?.kinkiPrefecture ?? {};
  if (Object.keys(prefMap).length === 0) {
    generateKinkiPrefEkidenAfterPrefecture(state);
    prefMap = state.world.season.otherResults?.ekiden?.kinkiPrefecture ?? {};
  }
  const schoolSet = new Set();

  for (const info of Object.values(prefMap)) {
    const ranked = info?.result?.ranking ?? [];
    for (const x of ranked.slice(0, 6)) {
      if (!x?.school || x.school === state.teamName) continue;
      schoolSet.add(x.school);
    }
  }

  const worldByName = new Map((state.world?.schools ?? []).map(s => [s.name, s]));
  return Array.from(schoolSet.values())
    .map(name => worldByName.get(name))
    .filter(Boolean)
    .map(worldSchoolToLegacyRival);
}

// ---- carry を次大会の rivals に混ぜ込む ----
function buildSoutaiRivalsWithCarry(state, stageKey) {
  ensureRivals(state);
  ensureCarry(state);

  const base = (state.rivals?.[stageKey] ?? []).slice();
  let carry = (state.carry.soutai.next ?? []).filter(x => x.toStage === stageKey);
  if (stageKey === "region") {
    carry = carry.concat(buildRegionSoutaiCarryFromKinkiPrefectures(state));
  }
  if (stageKey === "national") {
    carry = carry.concat(buildNationalSoutaiCarryFromOtherRegions(state));
  }
  if (carry.length === 0) return base;

  const baseNames = new Set(base.map(s => s.name));
  const myName = state.teamName;

  const bySchool = new Map();
  for (const c of carry) {
    const schoolName = c.schoolName ?? "不明校";
    if (schoolName === myName) continue;

    if (!bySchool.has(schoolName)) bySchool.set(schoolName, []);
    bySchool.get(schoolName).push(c.athlete);
  }

  for (const [schoolName, athletes] of bySchool.entries()) {
    if (baseNames.has(schoolName)) {
      const s = base.find(x => x.name === schoolName);
      if (s) s.athletes = (s.athletes ?? []).concat(athletes);
    } else {
      base.push({
        name: schoolName,
        facilityLevel: 1,
        groupKey: "carry",
        athletes,
      });
      baseNames.add(schoolName);
    }
  }

  return base;
}

function buildEkidenRivalsWithCarry(state, stageKey) {
  ensureRivals(state);
  ensureCarry(state);

  // 県駅伝は「各地区の規定順位以内」だけを参加校にする（プレイヤー校は runEkiden 側で別枠参加）
  if (stageKey === "prefecture") {
    const hyogoTeams = buildHyogoPrefEkidenTeams(state, { excludePlayer: true });
    if (hyogoTeams.length > 0) {
      return hyogoTeams.map(worldSchoolToLegacyRival);
    }
  }

  const base = (state.rivals?.[stageKey] ?? []).slice();
  let carryTeams = [];

  if (stageKey !== "national") {
    carryTeams = (state.carry.ekiden.next ?? [])
      .filter(x => x.toStage === stageKey)
      .map(x => x.team)
      .filter(Boolean)
      .filter(t => t.name !== state.teamName);
  }

  if (stageKey === "national") {
    carryTeams = buildNationalEkidenQualifiedTeamsFromWorld(state);
  }
  if (stageKey === "region") {
    carryTeams = carryTeams.concat(buildRegionEkidenQualifiedTeamsFromKinkiPrefectures(state));
  }

  // 同名校の重複エントリーを除去（全国駅伝/新人駅伝での同一校二重出場を防ぐ）
  const uniqCarry = [];
  const seenCarryNames = new Set();
  for (const t of carryTeams) {
    if (!t?.name || seenCarryNames.has(t.name)) continue;
    seenCarryNames.add(t.name);
    uniqCarry.push(t);
  }
  carryTeams = uniqCarry;

  if (carryTeams.length === 0) return base;

  const baseNames = new Set(base.map(s => s.name));
  const add = carryTeams.filter(t => !baseNames.has(t.name));
  return base.concat(add);
}

function buildPlayerFixedSoutaiPicksFromCarry(state, stageKey) {
  ensureCarry(state);
  const src = (state.carry.soutai.next ?? [])
    .filter(x => x.toStage === stageKey && x.isPlayer);
  return src.map(x => ({ athlete: x.athlete, event: x.event }));
}

function canEnterEkiden(state, stageKey) {
  ensureQualify(state);
  if (stageKey === "district") return true;
  if (stageKey === "prefecture") return !!state.qualify.ekiden.prefecture;
  if (stageKey === "region") return !!state.qualify.ekiden.region;
  if (stageKey === "national") return !!state.qualify.ekiden.national;
  return false;
}

function canEnterNewcomerEkiden(state) {
  ensureAchievements(state);
  return (state.newcomerEkiden.eligibleSchools ?? []).includes(state.teamName);
}

function renderEkidenNotQualified(state, stageKey) {
  app.innerHTML = `
    <div class="card">
      <h2>${stageTitleEkiden(stageKey)}</h2>
      <p style="color:#b00;">出場条件を満たしていないため出場できません。</p>
      <div class="row" style="margin-top:14px;">
        <button id="ok">OK（次の週へ）</button>
      </div>
    </div>
  `;
  document.querySelector("#ok").onclick = () => goNextWeek(state);
}

function renderNewcomerEkidenNotQualified(state) {
  app.innerHTML = `
    <div class="card">
      <h2>新人駅伝</h2>
      <p style="color:#b00;">出場条件を満たしていないため出場できません（全国駅伝上位10校 + それに含まれない兵庫県駅伝上位10校）。</p>
      <div class="row" style="margin-top:14px;">
        <button id="ok">OK（次の週へ）</button>
      </div>
    </div>
  `;
  document.querySelector("#ok").onclick = () => goNextWeek(state);
}

function renderSoutaiNoEntries(state, stageKey) {
  app.innerHTML = `
    <div class="card">
      <h2>${stageTitleSoutai(stageKey)}</h2>
      <p style="color:#b00;">出場できる種目がありません（前大会の通過枠がありません）。</p>
      <div class="row" style="margin-top:14px;">
        <button id="ok">OK（次の週へ）</button>
      </div>
    </div>
  `;
  document.querySelector("#ok").onclick = () => goNextWeek(state);
}

function computeScoutMaxByEkiden(state) {
  ensureScout(state);
  const tier = state.scout.lastEkidenTier ?? "none";
  if (tier === "national_top5") return 5;
  if (tier === "region_top5") return 4;
  if (tier === "region_entry") return 3;
  if (tier === "prefecture_entry") return 2;
  return 1;
}

// --- 記録表示画面 ---
function renderRecords(state) {
  ensureRecords(state);

  const fmtMeta = (r) => {
    const g = (r.grade == null) ? "?" : `${r.grade}年`;
    const y = (r.schoolYear == null) ? "?" : `${r.schoolYear}年目`;
    const w = r.when ?? "";
    return `${g} / ${y} ${w}`.trim();
  };

  const evOrder = [
    { key: "800", label: "800m" },
    { key: "1500", label: "1500m" },
    { key: "3000", label: "3000m" },
    { key: "3000sc", label: "3000mSC" },
    { key: "5000", label: "5000m" },
    { key: "5000w", label: "5000mW" },
  ];

  const eventBlocks = evOrder.map(ev => {
    const list = state.records.events[ev.key] ?? [];
    const rows = list.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.athleteName}</td>
        <td>${r.timeText}</td>
        <td style="color:#777;">${fmtMeta(r)}</td>
      </tr>
    `).join("") || `<tr><td colspan="4" style="color:#777;">記録なし</td></tr>`;

    return `
      <h3 style="margin-top:14px;">${ev.label} 歴代トップ10（自校）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:520px;">
          <thead>
            <tr><th>順位</th><th>選手</th><th>タイム</th><th>日時</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  const legBlocks = [1,2,3,4,5,6,7].map(leg => {
    const list = state.records.ekidenLegs[String(leg)] ?? [];
    const rows = list.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.athleteName}</td>
        <td>${r.timeText}</td>
        <td style="color:#777;">${fmtMeta(r)}</td>
      </tr>
    `).join("") || `<tr><td colspan="4" style="color:#777;">記録なし</td></tr>`;

    return `
      <h3 style="margin-top:14px;">駅伝 ${leg}区 歴代トップ10（自校）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:520px;">
          <thead>
            <tr><th>順位</th><th>選手</th><th>タイム</th><th>日時</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  const totalRows = (state.records.ekidenTotal ?? []).map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.totalText}</td>
      <td style="color:#777;">${(r.schoolYear == null ? "?" : `${r.schoolYear}年目`)} ${r.when ?? ""}</td>
    </tr>
  `).join("") || `<tr><td colspan="3" style="color:#777;">記録なし</td></tr>`;

  app.innerHTML = `
    <div class="card">
      <h2>自チーム 歴代記録</h2>

      ${eventBlocks}

      <h2 style="margin-top:18px;">駅伝記録</h2>
      ${legBlocks}

      <h3 style="margin-top:14px;">駅伝 総合タイム 歴代トップ10（自校）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:420px;">
          <thead>
            <tr><th>順位</th><th>総合タイム</th><th>日時</th></tr>
          </thead>
          <tbody>${totalRows}</tbody>
        </table>
      </div>

      <div class="row" style="margin-top:14px;">
        <button class="secondary" id="back">戻る</button>
      </div>
    </div>
  `;

  document.querySelector("#back").onclick = () => renderHome(state);
}

function renderAchievements(state) {
  ensureAchievements(state);
  const stages = ["district", "prefecture", "region", "national"];
  const count = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const stageLabel = (st) =>
    st === "district" ? "地区" :
    st === "prefecture" ? "県" :
    st === "region" ? "地域" : "全国";

  const soutaiEvents = ["800", "1500", "3000sc", "5000", "5000w"];
  const soutaiRows = stages.map(st => `
    <tr>
      <td>${stageLabel(st)}</td>
      ${soutaiEvents.map(ev => `<td>${count(state.achievements.soutaiWins[st][ev])}</td>`).join("")}
    </tr>
  `).join("");

  const soutaiOverallRows = stages.map(st => `
    <tr><td>${stageLabel(st)}</td><td>${count(state.achievements.soutaiOverallWins[st])}</td></tr>
  `).join("");

  const ekidenWinRows = stages.map(st => `
    <tr><td>${stageLabel(st)}</td><td>${count(state.achievements.ekidenWins[st])}</td></tr>
  `).join("");

  const legRows = stages.map(st => `
    <tr>
      <td>${stageLabel(st)}</td>
      ${[1,2,3,4,5,6,7].map(leg => `<td>${count(state.achievements.ekidenLegAwards[st][String(leg)])}</td>`).join("")}
    </tr>
  `).join("");

  const newcomerLegRow = [1,2,3,4,5,6,7]
    .map(leg => `<td>${count(state.achievements.newcomerEkidenLegAwards[String(leg)])}</td>`)
    .join("");

  const cap = getCaptain(state);
  const capText = cap ? `${cap.grade}年 ${cap.name}（${cap.personality}）` : "未指名";

  app.innerHTML = `
    <div class="card">
      <h2>実績</h2>

      <h3 style="margin-top:14px;">キャプテン</h3>
      <p style="color:#555;">現在：<b>${capText}</b></p>

      <h3 style="margin-top:14px;">総体 優勝回数（1位）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:720px;">
          <thead>
            <tr><th>大会</th><th>800</th><th>1500</th><th>3000SC</th><th>5000</th><th>5000W</th></tr>
          </thead>
          <tbody>${soutaiRows}</tbody>
        </table>
      </div>

      <h3 style="margin-top:14px;">総体 総合優勝回数</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:360px;">
          <thead><tr><th>大会</th><th>回数</th></tr></thead>
          <tbody>${soutaiOverallRows}</tbody>
        </table>
      </div>

      <h3 style="margin-top:14px;">駅伝 優勝回数（総合1位）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:360px;">
          <thead><tr><th>大会</th><th>回数</th></tr></thead>
          <tbody>${ekidenWinRows}</tbody>
        </table>
      </div>

      <h3 style="margin-top:14px;">駅伝 区間賞（区間1位）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:720px;">
          <thead>
            <tr><th>大会</th><th>1区</th><th>2区</th><th>3区</th><th>4区</th><th>5区</th><th>6区</th><th>7区</th></tr>
          </thead>
          <tbody>${legRows}</tbody>
        </table>
      </div>

      <h3 style="margin-top:14px;">新人駅伝</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:360px;">
          <thead><tr><th>項目</th><th>回数</th></tr></thead>
          <tbody><tr><td>優勝</td><td>${count(state.achievements.newcomerEkidenWins)}</td></tr></tbody>
        </table>
      </div>
      <div style="overflow:auto; margin-top:8px;">
        <table style="width:100%; border-collapse:collapse; min-width:720px;">
          <thead>
            <tr><th>区間賞</th><th>1区</th><th>2区</th><th>3区</th><th>4区</th><th>5区</th><th>6区</th><th>7区</th></tr>
          </thead>
          <tbody><tr><td>回数</td>${newcomerLegRow}</tr></tbody>
        </table>
      </div>

      <div class="row" style="margin-top:14px;">
        <button class="secondary" id="back">戻る</button>
      </div>
    </div>
  `;

  document.querySelector("#back").onclick = () => renderHome(state);
}

// --- 3月4週：設備を1つ選んでLv+1 → スカウト → 年度更新 → 次週へ ---
function renderFacilityUpgradeChoice(state) {
  ensureFacilities(state);
  ensureScout(state);

  const items = [
    { key: "nagashi", label: "流し" },
    { key: "tt", label: "TT" },
    { key: "jog", label: "ジョグ" },
    { key: "interval", label: "インターバル" },
    { key: "circuit", label: "サーキット" },
  ];

  const rows = items.map(x => `
    <div style="border:1px solid #eee; border-radius:10px; padding:10px; margin-top:10px;">
      <div style="font-weight:800;">${x.label}（現在 Lv ${state.facilities[x.key]}）</div>
      <button data-up="${x.key}" style="margin-top:8px;">この設備をLv+1</button>
    </div>
  `).join("");

  app.innerHTML = `
    <div class="card">
      <h2>年度更新前：設備強化</h2>
      <p style="color:#555;">3月4週目は、設備を1つだけ強化できます（Lv+1）。</p>
      ${rows}
      <p style="color:#b00; margin-top:10px;">※このあと新入生スカウト→年度更新（引退/進級/新入生）→次週へ進みます。</p>
    </div>
  `;

  app.querySelectorAll("button[data-up]").forEach(b => {
    b.onclick = () => {
      const key = b.getAttribute("data-up");
      state.facilities[key] = Math.min(4, (state.facilities[key] ?? 1) + 1);
      saveGame(state);
      renderScout(state);
    };
  });
}

function renderScout(state) {
  ensureScout(state);

  state.scout.max = computeScoutMaxByEkiden(state);

  if (!state.scout.pool || state.scout.pool.length !== 10) {
    state.scout.pool = Array.from({ length: 10 }, (_, i) => createScoutFreshman(i));
    state.scout.selected = [];
  }

  const max = state.scout.max;

  const rows = state.scout.pool.map((a, idx) => {
    const ab = a.abilities;
    return `
      <div style="border-top:1px solid #eee; padding:10px 0;">
        <label style="display:flex; gap:10px; align-items:flex-start;">
          <input type="checkbox" data-scout="1" data-idx="${idx}" style="margin-top:5px;" />
          <div style="flex:1;">
            <div style="font-weight:800;">${a.name}（性格：${a.personality}）</div>
            <div style="color:#555; margin-top:4px;">
              SPRINT ${ab.sprint} / SPEED ${ab.speed} / STAMINA ${ab.stamina} / TOUGHNESS ${ab.toughness} / TECHNIQUE ${ab.technique}
            </div>
            <div style="color:#777; margin-top:2px;">総合 ${a.overall}</div>
          </div>
        </label>
      </div>
    `;
  }).join("");

  app.innerHTML = `
    <div class="card">
      <h2>新入生スカウト</h2>
      <p style="color:#555;">
        候補10人から <b>${max}人まで</b> 選べます（能力は21〜60の範囲）。
      </p>

      <div style="max-height:55vh; overflow:auto;">
        ${rows}
      </div>

      <div class="row" style="margin-top:12px;">
        <button id="ok">決定</button>
      </div>

      <p id="count" style="margin-top:10px; color:#555;"></p>
      <p style="color:#b00; margin-top:6px;">※決定すると年度更新が行われ、次の週へ進みます。</p>
    </div>
  `;

  const updateCount = () => {
    const selectedIdx = Array.from(app.querySelectorAll("input[data-scout]"))
      .filter(x => x.checked)
      .map(x => Number(x.getAttribute("data-idx")));

    const over = selectedIdx.length > max;
    document.querySelector("#count").textContent =
      `選択数：${selectedIdx.length}/${max}` + (over ? "（選びすぎ）" : "");
    document.querySelector("#count").style.color = over ? "#b00" : "#555";
  };

  app.querySelectorAll("input[data-scout]").forEach(cb => {
    cb.onchange = () => updateCount();
  });
  updateCount();

  document.querySelector("#ok").onclick = () => {
    const selectedIdx = Array.from(app.querySelectorAll("input[data-scout]"))
      .filter(x => x.checked)
      .map(x => Number(x.getAttribute("data-idx")));

    if (selectedIdx.length > max) return;

    state.scout.selected = selectedIdx.map(i => state.scout.pool[i]);
    saveGame(state);

    runYearUpdate(state);
    advanceWeek(state);
    state.lastTraining = null;
    saveGame(state);
    renderHome(state);
  };
}

function goNextWeek(state) {
  if (isYearUpdateWeek(state)) {
    renderFacilityUpgradeChoice(state);
    return;
  }

  advanceWeek(state);
  state.lastTraining = null;
  saveGame(state);
  renderHome(state);
}

// --- キャプテン指名（4月1週の練習後） ---
function shouldPickCaptainNow(state) {
  // 4月1週の「練習後」に割り込ませるので、ここでは週の情報だけで判定
  if (!(state.month === 4 && state.week === 1)) return false;

  // 未指名なら必ず
  if (!state.captainId) return true;

  // 指名済みでも、3年生以外になっていたら（年度更新後など）取り直し
  const cap = getCaptain(state);
  if (!cap) return true;
  if (cap.grade !== 3) return true;

  return false;
}

function renderCaptainPick(state, onDone) {
  renderPicker(app, "captain", state, {
    onCancel: () => renderHome(state),
    onConfirm: (captainId) => {
      state.captainId = captainId;
      saveGame(state);
      onDone?.();
    }
  });
}

function raceRandomModeForMeet(state, meetType) {
  const cap = getCaptain(state);
  const p = cap?.personality ?? "";

  if (meetType === "soutai") {
    return (p === "ふつう") ? "captain_normal" : "normal";
  }

  if (meetType === "ekiden" || meetType === "newcomer_ekiden") {
    return (p === "てんさい") ? "captain_genius" : "normal";
  }

  return "normal";
}

function openMeetFlow(state, meet) {
  if (!meet) {
    goNextWeek(state);
    return;
  }

  if (meet.type === "record") {
    renderPicker(app, "record", state, {
      onCancel: () => renderHome(state),
      onConfirm: (picks) => {
        const result = runRecordMeet(state, picks);
        updateRecordsFromRecordMeet(state, result);
        saveGame(state);
        renderRecordResult(state, result);
      }
    });
    return;
  }

  if (meet.type === "soutai") {
    const original = state.rivals?.[meet.stage];
    state.rivals[meet.stage] = buildSoutaiRivalsWithCarry(state, meet.stage);

    const readOnly = meet.stage !== "district";
    const fixedPicks = readOnly ? buildPlayerFixedSoutaiPicksFromCarry(state, meet.stage) : null;

    if (readOnly && (!fixedPicks || fixedPicks.length === 0)) {
      state.rivals[meet.stage] = original;
      renderSoutaiNoEntries(state, meet.stage);
      return;
    }

    renderPicker(app, "soutai", state, {
      allowedEvents: null,
      allowedPairs: null,
      readOnly,
      fixedPicks,
      onCancel: () => {
        state.rivals[meet.stage] = original;
        renderHome(state);
      },
      onConfirm: (picks) => {
        const submit = readOnly ? (fixedPicks ?? []) : picks;

        const mode = raceRandomModeForMeet(state, "soutai");
        const result = withRaceRandomMode(state, mode, () =>
          runSoutai(state, meet.stage, submit, null)
        );

        state.carry.soutai.next = result.carryCandidates ?? [];

        updateRecordsFromSoutai(state, result);
        updateAchievementsFromSoutai(state, meet.stage, result);

        if (meet.stage === "district") generateOtherSoutaiAfterDistrict(state);
        if (meet.stage === "prefecture") generateKinkiPrefSoutaiAfterPrefecture(state, result);
        if (meet.stage === "region") generateRegionSoutaiAfterRegion(state, result);

        state.rivals[meet.stage] = original;

        safeSaveGame(state);
        renderSoutaiResult(state, result);
      }
    });
    return;
  }

  if (meet.type === "ekiden") {
    if (!canEnterEkiden(state, meet.stage)) {
      renderEkidenNotQualified(state, meet.stage);
      return;
    }

    const original = state.rivals?.[meet.stage];
    state.rivals[meet.stage] = buildEkidenRivalsWithCarry(state, meet.stage);

    renderPicker(app, "ekiden", state, {
      onCancel: () => {
        state.rivals[meet.stage] = original;
        renderHome(state);
      },
      onConfirm: (picks) => {
        const mode = raceRandomModeForMeet(state, "ekiden");
        const result = withRaceRandomMode(state, mode, () =>
          runEkiden(state, meet.stage, picks)
        );

        if (meet.stage === "prefecture") {
          ensureWorldSeasonResults(state);
          const top10 = (result.ranking ?? []).slice(0, 10).map(x => ({ school: x.school, rank: x.rank }));
          state.world.season.lastHyogoEkidenTop10 = top10;
          state.world.season.lastHyogoEkidenWinnerSchool = top10[0]?.school ?? null;
        }

        ensureQualify(state);
        if (meet.stage === "district") state.qualify.ekiden.prefecture = (result.myRank <= 9);
        if (meet.stage === "prefecture") state.qualify.ekiden.region = (result.myRank <= 6);
        if (meet.stage === "region") state.qualify.ekiden.national = (result.myRank <= 5);

        ensureScout(state);
        if (meet.stage === "prefecture") state.scout.lastEkidenTier = "prefecture_entry";
        if (meet.stage === "region") state.scout.lastEkidenTier = result.myRank <= 5 ? "region_top5" : "region_entry";
        if (meet.stage === "national") {
          state.scout.lastEkidenTier = result.myRank <= 5 ? "national_top5" : "region_top5";
          ensureAchievements(state);
          const newcomerInfo = buildNewcomerEligibleSchoolsFromNationalResult(state, result);
          state.newcomerEkiden.top10 = newcomerInfo.nationalTop10;
          state.newcomerEkiden.eligibleSchools = newcomerInfo.eligibleSchools;
          state.newcomerEkiden.sourceWhen = result.when ?? null;
        }

        state.carry.ekiden.next = result.top5Teams ?? [];

        updateRecordsFromEkiden(state, result);
        updateAchievementsFromEkiden(state, meet.stage, result, "ekiden");

        if (meet.stage === "district") generateOtherEkidenAfterDistrict(state, result);
        if (meet.stage === "prefecture") generateKinkiPrefEkidenAfterPrefecture(state, result);
        if (meet.stage === "region") generateRegionEkidenAfterRegion(state, result);

        state.rivals[meet.stage] = original;

        const ok = safeSaveGame(state);
        if (!ok) {
          app.innerHTML = `
            <div class="card">
              <h2>保存エラー</h2>
              <p style="color:#b00;">データ保存に失敗しました。ブラウザのストレージ容量が不足している可能性があります。</p>
              <div class="row" style="margin-top:12px;">
                <button id="retry">大会選出に戻る</button>
                <button class="secondary" id="home">ホームへ</button>
              </div>
            </div>
          `;
          document.querySelector("#retry").onclick = () => openMeetFlow(state, meet);
          document.querySelector("#home").onclick = () => renderHome(state);
          return;
        }
        renderEkidenResult(state, result);
      }
    });
    return;
  }

  if (meet.type === "newcomer_ekiden") {
    if (!canEnterNewcomerEkiden(state)) {
      renderNewcomerEkidenNotQualified(state);
      return;
    }

    ensureAchievements(state);
    const eligibleSchools = Array.from(new Set(state.newcomerEkiden.eligibleSchools ?? []));
    const top10 = state.newcomerEkiden.top10 ?? [];
    const newcomerRivalNames = eligibleSchools.filter(name => name !== state.teamName);

    const original = state.rivals?.newcomer;
    state.rivals.newcomer = newcomerRivalNames
      .map(name => {
        const fromTop10 = top10.find(x => x.school === name)?.schoolObj;
        if (fromTop10) return fromTop10;
        const fromNationalRivals = (state.rivals?.national ?? []).find(s => s.name === name);
        if (fromNationalRivals) return fromNationalRivals;
        const fromWorld = (state.world?.schools ?? []).find(s => s.name === name);
        if (fromWorld) return worldSchoolToLegacyRival(fromWorld);
        return null;
      })
      .filter(Boolean);

    renderPicker(app, "newcomer_ekiden", state, {
      onCancel: () => {
        state.rivals.newcomer = original;
        renderHome(state);
      },
      onConfirm: (picks) => {
        const mode = raceRandomModeForMeet(state, "newcomer_ekiden");
        const result = withRaceRandomMode(state, mode, () =>
          runEkiden(state, "newcomer", picks, {
            type: "newcomer_ekiden",
            title: "新人駅伝",
            excludeGrade3: true,
            eligibleSchools,
          })
        );

        updateAchievementsFromEkiden(state, "newcomer", result, "newcomer_ekiden");

        state.rivals.newcomer = original;
        safeSaveGame(state);
        renderEkidenResult(state, result);
      }
    });
  }
}

// --- 画面 ---
function renderTitle() {
  const hasSave = !!loadGame();

  app.innerHTML = `
    <div class="card">
      <h2>タイトル</h2>

      <label style="display:block; margin-top:10px;">
        学校名：
        <input id="teamNameInput" type="text" value="自校" style="width:100%; padding:10px; margin-top:6px;" />
      </label>

      <div class="row" style="margin-top:12px;">
        <button id="new">ゲームスタート</button>
        <button id="cont" ${hasSave ? "" : "disabled"}>つづきから</button>
        <button class="secondary" id="reset" ${hasSave ? "" : "disabled"}>セーブ削除</button>
      </div>

      <p style="margin-top:12px;color:#555;">端末内（ブラウザ）に自動でセーブされます。</p>
     
    </div>
  `;

  document.querySelector("#new").onclick = () => {
    const state = createNewGameState();

    const name = (document.querySelector("#teamNameInput")?.value ?? "").trim();
    state.teamName = name || "自校";
    applyDebugCheatIfNeeded(state, state.teamName);

    ensureRivals(state);
    ensureQualify(state);
    ensureFacilities(state);
    ensureCarry(state);
    ensureScout(state);
    ensureRecords(state);
    ensureAchievements(state);
    ensureCaptain(state);

    saveGame(state);
    renderHome(state);
  };

  document.querySelector("#cont").onclick = () => {
    const state = loadGame();
    if (state) {
      ensureRivals(state);
      ensureQualify(state);
      ensureFacilities(state);
      ensureCarry(state);
      ensureScout(state);
      ensureRecords(state);
      ensureAchievements(state);
      ensureCaptain(state);

      saveGame(state);
      renderHome(state);
    }
  };

  document.querySelector("#reset").onclick = () => {
    clearSave();
    renderTitle();
  };
}

function renderHome(state) {
  ensureWorldSeasonResults(state);
  const meet = getMeetOfWeek(state);
  const pendingMeet = !!meet && !!state.lastTraining;

  const meetText = meet
    ? meet.type === "record"
      ? "この週は【記録会】（練習後に出場選出→実行）"
      : meet.type === "soutai"
        ? `この週は【${stageTitleSoutai(meet.stage)}】（練習後に出場選出→実行）`
        : meet.type === "ekiden"
          ? `この週は【${stageTitleEkiden(meet.stage)}】（練習後に出場選出→実行）`
          : "この週は【新人駅伝】（練習後に出場選出→実行）"
    : "この週は大会なし";

  const yearText = isYearUpdateWeek(state)
    ? "この週の最後に【年度更新（設備強化→スカウト→引退/進級/新入生）】があります"
    : "";

  const cap = getCaptain(state);
  const capText = cap ? `${cap.grade}年 ${cap.name}（${cap.personality}）` : "未指名";

  const trainingButtons = TRAININGS
    .map(t => `<button data-tr="${t.id}" ${pendingMeet ? "disabled" : ""}>${t.name}</button>`)
    .join("");

  app.innerHTML = `
    <div class="card">
      <h2>ホーム</h2>
      <p>学校：${state.teamName}</p>
      <p>年：${state.year} / ${state.month}月 ${state.week}週</p>
      <p style="color:#555;">${meetText}</p>
      ${yearText ? `<p style="color:#b00;">${yearText}</p>` : ""}
      <p style="color:#555;">キャプテン：${capText}</p>
      <p style="color:#555;">今週の練習：${state.lastTraining?.name ?? "未実施"}</p>
      ${pendingMeet ? `<p style="color:#b00;">大会待機中：下の「大会へ」で選出/確定してください。</p>` : ""}

      <h3 style="margin-top:14px;">練習（タップで実行→大会があれば選出→実行）</h3>
      <div class="row">${trainingButtons}</div>
      ${pendingMeet ? `<div class="row" style="margin-top:10px;"><button id="openMeet">大会へ</button></div>` : ""}

      <div class="row" style="margin-top:12px;">
        <button id="athletes">選手</button>
        <button id="facilities">設備</button>
        <button id="records">記録</button>
        <button id="achievements">実績</button>
        <button id="otherResults">他大会結果</button>
        <button id="rename">学校名変更</button>
        <button id="help">ヘルプ</button>
        <button class="secondary" id="back">タイトルへ</button>
      </div>
    </div>
  `;

  document.querySelector("#athletes").onclick = () => renderAthletes(state);
  document.querySelector("#facilities").onclick = () => renderFacilities(state);
  document.querySelector("#records").onclick = () => renderRecords(state);
  document.querySelector("#achievements").onclick = () => renderAchievements(state);
  document.querySelector("#otherResults").onclick = () => renderOtherResults(state);
  document.querySelector("#rename").onclick = () => renderRenameTeam(state);
  document.querySelector("#help").onclick = () => renderHelp(state);
  document.querySelector("#back").onclick = () => renderTitle();
  if (pendingMeet) {
    document.querySelector("#openMeet").onclick = () => {
      ensureRivals(state);
      ensureQualify(state);
      ensureFacilities(state);
      ensureCarry(state);
      ensureScout(state);
      ensureRecords(state);
      ensureAchievements(state);
      ensureCaptain(state);
      openMeetFlow(state, meet);
    };
  }

  app.querySelectorAll("button[data-tr]").forEach(b => {
    b.onclick = async () => {
      const id = b.getAttribute("data-tr");

      ensureRivals(state);
      ensureQualify(state);
      ensureFacilities(state);
      ensureCarry(state);
      ensureScout(state);
      ensureRecords(state);
      ensureAchievements(state);
      ensureCaptain(state);

      rivalsWeeklyTraining(state);
      applyTraining(state, id);

      // ★4月1週 練習後：キャプテン指名
      if (shouldPickCaptainNow(state)) {
        saveGame(state);
        renderCaptainPick(state, () => renderHome(state));
        return;
      }

      const meet = getMeetOfWeek(state);
      saveGame(state);

      openMeetFlow(state, meet);
    };
  });
}

function renderRenameTeam(state) {
  app.innerHTML = `
    <div class="card">
      <h2>学校名変更</h2>
      <p style="color:#555;">現在：${state.teamName}</p>

      <label style="display:block; margin-top:12px;">
        新しい学校名：
        <input id="newTeamName" type="text" value="${state.teamName}" style="width:100%; padding:10px; margin-top:6px;" />
      </label>

      <div class="row" style="margin-top:12px;">
        <button id="ok">保存</button>
        <button class="secondary" id="cancel">戻る</button>
      </div>
    </div>
  `;

  document.querySelector("#ok").onclick = () => {
    const v = (document.querySelector("#newTeamName")?.value ?? "").trim();
    state.teamName = v || "自校";
    saveGame(state);
    renderHome(state);
  };
  document.querySelector("#cancel").onclick = () => renderHome(state);
}

/**
 * ヘルプはあとで書き換えるとのことなので仮実装です。
 * あなたの任意の内容に差し替えてOK。
 */
function renderHelp(state) {
  app.innerHTML = `
    <div class="card">
      <h2>ヘルプ</h2>

      <h3 style="margin-top:12px;">基本の流れ</h3>
      <ul>
        <li>ホームで練習を選ぶ → 週が進みます。</li>
        <li>大会がある週は、練習後に出場確認/選出して大会を実行します。</li>
        <li>結果を見たら「OK（次の週へ）」で進みます。</li>
        <li>年度末（3月4週）には、設備強化・スカウト・年度更新があります。</li>
      </ul>

      <h3 style="margin-top:12px;">能力の種類</h3>
      <ul>
        <li><b>SPRINT</b>：瞬発力</li>
        <li><b>SPEED</b>：スピード</li>
        <li><b>STAMINA</b>：スタミナ</li>
        <li><b>TOUGHNESS</b>：タフネス</li>
        <li><b>TECHNIQUE</b>：テクニック</li>
      </ul>

      <h3 style="margin-top:12px;">練習と伸びる能力</h3>
      <ul>
        <li>流し：<b>SPRINT</b> が伸びる練習です。</li>
        <li>TT： <b>SPEED</b> が伸びる練習です。</li>
        <li>ジョグ： <b>STAMINA</b> が伸びる練習です。</li>
        <li>インターバル：<b>TOUGHNESS</b> が伸びる練習です。</li>
        <li>サーキット： <b>TECHNIQUE</b> が伸びる練習です。</li>
      </ul>

      <h3 style="margin-top:12px;">性格補正（練習の伸び方）</h3>
      <ul>
        <li>選手の性格によって、特定の練習で能力が伸びやすくなります。</li>
        <li>短気：<b>SPRINT</b> 系が伸びやすく、<b>TOUGHNESS</b> 系が伸びにくい。</li>
        <li>せっかち：<b>SPEED</b> 系が伸びやすく、<b>STAMINA</b> 系が伸びにくい。</li>
        <li>おおらか：<b>STAMINA</b> 系が伸びやすく、<b>SPRINT</b> 系が伸びにくい。</li>
        <li>がんこ：<b>TOUGHNESS</b> 系が伸びやすく、<b>TECHNIQUE</b>系が伸びにくい</li>
        <li>きよう：<b>TECHNIQUE</b> 系が伸びやすく、<b>SPEED</b> 系が伸びにくい。</li>
        <li>ふつう：どれも普通に成長します。</li>
        <li>てんさい：多方面で伸びやすく、化ける可能性があります。</li>
      </ul>

      <h3 style="margin-top:12px;">大会の出場条件</h3>
      <ul>
        <li>総体（自校）：地区総体は自由に出場、県/地域/全国は前大会通過者のみ出場できます。</li>
        <li>総体（通過条件）：地区→県は各種目7位以内、県→地域は各種目7位以内、地域→全国は各種目5位以内です。</li>
        <li>兵庫県駅伝の参加校：阪神8、神戸9、東播7、西播6、丹有3、淡路2、但馬2（合計37校）です。</li>
      　<li>近畿駅伝は兵庫駅伝で6位以内に入ると出場できます。</li>
        <li>全国駅伝の出場校：県駅伝は各都道府県1校（北海道のみ2校）+ 各地域駅伝の最上位1校です。</li>
        <li>新人駅伝の出場校：全国駅伝上位10校 + それに含まれない兵庫県駅伝上位10校（計20校）です。</li>
      </ul>

      <h3 style="margin-top:12px;">新入生スカウト人数</h3>
      <ul>
        <li>基本は1人です。</li>
        <li>県駅伝に出場：2人、近畿駅伝に出場：3人。</li>
        <li>近畿駅伝5位以内：4人、全国駅伝5位以内：5人。</li>
      </ul>

      <h3 style="margin-top:12px;">他大会結果を見られる期間</h3>
      <ul>
        <li>5月2〜3週：兵庫 各地区総体。</li>
        <li>6月1〜2週：近畿 各県総体。</li>
        <li>6月4週〜7月3週：各地域総体。</li>
        <li>10月3週：兵庫 各地区駅伝。</li>
        <li>11月1週：近畿 各県駅伝。</li>
        <li>11月3〜4週、12月1〜2週：各地域駅伝。</li>
      </ul>

      <h3 style="margin-top:12px;">キャプテン補正</h3>
      <ul>
        <li>4月1週の練習後にキャプテンを指名します（不在時は再指名）。</li>
        <li>練習補正：性格に応じて効果が変わります。</li>
        <li>たんきは夏の練習の能力の伸びが大きくなります。</li>
        <li>せっかちは3年生の能力の伸びが大きくなります。</li>
        <li>おおらかは2年生の能力の伸びが大きくなります。</li>
        <li>がんこは冬の練習の能力の伸びが大きくなります。</li>
        <li>きようは1年生の能力の伸びが大きくなります。</li>
        <li>ふつうは総体のタイムが出やすくなります。</li>
        <li>てんさいは駅伝のタイムが出やすくなります。</li>
      </ul>

      <div class="row" style="margin-top:14px;">
        <button class="secondary" id="back">戻る</button>
      </div>
    </div>
  `;
  document.querySelector("#back").onclick = () => renderHome(state);
}

function renderFacilities(state) {
  ensureFacilities(state);
  const f = state.facilities;

  app.innerHTML = `
    <div class="card">
      <h2>練習設備レベル</h2>
      <table style="width:100%; border-collapse:collapse;">
        <tbody>
          <tr><td>流し</td><td>Lv ${f.nagashi}</td></tr>
          <tr><td>TT</td><td>Lv ${f.tt}</td></tr>
          <tr><td>ジョグ</td><td>Lv ${f.jog}</td></tr>
          <tr><td>インターバル</td><td>Lv ${f.interval}</td></tr>
          <tr><td>サーキット</td><td>Lv ${f.circuit}</td></tr>
        </tbody>
      </table>
      <div class="row" style="margin-top:12px;">
        <button class="secondary" id="home">戻る</button>
      </div>
    </div>
  `;
  document.querySelector("#home").onclick = () => renderHome(state);
}

function renderAthletes(state) {
  const f = (n) => Math.floor(n);

  const rows = (state.athletes ?? []).map(a => `
    <tr>
      <td>${a.grade}</td>
      <td>${a.name}</td>
      <td>${a.personality}</td>
      <td>${f(a.abilities.sprint)}</td>
      <td>${f(a.abilities.speed)}</td>
      <td>${f(a.abilities.stamina)}</td>
      <td>${f(a.abilities.toughness)}</td>
      <td>${f(a.abilities.technique)}</td>
      <td>${f(a.overall)}</td>
    </tr>
  `).join("");

  app.innerHTML = `
    <div class="card">
      <h2>選手</h2>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:700px;">
          <thead>
            <tr>
              <th>学年</th><th>名前</th><th>性格</th>
              <th>SP</th><th>SPD</th><th>STA</th><th>TUF</th><th>TEC</th>
              <th>総合</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="row" style="margin-top:12px;">
        <button class="secondary" id="home">戻る</button>
      </div>
    </div>
  `;
  document.querySelector("#home").onclick = () => renderHome(state);
}

// --- 結果画面 ---
function renderRecordResult(state, result) {
  const sections = ["1500", "3000", "5000"].map(ev => {
    const rows = result.playerOnly[ev].map(r => `
      <tr>
        <td>${r.overallRank}</td>
        <td>${r.athlete.name}（${r.athlete.grade}年）</td>
        <td>${r.timeText}</td>
      </tr>
    `).join("");

    return `
      <h3 style="margin-top:14px;">${ev}m（自校）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:420px;">
          <thead>
            <tr><th>全体順位</th><th>選手</th><th>タイム</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  app.innerHTML = `
    <div class="card">
      <h2>${result.title} 結果</h2>
      <p style="color:#555;">${result.when}</p>
      ${sections}
      <div class="row" style="margin-top:14px;">
        <button id="ok">OK（次の週へ）</button>
      </div>
    </div>
  `;
  document.querySelector("#ok").onclick = () => goNextWeek(state);
}

function renderSoutaiResult(state, result, options = {}) {
  const doSave = options.save !== false;
  const okLabel = options.okLabel ?? "OK（次の週へ）";
  const onOk = options.onOk ?? (() => goNextWeek(state));

  if (doSave) saveGame(state);

  const advanceTextSoutai = (() => {
    if (result.stage === "district") return "通過判定：各種目7位以内で県総体へ";
    if (result.stage === "prefecture") return "通過判定：各種目7位以内で地域総体へ";
    if (result.stage === "region") return "通過判定：各種目5位以内で全国総体へ";
    return "通過判定：全国総体は最終大会です";
  })();

  const evOrder = ["800", "1500", "3000sc", "5000", "5000w"];
  const showPref = result.stage === "region" || result.stage === "national";
  const sections = evOrder.map(ev => {
    const er = result.events[ev];
    if (!er) return "";

    const list = er.type === "withFinal" ? er.final : er.overall;

    const top = list.slice(0, 10).map((x, i) => {
      const pref = prefectureOfSchool(state, x.school);
      return `
      <tr>
        <td>${i + 1}</td>
        <td>${x.school}</td>
        ${showPref ? `<td>${pref}</td>` : ""}
        <td>${x.isPlayer ? "自校" : ""}</td>
        <td>${x.athlete.name}（${x.athlete.grade}年）</td>
        <td>${x.timeText}</td>
      </tr>
    `;
    }).join("");

    let playerRows = [];

    if (er.type === "withFinal") {
      const heats = er.heats ?? [];
      const allHeatResults = heats.flatMap(h =>
        (h.results ?? []).map((x, i) => ({
          ...x,
          heat: h.heat,
          rankInHeat: i + 1,
        }))
      );
      const athleteKey = (x, fallback) => x.athlete?.id ?? x.athlete?.name ?? fallback;
      const prelimRankMap = new Map(
        allHeatResults
          .slice()
          .sort((a, b) => a.timeSec - b.timeSec)
          .map((x, i) => [athleteKey(x, `heat-${x.heat}-rank-${x.rankInHeat}`), i + 1])
      );

      playerRows = allHeatResults
        .filter(x => x.isPlayer)
        .map(x => {
          const key = athleteKey(x, `heat-${x.heat}-rank-${x.rankInHeat}`);
          const finalRank = (er.final ?? []).findIndex(f =>
            (athleteKey(f, "") === key) || (f.athlete === x.athlete)
          );
          const isFinalist = finalRank >= 0;
          const shown = isFinalist ? er.final[finalRank] : x;
          return {
            athleteName: x.athlete?.name ?? "",
            grade: x.athlete?.grade ?? null,
            overallRank: isFinalist ? (finalRank + 1) : (prelimRankMap.get(key) ?? "-"),
            timeText: shown.timeText,
            remark: isFinalist ? `決勝${finalRank + 1}位` : `予選${x.heat}組${x.rankInHeat}着`,
          };
        })
        .sort((a, b) => {
          const ra = typeof a.overallRank === "number" ? a.overallRank : 9999;
          const rb = typeof b.overallRank === "number" ? b.overallRank : 9999;
          return ra - rb;
        });
    } else {
      playerRows = (er.overall ?? [])
        .map((x, i) => ({ ...x, overallRank: i + 1 }))
        .filter(x => x.isPlayer)
        .map(x => ({
          athleteName: x.athlete?.name ?? "",
          grade: x.athlete?.grade ?? null,
          overallRank: x.overallRank,
          timeText: x.timeText,
          remark: "-",
        }));
    }

    const playerTableRows = playerRows.map(r => `
      <tr>
        <td>${r.overallRank}</td>
        <td>${r.athleteName}（${r.grade ?? "?"}年）</td>
        <td>${r.timeText}</td>
        <td>${r.remark}</td>
      </tr>
    `).join("") || `<tr><td colspan="4" style="color:#777;">該当なし</td></tr>`;

    return `
      <h3 style="margin-top:14px;">${eventLabel(ev)}</h3>
      <h4 style="margin:10px 0 6px 0;">全体（上位10）</h4>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:560px;">
          <thead>
            <tr><th>順位</th><th>学校</th>${showPref ? "<th>都道府県</th>" : ""}<th></th><th>選手</th><th>タイム</th></tr>
          </thead>
          <tbody>${top}</tbody>
        </table>
      </div>
      <h4 style="margin:10px 0 6px 0;">自校選手</h4>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:560px;">
          <thead>
            <tr><th>総合順位</th><th>選手</th><th>タイム</th><th>備考</th></tr>
          </thead>
          <tbody>${playerTableRows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  const overallRanking = (result.overallRanking ?? []).slice(0, 10).map(x => {
    const pref = prefectureOfSchool(state, x.school);
    return `
    <tr>
      <td>${x.rank}</td>
      <td>${x.school}</td>
      ${showPref ? `<td>${pref}</td>` : ""}
      <td>${x.points}</td>
      <td>${x.firsts}</td>
      <td>${x.seconds}</td>
      <td>${x.thirds}</td>
      <td>${x.top10}</td>
    </tr>
  `;
  }).join("") || `<tr><td colspan="${showPref ? 8 : 7}" style="color:#777;">集計なし</td></tr>`;

  app.innerHTML = `
    <div class="card">
      <h2>${result.title} 結果</h2>
      <p style="color:#555;">${result.when}</p>
      <p style="color:#555;">${advanceTextSoutai}</p>
      <h3 style="margin-top:14px;">総合得点ランキング</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:720px;">
          <thead>
            <tr><th>順位</th><th>学校</th>${showPref ? "<th>都道府県</th>" : ""}<th>得点</th><th>1位</th><th>2位</th><th>3位</th><th>10位以内</th></tr>
          </thead>
          <tbody>${overallRanking}</tbody>
        </table>
      </div>
      ${sections}
      <div class="row" style="margin-top:14px;">
        <button id="ok">${okLabel}</button>
      </div>
    </div>
  `;
  document.querySelector("#ok").onclick = () => onOk();
}

function renderEkidenResult(state, result, options = {}) {
  const okLabel = options.okLabel ?? "OK（次の週へ）";
  const onOk = options.onOk ?? (() => goNextWeek(state));

  const showSource = result.stage === "region" || result.stage === "national";
  const sourceLabelHeader = "出場元";

  const top10 = result.ranking.slice(0, 10).map(x => {
    const source = ekidenSourceLabel(state, result, x.school);
    return `
    <tr>
      <td>${x.rank}</td>
      <td>${x.school}</td>
      ${showSource ? `<td>${source}</td>` : ""}
      <td>${x.isPlayer ? "自校" : ""}</td>
      <td>${x.totalText}</td>
    </tr>
  `;
  }).join("");

  const my = result.ranking.find(x => x.isPlayer);
  const legs = (my?.legs ?? []).map(l => `
    <tr>
      <td>${l.leg}</td>
      <td>${l.event}m</td>
      <td>${l.athleteName}（${l.grade ?? "?"}年）</td>
      <td>${l.timeText}</td>
    </tr>
  `).join("");

  const q = (() => {
    // 通過判定は「自校が出場している本大会」かつ「地区/県駅伝」のみ表示
    if (result.type !== "ekiden" || !my) return "";
    if (result.stage === "district") {
      const clearedDistrict = result.myRank <= 9;
      return `自校順位：${result.myRank}位 / 通過：${clearedDistrict ? "YES" : "NO"}（9位以内で県駅伝へ）`;
    }
    if (result.stage === "prefecture") {
      const clearedPrefecture = result.myRank <= 6;
      return `自校順位：${result.myRank}位 / 通過：${clearedPrefecture ? "YES" : "NO"}（6位以内で近畿駅伝へ）`;
    }
    return "";
  })();

  const splitBlocks = (result.splits ?? []).map(sp => {
    const rows = (sp.rows ?? []).map(r => `
      <tr>
        <td>${r.cumRank}</td>
        <td>${r.school}</td>
        <td>${r.isPlayer ? "自校" : ""}</td>
        <td>${r.legRank}</td>
        <td>${r.legTimeText}</td>
        <td>${r.cumText}</td>
      </tr>
    `).join("");

    return `
      <h4 style="margin:10px 0 6px 0;">${sp.leg}区（${sp.event}m）時点</h4>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:720px;">
          <thead>
            <tr>
              <th>累積順位</th><th>学校</th><th></th><th>区間順位</th><th>区間タイム</th><th>累積タイム</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  app.innerHTML = `
    <div class="card">
      <h2>${result.title} 結果</h2>
      <p style="color:#555;">${result.when}</p>
      ${q ? `<p style="color:#555;">${q}</p>` : ""}

      <h3 style="margin-top:14px;">総合順位（上位10）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:520px;">
          <thead>
            <tr><th>順位</th><th>学校</th>${showSource ? `<th>${sourceLabelHeader}</th>` : ""}<th></th><th>総合タイム</th></tr>
          </thead>
          <tbody>${top10}</tbody>
        </table>
      </div>

      <h3 style="margin-top:14px;">自校区間タイム</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:520px;">
          <thead>
            <tr><th>区</th><th>距離</th><th>選手</th><th>タイム</th></tr>
          </thead>
          <tbody>${legs}</tbody>
        </table>
      </div>

      <h3 style="margin-top:14px;">各区の順位推移（全校）</h3>
      ${splitBlocks}

      <div class="row" style="margin-top:14px;">
        <button id="ok">${okLabel}</button>
      </div>
    </div>
  `;
  document.querySelector("#ok").onclick = () => onOk();
}

// --- 年度更新 ---
function runYearUpdate(state) {
  applyYearUpdateToState(state);
  rivalsYearUpdate(state);

  ensureCarry(state);
  state.carry.soutai.next = [];
  state.carry.ekiden.next = [];

  ensureFacilities(state);

  ensureQualify(state);
  state.qualify.ekiden = { prefecture: false, region: false, national: false };

  ensureScout(state);
  state.scout.lastEkidenTier = "none";

  ensureAchievements(state);
  state.newcomerEkiden.eligibleSchools = [];
  state.newcomerEkiden.top10 = [];
  state.newcomerEkiden.sourceWhen = null;

  // 年度更新で captainId が無効になり得るので救済
  ensureCaptain(state);
}

// --- ラベル ---
function stageTitleSoutai(key) {
  if (key === "district") return "地区総体";
  if (key === "prefecture") return "県総体";
  if (key === "region") return "地域総体";
  if (key === "national") return "全国総体";
  return "総体";
}
function stageTitleEkiden(key) {
  if (key === "district") return "地区駅伝";
  if (key === "prefecture") return "県駅伝";
  if (key === "region") return "地域駅伝";
  if (key === "national") return "全国駅伝";
  return "駅伝";
}
function eventLabel(ev) {
  if (ev === "800") return "800m";
  if (ev === "1500") return "1500m";
  if (ev === "3000sc") return "3000mSC";
  if (ev === "5000") return "5000m";
  if (ev === "5000w") return "5000mW";
  return ev;
}

renderTitle();
