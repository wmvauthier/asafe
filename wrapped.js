// ---------------------------
// Carregamento dos dados
// ---------------------------

let MUSICAS_RAW = [];
let INTEGRANTES_RAW = [];
let HISTORICO_RAW = [];
let HISTORICO = [];
let MUSIC_BY_ID = new Map();
let MEMBER_BY_ID = new Map();

function parseBrDate(str) {
  const [d, m, y] = str.split("/").map(Number);
  return new Date(y, m - 1, d);
}

async function loadData() {
  const [musicas, integrantes, historico] = await Promise.all([
    fetch("musicas.json").then((r) => r.json()),
    fetch("integrantes/integrantes.json").then((r) => r.json()),
    fetch("historico.json").then((r) => r.json()),
  ]);

  MUSICAS_RAW = musicas;
  INTEGRANTES_RAW = integrantes;
  HISTORICO_RAW = historico;

  MUSIC_BY_ID = new Map(MUSICAS_RAW.map((m) => [m.id, m]));
  MEMBER_BY_ID = new Map(INTEGRANTES_RAW.map((i) => [i.id, i]));

  HISTORICO = HISTORICO_RAW.map((ev) => ({
    ...ev,
    dateObj: parseBrDate(ev.data),
  }));
}

function isValidEvent(ev) {
  return Array.isArray(ev.musicas) && ev.musicas.length > 0;
}

// ---------------------------
// Filtros
// ---------------------------

function getDateFilters() {
  const startInput = document.getElementById("startDate");
  const endInput = document.getElementById("endDate");
  let start = startInput.value
    ? new Date(startInput.value + "T00:00:00")
    : null;
  let end = endInput.value ? new Date(endInput.value + "T23:59:59") : null;
  return { start, end };
}

function filterEvents() {
  const { start, end } = getDateFilters();
  return HISTORICO.filter((ev) => {
    if (!isValidEvent(ev)) return false;
    if (start && ev.dateObj < start) return false;
    if (end && ev.dateObj > end) return false;
    return true;
  });
}

// ---------------------------
// Helpers gerais
// ---------------------------

function mapToSortedArray(map, keyFn = (x) => x[1], desc = true) {
  const arr = Array.from(map.entries());
  arr.sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    return desc ? kb - ka : ka - kb;
  });
  return arr;
}

function splitCategorias(categorias) {
  if (!categorias) return [];
  return categorias
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean);
}

function integranteImg(member) {
  if (!member) return "";
  return `integrantes/${member.nome.toLowerCase()}.jpeg`;
}

function slugifyArtistName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function artistImg(name) {
  if (!name) return "";
  const slug = slugifyArtistName(name);
  return `artistas/${slug}.jpg`;
}

// ---------------------------
// Insights da banda
// ---------------------------

function computeBandInsights(events) {
  const allMusicIds = [];
  const allArtists = [];
  const allMembers = [];
  const musicFirstSeen = new Map();
  const musicCounts = new Map();
  const artistCounts = new Map();
  const categoriaCounts = new Map();

  for (const ev of events) {
    const date = ev.dateObj;
    const uniqueMembers = Array.from(new Set(ev.integrantes || []));
    for (const mid of uniqueMembers) {
      allMembers.push(mid);
    }

    for (const mid of ev.musicas) {
      allMusicIds.push(mid);
      musicCounts.set(mid, (musicCounts.get(mid) || 0) + 1);
      if (!musicFirstSeen.has(mid)) musicFirstSeen.set(mid, date);

      const musica = MUSIC_BY_ID.get(mid);
      if (!musica) continue;
      allArtists.push(musica.artista);

      artistCounts.set(
        musica.artista,
        (artistCounts.get(musica.artista) || 0) + 1
      );

      for (const cat of splitCategorias(musica.categorias)) {
        categoriaCounts.set(cat, (categoriaCounts.get(cat) || 0) + 1);
      }
    }
  }

  // Garante catálogo completo para raridades/artistas menos tocados
  for (const musica of MUSICAS_RAW) {
    if (!musicCounts.has(musica.id)) musicCounts.set(musica.id, 0);
    if (!artistCounts.has(musica.artista)) artistCounts.set(musica.artista, 0);
    for (const cat of splitCategorias(musica.categorias)) {
      if (!categoriaCounts.has(cat)) categoriaCounts.set(cat, 0);
    }
  }

  const totalCultos = events.length;
  const totalExecucoes = allMusicIds.length;
  const musicUniqueCount = new Set(allMusicIds).size;
  const artistUniqueCount = new Set(allArtists).size;
  const memberUniqueCount = new Set(allMembers).size;

  const totalMusicasCatalogo = MUSICAS_RAW.length;
  const artistasCatalogoSet = new Set(MUSICAS_RAW.map((m) => m.artista));
  const totalArtistasCatalogo = artistasCatalogoSet.size;

  // Peso de categoria para desempate de top músicas
  const categoriaScoreByMusic = new Map();
  for (const [mid] of musicCounts.entries()) {
    const musica = MUSIC_BY_ID.get(mid);
    let score = 0;
    if (musica) {
      for (const cat of splitCategorias(musica.categorias)) {
        score += categoriaCounts.get(cat) || 0;
      }
    }
    categoriaScoreByMusic.set(mid, score);
  }

  // Top músicas
  const musicEntries = Array.from(musicCounts.entries()).filter(
    ([_, c]) => c > 0
  );
  musicEntries.sort((a, b) => {
    const [idA, countA] = a;
    const [idB, countB] = b;
    if (countB !== countA) return countB - countA;
    const catA = categoriaScoreByMusic.get(idA) || 0;
    const catB = categoriaScoreByMusic.get(idB) || 0;
    if (catB !== catA) return catB - catA;
    const titleA = MUSIC_BY_ID.get(idA)?.titulo || "";
    const titleB = MUSIC_BY_ID.get(idB)?.titulo || "";
    return titleA.localeCompare(titleB);
  });

  const topMusics = musicEntries.slice(0, 10).map(([id, count]) => ({
    id,
    count,
    musica: MUSIC_BY_ID.get(id),
    categoriaScore: categoriaScoreByMusic.get(id) || 0,
  }));

  // Raridades (inclui 0 execuções)
  const raridadesEntries = Array.from(musicCounts.entries());
  raridadesEntries.sort((a, b) => {
    const [idA, countA] = a;
    const [idB, countB] = b;
    if (countA !== countB) return countA - countB;
    const titleA = MUSIC_BY_ID.get(idA)?.titulo || "";
    const titleB = MUSIC_BY_ID.get(idB)?.titulo || "";
    return titleA.localeCompare(titleB);
  });
  const raridades = raridadesEntries.slice(0, 10).map(([id, count]) => ({
    id,
    count,
    musica: MUSIC_BY_ID.get(id),
  }));

  // Artistas mais e menos tocados
  const artistEntries = Array.from(artistCounts.entries());
  artistEntries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  const topArtistsArr = artistEntries.filter(([_, c]) => c > 0);
  const topArtists = topArtistsArr
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const leastArtistEntries = Array.from(artistCounts.entries());
  leastArtistEntries.sort((a, b) => {
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[0].localeCompare(b[0]);
  });
  const leastArtists = leastArtistEntries
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Novas músicas por mês (guardado se quiser usar depois)
  const newPerMonth = new Map();
  for (const [mid, firstDate] of musicFirstSeen.entries()) {
    const key = `${firstDate.getFullYear()}-${String(
      firstDate.getMonth() + 1
    ).padStart(2, "0")}`;
    newPerMonth.set(key, (newPerMonth.get(key) || 0) + 1);
  }
  const newPerMonthArr = Array.from(newPerMonth.entries()).sort();

  return {
    totalCultos,
    totalExecucoes,
    musicUniqueCount,
    artistUniqueCount,
    memberUniqueCount,
    totalMusicasCatalogo,
    totalArtistasCatalogo,
    topMusics,
    raridades,
    topArtists,
    leastArtists,
    newPerMonthArr,
  };
}

// ---------------------------
// Insights por integrante
// ---------------------------

function getPrimaryInstrument(member) {
  if (!member || !member.function || !member.function[0]) return null;
  const fn = member.function[0];
  const entries = Object.entries(fn);
  const priority = { hard: 3, medium: 2, easy: 1, "": 0 };
  entries.sort((a, b) => (priority[b[1]] || 0) - (priority[a[1]] || 0));
  return entries.length ? entries[0][0] : null;
}

function computeMemberInsights(events, memberId) {
  const member = MEMBER_BY_ID.get(memberId);
  if (!member) return null;

  const eventsWithMember = events.filter((ev) =>
    (ev.integrantes || []).includes(memberId)
  );
  const totalCultosComMembro = eventsWithMember.length;
  const totalCultosPeriodo = events.length;
  const participacaoPercent =
    totalCultosPeriodo > 0
      ? Math.round((totalCultosComMembro / totalCultosPeriodo) * 100)
      : 0;

  const allMusicIds = [];
  const allArtists = [];
  const musicCounts = new Map();
  const musicCountsEscolhidas = new Map();
  const artistCounts = new Map();
  const artistCountsEscolhidos = new Map();
  const parceiroCounts = new Map();

  const musicTotalCounts = new Map();
  for (const ev of events) {
    for (const mid of ev.musicas) {
      musicTotalCounts.set(mid, (musicTotalCounts.get(mid) || 0) + 1);
    }
  }
  const musicCountsComMembro = new Map();

  for (const ev of eventsWithMember) {
    const outros = (ev.integrantes || []).filter((id) => id !== memberId);
    for (const o of outros) {
      parceiroCounts.set(o, (parceiroCounts.get(o) || 0) + 1);
    }

    for (const mid of ev.musicas) {
      allMusicIds.push(mid);
      musicCounts.set(mid, (musicCounts.get(mid) || 0) + 1);
      const musica = MUSIC_BY_ID.get(mid);
      if (!musica) continue;
      allArtists.push(musica.artista);
      artistCounts.set(
        musica.artista,
        (artistCounts.get(musica.artista) || 0) + 1
      );

      musicCountsComMembro.set(mid, (musicCountsComMembro.get(mid) || 0) + 1);
    }
  }

  for (const ev of events) {
    if (!Array.isArray(ev.header) || !ev.header.includes(memberId)) continue;
    for (const mid of ev.musicas) {
      musicCountsEscolhidas.set(mid, (musicCountsEscolhidas.get(mid) || 0) + 1);
      const musica = MUSIC_BY_ID.get(mid);
      if (!musica) continue;
      artistCountsEscolhidos.set(
        musica.artista,
        (artistCountsEscolhidos.get(musica.artista) || 0) + 1
      );
    }
  }

  const totalExecucoes = allMusicIds.length;
  const uniqueSongsCount = new Set(allMusicIds).size;
  const uniqueArtistsCount = new Set(allArtists).size;

  const totalMusicasCatalogo = MUSICAS_RAW.length;
  const artistasCatalogoSet = new Set(MUSICAS_RAW.map((m) => m.artista));
  const totalArtistasCatalogo = artistasCatalogoSet.size;

  const uniqueSongsPercent =
    totalMusicasCatalogo > 0
      ? Math.round((uniqueSongsCount / totalMusicasCatalogo) * 100)
      : 0;

  const uniqueArtistsPercent =
    totalArtistasCatalogo > 0
      ? Math.round((uniqueArtistsCount / totalArtistasCatalogo) * 100)
      : 0;

  const topMusicsTocadas = mapToSortedArray(musicCounts)
    .slice(0, 10)
    .map(([id, count]) => ({
      id,
      count,
      musica: MUSIC_BY_ID.get(id),
    }));
  const topMusicsEscolhidas = mapToSortedArray(musicCountsEscolhidas)
    .slice(0, 10)
    .map(([id, count]) => ({
      id,
      count,
      musica: MUSIC_BY_ID.get(id),
    }));
  const topArtistsTocados = mapToSortedArray(artistCounts)
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));
  const topArtistsEscolhidos = mapToSortedArray(artistCountsEscolhidos)
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  const parceiros = mapToSortedArray(parceiroCounts)
    .slice(0, 13)
    .map(([pid, count]) => ({
      member: MEMBER_BY_ID.get(pid),
      count,
    }));

  const assinatura = [];
  for (const [mid, withCount] of musicCountsComMembro.entries()) {
    const total = musicTotalCounts.get(mid) || 0;
    if (total < 2) continue;
    const ratio = withCount / total;
    if (ratio >= 0.75) {
      assinatura.push({
        id: mid,
        musica: MUSIC_BY_ID.get(mid),
        withCount,
        total,
        ratio,
      });
    }
  }
  assinatura.sort((a, b) => b.ratio - a.ratio || b.withCount - a.withCount);
  const assinaturaTop = assinatura.slice(0, 10);

  const primaryInstrument = getPrimaryInstrument(member);
  const difficultyCounts = { easy: 0, medium: 0, hard: 0, unknown: 0 };
  if (primaryInstrument) {
    for (const ev of eventsWithMember) {
      for (const mid of ev.musicas) {
        const musica = MUSIC_BY_ID.get(mid);
        if (!musica || !musica.level) {
          difficultyCounts.unknown++;
          continue;
        }
        const lvl = musica.level[primaryInstrument] || "unknown";
        if (!difficultyCounts[lvl]) difficultyCounts[lvl] = 0;
        difficultyCounts[lvl]++;
      }
    }
  }

  return {
    member,
    totalCultosComMembro,
    totalCultosPeriodo,
    participacaoPercent,
    totalExecucoes,
    uniqueSongsCount,
    uniqueSongsPercent,
    uniqueArtistsCount,
    uniqueArtistsPercent,
    topMusicsTocadas,
    topMusicsEscolhidas,
    topArtistsTocados,
    topArtistsEscolhidos,
    parceiros,
    assinaturaTop,
    primaryInstrument,
    difficultyCounts,
  };
}

// ---------------------------
// Render helpers
// ---------------------------

function createCard(title, contentHtml, extraClass = "") {
  const div = document.createElement("div");
  div.className = "card " + extraClass;
  div.innerHTML = `
    <h3 class="card-title">${title}</h3>
    <div class="card-content">${contentHtml}</div>
  `;
  return div;
}

// ---------------------------
// Render: Visão da banda
// ---------------------------

function renderBandSection(events) {
  const insights = computeBandInsights(events);
  const root = document.getElementById("bandSection");
  root.innerHTML = "";

  // Resumo
  const summary = document.createElement("div");
  summary.className = "card-grid summary-grid";

  summary.appendChild(
    createCard(
      "Cultos no período",
      `
    <div class="summary-metric">
      <div class="summary-icon summary-icon-purple">📅</div>
      <div>
        <p class="summary-label">Cultos no período</p>
        <p class="big-number">${insights.totalCultos}</p>
      </div>
    </div>
    `,
      "summary-card summary-cultos"
    )
  );

  summary.appendChild(
    createCard(
      "Execuções de músicas",
      `
    <div class="summary-metric">
      <div class="summary-icon summary-icon-green">🎵</div>
      <div>
        <p class="summary-label">Execuções de músicas</p>
        <p class="big-number">${insights.totalExecucoes}</p>
      </div>
    </div>
    `,
      "summary-card summary-execs"
    )
  );

  summary.appendChild(
    createCard(
      "Músicas diferentes",
      `
    <div class="summary-metric">
      <div class="summary-icon summary-icon-blue">📚</div>
      <div>
        <p class="summary-label">Músicas diferentes</p>
        <p class="big-number">
          ${insights.musicUniqueCount}
          <span class="big-number-secondary">de ${insights.totalMusicasCatalogo}</span>
        </p>
      </div>
    </div>
    `,
      "summary-card summary-musics"
    )
  );

  summary.appendChild(
    createCard(
      "Artistas diferentes",
      `
    <div class="summary-metric">
      <div class="summary-icon summary-icon-pink">👥</div>
      <div>
        <p class="summary-label">Artistas diferentes</p>
        <p class="big-number">
          ${insights.artistUniqueCount}
          <span class="big-number-secondary">de ${insights.totalArtistasCatalogo}</span>
        </p>
      </div>
    </div>
    `,
      "summary-card summary-artists"
    )
  );

  root.appendChild(summary);

  // Linha 1: Top músicas + raridades
  const featuredTracks = insights.topMusics.slice(0, 3);
  const restTracks = insights.topMusics.slice(3);

  const featuredTracksHtml = featuredTracks
    .map((m, idx) => {
      const banBadge =
        m.musica && m.musica.ban
          ? '<span class="badge badge-ban">BANIDA</span>'
          : "";
      const thumb = m.musica
        ? `<a href="https://www.youtube.com/watch?v=${m.musica.referLink}" target="_blank">
      <img class="thumb thumb-xl" src="https://img.youtube.com/vi/${m.musica.referLink}/0.jpg" alt="thumb">
    </a>`
        : "";
      return `
      <div class="track-feature-card">
        <div class="track-feature-left">
          ${thumb}
        </div>
        <div class="track-feature-info">
          <div class="track-title"><span class="rank rank-${idx + 1}">#${idx + 1}</span> ${
            m.musica ? m.musica.titulo : "ID " + m.id
          } ${banBadge}</div>
          <div class="track-artist">${m.musica ? m.musica.artista : ""}</div>
          <div class="track-count-row">
            <span class="track-count">${m.count}× no período</span>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  const restTracksHtml = restTracks
    .map((m, idx) => {
      const banBadge =
        m.musica && m.musica.ban
          ? '<span class="badge badge-ban">BANIDA</span>'
          : "";
      const thumb = m.musica
        ? `<a href="https://www.youtube.com/watch?v=${m.musica.referLink}" target="_blank">
      <img class="thumb thumb-md" src="https://img.youtube.com/vi/${m.musica.referLink}/0.jpg" alt="thumb">
    </a>`
        : "";
      const rankNum = idx + 4;
      return `
      <li class="top-track-item">
        <div class="top-track-left">
          <span class="rank rank-${rankNum}">#${rankNum}</span>
          ${thumb}
          <div class="track-info">
            <div class="track-title">${
              m.musica ? m.musica.titulo : "ID " + m.id
            } ${banBadge}</div>
            <div class="track-artist">${m.musica ? m.musica.artista : ""}</div>
          </div>
        </div>
        <span class="track-count">${m.count}×</span>
      </li>
    `;
    })
    .join("");

  const topMusicsCardHtml = `
    <div class="track-featured-row">
      ${featuredTracksHtml || "<p class='muted'>Nenhuma música no período.</p>"}
    </div>
    ${
      restTracks.length
        ? `<ul class="list top-tracks">${restTracksHtml}</ul>`
        : ""
    }
  `;
  const topMusicsCard = createCard("MÚSICAS MAIS TOCADAS", topMusicsCardHtml);

  const featuredRares = insights.raridades.slice(0, 3);
  const restRares = insights.raridades.slice(3);

  const featuredRaresHtml = featuredRares
    .map((m, idx) => {
      const thumb = m.musica
        ? `<a href="https://www.youtube.com/watch?v=${m.musica.referLink}" target="_blank">
      <img class="thumb thumb-xl" src="https://img.youtube.com/vi/${m.musica.referLink}/0.jpg" alt="thumb">
    </a>`
        : "";
      return `
      <div class="track-feature-card">
        <div class="track-feature-left">
          ${thumb}
        </div>
        <div class="track-feature-info">
          <div class="track-title"><span class="rank rank-${idx + 1}">#${idx + 1}</span> ${
            m.musica ? m.musica.titulo : "ID " + m.id
          }</div>
          <div class="track-artist">${m.musica ? m.musica.artista : ""}</div>
          <div class="track-count-row">
            <span class="track-count">${m.count}× no período</span>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  const restRaresHtml = restRares
    .map((m, idx) => {
      const thumb = m.musica
        ? `<a href="https://www.youtube.com/watch?v=${m.musica.referLink}" target="_blank">
      <img class="thumb thumb-md" src="https://img.youtube.com/vi/${m.musica.referLink}/0.jpg" alt="thumb">
    </a>`
        : "";
      const rankNum = idx + 4;
      return `
      <li class="top-track-item">
        <div class="top-track-left">
          <span class="rank rank-${rankNum}">#${rankNum}</span>
          ${thumb}
          <div class="track-info">
            <div class="track-title">${
              m.musica ? m.musica.titulo : "ID " + m.id
            }</div>
            <div class="track-artist">${m.musica ? m.musica.artista : ""}</div>
          </div>
        </div>
        <span class="track-count">${m.count}×</span>
      </li>
    `;
    })
    .join("");

  const raridadesCardHtml = `
    <div class="track-featured-row">
      ${
        featuredRaresHtml ||
        "<p class='muted'>Não há músicas raras no período.</p>"
      }
    </div>
    ${
      restRares.length
        ? `<ul class="list top-tracks">${restRaresHtml}</ul>`
        : ""
    }
  `;
  const raridadesCard = createCard(
    "MÚSICAS MENOS TOCADAS",
    raridadesCardHtml
  );

  const rowTracks = document.createElement("div");
  rowTracks.className = "band-row";
  rowTracks.appendChild(topMusicsCard);
  rowTracks.appendChild(raridadesCard);
  root.appendChild(rowTracks);

  // Linha 2: Top artistas + menos tocados
  const featuredTopArtists = insights.topArtists.slice(0, 3);
  const restTopArtists = insights.topArtists.slice(3);

  const featuredTopArtistsHtml = featuredTopArtists
    .map((a, idx) => {
      const initials = a.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 3)
        .toUpperCase();
      const imgSrc = artistImg(a.name);
      return `
      <div class="artist-feature-card">
        <div class="artist-avatar">
          <img src="${imgSrc}" alt="${
        a.name
      }" onerror="this.style.display='none';" />
        </div>
        <div class="artist-meta">
          <div class="artist-name"><span class="rank-label rank-${idx + 1}">#${
        idx + 1
      }</span> ${a.name}</div>
          <div class="artist-count">${a.count} execuções</div>
        </div>
      </div>
    `;
    })
    .join("");

  const restTopArtistsHtml = restTopArtists
    .map((a, idx) => {
      const initials = a.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 3)
        .toUpperCase();
      const imgSrc = artistImg(a.name);
      const rankNum = idx + 4;
      return `
      <li class="artist-row">
        <div class="artist-row-main">
          <span class="rank rank-${rankNum}">#${rankNum}</span>
          <div class="artist-avatar artist-avatar-sm">
            <img src="${imgSrc}" alt="${a.name}" onerror="this.style.display='none';" />
          </div>
          <span class="artist-row-name">${a.name}</span>
        </div>
        <span class="track-count">${a.count}×</span>
      </li>
    `;
    })
    .join("");

  const artistasCardHtml = `
    <div class="artist-featured-row">
      ${
        featuredTopArtistsHtml ||
        "<p class='muted'>Nenhum artista no período.</p>"
      }
    </div>
    ${
      restTopArtists.length ? `<ul class="list">${restTopArtistsHtml}</ul>` : ""
    }
  `;
  const artistasCard = createCard("Artistas mais tocados", artistasCardHtml);

  const leastArtists = insights.leastArtists;
  const leastFeatured = leastArtists.slice(0, 3);
  const leastRest = leastArtists.slice(3);

  const leastFeaturedHtml = leastFeatured
    .map((a, idx) => {
      const initials = a.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 3)
        .toUpperCase();
      const imgSrc = artistImg(a.name);
      return `
      <div class="artist-feature-card">
        <div class="artist-avatar">
          <img src="${imgSrc}" alt="${
        a.name
      }" onerror="this.style.display='none';" />
        </div>
        <div class="artist-meta">
          <div class="artist-name"><span class="rank-label rank-${idx + 1}">#${
        idx + 1
      }</span> ${a.name}</div>
          <div class="artist-count">${a.count} execuções</div>
        </div>
      </div>
    `;
    })
    .join("");

  const leastRestHtml = leastRest
    .map((a, idx) => {
      const initials = a.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 3)
        .toUpperCase();
      const imgSrc = artistImg(a.name);
      const rankNum = idx + 4;
      return `
      <li class="artist-row">
        <div class="artist-row-main">
          <span class="rank rank-${rankNum}">#${rankNum}</span>
          <div class="artist-avatar artist-avatar-sm">
            <img src="${imgSrc}" alt="${a.name}" onerror="this.style.display='none';" />
          </div>
          <span class="artist-row-name">${a.name}</span>
        </div>
        <span class="track-count">${a.count}×</span>
      </li>
    `;
    })
    .join("");

  const leastArtistsHtml = `
    <div class="artist-featured-row">
      ${leastFeaturedHtml || "<p class='muted'>Nenhum artista cadastrado.</p>"}
    </div>
    ${leastRest.length ? `<ul class="list">${leastRestHtml}</ul>` : ""}
  `;
  const leastArtistsCard = createCard(
    "Artistas menos tocados",
    leastArtistsHtml
  );

  const rowArtists = document.createElement("div");
  rowArtists.className = "band-row band-row-bottom";
  rowArtists.appendChild(artistasCard);
  rowArtists.appendChild(leastArtistsCard);
  root.appendChild(rowArtists);
}

// ---------------------------
// Render: Perfil do integrante
// ---------------------------

function renderMemberSection(events) {
  const select = document.getElementById("memberFilter");
  const memberId = parseInt(select.value, 10);
  const root = document.getElementById("memberSection");
  root.innerHTML = "";

  if (isNaN(memberId)) {
    root.innerHTML =
      "<p class='muted'>Selecione um integrante acima para ver o perfil detalhado.</p>";
    return;
  }

  const insights = computeMemberInsights(events, memberId);
  if (!insights) {
    root.innerHTML =
      "<p class='muted'>Não foi possível calcular os dados desse integrante.</p>";
    return;
  }

  const header = document.createElement("div");
  header.className = "member-header card";
  const imgSrc = integranteImg(insights.member);

  const cultos = insights.totalCultosComMembro;
  const perc = insights.participacaoPercent;
  const execs = insights.totalExecucoes;
  const funcao = insights.primaryInstrument || "Função principal não definida";

  const musDiff = insights.uniqueSongsCount;
  const musDiffPct = insights.uniqueSongsPercent;
  const artDiff = insights.uniqueArtistsCount;
  const artDiffPct = insights.uniqueArtistsPercent;

  const dc = insights.difficultyCounts;
  const totalDiff =
    (dc.easy || 0) + (dc.medium || 0) + (dc.hard || 0) + (dc.unknown || 0);

  header.innerHTML = `
    <div class="member-header-main">
      <div class="avatar avatar-lg">
        <img src="${imgSrc}" alt="${insights.member.nome}" onerror="this.style.visibility='hidden';" />
      </div>
      <div class="member-header-text">
        <h2>${insights.member.nome}</h2>
        <div class="member-badges">
          <div class="member-badge member-badge-musicas">
            <span class="member-badge-icon">🥁</span>
            <span>${funcao}</span>
          </div>
          <div class="member-badge member-badge-musicas">
            <span class="member-badge-icon">📅</span>
            <span>${cultos} cultos (${perc}% do período)</span>
          </div>
          <div class="member-badge member-badge-musicas">
            <span class="member-badge-icon">🎵</span>
            <span>${execs} músicas tocadas ( ​​🟢​ ${dc.easy} fáceis / 🟡 ${dc.medium} medianas / 🔴​${dc.hard} difíceis )</span>
          </div>
          <div class="member-badge member-badge-musicas">
            <span class="member-badge-icon">🎼</span>
            <span>${musDiff} músicas diferentes (${musDiffPct}% do repertório)</span>
          </div>
          <div class="member-badge member-badge-musicas">
            <span class="member-badge-icon">👥</span>
            <span>${artDiff} artistas diferentes (${artDiffPct}% do total)</span>
          </div>
        </div>
      </div>
    </div>
  `;
  root.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "card-grid";

  function buildMusicBlock(musics, emptyMsg, countLabelFn) {
    if (!musics || musics.length === 0) {
      return `<p class="muted">${emptyMsg}</p>`;
    }
    const [feat, ...rest] = musics;
    const featThumb = feat.musica
      ? `<a href="https://www.youtube.com/watch?v=${feat.musica.referLink}" target="_blank">
      <img class="thumb thumb-xl" src="https://img.youtube.com/vi/${feat.musica.referLink}/0.jpg" alt="thumb">
    </a>`
      : "";
    const featHtml = `
      <div class="track-feature-card">
        <div class="track-feature-left">
          ${featThumb}
        </div>
        <div class="track-feature-info">
          <div class="track-title"><span class="rank rank-1">#1</span> ${
            feat.musica ? feat.musica.titulo : "ID " + feat.id
          }</div>
          <div class="track-artist">${
            feat.musica ? feat.musica.artista : ""
          }</div>
          <div class="track-count-row">
            <span class="track-count">${countLabelFn(feat, 1)}</span>
          </div>
        </div>
      </div>
    `;
    const restHtml = rest
      .map((m, idx) => {
        const thumb = m.musica
          ? `<a href="https://www.youtube.com/watch?v=${m.musica.referLink}" target="_blank">
        <img class="thumb thumb-md" src="https://img.youtube.com/vi/${m.musica.referLink}/0.jpg" alt="thumb">
      </a>`
          : "";
        const rankNum = idx + 2;
        return `
        <li class="top-track-item">
          <div class="top-track-left">
            <span class="rank rank-${rankNum}">#${rankNum}</span>
            ${thumb}
            <div class="track-info">
              <div class="track-title">${
                m.musica ? m.musica.titulo : "ID " + m.id
              }</div>
              <div class="track-artist">${
                m.musica ? m.musica.artista : ""
              }</div>
            </div>
          </div>
          <span class="track-count">${countLabelFn(m, rankNum)}</span>
        </li>
      `;
      })
      .join("");
    return `
      <div class="track-featured-row">
        ${featHtml}
      </div>
      ${rest.length ? `<ul class="list top-tracks">${restHtml}</ul>` : ""}
    `;
  }

  function buildArtistBlock(artists, emptyMsg) {
    if (!artists || artists.length === 0) {
      return `<p class="muted">${emptyMsg}</p>`;
    }
    const [feat, ...rest] = artists;
    const initialsFeat = feat.name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();
    const imgSrcFeat = artistImg(feat.name);
    const featHtml = `
      <div class="artist-feature-card">
        <div class="artist-avatar">
          <img src="${imgSrcFeat}" alt="${feat.name}" onerror="this.style.display='none';" />
        </div>
        <div class="artist-meta">
          <div class="artist-name"><span class="rank-label rank-1">#1</span> ${feat.name}</div>
          <div class="artist-count">${feat.count} execuções</div>
        </div>
      </div>
    `;
    const restHtml = rest
      .map((a, idx) => {
        const initials = a.name
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 3)
          .toUpperCase();
        const imgSrcA = artistImg(a.name);
        const rankNum = idx + 2;
        return `
        <li class="artist-row">
          <div class="artist-row-main">
            <span class="rank rank-${rankNum}">#${rankNum}</span>
            <div class="artist-avatar artist-avatar-sm">
              <img src="${imgSrcA}" alt="${a.name}" onerror="this.style.display='none';" />
            </div>
            <span class="artist-row-name">${a.name}</span>
          </div>
          <span class="track-count">${a.count}×</span>
        </li>
      `;
      })
      .join("");
    return `
      <div class="artist-featured-row">
        ${featHtml}
      </div>
      ${rest.length ? `<ul class="list">${restHtml}</ul>` : ""}
    `;
  }

  function buildParceriasBlock(parceiros) {
    if (!parceiros || parceiros.length === 0) {
      return `<p class="muted">Nenhuma parceria recorrente.</p>`;
    }
    const [feat, ...rest] = parceiros;
    const imgFeat = feat.member ? integranteImg(feat.member) : "";
    const featHtml = `
      <div class="pair-feature-card">
        <div class="avatar avatar-lg">
          <img src="${imgFeat}" alt="${
      feat.member ? feat.member.nome : ""
    }" onerror="this.style.visibility='hidden';" />
        </div>
        <div class="pair-info">
          <div class="pair-names">${
            feat.member ? feat.member.nome : "Integrante"
          }</div>
          <div class="pair-count">${feat.count} cultos juntos</div>
        </div>
      </div>
    `;
    const restHtml = rest
      .map((p) => {
        if (!p.member) return "";
        const imgP = integranteImg(p.member);
        return `
        <li class="member-item">
          <div class="member-main">
            <div class="avatar avatar-sm">
              <img src="${imgP}" alt="${p.member.nome}" onerror="this.style.visibility='hidden';" />
            </div>
            <div class="member-info">
              <div class="member-name">${p.member.nome}</div>
            </div>
          </div>
          <span class="track-count">${p.count} cultos juntos</span>
        </li>
      `;
      })
      .join("");
    return `
      ${featHtml}
      ${rest.length ? `<ul class="list">${restHtml}</ul>` : ""}
    `;
  }

  // ----- ORDEM DOS CARDS NO PERFIL DO INTEGRANTE -----
  // 1. Músicas assinatura
  const assinaturaHtml = buildMusicBlock(
    insights.assinaturaTop,
    "Nenhuma música se destacou como assinatura.",
    (a) => `${a.withCount} / ${a.total} (${Math.round(a.ratio * 100)}%)`
  );
  grid.appendChild(createCard("Músicas assinatura", `${assinaturaHtml}`));

  // 2. Músicas que mais tocou
  const tocadasHtml = buildMusicBlock(
    insights.topMusicsTocadas,
    "Nenhuma música tocada.",
    (m) => `${m.count}×`
  );
  grid.appendChild(createCard("Músicas que mais tocou", tocadasHtml));

  // 3. Artistas que mais tocou
  const artistasTocHtml = buildArtistBlock(
    insights.topArtistsTocados,
    "Nenhum artista tocado."
  );
  grid.appendChild(createCard("Artistas que mais tocou", artistasTocHtml));

  // 4. Músicas que mais escolheu
  const escolhidasHtmlInner = buildMusicBlock(
    insights.topMusicsEscolhidas,
    "Nenhuma informação de escolha.",
    (m) => `${m.count}×`
  );
  grid.appendChild(
    createCard("Músicas que mais escolheu", `</p>${escolhidasHtmlInner}`)
  );

  // 5. Artistas que mais escolheu
  const artistasEscHtml = buildArtistBlock(
    insights.topArtistsEscolhidos,
    "Nenhum dado de artista escolhido."
  );
  grid.appendChild(createCard("Artistas que mais escolheu", artistasEscHtml));

  // 6. Com quem mais tocou
  const parceirosHtml = buildParceriasBlock(insights.parceiros);
  grid.appendChild(createCard("Com quem mais tocou", parceirosHtml));

  root.appendChild(grid);
}

// ---------------------------
// Navegação entre visões
// ---------------------------

function setActiveView(view) {
  document.querySelectorAll(".view-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.view === view);
  });
}

function populateMemberFilter() {
  const select = document.getElementById("memberFilter");
  select.innerHTML = '<option value="">Selecione um integrante</option>';
  const sorted = [...INTEGRANTES_RAW].sort((a, b) =>
    a.nome.localeCompare(b.nome)
  );
  for (const m of sorted) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.nome;
    select.appendChild(opt);
  }
}

function applyFiltersAndRender() {
  const events = filterEvents();
  renderBandSection(events);
  renderMemberSection(events);
}

// ---------------------------
// Inicialização
// ---------------------------

function initDateRangeFromHistorico() {
  if (!HISTORICO.length) return;
  const sorted = [...HISTORICO].sort((a, b) => a.dateObj - b.dateObj);
  const min = sorted[0].dateObj;
  const max = sorted[sorted.length - 1].dateObj;
  const startInput = document.getElementById("startDate");
  const endInput = document.getElementById("endDate");
  const toInput = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  startInput.value = toInput(min);
  endInput.value = toInput(max);
}

document.addEventListener("DOMContentLoaded", () => {
  const startInput = document.getElementById("startDate");
  const endInput = document.getElementById("endDate");
  const memberSelect = document.getElementById("memberFilter");

  startInput.addEventListener("change", applyFiltersAndRender);
  endInput.addEventListener("change", applyFiltersAndRender);

  memberSelect.addEventListener("change", (e) => {
    localStorage.setItem("selectedMember", e.target.value);
    applyFiltersAndRender();
    setActiveView("member");
  });

  document.querySelectorAll(".view-tab").forEach((btn) => {
    btn.addEventListener("click", () => setActiveView(btn.dataset.view));
  });

  loadData()
    .then(() => {
      populateMemberFilter();
      initDateRangeFromHistorico();

      // Restaurar integrante salvo
      const savedMember = localStorage.getItem("selectedMember");
      if (savedMember) {
        const opt = document.querySelector(
          `#memberFilter option[value=\"${savedMember}\"]`
        );
        if (opt) {
          memberSelect.value = savedMember;
          setActiveView("member");
        }
      }

      applyFiltersAndRender();
      setActiveView("band");
    })
    .catch((err) => {
      console.error("Erro carregando dados:", err);
      const bandSection = document.getElementById("bandSection");
      if (bandSection) {
        bandSection.innerHTML =
          "<p class='muted'>Erro ao carregar dados. Verifique os arquivos JSON.</p>";
      }
    });
});
