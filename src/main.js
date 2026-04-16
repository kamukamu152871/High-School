import {
  createNewGameState,
  saveGame,
  loadGame,
  clearSave,
  applyYearUpdateToState,
} from "./state.js";

import { TRAININGS, applyTraining } from "./rules.js";
import { ensureRivals, rivalsWeeklyTraining, rivalsYearUpdate } from "./rivals.js";
import { renderPicker } from "./ui_pick.js";

import { runRecordMeet } from "./meet_record.js";
import { runSoutai } from "./meet_soutai.js";
import { runEkiden } from "./meet_ekiden.js";

const app = document.querySelector("#app");

// --- スケジュール（練習後に大会） ---
function getMeetOfWeek(state) {
  if (state.month === 4 && state.week === 4) return { type: "record" };
  if (state.month === 9 && state.week === 3) return { type: "record" };
  if (state.month === 3 && state.week === 3) return { type: "record" };

  if (state.month === 5 && state.week === 1) return { type: "soutai", stage: "district" };
  if (state.month === 5 && state.week === 4) return { type: "soutai", stage: "prefecture" };
  if (state.month === 6 && state.week === 3) return { type: "soutai", stage: "region" };
  if (state.month === 7 && state.week === 4) return { type: "soutai", stage: "national" };

  if (state.month === 10 && state.week === 2) return { type: "ekiden", stage: "district" };
  if (state.month === 10 && state.week === 4) return { type: "ekiden", stage: "prefecture" };
  if (state.month === 11 && state.week === 2) return { type: "ekiden", stage: "region" };
  if (state.month === 12 && state.week === 3) return { type: "ekiden", stage: "national" };

  return null;
}

function isYearUpdateWeek(state) {
  return state.month === 3 && state.week === 4;
}

function advanceWeek(state) {
  state.week += 1;
  if (state.week > 4) {
    state.week = 1;
    state.month += 1;
    if (state.month > 12) state.month = 1;
  }
}

// --- qualify（旧：通過管理）初期化/救済 ---
function ensureQualify(state) {
  state.qualify ??= {
    soutai: { prefecturePairs: [], regionPairs: [], nationalPairs: [] },
    ekiden: { prefecture: false, region: false, national: false },
  };

  if (state.qualify.soutai && ("prefecture" in state.qualify.soutai)) {
    state.qualify = {
      soutai: { prefecturePairs: [], regionPairs: [], nationalPairs: [] },
      ekiden: state.qualify.ekiden ?? { prefecture: false, region: false, national: false },
    };
  }
}

function ensureFacilities(state) {
  state.facilities ??= { nagashi: 1, tt: 1, jog: 1, interval: 1, circuit: 1 };
}

function ensureCarry(state) {
  state.carry ??= { soutai: { next: [] }, ekiden: { next: [] } };
  state.carry.soutai ??= { next: [] };
  state.carry.ekiden ??= { next: [] };
  state.carry.soutai.next ??= [];
  state.carry.ekiden.next ??= [];
}

function getAllowedSoutaiPairsForStage(state, stage) {
  // 旧仕様を一旦温存（現状は picker が参照している）
  ensureQualify(state);
  if (stage === "district") return null;
  if (stage === "prefecture") return state.qualify.soutai.prefecturePairs;
  if (stage === "region") return state.qualify.soutai.regionPairs;
  if (stage === "national") return state.qualify.soutai.nationalPairs;
  return null;
}

function pairsToEvents(pairs) {
  if (!pairs) return null;
  const set = new Set(pairs.map(p => p.event));
  return Array.from(set);
}

// ---- carry を次大会の rivals に混ぜ込む（総体：混成校、駅伝：追加校） ----
function buildSoutaiRivalsWithCarry(state, stageKey) {
  ensureRivals(state);
  ensureCarry(state);

  const base = (state.rivals?.[stageKey] ?? []).slice();

  // carryは「次のステージ宛」のものだけ混ぜる
  const carry = (state.carry.soutai.next ?? []).filter(x => x.toStage === stageKey);
  if (carry.length === 0) return base;

  // 種目ごと上位に入った“選手”をまとめて混成校にする
  const mixed = {
    name: "持ち越し選手枠",
    facilityLevel: 1,
    groupKey: "carry",
    athletes: carry.map(x => x.athlete),
  };

  return base.concat([mixed]);
}

function buildEkidenRivalsWithCarry(state, stageKey) {
  ensureRivals(state);
  ensureCarry(state);

  const base = (state.rivals?.[stageKey] ?? []).slice();

  const carry = (state.carry.ekiden.next ?? []).filter(x => x.toStage === stageKey);
  if (carry.length === 0) return base;

  // carry校は「名前一致」で base に既に存在する可能性があるので重複除外
  const baseNames = new Set(base.map(s => s.name));
  const add = carry
    .map(x => x.schoolName)
    .filter(n => !baseNames.has(n))
    .map((n, i) => ({
      name: n,
      facilityLevel: 1,
      groupKey: "carry_ekiden",
      athletes: [], // 駅伝は recommendEkidenPicks が athletes を使うので、本来は学校実体が必要
    }));

  // 注意：ここは「学校実体」が必要なので、次の段階で改善します。
  // 今回は“carryが保存される”ところまでを目的にし、合成は次回完成させます。
  return base.concat(add);
}

// --- 画面 ---
function renderTitle() {
  const hasSave = !!loadGame();

  app.innerHTML = `
    <div class="card">
      <h2>タイトル</h2>
      <div class="row">
        <button id="new">ゲームスタート</button>
        <button id="cont" ${hasSave ? "" : "disabled"}>つづきから</button>
        <button class="secondary" id="reset" ${hasSave ? "" : "disabled"}>セーブ削除</button>
      </div>
      <p style="margin-top:12px;color:#555;">端末内（ブラウザ）に自動でセーブされます。</p>
      <p style="margin-top:8px;color:#b00;">※大きく仕様変更したので、最初は「セーブ削除」を推奨します。</p>
    </div>
  `;

  document.querySelector("#new").onclick = () => {
    const state = createNewGameState();
    ensureRivals(state);
    ensureQualify(state);
    ensureFacilities(state);
    ensureCarry(state);
    saveGame(state);
    renderHome(state);
  };

  document.querySelector("#cont").onclick = () => {
    const state = loadGame();
    if (state) {
      ensureRivals(state);
      ensureQualify(state);
      ensureFacilities(state);
      ensureCarry(state);
      saveGame(state);
      renderHome(state);
    }
  };

  document.querySelector("#reset").onclick = () => {
    clearSave();
    renderTitle();
  };
}

function renderHome(state) {
  const meet = getMeetOfWeek(state);

  const meetText = meet
    ? meet.type === "record"
      ? "この週は【記録会】（練習後に出場選出→実行）"
      : meet.type === "soutai"
        ? `この週は【${stageTitleSoutai(meet.stage)}】（練習後に出場選出→実行）`
        : `この週は【${stageTitleEkiden(meet.stage)}】（練習後に出場選出→実行）`
    : "この週は大会なし";

  const yearText = isYearUpdateWeek(state)
    ? "この週の最後に【年度更新（引退/進級/新入生）】があります"
    : "";

  const trainingButtons = TRAININGS.map(t => `<button data-tr="${t.id}">${t.name}</button>`).join("");

  app.innerHTML = `
    <div class="card">
      <h2>ホーム</h2>
      <p>年：${state.year} / ${state.month}月 ${state.week}週</p>
      <p style="color:#555;">${meetText}</p>
      ${yearText ? `<p style="color:#b00;">${yearText}</p>` : ""}
      <p style="color:#555;">今週の練習：${state.lastTraining?.name ?? "未実施"}</p>

      <h3 style="margin-top:14px;">練習（タップで実行→大会があれば選出→次週へ）</h3>
      <div class="row">${trainingButtons}</div>

      <div class="row" style="margin-top:12px;">
        <button id="athletes">選手</button>
        <button id="facilities">設備</button>
        <button class="secondary" id="back">タイトルへ</button>
      </div>
    </div>
  `;

  document.querySelector("#athletes").onclick = () => renderAthletes(state);
  document.querySelector("#facilities").onclick = () => renderFacilities(state);
  document.querySelector("#back").onclick = () => renderTitle();

  app.querySelectorAll("button[data-tr]").forEach(b => {
    b.onclick = async () => {
      const id = b.getAttribute("data-tr");

      ensureRivals(state);
      ensureQualify(state);
      ensureFacilities(state);
      ensureCarry(state);

      rivalsWeeklyTraining(state);   // 今は固定能力なので実質noop
      applyTraining(state, id);

      const meet = getMeetOfWeek(state);
      saveGame(state);

      if (!meet) {
        goNextWeek(state);
        return;
      }

      if (meet.type === "record") {
        renderPicker(app, "record", state, {
          onCancel: () => renderHome(state),
          onConfirm: (picks) => {
            const result = runRecordMeet(state, picks);
            saveGame(state);
            renderRecordResult(state, result);
          }
        });
        return;
      }

      if (meet.type === "soutai") {
        // carry混ぜ込み（この大会のステージに宛てられた carry を追加）
        const original = state.rivals?.[meet.stage];
        const mixed = buildSoutaiRivalsWithCarry(state, meet.stage);
        state.rivals[meet.stage] = mixed;

        const allowedPairs = getAllowedSoutaiPairsForStage(state, meet.stage);
        const allowedEvents = pairsToEvents(allowedPairs);

        renderPicker(app, "soutai", state, {
          allowedEvents,
          allowedPairs,
          onCancel: () => {
            state.rivals[meet.stage] = original;
            renderHome(state);
          },
          onConfirm: (picks) => {
            const result = runSoutai(state, meet.stage, picks, allowedEvents);

            // ★新：carry保存（次大会へ混ぜる“選手”）
            state.carry.soutai.next = result.carryCandidates ?? [];

            // 旧：通過管理も一旦残す
            saveSoutaiQualificationPairs(state, meet.stage, result);

            // 元に戻す
            state.rivals[meet.stage] = original;

            saveGame(state);
            renderSoutaiResult(state, result);
          }
        });
        return;
      }

      if (meet.type === "ekiden") {
        renderPicker(app, "ekiden", state, {
          onCancel: () => renderHome(state),
          onConfirm: (picks) => {
            const result = runEkiden(state, meet.stage, picks);

            // ★新：carry保存（次大会へ混ぜる“高校”）
            state.carry.ekiden.next = result.top5Teams ?? [];

            // 旧：自校通過フラグも一旦残す
            saveEkidenQualification(state, meet.stage, result);

            saveGame(state);
            renderEkidenResult(state, result);
          }
        });
        return;
      }
    };
  });
}

function goNextWeek(state) {
  if (isYearUpdateWeek(state)) runYearUpdate(state);
  advanceWeek(state);
  state.lastTraining = null;
  saveGame(state);
  renderHome(state);
}

function renderFacilities(state) {
  ensureFacilities(state);
  const f = state.facilities;

  app.innerHTML = `
    <div class="card">
      <h2>練習設備レベル</h2>
      <table style="width:100%; border-collapse:collapse;">
        <tbody>
          <tr><td>流し</td><td>Lv ${f.nagashi}</td></tr>
          <tr><td>TT</td><td>Lv ${f.tt}</td></tr>
          <tr><td>ジョグ</td><td>Lv ${f.jog}</td></tr>
          <tr><td>インターバル</td><td>Lv ${f.interval}</td></tr>
          <tr><td>サーキット</td><td>Lv ${f.circuit}</td></tr>
        </tbody>
      </table>
      <div class="row" style="margin-top:12px;">
        <button class="secondary" id="home">戻る</button>
      </div>
    </div>
  `;
  document.querySelector("#home").onclick = () => renderHome(state);
}

function renderAthletes(state) {
  const f = (n) => Math.floor(n);

  const rows = (state.athletes ?? []).map(a => `
    <tr>
      <td>${a.grade}</td>
      <td>${a.name}</td>
      <td>${a.personality}</td>
      <td>${f(a.abilities.sprint)}</td>
      <td>${f(a.abilities.speed)}</td>
      <td>${f(a.abilities.stamina)}</td>
      <td>${f(a.abilities.toughness)}</td>
      <td>${f(a.abilities.technique)}</td>
      <td>${f(a.overall)}</td>
    </tr>
  `).join("");

  app.innerHTML = `
    <div class="card">
      <h2>選手</h2>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:700px;">
          <thead>
            <tr>
              <th>学年</th><th>名前</th><th>性格</th>
              <th>SP</th><th>SPD</th><th>STA</th><th>TUF</th><th>TEC</th>
              <th>総合</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="row" style="margin-top:12px;">
        <button class="secondary" id="home">戻る</button>
      </div>
    </div>
  `;
  document.querySelector("#home").onclick = () => renderHome(state);
}

// --- 条件（旧：通過管理） ---
function saveSoutaiQualificationPairs(state, stage, result) {
  ensureQualify(state);
  const pairs = result.qualifiedPairs ?? [];
  if (stage === "district") state.qualify.soutai.prefecturePairs = pairs;
  if (stage === "prefecture") state.qualify.soutai.regionPairs = pairs;
  if (stage === "region") state.qualify.soutai.nationalPairs = pairs;
}

function saveEkidenQualification(state, stage, result) {
  ensureQualify(state);
  if (stage === "district") state.qualify.ekiden.prefecture = !!result.cleared;
  if (stage === "prefecture") state.qualify.ekiden.region = !!result.cleared;
  if (stage === "region") state.qualify.ekiden.national = !!result.cleared;
}

// --- 設備アップ：総体の「優勝」で段階的に上げる ---
function upgradeFacilityBySoutaiWinners(state, result) {
  const targetLv =
    result.stage === "district" ? 2 :
    result.stage === "prefecture" ? 3 :
    result.stage === "region" ? 4 : null;

  if (!targetLv) return;

  ensureFacilities(state);

  const map = {
    "800": "nagashi",
    "1500": "tt",
    "3000sc": "circuit",
    "5000": "jog",
    "5000w": "interval",
  };

  for (const [ev, facilityKey] of Object.entries(map)) {
    const er = result.events?.[ev];
    if (!er) continue;

    const list = er.type === "withFinal" ? er.final : er.overall;
    if (!list || list.length === 0) continue;

    const winner = list[0];
    if (winner.isPlayer) {
      state.facilities[facilityKey] = Math.max(state.facilities[facilityKey], targetLv);
    }
  }
}

// --- 結果画面 ---
function renderRecordResult(state, result) {
  const sections = ["1500", "3000", "5000"].map(ev => {
    const rows = result.playerOnly[ev].map(r => `
      <tr>
        <td>${r.overallRank}</td>
        <td>${r.athlete.name}</td>
        <td>${r.timeText}</td>
      </tr>
    `).join("");

    return `
      <h3 style="margin-top:14px;">${ev}m（自校）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:420px;">
          <thead>
            <tr><th>全体順位</th><th>選手</th><th>タイム</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  app.innerHTML = `
    <div class="card">
      <h2>${result.title} 結果</h2>
      <p style="color:#555;">${result.when}</p>
      ${sections}
      <div class="row" style="margin-top:14px;">
        <button id="ok">OK（次の週へ）</button>
      </div>
    </div>
  `;
  document.querySelector("#ok").onclick = () => goNextWeek(state);
}

function renderSoutaiResult(state, result) {
  upgradeFacilityBySoutaiWinners(state, result);
  saveGame(state);

  const evOrder = ["800", "1500", "3000sc", "5000", "5000w"];

  const sections = evOrder.map(ev => {
    const er = result.events[ev];
    if (!er) return "";

    const list = er.type === "withFinal" ? er.final : er.overall;

    const top = list.slice(0, 10).map((x, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${x.school}</td>
        <td>${x.isPlayer ? "自校" : ""}</td>
        <td>${x.athlete.name}</td>
        <td>${x.timeText}</td>
      </tr>
    `).join("");

    const myRows = list
      .map((x, i) => ({ ...x, rank: i + 1 }))
      .filter(x => x.isPlayer)
      .map(x => `
        <tr>
          <td>${x.rank}</td>
          <td>${x.athlete.name}</td>
          <td>${x.timeText}</td>
        </tr>
      `).join("") || `<tr><td colspan="3">自校選手なし</td></tr>`;

    return `
      <h3 style="margin-top:14px;">${eventLabel(ev)}</h3>

      <h4 style="margin:10px 0 6px 0;">全体（上位10）</h4>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:560px;">
          <thead>
            <tr><th>順位</th><th>学校</th><th></th><th>選手</th><th>タイム</th></tr>
          </thead>
          <tbody>${top}</tbody>
        </table>
      </div>

      <h4 style="margin:10px 0 6px 0;">自校選手</h4>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:420px;">
          <thead>
            <tr><th>全体順位</th><th>選手</th><th>タイム</th></tr>
          </thead>
          <tbody>${myRows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  const q = (result.stage !== "national")
    ? `通過種目：${(result.qualifiedEvents ?? []).map(eventLabel).join(" / ") || "なし"}（${result.threshold}位以内）`
    : "全国は通過判定なし";

  app.innerHTML = `
    <div class="card">
      <h2>${result.title} 結果</h2>
      <p style="color:#555;">${result.when}</p>
      <p style="color:#555;">${q}</p>
      ${sections}
      <div class="row" style="margin-top:14px;">
        <button id="ok">OK（次の週へ）</button>
      </div>
    </div>
  `;
  document.querySelector("#ok").onclick = () => goNextWeek(state);
}

function renderEkidenResult(state, result) {
  const top10 = result.ranking.slice(0, 10).map(x => `
    <tr>
      <td>${x.rank}</td>
      <td>${x.school}</td>
      <td>${x.isPlayer ? "自校" : ""}</td>
      <td>${x.totalText}</td>
    </tr>
  `).join("");

  const my = result.ranking.find(x => x.isPlayer);
  const legs = (my?.legs ?? []).map(l => `
    <tr>
      <td>${l.leg}</td>
      <td>${l.event}m</td>
      <td>${l.athleteName}</td>
      <td>${l.timeText}</td>
    </tr>
  `).join("");

  const q = `自校順位：${result.myRank}位 / 通過：${result.cleared ? "YES" : "NO"}（5位以内）`;

  app.innerHTML = `
    <div class="card">
      <h2>${result.title} 結果</h2>
      <p style="color:#555;">${result.when}</p>
      <p style="color:#555;">${q}</p>

      <h3 style="margin-top:14px;">総合順位（上位10）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:520px;">
          <thead>
            <tr><th>順位</th><th>学校</th><th></th><th>総合タイム</th></tr>
          </thead>
          <tbody>${top10}</tbody>
        </table>
      </div>

      <h3 style="margin-top:14px;">自校区間タイム</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:520px;">
          <thead>
            <tr><th>区</th><th>距離</th><th>選手</th><th>タイム</th></tr>
          </thead>
          <tbody>${legs}</tbody>
        </table>
      </div>

      <div class="row" style="margin-top:14px;">
        <button id="ok">OK（次の週へ）</button>
      </div>
    </div>
  `;
  document.querySelector("#ok").onclick = () => goNextWeek(state);
}

function renderSimpleMessage(state, title, okText, okFn) {
  app.innerHTML = `
    <div class="card">
      <h2>${title}</h2>
      <div class="row" style="margin-top:14px;">
        <button id="ok">${okText}</button>
      </div>
    </div>
  `;
  document.querySelector("#ok").onclick = okFn;
}

// --- 年度更新 ---
function runYearUpdate(state) {
  applyYearUpdateToState(state);
  rivalsYearUpdate(state);

  state.qualify = {
    soutai: { prefecturePairs: [], regionPairs: [], nationalPairs: [] },
    ekiden: { prefecture: false, region: false, national: false },
  };

  // carryは翌年に持ち越さない（年度更新でリセット）
  ensureCarry(state);
  state.carry.soutai.next = [];
  state.carry.ekiden.next = [];

  ensureFacilities(state);
}

function stageTitleSoutai(key) {
  if (key === "district") return "地区総体";
  if (key === "prefecture") return "県総体";
  if (key === "region") return "地域総体";
  if (key === "national") return "全国総体";
  return "総体";
}
function stageTitleEkiden(key) {
  if (key === "district") return "地区駅伝";
  if (key === "prefecture") return "県駅伝";
  if (key === "region") return "地域駅伝";
  if (key === "national") return "全国駅伝";
  return "駅伝";
}
function eventLabel(ev) {
  if (ev === "800") return "800m";
  if (ev === "1500") return "1500m";
  if (ev === "3000sc") return "3000mSC";
  if (ev === "5000") return "5000m";
  if (ev === "5000w") return "5000mW";
  return ev;
}

renderTitle();
