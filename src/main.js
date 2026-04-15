import { createNewGameState, saveGame, loadGame, clearSave } from "./state.js";
import { TRAININGS, applyTraining } from "./rules.js";
import { runRecordMeet } from "./meet_record.js";
import { runSoutai } from "./meet_soutai.js";

const app = document.querySelector("#app");

// --- スケジュール判定（「その週の練習後に大会」） ---
function getMeetOfWeek(state) {
  // 記録会：4月4週後、9月3週後、3月3週後
  if (state.month === 4 && state.week === 4) return { type: "record" };
  if (state.month === 9 && state.week === 3) return { type: "record" };
  if (state.month === 3 && state.week === 3) return { type: "record" };

  // 総体：5月1週後 地区、5月4週後 県、6月3週後 地域、7月4週後 全国
  if (state.month === 5 && state.week === 1) return { type: "soutai", stage: "district" };
  if (state.month === 5 && state.week === 4) return { type: "soutai", stage: "prefecture" };
  if (state.month === 6 && state.week === 3) return { type: "soutai", stage: "region" };
  if (state.month === 7 && state.week === 4) return { type: "soutai", stage: "national" };

  return null;
}

function advanceWeek(state) {
  state.week += 1;
  if (state.week > 4) {
    state.week = 1;
    state.month += 1;
    if (state.month > 12) state.month = 1;
  }
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
      <p style="margin-top:12px;color:#555;">
        端末内（ブラウザ）に自動でセーブされます。
      </p>
    </div>
  `;

  document.querySelector("#new").onclick = () => {
    const state = createNewGameState();
    saveGame(state);
    renderHome(state);
  };

  document.querySelector("#cont").onclick = () => {
    const state = loadGame();
    if (state) renderHome(state);
  };

  document.querySelector("#reset").onclick = () => {
    clearSave();
    renderTitle();
  };
}

function renderHome(state) {
  const meet = getMeetOfWeek(state);

  const meetText = meet
    ? (meet.type === "record"
      ? "この週は【記録会】があります（練習後に実行）"
      : `この週は【総体】があります：${stageTitle(meet.stage)}（練習後に実行）`)
    : "この週は大会なし";

  app.innerHTML = `
    <div class="card">
      <h2>ホーム</h2>
      <p>年：${state.year} / ${state.month}月 ${state.week}週</p>
      <p style="color:#555;">${meetText}</p>
      <p style="color:#555;">今週の練習：${state.lastTraining?.name ?? "未実施"}</p>

      <div class="row">
        <button id="training">練習</button>
        <button id="athletes">選手</button>
        <button id="next" ${state.trainingDoneThisWeek ? "" : "disabled"}>次の週へ</button>
        <button class="secondary" id="back">タイトルへ</button>
      </div>

      <p style="margin-top:10px;color:#777;">
        ※「次の週へ」は、今週の練習を選んだ後に押せます。
      </p>
    </div>
  `;

  document.querySelector("#training").onclick = () => renderTraining(state);
  document.querySelector("#athletes").onclick = () => renderAthletes(state);

  document.querySelector("#next").onclick = () => {
    const meet = getMeetOfWeek(state);

    // 大会週なら練習後に大会処理 → 結果画面へ
    if (meet?.type === "record") {
      const result = runRecordMeet(state);
      saveGame(state);
      renderRecordResult(state, result);
      return;
    }

    if (meet?.type === "soutai") {
      const result = runSoutai(state, meet.stage);
      saveGame(state);
      renderSoutaiResult(state, result);
      return;
    }

    // 大会なし：そのまま次へ
    advanceWeek(state);
    resetWeekFlags(state);
    saveGame(state);
    renderHome(state);
  };

  document.querySelector("#back").onclick = () => renderTitle();
}

function resetWeekFlags(state) {
  state.trainingDoneThisWeek = false;
  state.lastTraining = null;
}

function renderTraining(state) {
  const buttons = TRAININGS.map(t => `
    <button data-id="${t.id}">${t.name}</button>
  `).join("");

  app.innerHTML = `
    <div class="card">
      <h2>練習</h2>
      <p style="color:#555;">どれか1つ選んでください（全選手に適用）</p>
      <div class="row">
        ${buttons}
      </div>
      <div class="row" style="margin-top:12px;">
        <button class="secondary" id="home">戻る</button>
      </div>
    </div>
  `;

  app.querySelectorAll("button[data-id]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      applyTraining(state, id);
      saveGame(state);
      renderHome(state);
    };
  });

  document.querySelector("#home").onclick = () => renderHome(state);
}

function renderAthletes(state) {
  const rows = (state.athletes ?? []).map(a => `
    <tr>
      <td>${a.grade}</td>
      <td>${a.name}</td>
      <td>${a.personality}</td>
      <td>${a.abilities.sprint}</td>
      <td>${a.abilities.speed}</td>
      <td>${a.abilities.stamina}</td>
      <td>${a.abilities.toughness}</td>
      <td>${a.abilities.technique}</td>
      <td>${a.overall}</td>
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
      <p style="color:#555;margin-top:8px;">
        ※スマホでは表が横スクロールになります。
      </p>
    </div>
  `;

  document.querySelector("#home").onclick = () => renderHome(state);
}

// --- 記録会結果 ---
function renderRecordResult(state, result) {
  const sections = ["1500", "3000", "5000"].map(ev => {
    const rows = result.playerOnly[ev].map(r => `
      <tr>
        <td>${r.overallRank}</td>
        <td>${r.athlete.name}</td>
        <td>${r.timeText}</td>
        <td>${r.groupIndex}</td>
        <td>${r.rankInGroup}</td>
      </tr>
    `).join("");

    return `
      <h3 style="margin-top:14px;">${ev}m（自校）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:520px;">
          <thead>
            <tr>
              <th>全体順位</th><th>選手</th><th>タイム</th><th>組</th><th>組順位</th>
            </tr>
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
        <button id="nextWeek">次の週へ進む</button>
        <button class="secondary" id="home">ホームへ</button>
      </div>
    </div>
  `;

  document.querySelector("#nextWeek").onclick = () => {
    advanceWeek(state);
    resetWeekFlags(state);
    saveGame(state);
    renderHome(state);
  };
  document.querySelector("#home").onclick = () => renderHome(state);
}

// --- 総体結果 ---
function renderSoutaiResult(state, result) {
  // 「各種目の上位だけ」を表示（全部出すと長いので、まずは決勝 or overall の上位10だけ）
  const evOrder = ["800", "1500", "3000sc", "5000", "5000w"];

  const sections = evOrder.map(ev => {
    const er = result.events[ev];

    // 表示対象
    let list = [];
    if (er.type === "withFinal") list = er.final;
    else list = er.overall;

    const top = list.slice(0, 10).map((x, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${x.school}</td>
        <td>${x.isPlayer ? "自校" : ""}</td>
        <td>${x.athlete.name}</td>
        <td>${x.timeText}</td>
      </tr>
    `).join("");

    return `
      <h3 style="margin-top:14px;">${eventLabel(ev)}</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:560px;">
          <thead>
            <tr>
              <th>順位</th><th>学校</th><th></th><th>選手</th><th>タイム</th>
            </tr>
          </thead>
          <tbody>${top}</tbody>
        </table>
      </div>
      <p style="color:#777;margin:6px 0 0 0;">※上位10人のみ表示</p>
    `;
  }).join("");

  const passText = result.cleared
    ? `通過種目：${result.passedEvents.map(eventLabel).join(" / ")}`
    : "通過種目なし";

  app.innerHTML = `
    <div class="card">
      <h2>${result.title} 結果</h2>
      <p style="color:#555;">${result.when}</p>
      <p style="color:#555;">${passText}</p>
      ${sections}
      <div class="row" style="margin-top:14px;">
        <button id="nextWeek">次の週へ進む</button>
        <button class="secondary" id="home">ホームへ</button>
      </div>
      <p style="margin-top:10px;color:#777;">
        ※勝ち上がり判定は簡略版です（大枠完成後に厳密化します）。
      </p>
    </div>
  `;

  document.querySelector("#nextWeek").onclick = () => {
    advanceWeek(state);
    resetWeekFlags(state);
    saveGame(state);
    renderHome(state);
  };
  document.querySelector("#home").onclick = () => renderHome(state);
}

function stageTitle(key) {
  if (key === "district") return "地区総体";
  if (key === "prefecture") return "県総体";
  if (key === "region") return "地域総体";
  if (key === "national") return "全国総体";
  return "総体";
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
