const COOLDOWN_DAYS = 56;
const STORAGE = {
  activeView: "asafe:v2:active-view",
  librarySearch: "asafe:v2:library-search",
  libraryCategory: "asafe:v2:library-category",
  libraryStatus: "asafe:v2:library-status",
  libraryIntensity: "asafe:v2:library-intensity",
  builderCult: "asafe:v2:builder-cult",
  builderDrafts: "asafe:v2:builder-drafts",
  wrappedStart: "asafe:v2:wrapped-start",
  wrappedEnd: "asafe:v2:wrapped-end",
  wrappedMember: "asafe:v2:wrapped-member",
};

let integrantes = [];
let musicas = [];
let historico = [];
let categorias = [];
let popularityCache = null;

const state = {
  activeView: localStorage.getItem(STORAGE.activeView) || "hoje",
  librarySearch: localStorage.getItem(STORAGE.librarySearch) || "",
  libraryCategory: localStorage.getItem(STORAGE.libraryCategory) || "all",
  libraryStatus: localStorage.getItem(STORAGE.libraryStatus) || "all",
  libraryIntensity: localStorage.getItem(STORAGE.libraryIntensity) || "all",
  builderCult: localStorage.getItem(STORAGE.builderCult) || "",
  builderDrafts: readJSON(STORAGE.builderDrafts, {}),
  wrappedStart: localStorage.getItem(STORAGE.wrappedStart) || "",
  wrappedEnd: localStorage.getItem(STORAGE.wrappedEnd) || "",
  wrappedMember: localStorage.getItem(STORAGE.wrappedMember) || "all",
};

const ui = { building: false, builderTab: "selected", bandTab: "wrapped", filtersOpen: false, detailSong: null, detailCult: null };

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const [membersData, songsData, historyData] = await Promise.all([
      loadDataFile("integrantes/integrantes.json"),
      loadDataFile("musicas.json"),
      loadDataFile("historico.json"),
    ]);

    integrantes = Array.isArray(membersData) ? membersData : [];
    musicas = normalizeSongs(Array.isArray(songsData) ? songsData : []);
    historico = normalizeHistory(Array.isArray(historyData) ? historyData : []);
    categorias = getUniqueCategories(musicas);
    popularityCache = classifyPopularity();

    bindShell();
    renderApp();
  } catch (err) {
    console.error(err);
    document.querySelector(".main-stage").innerHTML =
      '<div class="empty-state" role="alert">Não foi possível carregar as músicas e escalas. Verifique sua conexão e tente novamente.</div>';
    document.querySelector(".main-stage").append(button("Tentar novamente", "pill-button", () => window.location.reload()));
  }
}

async function loadDataFile(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Falha ao carregar ${path}: ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error(`Formato inválido em ${path}`);
  return data;
}

function bindShell() {
  document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => { ui.building = false; setView(btn.dataset.view); });
  });
  document.querySelectorAll("[data-band-tab]").forEach((btn) => {
    btn.addEventListener("click", () => { ui.bandTab = btn.dataset.bandTab; renderBandTabs(); });
  });
  const dialog = document.getElementById("songDialog");
  dialog.addEventListener("close", () => { ui.detailSong = null; ui.detailCult = null; document.body.classList.remove("detail-open"); });
  document.getElementById("closeSongDetail").addEventListener("click", () => dialog.close());
  if (window.visualViewport) {
    const syncKeyboard = () => {
      const editing = document.activeElement?.matches("input, textarea, select");
      const reduced = window.visualViewport.height < window.innerHeight - 140;
      document.body.classList.toggle("keyboard-open", Boolean(editing && reduced));
    };
    window.visualViewport.addEventListener("resize", syncKeyboard);
    document.addEventListener("focusin", syncKeyboard);
    document.addEventListener("focusout", () => document.body.classList.remove("keyboard-open"));
  }
}

function renderApp() {
  setView(state.activeView, { silent: true });
  renderHoje();
  renderCultos();
  if (state.activeView !== "repertorio") renderRepertorio();
  renderWrapped();
  renderTitulos();
  renderBandTabs();
}

function setView(view, opts = {}) {
  if (view === "wrapped" || view === "titulos") { ui.bandTab = view; view = "banda"; }
  if (!["hoje", "cultos", "repertorio", "banda"].includes(view)) view = "hoje";
  state.activeView = view;
  localStorage.setItem(STORAGE.activeView, view);
  document.querySelectorAll(".view").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `view-${view}`);
  });
  document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
    const active = btn.dataset.view === view;
    btn.classList.toggle("active", active);
    if (active) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });
  const meta = {
    hoje: ["Sua próxima escala", "Próximo culto"],
    cultos: ["Planeje com antecedência", "Agenda"],
    repertorio: [ui.building ? "Escolha com contexto" : "Encontre sua próxima música", ui.building ? "Montar repertório" : "Músicas"],
    banda: ["Nossa história em música", "Banda"],
  }[view];
  document.getElementById("viewKicker").textContent = meta[0];
  document.getElementById("viewTitle").textContent = meta[1];
  document.body.classList.toggle("is-building", ui.building && view === "repertorio");
  if (view === "repertorio") renderRepertorio();
  if (view === "banda") renderBandTabs();
  if (!opts.silent) window.scrollTo({ top: 0, behavior: "instant" });
}

function renderHoje() {
  const root = document.getElementById("view-hoje");
  root.replaceChildren();
  const next = getNextCulto();
  if (!next) { root.append(emptyState("Nenhum culto futuro cadastrado.")); return; }
  const analysis = analyzeSet(next, next.musicas || []);
  root.append(renderCultHero(next, analysis), renderSetBlock(next, analysis));
  const actions = div("service-actions");
  actions.append(button(next.musicas.length ? "Preparar outro rascunho" : "Montar repertório", "pill-button", () => openBuilder(next)));
  if (next.musicas.length) actions.append(button("Copiar escala", "ghost-button", () => copyScale(next)));
  root.append(actions, sectionPanel("Quem vai tocar", "Equipe", renderMembers(next)), renderAnalysisBlock(analysis));
}

function renderCultos() {
  const root = document.getElementById("view-cultos");
  root.replaceChildren();
  const cultos = getFutureCultos();
  if (!cultos.length) { root.append(emptyState("Nenhum culto futuro cadastrado.")); return; }
  const list = div("agenda-list");
  cultos.forEach((culto, index) => {
    const card = document.createElement("details"); card.className = "agenda-card";
    const summary = document.createElement("summary");
    summary.innerHTML = `<span class="agenda-date-row"><span><span class="section-kicker">${index === 0 ? "Próximo culto" : "Na agenda"}</span><strong>${escapeHTML(formatDateLong(culto.dataObj))}</strong></span><span class="agenda-chevron" aria-hidden="true"></span></span>`;
    const preview = renderAgendaPreview(culto);
    preview.querySelector('.agenda-cover').append(summary.firstElementChild);
    summary.append(preview);
    const content = div("agenda-content");
    content.append(renderTrackList(culto.musicas, { culto }), button(culto.musicas.length ? "Preparar rascunho" : "Montar repertório", "pill-button", () => openBuilder(culto)), sectionHeader("Integrantes"), renderMembers(culto, { agenda: true }));
    card.append(summary, content); list.append(card);
  });
  root.append(list);
}

function renderRepertorio() {
  const root = document.getElementById("view-repertorio");
  root.replaceChildren();
  document.getElementById("builderDock").replaceChildren();
  if (ui.building) {
    const culto = getCultByKey(state.builderCult);
    if (!culto || !getBuilderCultos().includes(culto)) ui.building = false;
  }
  document.body.classList.toggle("is-building", ui.building && state.activeView === "repertorio");
  if (ui.building) {
    root.append(renderBuilder());
    if (ui.builderTab !== "add") return;
  }
  root.append(renderLibraryControls());
  const results = div("library-results"); results.id = "libraryResults";
  root.append(results); renderLibraryResults();
}

function renderWrapped() {
  const root = document.getElementById("view-wrapped");
  root.innerHTML = "";

  root.append(renderWrappedControls());

  const events = getWrappedEvents();
  const insights = computeWrapped(events);
  const grid = document.createElement("div");
  grid.className = "wrapped-grid";

  grid.append(
    statWrappedCard("Cultos no período", insights.totalCultos, "📅"),
    statWrappedCard("Execuções de músicas", insights.totalExecucoes, "🎵"),
    statWrappedCard("Músicas diferentes", insights.uniqueSongs, "📚"),
  );

  grid.append(
    rankCard("Músicas mais tocadas", insights.topSongs, "musica"),
    rankCard("Artistas mais tocados", insights.topArtists, "artist"),
    rankCard("Músicas mais escolhidas", insights.topChosenSongs, "musica"),
    rankCard("Artistas mais escolhidos", insights.topChosenArtists, "artist"),
    rankCard("Parcerias mais recorrentes", insights.topPairs, "pair"),
  );

  root.append(grid);
}

function renderTitulos() {
  const root = document.getElementById("view-titulos");
  root.innerHTML = "";
  root.append(renderWrappedControls());

  const events = getWrappedEvents(true);
  const titles = computeTitleGallery(events);
  const grid = document.createElement("div");
  grid.className = "titles-grid";
  titles.forEach((title) => grid.append(renderTitleCard(title)));
  root.append(titles.length ? grid : emptyState("Nenhum título no período selecionado."));
}

function renderWrappedControls() {
  const controls = document.createElement("div");
  controls.className = "controls-panel";
  const period = getWrappedPeriod();
  const rerender = () => {
    renderWrapped();
    renderTitulos();
  };
  controls.innerHTML = `
    <input class="input" data-filter="start" type="date" value="${escapeAttr(period.start)}" />
    <input class="input" data-filter="end" type="date" value="${escapeAttr(period.end)}" />
    <select class="select" data-filter="member">
      <option value="all">Todos os integrantes</option>
      ${integrantes
        .map(
          (m) =>
            `<option value="${m.id}" ${String(m.id) === state.wrappedMember ? "selected" : ""}>${escapeHTML(m.nome)}</option>`,
        )
        .join("")}
    </select>
    <button class="ghost-button" data-filter="clear" type="button">Limpar filtros</button>
  `;

  [["start", "De"], ["end", "Até"], ["member", "Integrante"]].forEach(([key, text]) => {
    const input = controls.querySelector(`[data-filter="${key}"]`);
    const label = document.createElement("label"); label.textContent = text;
    input.before(label); label.append(input);
  });
  controls.querySelector('[data-filter="start"]').addEventListener("change", (ev) => {
    state.wrappedStart = ev.target.value;
    localStorage.setItem(STORAGE.wrappedStart, state.wrappedStart);
    rerender();
  });
  controls.querySelector('[data-filter="end"]').addEventListener("change", (ev) => {
    state.wrappedEnd = ev.target.value;
    localStorage.setItem(STORAGE.wrappedEnd, state.wrappedEnd);
    rerender();
  });
  controls.querySelector('[data-filter="member"]').addEventListener("change", (ev) => {
    state.wrappedMember = ev.target.value;
    localStorage.setItem(STORAGE.wrappedMember, state.wrappedMember);
    rerender();
  });
  controls.querySelector('[data-filter="clear"]').addEventListener("click", () => {
    state.wrappedStart = "";
    state.wrappedEnd = "";
    state.wrappedMember = "all";
    localStorage.removeItem(STORAGE.wrappedStart);
    localStorage.removeItem(STORAGE.wrappedEnd);
    localStorage.setItem(STORAGE.wrappedMember, "all");
    rerender();
  });
  return controls;
}

function renderCultHero(culto, analysis) {
  const hero = div("cult-heading");
  hero.innerHTML = `<p class="cult-date">${escapeHTML(formatDateLong(culto.dataObj))}</p>
    <p class="muted-line">${analysis.songCount ? `${analysis.songCount} músicas no repertório` : "Repertório a definir"} · ${(culto.integrantes || []).length} integrantes</p>`;
  return hero;
}

function renderSetBlock(culto, analysis) {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.append(
    sectionHeader("Repertório do dia", "Músicas na ordem", `${analysis.songCount} músicas selecionadas`),
    renderTrackList(culto.musicas || [], { culto }),
  );
  return panel;
}

function renderAnalysisBlock(analysis) {
  const panel = document.createElement("details"); panel.className = "analysis-disclosure";
  const summary = document.createElement("summary"); summary.innerHTML = `<strong>Leitura do repertório</strong><span>${analysis.songCount ? "Familiaridade, segurança e desafio da equipe" : "Adicione músicas para ver a análise"}</span>`;
  panel.append(summary);
  if (analysis.songCount) panel.append(renderMetricStrip(analysis), renderHumanReading(analysis));
  return panel;
}

function renderMetricStrip(analysis) {
  const strip = document.createElement("div");
  strip.className = "metric-strip";
  getMetricItems(analysis).forEach((item) => {
    const tone = metricTone(item.toneScore == null ? item.score : item.toneScore);
    const pill = document.createElement("div");
    pill.className = `metric-pill ${tone}`;
    pill.innerHTML = `
      <strong>${item.icon} ${Math.round(item.score * 100)}%</strong>
      <span>${escapeHTML(item.label)}</span>
    `;
    strip.append(pill);
  });
  return strip;
}

function renderHumanReading(analysis) {
  const wrap = document.createElement("div");
  wrap.append(sectionHeader("Sobre este repertório", "Detalhes", "Sinais específicos deste culto"));

  const list = document.createElement("div");
  list.className = "insight-list";
  (analysis.notes || []).forEach((noteRaw) => {
    const note = normalizeInsightNote(noteRaw);
    const card = document.createElement("article");
    card.className = `insight-card ${note.tone}`;

    const visual = document.createElement("div");
    visual.className = "insight-visuals";
    const songs = renderInsightSongStack(note.songIds);
    const avatars = renderInsightAvatars(note.memberIds);
    if (!songs && !avatars) visual.classList.add("icon-only");
    if (!songs && avatars) visual.classList.add("people-only");

    const icon = document.createElement("span");
    icon.className = "insight-icon";
    icon.textContent = note.icon;
    visual.append(icon);
    if (songs) visual.append(songs);
    if (avatars) visual.append(avatars);

    const copy = document.createElement("div");
    copy.className = "insight-copy";
    const label = document.createElement("span");
    label.className = "insight-label";
    label.textContent = note.label;
    const text = document.createElement("p");
    text.className = "insight-text";
    text.textContent = note.text;
    copy.append(label, text);

    card.append(visual, copy);
    list.append(card);
  });
  wrap.append(list);
  return wrap;
}

function normalizeInsightNote(noteRaw) {
  if (typeof noteRaw === "string") {
    return {
      text: noteRaw,
      label: "Sinal",
      icon: "•",
      tone: "neutral",
      songIds: [],
      memberIds: [],
    };
  }

  return {
    text: noteRaw.text || "",
    label: noteRaw.label || "Sinal",
    icon: noteRaw.icon || "•",
    tone: noteRaw.tone || "neutral",
    songIds: Array.from(new Set(noteRaw.songIds || [])).filter((id) => getSong(id)).slice(0, 4),
    memberIds: Array.from(new Set(noteRaw.memberIds || [])).filter((id) => getMember(id)).slice(0, 5),
  };
}

function renderInsightSongStack(songIds) {
  if (!songIds || !songIds.length) return null;
  const stack = document.createElement("div");
  stack.className = "insight-song-stack";

  songIds.slice(0, 3).forEach((id) => {
    const song = getSong(id);
    if (!song) return;
    const thumb = document.createElement("div");
    thumb.className = "insight-song-thumb";
    thumb.title = song.titulo;
    thumb.innerHTML = `<img src="${songThumb(song)}" alt="${escapeAttr(song.titulo)}" onerror="this.src='artistas/default.jpg'" />`;
    stack.append(thumb);
  });

  if (songIds.length > 3) {
    const more = document.createElement("span");
    more.className = "insight-more";
    more.textContent = `+${songIds.length - 3}`;
    stack.append(more);
  }

  return stack.children.length ? stack : null;
}

function renderInsightAvatars(memberIds) {
  if (!memberIds || !memberIds.length) return null;
  const avatars = document.createElement("div");
  avatars.className = "insight-avatars";

  memberIds.slice(0, 5).forEach((id) => {
    const member = getMember(id);
    if (!member) return;
    const img = document.createElement("img");
    img.src = memberImg(member);
    img.alt = member.nome;
    img.onerror = () => (img.src = "integrantes/default.jpeg");
    avatars.append(img);
  });

  return avatars.children.length ? avatars : null;
}

function getMetricItems(analysis) {
  return [
    { icon: "🛡️", label: "Segurança", score: analysis.safety },
    { icon: "✨", label: "Familiaridade", score: analysis.familiarity },
    { icon: "🔥", label: "Desafio", score: analysis.challenge, toneScore: 1 - analysis.challenge },
    { icon: "🌱", label: "Renovação", score: analysis.renewal },
  ];
}

function metricTone(score) {
  if (score >= 0.7) return "good";
  if (score >= 0.45) return "warn";
  return "danger";
}

function renderMembers(culto, opts = {}) {
  const strip = document.createElement("div");
  strip.className = opts.agenda ? "member-grid agenda-member-grid" : "member-grid";
  const headerIds = getHeaderIds(culto);
  const ministerIds = getMinisterIds(culto);

  const memberIds = opts.agenda ? getAgendaMembers(culto).map(member => member.id) : (culto.integrantes || []);
  memberIds.forEach((id) => {
    const member = getMember(id);
    if (!member) return;
    const pill = document.createElement("div");
    pill.className = "member-pill";
    pill.innerHTML = `
      <div class="member-avatar-wrap">
        <img class="member-avatar" src="${memberImg(member)}" alt="${escapeAttr(member.nome)}" onerror="this.src='integrantes/default.jpeg'" />
      </div>
    `;
    const identity = div("member-identity");
    const roles = [headerIds.includes(id) ? "Header" : "", ministerIds.includes(id) ? "Ministrante" : ""].filter(Boolean);
    identity.innerHTML = `<strong>${escapeHTML(member.nome)}</strong><span>${escapeHTML(roles.join(" · ") || "Integrante")}</span>`;
    pill.append(identity);
    strip.append(pill);
  });

  if (!strip.children.length) strip.append(emptyState("Nenhum integrante definido."));
  return strip;
}

function renderSuggestionCompare(culto, suggestions) {
  const wrap = document.createElement("div");
  wrap.append(sectionHeader("Sugestões de repertório", "Ponto de partida", "Escolha um trio e ajuste na revisão. A sugestão substitui as músicas do rascunho."));

  if (!suggestions.length) {
    wrap.append(emptyState("Sem sugestões disponíveis com as regras atuais."));
    return wrap;
  }

  const grid = document.createElement("div");
  grid.className = "playlist-grid";
  suggestions.forEach((suggestion) => {
    const card = document.createElement("article");
    card.className = "playlist-card";
    card.innerHTML = `
      <div>
        <p class="mini-kicker">${escapeHTML(suggestion.category || "Mista")}</p>
        <h4>${escapeHTML(suggestion.title)}</h4>
      </div>
    `;
    card.append(renderComparisonBars(suggestion.analysis));
    card.append(renderTrackList(suggestion.songIds, { culto, compact: true, action: "open" }));
    card.append(button("Usar como rascunho", "pill-button", () => {
      setDraft(cultKey(culto), suggestion.songIds);
      openBuilder(culto);
      toast("Sugestão aplicada ao rascunho.");
    }));
    grid.append(card);
  });

  wrap.append(grid);
  return wrap;
}

function renderComparisonBars(analysis) {
  const box = document.createElement("div");
  box.className = "comparison-bars";
  [
    ["Segurança", analysis.safety, analysis.safety],
    ["Familiaridade", analysis.familiarity, analysis.familiarity],
    ["Desafio", analysis.challenge, 1 - analysis.challenge],
    ["Renovação", analysis.renewal, analysis.renewal],
  ].forEach(([label, score, toneScore]) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span>${label}</span>
      <div class="meter ${toneScore < 0.45 ? "danger" : toneScore < 0.7 ? "warn" : ""}">
        <span style="width:${Math.round(score * 100)}%"></span>
      </div>
      <strong>${Math.round(score * 100)}%</strong>
    `;
    box.append(row);
  });
  return box;
}

function renderBuilder() {
  const culto = getCultByKey(state.builderCult);
  const ids = getDraft(cultKey(culto), culto);
  const panel = div("builder-workspace");
  const header = div("builder-context");
  header.append(button("Concluir e sair", "ghost-button", () => { ui.building = false; setView("repertorio"); }));
  const context = div("builder-context-copy");
  context.innerHTML = `<strong>${escapeHTML(formatDateLong(culto.dataObj))}</strong><span>Rascunho salvo neste navegador</span>`;
  header.append(context); panel.append(header);
  const tabs = div("segmented-control"); tabs.setAttribute("aria-label", "Etapas da montagem");
  [["selected", "Selecionadas"], ["add", "Adicionar"], ["suggestions", "Sugestões"]].forEach(([key, label]) => {
    const btn = button(label, ui.builderTab === key ? "segment active" : "segment", () => { ui.builderTab = key; renderRepertorio(); });
    btn.setAttribute("aria-pressed", String(ui.builderTab === key)); tabs.append(btn);
  });
  panel.append(tabs);
  const feedback = div("builder-feedback"); feedback.id = "builderFeedback"; feedback.setAttribute("role", "status"); panel.append(feedback);
  if (ui.builderTab === "selected") {
    panel.append(sectionHeader("Seu repertório", "Revisão", "A ordem abaixo será usada ao copiar o rascunho."));
    if (ids.length) {
      panel.append(renderTrackList(ids, { culto, action: "remove", builder: true }));
      const actions = div("service-actions");
      actions.append(button("Copiar rascunho", "pill-button", () => copyScale({ ...culto, musicas: ids })), button("Limpar rascunho", "ghost-button", () => {
        setDraft(cultKey(culto), []); renderRepertorio(); toast("Rascunho limpo.");
      }));
      panel.append(actions, renderAnalysisBlock(analyzeSet(culto, ids)));
    } else {
      panel.append(emptyState("Seu repertório começa com uma música."), button("Escolher músicas", "pill-button", () => { ui.builderTab = "add"; renderRepertorio(); }));
    }
  } else if (ui.builderTab === "suggestions") {
    panel.append(renderSuggestionCompare(culto, generateSuggestedPlaylists(culto)));
  }
  const dock = document.getElementById("builderDock");
  const count = div("dock-count"); count.innerHTML = `<strong>${ids.length} música${ids.length === 1 ? "" : "s"}</strong><span>no rascunho</span>`;
  dock.append(count, button(ui.builderTab === "selected" ? "Adicionar músicas" : "Revisar repertório", "pill-button", () => {
    ui.builderTab = ui.builderTab === "selected" ? "add" : "selected"; renderRepertorio(); window.scrollTo({ top: 0, behavior: "instant" });
  }));
  return panel;
}

function renderLibraryControls() {
  const controls = div("music-controls");
  controls.innerHTML = `<label class="search-label" for="librarySearch">Buscar música ou artista</label>
    <div class="search-row"><input id="librarySearch" class="input" type="search" placeholder="Título, artista ou categoria" value="${escapeAttr(state.librarySearch)}" autocomplete="off" />
    <button class="ghost-button" id="toggleFilters" aria-expanded="${ui.filtersOpen}" aria-controls="musicFilters">Filtros</button></div>
    <div id="musicFilters" class="music-filters" ${ui.filtersOpen ? "" : "hidden"}>
      <label>Categoria<select id="libraryCategory" class="select"><option value="all">Todas as categorias</option>${categorias.map(cat => `<option value="${escapeAttr(cat)}" ${cat === state.libraryCategory ? "selected" : ""}>${escapeHTML(cat)}</option>`).join("")}</select></label>
      <label>Disponibilidade<select id="libraryStatus" class="select">${[["all", "Todas as músicas"], ["available", "Disponíveis"], ["recent", "Bloqueadas pelo intervalo"], ["future", "Agendadas"], ["banned", "Banidas"]].map(([key,label]) => `<option value="${key}" ${key === state.libraryStatus ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <label>Intensidade<select id="libraryIntensity" class="select">${[["all", "Todas as intensidades"], ["baixa", "Baixa"], ["media", "Média"], ["alta", "Alta"], ["unset", "Não informada"]].map(([key,label]) => `<option value="${key}" ${key === state.libraryIntensity ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <button class="ghost-button" id="clearMusicFilters">Limpar filtros</button>
    </div>`;
  controls.querySelector("#toggleFilters").addEventListener("click", ev => {
    ui.filtersOpen = !ui.filtersOpen; controls.querySelector("#musicFilters").hidden = !ui.filtersOpen; ev.currentTarget.setAttribute("aria-expanded", String(ui.filtersOpen));
  });
  controls.querySelector("#librarySearch").addEventListener("input", ev => {
    state.librarySearch = ev.target.value; localStorage.setItem(STORAGE.librarySearch, state.librarySearch); renderLibraryResults();
  });
  [["libraryCategory", STORAGE.libraryCategory], ["libraryStatus", STORAGE.libraryStatus], ["libraryIntensity", STORAGE.libraryIntensity]].forEach(([key, storage]) => {
    controls.querySelector(`#${key}`).addEventListener("change", ev => { state[key] = ev.target.value; localStorage.setItem(storage, state[key]); renderLibraryResults(); });
  });
  controls.querySelector("#clearMusicFilters").addEventListener("click", () => {
    state.libraryCategory = state.libraryStatus = state.libraryIntensity = "all";
    ["libraryCategory", "libraryStatus", "libraryIntensity"].forEach(key => { localStorage.setItem(STORAGE[key], "all"); controls.querySelector(`#${key}`).value = "all"; });
    renderLibraryResults();
  });
  return controls;
}

function renderLibraryTrackList(songs) {
  const list = div("song-list");
  const culto = ui.building ? getCultByKey(state.builderCult) : null;
  songs.forEach(song => list.append(renderSongCard(song, { culto, library: true })));
  return list;
}

function renderSongDetails(song) {
  const body = div("music-detail-content");
  const culto = ui.detailCult || null;
  const ref = culto ? culto.dataObj : today();
  const last = getLastPlayedBefore(song.id, ref);
  const next = getNextScheduledOnOrAfter(song.id, today());
  const status = getSongStatus(song.id, culto);
  const statusIcon = { available: "check", recent: "clock", future: "calendar", banned: "ban" }[status.status];

  const hero = div("song-profile-hero");
  hero.innerHTML = `${songArtworkHTML(song, "detail-artwork")}<div class="song-profile-heading"><p>${musicIcon("artist")}<span>${escapeHTML(song.artista)}</span></p><h2 id="songDetailTitle">${escapeHTML(song.titulo)}</h2></div>`;
  const toolbar = div("song-profile-actions");
  toolbar.append(renderSongQualifications(song));
  if (song.referLink) toolbar.append(musicAction("Ouvir", "play", "pill-button listen-button", () => openYoutube(song)));
  body.append(hero, toolbar);

  const availability = div(`availability-note availability-${status.status}`);
  const statusLabel = { available: "Disponível", recent: "Bloqueada", future: "Agendada", banned: "Banida" }[status.status];
  const release = getSongReleaseInfo(song.id, culto);
  availability.innerHTML = `<span class="availability-symbol">${musicIcon(statusIcon)}</span><div><strong>${statusLabel}</strong>${release ? `<span>Libera em ${release.days} ${release.days === 1 ? "dia" : "dias"}</span>` : ""}</div>`;
  body.append(availability, renderIntensityPanel(song));

  const categories = detailPanel("Categorias", "tag");
  const tags = div("song-tags");
  song.categorias.forEach(category => tags.append(musicBadge(category, "category")));
  categories.append(tags.children.length ? tags : div("muted-line", "Sem categorias cadastradas."));
  body.append(categories);

  const technical = detailPanel("Dificuldade por instrumento", "level2");
  const levels = document.createElement("dl"); levels.className = "instrument-tiles";
  const icons = { vocal: "mic", voz: "mic", guitarra: "strings", baixo: "strings", violao: "strings", bateria: "drums", teclado: "keys", sax: "music" };
  Object.entries(song.level || {}).filter(([, level]) => level).forEach(([inst, level]) => {
    const key = normalizeInstrument(inst);
    const row = div(`instrument-tile instrument-${level}`);
    row.innerHTML = `<dt>${musicIcon(icons[key] || "music")}<span>${escapeHTML(formatInstrument(key))}</span></dt><dd><span class="instrument-meter" aria-hidden="true">${[1, 2, 3].map(n => `<i class="${n <= levelValue(level) ? "filled" : ""}"></i>`).join("")}</span><span>${escapeHTML(levelLabel(level))}</span></dd>`;
    levels.append(row);
  });
  technical.append(levels.children.length ? levels : div("muted-line", "Dificuldades ainda não cadastradas."));
  body.append(technical);

  const history = detailPanel("Histórico", "clock");
  const count = div("song-play-count");
  count.innerHTML = `${musicIcon("repeat")}<strong>${getTotalExecucoes(song.id)}</strong><span>execuções da música</span>`;
  const timeline = document.createElement("dl"); timeline.className = "song-timeline";
  [["Última execução", last ? formatDateCompact(last) : "Nunca tocada", "clock"], ["Próximo agendamento", next ? formatDateCompact(next) : "Não agendada", "calendar"]].forEach(([label, value, icon]) => {
    const row = div("timeline-entry");
    row.innerHTML = `<dt>${musicIcon(icon)}<span>${label}</span></dt><dd>${escapeHTML(value)}</dd>`;
    timeline.append(row);
  });
  history.append(count, timeline);

  const stats = document.createElement("details"); stats.className = "catalog-stats";
  stats.innerHTML = `<summary>${musicIcon("spark")}<span>No repertório da banda</span><span class="disclosure-mark" aria-hidden="true">+</span></summary><dl><div><dt>Execuções do artista</dt><dd>${getArtistExecucoes(song.artista)}</dd></div><div><dt>Execuções por categoria <small>Menor total entre as categorias desta música</small></dt><dd>${getCategoryExecucoes(song)}</dd></div></dl>`;
  history.append(stats); body.append(history, renderSongMemberInsights(song.id));
  return body;
}

function renderTrackList(ids, opts = {}) {
  const list = div("song-list");
  const songs = ids.map(getSong).filter(Boolean);
  if (!songs.length) { list.append(emptyState("A seleção de músicas ainda está em aberto.")); return list; }
  songs.forEach((song, index) => list.append(renderSongCard(song, { ...opts, index, total: songs.length })));
  return list;
}

function addSongFromLibrary(song) {
  const culto = getCultByKey(state.builderCult);
  if (!culto) {
    toast("Selecione um culto em aberto antes de adicionar musicas.");
    return;
  }

  const key = cultKey(culto);
  const draft = getDraft(key, culto);
  if (draft.includes(song.id)) {
    toast("Essa musica ja esta no rascunho.");
    return;
  }

  const status = getSongStatus(song.id, culto);
  const nextDraft = [...draft, song.id];
  if (hasDisjointCategoryTriple(nextDraft)) {
    showBuilderFeedback("Não foi possível adicionar: em cada trio, pelo menos duas músicas precisam compartilhar uma categoria.");
    return;
  }

  setDraft(key, nextDraft);
  if (status.status !== "available") {
    toast(`Adicionada com alerta: ${song.titulo} esta ${status.label.toLowerCase()}.`);
  } else {
    toast(`${song.titulo} adicionada ao rascunho.`);
  }
  refreshSelection(song.id);
}

function removeFromDraft(songId) {
  const culto = getCultByKey(state.builderCult);
  if (!culto) return;
  const key = cultKey(culto);
  setDraft(
    key,
    getDraft(key, culto).filter((id) => id !== songId),
  );
  refreshSelection(songId);
}

function openBuilder(culto) {
  state.builderCult = cultKey(culto);
  localStorage.setItem(STORAGE.builderCult, state.builderCult);
  ui.building = true; ui.builderTab = "selected";
  setView("repertorio");
}

function getDraft(key, culto = null) {
  if (Array.isArray(state.builderDrafts[key])) return state.builderDrafts[key];
  return culto && Array.isArray(culto.musicas) ? culto.musicas.slice() : [];
}

function setDraft(key, ids) {
  state.builderDrafts[key] = ids;
  localStorage.setItem(STORAGE.builderDrafts, JSON.stringify(state.builderDrafts));
}

function analyzeSet(culto, ids) {
  const serviceDate = (culto && culto.dataObj) || parseDate(culto && culto.data);
  const songs = (ids || []).map(getSong).filter(Boolean);
  const members = ((culto && culto.integrantes) || []).map(getMember).filter(Boolean);
  const pastEvents = historico.filter((ev) => ev.dataObj && serviceDate && ev.dataObj < serviceDate);

  if (!songs.length) {
    return {
      songCount: 0,
      category: null,
      summary: "Ainda sem musicas para analisar.",
      safety: 0,
      familiarity: 0,
      challenge: 0,
      renewal: 0,
      safetyText: "Sem repertorio definido.",
      familiarityText: "Adicione musicas para medir memoria do time.",
      challengeText: "Sem dificuldade calculada.",
      renewalText: "Sem renovacao calculada.",
      notes: [{ text: "Escolha musicas na biblioteca para receber analise dinamica.", label: "Rascunho", icon: "🎧", tone: "neutral", memberIds: [] }],
    };
  }

  const category = getDominantCategory(songs);
  const diffValues = songs.map(songDifficultyValue).filter((v) => v > 0);
  const diffAvg = avg(diffValues) || 1.8;
  const diffMax = Math.max(...diffValues, 0);
  const blocked = songs.map((song) => ({ song, status: getSongStatus(song.id, culto) })).filter((x) => x.status.status !== "available");
  const popCounts = countBy(songs.map((song) => getPopularity(song.id).nivel));
  const newSongs = songs.filter((song) => getTotalExecucoes(song.id) === 0);
  const rareSongs = songs.filter((song) => getPopularity(song.id).nivel === "rare");

  const memberSongStats = buildMemberSongStats(songs, members, pastEvents);
  const familiarity = clamp01(
    0.5 * avg(memberSongStats.map((x) => x.coverage)) +
      0.3 * avg(memberSongStats.map((x) => x.meanExposure)) +
      0.2 * Math.min(1, avg(songs.map((s) => getTotalExecucoes(s.id))) / 5),
  );
  const challenge = clamp01(0.45 * ((diffAvg - 1) / 2) + 0.35 * technicalChallenge(songs, members) + 0.2 * Math.max(0, blocked.length / songs.length));
  const renewal = clamp01(
    0.38 * (rareSongs.length / songs.length) +
      0.32 * (newSongs.length / songs.length) +
      0.18 * (1 - Math.min(1, avg(songs.map((s) => getTotalExecucoes(s.id))) / 6)) +
      0.12 * (category && category.strength === "strong" ? 0.35 : 0.75),
  );
  const safety = clamp01(0.52 * (1 - challenge) + 0.32 * familiarity + 0.16 * (1 - Math.min(renewal, 0.82)));
  const cooc = cooccurrenceNotes(songs, pastEvents);

  const notes = [];
  const addNote = (text, opts = {}) => {
    notes.push({
      text,
      label: opts.label || "Sinal",
      icon: opts.icon || "•",
      tone: opts.tone || "neutral",
      songIds: opts.songIds || [],
      memberIds: opts.memberIds || [],
    });
  };

  const songIds = songs.map((song) => song.id);
  const memberIds = members.map((member) => member.id);
  const hardSongs = songs.filter((song) => songDifficultyValue(song) >= 2.5);
  const classicSongs = songs.filter((song) => getPopularity(song.id).nivel === "classic");
  if (blocked.length) {
    blocked.forEach(({ song, status }) => {
      addNote(`Alerta forte: ${song.titulo} esta ${status.label.toLowerCase()} e deve ser usada conscientemente.`, {
        label: "Agenda",
        icon: "!",
        tone: "danger",
        songIds: [song.id],
      });
    });
  }
  if (diffMax >= 2.5) {
    addNote("Existe pelo menos uma musica tecnicamente dificil no set.", {
      label: "Tecnica",
      icon: "🔥",
      tone: "warn",
      songIds: hardSongs.map((song) => song.id),
      memberIds,
    });
  }
  if (newSongs.length) {
    addNote(`${newSongs.length} musica(s) nova(s) para o time.`, {
      label: "Novidade",
      icon: "🌱",
      tone: "info",
      songIds: newSongs.map((song) => song.id),
      memberIds,
    });
  }
  if (rareSongs.length) {
    addNote(`${rareSongs.length} musica(s) incomum(ns), bom para oxigenar o repertorio.`, {
      label: "Oxigenacao",
      icon: "✨",
      tone: "info",
      songIds: rareSongs.map((song) => song.id),
    });
  }
  if ((popCounts.classic || 0) >= 2 && safety >= 0.6) {
    addNote("O set tem colchao de musicas classicas, o que ajuda a banda a tocar com mais previsibilidade.", {
      label: "Segurança",
      icon: "🛡️",
      tone: "good",
      songIds: classicSongs.map((song) => song.id),
    });
  }
  if (familiarity < 0.35 && challenge > 0.45) {
    addNote("A combinacao de pouca familiaridade com desafio tecnico pede ensaio mais objetivo.", {
      label: "Ensaio",
      icon: "🎯",
      tone: "warn",
      songIds,
      memberIds,
    });
  }
  if (familiarity >= 0.65 && challenge <= 0.38) {
    addNote("A memoria do time esta a favor; da para investir mais em dinamica e transicoes.", {
      label: "Memoria",
      icon: "✨",
      tone: "good",
      songIds,
      memberIds,
    });
  }
  if (renewal >= 0.62 && safety < 0.52) {
    addNote("O set tem cheiro de renovacao, mas precisa de combinados claros antes de chegar no culto.", {
      label: "Renovação",
      icon: "🌱",
      tone: "warn",
      songIds,
      memberIds,
    });
  }
  memberSongStats
    .filter((s) => s.topPlayers.length)
    .slice(0, 4)
    .forEach((stat) => {
      const total = stat.topPlayers.reduce((sum, member) => sum + member.count, 0);
      const phrase = stat.topPlayers.length === 1 ? "Uma pessoa da escala ja tocou" : "Algumas pessoas da escala ja tocaram";
      addNote(`${phrase} "${stat.song.titulo}" ${total}x no historico.`, {
        label: "Familiaridade",
        icon: "👥",
        tone: "good",
        songIds: [stat.song.id],
        memberIds: stat.topPlayers.map((p) => p.id),
      });
    });
  memberSongStats
    .filter((s) => s.never.length)
    .slice(0, 3)
    .forEach((s) => {
      addNote(`Algumas pessoas desta escala ainda nao tocaram "${s.song.titulo}".`, {
        label: "Primeiro contato",
        icon: "🎧",
        tone: "warn",
        songIds: [s.song.id],
        memberIds: s.neverIds.slice(0, 5),
      });
    });
  cooc.forEach((note) => notes.push(note));
  if (!notes.length) {
    addNote("Set equilibrado, sem alertas fortes pelos dados atuais.", {
      label: "Equilibrio",
      icon: "✓",
      tone: "good",
      songIds,
      memberIds,
    });
  }

  return {
    songCount: songs.length,
    category: (category && category.name) || null,
    summary: safety >= 0.7 ? "O set parece operacionalmente seguro." : safety >= 0.45 ? "O set parece viavel, mas pede atencao." : "O set esta arriscado para o dia.",
    safety,
    familiarity,
    challenge,
    renewal,
    safetyText: scoreText(safety, "Muito segura", "Moderada", "Arriscada"),
    familiarityText: scoreText(familiarity, "Muito familiar", "Familiar", "Pouco familiar"),
    challengeText: scoreText(challenge, "Alto", "Moderado", "Baixo"),
    renewalText: scoreText(renewal, "Alta", "Moderada", "Baixa"),
    notes,
    popCounts,
    diffAvg,
  };
}

function buildMemberSongStats(songs, members, events) {
  return songs.map((song) => {
    const counts = members.map((member) => {
      const count = events.filter(
        (ev) => (ev.integrantes || []).includes(member.id) && (ev.musicas || []).includes(song.id),
      ).length;
      return { ...member, count };
    });
    const played = counts.filter((x) => x.count > 0);
    const coverage = members.length ? played.length / members.length : 0.5;
    const meanExposure = counts.length ? avg(counts.map((x) => Math.min(1, x.count / 3))) : 0.5;
    return {
      song,
      coverage,
      meanExposure,
      topPlayers: played.sort((a, b) => b.count - a.count).slice(0, 2),
      never: counts.filter((x) => !x.count).map((x) => x.nome),
      neverIds: counts.filter((x) => !x.count).map((x) => x.id),
    };
  });
}

function technicalChallenge(songs, members) {
  if (!songs.length) return 0;
  const bestByInstrument = new Map();
  members.forEach((member) => {
    getMemberLevels(member).forEach(([inst, level]) => {
      const current = bestByInstrument.get(inst) || 0;
      bestByInstrument.set(inst, Math.max(current, levelValue(level)));
    });
  });

  const tensions = [];
  songs.forEach((song) => {
    Object.entries(song.level || {}).forEach(([rawInst, rawLevel]) => {
      if (!rawLevel) return;
      const inst = normalizeInstrument(rawInst);
      const required = levelValue(rawLevel) || 2;
      const available = bestByInstrument.get(inst) || 2;
      tensions.push(required <= available ? 0 : clamp01((required - available) / 2));
    });
  });
  return avg(tensions) || 0.4;
}

function cooccurrenceNotes(songs, events) {
  const notes = [];
  for (let i = 0; i < songs.length; i++) {
    for (let j = i + 1; j < songs.length; j++) {
      const count = events.filter((ev) => {
        const ids = ev.musicas || [];
        return ids.includes(songs[i].id) && ids.includes(songs[j].id);
      }).length;
      if (count >= 2) {
        notes.push({
          text: `"${songs[i].titulo}" e "${songs[j].titulo}" ja apareceram juntas ${count}x; isso e bom para continuidade do set.`,
          label: "Combina bem",
          icon: "↔",
          tone: "good",
          songIds: [songs[i].id, songs[j].id],
          memberIds: [],
        });
      }
    }
  }
  return notes.slice(0, 3);
}

function generateSuggestedPlaylists(culto) {
  const strategies = [
    { key: "favoritas", title: "Favoritas do Time", weights: { fam: 1.2, safe: 0.9, renew: 0.1, challenge: -0.2, pop: 0.8 } },
    { key: "facil", title: "Fácil", weights: { fam: 0.9, safe: 1.25, renew: 0.1, challenge: -0.8, pop: 0.4 } },
    { key: "mediano", title: "Mediano", weights: { fam: 0.7, safe: 0.8, renew: 0.45, challenge: 0.05, pop: 0.3 } },
    { key: "desafiador", title: "Desafiador", weights: { fam: 0.2, safe: 0.15, renew: 0.5, challenge: 1.1, pop: -0.1 } },
    { key: "renovacao", title: "Renovação", weights: { fam: 0.15, safe: 0.25, renew: 1.25, challenge: 0.25, pop: -0.4 } },
  ];

  const usedKeys = new Set();
  const suggestions = [];

  strategies.forEach((strategy) => {
    const suggestion = buildSuggestion(culto, strategy, usedKeys);
    if (!suggestion) return;
    usedKeys.add(repertoireKey(suggestion.songIds));
    suggestions.push(suggestion);
  });

  return suggestions.slice(0, 5);
}

function buildSuggestion(culto, strategy, usedKeys = new Set()) {
  const date = culto.dataObj || parseDate(culto.data);
  const candidates = musicas
    .filter((song) => isSuggestionEligible(song, date))
    .map((song) => ({ song, score: suggestionSongScore(song, culto, strategy) }))
    .sort((a, b) => b.score - a.score);

  const groups = new Map();
  candidates.forEach((item) => {
    item.song.categorias.forEach((cat) => {
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(item);
    });
  });

  const groupOptions = Array.from(groups.entries())
    .filter(([, items]) => items.length >= 3)
    .map(([cat, items]) => ({
      cat,
      items: items.slice(0, 4),
      score: avg(items.slice(0, 3).map((x) => x.score)),
    }))
    .sort((a, b) => b.score - a.score);

  const options = [];
  groupOptions.forEach((group) => {
    buildSuggestionTriples(group.items, 8).forEach((songs) => options.push(songs));
  });
  buildSuggestionTriples(candidates.slice(0, 10), 20).forEach((songs) => options.push(songs));

  const triedKeys = new Set();
  for (const chosen of options) {
    const chosenIds = chosen.map((s) => s.id);
    const key = repertoireKey(chosenIds);
    if (triedKeys.has(key) || usedKeys.has(key)) continue;
    triedKeys.add(key);
    if (chosen.length < 3 || hasDisjointCategoryTriple(chosenIds)) continue;

    const analysis = analyzeSet({ ...culto, musicas: chosenIds }, chosenIds);
    return {
      title: strategy.title,
      category: analysis.category,
      songIds: chosenIds,
      analysis,
    };
  }

  return null;
}

function buildSuggestionTriples(items, limit) {
  if (!Array.isArray(items) || items.length < 3) return [];
  const triples = [];

  for (let i = 0; i < items.length - 2; i++) {
    for (let j = i + 1; j < items.length - 1; j++) {
      for (let k = j + 1; k < items.length; k++) {
        triples.push({
          songs: [items[i].song, items[j].song, items[k].song],
          score: avg([items[i].score, items[j].score, items[k].score]),
        });
      }
    }
  }

  return triples
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((option) => option.songs);
}

function repertoireKey(ids) {
  return (ids || []).slice().sort((a, b) => a - b).join("|");
}

function suggestionSongScore(song, culto, strategy) {
  const tempAnalysis = analyzeSet({ ...culto, musicas: [song.id] }, [song.id]);
  const pop = getPopularity(song.id).nivel;
  const popScore = pop === "classic" ? 1 : pop === "common" ? 0.55 : 0.15;
  const challengeScore = tempAnalysis.challenge;
  const w = strategy.weights;
  return (
    w.fam * tempAnalysis.familiarity +
    w.safe * tempAnalysis.safety +
    w.renew * tempAnalysis.renewal +
    w.challenge * challengeScore +
    w.pop * popScore
  );
}

function isSuggestionEligible(song, date) {
  if (song.banned || song.ban) return false;
  const last = getLastPlayedBefore(song.id, date);
  if (last && daysBetween(last, date) <= COOLDOWN_DAYS) return false;
  const next = getNextScheduledOnOrAfter(song.id, today());
  if (next && (!date || next.getTime() !== date.getTime())) return false;
  return true;
}

function getFilteredSongs() {
  const q = normalizeText(state.librarySearch);
  const selectedCategories = getCurrentDraftCategorySet();
  const filtered = musicas.filter((song) => {
    const status = getSongStatus(song.id, ui.building ? getCultByKey(state.builderCult) : null).status;
    if (state.libraryStatus !== "all" && status !== state.libraryStatus) return false;
    if (state.libraryCategory !== "all" && !song.categorias.includes(state.libraryCategory)) return false;
    if (state.libraryIntensity !== "all" && (song.intensidade || "unset") !== state.libraryIntensity) return false;
    if (q) {
      const hay = normalizeText(`${song.titulo} ${song.artista} ${song.categorias.join(" ")}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (ui.building) return filtered.sort((a, b) => compareBuilderSongs(a, b, selectedCategories));

  // Compute each sort key once; filters retain the same cycle ordering.
  const order = { available: 0, recent: 1, future: 2, banned: 3 };
  const now = today();
  return filtered.map(song => {
    const status = getSongStatus(song.id).status;
    const position = status === "available" ? getTotalExecucoes(song.id)
      : status === "recent" ? getLastPlayedBefore(song.id, now).getTime()
      : status === "future" ? getNextScheduledOnOrAfter(song.id, now).getTime() : 0;
    return { song, group: order[status], position };
  }).sort((a, b) => a.group - b.group || a.position - b.position || a.song.titulo.localeCompare(b.song.titulo, "pt-BR") || a.song.id - b.song.id)
    .map(item => item.song);
}

function compareBuilderSongs(a, b, selectedCategories = new Set()) {
  const aShared = sharedCategoryCount(a, selectedCategories);
  const bShared = sharedCategoryCount(b, selectedCategories);
  return (
    Number(bShared > 0) - Number(aShared > 0) ||
    bShared - aShared ||
    getTotalExecucoes(a.id) - getTotalExecucoes(b.id) ||
    getArtistExecucoes(a.artista) - getArtistExecucoes(b.artista) ||
    getCategoryExecucoes(a) - getCategoryExecucoes(b) ||
    a.titulo.localeCompare(b.titulo)
  );
}

function getCurrentDraftCategorySet() {
  if (!ui.building) return new Set();
  const culto = getCultByKey(state.builderCult);
  if (!culto) return new Set();
  const ids = getDraft(cultKey(culto), culto);
  const cats = ids
    .map(getSong)
    .filter(Boolean)
    .flatMap((song) => song.categorias);
  return new Set(cats);
}

function sharedCategoryCount(song, categories) {
  if (!categories || !categories.size) return 0;
  return song.categorias.filter((cat) => categories.has(cat)).length;
}

function hasDisjointCategoryTriple(ids) {
  const songs = ids.map(getSong).filter(Boolean);
  if (songs.length < 3) return false;

  for (let i = 0; i < songs.length; i++) {
    for (let j = i + 1; j < songs.length; j++) {
      for (let k = j + 1; k < songs.length; k++) {
        const trio = [songs[i], songs[j], songs[k]];
        const hasSharedPair =
          songsShareCategory(trio[0], trio[1]) ||
          songsShareCategory(trio[0], trio[2]) ||
          songsShareCategory(trio[1], trio[2]);
        if (!hasSharedPair) return true;
      }
    }
  }
  return false;
}

function songsShareCategory(a, b) {
  return a.categorias.some((cat) => b.categorias.includes(cat));
}

function computeWrapped(events) {
  const selectedMember = state.wrappedMember === "all" ? null : Number(state.wrappedMember);
  const songCounts = new Map();
  const artistCounts = new Map();
  const chosenSongCounts = new Map();
  const chosenArtistCounts = new Map();
  const memberCounts = new Map();
  const pairCounts = new Map();
  let totalExecucoes = 0;

  events.forEach((ev) => {
    const members = ev.integrantes || [];
    const headers = ev.header || [];
    const playedRelevant = !selectedMember || members.includes(selectedMember);
    const chosenRelevant = !selectedMember || headers.includes(selectedMember);

    if (playedRelevant) {
      members.forEach((id) => memberCounts.set(id, (memberCounts.get(id) || 0) + 1));
      if (selectedMember) {
        members
          .filter((id) => id !== selectedMember)
          .forEach((id) => {
            const key = [selectedMember, id].sort((a, b) => a - b).join("|");
            pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
          });
      } else {
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            const key = [members[i], members[j]].sort((a, b) => a - b).join("|");
            pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
          }
        }
      }
    }

    (ev.musicas || []).forEach((id) => {
      const song = getSong(id);
      if (!song) return;
      if (playedRelevant) {
        totalExecucoes++;
        songCounts.set(id, (songCounts.get(id) || 0) + 1);
        artistCounts.set(song.artista, (artistCounts.get(song.artista) || 0) + 1);
      }
      if (chosenRelevant) {
        chosenSongCounts.set(id, (chosenSongCounts.get(id) || 0) + 1);
        chosenArtistCounts.set(song.artista, (chosenArtistCounts.get(song.artista) || 0) + 1);
      }
    });
  });

  return {
    totalCultos: events.length,
    totalExecucoes,
    uniqueSongs: songCounts.size,
    topSongs: rankMap(songCounts, (id) => songLabel(id)),
    topArtists: rankMap(artistCounts, (name) => name),
    topChosenSongs: rankMap(chosenSongCounts, (id) => songLabel(id)),
    topChosenArtists: rankMap(chosenArtistCounts, (name) => name),
    topMembers: rankMap(memberCounts, (id) => (getMember(id) && getMember(id).nome) || `Integrante ${id}`),
    topPairs: rankPairs(pairCounts),
  };
}

function getWrappedEvents(ignoreMemberFilter = false) {
  const period = getWrappedPeriod();
  let events = historico.filter((ev) => ev.dataObj && ev.dataObj < today() && Array.isArray(ev.musicas) && ev.musicas.length);
  const start = new Date(`${period.start}T00:00:00`);
  const end = new Date(`${period.end}T23:59:59`);
  events = events.filter((ev) => ev.dataObj >= start && ev.dataObj <= end);
  if (!ignoreMemberFilter && state.wrappedMember !== "all") {
    const memberId = Number(state.wrappedMember);
    events = events.filter((ev) => (ev.integrantes || []).includes(memberId) || (ev.header || []).includes(memberId));
  }
  return events;
}

function getWrappedPeriod() {
  const year = today().getFullYear();
  return {
    start: state.wrappedStart || `${year}-01-01`,
    end: state.wrappedEnd || `${year}-12-31`,
  };
}

function normalizeSongs(raw) {
  return raw.map((song) => ({
    ...song,
    categorias: parseCategories(song.categorias),
    intensidade: normalizeIntensity(song.intensidade),
    _thumb: song.referLink ? `https://img.youtube.com/vi/${song.referLink}/0.jpg` : "artistas/default.jpg",
    _artistImage: `artistas/${slugify(song.artista || "")}.jpg`,
    banned: song.banned === true || song.ban === true,
  }));
}

function normalizeHistory(raw) {
  return raw.map((ev) => ({
    ...ev,
    dataObj: parseDate(ev.data),
    integrantes: Array.isArray(ev.integrantes) ? ev.integrantes : [],
    musicas: Array.isArray(ev.musicas) ? ev.musicas : [],
    header: Array.isArray(ev.header) ? ev.header : [],
    minister: Array.isArray(ev.minister) ? ev.minister : [],
  }));
}

function parseCategories(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  return String(raw)
    .replaceAll(",", ";")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
}

function getUniqueCategories(songs) {
  return Array.from(new Set(songs.flatMap((song) => song.categorias))).sort((a, b) => a.localeCompare(b));
}

function getNextCulto() {
  return getFutureCultos()[0] || null;
}

function getFutureCultos() {
  const now = today();
  return historico
    .filter((ev) => ev.dataObj && ev.dataObj >= now)
    .sort((a, b) => a.dataObj - b.dataObj);
}

function getBuilderCultos() {
  return getFutureCultos();
}

function getCultByKey(key) {
  return historico.find((ev) => cultKey(ev) === key) || null;
}

function cultKey(culto) {
  return (culto && culto.data) || "";
}

function getSong(id) {
  return musicas.find((song) => song.id === id) || null;
}

function getMember(id) {
  return integrantes.find((member) => member.id === id) || null;
}

function getSongStatus(id, contextCulto = null) {
  const song = getSong(id);
  if (!song) return { status: "available", label: "Disponivel" };
  if (song.banned || song.ban) return { status: "banned", label: "Banida" };
  const contextDate = contextCulto && contextCulto.dataObj ? contextCulto.dataObj : null;
  const next = getNextScheduledOnOrAfter(id, today());
  if (next && !(contextDate && sameDay(next, contextDate))) return { status: "future", label: "Agendada" };
  const refDate = contextDate || today();
  const last = getLastPlayedBefore(id, refDate);
  if (last && daysBetween(last, refDate) <= COOLDOWN_DAYS) return { status: "recent", label: "Recente" };
  return { status: "available", label: "Disponivel" };
}

function getSongReleaseInfo(id, contextCulto = null) {
  const status = getSongStatus(id, contextCulto).status;
  if (status !== "recent" && status !== "future") return null;
  const now = today();
  let anchor;
  if (status === "future") {
    // Every known future booking extends the cycle; use the final booking.
    const scheduled = historico.filter(ev => ev.dataObj && ev.dataObj >= now && ev.musicas.includes(id));
    anchor = scheduled.reduce((latest, ev) => !latest || ev.dataObj > latest ? ev.dataObj : latest, null);
  } else {
    anchor = getLastPlayedBefore(id, contextCulto?.dataObj || now);
  }
  if (!anchor) return null;
  const date = new Date(anchor);
  // getSongStatus blocks days 0..56 inclusive: release begins on day 57.
  date.setDate(date.getDate() + COOLDOWN_DAYS + 1);
  const calendarDay = value => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const days = Math.max(0, Math.round((calendarDay(date) - calendarDay(now)) / 86400000));
  return { date, days };
}

function getTotalExecucoes(id) {
  return historico.filter((ev) => ev.dataObj && ev.dataObj < today() && (ev.musicas || []).includes(id)).length;
}

function getArtistExecucoes(artist) {
  const normalized = normalizeText(artist);
  if (!normalized) return 0;
  const ids = musicas.filter((song) => normalizeText(song.artista) === normalized).map((song) => song.id);
  return historico.filter((ev) => ev.dataObj && ev.dataObj < today()).reduce((sum, ev) => {
    return sum + (ev.musicas || []).filter((id) => ids.includes(id)).length;
  }, 0);
}

function getCategoryExecucoes(song) {
  const cats = (song && song.categorias) || [];
  if (!cats.length) return 0;
  const counts = cats.map((cat) => {
    const ids = musicas.filter((item) => item.categorias.includes(cat)).map((item) => item.id);
    return historico.filter((ev) => ev.dataObj && ev.dataObj < today()).reduce((sum, ev) => {
      return sum + (ev.musicas || []).filter((id) => ids.includes(id)).length;
    }, 0);
  });
  return Math.min(...counts);
}

function getLastPlayedBefore(id, date) {
  const matches = historico
    .filter((ev) => ev.dataObj && date && ev.dataObj < date && (ev.musicas || []).includes(id))
    .sort((a, b) => b.dataObj - a.dataObj);
  return (matches[0] && matches[0].dataObj) || null;
}

function getNextScheduledOnOrAfter(id, date) {
  const matches = historico
    .filter((ev) => ev.dataObj && date && ev.dataObj >= date && (ev.musicas || []).includes(id))
    .sort((a, b) => a.dataObj - b.dataObj);
  return (matches[0] && matches[0].dataObj) || null;
}

function classifyPopularity() {
  const items = musicas
    .map((song) => ({ song, count: getTotalExecucoes(song.id) }))
    .sort((a, b) => b.count - a.count || a.song.titulo.localeCompare(b.song.titulo));
  const total = items.length || 1;
  const out = {};
  items.forEach((item, idx) => {
    const p = idx / total;
    out[item.song.id] = {
      nivel: p <= 0.15 ? "classic" : p <= 0.6 ? "common" : "rare",
      rank: idx + 1,
      count: item.count,
    };
  });
  return out;
}

function getPopularity(id) {
  return (popularityCache && popularityCache[id]) || { nivel: "common", rank: 0, count: 0 };
}

function getDominantCategory(songs) {
  const counts = new Map();
  songs.forEach((song) => song.categorias.forEach((cat) => counts.set(cat, (counts.get(cat) || 0) + 1)));
  if (!counts.size) return null;
  const [name, count] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const percent = Math.round((count / songs.length) * 100);
  return { name, percent, strength: percent >= 80 ? "strong" : percent >= 60 ? "medium" : "weak" };
}

function songDifficultyValue(song) {
  const values = Object.values(song.level || {}).map(levelValue).filter(Boolean);
  return avg(values) || 0;
}

function levelValue(level) {
  if (level === "easy") return 1;
  if (level === "medium") return 2;
  if (level === "hard") return 3;
  return 0;
}

function levelLabel(level) {
  if (level === "easy") return "Fácil";
  if (level === "medium") return "Médio";
  if (level === "hard") return "Difícil";
  return String(level || "sem nivel");
}

function getMemberLevels(member) {
  const out = [];
  ((member && member.function) || []).forEach((obj) => {
    Object.entries(obj).forEach(([inst, level]) => out.push([normalizeInstrument(inst), level]));
  });
  return out;
}

function normalizeInstrument(raw) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function formatInstrument(inst) {
  const map = {
    vocal: "Voz",
    voz: "Voz",
    guitarra: "Guitarra",
    baixo: "Baixo",
    violao: "Violão",
    bateria: "Bateria",
    teclado: "Teclado",
    sax: "Sax",
  };
  return map[inst] || inst;
}

function getHeaderIds(culto) {
  return culto && Array.isArray(culto.header) ? culto.header : [];
}

function getMinisterIds(culto) {
  return culto && Array.isArray(culto.minister) ? culto.minister : [];
}

function copyScale(culto) {
  const songs = (culto.musicas || []).map(getSong).filter(Boolean);
  const analysis = analyzeSet(culto, culto.musicas || []);
  const copyDate = formatDateCompact((culto && culto.dataObj) || parseDate(culto && culto.data));
  const text = [
    `🎼 ESCALA - ${copyDate}`,
    "",
    `👑 Headers: ${formatMembersLine(culto.header || [], "Sem header")}`,
    `🎤 Ministrantes: ${formatMembersLine(culto.minister || [], "Sem ministrante")}`,
    `👥 Integrantes: ${formatMembersLine(culto.integrantes || [])}`,
    "",
    "📊 Analises:",
    `🛡️ Seguranca: ${Math.round(analysis.safety * 100)}% - ${analysis.safetyText}`,
    `✨ Familiaridade: ${Math.round(analysis.familiarity * 100)}% - ${analysis.familiarityText}`,
    `🔥 Desafio: ${Math.round(analysis.challenge * 100)}% - ${analysis.challengeText}`,
    `🌱 Renovacao: ${Math.round(analysis.renewal * 100)}% - ${analysis.renewalText}`,
    "",
    "🎵 Musicas:",
    ...songs.map((song, idx) => `${idx + 1}. ${song.titulo} - ${song.artista}${song.referLink ? `\n   ▶️ https://www.youtube.com/watch?v=${song.referLink}` : ""}`),
  ].join("\n");

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast("Escala copiada."))
      .catch(() => toast("Nao foi possivel copiar automaticamente."));
  } else {
    toast("Seu navegador nao liberou a area de transferencia.");
  }
}

function computeTitleGallery(events) {
  const stats = buildMemberTitleStats(events);
  const titles = [
    {
      name: "DJ do Culto",
      desc: "Quem mais apareceu como header escolhendo repertorio.",
      metric: (s) => s.headerCount,
    },
    {
      name: "Voz da Vez",
      desc: "Quem mais apareceu como ministrante.",
      metric: (s) => s.ministerCount,
    },
    {
      name: "Figurinha Carimbada",
      desc: "Presenca constante quando a agenda chamou.",
      metric: (s) => s.cultCount,
    },
    {
      name: "Maratonista do Repertorio",
      desc: "Mais musicas tocadas no periodo.",
      metric: (s) => s.songHits,
    },
    {
      name: "Camaleao da Banda",
      desc: "Tocou com mais combinacoes diferentes de pessoas.",
      metric: (s) => s.partners.size,
    },
    {
      name: "Guardiao dos Classicos",
      desc: "Carregou mais musicas que o grupo ja conhece bem.",
      metric: (s) => s.classicHits,
    },
    {
      name: "Arqueologo do Repertorio",
      desc: "Apareceu mais em musicas raras e pouco usadas.",
      metric: (s) => s.rareHits,
    },
    {
      name: "Modo Hard",
      desc: "Encarou mais musicas com dificuldade alta.",
      metric: (s) => s.hardHits,
    },
    {
      name: "Meio de Campo",
      desc: "Mais apareceu em musicas de dificuldade media.",
      metric: (s) => s.mediumHits,
    },
    {
      name: "Paz no Monitor",
      desc: "Pegou mais musicas tecnicamente tranquilas.",
      metric: (s) => s.easyHits,
    },
    {
      name: "Garimpo de Artistas",
      desc: "Escolheu repertorio com mais artistas diferentes.",
      metric: (s) => s.chosenArtists.size,
    },
    {
      name: "Explorador de Artistas",
      desc: "Tocou musicas de mais artistas diferentes.",
      metric: (s) => s.artistsPlayed.size,
    },
    {
      name: "Replay ON",
      desc: "Mais reencontrou as mesmas musicas no caminho.",
      metric: (s) => s.repeatHits,
    },
    {
      name: "Bau de Cancoes",
      desc: "Passou por mais musicas diferentes.",
      metric: (s) => s.uniqueSongs.size,
    },
    {
      name: "Curador de Setlist",
      desc: "Escolheu mais musicas diferentes como header.",
      metric: (s) => s.chosenSongs.size,
    },
    {
      name: "Categoria Favorita",
      desc: "Mais concentrou execucoes em uma categoria.",
      metric: (s) => maxMapValue(s.categoryCounts),
    },
    {
      name: "Versatil de Categorias",
      desc: "Mais circulou por categorias diferentes.",
      metric: (s) => s.categoryCounts.size,
    },
    {
      name: "Header Mao Pesada",
      desc: "Mais musicas tocadas em cultos em que liderou escolhas.",
      metric: (s) => s.headerSongHits,
    },
    {
      name: "Ministrante Ativo",
      desc: "Mais musicas tocadas em cultos que ministrou.",
      metric: (s) => s.ministerSongHits,
    },
    {
      name: "Casca Grossa",
      desc: "Somou mais musicas medias e dificeis.",
      metric: (s) => s.mediumHits + s.hardHits,
    },
    {
      name: "Repertorio Seguro",
      desc: "Mais apareceu em musicas classicas e faceis.",
      metric: (s) => s.classicHits + s.easyHits,
    },
    {
      name: "Oxigenador",
      desc: "Mais ajudou a trazer raridades e variedade.",
      metric: (s) => s.rareHits + s.uniqueSongs.size,
    },
    {
      name: "Ponte do Time",
      desc: "Misturou presenca com parcerias diferentes.",
      metric: (s) => s.cultCount + s.partners.size,
    },
    {
      name: "Setlist Sem Freio",
      desc: "Somou headers e musicas escolhidas.",
      metric: (s) => s.headerCount + s.chosenSongs.size,
    },
    {
      name: "Todo Terreno",
      desc: "Misturou volume, parcerias e categorias.",
      metric: (s) => s.songHits + s.partners.size + s.categoryCounts.size,
    },
    {
      name: "Memoria da Banda",
      desc: "Mais apareceu em repeticoes e classicos.",
      metric: (s) => s.repeatHits + s.classicHits,
    },
    {
      name: "Modo Descoberta",
      desc: "Mais apareceu em musicas raras e artistas diferentes.",
      metric: (s) => s.rareHits + s.artistsPlayed.size,
    },
    {
      name: "Base Solida",
      desc: "Mais apareceu em repertorios tecnicamente seguros.",
      metric: (s) => s.easyHits + s.mediumHits,
    },
  ];

  return titles
    .map((title) => ({ ...title, ranking: rankMembersForTitle(stats, title.metric) }))
    .filter((title) => title.ranking.length);
}

function buildMemberTitleStats(events) {
  const stats = new Map();
  integrantes.forEach((member) => {
    stats.set(member.id, {
      member,
      cultCount: 0,
      headerCount: 0,
      ministerCount: 0,
      songHits: 0,
      headerSongHits: 0,
      ministerSongHits: 0,
      mediumHits: 0,
      partners: new Set(),
      chosenArtists: new Set(),
      chosenSongs: new Set(),
      uniqueSongs: new Set(),
      artistsPlayed: new Set(),
      categoryCounts: new Map(),
      songCounts: new Map(),
      classicHits: 0,
      rareHits: 0,
      hardHits: 0,
      easyHits: 0,
      repeatHits: 0,
    });
  });

  events.forEach((ev) => {
    const songs = (ev.musicas || []).map(getSong).filter(Boolean);
    const members = ev.integrantes || [];
    const headers = ev.header || [];
    const ministers = ev.minister || [];
    members.forEach((id) => {
      const st = stats.get(id);
      if (!st) return;
      st.cultCount++;
      if (headers.includes(id)) st.headerCount++;
      if (ministers.includes(id)) st.ministerCount++;
      members.filter((otherId) => otherId !== id).forEach((otherId) => st.partners.add(otherId));
      songs.forEach((song) => {
        st.songHits++;
        st.uniqueSongs.add(song.id);
        st.artistsPlayed.add(song.artista || "Artista");
        if (headers.includes(id)) st.headerSongHits++;
        if (ministers.includes(id)) st.ministerSongHits++;
        song.categorias.forEach((cat) => st.categoryCounts.set(cat, (st.categoryCounts.get(cat) || 0) + 1));
        const previous = st.songCounts.get(song.id) || 0;
        st.songCounts.set(song.id, previous + 1);
        if (previous > 0) st.repeatHits++;
        const pop = getPopularity(song.id).nivel;
        if (pop === "classic") st.classicHits++;
        if (pop === "rare") st.rareHits++;
        const diff = songDifficultyValue(song);
        if (diff >= 2.5) st.hardHits++;
        if (diff > 1.35 && diff < 2.5) st.mediumHits++;
        if (diff > 0 && diff <= 1.35) st.easyHits++;
      });
    });

    headers.forEach((id) => {
      const st = stats.get(id);
      if (!st) return;
      songs.forEach((song) => st.chosenSongs.add(song.id));
      songs.forEach((song) => st.chosenArtists.add(song.artista || "Artista"));
    });
  });

  return stats;
}

function rankMembersForTitle(stats, metric) {
  return Array.from(stats.values())
    .map((item) => ({ id: item.member.id, name: item.member.nome, member: item.member, value: metric(item) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

function renderTitleCard(title) {
  const leader = title.ranking[0];
  const selectedId = state.wrappedMember === "all" ? null : Number(state.wrappedMember);
  const selected = selectedId ? title.ranking.find((item) => item.id === selectedId) : null;
  const topThree = title.ranking.slice(0, 3);
  const lines = selected && !topThree.some((item) => item.id === selected.id)
    ? topThree.concat(selected)
    : topThree;

  const card = document.createElement("article");
  card.className = "title-page-card";
  card.innerHTML = `
    <div class="title-winner">
      <img src="${memberImg(leader.member)}" alt="" onerror="this.src='integrantes/default.jpeg'" />
    </div>
    <div class="title-page-body">
      <p class="section-kicker">Titulo interno</p>
      <h3>${escapeHTML(title.name)}</h3>
      <p>${escapeHTML(title.desc)}</p>
      <div class="title-rank-lines">
        ${lines
          .map(
            (line) => `
              <div class="${line.rank <= 3 ? `rank-${line.rank}` : ""}">
                <strong>#${line.rank} - ${escapeHTML(line.name)}</strong>
                <span>${line.value}x</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
  return card;
}

function statWrappedCard(title, value, icon) {
  const card = document.createElement("article");
  card.className = "wrapped-card";
  card.innerHTML = `
    <p class="section-kicker">${icon}</p>
    <h3>${escapeHTML(title)}</h3>
    <div class="hero-meta"><h3>${value}</h3></div>
  `;
  return card;
}

function rankCard(title, rows, type) {
  const card = document.createElement("article");
  card.className = "wrapped-card";
  card.innerHTML = `<h3>${escapeHTML(title)}</h3>`;

  if (!rows.length) {
    card.append(emptyState("Sem dados no período."));
    return card;
  }

  const list = document.createElement("ol");
  list.className = "band-ranking";
  rows.slice(0, 10).forEach((row, idx) => {
    const item = document.createElement("li");
    item.innerHTML = `<span class="ranking-position">${idx + 1}</span>
      <span class="ranking-copy"><strong>${escapeHTML(row.name)}</strong><span>${escapeHTML(typeLabel(type, row))}</span></span>
      <span class="ranking-count">${row.value}x</span>`;
    list.append(item);
  });
  card.append(list);
  return card;
}

function rankMap(map, labelFn) {
  return Array.from(map.entries())
    .map(([key, value]) => ({ key, name: labelFn(key), value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

function rankPairs(map) {
  return Array.from(map.entries())
    .map(([key, value]) => {
      const [a, b] = key.split("|").map(Number);
      return { key, members: [a, b], name: `${(getMember(a) && getMember(a).nome) || a} + ${(getMember(b) && getMember(b).nome) || b}`, value };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

function typeLabel(type, row) {
  if (type === "musica") {
    const song = getSong(Number(row.key));
    return (song && song.artista) || "";
  }
  if (type === "artist") return "";
  if (type === "member") return "integrante";
  if (type === "pair") return "";
  return row.name;
}

function sectionPanel(title, kicker, content) {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.append(sectionHeader(title, kicker), content);
  return panel;
}

function sectionHeader(title, kicker, subtitle = "") {
  const header = document.createElement("div");
  header.className = "section-header";
  header.innerHTML = `
    <div>
      ${kicker ? `<p class="section-kicker">${escapeHTML(kicker)}</p>` : ""}
      <h3 class="section-title">${escapeHTML(title)}</h3>
      ${subtitle ? `<p class="section-subtitle">${escapeHTML(subtitle)}</p>` : ""}
    </div>
  `;
  return header;
}

function button(text, className, handler) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = text;
  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    handler();
  });
  return btn;
}

function emptyState(text) {
  return div("empty-state", text);
}

function div(className, text) {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  return el;
}

function openYoutube(song) {
  if (!song || !song.referLink) return;
  window.open(`https://www.youtube.com/watch?v=${song.referLink}`, "_blank");
}

function songThumb(song) {
  return (song && song._thumb) || "artistas/default.jpg";
}

function memberImg(member) {
  return `integrantes/${String((member && member.nome) || "").toLowerCase()}.jpeg`;
}

function songLabel(id) {
  const song = getSong(id);
  return song ? song.titulo : `Musica ${id}`;
}

function formatMembersLine(ids, fallback = "Sem integrantes") {
  return (ids || []).map((id) => {
    const member = getMember(id);
    return member && member.nome;
  }).filter(Boolean).join(", ") || fallback;
}

function formatDateLong(date) {
  if (!(date instanceof Date) || isNaN(date)) return "Data indefinida";
  const months = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${date.getDate()} de ${months[date.getMonth()]}`;
}

function formatDateCompact(date) {
  if (!(date instanceof Date) || isNaN(date)) return "--";
  return `${String(date.getDate()).padStart(2, "0")}/${monthShort(date)}/${date.getFullYear()}`;
}

function monthShort(date) {
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return months[date.getMonth()] || "--";
}

function parseDate(str) {
  if (!str) return null;
  const [day, month, year] = String(str).split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a, b) {
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function sameDay(a, b) {
  return (
    a instanceof Date &&
    b instanceof Date &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function avg(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : 0;
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function maxMapValue(map) {
  return map && map.size ? Math.max(...Array.from(map.values())) : 0;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function scoreText(score, high, mid, low) {
  if (score >= 0.7) return high;
  if (score >= 0.45) return mid;
  return low;
}

function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function slugify(text) {
  return normalizeText(text)
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function escapeHTML(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHTML(value);
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    return fallback;
  }
}

let toastTimer = null;
function toast(message) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

function normalizeIntensity(value) {
  const key = normalizeText(value || "").trim();
  return ["baixa", "media", "alta"].includes(key) ? key : null;
}

function intensityLabel(value) {
  return { baixa: "Baixa", media: "Média", alta: "Alta" }[normalizeIntensity(value)] || "Não informada";
}

function computeSongMemberInsights(songId) {
  const rows = new Map(integrantes.map(member => [member.id, { member, played: 0, chosen: 0 }]));
  const events = historico.filter(ev => ev.dataObj && ev.dataObj < today() && ev.musicas.includes(songId));
  events.forEach(ev => {
    new Set(ev.integrantes).forEach(id => { if (rows.has(id)) rows.get(id).played++; });
    new Set(ev.header).forEach(id => { if (rows.has(id)) rows.get(id).chosen++; });
  });
  return { eventCount: events.length, members: Array.from(rows.values()) };
}

function rankSongMembers(stats, metric) {
  const members = stats.members;
  const byName = (a, b) => a.member.nome.localeCompare(b.member.nome, "pt-BR") || a.member.id - b.member.id;
  const active = members.filter(row => row[metric] > 0);
  return {
    most: active.slice().sort((a, b) => b[metric] - a[metric] || byName(a, b)),
    least: active.slice().sort((a, b) => a[metric] - b[metric] || byName(a, b)),
    never: members.filter(row => row[metric] === 0).sort(byName),
  };
}
