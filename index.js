// Janela de recência / futuro para ordenação do repertório
const TOCADA_NOS_ULTIMOS_X_DIAS = 56;
const TOCADA_NOS_PROXIMOS_X_DIAS = 56;

// Estado global
let activeCategories = new Set();
let repertorioMusicas = [];
let historicoEscalas = [];
let integrantesData = [];

// Utilitário: data BR -> Date
function parseDataBR(dataStr) {
  const [dia, mes, ano] = dataStr.split("/").map(Number);
  return new Date(ano, mes - 1, dia);
}

function normalizarHoje() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
}

// ---- TABs ----
function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const panels = document.querySelectorAll(".view-panel");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      panels.forEach((p) => {
        p.classList.toggle("active", p.id === `view-${view}`);
      });
    });
  });
}

// ---- ESCALA ATUAL ----

function encontrarProximaEscala() {
  const hoje = normalizarHoje();
  const escalasFuturas = historicoEscalas
    .map((escala) => ({
      ...escala,
      _dataObj: parseDataBR(escala.data),
    }))
    .filter((escala) => escala._dataObj >= hoje)
    .sort((a, b) => a._dataObj - b._dataObj);

  return escalasFuturas[0] || null;
}

function nivelPorPontuacao(totalPontos) {
  if (totalPontos >= 10) return "hard";
  if (totalPontos >= 6) return "medium";
  return "easy";
}

function classeNivel(nivel) {
  if (nivel === "hard") return "level-hard";
  if (nivel === "medium") return "level-medium";
  return "level-easy";
}

// Resumo de categorias e níveis de uma escala
function montarResumoEscala(escala) {
  const categoriasCount = {};
  const levelPoints = { easy: 1, medium: 3, hard: 5 };
  const levelTotalsPorInstrumento = {};
  const totalMusicas = escala.musicas.length;

  escala.musicas.forEach((id) => {
    const musica = repertorioMusicas.find((m) => m.id === id);
    if (!musica) return;

    if (musica.categorias) {
      const categorias = musica.categorias.split(";").map((c) => c.trim());
      categorias.forEach((cat) => {
        if (!cat) return;
        categoriasCount[cat] = (categoriasCount[cat] || 0) + 1;
      });
    }

    if (musica.level && typeof musica.level === "object") {
      Object.entries(musica.level).forEach(([instrumento, dificuldade]) => {
        if (!dificuldade || !levelPoints[dificuldade]) return;
        if (!levelTotalsPorInstrumento[instrumento]) {
          levelTotalsPorInstrumento[instrumento] = 0;
        }
        levelTotalsPorInstrumento[instrumento] +=
          levelPoints[dificuldade] || 0;
      });
    }
  });

  // categorias mais presentes
  const categoriasOrdenadas = Object.entries(categoriasCount)
    .sort((a, b) => b[1] - a[1])
    .map(([categoria, count]) => {
      const porcentagem = (count / totalMusicas) * 100;
      let level;
      if (count === 1) level = "hard";
      else if (porcentagem > 50) level = "easy";
      else level = "medium";
      return { categoria, count, porcentagem, level };
    });

  // instrumentos por dificuldade agregada
  const instrumentos = Object.entries(levelTotalsPorInstrumento).map(
    ([instrumento, pontos]) => ({
      instrumento,
      pontos,
      level: nivelPorPontuacao(pontos),
    })
  );

  return { categoriasOrdenadas, instrumentos };
}

function renderEscalaAtual() {
  const escala = encontrarProximaEscala();
  const dataEl = document.getElementById("escalaAtualData");
  const resumoEl = document.getElementById("escalaAtualResumo");
  const integrantesEl = document.getElementById("escalaAtualIntegrantes");
  const musicasEl = document.getElementById("escalaAtualMusicas");

  if (!escala) {
    if (dataEl)
      dataEl.textContent = "Nenhuma escala futura encontrada no histórico.";
    if (resumoEl) resumoEl.innerHTML = "";
    if (integrantesEl)
      integrantesEl.innerHTML = `<div class="placeholder-text">Nenhum integrante encontrado.</div>`;
    if (musicasEl)
      musicasEl.innerHTML = `<div class="placeholder-text">Nenhuma música encontrada.</div>`;
    return;
  }

  const dataObj = parseDataBR(escala.data);
  const semana = dataObj.toLocaleDateString("pt-BR", { weekday: "long" });
  const dia = String(dataObj.getDate()).padStart(2, "0");
  const mes = String(dataObj.getMonth() + 1).padStart(2, "0");
  const ano = dataObj.getFullYear();

  if (dataEl)
    dataEl.textContent = `${semana}, ${dia}/${mes}/${ano} · ${
      escala.tema || "sem tema definido"
    }`;

  // Resumo
  const resumo = montarResumoEscala(escala);
  resumoEl.innerHTML = "";

  resumo.categoriasOrdenadas.forEach((cat) => {
    // Mesmo critério antigo: mostrar apenas "easy" no resumo visual
    if (cat.level !== "easy") return;
    const chip = document.createElement("div");
    chip.className = `resumo-chip ${classeNivel(cat.level)}`;
    chip.innerHTML = `<span class="label">Categoria</span><span>${cat.categoria}</span>`;
    resumoEl.appendChild(chip);
  });

  resumo.instrumentos.forEach((inst) => {
    const chip = document.createElement("div");
    chip.className = `resumo-chip ${classeNivel(inst.level)}`;
    const nomeInst =
      inst.instrumento.charAt(0).toUpperCase() + inst.instrumento.slice(1);
    chip.innerHTML = `<span class="label">${nomeInst}</span><span>${
      inst.level === "easy"
        ? "Tranquilo"
        : inst.level === "medium"
        ? "Equilibrado"
        : "Puxado"
    }</span>`;
    resumoEl.appendChild(chip);
  });

  // Integrantes
  integrantesEl.innerHTML = "";
  (escala.integrantes || []).forEach((integranteEscala) => {
    const integrante = integrantesData.find((i) => i.id === integranteEscala);
    if (!integrante) return;

    const card = document.createElement("article");
    card.classList.add("member-card");
    const isHeader =
      Array.isArray(escala.header) &&
      escala.header.includes(integranteEscala);
    if (isHeader) card.classList.add("member-card-header");

    const wrapper = document.createElement("div");
    wrapper.className = "member-avatar-wrapper";

    const img = document.createElement("img");
    img.src = `integrantes/${integrante.nome.toLowerCase()}.jpeg`;
    img.alt = integrante.nome;
    img.className = "member-avatar";

    wrapper.appendChild(img);

    if (isHeader) {
      const crown = document.createElement("div");
      crown.className = "member-crown";
      crown.textContent = "👑";
      wrapper.appendChild(crown);
    }

    const nameEl = document.createElement("div");
    nameEl.className = "member-name";
    nameEl.textContent = integrante.nome;

    const roleEl = document.createElement("div");
    roleEl.className = "member-role";
    roleEl.textContent = integrante.funcao || "";

    card.appendChild(wrapper);
    card.appendChild(nameEl);
    card.appendChild(roleEl);

    integrantesEl.appendChild(card);
  });

  if (!escala.integrantes || escala.integrantes.length === 0) {
    integrantesEl.innerHTML =
      '<div class="placeholder-text">Nenhum integrante cadastrado para esta escala.</div>';
  }

  // Músicas da escala
  musicasEl.innerHTML = "";
  (escala.musicas || []).forEach((id) => {
    const musica = repertorioMusicas.find((m) => m.id === id);
    if (!musica) return;

    const card = criarCardMusica(musica, {
      marcarRecenciaEFuturo: false,
      destacarCategoriasSelecionadas: false,
    });
    musicasEl.appendChild(card);
  });

  if (!escala.musicas || escala.musicas.length === 0) {
    musicasEl.innerHTML =
      '<div class="placeholder-text">Nenhuma música cadastrada para esta escala.</div>';
  }
}

// ---- ESCALAS FUTURAS ----

function montarTextoEscalaParaCopiar(titulo, integrantesTexto, musicasTexto) {
  return `📅 *Escala: ${titulo}*\n\n${integrantesTexto}\n${musicasTexto}`;
}

function renderEscalasFuturas() {
  const container = document.getElementById("escalasFuturasContainer");
  container.innerHTML = "";

  const hoje = normalizarHoje();

  const escalasFuturas = historicoEscalas
    .map((escala) => ({
      ...escala,
      _dataObj: parseDataBR(escala.data),
    }))
    .filter((escala) => escala._dataObj >= hoje)
    .sort((a, b) => a._dataObj - b._dataObj);

  if (escalasFuturas.length === 0) {
    container.innerHTML =
      '<div class="placeholder-text">Nenhuma escala futura encontrada.</div>';
    return;
  }

  escalasFuturas.forEach((escala) => {
    const card = document.createElement("article");
    card.className = "escala-card";

    const dataObj = escala._dataObj;
    const semana = dataObj.toLocaleDateString("pt-BR", { weekday: "long" });
    const dia = String(dataObj.getDate()).padStart(2, "0");
    const mes = String(dataObj.getMonth() + 1).padStart(2, "0");
    const ano = dataObj.getFullYear();

    const header = document.createElement("div");
    header.className = "escala-header";

    const title = document.createElement("div");
    title.className = "escala-title";
    title.textContent = `${dia}/${mes}/${ano}`;

    const subtitle = document.createElement("div");
    subtitle.className = "escala-date-sub";
    subtitle.textContent = `${semana}${
      escala.tema ? ` · ${escala.tema}` : ""
    }`;

    header.appendChild(title);
    header.appendChild(subtitle);

    // Integrantes
    const integrantesDiv = document.createElement("div");
    integrantesDiv.className = "escala-integrantes";
    let integrantesTexto = "🧑‍🤝‍🧑 **Integrantes:**\n";

    if (Array.isArray(escala.integrantes) && escala.integrantes.length > 0) {
      escala.integrantes.forEach((id) => {
        const integrante = integrantesData.find((p) => p.id === id);
        if (!integrante) return;
        const chip = document.createElement("span");
        chip.className = "escala-chip";
        const isHeader =
          Array.isArray(escala.header) && escala.header.includes(id);
        chip.textContent = `${integrante.nome}${isHeader ? " 👑" : ""}`;
        integrantesDiv.appendChild(chip);

        integrantesTexto += `- ${integrante.nome}${isHeader ? " 👑" : ""}\n`;
      });
    } else {
      integrantesDiv.innerHTML =
        '<span class="escala-chip">Nenhum integrante</span>';
      integrantesTexto += "Nenhum integrante cadastrado.\n";
    }

    // Músicas
    const musicasDiv = document.createElement("div");
    musicasDiv.className = "escala-musicas";
    let musicasTexto = "**Músicas:**\n";

    const tituloMusicas = document.createElement("div");
    tituloMusicas.className = "escala-date-sub";
    tituloMusicas.textContent = "Repertório do dia:";
    musicasDiv.appendChild(tituloMusicas);

    const ul = document.createElement("ul");

    if (Array.isArray(escala.musicas) && escala.musicas.length > 0) {
      escala.musicas.forEach((id) => {
        const musica = repertorioMusicas.find((m) => m.id === id);
        if (!musica) return;

        const li = document.createElement("li");
        li.textContent = `${musica.titulo} - ${musica.artista}`;
        ul.appendChild(li);

        musicasTexto +=
          `🎵 ${musica.titulo || ""} ${
            musica.artista ? "- " + musica.artista : ""
          }\n` +
          (musica.referLink
            ? `🔗 Link: https://www.youtube.com/watch?v=${musica.referLink}\n`
            : "") +
          (musica.categorias
            ? `📌 Categoria: ${musica.categorias}\n`
            : "") +
          (musica.versiculos ? `📖 Versículo: ${musica.versiculos}\n` : "") +
          "\n";
      });
    } else {
      const li = document.createElement("li");
      li.textContent = "Nenhuma música cadastrada.";
      ul.appendChild(li);
      musicasTexto += "Nenhuma música cadastrada.\n";
    }

    musicasDiv.appendChild(ul);

    // Botão copiar
    const actions = document.createElement("div");
    actions.className = "escala-actions";

    const btnCopiar = document.createElement("button");
    btnCopiar.className = "btn btn-primary";
    btnCopiar.textContent = "Copiar escala";

    btnCopiar.addEventListener("click", () => {
      const texto = montarTextoEscalaParaCopiar(
        `${dia}/${mes}/${ano}`,
        integrantesTexto,
        musicasTexto
      );
      navigator.clipboard
        .writeText(texto)
        .then(() => {
          alert("Escala copiada para a área de transferência!");
        })
        .catch((err) => console.error("Erro ao copiar:", err));
    });

    actions.appendChild(btnCopiar);

    // Monta card
    card.appendChild(header);
    card.appendChild(integrantesDiv);
    card.appendChild(musicasDiv);
    card.appendChild(actions);

    container.appendChild(card);
  });
}

// ---- REPERTÓRIO ----

// Botões de categorias (com regras especiais de "disponíveis")
function setupCategoriasButtons() {
  const hoje = normalizarHoje();

  const musicasTocadasJanela = new Set();

  historicoEscalas.forEach((escala) => {
    const dataEscala = parseDataBR(escala.data);
    const diffDias = (dataEscala - hoje) / (1000 * 60 * 60 * 24);
    const dentroDaJanela =
      Math.abs(diffDias) <= TOCADA_NOS_ULTIMOS_X_DIAS ||
      (diffDias >= 0 && diffDias <= TOCADA_NOS_PROXIMOS_X_DIAS);

    if (dentroDaJanela) {
      (escala.musicas || []).forEach((id) => {
        musicasTocadasJanela.add(String(id));
      });
    }
  });

  // Considera disponíveis = não tocadas dentro da janela e não banidas
  const disponiveis = repertorioMusicas.filter(
    (m) => !musicasTocadasJanela.has(String(m.id)) && !m.ban
  );

  const categoriesSet = new Set();
  disponiveis.forEach((musica) => {
    if (musica.categorias) {
      musica.categorias
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean)
        .forEach((c) => categoriesSet.add(c));
    }
  });

  const musicasDisponiveisPorCategoria = {};
  categoriesSet.forEach((cat) => {
    musicasDisponiveisPorCategoria[cat] = disponiveis.filter((m) => {
      const cats = m.categorias
        ? m.categorias.split(";").map((c) => c.trim())
        : [];
      return cats.includes(cat);
    }).length;
  });

  const sortedCategories = Object.keys(musicasDisponiveisPorCategoria).sort(
    (a, b) => musicasDisponiveisPorCategoria[b] - musicasDisponiveisPorCategoria[a]
  );

  const container = document.getElementById("categoriasContainer");
  container.innerHTML = "";

  sortedCategories.forEach((cat) => {
    if (musicasDisponiveisPorCategoria[cat] <= 0) return;

    const btn = document.createElement("button");
    btn.className = "category-button";
    btn.innerHTML = `
      <span>${cat}</span>
      <span class="category-count">${musicasDisponiveisPorCategoria[cat]}</span>
    `;

    btn.addEventListener("click", () => {
      if (activeCategories.has(cat)) {
        activeCategories.delete(cat);
        btn.classList.remove("active");
      } else {
        activeCategories.add(cat);
        btn.classList.add("active");
      }
      renderRepertorio();
    });

    container.appendChild(btn);
  });
}

// Card de música (usado em escala atual e repertório)
function criarCardMusica(
  musica,
  {
    isRecent = false,
    isFuture = false,
    isBanned = false,
    matchCategoria = false,
    marcarRecenciaEFuturo = true,
    destacarCategoriasSelecionadas = true,
  } = {}
) {
  const card = document.createElement("article");
  card.className = "song-card";

  if (marcarRecenciaEFuturo) {
    if (isRecent) card.classList.add("recent");
    if (isFuture) card.classList.add("future");
    if (isBanned) card.classList.add("banned");
  }
  if (destacarCategoriasSelecionadas && matchCategoria) {
    card.classList.add("category-match");
  }

  const thumbWrapper = document.createElement("div");
  thumbWrapper.className = "song-thumb-wrapper";

  const link = document.createElement("a");
  link.href = `https://www.youtube.com/watch?v=${musica.referLink}`;
  link.target = "_blank";

  const img = document.createElement("img");
  img.className = "song-thumb";
  img.src = `https://img.youtube.com/vi/${musica.referLink}/0.jpg`;
  img.alt = `Thumbnail de ${musica.titulo}`;

  link.appendChild(img);
  thumbWrapper.appendChild(link);

  const main = document.createElement("div");
  main.className = "song-main";

  const title = document.createElement("p");
  title.className = "song-title";
  title.textContent = musica.titulo;

  const artist = document.createElement("p");
  artist.className = "song-artist";
  artist.textContent = musica.artista;

  const metaRow = document.createElement("div");
  metaRow.className = "song-meta-row";

  if (musica.categorias) {
    const pill = document.createElement("span");
    pill.className = "song-pill";
    pill.textContent = musica.categorias
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean)
      .join(" · ");
    metaRow.appendChild(pill);
  }

  if (musica.ban) {
    const banPill = document.createElement("span");
    banPill.className = "song-pill";
    banPill.textContent = "Banida";
    metaRow.appendChild(banPill);
  }

  const tags = document.createElement("div");
  tags.className = "song-tags";

  // categorias individuais
  if (musica.categorias) {
    musica.categorias
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean)
      .forEach((categoria) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = categoria;
        tags.appendChild(tag);
      });
  }

  // levels por instrumento
  if (musica.level && typeof musica.level === "object") {
    Object.entries(musica.level).forEach(([instrumento, dificuldade]) => {
      if (!dificuldade) return;
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent =
        instrumento.charAt(0).toUpperCase() + instrumento.slice(1);

      if (dificuldade === "hard") {
        tag.style.borderColor = "#ef4444";
        tag.style.color = "#fecaca";
      } else if (dificuldade === "medium") {
        tag.style.borderColor = "#eab308";
        tag.style.color = "#fef3c7";
      } else if (dificuldade === "easy") {
        tag.style.borderColor = "#22c55e";
        tag.style.color = "#bbf7d0";
      }

      tags.appendChild(tag);
    });
  }

  main.appendChild(title);
  main.appendChild(artist);
  main.appendChild(metaRow);

  card.appendChild(thumbWrapper);
  card.appendChild(main);
  card.appendChild(tags);

  return card;
}

// Render do repertório com todas as regras de ordenação
function renderRepertorio() {
  const container = document.getElementById("repertorioGrid");
  container.innerHTML = "";

  const hoje = normalizarHoje();

  // Contagem de execuções, sets de recentes / futuras
  const contagemMusicas = new Map();
  const musicasRecentes = new Set();
  const musicasFuturas = new Set();

  historicoEscalas.forEach((escala) => {
    const dataEscala = parseDataBR(escala.data);
    const diffDias = (dataEscala - hoje) / (1000 * 60 * 60 * 24);

    const dentroDaJanela =
      Math.abs(diffDias) <= TOCADA_NOS_ULTIMOS_X_DIAS ||
      (diffDias >= 0 && diffDias <= TOCADA_NOS_PROXIMOS_X_DIAS);

    if (!dentroDaJanela) return;

    (escala.musicas || []).forEach((rawId) => {
      const id = String(rawId);

      if (diffDias < 0) musicasRecentes.add(id);
      else musicasFuturas.add(id);

      contagemMusicas.set(id, (contagemMusicas.get(id) || 0) + 1);
    });
  });

  const activeArr = Array.from(activeCategories);

  const sortedMusicas = repertorioMusicas.slice().sort((a, b) => {
    const idA = String(a.id);
    const idB = String(b.id);

    const aBan = !!a.ban;
    const bBan = !!b.ban;
    if (aBan !== bBan) return aBan ? 1 : -1;

    const aFut = musicasFuturas.has(idA);
    const bFut = musicasFuturas.has(idB);
    if (aFut !== bFut) return aFut ? 1 : -1;

    const aRec = musicasRecentes.has(idA);
    const bRec = musicasRecentes.has(idB);
    if (aRec !== bRec) return aRec ? 1 : -1;

    // Se houver filtros de categorias
    if (activeCategories.size > 0) {
      const catsA = (a.categorias || "")
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean);
      const catsB = (b.categorias || "")
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean);

      const aExact =
        catsA.length === activeCategories.size &&
        activeArr.every((c) => catsA.includes(c));
      const bExact =
        catsB.length === activeCategories.size &&
        activeArr.every((c) => catsB.includes(c));
      if (aExact !== bExact) return aExact ? -1 : 1;

      const aMatchCount = catsA.filter((c) => activeCategories.has(c)).length;
      const bMatchCount = catsB.filter((c) => activeCategories.has(c)).length;
      if (aMatchCount !== bMatchCount) return bMatchCount - aMatchCount;
    }

    // Menos tocada vem antes
    const aCount = contagemMusicas.get(idA) || 0;
    const bCount = contagemMusicas.get(idB) || 0;
    if (aCount !== bCount) return aCount - bCount;

    // Empate → ordem alfabética
    return a.titulo.localeCompare(b.titulo);
  });

  sortedMusicas.forEach((musica) => {
    const idStr = String(musica.id);
    const isRecent = musicasRecentes.has(idStr);
    const isFuture = musicasFuturas.has(idStr);
    const isBanned = musica.ban === true;

    const cats = (musica.categorias || "")
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean);

    const matchCategoria =
      activeCategories.size > 0 &&
      cats.some((c) => activeCategories.has(c));

    const card = criarCardMusica(musica, {
      isRecent,
      isFuture,
      isBanned,
      matchCategoria,
    });

    container.appendChild(card);
  });

  if (sortedMusicas.length === 0) {
    container.innerHTML =
      '<div class="placeholder-text">Nenhuma música encontrada no repertório.</div>';
  }
}

// ---- CARREGAMENTO INICIAL ----

async function carregarDados() {
  const [escalas, integrantes, musicas] = await Promise.all([
    fetch("historico.json").then((r) => r.json()),
    fetch("integrantes/integrantes.json").then((r) => r.json()),
    fetch("musicas.json").then((r) => r.json()),
  ]);

  historicoEscalas = escalas;
  integrantesData = integrantes;

  repertorioMusicas = musicas.map((m) => ({
    ...m,
  }));
}

async function init() {
  setupTabs();
  await carregarDados();

  renderEscalaAtual();
  renderEscalasFuturas();
  setupCategoriasButtons();
  renderRepertorio();
}

window.addEventListener("DOMContentLoaded", init);
