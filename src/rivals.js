import { clamp1to100, randInt } from "./rules.js";
import { FAMILY_NAMES, GIVEN_NAMES } from "./data/names.js";
import {
  DISTRICT_SCHOOLS,
  PREFECTURE_SCHOOLS,
  REGION_SCHOOLS,
  NATIONAL_SCHOOLS,
} from "./data/schools.js";

// グループごとの設備Lv（※固定能力にするので、いったん保持のみ）
const GROUP_FACILITY_LEVEL = {
  district: 1,
  prefecture: 2,
  region: 3,
  national: 4,
};

// グループごとの固定能力レンジ
const GROUP_ABILITY_RANGE = {
  district: { min: 21, max: 50 },
  prefecture: { min: 41, max: 70 },
  region: { min: 61, max: 90 },
  national: { min: 81, max: 100 },
};

function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function randomFullName() {
  return `${choice(FAMILY_NAMES)} ${choice(GIVEN_NAMES)}`;
}

function schoolNameListByGroup(groupKey) {
  if (groupKey === "district") return DISTRICT_SCHOOLS;
  if (groupKey === "prefecture") return PREFECTURE_SCHOOLS;
  if (groupKey === "region") return REGION_SCHOOLS;
  return NATIONAL_SCHOOLS;
}

function makeAbilitiesByGroup(groupKey) {
  const r = GROUP_ABILITY_RANGE[groupKey] ?? GROUP_ABILITY_RANGE.district;
  return {
    sprint: clamp1to100(randInt(r.min, r.max)),
    speed: clamp1to100(randInt(r.min, r.max)),
    stamina: clamp1to100(randInt(r.min, r.max)),
    toughness: clamp1to100(randInt(r.min, r.max)),
    technique: clamp1to100(randInt(r.min, r.max)),
  };
}

function makeAthlete(groupKey, grade) {
  return {
    name: randomFullName(),
    grade,
    abilities: makeAbilitiesByGroup(groupKey),
  };
}

function makeSchool(groupKey, idx) {
  const athletes = [];
  // 5人×3学年=15人（学年は表示用。能力はグループ固定レンジ）
  for (let i = 0; i < 5; i++) athletes.push(makeAthlete(groupKey, 1));
  for (let i = 0; i < 5; i++) athletes.push(makeAthlete(groupKey, 2));
  for (let i = 0; i < 5; i++) athletes.push(makeAthlete(groupKey, 3));

  const lv = GROUP_FACILITY_LEVEL[groupKey] ?? 1;
  const list = schoolNameListByGroup(groupKey);

  return {
    name: list?.[idx] ?? `${groupKey}校${idx + 1}`,
    groupKey,
    facilityLevel: lv,
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

// 年度更新：入れ替えはするがレンジは固定（裏成長なし）
export function rivalsYearUpdate(state) {
  ensureRivals(state);
  for (const groupKey of Object.keys(state.rivals)) {
    for (const school of state.rivals[groupKey]) {
      // 例：5人入れ替え（1年2人、2年2人、3年1人）
      for (let i = 0; i < 2; i++) school.athletes[i] = makeAthlete(groupKey, 1);
      for (let i = 5; i < 7; i++) school.athletes[i] = makeAthlete(groupKey, 2);
      school.athletes[10] = makeAthlete(groupKey, 3);
    }
  }
}
