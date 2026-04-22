// 相手校・世界データ生成（全面刷新）
// - src/data/schools.js を唯一の編集点にする
// - 各学校は { name, level(1..4), prefecture, districtKey?, districtName? } を保持
// - 学校ごとに athletes(15人=各学年5人) を保持
//
// 選手生成仕様（あなた指定）
// - 学校レベル(1..4) -> 生成される「選手レベル帯(1..8)」が変わる
//   Lv1校: 選手Lv {1,2}
//   Lv2校: 選手Lv {3,4}
//   Lv3校: 選手Lv {5,6}
//   Lv4校: 選手Lv {7,8}
// - 選手Lv -> 能力値の生成範囲が変わる（下記参照）
// - 進級で全能力 +10（上限110）
// - 3年引退 -> 2->3, 1->2, 新1年(5人)追加

import { FAMILY_NAMES, GIVEN_NAMES } from "./data/names.js";
import { clamp1to110, recalcOverall } from "./rules.js";
import {
  allSchoolsJapan,
} from "./data/schools.js";

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function createRandomName() {
  return `${choice(FAMILY_NAMES)} ${choice(GIVEN_NAMES)}`;
}

function createPersonality() {
  // state.js と同じ：てんさい4%、他は各16%
  const r = Math.random() * 100;
  if (r < 16) return "たんき";
  if (r < 32) return "せっかち";
  if (r < 48) return "おおらか";
  if (r < 64) return "がんこ";
  if (r < 80) return "きよう";
  if (r < 96) return "ふつう";
  return "てんさい";
}

const ATHLETE_LEVEL_RANGE_G3 = {
  1: { min: 21, max: 30 },
  2: { min: 31, max: 40 },
  3: { min: 41, max: 50 },
  4: { min: 51, max: 60 },
  5: { min: 61, max: 70 },
  6: { min: 71, max: 80 },
  7: { min: 81, max: 90 },
  8: { min: 91, max: 100 },
};

function athleteLevelsBySchoolLevel(schoolLevel) {
  if (schoolLevel === 1) return [1, 2];
  if (schoolLevel === 2) return [3, 4];
  if (schoolLevel === 3) return [5, 6];
  return [7, 8]; // level 4
}

function sampleAthleteLevelForSchool(schoolLevel) {
  const pool = athleteLevelsBySchoolLevel(schoolLevel);
  return choice(pool);
}

function gradeOffset(grade) {
  if (grade === 3) return 0;
  if (grade === 2) return -10;
  return -20;
}

function createAbilitiesForRival(grade, schoolLevel) {
  const aLv = sampleAthleteLevelForSchool(schoolLevel);
  const base = ATHLETE_LEVEL_RANGE_G3[aLv];
  const off = gradeOffset(grade);

  const one = () => clamp1to110(randInt(base.min, base.max) + off);

  return {
    sprint: one(),
    speed: one(),
    stamina: one(),
    toughness: one(),
    technique: one(),
  };
}

function createRivalAthlete(grade, index, schoolLevel) {
  const abilities = createAbilitiesForRival(grade, schoolLevel);
  const a = {
    id: `r-${grade}-${index}-${crypto.randomUUID?.() ?? Math.random()}`,
    grade,
    name: createRandomName(),
    personality: createPersonality(),
    abilities,
    overall: 0,
  };
  recalcOverall(a);
  return a;
}

function createRivalSchoolRoster(schoolLevel) {
  const athletes = [];
  for (let i = 0; i < 5; i++) athletes.push(createRivalAthlete(1, i, schoolLevel));
  for (let i = 0; i < 5; i++) athletes.push(createRivalAthlete(2, i, schoolLevel));
  for (let i = 0; i < 5; i++) athletes.push(createRivalAthlete(3, i, schoolLevel));
  return athletes;
}

function snapshotSchoolBase(s) {
  // schools.js から来る構造をそのまま保持しつつ、ゲーム内で必要なフィールドを安定化
  return {
    name: s.name,
    level: s.level,
    prefecture: s.prefecture ?? "",
    districtKey: s.districtKey ?? null,
    districtName: s.districtName ?? null,
  };
}

// state.world.schools: Map相当を配列で保持（localStorage保存しやすい）
function buildWorldSchools() {
  const schools = allSchoolsJapan().map(s => ({
    ...snapshotSchoolBase(s),
    athletes: createRivalSchoolRoster(s.level),
  }));
  return schools;
}

// 互換：旧 main.js が state.rivals を参照しているため、最低限のダミーも作る。
// （次の main.js 完全版で撤去/置換する）
function buildLegacyRivalsStub(worldSchools) {
  // 旧仕様の district/prefecture/region/national はここでは「適当」に入れておく（崩壊回避用）
  // 本実装は main.js/meet_* 側で state.world を使うように作り替える。
  const hyogo = worldSchools.filter(s => s.prefecture === "兵庫");
  const kobe = hyogo.filter(s => s.districtKey === "kobe");
  return {
    district: kobe.map(s => ({ name: s.name, athletes: s.athletes, facilityLevel: 1, groupKey: "kobe" })),
    prefecture: hyogo.map(s => ({ name: s.name, athletes: s.athletes, facilityLevel: 1, groupKey: "hyogo" })),
    region: [],   // 近畿は後で main/meet で完全再現
    national: [], // 後で
    newcomer: [],
  };
}

export function ensureRivals(state) {
  // 新世界データ
  state.world ??= {};
  state.world.schools ??= null;

  if (!state.world.schools || !Array.isArray(state.world.schools) || state.world.schools.length === 0) {
    state.world.schools = buildWorldSchools();
  }

  // 旧互換
  state.rivals ??= buildLegacyRivalsStub(state.world.schools);
}

export function rivalsWeeklyTraining(state) {
  // 相手校の選手は「年度更新（進級）時に一律 +10」だけ成長する仕様。
  // 毎週の成長処理は行わない（呼ばれても無影響）。
  ensureRivals(state);
}

// 年度更新：相手校
export function rivalsYearUpdate(state) {
  ensureRivals(state);

  for (const s of state.world.schools) {
    // 3年引退
    const survivors = (s.athletes ?? []).filter(a => a.grade !== 3);

    // 進級（能力+10）
    for (const a of survivors) {
      a.grade += 1;
      a.abilities.sprint = clamp1to110(a.abilities.sprint + 10);
      a.abilities.speed = clamp1to110(a.abilities.speed + 10);
      a.abilities.stamina = clamp1to110(a.abilities.stamina + 10);
      a.abilities.toughness = clamp1to110(a.abilities.toughness + 10);
      a.abilities.technique = clamp1to110(a.abilities.technique + 10);
      recalcOverall(a);
    }

    // 新1年 5人
    const freshmen = [];
    for (let i = 0; i < 5; i++) freshmen.push(createRivalAthlete(1, i, s.level));

    s.athletes = freshmen.concat(survivors);
  }

  // 旧互換stubも更新しておく
  state.rivals = buildLegacyRivalsStub(state.world.schools);
}
