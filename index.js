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

  // conta quantas músicas DISPONÍVEIS existem por categoria
  const counts = new Map();

  musicas.forEach((m) => {
    const status = getStatusMusicaRepertorio(m.id);
    if (status !== "available") return;

    const cats = Array.isArray(m.categorias)
      ? m.categorias
      : typeof m.categorias === "string"
      ? m.categorias.split(";").map((s) => s.trim()).filter(Boolean)
      : [];

    cats.forEach((c) => counts.set(c, (counts.get(c) || 0) + 1));
  });

  // lista final de categorias (só as que têm pelo menos 1 disponível)
  const lista = Array.from(counts.entries())
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); // maior -> menor

  lista.forEach(([cat, qtd]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "category-button";
    btn.textContent = `${cat} (${qtd})`;

    if (activeCategories.includes(cat)) {
      btn.classList.add("active");
    }

    btn.addEventListener("click", () => {
      const isActive = activeCategories.includes(cat);

      if (isActive) {
        activeCategories = activeCategories.filter((c) => c !== cat);
        btn.classList.remove("active");
      } else {
        if (activeCategories.length >= 2) return;
        activeCategories.push(cat);
        btn.classList.add("active");
      }

      renderCategoriasFiltros(); // re-render pra manter marcação certinha
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
// CATEGORIA DOMINANTE DE UMA ESCALA
// =========================================================
function calcularCategoriaDominante(escala) {
  const ids = Array.isArray(escala.musicas) ? escala.musicas : [];
  if (!ids.length) return null;

  const contagem = new Map();
  let totalComCategoria = 0;

  ids.forEach((id) => {
    const musica = musicas.find((m) => m.id === id);
    if (
      !musica ||
      !Array.isArray(musica.categorias) ||
      !musica.categorias.length
    )
      return;

    totalComCategoria++;
    const unicas = [...new Set(musica.categorias)];
    unicas.forEach((cat) => {
      contagem.set(cat, (contagem.get(cat) || 0) + 1);
    });
  });

  if (!totalComCategoria || contagem.size === 0) return null;

  let melhorCat = null;
  let melhorCount = 0;

  contagem.forEach((count, cat) => {
    if (count > melhorCount) {
      melhorCount = count;
      melhorCat = cat;
    }
  });

  const perc = (melhorCount / totalComCategoria) * 100;
  let intensidade;

  if (perc >= 80) intensidade = "strong";
  else if (perc >= 60) intensidade = "medium";
  else intensidade = "weak";

  return {
    categoria: melhorCat,
    percentual: perc,
    intensidade,
  };
}

function calcularIntensidadeCategorias(escala) {
  const ids = escala.musicas || [];
  const total = ids.length;
  if (!total) return [];

  const freq = new Map();

  ids.forEach((id) => {
    const musica = musicas.find((m) => m.id === id);
    if (!musica) return;

    const unicas = [...new Set(musica.categorias || [])];
    unicas.forEach((cat) => {
      freq.set(cat, (freq.get(cat) || 0) + 1);
    });
  });

  return [...freq.entries()].map(([cat, count]) => {
    const p = (count / total) * 100;
    let intensidade;
    if (p >= 80) intensidade = "strong";
    else if (p >= 60) intensidade = "medium";
    else intensidade = "weak";

    return { categoria: cat, percentual: p, intensidade };
  });
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
    .filter((d) => d.dataObj >= hoje)
    .sort((a, b) => a.dataObj - b.dataObj);

  if (!futuras.length) {
    document.getElementById("escalaAtualData").textContent =
      "Nenhum culto futuro encontrado.";
    return;
  }

  const proxima = futuras[0];
  const dataFormatada = formatarData(proxima.dataObj);
  document.getElementById("escalaAtualData").textContent = dataFormatada;

  // ----------------------------------------------------------------
  // 1) Definir integrantes usados
  // ----------------------------------------------------------------
  let integrantesUsados = [];

  if (Array.isArray(proxima.integrantes) && proxima.integrantes.length > 0) {
    integrantesUsados = proxima.integrantes.slice();
  } else {
    try {
      const auto = montarEscalaAutomatica();
      integrantesUsados = Object.values(auto)
        .flat()
        .map((m) => m.id);
    } catch (e) {
      console.error("Erro ao montar escala automática:", e);
      integrantesUsados = [];
    }
  }

  // ----------------------------------------------------------------
  // 2) Escala “render”
  // ----------------------------------------------------------------
  const escalaRender = {
    ...proxima,
    integrantes: integrantesUsados,
  };

  // ----------------------------------------------------------------
  // 3) Header direito: APENAS categoria predominante + dificuldade média
  // ----------------------------------------------------------------
  renderEscalaAtualHeaderDireito(escalaRender);

  // ----------------------------------------------------------------
  // 4) Renderizações
  // ----------------------------------------------------------------
  renderEscalaAtualResumo(escalaRender);
  renderEscalaAtualIntegrantes(escalaRender);
  renderEscalaAtualMusicas(escalaRender);
}

function renderEscalaAtualHeaderDireito(escala) {
  const container = document.getElementById("escalaAtualBadges");
  if (!container) return;

  container.innerHTML = "";

  const stats = calcularStatsRepertorioDaEscala(escala);
  const catDom = calcularCategoriaDominanteDaEscala(escala);

  const wrap = document.createElement("div");
  wrap.className = "escala-badges-header";

  // ======================
  // Categoria predominante
  // ======================
  if (catDom && catDom.categoria) {
    const badgeCat = document.createElement("span");
    badgeCat.className = "escala-cat-dominante";

    const dot = document.createElement("span");
    dot.className = "cat-dot";
    dot.classList.add(
      catDom.intensidade === "strong"
        ? "cat-strong"
        : catDom.intensidade === "medium"
        ? "cat-medium"
        : "cat-weak"
    );

    const label = document.createElement("span");
    label.textContent = catDom.categoria;

    badgeCat.append(dot, label);
    wrap.appendChild(badgeCat);
  }

  // ======================
  // Dificuldade média
  // ======================
  if (stats && stats.dificuldadeGeralNivel) {
    const badgeDiff = document.createElement("span");
    badgeDiff.className = "escala-dificuldade-geral";

    const dot = document.createElement("span");
    dot.className = "dot";

    dot.classList.add(
      stats.dificuldadeGeralNivel === "easy"
        ? "dot-easy"
        : stats.dificuldadeGeralNivel === "medium"
        ? "dot-medium"
        : "dot-hard"
    );

    const label = document.createElement("span");
    label.textContent = nivelLabel(stats.dificuldadeGeralNivel);

    badgeDiff.append(dot, label);
    wrap.appendChild(badgeDiff);
  }

  container.appendChild(wrap);
}

// =========================================================
// PRÓXIMO CULTO — BADGES DO HEADER (categoria + dificuldade geral)
// =========================================================

function renderEscalaAtualHeaderBadges(escala) {
  const container = document.getElementById("escalaAtualBadges");
  if (!container) return;

  container.innerHTML = "";

  const stats = calcularEstatisticasRepertorio(escala);
  const catInfo = calcularCategoriaDominante(escala);

  const headerBox = document.createElement("div");
  headerBox.className = "escala-badges-header";

  // Categoria dominante
  if (catInfo && catInfo.categoria) {
    const catTag = document.createElement("span");
    catTag.className = "escala-cat-dominante";

    const dot = document.createElement("span");
    dot.className = "cat-dot";

    if (catInfo.intensidade === "strong") dot.classList.add("cat-strong");
    else if (catInfo.intensidade === "medium") dot.classList.add("cat-medium");
    else dot.classList.add("cat-weak");

    const label = document.createElement("span");
    label.textContent = catInfo.categoria;

    catTag.append(dot, label);
    headerBox.appendChild(catTag);
  }

  // Dificuldade geral
  if (stats.dificuldadeMediaNivel) {
    const diffTag = document.createElement("span");
    diffTag.className = "escala-dificuldade-geral";

    const dot = document.createElement("span");
    dot.className = "dot";

    if (stats.dificuldadeMediaNivel === "easy") dot.classList.add("dot-easy");
    else if (stats.dificuldadeMediaNivel === "medium")
      dot.classList.add("dot-medium");
    else if (stats.dificuldadeMediaNivel === "hard")
      dot.classList.add("dot-hard");

    const lbl = document.createElement("span");
    lbl.textContent = nivelLabel(stats.dificuldadeMediaNivel);

    diffTag.append(dot, lbl);
    headerBox.appendChild(diffTag);
  }

  // Categorias associadas (todas)
  const cats = calcularIntensidadeCategorias(escala);

  cats.forEach((c) => {
    const tag = document.createElement("span");
    tag.className = "escala-cat-dominante";

    const dot = document.createElement("span");
    dot.className = "cat-dot";
    dot.classList.add(
      c.intensidade === "strong"
        ? "cat-strong"
        : c.intensidade === "medium"
        ? "cat-medium"
        : "cat-weak"
    );

    const label = document.createElement("span");
    label.textContent = c.categoria;

    tag.append(dot, label);
    headerBox.appendChild(tag);
  });

  container.appendChild(headerBox);
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

function calcularIntensidadeCategorias(escala) {
  const ids = Array.isArray(escala.musicas) ? escala.musicas : [];
  if (!ids.length) return [];

  const contagem = new Map();
  let totalComCategoria = 0;

  ids.forEach((id) => {
    const musica = musicas.find((m) => m.id === id);
    if (!musica) return;

    const cats = Array.isArray(musica.categorias)
      ? musica.categorias
      : typeof musica.categorias === "string"
      ? musica.categorias
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    if (!cats.length) return;

    totalComCategoria++;
    [...new Set(cats)].forEach((cat) => {
      contagem.set(cat, (contagem.get(cat) || 0) + 1);
    });
  });

  const out = Array.from(contagem.entries()).map(([cat, count]) => {
    const perc = totalComCategoria ? (count / totalComCategoria) * 100 : 0;

    let intensidade;
    if (perc >= 80) intensidade = "strong";
    else if (perc >= 60) intensidade = "medium";
    else intensidade = "weak";

    return { categoria: cat, percentual: perc, intensidade };
  });

  // ✅ ORDENAR: mais predominante -> menos predominante
  out.sort((a, b) => {
    if (b.percentual !== a.percentual) return b.percentual - a.percentual;
    return a.categoria.localeCompare(b.categoria);
  });

  return out;
}

// =========================================================
// RESUMO DO PRÓXIMO CULTO
// =========================================================
function renderEscalaAtualResumo(escala) {
  const container = document.getElementById("escalaAtualResumo");
  if (!container) return;
  container.innerHTML = "";

  const stats = calcularEstatisticasRepertorio(escala);
  const cats = calcularIntensidadeCategorias(escala);

  const extra = document.createElement("div");
  extra.className = "escala-resumo-extra";

  // ======== DIFICULDADE POR INSTRUMENTO ========
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

  // ======== CATEGORIAS DO REPERTÓRIO ========
  const catSec = document.createElement("div");

  const catTitle = document.createElement("div");
  catTitle.className = "escala-resumo-section-title";
  catTitle.textContent = "Categorias do repertório";

  const catList = document.createElement("div");
  catList.className = "escala-resumo-dif-list"; // mesmo layout das dificuldades

  if (cats.length) {
    cats.forEach((c) => {
      const chip = document.createElement("div");
      chip.className = "dificuldade-chip";

      const dot = document.createElement("div");
      dot.className = "dificuldade-dot";

      if (c.intensidade === "strong") dot.classList.add("cat-strong");
      else if (c.intensidade === "medium") dot.classList.add("cat-medium");
      else dot.classList.add("cat-weak");

      const label = document.createElement("span");
      label.textContent = c.categoria;

      chip.append(dot, label);
      catList.appendChild(chip);
    });
  } else {
    const vazio = document.createElement("span");
    vazio.style.fontSize = "0.75rem";
    vazio.style.color = "#9ca3af";
    vazio.textContent = "Sem categorias cadastradas.";
    catList.appendChild(vazio);
  }

  catSec.append(catTitle, catList);
  extra.appendChild(catSec);

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

    // ------ HEADER (Título + Data + Badges: categoria predominante + dificuldade geral) ------
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

    // badges do header (somente predominante + dificuldade)
    const badgeContainer = document.createElement("div");
    badgeContainer.className = "escala-badges-header";

    const catDom = calcularCategoriaDominanteDaEscala(escala);
    if (catDom && catDom.categoria) {
      const badgeCat = document.createElement("span");
      badgeCat.className = "escala-cat-dominante";

      const dot = document.createElement("span");
      dot.className = "cat-dot";
      dot.classList.add(
        catDom.intensidade === "strong"
          ? "cat-strong"
          : catDom.intensidade === "medium"
          ? "cat-medium"
          : "cat-weak"
      );

      const label = document.createElement("span");
      label.textContent = catDom.categoria;

      badgeCat.append(dot, label);
      badgeContainer.appendChild(badgeCat);
    }

    const stats = calcularStatsRepertorioDaEscala(escala);
    if (stats && stats.dificuldadeGeralNivel) {
      const badgeDiff = document.createElement("span");
      badgeDiff.className = "escala-dificuldade-geral";

      const dot = document.createElement("span");
      dot.className = "dot";
      dot.classList.add(
        stats.dificuldadeGeralNivel === "easy"
          ? "dot-easy"
          : stats.dificuldadeGeralNivel === "medium"
          ? "dot-medium"
          : "dot-hard"
      );

      const label = document.createElement("span");
      label.textContent = nivelLabel(stats.dificuldadeGeralNivel);

      badgeDiff.append(dot, label);
      badgeContainer.appendChild(badgeDiff);
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

    card.appendChild(intContainer);

    // ------ DIFICULDADES POR INSTRUMENTO ------
    const difSec = document.createElement("div");
    difSec.className = "escala-dificuldades";

    const difTitle = document.createElement("div");
    difTitle.className = "escala-resumo-section-title";
    difTitle.textContent = "Dificuldade média por instrumento";

    const difList = document.createElement("div");
    difList.className = "escala-resumo-dif-list";

    const stats2 = calcularEstatisticasRepertorio(escala);
    Object.entries(stats2.dificuldadesPorInstrumento || {}).forEach(
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

    // ------ CATEGORIAS DO REPERTÓRIO (IGUAL PRÓXIMO CULTO, ORDENADO) ------
    const cats = calcularIntensidadeCategorias(escala); // já vem ordenado desc
    const catSec = document.createElement("div");

    const catTitle = document.createElement("div");
    catTitle.className = "escala-resumo-section-title";
    catTitle.textContent = "Categorias do repertório";

    const catList = document.createElement("div");
    catList.className = "escala-resumo-dif-list";

    if (cats.length) {
      cats.forEach((c) => {
        const chip = document.createElement("div");
        chip.className = "dificuldade-chip";

        const dot = document.createElement("div");
        dot.className = "dificuldade-dot";
        dot.classList.add(
          c.intensidade === "strong"
            ? "cat-strong"
            : c.intensidade === "medium"
            ? "cat-medium"
            : "cat-weak"
        );

        const label = document.createElement("span");
        label.textContent = c.categoria;

        chip.append(dot, label);
        catList.appendChild(chip);
      });
    } else {
      const vazio = document.createElement("span");
      vazio.style.fontSize = "0.75rem";
      vazio.style.color = "#9ca3af";
      vazio.textContent = "Sem categorias cadastradas.";
      catList.appendChild(vazio);
    }

    catSec.append(catTitle, catList);
    card.appendChild(catSec);

    // ------ MÚSICAS (SEM categorias/dificuldades por música, como você pediu) ------
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
      thumb.src = musica._thumbUrl || `https://img.youtube.com/vi/${musica.referLink}/0.jpg`;
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
      artistAvatar.src = musica._artistImage || `artistas/${slugify(musica.artista)}.jpg`;
      artistAvatar.onerror = function () {
        this.onerror = null;
        this.src = "artistas/default.jpg";
      };

      const artistName = document.createElement("span");
      artistName.className = "artist-name";
      artistName.textContent = musica.artista || "Artista";

      artistRow.append(artistAvatar, artistName);

      main.append(titulo, artistRow);
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
  const catDom = calcularCategoriaDominanteDaEscala(escala);
  const stats = calcularStatsRepertorioDaEscala(escala);
  const cats = calcularIntensidadeCategorias(escala);

  const corPorNivel = (nivel) =>
    nivel === "easy"
      ? "🟢"
      : nivel === "medium"
      ? "🟡"
      : nivel === "hard"
      ? "🔴"
      : "⚪";

  const corDominancia = (i) =>
    i === "strong" ? "🟢" : i === "medium" ? "🟡" : "🔴";

  let texto = `📅 *Escala do dia* — ${formatarData(escala.dataObj)}\n`;

  if (catDom?.categoria) {
    texto += `${corDominancia(catDom.intensidade)} *Categoria predominante:* ${
      catDom.categoria
    } (${catDom.percentual.toFixed(0)}%)\n`;
  }
  if (stats?.dificuldadeGeralNivel) {
    texto += `${corPorNivel(
      stats.dificuldadeGeralNivel
    )} *Dificuldade média:* ${nivelLabel(stats.dificuldadeGeralNivel)}\n`;
  }

  // Categorias do repertório (ordenadas)
  if (cats.length) {
    texto += `\n🏷️ *Categorias do repertório*\n`;
    cats.forEach((c) => {
      texto += `- ${corDominancia(c.intensidade)} ${
        c.categoria
      } (${c.percentual.toFixed(0)}%)\n`;
    });
  }

  // Integrantes
  texto += `\n🎤 *Integrantes*\n`;
  const ints = Array.isArray(escala.integrantes) ? escala.integrantes : [];
  ints.forEach((iobj) => {
    const membro =
      typeof iobj === "object"
        ? integrantes.find((x) => x.nome === iobj.nome) || iobj
        : integrantes.find((x) => x.id === iobj) || null;

    if (!membro) return;

    const nome = membro.nome || iobj.nome || "Integrante";
    const func =
      membro.funcao ||
      (Array.isArray(membro.function) && membro.function[0]
        ? Object.keys(membro.function[0])[0]
        : iobj.funcao) ||
      "função";

    texto += `- *${nome}* — ${func}\n`;

    // Expertise (se existir)
    if (Array.isArray(membro.function)) {
      membro.function.forEach((obj) => {
        const inst = Object.keys(obj)[0];
        const nivel = obj[inst];
        texto += `   ${corPorNivel(nivel)} ${inst}\n`;
      });
    }
  });

  // Músicas
  texto += `\n🎵 *Músicas*\n`;
  const ids = Array.isArray(escala.musicas) ? escala.musicas : [];
  ids.forEach((id) => {
    const musica = musicas.find((m) => m.id === id);
    if (!musica) return;

    const yt = musica.referLink
      ? `https://www.youtube.com/watch?v=${musica.referLink}`
      : "(sem link)";

    // Categorias da música
    const catsMus = Array.isArray(musica.categorias)
      ? musica.categorias
      : typeof musica.categorias === "string"
      ? musica.categorias
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    // Dificuldades por instrumento
    const lvl = musica.level || {};
    const diffs = Object.entries(lvl)
      .filter(([, v]) => v)
      .map(([inst, v]) => `${corPorNivel(v)} ${inst}`)
      .join(" · ");

    texto += `\n• *${musica.titulo}* — ${musica.artista}\n`;
    texto += `  🔗 ${yt}\n`;
    if (catsMus.length) texto += `  🏷️ ${catsMus.join(" · ")}\n`;
    if (diffs) texto += `  🎚️ ${diffs}\n`;
  });

  navigator.clipboard.writeText(texto).then(() => {
    alert("Escala copiada para a área de transferência!");
  });
}

// =========================================================
// REPERTÓRIO — RENDERIZAÇÃO COMPLETA
// =========================================================

// =========================================================
// REPERTÓRIO — RENDERIZAÇÃO COMPLETA (com status e cadeado)
// =========================================================

function renderRepertorio() {
  const grid = document.getElementById("repertorioGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const hoje = new Date();
  const MS_DIA = 1000 * 60 * 60 * 24;

  const diasParaLiberar = (id) => {
    const futura = getProximaDataEscalada(id);
    const ultima = getUltimaDataTocada(id);

    if (futura) {
      const diasAte = Math.ceil((futura - hoje) / MS_DIA);
      return diasAte + TOCADA_NOS_ULTIMOS_X_DIAS;
    }

    if (ultima) {
      const diasDesde = Math.floor((hoje - ultima) / MS_DIA);
      return TOCADA_NOS_ULTIMOS_X_DIAS - diasDesde;
    }

    return null;
  };

  // Monta lista base
  const lista = musicas.map((m) => {
    const status = getStatusMusicaRepertorio(m.id);
    const exec = getTotalExecucoes(m.id);
    const diasLib =
      status === "recent" || status === "future"
        ? diasParaLiberar(m.id)
        : null;

    const scoreCat = musicaMatchScoreCategorias(m);

    return {
      ...m,
      _status: status,
      _exec: exec,
      _diasLib: diasLib,
      _scoreCat: scoreCat,
    };
  });

  // Separar por status
  const buckets = {
    available: [],
    recent: [],
    future: [],
    banned: [],
  };

  lista.forEach((m) => buckets[m._status].push(m));

  // ============================
  // DISPONÍVEIS — ORDENAR COM CATEGORIA
  // ============================
  const disponiveisOrdenados = buckets.available.slice().sort((a, b) => {
    // 1️⃣ prioridade por match de categoria (2 > 1 > 0)
    if (activeCategories.length > 0) {
      if (b._scoreCat !== a._scoreCat) {
        return b._scoreCat - a._scoreCat;
      }
    }

    // 2️⃣ menos tocadas primeiro
    return (a._exec || 0) - (b._exec || 0);
  });

  // ============================
  // RECENTES / FUTURAS — libera antes primeiro
  // ============================
  const ordenaPorLiberacao = (a, b) => {
    const da = a._diasLib != null ? a._diasLib : 99999;
    const db = b._diasLib != null ? b._diasLib : 99999;
    return da - db;
  };

  const recentesOrdenados = buckets.recent.slice().sort(ordenaPorLiberacao);
  const futurasOrdenadas = buckets.future.slice().sort(ordenaPorLiberacao);

  // ============================
  // BANIDAS — mais tocadas primeiro
  // ============================
  const banidasOrdenadas = buckets.banned
    .slice()
    .sort((a, b) => (b._exec || 0) - (a._exec || 0));

  // ============================
  // ATUALIZAR LEGENDAS
  // ============================
  const legendMap = {
    available: "legendDisponivelCount",
    recent: "legendRecenteCount",
    future: "legendFuturaCount",
    banned: "legendBanidaCount",
  };

  Object.entries(legendMap).forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = buckets[k].length;
  });

  // ============================
  // RENDER FINAL
  // ============================
  const ordemFinal = [
    ...disponiveisOrdenados,
    ...recentesOrdenados,
    ...futurasOrdenadas,
    ...banidasOrdenadas,
  ];

  ordemFinal.forEach((musica) => {
    const card = document.createElement("div");
    card.className = `song-card ${musica._status}`;

    if (activeCategories.length > 0 && musica._scoreCat > 0) {
      card.classList.add("category-match");
    }

    if (musica._status !== "available") {
      card.classList.add("song-unavailable");
    }

    // Thumbnail
    const thumbWrapper = document.createElement("div");
    thumbWrapper.className = "song-thumb-wrapper";

    const thumb = document.createElement("img");
    thumb.className = "song-thumb";
    thumb.src = `https://img.youtube.com/vi/${musica.referLink}/0.jpg`;
    thumb.onerror = function () {
      this.onerror = null;
      this.src = "artistas/default.jpg";
    };
    thumbWrapper.appendChild(thumb);

    // Badge execuções
    const execBadge = document.createElement("div");
    execBadge.className = "song-exec-info";
    execBadge.textContent =
      musica._exec === 0 ? "✨ Nova" : `🎯 Tocada ${musica._exec} vezes`;
    thumbWrapper.appendChild(execBadge);

    // Ribbon status
    if (musica._status !== "available") {
      const ribbon = document.createElement("div");
      ribbon.className = "song-ribbon";

      if (musica._status === "recent") ribbon.classList.add("song-ribbon-recent");
      if (musica._status === "future") ribbon.classList.add("song-ribbon-future");
      if (musica._status === "banned") ribbon.classList.add("song-ribbon-banned");

      ribbon.textContent =
        musica._status === "recent"
          ? "RECENTE"
          : musica._status === "future"
          ? "FUTURA"
          : "BANIDA";

      card.appendChild(ribbon);
    }

    // Conteúdo
    const main = document.createElement("div");
    main.className = "song-main";

    const titulo = document.createElement("p");
    titulo.className = "song-title";
    titulo.textContent = musica.titulo || musica.nome || "Música";

    const artistRow = document.createElement("div");
    artistRow.className = "artist-row";

    const artistAvatar = document.createElement("img");
    artistAvatar.className = "artist-avatar";
    artistAvatar.src = `artistas/${slugify(musica.artista)}.jpg`;
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
    diffBadges.forEach((b) => tags.appendChild(b));

    main.append(titulo, artistRow, tags);

    card.append(thumbWrapper, main);

    // Cadeado
    if (musica._status === "recent" || musica._status === "future") {
      if (musica._diasLib != null) {
        const release = document.createElement("div");
        release.className = "song-release-info";
        release.textContent =
          musica._diasLib <= 0
            ? "🔓 Libera hoje"
            : `🔒 Libera em ${musica._diasLib} dias`;
        thumbWrapper.appendChild(release);
      }
    }

    attachYoutubeClick(card, musica);
    grid.appendChild(card);
  });
}


function calcularDiasParaLiberar(idMusica) {
  const hoje = new Date();

  const futuraData = getProximaDataEscalada(idMusica); // próxima data no futuro
  const ultima = getUltimaDataTocada(idMusica); // última data no passado

  // FUTURA: libera depois de tocar + cooldown
  if (futuraData) {
    const diasAteTocar = Math.ceil((futuraData - hoje) / (1000 * 60 * 60 * 24));
    const dias = diasAteTocar + TOCADA_NOS_ULTIMOS_X_DIAS;
    return dias <= 0 ? 0 : dias;
  }

  // RECENTE: libera quando acabar cooldown desde a última execução
  if (ultima) {
    const diasDesde = Math.floor((hoje - ultima) / (1000 * 60 * 60 * 24));
    const restante = TOCADA_NOS_ULTIMOS_X_DIAS - diasDesde;
    return restante <= 0 ? 0 : restante;
  }

  return null;
}

function nivelLabel(nivel) {
  if (nivel === "easy") return "Fácil";
  if (nivel === "medium") return "Médio";
  if (nivel === "hard") return "Difícil";
  return "";
}

function calcularCategoriaDominanteDaEscala(escala) {
  const cats = calcularIntensidadeCategorias(escala);
  if (!cats.length) return null;
  return cats[0]; // já vem ordenado desc
}

function calcularStatsRepertorioDaEscala(escala) {
  const ids = Array.isArray(escala.musicas) ? escala.musicas : [];
  const peso = { easy: 1, medium: 2, hard: 3 };

  let soma = 0;
  let n = 0;

  ids.forEach((id) => {
    const m = musicas.find((x) => x.id === id);
    if (!m || !m.level) return;

    Object.values(m.level).forEach((lvl) => {
      if (!lvl || !peso[lvl]) return;
      soma += peso[lvl];
      n += 1;
    });
  });

  if (!n) return { dificuldadeGeralNivel: null };

  const media = soma / n;
  const nivel = media < 1.67 ? "easy" : media < 2.34 ? "medium" : "hard";

  return { dificuldadeGeralNivel: nivel };
}

// =========================================================
// HELPERS DE DATA POR MÚSICA (usados no repertório)
// =========================================================

function getProximaDataEscalada(idMusica) {
  const hoje = new Date();

  const futuras = historico
    .map((h) => ({
      dataObj: parseDate(h.data),
      musicas: h.musicas || [],
    }))
    .filter(
      (h) =>
        h.dataObj instanceof Date &&
        !isNaN(h.dataObj) &&
        h.dataObj > hoje &&
        h.musicas.includes(idMusica)
    )
    .sort((a, b) => a.dataObj - b.dataObj);

  return futuras.length ? futuras[0].dataObj : null;
}

function getUltimaDataTocada(idMusica) {
  const hoje = new Date();

  const passadas = historico
    .map((h) => ({
      dataObj: parseDate(h.data),
      musicas: h.musicas || [],
    }))
    .filter(
      (h) =>
        h.dataObj instanceof Date &&
        !isNaN(h.dataObj) &&
        h.dataObj < hoje &&
        h.musicas.includes(idMusica)
    )
    .sort((a, b) => b.dataObj - a.dataObj);

  return passadas.length ? passadas[0].dataObj : null;
}

function criarCardMusicaRepertorio(
  musica,
  status,
  ultimaExecucao,
  proximaExecucao
) {
  const card = document.createElement("div");
  card.className = "song-card";

  card.classList.add(status);

  // Thumbnail
  const wrapper = document.createElement("div");
  wrapper.className = "song-thumb-wrapper";

  const thumb = document.createElement("img");
  thumb.className = "song-thumb";
  thumb.src = `https://img.youtube.com/vi/${musica.referLink}/0.jpg`;
  thumb.onerror = () => (thumb.src = "artistas/default.jpg");
  wrapper.appendChild(thumb);

  // Ribbon (status)
  const ribbon = document.createElement("div");
  ribbon.className = "song-ribbon";
  ribbon.textContent =
    status === "available"
      ? "Disponível"
      : status === "recent"
      ? "Recente"
      : status === "future"
      ? "Futura"
      : "Banida";

  ribbon.classList.add(`song-ribbon-${status}`);
  if (activeCategories.length > 0) ribbon.classList.add("song-ribbon-filtered");

  // Info principal
  const main = document.createElement("div");
  main.className = "song-main";

  const title = document.createElement("p");
  title.className = "song-title";
  title.textContent = musica.titulo;

  // Artista
  const artistRow = document.createElement("div");
  artistRow.className = "artist-row";

  const artistaImg = document.createElement("img");
  artistaImg.className = "artist-avatar";
  artistaImg.src = `artistas/${slugify(musica.artista)}.jpg`;
  artistaImg.onerror = () => (artistaImg.src = "artistas/default.jpg");

  const artistaNome = document.createElement("span");
  artistaNome.className = "artist-name";
  artistaNome.textContent = musica.artista;

  artistRow.append(artistaImg, artistaNome);

  // Tags (categorias)
  const tags = document.createElement("div");
  tags.className = "song-tags";

  const cats = Array.isArray(musica.categorias)
    ? musica.categorias
    : typeof musica.categorias === "string"
    ? musica.categorias
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  cats.forEach((c) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = c;
    tags.appendChild(tag);
  });

  // Execuções
  const execPill = document.createElement("span");
  execPill.className = "song-pill";
  execPill.textContent = `${getTotalExecucoes(musica.id)} exec`;
  tags.appendChild(execPill);

  // Liberação (cadeado)
  if (status === "future" || status === "recent") {
    const dias = calcularDiasParaLiberar(musica.id);

    if (dias != null) {
      const libera = document.createElement("div");
      libera.className = "song-release-info";
      libera.textContent =
        dias <= 0 ? "🔓 Libera hoje" : `🔒 Libera em ${dias} dias`;
      wrapper.appendChild(libera);
    }
  }

  main.append(title, artistRow, tags);
  card.append(wrapper, ribbon, main);

  // click abre youtube
  if (musica.referLink) {
    card.addEventListener("click", () => {
      window.open(
        `https://www.youtube.com/watch?v=${musica.referLink}`,
        "_blank"
      );
    });
  }

  return card;
}

// =========================================================
// TOTAL DE EXECUÇÕES DE UMA MÚSICA NO HISTÓRICO
// =========================================================
function getTotalExecucoes(idMusica) {
  if (!idMusica || !Array.isArray(historico)) return 0;

  let total = 0;

  historico.forEach((culto) => {
    if (!Array.isArray(culto.musicas)) return;
    culto.musicas.forEach((id) => {
      if (id === idMusica) total++;
    });
  });

  return total;
}

function getStatusMusicaRepertorio(idMusica) {
  const m = musicas.find((x) => x.id === idMusica);
  if (!m) return "available";

  if (m.banned) return "banned";

  const futura = getProximaDataEscalada(idMusica);
  if (futura) return "future";

  const ultima = getUltimaDataTocada(idMusica);
  if (!ultima) return "available";

  const hoje = new Date();
  const diasDesde = Math.floor((hoje - ultima) / (1000 * 60 * 60 * 24));
  if (diasDesde <= TOCADA_NOS_ULTIMOS_X_DIAS) return "recent";

  return "available";
}


// =========================================================
// FIM DO ARQUIVO
// =========================================================

console.log("Projeto Asafe carregado com sucesso!");
