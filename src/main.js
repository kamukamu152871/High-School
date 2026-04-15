import { createNewGameState, saveGame, loadGame, clearSave } from "./state.js";
import { TRAININGS, applyTraining } from "./rules.js";
import { runRecordMeet } from "./meet_record.js";

const app = document.querySelector("#app");

function isRecordMeetWeek(state) {
  // 記録会：4月4週後、9月3週後、3月3週後（「後」= その週の練習→大会）
  return (
    (state.month === 4 && state.week === 4) ||
    (state.month === 9 && state.week === 3) ||
    (state.month === 3 && state.week === 3)
  );
}

function advanceWeek(state) {
  state.week += 1;
  if (state.week > 4) {
    state.week = 1;
    state.month += 1;
    if (state.month > 12) state.month = 1;
  }
}

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
  const meetText = isRecordMeetWeek(state)
    ? "この週は【記録会】があります（練習後に実行）"
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
    // 大会週なら練習後に大会処理
    if (isRecordMeetWeek(state)) {
      const result = runRecordMeet(state);
      saveGame(state);
      renderMeetResult(state, result);
      return;
    }

    // 大会なし→そのまま次週へ
    advanceWeek(state);
    state.trainingDoneThisWeek = false;
    state.lastTraining = null;
    saveGame(state);
    renderHome(state);
  };

  document.querySelector("#back").onclick = () => renderTitle();
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

function renderMeetResult(state, result) {
  // 自校だけ表示（種目ごと）
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
      <p style="margin-top:10px;color:#777;">
        ※次の週へ進むと「今週の練習」はリセットされます。
      </p>
    </div>
  `;

  document.querySelector("#nextWeek").onclick = () => {
    // 大会処理を終えた週なので、ここで週を進める
    advanceWeek(state);
    state.trainingDoneThisWeek = false;
    state.lastTraining = null;
    saveGame(state);
    renderHome(state);
  };

  document.querySelector("#home").onclick = () => renderHome(state);
}

renderTitle();
