const COOLDOWN_DAYS = 56;
const STORAGE = {
  activeView: "asafe:v2:active-view",
  librarySearch: "asafe:v2:library-search",
  libraryCategory: "asafe:v2:library-category",
  libraryStatus: "asafe:v2:library-status",
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
  builderCult: localStorage.getItem(STORAGE.builderCult) || "",
  builderDrafts: readJSON(STORAGE.builderDrafts, {}),
  wrappedStart: localStorage.getItem(STORAGE.wrappedStart) || "",
  wrappedEnd: localStorage.getItem(STORAGE.wrappedEnd) || "",
  wrappedMember: localStorage.getItem(STORAGE.wrappedMember) || "all",
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const [membersData, songsData, historyData] = await Promise.all([
      fetch("integrantes/integrantes.json").then((r) => r.json()),
      fetch("musicas.json").then((r) => r.json()),
      fetch("historico.json").then((r) => r.json()),
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
      '<div class="empty-state">Nao foi possivel carregar os dados da aplicacao.</div>';
  }
}

function bindShell() {
  document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  const quickBuilderBtn = document.getElementById("quickBuilderBtn");
  if (quickBuilderBtn) quickBuilderBtn.addEventListener("click", () => {
    const cultos = getBuilderCultos();
    if (cultos[0]) {
      openBuilder(cultos[0]);
      setView("repertorio");
    } else {
      toast("Nenhum culto futuro encontrado.");
    }
  });
}

function renderApp() {
  setView(state.activeView, { silent: true });
  renderHoje();
  renderCultos();
  renderRepertorio();
  renderWrapped();
  renderTitulos();
}

function setView(view, opts = {}) {
  state.activeView = view;
  localStorage.setItem(STORAGE.activeView, view);

  document.querySelectorAll(".view").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `view-${view}`);
  });
  document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  const meta = {
    hoje: ["Agora na fila", "Próximo culto"],
    cultos: ["Agenda viva", "Cultos"],
    repertorio: ["Biblioteca e montagem", "Repertorio"],
    wrapped: ["Wrapped administrativo", "Wrapped"],
    titulos: ["Galeria da banda", "Títulos"],
  }[view] || ["Projeto Asafe", "Music Admin"];

  document.getElementById("viewKicker").textContent = meta[0];
  document.getElementById("viewTitle").textContent = meta[1];
  const quickBuilderBtn = document.getElementById("quickBuilderBtn");
  if (quickBuilderBtn) quickBuilderBtn.parentElement.hidden = view === "hoje";

  if (!opts.silent) window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderHoje() {
  const root = document.getElementById("view-hoje");
  root.innerHTML = "";

  const next = getNextCulto();
  if (!next) {
    root.append(emptyState("Nenhum culto futuro encontrado."));
    return;
  }

  const analysis = analyzeSet(next, next.musicas || []);
  root.append(
    renderCultHero(next, analysis),
    sectionPanel("Integrantes da escala", "Line-up", renderMembers(next)),
    renderMainCultLayout(next, analysis, { showCopy: true }),
  );
}

function renderCultos() {
  const root = document.getElementById("view-cultos");
  root.innerHTML = "";

  const all = getFutureCultos();
  const futureAfterNext = all.slice(1);
  if (!futureAfterNext.length) {
    root.append(emptyState("Nao ha cultos futuros depois do próximo culto."));
    return;
  }

  const list = document.createElement("div");
  list.className = "service-list";

  futureAfterNext.forEach((culto) => {
    const hasSet = Array.isArray(culto.musicas) && culto.musicas.length > 0;
    const analysis = hasSet ? analyzeSet(culto, culto.musicas) : null;
    const card = document.createElement("details");
    card.className = "service-accordion";

    const summary = document.createElement("summary");
    summary.innerHTML = `
      <div class="service-summary">
        <div class="service-summary-main">
          <div class="service-topline">
            <div>
              <p class="section-kicker">${hasSet ? "Repertorio definido" : "Culto em aberto"}</p>
              <h3 class="service-date">${escapeHTML(formatDateLong(culto.dataObj))}</h3>
            </div>
            <div class="service-summary-aside"></div>
          </div>
        </div>
      </div>
    `;
    const summaryMain = summary.querySelector(".service-summary-main");
    const summaryAside = summary.querySelector(".service-summary-aside");
    summaryMain.append(renderSongMiniatures(culto), renderMemberMiniatures(culto));
    summaryAside.append(renderRoleMiniatures(culto));
    if (analysis) summaryAside.append(renderMetricStrip(analysis, "mini"));
    if (!hasSet) summaryAside.append(div("mini-chip", "Sem repertorio"));
    card.append(summary);

    const body = document.createElement("div");
    body.className = "service-accordion-body";
    body.append(renderMembers(culto));

    if (hasSet) {
      body.append(renderSetBlock(culto, analysis), renderAnalysisBlock(analysis));
    } else {
      const suggestions = generateSuggestedPlaylists(culto);
      body.append(renderSuggestionCompare(culto, suggestions));
    }

    card.append(body);
    list.append(card);
  });

  root.append(list);
}

function renderRepertorio() {
  const root = document.getElementById("view-repertorio");
  root.innerHTML = "";

  root.append(renderBuilder(), renderLibraryControls());

  const filtered = getFilteredSongs();
  const available = filtered.filter((m) => getSongStatus(m.id).status === "available");
  const unavailable = filtered.filter((m) => getSongStatus(m.id).status !== "available");

  root.append(
    renderLibrarySection("Disponiveis", available, "available"),
    renderLibrarySection("Indisponiveis", unavailable, "blocked"),
  );
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
    statWrappedCard("Cultos no periodo", insights.totalCultos, "📅"),
    statWrappedCard("Execucoes de musicas", insights.totalExecucoes, "🎵"),
    statWrappedCard("Musicas diferentes", insights.uniqueSongs, "📚"),
  );

  grid.append(
    rankCard("Musicas mais tocadas", insights.topSongs, "musica"),
    rankCard("Artistas mais tocados", insights.topArtists, "artist"),
    rankCard("Musicas mais escolhidas", insights.topChosenSongs, "musica"),
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
  root.append(grid);
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
  const hero = document.createElement("section");
  hero.className = "spotify-hero";

  const firstSong = (culto.musicas || []).map(getSong).filter(Boolean)[0];
  hero.innerHTML = `
    <div class="hero-content">
      <div class="cover-card">
        ${firstSong ? `<img src="${songThumb(firstSong)}" alt="" />` : ""}
        <div class="cover-overlay">
          <p class="section-kicker">Próximo culto</p>
          <strong>${escapeHTML(shortDate(culto.dataObj))}</strong>
        </div>
      </div>
      <div class="hero-meta">
        <p class="section-kicker">Playlist do dia</p>
        <h3>${escapeHTML(formatDateLong(culto.dataObj))}</h3>
        <div class="hero-actions">
          <button class="pill-button" data-action="copy">Copiar escala</button>
        </div>
      </div>
    </div>
  `;

  hero.querySelector('[data-action="copy"]').addEventListener("click", () => copyScale(culto));

  return hero;
}

function renderMainCultLayout(culto, analysis, opts = {}) {
  const layout = document.createElement("div");
  layout.className = "layout-grid";
  layout.append(renderSetBlock(culto, analysis, opts), renderAnalysisBlock(analysis));
  return layout;
}

function renderSetBlock(culto, analysis, opts = {}) {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.append(
    sectionHeader("Repertorio do dia", "Tracklist", `${analysis.songCount} musica(s) selecionada(s)`),
    renderTrackList(culto.musicas || [], { culto, action: "open", showStatus: opts.showStatus === true }),
  );
  return panel;
}

function renderAnalysisBlock(analysis) {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.append(sectionHeader("Analises do dia"));
  panel.append(renderMetricStrip(analysis));
  panel.append(renderHumanReading(analysis));
  return panel;
}

function renderMetricStrip(analysis, mode = "full") {
  const strip = document.createElement("div");
  strip.className = mode === "mini" ? "mini-metric-row" : "metric-strip";
  getMetricItems(analysis).forEach((item) => {
    const tone = metricTone(item.toneScore == null ? item.score : item.toneScore);
    if (mode === "mini") {
      const pill = document.createElement("span");
      pill.className = `mini-metric ${tone}`;
      pill.title = `${item.label}: ${Math.round(item.score * 100)}%`;
      pill.textContent = item.icon;
      strip.append(pill);
      return;
    }

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
  wrap.append(sectionHeader("Leitura humana", "Detalhes", "Sinais especificos deste culto"));

  const list = document.createElement("ul");
  list.className = "insight-list";
  analysis.notes.forEach((noteRaw) => {
    const note = typeof noteRaw === "string" ? { text: noteRaw, memberIds: [] } : noteRaw;
    const li = document.createElement("li");
    const avatars = document.createElement("div");
    avatars.className = "insight-avatars";
    (note.memberIds || []).slice(0, 4).forEach((id) => {
      const member = getMember(id);
      if (!member) return;
      const img = document.createElement("img");
      img.src = memberImg(member);
      img.alt = member.nome;
      img.onerror = () => (img.src = "integrantes/default.jpeg");
      avatars.append(img);
    });
    if (avatars.children.length) li.append(avatars);
    const text = document.createElement("span");
    text.textContent = note.text;
    li.append(text);
    list.append(li);
  });
  wrap.append(list);
  return wrap;
}

function getMetricItems(analysis) {
  return [
    { icon: "🛡️", label: "Seguranca", score: analysis.safety },
    { icon: "✨", label: "Familiaridade", score: analysis.familiarity },
    { icon: "🔥", label: "Desafio", score: analysis.challenge, toneScore: 1 - analysis.challenge },
    { icon: "🌱", label: "Renovacao", score: analysis.renewal },
  ];
}

function metricTone(score) {
  if (score >= 0.7) return "good";
  if (score >= 0.45) return "warn";
  return "danger";
}

function renderMembers(culto) {
  const strip = document.createElement("div");
  strip.className = "member-grid";
  const headerIds = getHeaderIds(culto);
  const ministerIds = getMinisterIds(culto);

  (culto.integrantes || []).forEach((id) => {
    const member = getMember(id);
    if (!member) return;
    const pill = document.createElement("div");
    pill.className = "member-pill";
    pill.innerHTML = `
      <div class="member-avatar-wrap">
        <img class="member-avatar" src="${memberImg(member)}" alt="${escapeAttr(member.nome)}" onerror="this.src='integrantes/default.jpeg'" />
        ${headerIds.includes(member.id) ? '<span class="member-badge">👑</span>' : ""}
        ${ministerIds.includes(member.id) ? '<span class="member-badge mic">🎤</span>' : ""}
      </div>
    `;
    strip.append(pill);
  });

  if (!strip.children.length) strip.append(emptyState("Nenhum integrante definido."));
  return strip;
}

function renderMemberMiniatures(culto) {
  const row = document.createElement("div");
  row.className = "mini-thumb-row";
  (culto.integrantes || []).slice(0, 12).forEach((id) => {
    const member = getMember(id);
    if (!member) return;
    const thumb = document.createElement("div");
    thumb.className = "mini-thumb round";
    thumb.innerHTML = `<img src="${memberImg(member)}" alt="${escapeAttr(member.nome)}" onerror="this.src='integrantes/default.jpeg'" />`;
    row.append(thumb);
  });
  return row;
}

function renderRoleMiniatures(culto) {
  const row = document.createElement("div");
  row.className = "role-mini-row";
  const headers = getHeaderIds(culto);
  const ministers = getMinisterIds(culto);
  const roleIds = Array.from(new Set(headers.concat(ministers)));

  roleIds.forEach((id) => {
    const member = getMember(id);
    if (!member) return;
    const isHeader = headers.includes(id);
    const isMinister = ministers.includes(id);
    const roles = [isHeader ? "Header" : "", isMinister ? "Ministrante" : ""].filter(Boolean).join(" e ");
    const thumb = document.createElement("div");
    thumb.className = "role-mini";
    thumb.title = `${roles}: ${member.nome}`;
    thumb.innerHTML = `
      <img src="${memberImg(member)}" alt="${escapeAttr(member.nome)}" onerror="this.src='integrantes/default.jpeg'" />
      ${isHeader ? '<span class="crown">👑</span>' : ""}
      ${isMinister ? '<span class="mic">🎤</span>' : ""}
    `;
    row.append(thumb);
  });

  return row;
}

function renderSongMiniatures(culto) {
  const row = document.createElement("div");
  row.className = "mini-thumb-row song-miniatures";
  (culto.musicas || []).slice(0, 6).forEach((id) => {
    const song = getSong(id);
    if (!song) return;
    const thumb = document.createElement("div");
    thumb.className = "mini-thumb";
    thumb.innerHTML = `<img src="${songThumb(song)}" alt="${escapeAttr(song.titulo)}" onerror="this.src='artistas/default.jpg'" />`;
    row.append(thumb);
  });
  return row;
}

function renderSuggestionCompare(culto, suggestions) {
  const wrap = document.createElement("div");
  wrap.append(sectionHeader("Playlists sugeridas", "Comparacao", "Use como ponto de partida"));

  if (!suggestions.length) {
    wrap.append(emptyState("Sem sugestoes disponiveis com as regras atuais."));
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
      setView("repertorio");
      toast("Playlist enviada para o construtor.");
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
    ["Seguranca", analysis.safety, analysis.safety],
    ["Familiaridade", analysis.familiarity, analysis.familiarity],
    ["Desafio", analysis.challenge, 1 - analysis.challenge],
    ["Renovacao", analysis.renewal, analysis.renewal],
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
  const cultos = getBuilderCultos();
  if (!state.builderCult && cultos[0]) state.builderCult = cultKey(cultos[0]);
  if (state.builderCult && !cultos.some((culto) => cultKey(culto) === state.builderCult)) {
    state.builderCult = cultos[0] ? cultKey(cultos[0]) : "";
    localStorage.setItem(STORAGE.builderCult, state.builderCult);
  }
  const selected = cultos.find((culto) => cultKey(culto) === state.builderCult) || cultos[0] || null;
  const ids = selected ? getDraft(cultKey(selected), selected) : [];
  const analysis = selected ? analyzeSet({ ...selected, musicas: ids }, ids) : null;

  const panel = document.createElement("section");
  panel.className = "builder-panel";

  const left = document.createElement("div");
  left.append(sectionHeader("Montar repertorio", "Rascunho salvo no navegador", "Clique nas musicas da biblioteca para testar"));
  if (selected) left.append(renderBuilderSuggestionCarousel(selected));

  const select = document.createElement("select");
  select.className = "select";
  select.innerHTML = cultos
    .map(
      (culto) =>
        `<option value="${escapeAttr(cultKey(culto))}" ${cultKey(culto) === state.builderCult ? "selected" : ""}>${escapeHTML(formatDateLong(culto.dataObj))}</option>`,
    )
    .join("");
  select.addEventListener("change", () => {
    state.builderCult = select.value;
    localStorage.setItem(STORAGE.builderCult, state.builderCult);
    renderRepertorio();
  });
  left.append(select);

  if (!selected) {
    left.append(emptyState("Nenhum culto futuro para montar repertorio."));
  } else if (!ids.length) {
    left.append(div("builder-empty", "Nenhuma musica no rascunho. Selecione musicas abaixo para montar e analisar em tempo real."));
  } else {
    left.append(renderTrackList(ids, { culto: selected, action: "remove", builder: true }));
  }

  const actions = document.createElement("div");
  actions.className = "inline-actions";
  actions.append(
    button("Limpar rascunho", "danger-button", () => {
      if (!selected) return;
      setDraft(cultKey(selected), []);
      renderRepertorio();
    }),
    button("Copiar rascunho", "ghost-button", () => {
      if (!selected) return;
      copyScale({ ...selected, musicas: ids });
    }),
  );
  left.append(actions);

  const right = document.createElement("div");
  if (analysis && ids.length) {
    left.insertBefore(renderMetricStrip(analysis), left.querySelector(".tracklist"));
    right.append(renderHumanReading(analysis));
  } else {
    right.append(emptyState("Selecione uma musica para liberar a leitura do rascunho."));
  }

  panel.append(left, right);
  return panel;
}

function renderBuilderSuggestionCarousel(culto) {
  const suggestions = generateSuggestedPlaylists(culto);
  const wrap = document.createElement("div");
  wrap.className = "suggestion-carousel";

  if (!suggestions.length) {
    wrap.append(div("builder-empty", "Sem sugestoes automaticas para este culto."));
    return wrap;
  }

  let index = 0;
  const viewport = document.createElement("div");
  viewport.className = "suggestion-viewport";
  const prev = button("‹", "ghost-button icon-button", () => {
    index = (index - 1 + suggestions.length) % suggestions.length;
    paint();
  });
  const next = button("›", "ghost-button icon-button", () => {
    index = (index + 1) % suggestions.length;
    paint();
  });
  prev.setAttribute("aria-label", "Sugestao anterior");
  next.setAttribute("aria-label", "Proxima sugestao");

  const paint = () => {
    viewport.innerHTML = "";
    const suggestion = suggestions[index];
    const card = document.createElement("article");
    card.className = "suggestion-card";
    card.innerHTML = `
      <div>
        <p class="mini-kicker">${index + 1}/${suggestions.length} · ${escapeHTML(suggestion.category || "Mista")}</p>
        <h4>${escapeHTML(suggestion.title)}</h4>
      </div>
    `;
    card.append(renderSongMiniatures({ musicas: suggestion.songIds }));
    card.append(renderMetricStrip(suggestion.analysis, "mini"));
    card.append(button("Usar", "pill-button", () => {
      setDraft(cultKey(culto), suggestion.songIds);
      renderRepertorio();
      toast("Sugestao aplicada ao rascunho.");
    }));
    viewport.append(card);
  };

  paint();
  wrap.append(prev, viewport, next);

  return wrap;
}

function renderLibraryControls() {
  const controls = document.createElement("section");
  controls.className = "controls-panel";
  controls.innerHTML = `
    <input id="librarySearch" class="input" type="search" placeholder="Buscar musica ou artista" value="${escapeAttr(state.librarySearch)}" />
    <select id="libraryCategory" class="select">
      <option value="all">Todas as categorias</option>
      ${categorias.map((cat) => `<option value="${escapeAttr(cat)}" ${cat === state.libraryCategory ? "selected" : ""}>${escapeHTML(cat)}</option>`).join("")}
    </select>
    <select id="libraryStatus" class="select">
      <option value="all">Todos os status</option>
      <option value="available" ${state.libraryStatus === "available" ? "selected" : ""}>Disponiveis</option>
      <option value="recent" ${state.libraryStatus === "recent" ? "selected" : ""}>Recentes</option>
      <option value="future" ${state.libraryStatus === "future" ? "selected" : ""}>Agendadas</option>
      <option value="banned" ${state.libraryStatus === "banned" ? "selected" : ""}>Banidas</option>
    </select>
  `;

  controls.querySelector("#librarySearch").addEventListener("input", (ev) => {
    state.librarySearch = ev.target.value;
    localStorage.setItem(STORAGE.librarySearch, state.librarySearch);
    renderRepertorio();
  });
  controls.querySelector("#libraryCategory").addEventListener("change", (ev) => {
    state.libraryCategory = ev.target.value;
    localStorage.setItem(STORAGE.libraryCategory, state.libraryCategory);
    renderRepertorio();
  });
  controls.querySelector("#libraryStatus").addEventListener("change", (ev) => {
    state.libraryStatus = ev.target.value;
    localStorage.setItem(STORAGE.libraryStatus, state.libraryStatus);
    renderRepertorio();
  });

  return controls;
}

function renderLibrarySection(title, songs, kind) {
  const section = document.createElement("section");
  section.className = "library-section";

  const heading = document.createElement(kind === "blocked" ? "summary" : "div");
  heading.className = "library-heading";
  heading.innerHTML = `
    <h3>${escapeHTML(title)}</h3>
    <span class="mini-chip">${songs.length} musica(s)</span>
  `;

  if (kind === "blocked") {
    const details = document.createElement("details");
    details.className = "library-accordion";
    details.append(heading);
    details.append(songs.length ? renderLibraryTrackList(songs) : emptyState(`Nenhuma musica em "${title}" para os filtros atuais.`));
    section.append(details);
    return section;
  }

  section.append(heading);
  section.append(songs.length ? renderLibraryTrackList(songs) : emptyState(`Nenhuma musica em "${title}" para os filtros atuais.`));
  return section;
}

function renderLibraryTrackList(songs) {
  const list = document.createElement("div");
  list.className = "tracklist library-tracklist";

  songs.forEach((song, idx) => {
    const status = getSongStatus(song.id);
    const selectedCulto = getCultByKey(state.builderCult);
    const selectedIds = selectedCulto ? getDraft(cultKey(selectedCulto), selectedCulto) : [];
    const isSelected = selectedIds.includes(song.id);

    const details = document.createElement("details");
    details.className = `song-details ${status.status !== "available" ? "blocked-song" : ""}`;

    const summary = document.createElement("summary");
    const row = document.createElement("div");
    row.className = "track-row";
    row.innerHTML = `
      <div class="track-index">${idx + 1}</div>
      <div class="track-thumb"><img src="${songThumb(song)}" alt="" onerror="this.src='artistas/default.jpg'" /></div>
      <div class="track-main">
        <div class="track-title">${escapeHTML(song.titulo)}</div>
        <div class="track-artist">${escapeHTML(song.artista || "Artista")}</div>
      </div>
      <div class="track-meta">${getTotalExecucoes(song.id)}x</div>
    `;

    const actionArea = document.createElement("div");
    actionArea.className = "inline-actions";
    if (status.status !== "available") actionArea.append(renderStatusPill(status));
    actionArea.append(libraryActionButton(isSelected ? "-" : "+", isSelected ? "danger-button icon-button" : "pill-button icon-button", () => {
      if (isSelected) removeFromDraft(song.id);
      else addSongFromLibrary(song);
    }));
    row.append(actionArea);
    summary.append(row);
    details.append(summary, renderSongDetails(song, status));
    list.append(details);
  });

  return list;
}

function renderSongDetails(song, status) {
  const body = document.createElement("div");
  body.className = "song-detail-body";

  const last = getLastPlayedBefore(song.id, today());
  const next = getNextScheduledAfter(song.id, today());
  const difficulty = Object.entries(song.level || {}).filter(([, level]) => level);

  const categories = document.createElement("div");
  categories.className = "song-tags";
  song.categorias.forEach((cat) => {
    const chip = document.createElement("span");
    chip.className = "category-chip";
    chip.textContent = cat;
    categories.append(chip);
  });

  const grid = document.createElement("div");
  grid.className = "detail-grid";
  grid.append(
    detailItem("Execucoes", `${getTotalExecucoes(song.id)}x`),
    detailItem("Ultima vez", last ? formatDateCompact(last) : "Nunca"),
    detailItem("Artista", `${getArtistExecucoes(song.artista)}x`),
    detailItem("Categoria", `${getCategoryExecucoes(song)}x`),
    detailItem("Status", status.label),
    detailItem("Agenda", next ? formatDateCompact(next) : "Livre"),
  );

  const levels = document.createElement("div");
  levels.className = "level-list";
  if (difficulty.length) {
    difficulty.forEach(([inst, level]) => {
      const pill = document.createElement("span");
      pill.className = `level-pill ${level}`;
      pill.textContent = `${formatInstrument(normalizeInstrument(inst))}: ${levelLabel(level)}`;
      levels.append(pill);
    });
  } else {
    levels.append(div("muted-line", "Sem dificuldades cadastradas."));
  }

  body.append(categories, grid, levels);
  if (song.referLink) {
    body.append(button("Abrir no YouTube", "ghost-button", () => openYoutube(song)));
  }
  return body;
}

function renderTrackList(ids, opts = {}) {
  const list = document.createElement("div");
  list.className = "tracklist";
  const songs = ids.map(getSong).filter(Boolean);

  if (!songs.length) {
    list.append(emptyState("Nenhuma musica selecionada."));
    return list;
  }

  songs.forEach((song, idx) => {
    const status = getSongStatus(song.id, opts.culto || null);
    const visualBlocked = status.status !== "available" && opts.showStatus !== false;
    const row = document.createElement("div");
    row.className = `track-row ${visualBlocked ? "blocked-song" : ""} ${opts.builder ? "builder-track" : ""}`;
    row.innerHTML = `
      <div class="track-index">${idx + 1}</div>
      <div class="track-thumb"><img src="${songThumb(song)}" alt="" onerror="this.src='artistas/default.jpg'" /></div>
      <div class="track-main">
        <div class="track-title">${escapeHTML(song.titulo)}</div>
        <div class="track-artist">${escapeHTML(song.artista || "Artista")}</div>
      </div>
      <div class="track-meta">${getTotalExecucoes(song.id)}x</div>
    `;

    const actionArea = document.createElement("div");
    actionArea.className = "inline-actions";

    if (opts.action === "remove") {
      actionArea.append(button("-", "danger-button icon-button", () => removeFromDraft(song.id)));
    } else if (opts.action === "add") {
      const selectedCulto = getCultByKey(state.builderCult);
      const selectedIds = selectedCulto ? getDraft(cultKey(selectedCulto), selectedCulto) : [];
      const isSelected = selectedIds.includes(song.id);
      if (status.status !== "available") actionArea.append(renderStatusPill(status));
      actionArea.append(button(isSelected ? "-" : "+", isSelected ? "danger-button icon-button" : "pill-button icon-button", () => {
        if (isSelected) removeFromDraft(song.id);
        else addSongFromLibrary(song);
      }));
    } else {
      if (status.status !== "available" && opts.showStatus !== false) actionArea.append(renderStatusPill(status));
    }

    row.append(actionArea);
    if (opts.action === "open") {
      row.addEventListener("click", () => openYoutube(song));
    }
    list.append(row);
  });

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
    toast("Regra de categoria: em qualquer trio, pelo menos 2 musicas precisam coincidir em categoria.");
    return;
  }

  setDraft(key, nextDraft);
  if (status.status !== "available") {
    toast(`Adicionada com alerta: ${song.titulo} esta ${status.label.toLowerCase()}.`);
  } else {
    toast(`${song.titulo} adicionada ao rascunho.`);
  }
  renderRepertorio();
}

function removeFromDraft(songId) {
  const culto = getCultByKey(state.builderCult);
  if (!culto) return;
  const key = cultKey(culto);
  setDraft(
    key,
    getDraft(key, culto).filter((id) => id !== songId),
  );
  renderRepertorio();
}

function openBuilder(culto) {
  state.builderCult = cultKey(culto);
  localStorage.setItem(STORAGE.builderCult, state.builderCult);
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
      notes: [{ text: "Escolha musicas na biblioteca para receber analise dinamica.", memberIds: [] }],
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
  const addNote = (text, memberIds = []) => notes.push({ text, memberIds });
  if (blocked.length) {
    blocked.forEach(({ song, status }) => addNote(`Alerta forte: ${song.titulo} esta ${status.label.toLowerCase()} e deve ser usada conscientemente.`));
  }
  if (diffMax >= 2.5) addNote("Existe pelo menos uma musica tecnicamente dificil no set.");
  if (newSongs.length) addNote(`${newSongs.length} musica(s) nova(s) para o time.`);
  if (rareSongs.length) addNote(`${rareSongs.length} musica(s) incomum(ns), bom para oxigenar o repertorio.`);
  if ((popCounts.classic || 0) >= 2 && safety >= 0.6) {
    addNote("O set tem colchao de musicas classicas, o que ajuda a banda a tocar com mais previsibilidade.");
  }
  if (familiarity < 0.35 && challenge > 0.45) {
    addNote("A combinacao de pouca familiaridade com desafio tecnico pede ensaio mais objetivo.");
  }
  if (familiarity >= 0.65 && challenge <= 0.38) {
    addNote("A memoria do time esta a favor; da para investir mais em dinamica e transicoes.");
  }
  if (renewal >= 0.62 && safety < 0.52) {
    addNote("O set tem cheiro de renovacao, mas precisa de combinados claros antes de chegar no culto.");
  }
  memberSongStats
    .filter((s) => s.topPlayers.length)
    .slice(0, 4)
    .forEach((stat) => {
      const names = stat.topPlayers.map((p) => `${p.nome} (${p.count}x)`).join(", ");
      const verb = stat.topPlayers.length === 1 ? "ja tocou" : "ja tocaram";
      addNote(`${names} ${verb} "${stat.song.titulo}".`, stat.topPlayers.map((p) => p.id));
    });
  memberSongStats
    .filter((s) => s.never.length)
    .slice(0, 3)
    .forEach((s) => addNote(`${s.never.slice(0, 3).join(", ")} ainda nao tocaram "${s.song.titulo}".`, s.neverIds.slice(0, 4)));
  cooc.forEach((note) => notes.push(note));
  if (!notes.length) addNote("Set equilibrado, sem alertas fortes pelos dados atuais.");

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
    { key: "facil", title: "Facil", weights: { fam: 0.9, safe: 1.25, renew: 0.1, challenge: -0.8, pop: 0.4 } },
    { key: "mediano", title: "Mediano", weights: { fam: 0.7, safe: 0.8, renew: 0.45, challenge: 0.05, pop: 0.3 } },
    { key: "desafiador", title: "Desafiador", weights: { fam: 0.2, safe: 0.15, renew: 0.5, challenge: 1.1, pop: -0.1 } },
    { key: "renovacao", title: "Renovacao", weights: { fam: 0.15, safe: 0.25, renew: 1.25, challenge: 0.25, pop: -0.4 } },
  ];

  return strategies
    .map((strategy) => buildSuggestion(culto, strategy))
    .filter(Boolean)
    .slice(0, 5);
}

function buildSuggestion(culto, strategy) {
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

  const chosen = (groupOptions[0] ? groupOptions[0].items.map((x) => x.song).slice(0, 3) : null) || candidates.slice(0, 3).map((x) => x.song);
  if (chosen.length < 3) return null;

  const chosenIds = chosen.map((s) => s.id);
  if (hasDisjointCategoryTriple(chosenIds)) return null;

  const analysis = analyzeSet({ ...culto, musicas: chosenIds }, chosenIds);
  return {
    title: strategy.title,
    category: analysis.category,
    songIds: chosenIds,
    analysis,
  };
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
  const next = getNextScheduledAfter(song.id, today());
  if (next && (!date || next.getTime() !== date.getTime())) return false;
  return true;
}

function getFilteredSongs() {
  const q = normalizeText(state.librarySearch);
  const selectedCategories = getCurrentDraftCategorySet();
  return musicas.filter((song) => {
    const status = getSongStatus(song.id).status;
    if (state.libraryStatus !== "all" && status !== state.libraryStatus) return false;
    if (state.libraryCategory !== "all" && !song.categorias.includes(state.libraryCategory)) return false;
    if (q) {
      const hay = normalizeText(`${song.titulo} ${song.artista} ${song.categorias.join(" ")}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => compareLibrarySongs(a, b, selectedCategories));
}

function compareLibrarySongs(a, b, selectedCategories = new Set()) {
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

function getOpenCultos() {
  return getFutureCultos().filter((ev) => !Array.isArray(ev.musicas) || ev.musicas.length === 0);
}

function getBuilderCultos() {
  return getFutureCultos()
    .slice(1)
    .filter((ev) => !Array.isArray(ev.musicas) || ev.musicas.length === 0);
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
  const next = getNextScheduledAfter(id, today());
  if (next && !(contextDate && sameDay(next, contextDate))) return { status: "future", label: "Agendada" };
  const refDate = contextDate || today();
  const last = getLastPlayedBefore(id, refDate);
  if (last && daysBetween(last, refDate) <= COOLDOWN_DAYS) return { status: "recent", label: "Recente" };
  return { status: "available", label: "Disponivel" };
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

function getNextScheduledAfter(id, date) {
  const matches = historico
    .filter((ev) => ev.dataObj && date && ev.dataObj > date && (ev.musicas || []).includes(id))
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
  if (level === "easy") return "facil";
  if (level === "medium") return "medio";
  if (level === "hard") return "dificil";
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

function memberFunctions(member) {
  const names = getMemberLevels(member).map(([inst]) => formatInstrument(inst));
  return names.length ? names.join(", ") : "Integrante";
}

function formatInstrument(inst) {
  const map = {
    vocal: "Voz",
    voz: "Voz",
    guitarra: "Guitarra",
    baixo: "Baixo",
    violao: "Violao",
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
    card.append(emptyState("Sem dados no periodo."));
    return card;
  }

  const podium = document.createElement("div");
  podium.className = "podium-grid";
  rows.slice(0, 3).forEach((row, idx) => {
    const item = document.createElement("div");
    item.className = `podium-card rank-${idx + 1}`;
    item.innerHTML = `
      ${rankImageHTML(type, row)}
      <span class="podium-rank rank-${idx + 1}">#${idx + 1}</span>
      <strong>${escapeHTML(row.name)}</strong>
      <span>${row.value}x</span>
    `;
    podium.append(item);
  });
  card.append(podium);

  const rest = rows.slice(3, 10);
  if (rest.length) {
    const list = document.createElement("ol");
    list.className = "rank-list";
    rest.forEach((row, idx) => {
      const rank = idx + 4;
      const subtitle = typeLabel(type, row);
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="rank-num rank-${rank}">#${rank}</span>
        <span>
          <span class="rank-name">${escapeHTML(row.name)}</span>
          ${subtitle ? `<span class="rank-sub">${escapeHTML(subtitle)}</span>` : ""}
        </span>
        <span class="rank-value">${row.value}x</span>
      `;
      list.append(li);
    });
    card.append(list);
  }
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

function rankImageHTML(type, row) {
  if (type === "musica") {
    const song = getSong(Number(row.key));
    return `<div class="rank-image"><img src="${songThumb(song)}" alt="" onerror="this.src='artistas/default.jpg'" /></div>`;
  }
  if (type === "artist") {
    return `<div class="rank-image"><img src="${artistImg(row.name)}" alt="" onerror="this.src='artistas/default.jpg'" /></div>`;
  }
  if (type === "pair") {
    const members = (row.members || []).map(getMember).filter(Boolean);
    return `
      <div class="rank-image pair-image">
        ${members.map((member) => `<img src="${memberImg(member)}" alt="" onerror="this.src='integrantes/default.jpeg'" />`).join("")}
      </div>
    `;
  }
  if (type === "member") {
    const member = getMember(Number(row.key));
    return `<div class="rank-image"><img src="${member ? memberImg(member) : "integrantes/default.jpeg"}" alt="" onerror="this.src='integrantes/default.jpeg'" /></div>`;
  }
  return '<div class="rank-image"></div>';
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

function renderStatusPill(status) {
  const span = document.createElement("span");
  span.className = `song-status ${status.status}`;
  span.textContent = status.label;
  return span;
}

function detailItem(label, value) {
  const item = document.createElement("div");
  item.className = "detail-item";
  item.innerHTML = `
    <span>${escapeHTML(label)}</span>
    <strong>${escapeHTML(value)}</strong>
  `;
  return item;
}

function analysisChips(analysis) {
  return [
    ["Seguranca", analysis.safety, "good"],
    ["Familiaridade", analysis.familiarity, "info"],
    ["Desafio", 1 - analysis.challenge, "warn"],
    ["Renovacao", analysis.renewal, "good"],
  ].map(([label, score, kind]) => {
    const chip = document.createElement("span");
    chip.className = `analysis-chip ${score < 0.45 ? "danger" : score < 0.7 ? "warn" : kind}`;
    chip.textContent = `${label}: ${Math.round(score * 100)}%`;
    return chip;
  });
}

function analysisCard(icon, title, score, text) {
  const card = document.createElement("article");
  const cls = score < 0.45 ? "danger" : score < 0.7 ? "warn" : "";
  card.className = "analysis-card";
  card.innerHTML = `
    <h4><span>${icon} ${escapeHTML(title)}</span><span>${Math.round(score * 100)}%</span></h4>
    <div class="meter ${cls}"><span style="width:${Math.round(score * 100)}%"></span></div>
    <p>${escapeHTML(text)}</p>
  `;
  return card;
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

function libraryActionButton(text, className, handler) {
  const btn = button(text, className, handler);
  btn.addEventListener("click", (ev) => ev.preventDefault());
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

function artistImg(name) {
  return `artistas/${slugify(name || "")}.jpg`;
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

function shortDate(date) {
  if (!(date instanceof Date) || isNaN(date)) return "--";
  return `${String(date.getDate()).padStart(2, "0")}/${monthShort(date)}`;
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
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}
