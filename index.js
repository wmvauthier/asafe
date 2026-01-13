// =========================================================
// PROJETO ASAFE - INDEX.JS (versão atualizada)
// =========================================================

// Estado global
let integrantes = [];
let musicas = [];
let historico = [];
let categoriasUnicas = [];
let activeCategories = [];
let CACHE_POPULARIDADE = null;

// Constantes
const TOCADA_NOS_ULTIMOS_X_DIAS = 56; // ~8 semanas

/* ===== Sanidade essencial de repertório (ALINHADA AOS BADGES) =====
   - Dificuldade: calcDificuldadeMediaMusica + valorToNivel
   - Popularidade: classificarNiveisDePopularidade
   Regras:
   - NUNCA 3 hard
   - NUNCA 3 rare
*/
function getPopularidadeNivelMusica(idMusica, popularidadeSnapshot) {
  // Fonte única (mesma do badge inferior)
  const snap = popularidadeSnapshot || CACHE_POPULARIDADE || null;
  if (snap && snap[idMusica] && snap[idMusica].nivel) return snap[idMusica].nivel;
  // fallback: mesma função usada na UI
  return getNivelPopularidadeMusica(idMusica);
}

function getDificuldadeNivelMusica(musica) {
  // Fonte única (mesma do badge superior)
  const dAvg = calcDificuldadeMediaMusica(musica);
  return { dAvg, nivel: valorToNivel(dAvg) };
}

/* ===== Checkpoint 1++ (sanidade + regras por repertório, alinhado aos badges) =====
Regras globais:
- NUNCA 3 hard
- NUNCA 3 rare
Regras por repertório (2026-01-12 -> complementadas pelo PO):
Facílimo -> 0 rare + 0 hard + >=1 classic + <=1 medium
Mediano  -> 0 rare + >=1 common + <=1 hard
Desafiador -> >=1 rare + >=1 hard
Favoritas do Time -> (sem hard rules adicionais além globais e categoria strong 100)
Incomum -> >=1 rare
Categoria:
- Prioridade: sempre "strong" com 100% (todas as músicas compartilham a categoria dominante)
*/
function validarComboPorRepertorio(combo, estrategiaKey) {
  // combo: Array<songInsight>
  if (!Array.isArray(combo) || combo.length !== 3) return false;

  let hard = 0;
  let medium = 0;
  let easy = 0;

  let rare = 0;
  let common = 0;
  let classic = 0;

  for (let i = 0; i < 3; i++) {
    const si = combo[i];
    if (!si) return false;

    const dNivel = si._diffNivel || null; // precomputado via badge helpers
    if (dNivel === "hard") hard++;
    else if (dNivel === "medium") medium++;
    else easy++;

    const pNivel = si._popNivel || null; // precomputado via classificarNiveisDePopularidade
    if (pNivel === "rare") rare++;
    else if (pNivel === "common") common++;
    else classic++;
  }

  // Regras globais
  if (hard >= 3) return false;
  if (rare >= 3) return false;

  // Regras por repertório
  if (estrategiaKey === "facilimo") {
    // 0 rare + 0 hard + >=1 classic + <=1 medium
    if (rare > 0) return false;
    if (hard > 0) return false;
    if (classic < 1) return false;
    if (medium > 1) return false;
  } else if (estrategiaKey === "mediano") {
    // 0 rare + >=1 common + <=1 hard
    if (rare > 0) return false;
    if (common < 1) return false;
    if (hard > 1) return false;
  } else if (estrategiaKey === "desafiador") {
    // >=1 rare + >=1 hard
    if (rare < 1) return false;
    if (hard < 1) return false;
  } else if (estrategiaKey === "incomum") {
    // >=1 rare
    if (rare < 1) return false;
  }

  return true;
}
/* ===== fim sanidade essencial ===== */



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

// =========================================================
// DIFICULDADE MÉDIA POR MÚSICA (badge no canto superior direito)
// =========================================================
function calcularDificuldadeMediaDaMusica(musica) {
  if (!musica || !musica.level || typeof musica.level !== "object") return null;

  const valores = Object.values(musica.level)
    .map((n) => nivelToValor(n))
    .filter((v) => v > 0);

  if (!valores.length) return null;

  const avg = valores.reduce((acc, v) => acc + v, 0) / valores.length;
  const nivel = valorToNivel(avg);
  if (!nivel) return null;

  return {
    avg,
    nivel,
  };
}

function criarBadgeDificuldadeMediaMusica(musica) {
  const diff = calcularDificuldadeMediaDaMusica(musica);
  if (!diff) return null;

  const badge = document.createElement("div");
  badge.className = "song-overlay";
  badge.style.top = "8px";
  badge.style.right = "8px";

  const dot = document.createElement("span");
  dot.className = "tag-diff-dot";

  if (diff.nivel === "easy") dot.classList.add("tag-diff-dot-easy");
  else if (diff.nivel === "medium") dot.classList.add("tag-diff-dot-medium");
  else dot.classList.add("tag-diff-dot-hard");

  const valor = document.createElement("span");
  // mostra a média numérica (1 casa) para ser bem explícito
  valor.textContent = `🎚️${Math.round(diff.avg * 10) / 10}`;

  badge.append(dot, valor);
  return badge;
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
      ? m.categorias
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
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


// =========================================================
// SUGESTÃO AUTOMÁTICA DE REPERTÓRIO (ESCALAS FUTURAS)
// ---------------------------------------------------------
// Observação: o sistema apenas sugere (não persiste em JSON).
// Regras globais respeitadas:
// - músicas banidas (banned/ban) nunca entram
// - músicas tocadas nos últimos TOCADA_NOS_ULTIMOS_X_DIAS (relativo à data do culto) nunca entram
// - força mínima de categoria: "medium" (>=60% das músicas do repertório na categoria dominante)
// =========================================================

const SUGGESTION_SIZE = 3;

// --- normalização de instrumento (compatível com wrapped.js e dados do projeto) ---
function normalizarInstrumentoKey(raw) {
  if (!raw) return null;
  return raw
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function getInstrumentoDoIntegrante(member) {
  if (!member) return null;
  const raw =
    member.instrumento ||
    (Array.isArray(member.instrumentos) ? member.instrumentos[0] : null);
  return normalizarInstrumentoKey(raw);
}

// Tenta extrair nível do integrante (easy/medium/hard) para o instrumento dele.
// Se não existir nos dados, assume "medium" para não bloquear sugestões.
function getNivelDoIntegrante(member, instKey) {
  const fallback = "medium";
  if (!member) return fallback;

  // Possíveis formatos (mantém robusto):
  // - member.level: "easy" | "medium" | "hard"
  // - member.nivel: "easy" | ...
  // - member.level: { guitarra:"easy", ... }
  // - member.nivel: { ... }
  // - member.niveis: { ... }
  // - member.expertise: "easy" | ...
  const candidates = [member.level, member.nivel, member.niveis, member.expertise];

  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === "string") {
      return c;
    }
    if (typeof c === "object" && instKey && c[instKey]) {
      return c[instKey];
    }
  }

  // Alternativas por chaves de instrumento no root (ex.: member.guitarra="medium")
  if (instKey && typeof member[instKey] === "string") return member[instKey];

  return fallback;
}

function getEventosPassadosAte(dataObj) {
  if (!(dataObj instanceof Date) || isNaN(dataObj)) return [];
  return historico
    .map((h) => ({ ...h, dataObj: parseDate(h.data) }))
    .filter((h) => h.dataObj instanceof Date && !isNaN(h.dataObj) && h.dataObj < dataObj)
    .sort((a, b) => a.dataObj - b.dataObj);
}

// Última vez tocada ANTES de uma data
function getUltimaDataTocadaAte(idMusica, dataObj) {
  const eventos = getEventosPassadosAte(dataObj);
  for (let i = eventos.length - 1; i >= 0; i--) {
    const ev = eventos[i];
    if (Array.isArray(ev.musicas) && ev.musicas.includes(idMusica)) {
      return ev.dataObj;
    }
  }
  return null;
}

function foiTocadaRecentementeAte(idMusica, dataObj, dias) {
  const ultima = getUltimaDataTocadaAte(idMusica, dataObj);
  if (!ultima) return false;
  const MS_DIA = 1000 * 60 * 60 * 24;
  const delta = Math.floor((dataObj - ultima) / MS_DIA);
  return delta >= 0 && delta <= dias;
}

// Retorna true se a música já está programada em alguma escala futura (após a data de referência)
// Isso evita sugerir algo que já está "reservado" no futuro.
function foiProgramadaEmEscalaFuturaApos(idMusica, dataRefObj) {
  if (!(dataRefObj instanceof Date) || isNaN(dataRefObj)) return false;

  const futuros = (historico || [])
    .map((ev) => ({ ev, dataObj: parseDate(ev.data) }))
    .filter((x) => x.dataObj instanceof Date && !isNaN(x.dataObj) && x.dataObj > dataRefObj);

  return futuros.some(({ ev }) => Array.isArray(ev.musicas) && ev.musicas.includes(idMusica));
}

// Dificuldade média (numérica) da música a partir de musica.level
function calcDificuldadeMediaMusica(musica) {
  if (!musica || !musica.level || typeof musica.level !== "object") return null;

  let soma = 0;
  let count = 0;

  Object.values(musica.level).forEach((niv) => {
    const val = nivelToValor(niv);
    if (!val) return;
    soma += val;
    count += 1;
  });

  if (!count) return null;
  return soma / count; // 1..3
}

// Perfil de dificuldade médio do time (com base no histórico passado)
function calcPerfilDificuldadeDoTime(members, eventosPassados) {
  const memberSet = new Set((members || []).map((x) => (typeof x === "object" ? x.id : x)));

  let soma = 0;
  let count = 0;

  (eventosPassados || []).forEach((ev) => {
    const evMembers = Array.isArray(ev.integrantes) ? ev.integrantes : [];
    const intersect = evMembers.some((mid) => memberSet.has(mid));
    if (!intersect) return;

    const ids = Array.isArray(ev.musicas) ? ev.musicas : [];
    ids.forEach((id) => {
      const musica = musicas.find((m) => m.id === id);
      if (!musica) return;
      const d = calcDificuldadeMediaMusica(musica);
      if (!d) return;
      soma += d;
      count += 1;
    });
  });

  if (!count) return null;
  return soma / count; // 1..3
}

// Familiaridade do time com a música: quantas vezes membros atuais tocaram (normalizado)
function calcFamiliaridadeDoTimeComMusica(idMusica, members, eventosPassados) {
  const memberIds = (members || [])
    .map((x) => (typeof x === "object" ? x.id : x))
    .filter(Boolean);

  if (!memberIds.length) return 0;

  const playsByMember = new Map();
  const totalByMember = new Map();

  memberIds.forEach((mid) => {
    playsByMember.set(mid, 0);
    totalByMember.set(mid, 0);
  });

  (eventosPassados || []).forEach((ev) => {
    const evMembers = Array.isArray(ev.integrantes) ? ev.integrantes : [];
    const hasMusic = Array.isArray(ev.musicas) && ev.musicas.includes(idMusica);
    if (!evMembers.length) return;

    evMembers.forEach((mid) => {
      if (!playsByMember.has(mid)) return;
      totalByMember.set(mid, (totalByMember.get(mid) || 0) + 1);
      if (hasMusic) playsByMember.set(mid, (playsByMember.get(mid) || 0) + 1);
    });
  });

  // média das proporções por membro (0..1)
  let soma = 0;
  let count = 0;
  memberIds.forEach((mid) => {
    const tot = totalByMember.get(mid) || 0;
    const pl = playsByMember.get(mid) || 0;
    const ratio = tot > 0 ? pl / tot : 0;
    soma += ratio;
    count += 1;
  });

  return count ? soma / count : 0;
}

// Afinidade com header(s): quantas vezes um header já escolheu a música (0..1)
function calcAfinidadeHeaderComMusica(idMusica, headerIds, eventosPassados) {
  const headers = (headerIds || []).filter(Boolean);
  if (!headers.length) return 0;

  let totalHeaderEventos = 0;
  let hits = 0;

  (eventosPassados || []).forEach((ev) => {
    const evHeaders = Array.isArray(ev.header) ? ev.header : [];
    const intersect = evHeaders.some((hid) => headers.includes(hid));
    if (!intersect) return;

    totalHeaderEventos += 1;
    if (Array.isArray(ev.musicas) && ev.musicas.includes(idMusica)) hits += 1;
  });

  if (!totalHeaderEventos) return 0;
  return hits / totalHeaderEventos;
}

// Preferência do time/header por artista (para desempate)
function buildPreferenciaArtistas(headerIds, members, eventosPassados) {
  const headers = new Set((headerIds || []).filter(Boolean));
  const memberSet = new Set((members || []).map((x) => (typeof x === "object" ? x.id : x)).filter(Boolean));

  const artistCounts = new Map();
  let total = 0;

  (eventosPassados || []).forEach((ev) => {
    const evMembers = Array.isArray(ev.integrantes) ? ev.integrantes : [];
    const evHeaders = Array.isArray(ev.header) ? ev.header : [];

    const relToMembers = evMembers.some((mid) => memberSet.has(mid));
    const relToHeaders = evHeaders.some((hid) => headers.has(hid));
    if (!relToMembers && !relToHeaders) return;

    const ids = Array.isArray(ev.musicas) ? ev.musicas : [];
    ids.forEach((id) => {
      const musica = musicas.find((m) => m.id === id);
      if (!musica) return;
      const art = (musica.artista || "").trim();
      if (!art) return;
      artistCounts.set(art, (artistCounts.get(art) || 0) + 1);
      total += 1;
    });
  });

  return {
    counts: artistCounts,
    total: total || 1,
    score: (artist) => {
      if (!artist) return 0;
      return (artistCounts.get(artist) || 0) / (total || 1);
    },
  };
}

// Compatibilidade do time com a música (0..1), comparando nível do integrante com o nível do instrumento na música
function calcCompatibilidadeTimeMusica(musica, members) {
  const memberObjs = (members || []).map((x) => (typeof x === "object" ? x : integrantes.find((i) => i.id === x))).filter(Boolean);
  if (!memberObjs.length) return 0.6; // fallback neutro

  const levels = (musica && musica.level && typeof musica.level === "object") ? musica.level : {};
  let soma = 0;
  let count = 0;

  memberObjs.forEach((m) => {
    const inst = getInstrumentoDoIntegrante(m);
    if (!inst) return;

    const songNivel = levels[inst] || "medium";
    const songVal = nivelToValor(songNivel) || 2;

    const memberNivel = getNivelDoIntegrante(m, inst);
    const memberVal = nivelToValor(memberNivel) || 2;

    // compatibilidade: 1 se atende; caso contrário, razão (0..1)
    const comp = memberVal >= songVal ? 1 : Math.max(0, memberVal / songVal);
    soma += comp;
    count += 1;
  });

  if (!count) return 0.6;
  return soma / count;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}


function parseCategoriasMusica(categoriasRaw) {
  // No JSON atual, categorias vem como string "Cat A; Cat B; Cat C"
  if (!categoriasRaw) return [];
  if (Array.isArray(categoriasRaw)) return categoriasRaw.map((c) => String(c || "").trim()).filter(Boolean);
  const s = String(categoriasRaw);
  return s.split(";").map((c) => c.trim()).filter(Boolean);
}


function scoreToLabel3(score01, highLabel, midLabel, lowLabel) {
  if (score01 >= 0.70) return highLabel;
  if (score01 >= 0.45) return midLabel;
  return lowLabel;
}

// Popularidade local para o conjunto de elegíveis (0..1)
function calcPopularidadeLocal(timesPlayed, maxPlayed) {
  if (!maxPlayed) return 0;
  return clamp01(timesPlayed / maxPlayed);
}

function buildSongInsightParaEscala(musica, context, caches) {
  const dAvg = calcDificuldadeMediaMusica(musica);
  const diff01 = dAvg ? clamp01((dAvg - 1) / 2) : 0.5;

  const timesPlayed = caches.timesPlayed.get(musica.id) || 0;
  const lastPlayed = caches.lastPlayed.get(musica.id) || null;

  const pop01 = calcPopularidadeLocal(timesPlayed, caches.maxPlayed);

  const headerAffinity = caches.headerAffinity.get(musica.id) || 0;
  const teamFamiliarity = caches.teamFamiliarity.get(musica.id) || 0;
  const teamCompatibility = caches.teamCompatibility.get(musica.id) || 0.6;

  // Segurança Técnica (0..1): dominada por compatibilidade do time
  const seguranca =
    clamp01(
      (0.45 * teamCompatibility) +
      (0.25 * (1 - diff01)) +
      (0.20 * teamFamiliarity) +
      (0.10 * headerAffinity)
    );

  // Familiaridade (0..1): ignora dificuldade
  const familiaridade =
    clamp01(
      (0.45 * teamFamiliarity) +
      (0.35 * pop01) +
      (0.20 * headerAffinity)
    );

  // Desafio (0..1): complexidade + novidade técnica + exigência relativa ao time
  const teamProfile = context.teamDifficultyProfile || 2; // 1..3
  const rel = dAvg ? clamp01((dAvg - teamProfile + 2) / 4) : 0.5; // suaviza (-2..+2) => 0..1

  const desafio =
    clamp01(
      (0.50 * diff01) +
      (0.30 * (1 - teamFamiliarity)) +
      (0.20 * rel)
    );

  // Renovação (0..1): raridade + frequência + tempo (músicas recentes já filtradas)
  const novidadeFreq = timesPlayed === 0 ? 1 : clamp01(1 / (1 + timesPlayed)); // 1, 0.5, 0.33...
  let tempo01 = 0.5;
  if (lastPlayed && context.serviceDate) {
    const MS_DIA = 1000 * 60 * 60 * 24;
    const dias = Math.max(0, Math.floor((context.serviceDate - lastPlayed) / MS_DIA));
    // 0..180 dias => 0..1 (cap)
    tempo01 = clamp01(dias / 180);
  }
  const renovacao =
    clamp01(
      (0.45 * (1 - pop01)) +
      (0.35 * novidadeFreq) +
      (0.20 * tempo01)
    );

  return {
    musica,
    categorias: parseCategoriasMusica(musica.categorias),
    artista: (musica.artista || "").trim(),
    metrics: {
      timesPlayed,
      lastPlayed,
      headerAffinity,
      teamFamiliarity,
      teamCompatibility,
      difficultyAvg: dAvg,
    },
    insights: {
      seguranca,
      familiaridade,
      desafio,
      renovacao,
      badges: {
        seguranca: scoreToLabel3(seguranca, "Muito Segura", "Moderada", "Arriscada"),
        familiaridade: scoreToLabel3(familiaridade, "Muito Familiar", "Familiar", "Pouco Familiar"),
        desafio: scoreToLabel3(desafio, "Baixo", "Moderado", "Alto"),
        renovacao: scoreToLabel3(renovacao, "Alta", "Moderada", "Baixa"),
      },
    },
  };
}

function calcCategoriaDominanteCombo(insightsCombo) {
  const total = insightsCombo.length || 1;
  const freq = new Map();

  insightsCombo.forEach((si) => {
    (si.categorias || []).forEach((c) => {
      const cat = (c || "").trim();
      if (!cat) return;
      freq.set(cat, (freq.get(cat) || 0) + 1);
    });
  });

  if (!freq.size) return { categoria: null, percentual: 0, intensidade: "weak" };

  let bestCat = null;
  let bestCount = 0;
  freq.forEach((count, cat) => {
    if (count > bestCount) {
      bestCount = count;
      bestCat = cat;
    }
  });

  const perc = Math.round((bestCount / total) * 100);
  let intensidade = "weak";
  if (perc >= 80) intensidade = "strong";
  else if (perc >= 60) intensidade = "medium";

  return { categoria: bestCat, percentual: perc, intensidade };
}

function calcCategoriaDominanteComboStrong100(combo) {
  // Retorna {categoria, percentual:100, intensidade:"strong"} se existir uma categoria comum às 3 músicas.
  if (!Array.isArray(combo) || combo.length !== 3) return { categoria: null, percentual: 0, intensidade: "weak" };

  const a = combo[0]?.categorias || [];
  const b = combo[1]?.categorias || [];
  const c = combo[2]?.categorias || [];

  if (!a.length || !b.length || !c.length) return { categoria: null, percentual: 0, intensidade: "weak" };

  const setB = new Set(b);
  const setC = new Set(c);

  for (let i = 0; i < a.length; i++) {
    const cat = a[i];
    if (!cat) continue;
    if (setB.has(cat) && setC.has(cat)) {
      return { categoria: cat, percentual: 100, intensidade: "strong" };
    }
  }

  return { categoria: null, percentual: 0, intensidade: "weak" };
}

function isCategoriaValida(intensidade) {
  return intensidade === "strong" || intensidade === "medium";
}

// bônus de desempate por afinidade de artista (leve)
function ajustarScorePorArtistas(combo, preferenciaArtistas) {
  const artists = combo.map((si) => si.artista).filter(Boolean);

  // bônus por repetição (2+ do mesmo artista)
  let sameArtistBonus = 0;
  const freq = new Map();
  artists.forEach((a) => freq.set(a, (freq.get(a) || 0) + 1));
  freq.forEach((count) => {
    if (count >= 2) sameArtistBonus += 0.03; // bônus pequeno
  });

  // bônus por artista "queridinho" do time/header
  let prefBonus = 0;
  if (preferenciaArtistas && typeof preferenciaArtistas.score === "function") {
    artists.forEach((a) => {
      prefBonus += 0.02 * clamp01(preferenciaArtistas.score(a));
    });
  }

  return clamp01(sameArtistBonus + prefBonus);
}

// Estratégias (pesos relativos)
const REPERTORIOS_ESTRATEGIAS = [
  {
    key: "facilimo",
    titulo: "Facílimo",
    pesos: { seguranca: 1.0, familiaridade: 0.8, desafio: 0.1, renovacao: 0.2 },
  },
  {
    key: "mediano",
    titulo: "Mediano",
    pesos: { seguranca: 0.8, familiaridade: 0.5, desafio: 0.5, renovacao: 0.4 },
  },
  {
    key: "desafiador",
    titulo: "Desafiador",
    pesos: { seguranca: 0.5, familiaridade: 0.2, desafio: 1.0, renovacao: 0.5 },
  },
  {
    key: "favoritas",
    titulo: "Favoritas do Time",
    pesos: { seguranca: 0.8, familiaridade: 1.0, desafio: 0.2, renovacao: 0.1 },
  },
  {
    key: "incomum",
    titulo: "Incomum",
    pesos: { seguranca: 0.4, familiaridade: 0.2, desafio: 0.5, renovacao: 1.0 },
  },
];

function scoreSongForStrategy(songInsight, estrategia) {
  const p = estrategia.pesos;
  const s = songInsight.insights;
  const m = songInsight.metrics || {};

  let score =
    (p.seguranca * s.seguranca) +
    (p.familiaridade * s.familiaridade) +
    (p.desafio * s.desafio) +
    (p.renovacao * s.renovacao);

  // Favoritas do Time: considere BEM MAIS membros/headers (afinidade, familiaridade e compatibilidade)
  if (estrategia && estrategia.key === "favoritas") {
    const bonusTime =
      (0.55 * clamp01(m.headerAffinity || 0)) +
      (0.45 * clamp01(m.teamFamiliarity || 0)) +
      (0.25 * clamp01(m.teamCompatibility || 0));
    score = score + bonusTime;
  }

  return score;
}

function gerarCombinacoesTop(scored, k) {
  const arr = scored.map((x) => x.si);
  const combos = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      for (let t = j + 1; t < arr.length; t++) {
        combos.push([arr[i], arr[j], arr[t]]);
      }
    }
  }
  return combos;
}

function gerarSugestoesRepertoriosParaEscala(escala) {
  // Snapshot de popularidade (mesma fonte da UI)
  const popularidadeSnapshot = classificarNiveisDePopularidade(musicas);

  const serviceDate = escala.dataObj || parseDate(escala.data);
  if (!(serviceDate instanceof Date) || isNaN(serviceDate)) return [];

  const members = Array.isArray(escala.integrantes) ? escala.integrantes : [];
  const headerIds = Array.isArray(escala.header) ? escala.header : [];

  const eventosPassados = getEventosPassadosAte(serviceDate);
  const teamDifficultyProfile = calcPerfilDificuldadeDoTime(members, eventosPassados) || 2;

  const context = { serviceDate, members, headerIds, eventosPassados, teamDifficultyProfile };

  // 1) elegibilidade
  const elegiveis = musicas.filter((m) => {
    if (!m) return false;
    if (m.ban === true || m.banned === true) return false;
    // filtro de recência relativo à data do culto (regra global)
    if (foiTocadaRecentementeAte(m.id, serviceDate, TOCADA_NOS_ULTIMOS_X_DIAS)) return false;
    // não sugerir músicas já programadas em escalas futuras
    if (foiProgramadaEmEscalaFuturaApos(m.id, serviceDate)) return false;
    return true;
  });

  // caches por música para performance
  const caches = {
    timesPlayed: new Map(),
    lastPlayed: new Map(),
    teamFamiliarity: new Map(),
    headerAffinity: new Map(),
    teamCompatibility: new Map(),
    maxPlayed: 0,
  };

  elegiveis.forEach((m) => {
    const times = (() => {
      let total = 0;
      eventosPassados.forEach((ev) => {
        if (Array.isArray(ev.musicas) && ev.musicas.includes(m.id)) total++;
      });
      return total;
    })();

    caches.timesPlayed.set(m.id, times);
    caches.maxPlayed = Math.max(caches.maxPlayed, times);

    caches.lastPlayed.set(m.id, getUltimaDataTocadaAte(m.id, serviceDate));
    caches.teamFamiliarity.set(m.id, calcFamiliaridadeDoTimeComMusica(m.id, members, eventosPassados));
    caches.headerAffinity.set(m.id, calcAfinidadeHeaderComMusica(m.id, headerIds, eventosPassados));
    caches.teamCompatibility.set(m.id, calcCompatibilidadeTimeMusica(m, members));
  });

  const preferenciaArtistas = buildPreferenciaArtistas(headerIds, members, eventosPassados);

const insightsBase = elegiveis.map((m) => buildSongInsightParaEscala(m, context, caches));

// Pré-cálculo (performance): fixar exatamente os mesmos níveis usados nos badges
// - Dificuldade: valorToNivel(calcDificuldadeMediaMusica)
// - Popularidade: classificarNiveisDePopularidade (snapshot) -> .nivel
insightsBase.forEach((si) => {
  const musica = si?.musica;
  if (!musica) return;

  const dAvg = calcDificuldadeMediaMusica(musica);
  si._diffAvg = dAvg;
  si._diffNivel = dAvg != null ? valorToNivel(dAvg) : null;

  const snap = popularidadeSnapshot && popularidadeSnapshot[musica.id];
  si._popNivel = snap && snap.nivel ? snap.nivel : getNivelPopularidadeMusica(musica.id);

  // normalizar categorias já calculadas
  if (!Array.isArray(si.categorias)) si.categorias = parseCategoriasMusica(musica.categorias);
});


  // função helper para montar um repertório por estratégia
function montarRepertorio(estrategia) {
  const scored = insightsBase
    .map((si) => ({ si, score: scoreSongForStrategy(si, estrategia) }))
    .sort((a, b) => b.score - a.score);

  const TOP_K = Math.min(40, scored.length);
  if (TOP_K < SUGGESTION_SIZE) return null;

  // Pool base (já ordenado por score)
  let pool = scored.slice(0, TOP_K).map((x) => x.si);

  // Pequenas reduções do espaço de busca por estratégia (sem relaxar regras)
  if (estrategia.key === "facilimo") {
    pool = pool.filter((si) => si._popNivel !== "rare" && si._diffNivel !== "hard");
  } else if (estrategia.key === "mediano") {
    pool = pool.filter((si) => si._popNivel !== "rare");
  }

  if (pool.length < SUGGESTION_SIZE) return null;

  // Helper: score médio do combo (3 músicas)
  const scoreComboBase = (a, b, c) =>
    (scoreSongForStrategy(a, estrategia) +
      scoreSongForStrategy(b, estrategia) +
      scoreSongForStrategy(c, estrategia)) / 3;

  let best = null;

  // Iteração direta (evita alocar array gigante de combos)
  for (let i = 0; i < pool.length - 2; i++) {
    const a = pool[i];
    for (let j = i + 1; j < pool.length - 1; j++) {
      const b = pool[j];
      for (let k = j + 1; k < pool.length; k++) {
        const c = pool[k];

        const combo = [a, b, c];

        // Regras globais + por repertório
        if (!validarComboPorRepertorio(combo, estrategia.key)) continue;

        // Categoria: exigir strong 100% (uma categoria presente nas 3 músicas)
        const cat = calcCategoriaDominanteComboStrong100(combo);
        if (!(cat && cat.intensidade === "strong" && cat.percentual === 100 && cat.categoria)) continue;

        const baseScore = scoreComboBase(a, b, c);
        const bonusArtBase = ajustarScorePorArtistas(combo, preferenciaArtistas);
        const bonusArt = bonusArtBase * (estrategia.key === "favoritas" ? 3 : 1);
        const finalScore = baseScore + bonusArt;

        if (!best || finalScore > best.finalScore) {
          best = { combo, cat, finalScore };
        }
      }
    }
  }

  if (!best) return null;

  // repertório: agrega badges (média dos 4 insights)
  const avg = (key) =>
    (best.combo[0].insights[key] + best.combo[1].insights[key] + best.combo[2].insights[key]) / 3;

  const seguranca = avg("seguranca");
  const familiaridade = avg("familiaridade");
  const desafio = avg("desafio");
  const renovacao = avg("renovacao");

  return {
    estrategiaKey: estrategia.key,
    titulo: estrategia.titulo,
    musicas: best.combo.map((x) => x.musica),
    categoria: best.cat,
    badges: {
      seguranca: scoreToLabel3(seguranca, "Muito Segura", "Moderada", "Arriscada"),
      familiaridade: scoreToLabel3(familiaridade, "Muito Familiar", "Familiar", "Pouco Familiar"),
      desafio: scoreToLabel3(desafio, "Baixo", "Moderado", "Alto"),
      renovacao: scoreToLabel3(renovacao, "Alta", "Moderada", "Baixa"),
    },
  };
}

const sugestoes
 = [];
  REPERTORIOS_ESTRATEGIAS.forEach((estrategia) => {
    const rep = montarRepertorio(estrategia);
    if (rep) sugestoes.push(rep);
  });

  return sugestoes;
}

function renderSugestoesRepertorioNoCard(parentEl, escala) {
  const sugestoes = gerarSugestoesRepertoriosParaEscala(escala);
  if (!sugestoes.length) {
    const msg = document.createElement("div");
    msg.className = "placeholder-text";
    msg.textContent = "Sem sugestões disponíveis para esta escala (regras muito restritivas).";
    parentEl.appendChild(msg);
    return;
  }

  const wrap = document.createElement("div");
  wrap.style.marginTop = "10px";

  const title = document.createElement("div");
  title.className = "escala-musicas-header";
  title.textContent = "Sugestões automáticas (use como base)";

  wrap.appendChild(title);

  sugestoes.forEach((rep) => {
    const repBox = document.createElement("div");
    repBox.style.padding = "10px";
    repBox.style.border = "1px solid rgba(255,255,255,0.08)";
    repBox.style.borderRadius = "12px";
    repBox.style.marginTop = "10px";

    const topRow = document.createElement("div");
    topRow.style.display = "flex";
    topRow.style.justifyContent = "space-between";
    topRow.style.gap = "10px";
    topRow.style.flexWrap = "wrap";
    topRow.style.alignItems = "center";

    const repTitle = document.createElement("div");
    repTitle.style.fontWeight = "700";
    repTitle.textContent = rep.titulo;

    const badges = document.createElement("div");
    badges.style.display = "flex";
    badges.style.gap = "6px";
    badges.style.flexWrap = "wrap";

    const makeBadge = (text) => {
      const b = document.createElement("span");
      b.style.fontSize = "12px";
      b.style.padding = "4px 8px";
      b.style.borderRadius = "999px";
      b.style.background = "rgba(255,255,255,0.08)";
      b.textContent = text;
      return b;
    };

badges.innerHTML = "";

// 🏷️ Categoria (primeiro)
const catInsight = criarCategoriaVisual(rep.categoria);
if (catInsight) badges.appendChild(catInsight);

// 🛡️ Segurança
badges.appendChild(
  criarInsightVisual({
    icon: "🛡️",
    label: "Segurança",
    nivelLabel: rep.badges.seguranca,
  })
);

// 👥 Familiaridade
badges.appendChild(
  criarInsightVisual({
    icon: "👥",
    label: "Familiaridade",
    nivelLabel: rep.badges.familiaridade,
  })
);

// 🔥 Desafio
badges.appendChild(
  criarInsightVisual({
    icon: "🔥",
    label: "Desafio",
    nivelLabel: rep.badges.desafio,
  })
);

// 🌱 Renovação
badges.appendChild(
  criarInsightVisual({
    icon: "🌱",
    label: "Renovação",
    nivelLabel: rep.badges.renovacao,
  })
);

    // if (rep.categoria && rep.categoria.categoria) {
    //   badges.appendChild(
    //     makeBadge(
    //       `🏷️ ${rep.categoria.categoria} (${rep.categoria.intensidade})`
    //     )
    //   );
    // }

    topRow.appendChild(repTitle);
    topRow.appendChild(badges);

    repBox.appendChild(topRow);

    const list = document.createElement("div");
    list.className = "escala-musicas-list";
    list.style.marginTop = "10px";

    rep.musicas.forEach((m) => {
      const card = criarSongCardEscalaFutura(m);
      if (card) list.appendChild(card);
    });

    repBox.appendChild(list);
    wrap.appendChild(repBox);
  });

  parentEl.appendChild(wrap);
}

function criarInsightVisual({ icon, label, nivelLabel }) {
  const wrap = document.createElement("div");
  wrap.className = "rep-insight";

  const iconEl = document.createElement("span");
  iconEl.className = "rep-insight-icon";
  iconEl.textContent = icon;

  const textEl = document.createElement("span");
  textEl.className = "rep-insight-label";
  textEl.textContent = label;

  const dot = document.createElement("span");
  dot.className = "rep-insight-dot";

  const dotClass = insightLabelToDotClass(nivelLabel);
  dot.classList.add(dotClass);

  wrap.append(iconEl, textEl, dot);
  return wrap;
}

function criarCategoriaVisual(categoriaInfo) {
  if (!categoriaInfo || !categoriaInfo.categoria) return null;

  const wrap = document.createElement("div");
  wrap.className = "rep-insight";

  const iconEl = document.createElement("span");
  iconEl.className = "rep-insight-icon";
  iconEl.textContent = "🏷️";

  const textEl = document.createElement("span");
  textEl.className = "rep-insight-label";
  textEl.textContent = categoriaInfo.categoria;

  const dot = document.createElement("span");
  dot.className = "rep-insight-dot";
  dot.classList.add(categoriaIntensidadeToDotClass(categoriaInfo.intensidade));

  wrap.append(iconEl, textEl, dot);
  return wrap;
}

function categoriaIntensidadeToDotClass(intensidade) {
  if (intensidade === "strong") return "dot-easy";
  if (intensidade === "medium") return "dot-medium";
  return "dot-hard";
}

function insightLabelToDotClass(label) {
  // Verde (situação boa)
  if (
    label === "Muito Segura" ||
    label === "Muito Familiar" ||
    label === "Alta" ||
    label === "Baixo"
  ) {
    return "dot-easy";
  }

  // Amarelo (intermediário)
  if (
    label === "Moderada" ||
    label === "Familiar" ||
    label === "Moderado"
  ) {
    return "dot-medium";
  }

  // Vermelho (exigente / crítica)
  return "dot-hard";
}


// ===== Helper: card de música (idêntico ao usado em Escalas Futuras) =====
function criarSongCardEscalaFutura(musica) {
  if (!musica) return null;

  const songCard = document.createElement("div");
  songCard.className = "song-card";

  const thumbWrapper = document.createElement("div");

  // ===== BADGE: POPULARIDADE =====
  const nivel = getNivelPopularidadeMusica(musica.id);

  const popBadge = document.createElement("div");
  popBadge.className = `song-overlay song-popularity-badge ${nivel}`;

  if (nivel === "classic") popBadge.innerHTML = "🏆 Clássica";
  else if (nivel === "rare") popBadge.innerHTML = "🕵️ Incomum";
  else popBadge.innerHTML = "🎧 Comum";

  thumbWrapper.appendChild(popBadge);

  // ===== BADGE: EXECUÇÕES =====
  const totalExec = getTotalExecucoes(musica.id);

  const execBadge = document.createElement("div");
  execBadge.className = "song-overlay song-exec-info";
  execBadge.innerHTML = totalExec > 0 ? `🎯 Tocada ${totalExec}x` : `✨ Nova`;

  thumbWrapper.appendChild(execBadge);

  // ===== BADGE: DIFICULDADE MÉDIA (TOP-RIGHT) =====
  const diffBadge = criarBadgeDificuldadeMediaMusica(musica);
  if (diffBadge) thumbWrapper.appendChild(diffBadge);

  thumbWrapper.className = "song-thumb-wrapper";

  const thumb = document.createElement("img");
  thumb.className = "song-thumb";
  thumb.src =
    musica._thumbUrl || `https://img.youtube.com/vi/${musica.referLink}/0.jpg`;
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
  artistAvatar.src =
    musica._artistImage || `artistas/${slugify(musica.artista)}.jpg`;
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

  return songCard;
}


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
  hoje.setHours(0, 0, 0, 0);

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

  // 👑 ids de quem escolhe o repertório nesse culto
  const headerIds = getHeaderIdsFromEscala(escala);

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

    // wrapper do avatar pra permitir overlay da coroa sem mexer no layout existente
    const avatarWrap = document.createElement("div");
    avatarWrap.className = "member-avatar-wrap";

    const isHeader = headerIds.includes(membro.id);
    if (isHeader) avatarWrap.classList.add("has-crown");

    const img = document.createElement("img");
    img.className = "member-avatar";
    img.src = `integrantes/${membro.nome.toLowerCase()}.jpeg`;
    img.onerror = function () {
      this.onerror = null;
      this.src = "integrantes/default.jpeg";
    };

    avatarWrap.appendChild(img);

    const info = document.createElement("div");

    const nome = document.createElement("div");
    nome.className = "member-name";
    nome.textContent = membro.nome || "Integrante";

    const papel = document.createElement("div");
    papel.className = "member-role";
    papel.textContent = formatFunctions(membro.function);

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

    // antes era: card.append(img, info);
    card.append(avatarWrap, info);

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

    // ===== BADGE: POPULARIDADE =====
    const nivel = getNivelPopularidadeMusica(musica.id);

    const popBadge = document.createElement("div");
    popBadge.className = `song-overlay song-popularity-badge ${nivel}`;

    if (nivel === "classic") popBadge.innerHTML = "🏆 Clássica";
    else if (nivel === "rare") popBadge.innerHTML = "🕵️ Incomum";
    else popBadge.innerHTML = "🎧 Comum";

    thumbWrapper.appendChild(popBadge);

    // ===== BADGE: EXECUÇÕES =====
    const totalExec = getTotalExecucoes(musica.id);

    const execBadge = document.createElement("div");
    execBadge.className = "song-overlay song-exec-info";
    execBadge.innerHTML = totalExec > 0 ? `🎯 Tocada ${totalExec}x` : `✨ Nova`;

    thumbWrapper.appendChild(execBadge);

  // ===== BADGE: DIFICULDADE MÉDIA (TOP-RIGHT) =====
  const diffBadge = criarBadgeDificuldadeMediaMusica(musica);
  if (diffBadge) thumbWrapper.appendChild(diffBadge);

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
  hoje.setHours(0, 0, 0, 0);

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
    title.textContent = "📆 " + formatarData(escala.dataObj);

    left.append(title);

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

    // 👑 quem escolhe repertório nesta escala
    const headerIds = getHeaderIdsFromEscala(escala);

    ids.forEach((id) => {
      const membro =
        (typeof id === "object" ? id : integrantes.find((i) => i.id === id)) ||
        null;
      if (!membro) return;

      const chip = document.createElement("div");
      chip.className = "escala-integrante-chip";

      // === wrapper para permitir a coroa sobre o avatar ===
      const avatarWrap = document.createElement("div");
      avatarWrap.className = "escala-integrante-avatar-wrap";

      const isHeader = headerIds.includes(membro.id);
      if (isHeader) avatarWrap.classList.add("has-crown");

      const avatar = document.createElement("img");
      avatar.className = "escala-integrante-avatar";
      const slug = slugify(membro.nome || "");
      avatar.src = `integrantes/${membro.nome.toLowerCase()}.jpeg`;
      avatar.onerror = function () {
        this.onerror = null;
        this.src = "integrantes/default.jpeg";
      };

      avatarWrap.appendChild(avatar);

      const nome = document.createElement("span");
      nome.className = "escala-integrante-nome";
      nome.textContent = membro.nome || "Integrante";

      // antes: chip.append(avatar, nome);
      chip.append(avatarWrap, nome);
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

    // Se não há repertório definido, mostra sugestões automáticas (não persiste nada)
    if (!musicIds.length) {
      renderSugestoesRepertorioNoCard(musicSec, escala);
    }

    musicIds.forEach((id) => {

      const musica = musicas.find((m) => m.id === id);
      if (!musica) return;

      const songCard = document.createElement("div");
      songCard.className = "song-card";

      const thumbWrapper = document.createElement("div");

      // ===== BADGE: POPULARIDADE =====
      const nivel = getNivelPopularidadeMusica(musica.id);

      const popBadge = document.createElement("div");
      popBadge.className = `song-overlay song-popularity-badge ${nivel}`;

      if (nivel === "classic") popBadge.innerHTML = "🏆 Clássica";
      else if (nivel === "rare") popBadge.innerHTML = "🕵️ Incomum";
      else popBadge.innerHTML = "🎧 Comum";

      thumbWrapper.appendChild(popBadge);

      // ===== BADGE: EXECUÇÕES =====
      const totalExec = getTotalExecucoes(musica.id);

      const execBadge = document.createElement("div");
      execBadge.className = "song-overlay song-exec-info";
      execBadge.innerHTML =
        totalExec > 0 ? `🎯 Tocada ${totalExec}x` : `✨ Nova`;

      thumbWrapper.appendChild(execBadge);

  // ===== BADGE: DIFICULDADE MÉDIA (TOP-RIGHT) =====
  const diffBadge = criarBadgeDificuldadeMediaMusica(musica);
  if (diffBadge) thumbWrapper.appendChild(diffBadge);

      thumbWrapper.className = "song-thumb-wrapper";

      const thumb = document.createElement("img");
      thumb.className = "song-thumb";
      thumb.src =
        musica._thumbUrl ||
        `https://img.youtube.com/vi/${musica.referLink}/0.jpg`;
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
      artistAvatar.src =
        musica._artistImage || `artistas/${slugify(musica.artista)}.jpg`;
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
  const cats = calcularIntensidadeCategorias(escala).filter(
    (c) => c.percentual >= 60
  );

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

  let texto = "";

  // =========================
  // CABEÇALHO
  // =========================
  texto += `📅 *Escala do dia*\n`;
  texto += `_${formatarData(escala.dataObj)}_\n`;

  if (catDom?.categoria) {
    texto += `\n${corDominancia(catDom.intensidade)} *Categoria predominante*\n`;
    texto += `• ${catDom.categoria} (${catDom.percentual.toFixed(0)}%)\n`;
  }

  if (stats?.dificuldadeGeralNivel) {
    texto += `\n${corPorNivel(
      stats.dificuldadeGeralNivel
    )} *Dificuldade média*\n`;
    texto += `• ${nivelLabel(stats.dificuldadeGeralNivel)}\n`;
  }

  // =========================
  // CATEGORIAS
  // =========================
  if (cats.length) {
    texto += `\n🏷️ *Categorias do repertório*\n`;
    cats.forEach((c) => {
      texto += `• ${corDominancia(c.intensidade)} ${c.categoria} (${c.percentual.toFixed(
        0
      )}%)\n`;
    });
  }

  // =========================
  // INTEGRANTES
  // =========================
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

    texto += `• *${nome}* — ${func}\n`;
  });

  // =========================
  // MÚSICAS
  // =========================
  texto += `\n🎧 *Músicas*\n`;

  const ids = Array.isArray(escala.musicas) ? escala.musicas : [];
  ids.forEach((id, idx) => {
    const musica = musicas.find((m) => m.id === id);
    if (!musica) return;

    const yt = musica.referLink
      ? `https://www.youtube.com/watch?v=${musica.referLink}`
      : "";

    const catsMus =
      typeof musica.categorias === "string"
        ? musica.categorias
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const diffs = Object.entries(musica.level || {})
      .filter(([, v]) => v)
      .map(([inst, v]) => `${corPorNivel(v)} ${inst}`)
      .join(" · ");

    texto += `\n${idx + 1}. *${musica.titulo}* — ${musica.artista}\n`;
    if (yt) texto += `🔗 ${yt}\n`;
    if (catsMus.length)
      texto += `🏷️ ${catsMus.join(" · ")}\n`;
    if (diffs) texto += `🎚️ ${diffs}\n`;
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
      status === "recent" || status === "future" ? diasParaLiberar(m.id) : null;

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

    // ===== BADGE DE POPULARIDADE =====
    const nivel = getNivelPopularidadeMusica(musica.id);

    const badge = document.createElement("div");
    badge.className = `song-overlay song-popularity-badge ${nivel}`;

    if (nivel === "classic") badge.innerHTML = "🏆 Clássica";
    else if (nivel === "rare") badge.innerHTML = "🕵️ Incomum";
    else badge.innerHTML = "🎧 Comum";

    thumbWrapper.appendChild(badge);

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

  // ===== BADGE: DIFICULDADE MÉDIA (TOP-RIGHT) =====
  const diffBadge = criarBadgeDificuldadeMediaMusica(musica);
  if (diffBadge) thumbWrapper.appendChild(diffBadge);

    // Ribbon status
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

function renderMusicaEscalaFutura(musica) {
  if (!musica) return '';

  // --- Dificuldade média ---
  let dificuldadeMedia = null;
  if (musica.level != null && !isNaN(Number(musica.level))) {
    dificuldadeMedia = Math.round(Number(musica.level) * 10) / 10;
  }

  return `
    <div class="escala-musica-card" style="position: relative;">

      ${
        dificuldadeMedia !== null
          ? `<div class="badge-dificuldade">${dificuldadeMedia}</div>`
          : ''
      }

      <!-- Conteúdo EXISTENTE do card (inalterado) -->
      <div class="musica-info">
        <div class="musica-titulo">${musica.titulo}</div>
        <div class="musica-artista">${musica.artista}</div>
      </div>

      <div class="musica-meta">
        <span class="musica-popularidade">
          ${musica.popularidade ?? 0}
        </span>
        <span class="musica-execucoes">
          ${musica.execucoes ?? 0}
        </span>
      </div>

    </div>
  `;
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
  const nivel = media < 1.5 ? "easy" : media < 2.5 ? "medium" : "hard";

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

  // Badge: dificuldade média (top-right)
  const diffBadge = criarBadgeDificuldadeMediaMusica(musica);
  if (diffBadge) wrapper.appendChild(diffBadge);

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

  const hoje = getHojeZerado();
  let total = 0;

  historico.forEach((culto) => {
    if (!culto.data || !Array.isArray(culto.musicas)) return;

    const dataCulto = parseDate(culto.data);
    if (!dataCulto || dataCulto >= hoje) return; // ignora hoje e futuro

    culto.musicas.forEach((id) => {
      if (id === idMusica) total++;
    });
  });

  return total;
}

function getHojeZerado() {
  const h = new Date();
  h.setHours(0, 0, 0, 0);
  return h;
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

function getHeaderIdsFromEscala(escala) {
  // tenta vários nomes possíveis de campo, mas o principal é "header"
  const raw =
    escala?.header ??
    escala?.headers ??
    escala?.escolhedores ??
    escala?.escolhedor ??
    escala?.choosers ??
    escala?.chooser ??
    null;

  if (!raw) return [];

  const normalizeId = (x) => {
    if (x == null) return null;
    if (typeof x === "object") {
      const v = x.id ?? x.integranteId ?? x.memberId ?? null;
      return v == null ? null : v;
    }
    // se vier string numérica, converte
    if (typeof x === "string") {
      const s = x.trim();
      if (!s) return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : s;
    }
    return x; // number, etc
  };

  if (Array.isArray(raw)) {
    return raw.map(normalizeId).filter((v) => v != null);
  }

  if (typeof raw === "string") {
    return raw
      .split(/[;,]/g)
      .map((s) => normalizeId(s))
      .filter((v) => v != null);
  }

  const one = normalizeId(raw);
  return one != null ? [one] : [];
}

function formatFunctions(functions) {
  if (!functions) return "";

  // se já for string
  if (typeof functions === "string") return functions;

  // formato comum: [{ bateria: "medium" }, { vocal: "easy" }]
  if (Array.isArray(functions)) {
    return functions
      .map((obj) => Object.keys(obj)[0])
      .map((inst) => formatInstrumentName(inst))
      .join(", ");
  }

  return "";
}

// =========================================================
// CLASSIFICAÇÃO DE MÚSICAS POR POPULARIDADE (DISTRIBUIÇÃO)
// =========================================================

function getNivelPopularidadeMusica(idMusica) {
  if (!CACHE_POPULARIDADE) {
    CACHE_POPULARIDADE = classificarNiveisDePopularidade(musicas);
  }
  return CACHE_POPULARIDADE[idMusica]?.nivel || "common";
}

function classificarNiveisDePopularidade(musicas) {
  if (!Array.isArray(musicas) || !musicas.length) return {};

  const getCats = (m) => {
    if (!m?.categorias) return [];
    return m.categorias
      .toString()
      .replaceAll(",", ";")
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean);
  };

  // 1) Base
  const lista = musicas.map((m) => ({
    id: m.id,
    exec: getTotalExecucoes(m.id),
    titulo: m.titulo || "",
    cats: getCats(m),
  }));

  // 2) Popularidade das categorias (via execuções das músicas)
  const catCount = new Map();
  lista.forEach((item) => {
    item.cats.forEach((c) => {
      catCount.set(c, (catCount.get(c) || 0) + item.exec);
    });
  });

  // 3) Score por música
  lista.forEach((item) => {
    item.catScore = item.cats.reduce((s, c) => s + (catCount.get(c) || 0), 0);
  });

  // 4) Ordenação
  lista.sort((a, b) => {
    if (b.exec !== a.exec) return b.exec - a.exec;
    if (b.catScore !== a.catScore) return b.catScore - a.catScore;
    return a.titulo.localeCompare(b.titulo);
  });

  const total = lista.length || 1;
  const mapa = {};

  lista.forEach((item, index) => {
    const perc = index / total;

    let nivel;
    if (perc <= 0.15) nivel = "classic";
    else if (perc <= 0.6) nivel = "common";
    else nivel = "rare";

    mapa[item.id] = {
      nivel,
      exec: item.exec,
      rank: index + 1,
      percentil: perc,
    };
  });

  return mapa;
}

// =========================================================
// FIM DO ARQUIVO
// =========================================================