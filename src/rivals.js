import { baseGainFromFacilityLevel, clamp1to100, randInt } from "./rules.js";

// グループごとの設備Lv（全練習共通で同Lv）
const GROUP_FACILITY_LEVEL = {
  district: 1,
  prefecture: 2,
  region: 3,
  national: 4,
};

// 能力レンジ（今回は補正なしで同一レンジ。後で調整）
const BASE_RANGE = { min: 30, max: 80 };

function makeAthlete() {
  const { min, max } = BASE_RANGE;
  return {
    name: "相手選手",
    abilities: {
      sprint: randInt(min, max),
      speed: randInt(min, max),
      stamina: randInt(min, max),
      toughness: randInt(min, max),
      technique: randInt(min, max),
    },
  };
}

function makeSchool(groupKey, idx) {
  const athletes = [];
  for (let i = 0; i < 15; i++) athletes.push(makeAthlete());

  const lv = GROUP_FACILITY_LEVEL[groupKey] ?? 1;
  return {
    name: `${groupKey}校${idx + 1}`,
    facilityLevel: lv, // 学校としての設備Lv（全練習共通）
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
        const base = baseGainFromFacilityLevel(lv); // 0.5 / 1 / 1.5 を含む
        a.abilities[stat] = clamp1to100(a.abilities[stat] + base);
      }
    }
  }
}

// 年度更新：簡略で5人入れ替え（設備Lvは保持）
export function rivalsYearUpdate(state) {
  ensureRivals(state);
  for (const groupKey of Object.keys(state.rivals)) {
    for (const school of state.rivals[groupKey]) {
      for (let i = 0; i < 5; i++) school.athletes[i] = makeAthlete();
    }
  }
}
