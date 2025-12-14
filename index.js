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
// FUNÇÕES UTILITÁRIAS GERAIS
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
// TABS DE NAVEGAÇÃO
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

    // Categorias: string => array
    if (typeof clone.categorias === "string") {
      clone.categorias = clone.categorias
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean);
    }
    if (!Array.isArray(clone.categorias)) {
      clone.categorias = [];
    }

    // Ban / banned
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

    // Thumbnail da música (YouTube)
    if (clone.referLink) {
      clone._thumbUrl = `https://img.youtube.com/vi/${clone.referLink}/0.jpg`;
    } else {
      clone._thumbUrl = "";
    }

    return clone;
  });
}

// =========================================================
// CATEGORIAS DO REPERTÓRIO
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
        if (activeCategories.length >= 2) return; // máximo 2 filtros
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
// (categoria dominante removida do layout, mas ainda útil)
// =========================================================

function calcularEstatisticasRepertorio(escala) {
  const ids = Array.isArray(escala.musicas) ? escala.musicas : [];
  const totalMusicas = ids.length;

  const instrumentosMap = {};

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

  let dificuldadeMediaNivel = null;
  if (totalNivelCount > 0) {
    dificuldadeMediaNivel = valorToNivel(totalNivelSoma / totalNivelCount);
  }

  return {
    dificuldadesPorInstrumento: dificuldades,
    dificuldadeMediaNivel,
  };
}

// =========================================================
// BADGES DE DIFICULDADE (NOVO PADRÃO GLOBAL)
// apenas ícone + nome do instrumento
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
// ESCALA ATUAL — CARREGAMENTO
// =========================================================

function carregarEscalaAtual() {
  if (!historico.length) return;

  const hoje = new Date();
  const futuras = historico
    .map((d) => ({ ...d, dataObj: parseDate(d.data) }))
    .filter((d) => d.dataObj && d.dataObj >= hoje)
    .sort((a, b) => a.dataObj - b.dataObj);

  const dataEl = document.getElementById("escalaAtualData");
  const badgesHeader = document.getElementById("escalaAtualBadges");

  if (!futuras.length) {
    if (dataEl) {
      dataEl.textContent = "Nenhum culto futuro encontrado.";
    }
    if (badgesHeader) {
      badgesHeader.innerHTML = "";
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

  renderEscalaAtualHeaderBadges(escalaAtual);
  renderEscalaAtualResumo(escalaAtual);
  renderEscalaAtualIntegrantes(escalaAtual);
  renderEscalaAtualMusicas(escalaAtual);
}

// =========================================================
// PRÓXIMO CULTO — BADGES DO HEADER (categoria + dificuldade geral)
// =========================================================

function renderEscalaAtualHeaderBadges(escala) {
  const container = document.getElementById("escalaAtualBadges");
  if (!container) return;

  container.innerHTML = "";

  const stats = calcularEstatisticasRepertorio(escala);

  // Categoria dominante removida do cálculo (alternativa: usar primeira música)
  const categoria = obterCategoriaPrincipal(escala);

  if (categoria) {
    const catTag = document.createElement("span");
    catTag.className = "tag";
    catTag.textContent = categoria;
    container.appendChild(catTag);
  }

  // Dificuldade geral = badge com cor EXCLUSIVA (sem texto)
  if (stats.dificuldadeMediaNivel) {
const diffTag = document.createElement("span");
diffTag.className = "escala-dificuldade-geral";

const dot = document.createElement("span");
dot.className = "dot";

if (stats.dificuldadeMediaNivel === "easy")
  dot.classList.add("dot-easy");
else if (stats.dificuldadeMediaNivel === "medium")
  dot.classList.add("dot-medium");
else if (stats.dificuldadeMediaNivel === "hard")
  dot.classList.add("dot-hard");

const lbl = document.createElement("span");
lbl.textContent = nivelLabel(stats.dificuldadeMediaNivel);

diffTag.append(dot, lbl);
container.appendChild(diffTag);

  }
}

// Usa a primeira música da escala para determinar a "categoria principal"
function obterCategoriaPrincipal(escala) {
  if (!escala.musicas || !escala.musicas.length) return null;
  const musica = musicas.find((m) => m.id === escala.musicas[0]);
  if (!musica) return null;
  return musica.categorias ? musica.categorias[0] : null;
}

// =========================================================
// RESUMO DO PRÓXIMO CULTO
// =========================================================

function renderEscalaAtualResumo(escala) {
  const container = document.getElementById("escalaAtualResumo");
  if (!container) return;
  container.innerHTML = "";

  const stats = calcularEstatisticasRepertorio(escala);

  // ======== DIFICULDADE POR INSTRUMENTO ========
  const extra = document.createElement("div");
  extra.className = "escala-resumo-extra";

  const difSec = document.createElement("div");
  const difTitle = document.createElement("div");
  difTitle.className = "escala-resumo-section-title";
  difTitle.textContent = "Dificuldade média por instrumento";

  const difList = document.createElement("div");
  difList.className = "escala-resumo-dif-list";

  Object.entries(stats.dificuldadesPorInstrumento).forEach(([inst, nivel]) => {
    const chip = document.createElement("div");
    chip.className = `dificuldade-chip dificuldade-${nivel}`;

    const dot = document.createElement("div");
    dot.className = "dificuldade-dot";

    const text = document.createElement("span");
    text.textContent = formatInstrumentName(inst);

    chip.append(dot, text);
    difList.appendChild(chip);
  });

  if (!difList.childElementCount) {
    const vazio = document.createElement("span");
    vazio.style.fontSize = "0.75rem";
    vazio.style.color = "#9ca3af";
    vazio.textContent = "Sem dados suficientes.";
    difList.appendChild(vazio);
  }

  difSec.append(difTitle, difList);
  extra.appendChild(difSec);
  container.appendChild(extra);
}

// =========================================================
// INTEGRANTES — ESCALA ATUAL
// =========================================================

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

    const img = document.createElement("img");
    img.className = "member-avatar";
    const slug = slugify(membro.nome || "");
    img.src = `integrantes/${slug}.jpeg`;
    img.onerror = function () {
      this.onerror = null;
      this.src = "integrantes/default.jpeg";
    };

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
        lbl.textContent = formatInstrumentName(inst);

        line.append(dot, lbl);
        expertiseDiv.appendChild(line);
      });
    }

    info.append(nome, papel, expertiseDiv);
    card.append(img, info);
    container.appendChild(card);
  });
}

// =========================================================
// CLICK PARA ABRIR YOUTUBE EM NOVA ABA
// =========================================================

function attachYoutubeClick(card, musica) {
  if (!musica || !musica.referLink) return;
  const url = `https://www.youtube.com/watch?v=${musica.referLink}`;

  card.addEventListener("click", () => {
    window.open(url, "_blank");
  });
}

// =========================================================
// ESCALA ATUAL — LISTA DE MÚSICAS
// =========================================================

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

    // Thumbnail quadrada
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

    // Conteúdo textual
    const main = document.createElement("div");
    main.className = "song-main";

    const titulo = document.createElement("p");
    titulo.className = "song-title";
    titulo.textContent = musica.titulo || musica.nome || "Música";

    // Artista
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

    // Tags (categorias + dificuldades)
    const tags = document.createElement("div");
    tags.className = "song-tags";

    (musica.categorias || []).forEach((c) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = c;
      tags.appendChild(tag);
    });

    const diffBadges = criarBadgesDificuldadesMusica(musica);
    diffBadges.forEach((badge) => tags.appendChild(badge));

    main.append(titulo, artistRow, tags);

    card.append(thumbWrapper, main);

    attachYoutubeClick(card, musica);

    container.appendChild(card);
  });
}

// =========================================================
// ESCALAS FUTURAS — CARREGAMENTO
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

// =========================================================
// ESCALAS FUTURAS — RENDERIZAÇÃO
// =========================================================

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

    // ------ HEADER (Título + Data + Badge de Dificuldade Geral) ------
    const header = document.createElement("div");
    header.className = "escala-header";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.flexDirection = "column";
    left.style.gap = "4px";

    const title = document.createElement("div");
    title.className = "escala-title";
    title.textContent = "Escala do dia";

    const dateSub = document.createElement("div");
    dateSub.className = "escala-date-sub";
    dateSub.textContent = formatarData(escala.dataObj);

    left.append(title, dateSub);

    // Badge de dificuldade geral
    const stats = calcularEstatisticasRepertorio(escala);
    const badgeContainer = document.createElement("div");

    if (stats.dificuldadeMediaNivel) {
      const badge = document.createElement("span");
      badge.className = "escala-dificuldade-geral";

      const dot = document.createElement("span");
      dot.className = "dot";

      if (stats.dificuldadeMediaNivel === "easy") dot.classList.add("dot-easy");
      else if (stats.dificuldadeMediaNivel === "medium")
        dot.classList.add("dot-medium");
      else if (stats.dificuldadeMediaNivel === "hard")
        dot.classList.add("dot-hard");

      const lbl = document.createElement("span");
      lbl.textContent = nivelLabel(stats.dificuldadeMediaNivel);
      badge.append(dot, lbl);

      badgeContainer.appendChild(badge);
    }

    header.append(left, badgeContainer);
    card.appendChild(header);

    // ------ INTEGRANTES ------
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
      avatar.src = `integrantes/${slug}.jpeg`;
      avatar.onerror = function () {
        this.onerror = null;
        this.src = "integrantes/default.jpeg";
      };

      const nome = document.createElement("span");
      nome.className = "escala-integrante-nome";
      nome.textContent = membro.nome || "Integrante";

      chip.append(avatar, nome);
      intContainer.appendChild(chip);
    });

    card.appendChild(intContainer);

    // ------ DIFICULDADES POR INSTRUMENTO ------
    const difSec = document.createElement("div");
    difSec.className = "escala-dificuldades";

    const difTitle = document.createElement("div");
    difTitle.className = "escala-dificuldades-title";
    difTitle.textContent = "Dificuldade média por instrumento";

    const difList = document.createElement("div");
    difList.className = "escala-dificuldades-list";

    Object.entries(stats.dificuldadesPorInstrumento).forEach(
      ([inst, nivel]) => {
        const chip = document.createElement("div");
        chip.className = `dificuldade-chip dificuldade-${nivel}`;

        const dot = document.createElement("div");
        dot.className = "dificuldade-dot";

        const text = document.createElement("span");
        text.textContent = formatInstrumentName(inst);

        chip.append(dot, text);
        difList.appendChild(chip);
      }
    );

    if (!difList.childElementCount) {
      const vazio = document.createElement("span");
      vazio.style.fontSize = "0.75rem";
      vazio.style.color = "#9ca3af";
      vazio.textContent = "Sem dados suficientes.";
      difList.appendChild(vazio);
    }

    difSec.append(difTitle, difList);
    card.appendChild(difSec);

    // ------ MÚSICAS (3 por linha, estilo unificado dos cards) ------
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
      artistAvatar.src = musica._artistImage;
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

      (musica.categorias || []).forEach((c) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = c;
        tags.appendChild(tag);
      });

      const diffBadges = criarBadgesDificuldadesMusica(musica);
      diffBadges.forEach((badge) => tags.appendChild(badge));

      main.append(titulo, artistRow, tags);
      songCard.append(thumbWrapper, main);

      attachYoutubeClick(songCard, musica);

      list.appendChild(songCard);
    });

    musicSec.append(musicHeader, list);
    card.appendChild(musicSec);

    // ------ AÇÕES ------
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
    card.appendChild(actions);

    container.appendChild(card);
  });
}

// =========================================================
// FUNÇÃO PARA COPIAR ESCALA FUTURA (texto formatado)
// =========================================================

function copiarEscala(escala) {
  let texto = `📅 ${formatarData(escala.dataObj)}\n\n🎤 *Integrantes*\n`;

  const ids = Array.isArray(escala.integrantes) ? escala.integrantes : [];
  ids.forEach((id) => {
    const membro =
      (typeof id === "object" ? id : integrantes.find((i) => i.id === id)) ||
      null;
    if (!membro) return;

    const funcao = extrairFuncaoPrincipal(membro);
    texto += `• ${membro.nome} – ${funcao}\n`;
  });

  texto += `\n🎵 *Repertório*\n`;

  const musicIds = Array.isArray(escala.musicas) ? escala.musicas : [];
  musicIds.forEach((id) => {
    const musica = musicas.find((m) => m.id === id);
    if (!musica) return;

    texto += `• ${musica.titulo || musica.nome} – ${musica.artista}\n`;
  });

  navigator.clipboard.writeText(texto).then(() => {
    alert("Escala copiada para a área de transferência!");
  });
}

// =========================================================
// REPERTÓRIO — RENDERIZAÇÃO COMPLETA
// =========================================================

function renderRepertorio() {
  const grid = document.getElementById("repertorioGrid");
  if (!grid) return;

  const hoje = new Date();
  const historicoPassado = historico
    .map((d) => ({ ...d, dataObj: parseDate(d.data) }))
    .filter((d) => d.dataObj && d.dataObj < hoje)
    .sort((a, b) => b.dataObj - a.dataObj);

  const recentesDatas = historicoPassado.slice(0, 8); // últimas 8 escalas

  const usadasRecentemente = new Set();
  const usadasFuturo = new Set();

  historicoPassado.forEach((escala) => {
    (escala.musicas || []).forEach((id) => usadasRecentemente.add(id));
  });

  historico
    .map((d) => ({ ...d, dataObj: parseDate(d.data) }))
    .filter((d) => d.dataObj && d.dataObj > hoje)
    .forEach((escala) => {
      (escala.musicas || []).forEach((id) => usadasFuturo.add(id));
    });

  const arr = [];

  musicas.forEach((m) => {
    const clone = { ...m };
    clone.scoreCat = musicaMatchScoreCategorias(m);

    const id = m.id;

    if (m.banned) clone._status = "banned";
    else if (usadasFuturo.has(id)) clone._status = "future";
    else if (usadasRecentemente.has(id)) clone._status = "recent";
    else clone._status = "available";

    arr.push(clone);
  });

  arr.sort((a, b) => {
    const prioA = ["available", "recent", "future", "banned"].indexOf(
      a._status
    );
    const prioB = ["available", "recent", "future", "banned"].indexOf(
      b._status
    );
    return prioA - prioB;
  });

  const legendMap = {
    available: "legendDisponivelCount",
    recent: "legendRecenteCount",
    future: "legendFuturaCount",
    banned: "legendBanidaCount",
  };

  Object.values(legendMap).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "0";
  });

  const counts = { available: 0, recent: 0, future: 0, banned: 0 };

  grid.innerHTML = "";

  arr.forEach((musica) => {
    counts[musica._status]++;

    if (legendMap[musica._status]) {
      const el = document.getElementById(legendMap[musica._status]);
      if (el) el.textContent = counts[musica._status];
    }

    const card = document.createElement("div");
    card.className = `song-card ${musica._status}`;

    if (activeCategories.length > 0 && musica.scoreCat > 0) {
      card.classList.add("category-match");
    }

    if (musica._status !== "available") {
      card.classList.add("song-unavailable");
    }

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
    artistAvatar.src = musica._artistImage;
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

    (musica.categorias || []).forEach((c) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = c;
      tags.appendChild(tag);
    });

    const diffBadges = criarBadgesDificuldadesMusica(musica);
    diffBadges.forEach((badge) => tags.appendChild(badge));

    main.append(titulo, artistRow, tags);
    card.append(thumbWrapper, main);

    if (musica._status !== "available") {
      const ribbon = document.createElement("div");
      ribbon.className = "song-ribbon";

      if (musica._status === "recent")
        ribbon.classList.add("song-ribbon-recent");
      if (musica._status === "future")
        ribbon.classList.add("song-ribbon-future");
      if (musica._status === "banned")
        ribbon.classList.add("song-ribbon-banned");

      ribbon.textContent =
        musica._status === "recent"
          ? "RECENTE"
          : musica._status === "future"
          ? "FUTURA"
          : "BANIDA";

      card.appendChild(ribbon);
    }

    attachYoutubeClick(card, musica);


if (musica._status === "future" || musica._status === "recent") {
  const dias = calcularDiasParaLiberar(musica);
  if (dias != null) {
    const release = document.createElement("div");
    release.className = "song-release-info";

    if (dias <= 0) {
      release.textContent = `🔓 Libera hoje`;
    } else {
      release.textContent = `🔒 Libera em ${dias} dias`;
    }

    card.appendChild(release);
  }
}

    grid.appendChild(card);
  });
}

function calcularDiasParaLiberar(musica) {
  const hoje = new Date();

  // FUTURAS → busca a escala futura onde ela será tocada
  const futuras = historico
    .map((d) => ({ ...d, dataObj: parseDate(d.data) }))
    .filter((d) => d.dataObj > hoje);

  const escalaFutura = futuras.find((e) => (e.musicas || []).includes(musica.id));

  if (escalaFutura) {
    const diffMs = escalaFutura.dataObj - hoje;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  // RECENTES → cálculo baseado no cooldown
  const passadas = historico
    .map((d) => ({ ...d, dataObj: parseDate(d.data) }))
    .filter((d) => d.dataObj < hoje)
    .reverse();

  const ultimaEscala = passadas.find((e) => (e.musicas || []).includes(musica.id));

  if (ultimaEscala) {
    const diffMs = hoje - ultimaEscala.dataObj;
    const diasDesde = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diasParaLiberar = TOCADA_NOS_ULTIMOS_X_DIAS - diasDesde;
    return diasParaLiberar;
  }

  return null;
}



// =========================================================
// FILTRAGEM DE CATEGORIAS PARA O REPERTÓRIO
// (já integrada ao renderRepertorio)
// =========================================================

// Nada adicional aqui — a lógica está toda no renderRepertorio()

// =========================================================
// FIM DO ARQUIVO
// =========================================================

console.log("Projeto Asafe carregado com sucesso!");
