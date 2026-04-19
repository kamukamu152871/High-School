import { clamp1to110, randInt } from "./rules.js";
import { FAMILY_NAMES, GIVEN_NAMES } from "./data/names.js";
import {
  DISTRICT_SCHOOLS,
  PREFECTURE_SCHOOLS,
  REGION_SCHOOLS,
  NATIONAL_SCHOOLS,
} from "./data/schools.js";

// 3年生（基準）のレベル別レンジ（案B）
// ※レベル5追加は保留
const LEVEL_ABILITY_RANGE_G3 = {
  1: { min: 21, max: 45 },
  2: { min: 41, max: 65 },
  3: { min: 61, max: 85 },
  4: { min: 81, max: 95 },
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

function gradeOffset(grade) {
  if (grade === 3) return 0;
  if (grade === 2) return -10;
  return -20;
}

function makeAbilitiesByLevelAndGrade(level, grade) {
  const base = LEVEL_ABILITY_RANGE_G3[level] ?? LEVEL_ABILITY_RANGE_G3[1];
  const off = gradeOffset(grade);
  const min = base.min + off;
  const max = base.max + off;

  return {
    sprint: clamp1to110(randInt(min, max)),
    speed: clamp1to110(randInt(min, max)),
    stamina: clamp1to110(randInt(min, max)),
    toughness: clamp1to110(randInt(min, max)),
    technique: clamp1to110(randInt(min, max)),
  };
}

function makeAthlete(level, grade) {
  return {
    name: randomFullName(),
    grade,
    abilities: makeAbilitiesByLevelAndGrade(level, grade),
  };
}

function makeSchool(groupKey, idx) {
  const defs = schoolDefsByGroup(groupKey);
  const def = defs?.[idx];

  const name = def?.name ?? `${groupKey}校${idx + 1}`;
  const level = def?.level ?? 1;

  const athletes = [];
  // 各学年5人＝計15人
  for (let i = 0; i < 5; i++) athletes.push(makeAthlete(level, 1));
  for (let i = 0; i < 5; i++) athletes.push(makeAthlete(level, 2));
  for (let i = 0; i < 5; i++) athletes.push(makeAthlete(level, 3));

  return {
    name,
    groupKey,              // 大会参加の群
    level,                 // 強さ（能力レンジ/設備Lvの基準）
    facilityLevel: level,  // 設備Lvもlevelと同じ
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

// 週の裏成長は無し（進級時だけ+10で成長）
export function rivalsWeeklyTraining(state) {
  ensureRivals(state);
}

function add10AllAbilities(a) {
  a.abilities.sprint = clamp1to110((a.abilities.sprint ?? 0) + 10);
  a.abilities.speed = clamp1to110((a.abilities.speed ?? 0) + 10);
  a.abilities.stamina = clamp1to110((a.abilities.stamina ?? 0) + 10);
  a.abilities.toughness = clamp1to110((a.abilities.toughness ?? 0) + 10);
  a.abilities.technique = clamp1to110((a.abilities.technique ?? 0) + 10);
}

// 年度更新：3年引退→進級（能力+10）→新1年生生成
export function rivalsYearUpdate(state) {
  ensureRivals(state);

  for (const groupKey of Object.keys(state.rivals)) {
    for (const school of state.rivals[groupKey]) {
      const level = school.level ?? 1;

      const current = (school.athletes ?? []).slice();

      const g1 = current.filter(x => x.grade === 1);
      const g2 = current.filter(x => x.grade === 2);
      const g3 = current.filter(x => x.grade === 3);

      // 3年は引退（捨てる）
      void (g3);

      // 2年→3年（+10）
      const nextG3 = g2.slice(0, 5).map(a => {
        const b = { ...a, grade: 3, abilities: { ...(a.abilities ?? {}) } };
        add10AllAbilities(b);
        return b;
      });

      // 1年→2年（+10）
      const nextG2 = g1.slice(0, 5).map(a => {
        const b = { ...a, grade: 2, abilities: { ...(a.abilities ?? {}) } };
        add10AllAbilities(b);
        return b;
      });

      // 新1年 5人（レンジ生成）
      const nextG1 = Array.from({ length: 5 }, () => makeAthlete(level, 1));

      // 1年→2年→3年の順で格納
      school.athletes = nextG1.concat(nextG2, nextG3);
    }
  }
}
