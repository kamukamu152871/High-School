// 方針B：裏大会の完全再現（世界進行）
// - 学校一覧・選手名簿は state.world.schools（rivals.jsで生成）をソースにする
// - 各大会の「出場者/出場校」をルールに従って構築し、meet_* に渡して結果を得る
//
// 重要：meet_soutai / meet_ekiden は「参加者が確定している」前提で実行する。

import { blockKeyOfPrefecture } from "./data/regions.js";
import { runSoutai } from "./meet_soutai.js";
import { runEkiden } from "./meet_ekiden.js";

// ---- 共通ユーティリティ ----
function ensureWorld(state) {
  state.world ??= { schools: null, season: {}, history: [] };
  state.world.season ??= {};
  state.world.history ??= [];

  state.world.season.lastHyogoEkidenTop10 ??= [];
  state.world.season.lastNationalEkidenTop10 ??= [];
}

function schoolBaseFromWorld(s) {
  return {
    name: s.name,
    isPlayer: false,
    athletes: s.athletes,
    prefecture: s.prefecture,
    districtKey: s.districtKey ?? null,
    districtName: s.districtName ?? null,
    level: s.level ?? 1,
  };
}

export function getWorldSchool(state, schoolName) {
  ensureWorld(state);
  const s = (state.world.schools ?? []).find(x => x.name === schoolName);
  return s ?? null;
}

function worldSchoolsByPrefecture(state, prefName) {
  return (state.world.schools ?? []).filter(s => s.prefecture === prefName);
}

function worldHyogoByDistrict(state, districtKey) {
  return (state.world.schools ?? []).filter(s => s.prefecture === "兵庫" && s.districtKey === districtKey);
}

function allPrefecturesInWorld(state) {
  const set = new Set((state.world.schools ?? []).map(s => s.prefecture));
  return Array.from(set.values());
}

function allNonHyogoPrefectures(state) {
  return allPrefecturesInWorld(state).filter(p => p !== "兵庫");
}

function isRacewalkEvent(ev) {
  // 競歩は 5000w
  return ev === "5000w";
}

// 総体：通過枠（順位条件）
function soutaiQualifyRankLimitFor(stageKey, ev, districtKey = null) {
  // あなた指定：
  // - 県総体の出場枠：阪神/神戸/東播/西播 は地区総体7位以内、丹有/但馬/淡路は4位以内
  // - 地域総体（近畿）・各ブロック：県総体で各種目6位以内（競歩は5位以内）
  // - 全国総体：各ブロック/地域で各種目6位以内（競歩は5位以内）
  if (stageKey === "prefecture") {
    const isSmall = ["tanyu", "tajima", "awaji"].includes(districtKey);
    const limit = isSmall ? 4 : 7;
    return limit;
  }
  if (stageKey === "region") return isRacewalkEvent(ev) ? 5 : 6;
  if (stageKey === "national") return isRacewalkEvent(ev) ? 5 : 6;
  return null;
}

// ---- 総体：地区（兵庫7地区すべてを回す） ----
export function runHyogoDistrictSoutaiAll(state, when) {
  ensureWorld(state);

  const districts = ["kobe", "hanshin", "toban", "seiban", "tanyu", "tajima", "awaji"];
  const resultsByDistrict = {};

  for (const d of districts) {
    const schools = worldHyogoByDistrict(state, d).map(s => ({
      ...schoolBaseFromWorld(s),
      isPlayer: false,
    }));
    // district soutaiはAI選出でOK（自校は main で手動選出するため別に実行）
    // ただし「神戸地区」は本戦（プレイヤー手動）で実行するので、ここでは裏大会としても回す必要がある
    // → 裏大会は「プレイヤー校を除外した神戸地区」で回し、本戦はプレイヤー含む神戸地区で回す。
    resultsByDistrict[d] = runSoutai(state, "district", schools, [], { when, title: `${districtName(d)}地区総体（裏）` });
  }

  state.world.season.hyogoDistrictSoutaiResults = resultsByDistrict;
  return resultsByDistrict;
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

// 地区総体結果から、県総体出場者を構築（兵庫県）
export function buildHyogoPrefectureSoutaiQualifiers(state) {
  ensureWorld(state);
  const distRes = state.world.season.hyogoDistrictSoutaiResults ?? {};
  const outByEvent = {}; // ev -> [{schoolName, athleteSnapshot}]
  for (const ev of ["800", "1500", "3000sc", "5000", "5000w"]) outByEvent[ev] = [];

  for (const [dKey, res] of Object.entries(distRes)) {
    if (!res?.qualifiers?.byEvent) continue;
    for (const ev of Object.keys(res.qualifiers.byEvent)) {
      const limit = soutaiQualifyRankLimitFor("prefecture", ev, dKey);
      const ranked = res.qualifiers.byEvent[ev] ?? [];
      const top = ranked.filter(x => x.rank <= limit);
      for (const x of top) {
        outByEvent[ev].push({
          school: x.school,
          isPlayer: false,
          athlete: x.athlete,
          event: ev,
          from: { stage: "district", districtKey: dKey, rank: x.rank },
        });
      }
    }
  }

  state.world.season.lastHyogoSoutaiQualifiers = { byEvent: outByEvent };
  return state.world.season.lastHyogoSoutaiQualifiers;
}

// ---- 県総体（兵庫県） ----
export function runHyogoPrefectureSoutai(state, playerSchool, playerPickedEntries, when) {
  ensureWorld(state);

  const q = buildHyogoPrefectureSoutaiQualifiers(state);

  // 参加校は「出場者がいる学校」だけに絞る
  const schoolMap = new Map();
  for (const ev of Object.keys(q.byEvent)) {
    for (const ent of q.byEvent[ev]) {
      if (!schoolMap.has(ent.school)) schoolMap.set(ent.school, []);
      schoolMap.get(ent.school).push(ent.athlete);
    }
  }

  // 学校→athletes は “学校名簿全員” を持たせ、meet側のAIが選べるようにする
  const schools = Array.from(schoolMap.keys())
    .map(name => getWorldSchool(state, name))
    .filter(Boolean)
    .map(s => ({ ...schoolBaseFromWorld(s), isPlayer: false }));

  // 自校を必ず参加させる（自校の通過者は playerPickedEntries として渡す）
  const schoolsWithPlayer = schools.concat([{ ...playerSchool }]);

  return runSoutai(state, "prefecture", schoolsWithPlayer, playerPickedEntries, { when, title: "兵庫県総体" });
}

// ---- 他都道府県：県総体（裏） ----
export function runAllOtherPrefectureSoutai(state, when) {
  ensureWorld(state);
  const prefs = allNonHyogoPrefectures(state);
  const results = {};
  for (const pref of prefs) {
    const schools = worldSchoolsByPrefecture(state, pref).map(s => ({ ...schoolBaseFromWorld(s), isPlayer: false }));
    results[pref] = runSoutai(state, "prefecture", schools, [], { when, title: `${pref}県総体（裏）` });
  }
  state.world.season.otherPrefectureSoutaiResults = results;
  return results;
}

// ---- 地域総体（近畿＆各ブロック） ----
export function buildBlockSoutaiQualifiersFromPrefectureResults(prefResult, prefName) {
  // 県総体結果から「地域総体」出場者を抽出（上位6、競歩5）
  const outByEvent = {};
  for (const ev of ["800", "1500", "3000sc", "5000", "5000w"]) outByEvent[ev] = [];

  for (const ev of Object.keys(prefResult.events ?? {})) {
    const er = prefResult.events[ev];
    if (!er) continue;

    const ranked = er.type === "withFinal" ? (er.final ?? []) : (er.overall ?? []);
    const limit = soutaiQualifyRankLimitFor("region", ev, null);
    const top = ranked.slice(0, limit);

    for (let i = 0; i < top.length; i++) {
      const x = top[i];
      outByEvent[ev].push({
        school: x.school,
        isPlayer: !!x.isPlayer,
        athlete: x.athlete,
        event: ev,
        from: { stage: "prefecture", prefecture: prefName, rank: i + 1 },
      });
    }
  }

  return { byEvent: outByEvent };
}

export function runAllBlockSoutai(state, hyogoPrefRes, otherPrefResMap, when) {
  ensureWorld(state);

  // 各県の県総体結果 → ブロックへ出す通過者を抽出
  const byPrefQual = {};
  byPrefQual["兵庫"] = buildBlockSoutaiQualifiersFromPrefectureResults(hyogoPrefRes, "兵庫");

  for (const [pref, res] of Object.entries(otherPrefResMap ?? {})) {
    byPrefQual[pref] = buildBlockSoutaiQualifiersFromPrefectureResults(res, pref);
  }

  // ブロックごとに出場者をまとめ、ブロック総体を実行
  const blockResults = {}; // blockKey -> result
  const allPrefs = Object.keys(byPrefQual);
  const byBlock = new Map();

  for (const pref of allPrefs) {
    const blockKey = blockKeyOfPrefecture(pref);
    if (!blockKey) continue; // 北海道はブロック外
    if (!byBlock.has(blockKey)) byBlock.set(blockKey, []);
    byBlock.get(blockKey).push(pref);
  }

  for (const [blockKey, prefs] of byBlock.entries()) {
    // ブロックに属する学校を集める（出場者がいる学校のみ）
    const schoolNames = new Set();
    for (const pref of prefs) {
      const q = byPrefQual[pref];
      for (const ev of Object.keys(q.byEvent)) {
        for (const ent of q.byEvent[ev]) schoolNames.add(ent.school);
      }
    }

    const schools = Array.from(schoolNames.values())
      .map(name => getWorldSchool(state, name))
      .filter(Boolean)
      .map(s => ({ ...schoolBaseFromWorld(s), isPlayer: s.name === (state.teamName ?? "") }));

    // 自校がこのブロックにいる（兵庫=近畿）なら isPlayer=true が混ざる
    const playerPicks = []; // ブロック総体では main 側で「自校通過者」を固定選出にしたいので、後で main が渡す
    blockResults[blockKey] = runSoutai(state, "region", schools, playerPicks, { when, title: `${blockKey}ブロック総体` });
  }

  state.world.season.blockSoutaiResults = blockResults;
  return blockResults;
}

// ---- 駅伝（地区/県/ブロック/全国）：学校単位 ----
// 兵庫県駅伝枠（あなた確定）
const HYOGO_EKIDEN_SLOTS = {
  hanshin: 8,
  kobe: 9,
  toban: 7,
  seiban: 6,
  tanyu: 3,
  awaji: 2,
  tajima: 2,
};

// 兵庫県：地区駅伝を全地区回す（本戦=神戸地区はmainで手動選出するが、裏大会も回す）
export function runHyogoDistrictEkidenAll(state, when) {
  ensureWorld(state);
  const districts = Object.keys(HYOGO_EKIDEN_SLOTS);
  const results = {};

  for (const dKey of districts) {
    const schools = worldHyogoByDistrict(state, dKey).map(s => ({ ...schoolBaseFromWorld(s), isPlayer: false }));
    // ここではAI選出でOK（mainの本戦とは別）
    results[dKey] = runEkiden(state, "district", schools, [], { when, title: `${districtName(dKey)}地区駅伝（裏）` });
  }

  state.world.season.hyogoDistrictEkidenResults = results;
  return results;
}

export function buildHyogoPrefectureEkidenSchools(state) {
  ensureWorld(state);
  const distRes = state.world.season.hyogoDistrictEkidenResults ?? {};
  const qualifiers = []; // [{school, rank, fromDistrict}]
  for (const [dKey, res] of Object.entries(distRes)) {
    const slots = HYOGO_EKIDEN_SLOTS[dKey] ?? 0;
    const top = (res.ranking ?? []).slice(0, slots);
    for (const x of top) qualifiers.push({ school: x.school, rank: x.rank, fromDistrict: dKey });
  }
  state.world.season.lastHyogoEkidenQualifiers = qualifiers;
  return qualifiers;
}

export function runHyogoPrefectureEkiden(state, playerSchool, playerPicks, when) {
  ensureWorld(state);
  const qs = buildHyogoPrefectureEkidenSchools(state);
  const schoolNames = Array.from(new Set(qs.map(x => x.school)));

  const schools = schoolNames
    .map(name => getWorldSchool(state, name))
    .filter(Boolean)
    .map(s => ({ ...schoolBaseFromWorld(s), isPlayer: false }));

  const schoolsWithPlayer = schools.concat([{ ...playerSchool }]);
  const res = runEkiden(state, "hyogo", schoolsWithPlayer, playerPicks, { when, title: "兵庫県駅伝" });

  // 兵庫Top10保存（新人駅伝用）
  state.world.season.lastHyogoEkidenTop10 = (res.ranking ?? []).slice(0, 10).map(x => ({ school: x.school, rank: x.rank }));
  return res;
}

export function runOtherPrefectureEkidenAll(state, when) {
  ensureWorld(state);
  const prefs = allNonHyogoPrefectures(state);
  const results = {};
  for (const pref of prefs) {
    const schools = worldSchoolsByPrefecture(state, pref).map(s => ({ ...schoolBaseFromWorld(s), isPlayer: false }));
    results[pref] = runEkiden(state, "prefecture", schools, [], { when, title: `${pref}県駅伝（裏）` });
  }
  state.world.season.otherPrefectureEkidenResults = results;
  return results;
}

// ブロック駅伝：各県駅伝6位以内が出場。ただし「全国資格（県優勝）を持っていない学校の中で最上位を全国へ」判定に必要なので、県優勝校も保持する
export function runAllBlockEkiden(state, hyogoEkidenRes, otherPrefEkidenResMap, when) {
  ensureWorld(state);

  const prefRes = { "兵庫": hyogoEkidenRes, ...(otherPrefEkidenResMap ?? {}) };

  // 県優勝校
  const prefWinners = {};
  for (const [pref, res] of Object.entries(prefRes)) {
    const winner = (res.ranking ?? [])[0];
    if (winner) prefWinners[pref] = winner.school;
  }
  state.world.season.prefEkidenWinners = prefWinners;

  // ブロックごとに、県駅伝上位6位以内の学校を集めて実行
  const byBlockSchools = new Map(); // blockKey -> Set(schoolName)
  for (const [pref, res] of Object.entries(prefRes)) {
    const blockKey = blockKeyOfPrefecture(pref);
    if (!blockKey) continue; // 北海道はブロック外
    if (!byBlockSchools.has(blockKey)) byBlockSchools.set(blockKey, new Set());

    const top6 = (res.ranking ?? []).slice(0, 6);
    for (const x of top6) byBlockSchools.get(blockKey).add(x.school);
  }

  const blockResults = {};
  for (const [blockKey, set] of byBlockSchools.entries()) {
    const schoolNames = Array.from(set.values());
    const schools = schoolNames
      .map(name => getWorldSchool(state, name))
      .filter(Boolean)
      .map(s => ({ ...schoolBaseFromWorld(s), isPlayer: s.name === state.teamName }));

    // ブロック駅伝は、プレイヤーは「本戦の枠で出場」するので main が手動 picks を渡す
    blockResults[blockKey] = runEkiden(state, blockKey, schools, [], { when, title: `${blockKey}ブロック駅伝` });
  }

  state.world.season.blockEkidenResults = blockResults;
  return blockResults;
}

// 全国駅伝：
// - 各都道府県の県駅伝優勝校は出場
// - さらに各ブロック駅伝で「県優勝していない学校の中で最上位」も出場
// - 北海道は県駅伝2位も出場（あなた指定）
// ※実装では全国出場校リストを作るだけにする（実行自体は main が runEkiden を呼ぶ）
export function buildNationalEkidenSchools(state) {
  ensureWorld(state);

  const prefWinners = state.world.season.prefEkidenWinners ?? {};
  const blockResults = state.world.season.blockEkidenResults ?? {};
  const otherPrefEkiden = state.world.season.otherPrefectureEkidenResults ?? {};
  const hyogoEkidenRes = state.world.season.hyogoPrefEkidenResult ?? null;

  const set = new Set();

  // 県駅伝優勝校
  for (const winner of Object.values(prefWinners)) if (winner) set.add(winner);

  // 北海道2位
  const hokkaidoRes = otherPrefEkiden["北海道"];
  if (hokkaidoRes) {
    const second = (hokkaidoRes.ranking ?? [])[1];
    if (second) set.add(second.school);
  }

  // ブロック最上位（県優勝していない学校の中で最上位）
  // → ブロック結果の順位順に見て、「その学校が所属県の県優勝校でない」もののうち最初を採用
  // 学校→県 は world.school.prefecture で引ける
  const schoolToPref = new Map((state.world.schools ?? []).map(s => [s.name, s.prefecture]));

  for (const [blockKey, res] of Object.entries(blockResults)) {
    const ranked = res.ranking ?? [];
    let picked = null;
    for (const x of ranked) {
      const pref = schoolToPref.get(x.school);
      if (!pref) continue;
      const winner = prefWinners[pref];
      if (winner && winner === x.school) continue; // すでに全国資格（県優勝）
      picked = x.school;
      break;
    }
    if (picked) set.add(picked);
  }

  const schoolNames = Array.from(set.values());
  const schools = schoolNames
    .map(name => getWorldSchool(state, name))
    .filter(Boolean)
    .map(s => ({ ...schoolBaseFromWorld(s), isPlayer: s.name === state.teamName }));

  return schools;
}

// 新人駅伝出場校（今年）を作る：兵庫Top10＋全国Top10（重複は兵庫を増やす）
export function buildNewcomerEkidenSchoolsFromSeason(state) {
  ensureWorld(state);

  const hy = state.world.season.lastHyogoEkidenTop10 ?? [];
  const na = state.world.season.lastNationalEkidenTop10 ?? [];

  // 兵庫Top10をまず入れる
  const out = [];
  const hyNames = hy.map(x => x.school);
  for (const x of hy) out.push(x.school);

  // 全国Top10から重複を除いて追加
  for (const x of na) {
    if (hyNames.includes(x.school)) continue;
    out.push(x.school);
  }

  // 「重複する場合は兵庫のほうを増やす」＝兵庫側の補欠を追加したいが、top10しか無いなら増やせない。
  // ここは main 側で top20 を保存する実装にして補欠追加できるようにするのが理想。
  // いったんは out の学校数が20未満でもOK（参加校が少ない年）として扱う。

  const unique = Array.from(new Set(out));
  const schools = unique
    .map(name => getWorldSchool(state, name))
    .filter(Boolean)
    .map(s => ({ ...schoolBaseFromWorld(s), isPlayer: s.name === state.teamName }));

  return schools;
}
