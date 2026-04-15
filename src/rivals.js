import { randInt } from "./rules.js";

// 強さ群：地区<県<地域<全国（能力レンジ）
const GROUP_POWER = {
  district: { min: 25, max: 65 },
  prefecture: { min: 35, max: 75 },
  region: { min: 45, max: 85 },
  national: { min: 55, max: 95 },
};

function makeAthlete(min, max) {
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
  const { min, max } = GROUP_POWER[groupKey];
  const athletes = [];
  for (let i = 0; i < 15; i++) athletes.push(makeAthlete(min, max));
  return { name: `${groupKey}校${idx + 1}`, athletes };
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

// 裏練習：各群の全選手が毎週ランダムに1能力だけ+1〜+3（簡略）
export function rivalsWeeklyTraining(state) {
  ensureRivals(state);

  const stats = ["sprint", "speed", "stamina", "toughness", "technique"];

  for (const groupKey of Object.keys(state.rivals)) {
    for (const school of state.rivals[groupKey]) {
      for (const a of school.athletes) {
        const stat = stats[randInt(0, stats.length - 1)];
        a.abilities[stat] = Math.max(1, Math.min(100, a.abilities[stat] + randInt(1, 3)));
      }
    }
  }
}

// 年度更新：相手校も同じ「入れ替わり」を簡略で実施（3年引退→新入生補充）
export function rivalsYearUpdate(state) {
  ensureRivals(state);

  for (const groupKey of Object.keys(state.rivals)) {
    for (const school of state.rivals[groupKey]) {
      // 簡略：15人のうち5人を入れ替え（新入生）
      const { min, max } = GROUP_POWER[groupKey];
      for (let i = 0; i < 5; i++) {
        school.athletes[i] = makeAthlete(min, max);
      }
    }
  }
}
