import { randInt } from "./rules.js";

// 重要：地区/県/地域/全国で能力補正しない（後で調整）
// → 全群同じ能力レンジに統一
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

// 年度更新：相手校も簡略で5人入れ替え
export function rivalsYearUpdate(state) {
  ensureRivals(state);
  for (const groupKey of Object.keys(state.rivals)) {
    for (const school of state.rivals[groupKey]) {
      for (let i = 0; i < 5; i++) school.athletes[i] = makeAthlete();
    }
  }
}
