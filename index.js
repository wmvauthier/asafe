// =========================================================
// PROJETO ASAFE - INDEX.JS (versão atualizada)
// =========================================================

// Estado global
let integrantes = [];
let musicas = [];
let historico = [];
let categoriasUnicas = [];
let activeCategories = [];

// Constantes
const TOCADA_NOS_ULTIMOS_X_DIAS = 56; // ~8 semanas

// Map de valores de dificuldade
const LEVEL_VALUE = {
  easy: 1,
  medium: 2,
  hard: 3,
};

// =========================================================
// FUNÇÕES UTILITÁRIAS
// =========================================================

function slugify(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();
}

function parseDate(str) {
  if (!str) return null;
  const [dia, mes, ano] = str.split("/").map(Number);
  if (!dia || !mes || !ano) return null;
  return new Date(ano, mes - 1, dia);
}

function formatarData(date) {
  if (!(date instanceof Date)) return "";
  const dias = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];
  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${dias[date.getDay()]}, ${date.getDate()} de ${
    meses[date.getMonth()]
  }`;
}

function nivelToValor(nivel) {
  return LEVEL_VALUE[nivel] || 0;
}

function valorToNivel(valor) {
  if (!valor || valor <= 0) return null;
  if (valor < 1.5) return "easy";
  if (valor < 2.5) return "medium";
  return "hard";
}

function nivelLabel(nivel) {
  if (nivel === "easy") return "Fácil";
  if (nivel === "medium") return "Médio";
  if (nivel === "hard") return "Difícil";
  return "-";
}

function formatInstrumentName(key) {
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
  return map[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

// =========================================================
// CARREGAMENTO INICIAL
// =========================================================

async function init() {
  try {
    const [integrantesData, musicasData, historicoData] = await Promise.all([
      fetch("integrantes/integrantes.json").then((r) => r.json()),
      fetch("musicas.json").then((r) => r.json()),
      fetch("historico.json").then((r) => r.json()),
    ]);

    integrantes = integrantesData || [];
    musicas = musicasData || [];
    historico = historicoData || [];

    normalizarMusicas();
    processarCategoriasUnicas();

    carregarEscalaAtual();
    carregarEscalasFuturas();
    renderRepertorio();
  } catch (e) {
    console.error("Erro ao carregar dados:", e);
  }
}

window.addEventListener("DOMContentLoaded", init);

// =========================================================
// TABS
// =========================================================

document.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".tab-button");
  if (!btn) return;

  document
    .querySelectorAll(".tab-button")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");

  const view = btn.getAttribute("data-view");
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.remove("active");
  });
  const target = document.querySelector(`#view-${view}`);
  if (target) target.classList.add("active");
});

// =========================================================
// NORMALIZAÇÃO DE MÚSICAS
// =========================================================

function normalizarMusicas() {
  musicas = musicas.map((m) => {
    const clone = { ...m };

    // Categorias: string -> array
    if (typeof clone.categorias === "string") {
      clone.categorias = clone.categorias
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean);
    }
    if (!Array.isArray(clone.categorias)) {
      clone.categorias = [];
    }

    // Ban / banned / active
    const banido = clone.banned === true || clone.ban === true;
    if (banido) {
      clone.banned = true;
      clone.active = false;
    } else if (clone.active === undefined) {
      clone.active = true;
    }

    // Imagem do artista
    const artistaSlug = slugify(clone.artista || "");
    clone._artistImage = `artistas/${artistaSlug}.jpg`;

    // Thumb do YouTube da música
    if (clone.referLink) {
      clone._thumbUrl = `https://img.youtube.com/vi/${clone.referLink}/0.jpg`;
    } else {
      clone._thumbUrl = "";
    }

    return clone;
  });
}

// =========================================================
// CATEGORIAS (REPERTÓRIO)
// =========================================================

function processarCategoriasUnicas() {
  const set = new Set();
  musicas.forEach((m) => {
    if (Array.isArray(m.categorias)) {
      m.categorias.forEach((c) => set.add(c));
    }
  });
  categoriasUnicas = Array.from(set).sort();
  renderCategoriasFiltros();
}

function renderCategoriasFiltros() {
  const container = document.getElementById("categoriasContainer");
  if (!container) return;
  container.innerHTML = "";

  categoriasUnicas.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "category-button";
    btn.textContent = cat;

    if (activeCategories.includes(cat)) {
      btn.classList.add("active");
    }

    btn.addEventListener("click", () => {
      const isActive = activeCategories.includes(cat);

      if (isActive) {
        activeCategories = activeCategories.filter((c) => c !== cat);
        btn.classList.remove("active");
      } else {
        if (activeCategories.length >= 2) {
          // no máximo 2 categorias
          return;
        }
        activeCategories.push(cat);
        btn.classList.add("active");
      }

      renderRepertorio();
    });

    container.appendChild(btn);
  });
}

function musicaMatchScoreCategorias(musica) {
  if (!activeCategories.length) return 0;
  const categorias = Array.isArray(musica.categorias) ? musica.categorias : [];
  let score = 0;
  activeCategories.forEach((c) => {
    if (categorias.includes(c)) score += 1;
  });
  return score;
}

// =========================================================
// ESTATÍSTICAS DO REPERTÓRIO DE UMA ESCALA
// =========================================================

function calcularEstatisticasRepertorio(escala) {
  const ids = Array.isArray(escala.musicas) ? escala.musicas : [];
  const totalMusicas = ids.length;

  const instrumentosMap = {};
  const categoriasMap = {};

  ids.forEach((id) => {
    const musica = musicas.find((m) => m.id === id);
    if (!musica) return;

    // níveis por instrumento
    if (musica.level && typeof musica.level === "object") {
      Object.entries(musica.level).forEach(([inst, niv]) => {
        if (!niv) return;
        const val = nivelToValor(niv);
        if (!val) return;
        if (!instrumentosMap[inst]) {
          instrumentosMap[inst] = { soma: 0, count: 0 };
        }
        instrumentosMap[inst].soma += val;
        instrumentosMap[inst].count += 1;
      });
    }

    // categorias
    (musica.categorias || []).forEach((cat) => {
      if (!categoriasMap[cat]) categoriasMap[cat] = 0;
      categoriasMap[cat] += 1;
    });
  });

  const dificuldades = {};
  let totalNivelSoma = 0;
  let totalNivelCount = 0;

  Object.entries(instrumentosMap).forEach(([inst, { soma, count }]) => {
    if (!count) return;
    const media = soma / count;
    const nivel = valorToNivel(media);
    if (nivel) {
      dificuldades[inst] = nivel;
      totalNivelSoma += soma;
      totalNivelCount += count;
    }
  });

  const categoriasDominantes = [];
  if (totalMusicas > 0) {
    Object.entries(categoriasMap).forEach(([cat, qtd]) => {
      const perc = qtd / totalMusicas;
      if (perc >= 0.6) {
        categoriasDominantes.push(cat);
      }
    });
  }

  let dificuldadeMediaNivel = null;
  if (totalNivelCount > 0) {
    dificuldadeMediaNivel = valorToNivel(totalNivelSoma / totalNivelCount);
  }

  return {
    dificuldadesPorInstrumento: dificuldades,
    categoriasDominantes,
    totalMusicas,
    dificuldadeMediaNivel,
  };
}

// =========================================================
// BADGES DE DIFICULDADE (POR MÚSICA)
// =========================================================

function criarBadgesDificuldadesMusica(musica) {
  const badges = [];
  if (!musica || !musica.level || typeof musica.level !== "object") {
    return badges;
  }

  Object.entries(musica.level).forEach(([inst, nivel]) => {
    if (!nivel) return;

    const span = document.createElement("span");
    span.className = "tag tag-diff";

    const dot = document.createElement("span");
    dot.className = "tag-diff-dot";
    if (nivel === "easy") dot.classList.add("tag-diff-dot-easy");
    else if (nivel === "medium") dot.classList.add("tag-diff-dot-medium");
    else if (nivel === "hard") dot.classList.add("tag-diff-dot-hard");

    const label = document.createElement("span");
    label.textContent = formatInstrumentName(inst);

    span.append(dot, label);
    badges.push(span);
  });

  return badges;
}

// =========================================================
// ESCALA ATUAL
// =========================================================

function carregarEscalaAtual() {
  if (!historico.length) return;

  const hoje = new Date();
  const futuras = historico
    .map((d) => ({ ...d, dataObj: parseDate(d.data) }))
    .filter((d) => d.dataObj && d.dataObj >= hoje)
    .sort((a, b) => a.dataObj - b.dataObj);

  const dataEl = document.getElementById("escalaAtualData");
  const countTagEl = document.getElementById("escalaAtualCountTag");

  if (!futuras.length) {
    if (dataEl) {
      dataEl.textContent = "Nenhum culto futuro encontrado.";
    }
    if (countTagEl) {
      countTagEl.textContent = "";
    }
    return;
  }

  const proxima = futuras[0];

  if (dataEl) {
    dataEl.textContent = formatarData(proxima.dataObj);
  }

  let integrantesIds = [];
  if (Array.isArray(proxima.integrantes) && proxima.integrantes.length > 0) {
    if (typeof proxima.integrantes[0] === "object") {
      integrantesIds = proxima.integrantes
        .map((i) => i && i.id)
        .filter((id) => id != null);
    } else {
      integrantesIds = proxima.integrantes.slice();
    }
  } else {
    integrantesIds = integrantes.map((i) => i.id);
  }

  const escalaAtual = {
    ...proxima,
    integrantes: integrantesIds,
    dataObj: proxima.dataObj,
    musicas: Array.isArray(proxima.musicas) ? proxima.musicas.slice() : [],
  };

  const countMusicas = (escalaAtual.musicas || []).length;
  const countInt = (escalaAtual.integrantes || []).length;

  if (countTagEl) {
    countTagEl.textContent = `${countMusicas} músicas · ${countInt} integrantes`;
  }

  renderEscalaAtualResumo(escalaAtual);
  renderEscalaAtualIntegrantes(escalaAtual);
  renderEscalaAtualMusicas(escalaAtual);
}

function renderEscalaAtualResumo(escala) {
  const container = document.getElementById("escalaAtualResumo");
  if (!container) return;
  container.innerHTML = "";

  const stats = calcularEstatisticasRepertorio(escala);
  const categoriaDominante = stats.categoriasDominantes[0] || null;
  const dificuldadeNivel = stats.dificuldadeMediaNivel;

  // Linha de contagem básica
  const row = document.createElement("div");
  row.className = "resumo-row";

  const resumo = [
    { label: "Músicas", value: (escala.musicas || []).length },
    { label: "Integrantes", value: (escala.integrantes || []).length },
  ];

  resumo.forEach((r) => {
    const chip = document.createElement("div");
    chip.className = "resumo-chip";

    const lbl = document.createElement("span");
    lbl.className = "label";
    lbl.textContent = r.label;

    const v = document.createElement("span");
    v.textContent = r.value;

    chip.append(lbl, v);
    row.appendChild(chip);
  });

  container.appendChild(row);

  // Badges: categoria dominante + dificuldade geral
  const badgesRow = document.createElement("div");
  badgesRow.className = "resumo-badges-row";

  if (categoriaDominante) {
    const catTag = document.createElement("span");
    catTag.className = "tag";
    catTag.textContent = categoriaDominante;
    badgesRow.appendChild(catTag);
  }

  if (dificuldadeNivel) {
    const diffTag = document.createElement("span");
    diffTag.className = "tag tag-diff";

    const dot = document.createElement("span");
    dot.className = "tag-diff-dot";
    if (dificuldadeNivel === "easy")
      dot.classList.add("tag-diff-dot-easy");
    else if (dificuldadeNivel === "medium")
      dot.classList.add("tag-diff-dot-medium");
    else if (dificuldadeNivel === "hard")
      dot.classList.add("tag-diff-dot-hard");

    const label = document.createElement("span");
    label.textContent = nivelLabel(dificuldadeNivel);

    diffTag.append(dot, label);
    badgesRow.appendChild(diffTag);
  }

  if (badgesRow.childElementCount) {
    container.appendChild(badgesRow);
  }

  // Se não tem músicas, não mostra detalhes extras
  if (!stats.totalMusicas) return;

  const extra = document.createElement("div");
  extra.className = "escala-resumo-extra";

  // Dificuldades
  const difSec = document.createElement("div");
  const difTitle = document.createElement("div");
  difTitle.className = "escala-resumo-section-title";
  difTitle.textContent = "Dificuldade média por instrumento";

  const difList = document.createElement("div");
  difList.className = "escala-resumo-dif-list";

  Object.entries(stats.dificuldadesPorInstrumento).forEach(
    ([inst, nivel]) => {
      const chip = document.createElement("div");
      chip.className = `dificuldade-chip dificuldade-${nivel}`;

      const dot = document.createElement("div");
      dot.className = "dificuldade-dot";

      const text = document.createElement("span");
      text.textContent = `${formatInstrumentName(inst)} · ${nivelLabel(
        nivel
      )}`;

      chip.append(dot, text);
      difList.appendChild(chip);
    }
  );

  if (!difList.childElementCount) {
    const vazio = document.createElement("span");
    vazio.style.fontSize = "0.75rem";
    vazio.style.color = "#9ca3af";
    vazio.textContent = "Sem dados de dificuldade para este repertório.";
    difList.appendChild(vazio);
  }

  difSec.append(difTitle, difList);

  // Categorias dominantes (chips)
  const catSec = document.createElement("div");
  const catTitle = document.createElement("div");
  catTitle.className = "escala-resumo-section-title";
  catTitle.textContent = "Categorias dominantes do dia (≥ 60%)";

  const catList = document.createElement("div");
  catList.className = "escala-resumo-cat-list";

  if (stats.categoriasDominantes.length) {
    stats.categoriasDominantes.forEach((cat) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = cat;
      catList.appendChild(tag);
    });
  } else {
    const vazio = document.createElement("span");
    vazio.style.fontSize = "0.75rem";
    vazio.style.color = "#9ca3af";
    vazio.textContent = "Nenhuma categoria atingiu 60% das músicas.";
    catList.appendChild(vazio);
  }

  catSec.append(catTitle, catList);

  extra.append(difSec, catSec);
  container.appendChild(extra);
}

function extrairFuncaoPrincipal(membro) {
  if (!membro) return "";
  if (membro.funcao) return membro.funcao;
  if (Array.isArray(membro.function) && membro.function.length) {
    const obj = membro.function[0];
    const inst = Object.keys(obj)[0];
    return inst;
  }
  return "";
}

function renderEscalaAtualIntegrantes(escala) {
  const container = document.getElementById("escalaAtualIntegrantes");
  if (!container) return;
  container.innerHTML = "";

  const ids = escala.integrantes || [];
  if (!ids.length) {
    const p = document.createElement("div");
    p.className = "placeholder-text";
    p.textContent = "Nenhum integrante definido para esta escala.";
    container.appendChild(p);
    return;
  }

  ids.forEach((id) => {
    let membro = null;

    if (typeof id === "object") {
      membro = id;
    } else {
      membro = integrantes.find((i) => i.id === id) || null;
    }

    if (!membro) return;

    const card = document.createElement("div");
    card.className = "member-card";

    const avatarWrapper = document.createElement("div");
    avatarWrapper.className = "member-avatar-wrapper";

    const img = document.createElement("img");
    img.className = "member-avatar";
    const slug = slugify(membro.nome || "");
    img.src = `integrantes/${slug}.jpg`;
    img.onerror = function () {
      this.onerror = null;
      this.src = "integrantes/default.jpg";
    };

    avatarWrapper.appendChild(img);

    const info = document.createElement("div");

    const nome = document.createElement("div");
    nome.className = "member-name";
    nome.textContent = membro.nome || "Integrante";

    const papel = document.createElement("div");
    papel.className = "member-role";
    const funcaoReal = extrairFuncaoPrincipal(membro) || "Função não definida";
    papel.textContent = funcaoReal;

    const expertiseDiv = document.createElement("div");
    expertiseDiv.className = "member-expertise";

    if (Array.isArray(membro.function)) {
      membro.function.forEach((obj) => {
        const inst = Object.keys(obj)[0];
        const nivel = obj[inst];

        const line = document.createElement("div");
        line.className = "member-expertise-line";

        const dot = document.createElement("div");
        dot.className = "expertise-dot";
        if (nivel === "easy") dot.classList.add("expertise-easy");
        else if (nivel === "medium") dot.classList.add("expertise-medium");
        else if (nivel === "hard") dot.classList.add("expertise-hard");

        const lbl = document.createElement("span");
        lbl.textContent = inst;

        line.append(dot, lbl);
        expertiseDiv.appendChild(line);
      });
    }

    info.append(nome, papel, expertiseDiv);
    card.append(avatarWrapper, info);
    container.appendChild(card);
  });
}

function attachYoutubeClick(card, musica) {
  if (!musica || !musica.referLink) return;
  const url = `https://www.youtube.com/watch?v=${musica.referLink}`;
  card.addEventListener("click", () => {
    window.open(url, "_blank");
  });
}

function renderEscalaAtualMusicas(escala) {
  const container = document.getElementById("escalaAtualMusicas");
  if (!container) return;
  container.innerHTML = "";

  const lista = escala.musicas || [];
  if (!lista.length) {
    const p = document.createElement("div");
    p.className = "placeholder-text";
    p.textContent = "Nenhuma música definida para esta escala.";
    container.appendChild(p);
    return;
  }

  lista.forEach((id) => {
    const musica = musicas.find((m) => m.id === id);
    if (!musica) return;

    const card = document.createElement("div");
    card.className = "song-card";

    const thumbWrapper = document.createElement("div");
    thumbWrapper.className = "song-thumb-wrapper";

    const img = document.createElement("img");
    img.className = "song-thumb";
    img.src = musica._thumbUrl || "artistas/default.jpg";
    img.onerror = function () {
      this.onerror = null;
      this.src = "artistas/default.jpg";
    };
    thumbWrapper.appendChild(img);

    const main = document.createElement("div");
    main.className = "song-main";

    const titulo = document.createElement("p");
    titulo.className = "song-title";
    titulo.textContent = musica.titulo || musica.nome || "Música";

    const artistRow = document.createElement("div");
    artistRow.className = "artist-row";

    const artistAvatar = document.createElement("img");
    artistAvatar.className = "artist-avatar";
    artistAvatar.src = musica._artistImage || "";
    artistAvatar.onerror = function () {
      this.onerror = null;
      this.src = "artistas/default.jpg";
    };

    const artistName = document.createElement("span");
    artistName.className = "artist-name";
    artistName.textContent = musica.artista || "Artista";

    artistRow.append(artistAvatar, artistName);

    const tags = document.createElement("div");
    tags.className = "song-tags";

    // categorias
    (musica.categorias || []).forEach((c) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = c;
      tags.appendChild(tag);
    });

    // dificuldades (como badges em linha)
    const diffBadges = criarBadgesDificuldadesMusica(musica);
    diffBadges.forEach((badge) => tags.appendChild(badge));

    main.append(titulo, artistRow, tags);

    card.append(thumbWrapper, main);

    attachYoutubeClick(card, musica);

    container.appendChild(card);
  });
}

// =========================================================
// ESCALAS FUTURAS
// =========================================================

function carregarEscalasFuturas() {
  if (!historico.length) return;

  const hoje = new Date();
  const futuras = historico
    .map((d) => ({ ...d, dataObj: parseDate(d.data) }))
    .filter((d) => d.dataObj && d.dataObj > hoje)
    .sort((a, b) => a.dataObj - b.dataObj);

  renderEscalasFuturas(futuras);
}

function renderEscalasFuturas(lista) {
  const container = document.getElementById("escalasFuturasContainer");
  if (!container) return;
  container.innerHTML = "";

  if (!lista.length) {
    container.innerHTML =
      '<div class="placeholder-text">Nenhuma escala futura encontrada.</div>';
    return;
  }

  lista.forEach((escala) => {
    const card = document.createElement("div");
    card.className = "escala-card";

    const head = document.createElement("div");
    head.className = "escala-header";

    const title = document.createElement("div");
    title.className = "escala-title";
    title.textContent = "Escala do dia";

    const dateSub = document.createElement("div");
    dateSub.className = "escala-date-sub";
    dateSub.textContent = formatarData(escala.dataObj);

    head.append(title, dateSub);

    // Integrantes
    const intContainer = document.createElement("div");
    intContainer.className = "escala-integrantes";

    const ids = Array.isArray(escala.integrantes) ? escala.integrantes : [];
    ids.forEach((id) => {
      const membro =
        (typeof id === "object" ? id : integrantes.find((i) => i.id === id)) ||
        null;
      if (!membro) return;

      const chip = document.createElement("div");
      chip.className = "escala-integrante-chip";

      const avatar = document.createElement("img");
      avatar.className = "escala-integrante-avatar";
      const slug = slugify(membro.nome || "");
      avatar.src = `integrantes/${slug}.jpg`;
      avatar.onerror = function () {
        this.onerror = null;
        this.src = "integrantes/default.jpg";
      };

      const nome = document.createElement("span");
      nome.className = "escala-integrante-nome";
      nome.textContent = membro.nome || "Integrante";

      chip.append(avatar, nome);
      intContainer.appendChild(chip);
    });

    // Dificuldade média do repertório
    const stats = calcularEstatisticasRepertorio(escala);
    const difSec = document.createElement("div");
    difSec.className = "escala-dificuldades";

    const difTitle = document.createElement("div");
    difTitle.className = "escala-dificuldades-title";
    difTitle.textContent = "Dificuldade média do repertório";

    const difList = document.createElement("div");
    difList.className = "escala-dificuldades-list";

    Object.entries(stats.dificuldadesPorInstrumento).forEach(
      ([inst, nivel]) => {
        const chip = document.createElement("div");
        chip.className = `dificuldade-chip dificuldade-${nivel}`;

        const dot = document.createElement("div");
        dot.className = "dificuldade-dot";

        const text = document.createElement("span");
        text.textContent = `${formatInstrumentName(inst)} · ${nivelLabel(
          nivel
        )}`;

        chip.append(dot, text);
        difList.appendChild(chip);
      }
    );

    if (!difList.childElementCount) {
      const vazio = document.createElement("span");
      vazio.style.fontSize = "0.75rem";
      vazio.style.color = "#9ca3af";
      vazio.textContent = "Sem dados de dificuldade para este repertório.";
      difList.appendChild(vazio);
    }

    difSec.append(difTitle, difList);

    // Músicas (usando o mesmo card visual)
    const musicSec = document.createElement("div");
    musicSec.className = "escala-musicas";

    const musicHeader = document.createElement("div");
    musicHeader.className = "escala-musicas-header";
    musicHeader.textContent = "Repertório";

    const list = document.createElement("div");
    list.className = "escala-musicas-list";

    const musicIds = Array.isArray(escala.musicas) ? escala.musicas : [];
    musicIds.forEach((id) => {
      const musica = musicas.find((m) => m.id === id);
      if (!musica) return;

      const songCard = document.createElement("div");
      songCard.className = "song-card";

      const thumbWrapper = document.createElement("div");
      thumbWrapper.className = "song-thumb-wrapper";

      const thumb = document.createElement("img");
      thumb.className = "song-thumb";
      thumb.src = musica._thumbUrl || "artistas/default.jpg";
      thumb.onerror = function () {
        this.onerror = null;
        this.src = "artistas/default.jpg";
      };

      thumbWrapper.appendChild(thumb);

      const main = document.createElement("div");
      main.className = "song-main";

      const titulo = document.createElement("p");
      titulo.className = "song-title";
      titulo.textContent = musica.titulo || musica.nome || "Música";

      const artistRow = document.createElement("div");
      artistRow.className = "artist-row";

      const artistAvatar = document.createElement("img");
      artistAvatar.className = "artist-avatar";
      artistAvatar.src = musica._artistImage || "";
      artistAvatar.onerror = function () {
        this.onerror = null;
        this.src = "artistas/default.jpg";
      };

      const artistName = document.createElement("span");
      artistName.className = "artist-name";
      artistName.textContent = musica.artista || "Artista";

      artistRow.append(artistAvatar, artistName);

      const tags = document.createElement("div");
      tags.className = "song-tags";

      // categorias
      (musica.categorias || []).forEach((c) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = c;
        tags.appendChild(tag);
      });

      // dificuldades badges
      const diffBadges = criarBadgesDificuldadesMusica(musica);
      diffBadges.forEach((badge) => tags.appendChild(badge));

      main.append(titulo, artistRow, tags);

      songCard.append(thumbWrapper, main);

      attachYoutubeClick(songCard, musica);

      list.appendChild(songCard);
    });

    musicSec.append(musicHeader, list);

    const actions = document.createElement("div");
    actions.className = "escala-actions";

    const btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.type = "button";
    btn.textContent = "Copiar escala";

    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      copiarEscala(escala);
    });

    actions.appendChild(btn);

    card.append(head, intContainer, difSec, musicSec, actions);
    container.appendChild(card);
  });
}

// =========================================================
// COPIAR ESCALA
// =========================================================

function copiarEscala(escala) {
  const dataObj = escala.dataObj || parseDate(escala.data);
  let texto = `Escala do dia ${formatarData(dataObj)}\n\n`;

  texto += "Integrantes:\n";
  const ids = Array.isArray(escala.integrantes) ? escala.integrantes : [];
  if (!ids.length) {
    texto += "- (nenhum integrante definido)\n";
  } else {
    ids.forEach((id) => {
      const membro =
        (typeof id === "object" ? id : integrantes.find((i) => i.id === id)) ||
        null;
      if (!membro) return;

      const funcao =
        membro.funcao || extrairFuncaoPrincipal(membro) || "função não definida";
      texto += `- ${membro.nome} (${funcao})\n`;
    });
  }

  texto += "\nMúsicas:\n";
  const musicIds = Array.isArray(escala.musicas) ? escala.musicas : [];
  if (!musicIds.length) {
    texto += "- (nenhuma música definida)\n";
  } else {
    musicIds.forEach((id) => {
      const musica = musicas.find((m) => m.id === id);
      if (musica) {
        texto += `- ${musica.titulo || musica.nome} (${
          musica.artista || "Artista"
        })\n`;
      }
    });
  }

  navigator.clipboard
    .writeText(texto)
    .then(() => {
      alert("Escala copiada para a área de transferência!");
    })
    .catch((e) => console.error("Erro ao copiar escala:", e));
}

// =========================================================
// REPERTÓRIO COMPLETO
// =========================================================

function renderRepertorio() {
  const container = document.getElementById("repertorioGrid");
  if (!container) return;
  container.innerHTML = "";

  const hoje = new Date();

  const ultimaExecucaoPorMusica = {};
  const proximaExecucaoPorMusica = {};
  const execucoesCount = {};

  historico.forEach((culto) => {
    const d = parseDate(culto.data);
    if (!d) return;
    (culto.musicas || []).forEach((id) => {
      execucoesCount[id] = (execucoesCount[id] || 0) + 1;

      if (!ultimaExecucaoPorMusica[id] || ultimaExecucaoPorMusica[id] < d) {
        if (d <= hoje) {
          ultimaExecucaoPorMusica[id] = d;
        }
      }
      if (d > hoje) {
        if (!proximaExecucaoPorMusica[id] || proximaExecucaoPorMusica[id] > d) {
          proximaExecucaoPorMusica[id] = d;
        }
      }
    });
  });

  const blocks = {
    available: [],
    recent: [],
    future: [],
    banned: [],
  };

  musicas.forEach((m) => {
    const id = m.id;
    const banido = m.banned === true || m.ban === true || m.active === false;
    const ultima = ultimaExecucaoPorMusica[id] || null;
    const proxima = proximaExecucaoPorMusica[id] || null;

    let status = "available";

    if (banido) {
      status = "banned";
    } else if (proxima) {
      status = "future";
    } else if (ultima) {
      const diffDias = Math.floor((hoje - ultima) / (1000 * 60 * 60 * 24));
      if (diffDias <= TOCADA_NOS_ULTIMOS_X_DIAS) {
        status = "recent";
      } else {
        status = "available";
      }
    } else {
      status = "available";
    }

    blocks[status].push(m);
  });

  // Legenda
  const disp = document.getElementById("legendDisponivelCount");
  const rec = document.getElementById("legendRecenteCount");
  const fut = document.getElementById("legendFuturaCount");
  const ban = document.getElementById("legendBanidaCount");

  if (disp) disp.textContent = blocks.available.length;
  if (rec) rec.textContent = blocks.recent.length;
  if (fut) fut.textContent = blocks.future.length;
  if (ban) ban.textContent = blocks.banned.length;

  function getExecCount(id) {
    return execucoesCount[id] || 0;
  }

  const ordenaAvailable = blocks.available.slice().sort((a, b) => {
    return getExecCount(a.id) - getExecCount(b.id);
  });

  const ordenaRecent = blocks.recent.slice().sort((a, b) => {
    const la = ultimaExecucaoPorMusica[a.id] || new Date(0);
    const lb = ultimaExecucaoPorMusica[b.id] || new Date(0);
    return la - lb;
  });

  const ordenaFuture = blocks.future.slice().sort((a, b) => {
    const da = proximaExecucaoPorMusica[a.id] || new Date(8640000000000000);
    const db = proximaExecucaoPorMusica[b.id] || new Date(8640000000000000);
    return da - db;
  });

  const ordenaBanned = blocks.banned.slice().sort((a, b) => {
    return getExecCount(b.id) - getExecCount(a.id);
  });

  // Ordem: Disponíveis, Recentes, Futuras, Banidas
  const finalList = [
    { status: "available", arr: ordenaAvailable },
    { status: "recent", arr: ordenaRecent },
    { status: "future", arr: ordenaFuture },
    { status: "banned", arr: ordenaBanned },
  ];

  finalList.forEach(({ status, arr }) => {
    let lista = arr.slice();

    if (activeCategories.length) {
      lista = lista.filter((m) => musicaMatchScoreCategorias(m) > 0);
    }

    if (activeCategories.length) {
      lista.sort((a, b) => {
        const sa = musicaMatchScoreCategorias(a);
        const sb = musicaMatchScoreCategorias(b);
        if (sa !== sb) return sb - sa;
        return 0;
      });
    }

    lista.forEach((musica) => {
      const card = criarCardMusicaRepertorio(
        musica,
        status,
        musicaMatchScoreCategorias(musica)
      );
      container.appendChild(card);
    });
  });
}

// =========================================================
// CARDS DO REPERTÓRIO
// =========================================================

function criarCardMusicaRepertorio(musica, status, matchScore) {
  const card = document.createElement("div");
  card.className = "song-card";

  if (status === "available") card.classList.add("available");
  if (status === "recent") card.classList.add("recent");
  if (status === "future") card.classList.add("future");
  if (status === "banned") card.classList.add("banned");

  if (status !== "available") {
    card.classList.add("song-unavailable");
  }

  if (matchScore && matchScore > 0) {
    card.classList.add("category-match");
  }

  const wrapper = document.createElement("div");
  wrapper.className = "song-thumb-wrapper";

  const img = document.createElement("img");
  img.className = "song-thumb";
  img.src = musica._thumbUrl || "artistas/default.jpg";
  img.onerror = function () {
    this.onerror = null;
    this.src = "artistas/default.jpg";
  };
  wrapper.appendChild(img);

  // Info de liberação (recentes e futuras)
  if (status === "future" || status === "recent") {
    const libera = document.createElement("div");
    libera.className = "song-release-info";
    const dias = calcularDiasParaLiberar(musica.id);
    libera.textContent = `🔓 em ${dias} dias`;
    wrapper.appendChild(libera);
  }

  const main = document.createElement("div");
  main.className = "song-main";

  const title = document.createElement("p");
  title.className = "song-title";
  title.textContent = musica.titulo || musica.nome || "Música";

  const artistRow = document.createElement("div");
  artistRow.className = "artist-row";

  const artistAvatar = document.createElement("img");
  artistAvatar.className = "artist-avatar";
  artistAvatar.src = musica._artistImage || "";
  artistAvatar.onerror = function () {
    this.onerror = null;
    this.src = "artistas/default.jpg";
  };

  const artistName = document.createElement("span");
  artistName.className = "artist-name";
  artistName.textContent = musica.artista || "Artista";

  artistRow.append(artistAvatar, artistName);

  const tags = document.createElement("div");
  tags.className = "song-tags";

  // categorias
  (musica.categorias || []).forEach((c) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = c;
    tags.appendChild(tag);
  });

  // dificuldades badges
  const diffBadges = criarBadgesDificuldadesMusica(musica);
  diffBadges.forEach((badge) => tags.appendChild(badge));

  main.append(title, artistRow, tags);
  card.append(wrapper, main);

  // ribbon por status
  const ribbon = document.createElement("div");
  ribbon.className = "song-ribbon";
  if (status === "available") {
    ribbon.classList.add("song-ribbon-available");
    ribbon.textContent = "Disponível";
  }
  if (status === "recent") {
    ribbon.classList.add("song-ribbon-recent");
    ribbon.textContent = "Tocada recente";
  }
  if (status === "future") {
    ribbon.classList.add("song-ribbon-future");
    ribbon.textContent = "Tocada futura";
  }
  if (status === "banned") {
    ribbon.classList.add("song-ribbon-banned");
    ribbon.textContent = "Banida";
  }

  if (matchScore && matchScore > 0) {
    ribbon.classList.add("song-ribbon-filtered");
  }

  card.appendChild(ribbon);

  attachYoutubeClick(card, musica);

  return card;
}

// =========================================================
// CÁLCULOS AUXILIARES DE LIBERAÇÃO
// =========================================================

function getUltimaDataTocada(idMusica) {
  const hoje = new Date();
  let ultima = null;
  historico.forEach((culto) => {
    const d = parseDate(culto.data);
    if (!d || d > hoje) return;
    if (Array.isArray(culto.musicas) && culto.musicas.includes(idMusica)) {
      if (!ultima || d > ultima) {
        ultima = d;
      }
    }
  });
  return ultima;
}

function getProximaDataEscalada(idMusica) {
  const hoje = new Date();
  let menor = null;
  historico.forEach((culto) => {
    const d = parseDate(culto.data);
    if (!d || d <= hoje) return;
    if (Array.isArray(culto.musicas) && culto.musicas.includes(idMusica)) {
      if (!menor || d < menor) {
        menor = d;
      }
    }
  });
  return menor;
}

function calcularDiasParaLiberar(idMusica) {
  const futuraData = getProximaDataEscalada(idMusica);
  const ultima = getUltimaDataTocada(idMusica);

  let referencia = null;

  if (futuraData) {
    referencia = new Date(futuraData.getTime());
    referencia.setDate(
      referencia.getDate() + TOCADA_NOS_ULTIMOS_X_DIAS
    );
  } else if (ultima) {
    const limite = new Date(ultima.getTime());
    limite.setDate(limite.getDate() + TOCADA_NOS_ULTIMOS_X_DIAS);
    referencia = limite;
  } else {
    return 0;
  }

  const hoje = new Date();
  const diff = Math.ceil((referencia - hoje) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}
