import { clamp1to100, randInt } from "./rules.js";
import { FAMILY_NAMES, GIVEN_NAMES } from "./data/names.js";
import {
  DISTRICT_SCHOOLS,
  PREFECTURE_SCHOOLS,
  REGION_SCHOOLS,
  NATIONAL_SCHOOLS,
} from "./data/schools.js";

// levelごとの固定能力レンジ（群とは独立）
const LEVEL_ABILITY_RANGE = {
  1: { min: 21, max: 50 },
  2: { min: 41, max: 70 },
  3: { min: 61, max: 90 },
  4: { min: 81, max: 100 },
};

function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function randomFullName() {
  return `${choice(FAMILY_NAMES)} ${choice(GIVEN_NAMES)}`;
}

// groupKeyごとに schools.js の定義リストを返す
function schoolDefsByGroup(groupKey) {
  if (groupKey === "district") return DISTRICT_SCHOOLS;
  if (groupKey === "prefecture") return PREFECTURE_SCHOOLS;
  if (groupKey === "region") return REGION_SCHOOLS;
  return NATIONAL_SCHOOLS;
}

function makeAbilitiesByLevel(level) {
  const r = LEVEL_ABILITY_RANGE[level] ?? LEVEL_ABILITY_RANGE[1];
  return {
    sprint: clamp1to100(randInt(r.min, r.max)),
    speed: clamp1to100(randInt(r.min, r.max)),
    stamina: clamp1to100(randInt(r.min, r.max)),
    toughness: clamp1to100(randInt(r.min, r.max)),
    technique: clamp1to100(randInt(r.min, r.max)),
  };
}

function makeAthlete(level, grade) {
  return {
    name: randomFullName(),
    grade,
    abilities: makeAbilitiesByLevel(level),
  };
}

function makeSchool(groupKey, idx) {
  const defs = schoolDefsByGroup(groupKey);
  const def = defs?.[idx];

  const name = def?.name ?? `${groupKey}校${idx + 1}`;
  const level = def?.level ?? 1;

  const athletes = [];
  // 5人×3学年=15人（学年は表示用。能力はlevel固定レンジ）
  for (let i = 0; i < 5; i++) athletes.push(makeAthlete(level, 1));
  for (let i = 0; i < 5; i++) athletes.push(makeAthlete(level, 2));
  for (let i = 0; i < 5; i++) athletes.push(makeAthlete(level, 3));

  return {
    name,
    groupKey,           // 大会参加の群
    level,              // 強さ（能力レンジ/設備Lvの基準）
    facilityLevel: level, // ★YES：設備Lvもlevelと同じ
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

// ★固定能力にするので何もしない（裏成長なし）
export function rivalsWeeklyTraining(state) {
  ensureRivals(state);
}

// 年度更新：入れ替えはするがレベルレンジは固定（裏成長なし）
export function rivalsYearUpdate(state) {
  ensureRivals(state);
  for (const groupKey of Object.keys(state.rivals)) {
    for (const school of state.rivals[groupKey]) {
      const level = school.level ?? 1;

      // 例：5人入れ替え（1年2人、2年2人、3年1人）
      for (let i = 0; i < 2; i++) school.athletes[i] = makeAthlete(level, 1);
      for (let i = 5; i < 7; i++) school.athletes[i] = makeAthlete(level, 2);
      school.athletes[10] = makeAthlete(level, 3);
    }
  }
}
