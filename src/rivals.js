import { baseGainFromFacilityLevel, clamp1to100, randInt } from "./rules.js";

// グループごとの設備Lv（全練習共通で同Lv）
const GROUP_FACILITY_LEVEL = {
  district: 1,
  prefecture: 2,
  region: 3,
  national: 4,
};

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
function makeAbilitiesByGrade(grade) {
  const ranges = rangesByGrade(grade);
  return {
    sprint: sampleByRanges(ranges),
    speed: sampleByRanges(ranges),
    stamina: sampleByRanges(ranges),
    toughness: sampleByRanges(ranges),
    technique: sampleByRanges(ranges),
  };
}

function makeAthlete(grade) {
  return {
    name: "相手選手",
    grade,
    abilities: makeAbilitiesByGrade(grade),
  };
}

function makeSchool(groupKey, idx) {
  const athletes = [];
  // 5人×3学年=15人
  for (let i = 0; i < 5; i++) athletes.push(makeAthlete(1));
  for (let i = 0; i < 5; i++) athletes.push(makeAthlete(2));
  for (let i = 0; i < 5; i++) athletes.push(makeAthlete(3));

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

// 年度更新：相手校も学年構成を保ったまま入れ替え（設備Lvは保持）
export function rivalsYearUpdate(state) {
  ensureRivals(state);
  for (const groupKey of Object.keys(state.rivals)) {
    for (const school of state.rivals[groupKey]) {
      // 各学年から数名ずつ入れ替える（合計5人）
      for (let i = 0; i < 2; i++) school.athletes[i] = makeAthlete(1);
      for (let i = 5; i < 7; i++) school.athletes[i] = makeAthlete(2);
      school.athletes[10] = makeAthlete(3);
    }
  }
}
