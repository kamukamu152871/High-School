// 新人駅伝：兵庫県駅伝Top10 + 全国駅伝Top10（重複は兵庫側を増やす）
// - 3年生は選出不可（自校/他校）
// - 駅伝と同じ7区間
//
// main.js 側で「出場校schools」を組み立てて渡す設計。
// ただし、出場校の組み立てに必要な材料（top10）をこのモジュールに渡して作らせることも可能。

import { runEkiden } from "./meet_ekiden.js";

// hyogoTop10: [{school, schoolObj?}] 10件想定
// nationalTop10: [{school, schoolObj?}] 10件想定
// playerSchoolName: state.teamName
export function buildNewcomerEkidenSchools({ hyogoTop10, nationalTop10, playerSchoolName }) {
  const hy = (hyogoTop10 ?? []).map(x => x.school);
  const na = (nationalTop10 ?? []).map(x => x.school);

  // まず兵庫Top10を入れる
  const out = (hyogoTop10 ?? []).map(x => ({ school: x.school, schoolObj: x.schoolObj ?? null }));

  // 全国Top10を追加（重複はスキップ）
  for (const x of (nationalTop10 ?? [])) {
    if (hy.includes(x.school)) continue;
    out.push({ school: x.school, schoolObj: x.schoolObj ?? null });
  }

  // もし兵庫Top10と全国Top10の重複が多くて学校数が足りない場合：
  // 「重複する場合は兵庫のほうを増やす」＝兵庫側の補欠上位を追加、という意味に解釈する。
  // ただし材料がTop10までしか無い場合は増やしようがないので、main側でTop11以降も渡す設計にする。
  // 今は out が 20未満でもOK（参加校が少ない大会）として扱う。

  // 自校が参加校に含まれていなければ、後で main が isPlayer を差し込む。
  return out;
}

// 実行：schools は [{name,isPlayer,athletes}] の配列
// playerPicks: ekiden picker の結果
export function runNewcomerEkiden(state, schools, playerPicks) {
  // 3年生除外は runEkiden の options.excludeGrade3 を使う（相手校AIも除外）
  return runEkiden(state, "newcomer", schools, playerPicks, {
    type: "newcomer_ekiden",
    title: "新人駅伝",
    excludeGrade3: true,
  });
}