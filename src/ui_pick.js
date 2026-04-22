import { EVENTS_MEET } from "./rules.js";
import { recommendRecordPicks, recommendSoutaiPicks, recommendEkidenPicks } from "./recommend.js";

export function renderPicker(app, mode, state, context) {
  if (mode === "record") return renderRecordPicker(app, state, context);
  if (mode === "soutai") return renderSoutaiPicker(app, state, context);
  if (mode === "ekiden") return renderEkidenPicker(app, state, context);
  if (mode === "newcomer_ekiden") {
    return renderEkidenPicker(app, state, {
      ...context,
      title: "出場選出：新人駅伝",
      excludeGrade3: true,
    });
  }
  if (mode === "captain") return renderCaptainPicker(app, state, context);
  throw new Error("unknown picker mode");
}

function btn(html, id) { return `<button id="${id}">${html}</button>`; }
function smallBtn(html, id) { return `<button id="${id}" style="background:#444;">${html}</button>`; }
function athleteLabel(a) { return `${a.grade}年 ${a.name}（${a.personality} / 総合${a.overall}）`; }

// ===== キャプテン指名 =====
// - 3年生から1人選ぶ
// - onConfirm(captainId)
function renderCaptainPicker(app, state, { onCancel, onConfirm, title = "キャプテン指名" }) {
  const candidates = (state.athletes ?? []).filter(a => a.grade === 3);
  let scrollTop = 0;

  function draw() {
    const prevList = app.querySelector('[data-scroll="captain-list"]');
    if (prevList) scrollTop = prevList.scrollTop;

    const rows = candidates.map(a => `
      <div style="padding:10px;border-top:1px solid #eee;">
        <label style="display:flex; gap:10px; align-items:flex-start;">
          <input type="radio" name="cap" value="${a.id}" style="margin-top:5px;" />
          <div style="flex:1;">
            <div style="font-weight:800;">${athleteLabel(a)}</div>
            <div style="color:#555; margin-top:4px;">
              SPRINT ${Math.floor(a.abilities.sprint)} / SPEED ${Math.floor(a.abilities.speed)} /
              STAMINA ${Math.floor(a.abilities.stamina)} / TOUGHNESS ${Math.floor(a.abilities.toughness)} /
              TECHNIQUE ${Math.floor(a.abilities.technique)}
            </div>
          </div>
        </label>
      </div>
    `).join("") || `<div style="color:#b00;">3年生がいないためキャプテンを選べません。</div>`;

    app.innerHTML = `
      <div class="card">
        <h2>${title}</h2>
        <p style="color:#555;">3年生からキャプテンを1人選んでください。</p>

        <div data-scroll="captain-list" style="max-height:60vh; overflow:auto; border:1px solid #eee; border-radius:8px;">
          ${rows}
        </div>

        <div class="row" style="margin-top:12px;">
          ${btn("決定", "ok")}
          ${smallBtn("戻る", "cancel")}
        </div>

        <p style="margin-top:8px; color:#777;">
          ※キャプテンの性格により、練習や大会に効果が発生します。
        </p>
      </div>
    `;

    const list = app.querySelector('[data-scroll="captain-list"]');
    if (list) list.scrollTop = scrollTop;

    document.querySelector("#ok").onclick = () => {
      const v = app.querySelector('input[name="cap"]:checked')?.value ?? "";
      if (!v) return;
      onConfirm(v);
    };
    document.querySelector("#cancel").onclick = () => onCancel();
  }

  draw();
}

// ===== 記録会 =====
function renderRecordPicker(app, state, { onCancel, onConfirm }) {
  const events = ["1500", "3000", "5000"];
  const picks = new Map(); // athlete.id -> event
  let recordListScrollTop = 0;

  function applyRecommended() {
    const rec = recommendRecordPicks(state.athletes);
    for (const r of rec) picks.set(r.athlete.id, r.event);
  }

  function isValid() {
    return state.athletes.every(a => picks.has(a.id));
  }

  function draw() {
    const prevList = app.querySelector('[data-scroll="record-list"]');
    if (prevList) recordListScrollTop = prevList.scrollTop;

    const rows = state.athletes.map(a => {
      const current = picks.get(a.id) ?? "";
      const options = events.map(ev => `
        <label style="margin-right:10px;">
          <input type="radio" name="ev_${a.id}" value="${ev}" ${current === ev ? "checked" : ""}/>
          ${ev}m
        </label>
      `).join("");

      return `
        <div style="padding:8px;border-top:1px solid #eee;">
          <div style="font-weight:700;">${athleteLabel(a)}</div>
          <div style="margin-top:6px;">${options}</div>
        </div>
      `;
    }).join("");

    app.innerHTML = `
      <div class="card">
        <h2>出場選出：記録会</h2>
        <p style="color:#555;">全選手を1種目に割り当ててください（1500/3000/5000）</p>

        <div class="row" style="margin-top:8px;">
          ${btn("おすすめ", "rec")}
          ${smallBtn("全解除", "clear")}
        </div>

        <div data-scroll="record-list" style="max-height:55vh; overflow:auto; border:1px solid #eee; border-radius:8px;">
          ${rows}
        </div>

        <div class="row" style="margin-top:12px;">
          ${btn("確定", "ok")}
          ${smallBtn("戻る", "cancel")}
        </div>

        <p style="margin-top:8px;color:${isValid() ? "#0a0" : "#b00"};">
          ${isValid() ? "OK：全員割り当て済み" : "未割り当ての選手がいます"}
        </p>
      </div>
    `;

    app.querySelectorAll("input[type=radio]").forEach(r => {
      r.onchange = () => {
        const [_, id] = r.name.split("ev_");
        picks.set(id, r.value);
        draw();
      };
    });

    document.querySelector("#rec").onclick = () => { applyRecommended(); draw(); };
    document.querySelector("#clear").onclick = () => { picks.clear(); draw(); };

    document.querySelector("#ok").onclick = () => {
      if (!isValid()) return;
      const arr = state.athletes.map(a => ({ athlete: a, event: picks.get(a.id) }));
      onConfirm(arr);
    };
    document.querySelector("#cancel").onclick = () => onCancel();

    const recordList = app.querySelector('[data-scroll="record-list"]');
    if (recordList) recordList.scrollTop = recordListScrollTop;
  }

  draw();
}

// ===== 総体 =====
function renderSoutaiPicker(app, state, {
  allowedEvents = null,
  allowedPairs = null,
  readOnly = false,
  fixedPicks = null, // 県以降で使う確定枠 [{athlete,event}]
  onCancel,
  onConfirm
}) {
  const events = allowedEvents ?? EVENTS_MEET;
  let athleteListScrollTop = 0;

  // picks：表示用。readOnlyなら fixedPicks を表示
  const picks = [];

  function countByEvent(ev) { return picks.filter(p => p.event === ev).length; }
  function countByAthlete(a) { return picks.filter(p => p.athlete === a).length; }

  function canAdd(a, ev) {
    if (readOnly) return false;
    if (!events.includes(ev)) return false;

    if (allowedPairs) {
      const ok = allowedPairs.some(p => p.athleteId === a.id && p.event === ev);
      if (!ok) return false;
    }
    if (countByEvent(ev) >= 3) return false;
    if (countByAthlete(a) >= 2) return false;
    if (picks.some(p => p.athlete === a && p.event === ev)) return false;
    return true;
  }

  function remove(a, ev) {
    if (readOnly) return;
    const idx = picks.findIndex(p => p.athlete === a && p.event === ev);
    if (idx >= 0) picks.splice(idx, 1);
  }

  function isValid() {
    if (readOnly) return true;
    return picks.length > 0 && picks.every(p => events.includes(p.event));
  }

  function applyRecommended() {
    picks.splice(0, picks.length);
    const rec = recommendSoutaiPicks(state.athletes, events);

    const filtered = allowedPairs
      ? rec.filter(r => allowedPairs.some(p => p.athleteId === r.athlete.id && p.event === r.event))
      : rec;

    for (const r of filtered) picks.push(r);
  }

  // 初期化
  if (readOnly) {
    picks.splice(0, picks.length);
    const src = fixedPicks ?? [];
    for (const p of src) {
      if (events.includes(p.event)) picks.push(p);
    }
  }

  function draw() {
    const prevAList = app.querySelector("#alist");
    if (prevAList) athleteListScrollTop = prevAList.scrollTop;

    const eventBlocks = events.map(ev => {
      const pickedHere = picks.filter(p => p.event === ev);

      const list = pickedHere.map(p => `
        <div style="display:flex; justify-content:space-between; gap:8px; border-top:1px solid #eee; padding:6px 0;">
          <div>${p.athlete.name}（${p.athlete.grade}年/総合${p.athlete.overall}）</div>
          ${readOnly ? "" : `<button data-del="1" data-aid="${p.athlete.id}" data-ev="${ev}" style="background:#a00;">外す</button>`}
        </div>
      `).join("") || `<div style="color:#777;">未選出</div>`;

      return `
        <div style="border:1px solid #eee; border-radius:10px; padding:10px; margin-top:10px;">
          <div style="font-weight:800;">${labelEvent(ev)}（${countByEvent(ev)}/3）</div>
          <div style="margin-top:6px;">${list}</div>
        </div>
      `;
    }).join("");

    const athleteRows = state.athletes.map(a => {
      const used = countByAthlete(a);
      const addButtons = events.map(ev => {
        const disabled = canAdd(a, ev) ? "" : "disabled";
        return `<button data-add="1" data-aid="${a.id}" data-ev="${ev}" ${disabled} style="margin:2px;">${labelEvent(ev)}</button>`;
      }).join("");

      return `
        <div style="padding:8px;border-top:1px solid #eee;">
          <div style="font-weight:700;">${athleteLabel(a)} / 出場数 ${used}/2</div>
          <div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:4px;">
            ${readOnly ? `<span style="color:#777;">（確認のみ）</span>` : addButtons}
          </div>
        </div>
      `;
    }).join("");

    app.innerHTML = `
      <div class="card">
        <h2>${readOnly ? "出場確認：総体" : "出場選出：総体"}</h2>
        <p style="color:#555;">各種目3人まで／1人2種目まで</p>
        ${readOnly ? `<p style="color:#b00;">※県以降は前大会上位枠の確認のみ（編集不可）</p>` : ""}

        ${readOnly ? "" : `
          <div class="row" style="margin-top:8px;">
            ${btn("おすすめ", "rec")}
            ${smallBtn("全解除", "clear")}
          </div>
        `}

        <h3 style="margin-top:10px;">種目ごとの選出</h3>
        ${eventBlocks}

        <h3 style="margin-top:14px;">選手一覧</h3>
        <div id="alist" style="max-height:45vh; overflow:auto; border:1px solid #eee; border-radius:8px;">
          ${athleteRows}
        </div>

        <div class="row" style="margin-top:12px;">
          ${btn("確定", "ok")}
          ${smallBtn("戻る", "cancel")}
        </div>

        <p style="margin-top:8px;color:${isValid() ? "#0a0" : "#b00"};">
          ${isValid() ? "OK：確定できます" : "最低1枠は選出してください"}
        </p>
      </div>
    `;

    if (!readOnly) {
      app.querySelectorAll("button[data-add]").forEach(b => {
        b.onclick = () => {
          const aid = b.getAttribute("data-aid");
          const ev = b.getAttribute("data-ev");
          const a = state.athletes.find(x => x.id === aid);
          if (!a) return;
          if (!canAdd(a, ev)) return;
          picks.push({ athlete: a, event: ev });
          draw();
        };
      });

      app.querySelectorAll("button[data-del]").forEach(b => {
        b.onclick = () => {
          const aid = b.getAttribute("data-aid");
          const ev = b.getAttribute("data-ev");
          const a = state.athletes.find(x => x.id === aid);
          if (!a) return;
          remove(a, ev);
          draw();
        };
      });

      document.querySelector("#rec").onclick = () => { applyRecommended(); draw(); };
      document.querySelector("#clear").onclick = () => { picks.splice(0, picks.length); draw(); };
    }

    document.querySelector("#ok").onclick = () => { if (isValid()) onConfirm(picks.slice()); };
    document.querySelector("#cancel").onclick = () => onCancel();

    const alist = app.querySelector("#alist");
    if (alist) alist.scrollTop = athleteListScrollTop;
  }

  draw();
}

// ===== 駅伝 =====
function renderEkidenPicker(app, state, { onCancel, onConfirm, title = "出場選出：駅伝", excludeGrade3 = false }) {
  const sections = [
    { leg: 1, event: "10000" },
    { leg: 2, event: "3000" },
    { leg: 3, event: "8000" },
    { leg: 4, event: "8000" },
    { leg: 5, event: "3000" },
    { leg: 6, event: "5000" },
    { leg: 7, event: "5000" },
  ];

  const picks = new Map(); // leg -> athleteId

  const candidates = excludeGrade3
    ? state.athletes.filter(a => a.grade !== 3)
    : state.athletes;

  function applyRecommended() {
    const rec = recommendEkidenPicks(candidates);
    for (const r of rec) picks.set(r.leg, r.athlete.id);
  }

  function usedSet() {
    return new Set(Array.from(picks.values()));
  }
  function validate() {
    const missingLegs = sections.filter(s => !picks.get(s.leg)).map(s => s.leg);

    const cnt = new Map();
    for (const aid of picks.values()) {
      cnt.set(aid, (cnt.get(aid) ?? 0) + 1);
    }
    const duplicateCount = Array.from(cnt.values()).filter(v => v >= 2).length;

    const invalidAthleteCount = sections
      .map(s => picks.get(s.leg))
      .filter(Boolean)
      .filter(aid => !candidates.some(a => a.id === aid))
      .length;

    if (missingLegs.length > 0) {
      return { ok: false, text: `未選択の区間があります（${missingLegs.join(",")}区）` };
    }
    if (duplicateCount > 0) {
      return { ok: false, text: "同じ選手が複数区間に選ばれています" };
    }
    if (invalidAthleteCount > 0) {
      return { ok: false, text: "選手データが不正です。選び直してください" };
    }
    return { ok: true, text: "OK：確定できます" };
  }

  function draw() {
    const used = usedSet();
    const v = validate();

    const secBlocks = sections.map(s => {
      const cur = picks.get(s.leg) ?? "";
      const options = candidates.map(a => {
        const disabled = (used.has(a.id) && a.id !== cur) ? "disabled" : "";
        return `<option value="${a.id}" ${a.id === cur ? "selected" : ""} ${disabled}>${athleteLabel(a)}</option>`;
      }).join("");

      return `
        <div style="border:1px solid #eee;border-radius:10px;padding:10px;margin-top:10px;">
          <div style="font-weight:800;">${s.leg}区（${s.event}m）</div>
          <select data-leg="${s.leg}" style="width:100%; padding:10px; margin-top:6px;">
            <option value="">未選択</option>
            ${options}
          </select>
        </div>
      `;
    }).join("");

    app.innerHTML = `
        <div class="card">
        <h2>${title}</h2>
        <p style="color:#555;">1〜7区に選手を1人ずつ（重複なし）${excludeGrade3 ? " / 3年生は選出不可" : ""}</p>

        <div class="row" style="margin-top:8px;">
          ${btn("おすすめ", "rec")}
          ${smallBtn("全解除", "clear")}
        </div>

        <div style="max-height:65vh; overflow:auto;">
          ${secBlocks}
        </div>

        <div class="row" style="margin-top:12px;">
          ${btn("確定", "ok")}
          ${smallBtn("戻る", "cancel")}
        </div>

        <p style="margin-top:8px;color:${v.ok ? "#0a0" : "#b00"};">
          ${v.text}
        </p>
      </div>
    `;

    app.querySelectorAll("select[data-leg]").forEach(sel => {
      sel.onchange = () => {
        const leg = Number(sel.getAttribute("data-leg"));
        const v = sel.value;
        if (!v) picks.delete(leg);
        else picks.set(leg, v);
        draw();
      };
    });

    document.querySelector("#rec").onclick = () => { applyRecommended(); draw(); };
    document.querySelector("#clear").onclick = () => { picks.clear(); draw(); };

    document.querySelector("#ok").onclick = () => {
      const status = validate();
      if (!status.ok) return;

      const arr = sections.map(s => {
        const aid = picks.get(s.leg);
        const a = candidates.find(x => x.id === aid);
        return { leg: s.leg, event: s.event, athlete: a };
      });

      if (arr.some(x => !x.athlete)) return;
      onConfirm(arr);
    };
    document.querySelector("#cancel").onclick = () => onCancel();
  }

  draw();
}

function labelEvent(ev) {
  if (ev === "800") return "800";
  if (ev === "1500") return "1500";
  if (ev === "3000sc") return "3000SC";
  if (ev === "5000") return "5000";
  if (ev === "5000w") return "5000W";
  return ev;
}
