import { baseGainFromFacilityLevel, clamp1to100, randInt } from "./rules.js";
import { FAMILY_NAMES, GIVEN_NAMES } from "./data/names.js";

// グループごとの設備Lv（全練習共通）
const GROUP_FACILITY_LEVEL = {
  district: 1,
  prefecture: 2,
  region: 3,
  national: 4,
};

// グループごとの「能力加算」：2年/3年のみ適用、1年は0固定
const GROUP_ABILITY_BONUS = {
  district: 0,
  prefecture: 2,
  region: 4,
  national: 6,
};

function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function randomFullName() {
  return `${choice(FAMILY_NAMES)} ${choice(GIVEN_NAMES)}`;
}

// state.js と同じ分布（A案）
function sampleByRanges(ranges) {
  const r = Math.random() * 100;
  if (r < 45) return randInt(ranges[0][0], ranges[0][1]);
  if (r < 95) return randInt(ranges[1][0], ranges[1][1]);
  return randInt(ranges[2][0], ranges[2][1]);
}
function rangesByGrade(grade) {
  if (grade === 1) return [[1, 20], [21, 40], [41, 50]];
  if (grade === 2) return [[11, 30], [31, 50], [51, 60]];
  return [[21, 40], [41, 60], [61, 70]];
}

function makeAbilitiesByGrade(grade, bonusForUpperGrades) {
  const ranges = rangesByGrade(grade);

  const add = (grade === 2 || grade === 3) ? bonusForUpperGrades : 0;

  return {
    sprint: clamp1to100(sampleByRanges(ranges) + add),
    speed: clamp1to100(sampleByRanges(ranges) + add),
    stamina: clamp1to100(sampleByRanges(ranges) + add),
    toughness: clamp1to100(sampleByRanges(ranges) + add),
    technique: clamp1to100(sampleByRanges(ranges) + add),
  };
}

function makeAthlete(grade, bonusForUpperGrades) {
  return {
    name: randomFullName(),
    grade,
    abilities: makeAbilitiesByGrade(grade, bonusForUpperGrades),
  };
}

function makeSchool(groupKey, idx) {
  const athletes = [];
  const upperBonus = GROUP_ABILITY_BONUS[groupKey] ?? 0;

  // 5人×3学年=15人
  for (let i = 0; i < 5; i++) athletes.push(makeAthlete(1, upperBonus)); // 1年はbonus 0扱い
  for (let i = 0; i < 5; i++) athletes.push(makeAthlete(2, upperBonus));
  for (let i = 0; i < 5; i++) athletes.push(makeAthlete(3, upperBonus));

  const lv = GROUP_FACILITY_LEVEL[groupKey] ?? 1;
  return {
    name: `${groupKey}校${idx + 1}`,     // 高校名は後で差し替え想定
    groupKey,
    facilityLevel: lv,
    upperGradeBonus: upperBonus,         // デバッグ用（後で消してOK）
    athletes,
  };
}

export function ensureRivals(state) {
  if (state.rivals) return;

  state.rivals = {
    district: Array.from({ length: 20 }, (_, i) => makeSchool("district", i)),
    prefecture: Array.from({ length: 20 }, (_, i) => makeSchool("prefecture", i)),
    region: Array.from({ length: 20 }, (_, i) => makeSchool("region", i)),
    national: Array.from({ length: 20 }, (_, i) => makeSchool("national", i)),
  };
}

// 裏練習：各校の設備Lvで基礎上昇量を決め、ランダム能力を上げる（性格補正なし）
export function rivalsWeeklyTraining(state) {
  ensureRivals(state);

  const stats = ["sprint", "speed", "stamina", "toughness", "technique"];

  for (const groupKey of Object.keys(state.rivals)) {
    for (const school of state.rivals[groupKey]) {
      const lv = school.facilityLevel ?? 1;

      for (const a of school.athletes) {
        const stat = stats[randInt(0, stats.length - 1)];
        const base = baseGainFromFacilityLevel(lv); // 0.5 / 1 / 1.5
        a.abilities[stat] = clamp1to100(a.abilities[stat] + base);
      }
    }
  }
}

// 年度更新：相手校も同じルールで「各学年から」入れ替え（設備Lv/補正は保持）
export function rivalsYearUpdate(state) {
  ensureRivals(state);

  for (const groupKey of Object.keys(state.rivals)) {
    for (const school of state.rivals[groupKey]) {
      const upperBonus = GROUP_ABILITY_BONUS[groupKey] ?? 0;

      // 例：5人入れ替え（1年2人、2年2人、3年1人）
      for (let i = 0; i < 2; i++) school.athletes[i] = makeAthlete(1, upperBonus);
      for (let i = 5; i < 7; i++) school.athletes[i] = makeAthlete(2, upperBonus);
      school.athletes[10] = makeAthlete(3, upperBonus);
    }
  }
}
