// ---------------------------
// Carregamento dos dados
// ---------------------------

let MUSICAS_RAW = [];
let INTEGRANTES_RAW = [];
let HISTORICO_RAW = [];
let HISTORICO = [];
let MUSIC_BY_ID = new Map();
let MEMBER_BY_ID = new Map();
let CACHE_POPULARIDADE_WRAPPED = null;
let HISTORICO_FILTRADO = [];

const TITLE_CATEGORIES = {
  repertorio: { label: "Repertório", icon: "🎼" },
  presenca: { label: "Presença", icon: "📅" },
  perfil: { label: "Perfil", icon: "🧠" },
  banda: { label: "Banda", icon: "🤝" },
  diversidade: { label: "Diversidade", icon: "🎧" },
  tecnica: { label: "Técnica", icon: "🎸" },
  curadoria: { label: "Curadoria", icon: "🎚️" },
  popularidade: { label: "Popularidade", icon: "📊" },
};

const TITLES = [
  {
    id: "onipresente-repertorio",
    categoria: "repertorio",
    nome: "Onipresente do Repertório",
    descricao:
      "“Essa música? Já tocou. Aquela também.” — Maior (%) do repertório tocado.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankBy(stats, (s) => s.repertorioPct).map((x) => ({
        ...x,
        value: pct(x.value),
      }));
    },
  },
  {
    id: "participacao-especial-repertorio",
    categoria: "repertorio",
    nome: "Diamante Bruto",
    descricao:
      "“Os que ainda estão sendo trabalhados à perfeição.” — Menor (%) do repertório tocado.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankByAsc(stats, (s) => s.repertorioPct).map((x) => ({
        ...x,
        value: pct(x.value),
      }));
    },
  },
  {
    id: "avesso-a-zona-de-conforto",
    categoria: "tecnica",
    nome: "Avesso à Zona de Conforto",
    descricao:
      "Maior (%) das músicas que escolheu são difíceis (pela dificuldade média da música).",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankBy(stats, (s) => s.chosenDiffPct.hard).map((x) => ({
        ...x,
        value: pct(x.value),
      }));
    },
  },
  {
    id: "modo-hardcore",
    categoria: "tecnica",
    nome: "O Diplomata do Groove",
    descricao:
      "“Se tem acorde estranho, contratempo e melisma, é essa que ele quer tocar.” — Maior (%) das músicas que tocou é considerada como tendo um nível difícil.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankBy(stats, (s) => s.diffPct.hard).map((x) => ({
        ...x,
        value: pct(x.value),
      }));
    },
  },
  {
    id: "equilibrador-de-repertorio",
    categoria: "tecnica",
    nome: "Equilibrador de Repertório",
    descricao:
      "Maior (%) das músicas que escolheu são médias (pela dificuldade média da música).",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankBy(stats, (s) => s.chosenDiffPct.medium).map((x) => ({
        ...x,
        value: pct(x.value),
      }));
    },
  },
  {
    id: "zona-de-conforto-tecnica",
    categoria: "tecnica",
    nome: "Zona de Conforto",
    descricao:
      "“Nem fácil demais, nem impossível.” — Maior (%) das músicas que tocou é considerada como tendo um nível médio.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankBy(stats, (s) => s.diffPct.medium).map((x) => ({
        ...x,
        value: pct(x.value),
      }));
    },
  },
  {
    id: "curador-do-conforto",
    categoria: "tecnica",
    nome: "Curador do Conforto",
    descricao:
      "Maior (%) das músicas que escolheu são fáceis (pela dificuldade média da música).",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankBy(stats, (s) => s.chosenDiffPct.easy).map((x) => ({
        ...x,
        value: pct(x.value),
      }));
    },
  },
  {
    id: "climinha-worship",
    categoria: "tecnica",
    nome: "Climinha Worship",
    descricao:
      "“Quando começa o acorde aberto e o PAD, ele já está pronto.” — Maior (%) das músicas que tocou é considerada como tendo um nível fácil.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankBy(stats, (s) => s.diffPct.easy).map((x) => ({
        ...x,
        value: pct(x.value),
      }));
    },
  },

  // =======================

  // =======================
  // CURADORIA (DIFICULDADE MÉDIA DAS MÚSICAS)
  // =======================

  // CURADORIA (QUANTIDADE)
  // =======================
  {
    id: "dj-do-culto",
    categoria: "repertorio",
    nome: "O DJ do Culto",
    descricao:
      "“Se a playlist tá boa (ou ruim), já sabemos quem foi.” — Foi o cabeça de repertório em mais cultos.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankByChosenDaysOnly(stats, (s) => s.chosenDaysCount);
    },
  },
  {
    id: "deixa-com-eles",
    categoria: "repertorio",
    nome: "Deixa com Eles",
    descricao:
      "“Confia no Espírito… e nas escolhas da galera.” — Foi o cabeça de repertório em menos cultos.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankByAscChosenDaysOnly(stats, (s) => s.chosenDaysCount);
    },
  },

  // =======================
  // BANDA (DINÂMICA)
  // =======================
  {
    id: "camaleao-da-banda",
    categoria: "diversidade",
    nome: "Camaleão da Banda",
    descricao:
      "“Se adapta a qualquer formação.” — Tocou com o maior número de formações diferentes.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankBy(stats, (s) => s.formationsCount);
    },
  },
  {
    id: "panelinha-fiel",
    categoria: "diversidade",
    nome: "Panelinha Fiel",
    descricao:
      "“Sempre com os mesmos parceiros.” — Tocou com o menor número de formações diferentes.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankByAsc(stats, (s) => s.formationsCount);
    },
  },

  // =======================
  // CURADORIA (REPETIÇÃO vs VARIEDADE)
  // =======================
  {
    id: "anti-repeticao",
    categoria: "diversidade",
    nome: "Replay OFF",
    descricao:
      "Replay? Só se for MUITO bom.” — Maior (%) de músicas diferentes dentre as escolhidas.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankByChosenOnly(stats, (s) => s.chosenSongsUniquePct).map(
        (x) => ({ ...x, value: pct(x.value) })
      );
    },
  },
  {
    id: "classicos-nunca-morrem",
    categoria: "diversidade",
    nome: "Replay ON",
    descricao:
      "“Time que tá ganhando não se mexe.” — Menor % de músicas diferentes dentre as escolhidas.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankByAscChosenOnly(stats, (s) => s.chosenSongsUniquePct).map(
        (x) => ({ ...x, value: pct(x.value) })
      );
    },
  },

  {
    id: "pioneiro-do-repertorio",
    categoria: "repertorio",
    nome: "Desbravador de Refrão",
    descricao:
      "“Alguém tinha que cantar primeiro.” — Aquele que, por mais vezes, escolheu primeiro uma música nova no repertório.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankBy(
        stats,
        (s) => s.inauguratedSongsCount,
        10,
        (s) => s.inauguratedSongsCount > 0
      );
    },
  },
  {
    id: "chega-depois",
    categoria: "repertorio",
    nome: "Só Depois Que Virou Hino",
    descricao:
      "“Prefere quando já tá todo mundo cantando.” — Aquele que, por menos vezes, escolheu primeiro uma música nova no repertório.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankByAsc(
        stats,
        (s) => s.inauguratedSongsCount,
        10,
        (s) => s.inauguratedSongsCount > 0
      );
    },
  },

  {
    id: "curador-ecletico",
    categoria: "diversidade",
    nome: "O Eclético",
    descricao:
      "“Uma hora é Rock, outra hora é Pop.” — Maior (%) de artistas diferentes escolhidos dentre os disponíveis no repertório.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankBy(
        stats,
        (s) => s.chosenArtistsCatalogPct,
        10,
        (s) => (s.chosenDaysCount || 0) > 0
      ).map((x) => ({
        ...x,
        value: `${pct(x.value)}%`,
      }));
    },
  },
  {
    id: "sempre-os-mesmos",
    categoria: "diversidade",
    nome: "O Tradicional",
    descricao:
      "“Achou os artistas favoritos e nunca mais largou.” — Menor (%) de artistas diferentes escolhidos dentre os disponíveis no repertório.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankByAsc(
        stats,
        (s) => s.chosenArtistsCatalogPct,
        10,
        (s) => (s.chosenDaysCount || 0) > 0
      ).map((x) => ({
        ...x,
        value: `${pct(x.value)}%`,
      }));
    },
  },

  // =======================
  // POPULARIDADE (TOCOU EM %)
  // =======================
  {
    id: "guardiao-dos-classicos",
    categoria: "popularidade",
    nome: "O Museu dos Hits",
    descricao:
      "“Alguém precisa manter as favoritas vivas.” — Maior (%) de músicas clássicas entre as tocadas.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankBy(stats, (s) => s.popPct.classic).map((x) => ({
        ...x,
        value: pct(x.value),
      }));
    },
  },
  {
    id: "foge-dos-classicos",
    categoria: "popularidade",
    nome: "Foge dos Clássicos",
    descricao:
      "“Mas essa aí todo mundo já enjoou …” — Menor (%) de músicas clássicas entre as tocadas.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankByAsc(stats, (s) => s.popPct.classic).map((x) => ({
        ...x,
        value: pct(x.value),
      }));
    },
  },
  {
    id: "zona-popular",
    categoria: "popularidade",
    nome: "Zona Popular",
    descricao:
      "“Nem hit, nem esquecida.” — Maior (%) de músicas comuns entre as tocadas.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankBy(stats, (s) => s.popPct.common).map((x) => ({
        ...x,
        value: pct(x.value),
      }));
    },
  },
  {
    id: "sempre-fora-da-curva",
    categoria: "popularidade",
    nome: "Sempre Fora da Curva",
    descricao:
      "“Difícil cair no padrão.” — Menor (%) de músicas comuns entre as tocadas.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankByAsc(stats, (s) => s.popPct.common).map((x) => ({
        ...x,
        value: pct(x.value),
      }));
    },
  },
  {
    id: "explorador-das-incomuns",
    categoria: "popularidade",
    nome: "Explorador das Incomuns",
    descricao:
      "“Quando ninguém conhece, ele conhece.” — Maior (%) de músicas incomuns entre as tocadas.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankBy(stats, (s) => s.popPct.rare).map((x) => ({
        ...x,
        value: pct(x.value),
      }));
    },
  },
  {
    id: "avesso-ao-inedito",
    categoria: "popularidade",
    nome: "Avesso ao Inédito",
    descricao:
      "“Prefere o que já foi testado.” — Menor (%) de músicas incomuns entre as tocadas.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankByAsc(stats, (s) => s.popPct.rare).map((x) => ({
        ...x,
        value: pct(x.value),
      }));
    },
  },

  // =======================
  // CURADORIA (INTENÇÃO) — enxuto (4 títulos)
  // =======================

  {
    id: "guardiao-da-tradicao",
    categoria: "curadoria",
    nome: "Guardião da Tradição",
    descricao:
      "“Mantendo a essência viva.” — Maior (%) de músicas clássicas entre as escolhidas.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      const pop = computePopularidadeCatalog?.();
      const arr = [];
      stats.forEach((s) => {
        const total = s.chosenSongsCount || 0;
        if (!total) return;
        let classic = 0;
        s.chosenSongsSet.forEach((mid) => {
          const tier = pop?.get ? pop.get(mid)?.tier || "common" : "common";
          if (tier === "classic") classic += 1;
        });
        arr.push({ memberId: s.memberId, value: classic / total });
      });
      arr.sort((a, b) => b.value - a.value);
      return arr.slice(0, 10).map((x) => ({ ...x, value: pct(x.value) }));
    },
  },
  {
    id: "sempre-em-busca-do-novo",
    categoria: "curadoria",
    nome: "Sempre em Busca do Novo",
    descricao:
      "“Se for pra repetir, melhor nem tocar!” — Menor (%) de músicas clássicas entre as escolhidas.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      const pop = computePopularidadeCatalog?.();
      const arr = [];
      stats.forEach((s) => {
        const total = s.chosenSongsCount || 0;
        if (!total) return;
        let classic = 0;
        s.chosenSongsSet.forEach((mid) => {
          const tier = pop?.get ? pop.get(mid)?.tier || "common" : "common";
          if (tier === "classic") classic += 1;
        });
        arr.push({ memberId: s.memberId, value: classic / total });
      });
      arr.sort((a, b) => a.value - b.value);
      return arr.slice(0, 10).map((x) => ({ ...x, value: pct(x.value) }));
    },
  },

  {
    id: "escolhe-o-seguro",
    categoria: "curadoria",
    nome: "Escolhe o Seguro",
    descricao:
      "“Essa todo mundo já canta mesmo ...” — Maior (%) de músicas comuns entre as escolhidas.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      const pop = computePopularidadeCatalog?.();
      const arr = [];
      stats.forEach((s) => {
        const total = s.chosenSongsCount || 0;
        if (!total) return;
        let common = 0;
        s.chosenSongsSet.forEach((mid) => {
          const tier = pop?.get ? pop.get(mid)?.tier || "common" : "common";
          if (tier === "common") common += 1;
        });
        arr.push({ memberId: s.memberId, value: common / total });
      });
      arr.sort((a, b) => b.value - a.value);
      return arr.slice(0, 10).map((x) => ({ ...x, value: pct(x.value) }));
    },
  },
  {
    id: "fugindo-do-obvio",
    categoria: "curadoria",
    nome: "Fugindo do Óbvio",
    descricao:
      "“Bora sair do básico.” — Menor (%) de músicas comuns entre as escolhidas.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      const pop = computePopularidadeCatalog?.();
      const arr = [];
      stats.forEach((s) => {
        const total = s.chosenSongsCount || 0;
        if (!total) return;
        let common = 0;
        s.chosenSongsSet.forEach((mid) => {
          const tier = pop?.get ? pop.get(mid)?.tier || "common" : "common";
          if (tier === "common") common += 1;
        });
        arr.push({ memberId: s.memberId, value: common / total });
      });
      arr.sort((a, b) => a.value - b.value);
      return arr.slice(0, 10).map((x) => ({ ...x, value: pct(x.value) }));
    },
  },

  {
    id: "aposta-arriscada",
    categoria: "curadoria",
    nome: "Aposta Arriscada",
    descricao:
      "“Nem sempre dá certo… mas quando dá!” — Maior (%) de músicas incomuns entre as escolhidas.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      // percentual de incomuns dentro das escolhidas
      const pop = computePopularidadeCatalog?.();
      const arr = [];
      stats.forEach((s) => {
        const total = s.chosenSongsCount || 0;
        if (!total) return;
        let rare = 0;
        s.chosenSongsSet.forEach((mid) => {
          const tier = pop?.get ? pop.get(mid)?.tier || "common" : "common";
          if (tier === "secret") rare += 1;
        });
        arr.push({ memberId: s.memberId, value: rare / total });
      });
      arr.sort((a, b) => b.value - a.value);
      return arr.slice(0, 10).map((x) => ({ ...x, value: pct(x.value) }));
    },
  },
  {
    id: "jogando-seguro",
    categoria: "curadoria",
    nome: "Jogando Seguro",
    descricao:
      "“Prefere garantir que todo mundo cante.” — Menor (%) de músicas incomuns entre as escolhidas.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      const pop = computePopularidadeCatalog?.();
      const arr = [];
      stats.forEach((s) => {
        const total = s.chosenSongsCount || 0;
        if (!total) return;
        let rare = 0;
        s.chosenSongsSet.forEach((mid) => {
          const tier = pop?.get ? pop.get(mid)?.tier || "common" : "common";
          if (tier === "secret") rare += 1;
        });
        arr.push({ memberId: s.memberId, value: rare / total });
      });
      arr.sort((a, b) => a.value - b.value);
      return arr.slice(0, 10).map((x) => ({ ...x, value: pct(x.value) }));
    },
  },

  // =======================
  // PRESENÇA
  // =======================
  {
    id: "figura-carimbada",
    categoria: "presenca",
    nome: "Figurinha Carimbada",
    descricao:
      "“Se tem culto, ele tá lá.” — São os que tocam na maior quantidade de cultos.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankBy(stats, (s) => s.cultos);
    },
  },
  {
    id: "aparicao-especial",
    categoria: "presenca",
    nome: "Visita Ilustre",
    descricao:
      "“Poucas aparições, mas memoráveis.” — São os que tocam na menor quantidade de cultos.",
    ranking: () => {
      const stats = computeMemberStats(HISTORICO);
      return rankByAsc(stats, (s) => s.cultos);
    },
  },

  // =======================
  // PERFIL (CATEGORIAS) — Especialista & Versátil
  // =======================
  // {
  //   id: "especialista",
  //   categoria: "perfil",
  //   nome: "Especialista",
  //   descricao:
  //     "“Quando encontra um estilo, vai até o fim.” — Maior concentração em uma única categoria (nas tocadas).",
  //   ranking: () => {
  //     const stats = computeMemberStats(HISTORICO);
  //     return rankBy(stats, (s) => s.categoryMaxShare).map((x) => ({
  //       ...x,
  //       value: pct(x.value),
  //     }));
  //   },
  // },
  // {
  //   id: "versatil",
  //   categoria: "perfil",
  //   nome: "Versátil",
  //   descricao:
  //     "“Transita bem por qualquer clima.” — Maior versatilidade (categorias mais equilibradas nas tocadas).",
  //   ranking: () => {
  //     const stats = computeMemberStats(HISTORICO);
  //     return rankBy(stats, (s) => s.versatility).map((x) => ({
  //       ...x,
  //       value: pct(x.value),
  //     }));
  //   },
  // },

  // =======================
  // PRESENÇA/REGULARIDADE — Maratonista (streak)
  // =======================

  // {
  //   id: "maratonista",
  //   categoria: "presenca",
  //   nome: "Maratonista",
  //   descricao:
  //     "“Uma verdadeira jornada musical.” — Os que tem a maior sequência de cultos seguidos tocando.",
  //   ranking: () => {
  //     const streak = computeLongestStreak(HISTORICO);
  //     return streak.slice(0, 10);
  //   },
  // },
];

function aplicarFiltroDeDatas() {
  const startInput = document.getElementById("startDate")?.value;
  const endInput = document.getElementById("endDate")?.value;

  const start = startInput ? parseDateSafe(startInput) : null;
  const end = endInput ? parseDateSafe(endInput) : null;

  HISTORICO_FILTRADO = HISTORICO.filter((ev) => {
    const d = parseDateSafe(ev.data);
    if (!d) return false;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

function setFiltroAnoAtual() {
  const year = new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const startEl = document.getElementById("startDate");
  const endEl = document.getElementById("endDate");

  if (startEl) startEl.value = start;
  if (endEl) endEl.value = end;
}

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

// ===============================
// PATCH (wrapped.js)
// 1) ADICIONE este bloco LOGO APÓS a função artistImg(...)
// ===============================

// ---------------------------
// Popularidade (Clássico / Comum / Secreto)
// ---------------------------

function computePopularidadeCatalog() {
  if (CACHE_POPULARIDADE_WRAPPED) return CACHE_POPULARIDADE_WRAPPED;

  const getCats = (m) => {
    if (!m?.categorias) return [];
    return m.categorias
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean);
  };

  // 1) Execuções por música
  const counts = new Map();
  MUSICAS_RAW.forEach((m) => counts.set(m.id, 0));

  HISTORICO.forEach((ev) => {
    ev.musicas?.forEach((mid) => {
      counts.set(mid, (counts.get(mid) || 0) + 1);
    });
  });

  // 2) Popularidade das categorias
  const catCount = new Map();
  HISTORICO.forEach((ev) => {
    ev.musicas?.forEach((mid) => {
      const m = MUSIC_BY_ID.get(mid);
      if (!m) return;
      getCats(m).forEach((cat) => {
        catCount.set(cat, (catCount.get(cat) || 0) + 1);
      });
    });
  });

  // 3) Ranking
  const ranked = Array.from(counts.entries());

  ranked.sort((a, b) => {
    const execA = a[1];
    const execB = b[1];
    if (execB !== execA) return execB - execA;

    const ma = MUSIC_BY_ID.get(a[0]);
    const mb = MUSIC_BY_ID.get(b[0]);

    const scoreA = getCats(ma).reduce((s, c) => s + (catCount.get(c) || 0), 0);
    const scoreB = getCats(mb).reduce((s, c) => s + (catCount.get(c) || 0), 0);

    if (scoreB !== scoreA) return scoreB - scoreA;
    return (ma?.titulo || "").localeCompare(mb?.titulo || "");
  });

  const n = ranked.length || 1;
  const topCut = Math.max(1, Math.ceil(n * 0.15));
  const midCut = Math.max(topCut + 1, Math.ceil(n * 0.6));

  const out = new Map();

  ranked.forEach(([mid], idx) => {
    let tier = "common";
    let icon = "🎧";
    let label = "Comum";

    if (idx < topCut) {
      tier = "classic";
      icon = "🏆";
      label = "Clássico";
    } else if (idx >= midCut) {
      tier = "secret";
      icon = "🕵️";
      label = "Secreto";
    }

    out.set(mid, { tier, icon, label });
  });

  CACHE_POPULARIDADE_WRAPPED = out;
  return out;
}

function getPopularidadeIcon(musicId) {
  const map = computePopularidadeCatalog();
  const info = map.get(musicId);
  if (!info) return "";
  return `<span class="pop-icon" title="${info.label}">${info.icon}</span>`;
}

function formatCountPill(text) {
  return `<span class="count-pill"><span class="count-pill-icon">🎯</span>${text}</span>`;
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
  if (!member) return null;

  const raw =
    member.instrumento ||
    (Array.isArray(member.instrumentos) ? member.instrumentos[0] : null);

  if (!raw) return null;

  return raw
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos
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

// ===============================
// PATCH (wrapped.js)
// 2) SUBSTITUA a função renderBandSection(...) INTEIRA por esta
// ===============================

function renderBandSection(events) {
  const insights = computeBandInsights(events);
  const root = document.getElementById("bandSection");
  root.innerHTML = "";

  function buildRankedMusicsList(items, emptyMsg, countLabelFn) {
    if (!items || items.length === 0) return `<p class="muted">${emptyMsg}</p>`;
    const html = items
      .slice(0, 10)
      .map((m, idx) => {
        const rankNum = idx + 1;
        const banBadge =
          m.musica && m.musica.ban
            ? '<span class="badge badge-ban">BANIDA</span>'
            : "";
        const thumb = m.musica
          ? `<a href="https://www.youtube.com/watch?v=${m.musica.referLink}" target="_blank">
              <img class="thumb thumb-md" src="https://img.youtube.com/vi/${m.musica.referLink}/0.jpg" alt="thumb">
            </a>`
          : "";
        const pop = m.musica ? getPopularidadeIcon(m.musica.id) : "";
        const title = m.musica ? m.musica.titulo : "ID " + m.id;
        const artist = m.musica ? m.musica.artista : "";
        return `
          <li class="top-track-item">
            <div class="top-track-left">
              <span class="rank rank-${rankNum}">#${rankNum}</span>
              ${thumb}
              <div class="track-info">
                <div class="track-title">${pop}${title} ${banBadge}</div>
                <div class="track-artist">${artist}</div>
              </div>
            </div>
            ${formatCountPill(countLabelFn(m, rankNum))}
          </li>
        `;
      })
      .join("");
    return `<ul class="list top-tracks">${html}</ul>`;
  }

  function buildRankedArtistsList(items, emptyMsg) {
    if (!items || items.length === 0) return `<p class="muted">${emptyMsg}</p>`;
    const html = items
      .slice(0, 10)
      .map((a, idx) => {
        const rankNum = idx + 1;
        const imgSrc = artistImg(a.name);
        return `
          <li class="artist-row">
            <div class="artist-row-main">
              <span class="rank rank-${rankNum}">#${rankNum}</span>
              <div class="artist-avatar artist-avatar-sm">
                <img src="${imgSrc}" alt="${
          a.name
        }" onerror="this.style.display='none';" />
              </div>
              <span class="artist-row-name">${a.name}</span>
            </div>
            ${formatCountPill(`${a.count}x`)}
          </li>
        `;
      })
      .join("");
    return `<ul class="list">${html}</ul>`;
  }

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

  // Top músicas + raridades (SEM “top 3” destacado separado)
  const topMusicsCard = createCard(
    "MÚSICAS MAIS TOCADAS",
    buildRankedMusicsList(
      insights.topMusics,
      "Nenhuma música no período.",
      (m) => `${m.count}x`
    )
  );

  const raridadesCard = createCard(
    "MÚSICAS MENOS TOCADAS",
    buildRankedMusicsList(
      insights.raridades,
      "Não há músicas Incomums no período.",
      (m) => `${m.count}x`
    )
  );

  const rowTracks = document.createElement("div");
  rowTracks.className = "band-row";
  rowTracks.appendChild(topMusicsCard);
  rowTracks.appendChild(raridadesCard);
  root.appendChild(rowTracks);

  // Artistas mais/menos (SEM “top 3” destacado separado)
  const artistasCard = createCard(
    "Artistas mais tocados",
    buildRankedArtistsList(insights.topArtists, "Nenhum artista no período.")
  );

  const leastArtistsCard = createCard(
    "Artistas menos tocados",
    buildRankedArtistsList(insights.leastArtists, "Nenhum artista cadastrado.")
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

// ===============================
// PATCH (wrapped.js)
// 3) SUBSTITUA a função renderMemberSection(...) INTEIRA por esta
// ===============================

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

  // Puxa métricas "do wrapped" (dificuldade, popularidade, repetição, curadoria, etc.)
  const statsMap = computeMemberStats(events);
  const st = statsMap.get(memberId);

  // helpers rápidos
  const fmtPct = (v) => `${Math.round((v || 0) * 100)}%`;
  const safePct100 = (n, d) => (d ? Math.round((n / d) * 100) : 0);

  const diffPct = st?.diffPct || { easy: 0, medium: 0, hard: 0 };
  const popPct = st?.popPct || { classic: 0, common: 0, rare: 0 };

  const hasCuradoria = (st?.chosenDaysCount || 0) > 0;
  const repeticaoPct = hasCuradoria
    ? Math.round((1 - (st.chosenSongsUniquePct || 0)) * 100)
    : 0;

  const dc = insights.difficultyCounts; // (contagens absolutas já existentes)

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

  header.innerHTML = `
    <div class="member-header-main">
      <div class="avatar avatar-lg">
        <img src="${imgSrc}" alt="${
    insights.member.nome
  }" onerror="this.style.visibility='hidden';" />
      </div>

      <div class="member-header-text">
        <h2>${insights.member.nome}</h2>

        <div class="member-summary-chips">
          <div class="chip">
            <span class="chip-ico">🥁</span>
            <span>${funcao}</span>
          </div>

          <div class="chip">
            <span class="chip-ico">📅</span>
            <span>${cultos} cultos • ${perc}%</span>
          </div>

          <div class="chip">
            <span class="chip-ico">🎵</span>
            <span>${execs} execuções</span>
          </div>

          <div class="chip">
            <span class="chip-ico">🎼</span>
            <span>${musDiff} únicas • ${musDiffPct}% do catálogo</span>
          </div>
        </div>

        <div class="member-miniwrap">
          <div class="miniwrap-block">
            <div class="miniwrap-title">🎸 Dificuldade</div>
            <div class="miniwrap-row">
              <span class="mini-ico">🟢</span><span>${fmtPct(
                diffPct.easy
              )}</span>
              <span class="mini-ico">🟡</span><span>${fmtPct(
                diffPct.medium
              )}</span>
              <span class="mini-ico">🔴</span><span>${fmtPct(
                diffPct.hard
              )}</span>
            </div>
          </div>

          <div class="miniwrap-block">
            <div class="miniwrap-title">📊 Popularidade</div>
            <div class="miniwrap-row">
              <span class="mini-ico">🏆</span><span>${fmtPct(
                popPct.classic
              )}</span>
              <span class="mini-ico">🎧</span><span>${fmtPct(
                popPct.common
              )}</span>
              <span class="mini-ico">🕵️</span><span>${fmtPct(
                popPct.rare
              )}</span>
            </div>
          </div>

          ${
            hasCuradoria
              ? `
          <div class="miniwrap-block">
            <div class="miniwrap-title">🎚️ Curadoria</div>
            <div class="miniwrap-row">
              <span class="mini-ico">🗓️</span><span>${st.chosenDaysCount} dias</span>
              <span class="mini-ico">🎯</span><span>${st.chosenSongsSet.size} únicas</span>
              <span class="mini-ico">🔁</span><span>${repeticaoPct}% repetição</span>
            </div>
          </div>
          `
              : `
          <div class="miniwrap-block">
            <div class="miniwrap-title">🎚️ Curadoria</div>
            <div class="miniwrap-row">
              <span class="muted">Sem escolhas de repertório no período</span>
            </div>
          </div>
          `
          }
        </div>

        <div class="member-header-footnote muted">
          🎵 ${dc.easy} fáceis • ${dc.medium} médias • ${dc.hard} difíceis
        </div>

      </div>
    </div>
  `;

  root.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "card-grid";

  // ✅ Agora: sem “top 1 destacado”; + ícone de popularidade ao lado do nome; + 🎯 no contador
  function buildMusicBlock(musics, emptyMsg, countLabelFn) {
    if (!musics || musics.length === 0)
      return `<p class="muted">${emptyMsg}</p>`;
    const html = musics
      .slice(0, 10)
      .map((m, idx) => {
        const rankNum = idx + 1;
        const thumb = m.musica
          ? `<a href="https://www.youtube.com/watch?v=${m.musica.referLink}" target="_blank">
              <img class="thumb thumb-md" src="https://img.youtube.com/vi/${m.musica.referLink}/0.jpg" alt="thumb">
            </a>`
          : "";
        const pop = m.musica ? getPopularidadeIcon(m.musica.id) : "";
        const title = m.musica ? m.musica.titulo : "ID " + m.id;
        const artist = m.musica ? m.musica.artista : "";
        return `
          <li class="top-track-item">
            <div class="top-track-left">
              <span class="rank rank-${rankNum}">#${rankNum}</span>
              ${thumb}
              <div class="track-info">
                <div class="track-title">${pop}${title}</div>
                <div class="track-artist">${artist}</div>
              </div>
            </div>
            ${formatCountPill(countLabelFn(m, rankNum))}
          </li>
        `;
      })
      .join("");
    return `<ul class="list top-tracks">${html}</ul>`;
  }

  function buildArtistBlock(artists, emptyMsg) {
    if (!artists || artists.length === 0)
      return `<p class="muted">${emptyMsg}</p>`;
    const html = artists
      .slice(0, 15)
      .map((a, idx) => {
        const rankNum = idx + 1;
        const imgSrcA = artistImg(a.name);
        return `
          <li class="artist-row">
            <div class="artist-row-main">
              <span class="rank rank-${rankNum}">#${rankNum}</span>
              <div class="artist-avatar artist-avatar-sm">
                <img src="${imgSrcA}" alt="${
          a.name
        }" onerror="this.style.display='none';" />
              </div>
              <span class="artist-row-name">${a.name}</span>
            </div>
            ${formatCountPill(`${a.count}x`)}
          </li>
        `;
      })
      .join("");
    return `<ul class="list">${html}</ul>`;
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
    (m) => `${m.count}x`
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
    (m) => `${m.count}x`
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

// =========================================================
// SLUGIFY (usado para imagens de integrantes)
// =========================================================
function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// ---------------------------
// Navegação entre visões
// ---------------------------
function setActiveView(view) {
  // Tabs (botões)
  document.querySelectorAll(".view-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  // Painéis (seções)
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.view === view);
  });

  // Render específico por view
  if (view === "titles") {
    renderTitles();
  }
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

  // Fonte única do período ativo (títulos + visões)
  HISTORICO_FILTRADO = events;

  renderBandSection(events);
  renderMemberSection(events);

  // Render de títulos deve respeitar o mesmo período filtrado
  renderTitles();
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
      setFiltroAnoAtual();

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

// =========================================================
// POPULARIDADE DAS MÚSICAS (WRAPPED)
// =========================================================

function classificarPopularidadeWrapped(musicas, historico) {
  if (!Array.isArray(musicas) || !Array.isArray(historico)) return {};

  // --- helpers ---
  const getCats = (m) => {
    if (!m?.categorias) return [];
    return m.categorias
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean);
  };

  const musicById = new Map(musicas.map((m) => [m.id, m]));

  // 1) Execuções por música
  const execMap = {};
  historico.forEach((h) => {
    h.musicas?.forEach((id) => {
      execMap[id] = (execMap[id] || 0) + 1;
    });
  });

  // 2) Popularidade das categorias (execuções totais)
  const catCount = new Map();
  historico.forEach((h) => {
    if (!Array.isArray(h.musicas)) return;
    h.musicas.forEach((mid) => {
      const m = musicById.get(mid);
      if (!m) return;
      getCats(m).forEach((cat) => {
        catCount.set(cat, (catCount.get(cat) || 0) + 1);
      });
    });
  });

  // 3) Lista base
  const lista = musicas.map((m) => {
    const cats = getCats(m);
    return {
      id: m.id,
      exec: execMap[m.id] || 0,
      catScore: cats.reduce((s, c) => s + (catCount.get(c) || 0), 0),
      titulo: m.titulo || "",
    };
  });

  // 4) Ordenação final
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

function getPopularidadeWrapped(idMusica) {
  if (!CACHE_POPULARIDADE_WRAPPED) {
    CACHE_POPULARIDADE_WRAPPED = classificarPopularidadeWrapped(
      musicas,
      historico
    );
  }
  return (
    CACHE_POPULARIDADE_WRAPPED[idMusica] || {
      nivel: "common",
      exec: 0,
    }
  );
}

// =========================
// Títulos e Badges
// =========================

function renderTitles() {
  const grid = document.getElementById("titlesGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const hist = HISTORICO_FILTRADO.length ? HISTORICO_FILTRADO : HISTORICO;

  // Garantir que todos os rankings que usam computeMemberStats(HISTORICO)
  // respeitem o período filtrado, sem precisar alterar cada título.
  const __HIST_ORIG = HISTORICO;
  HISTORICO = hist;

  try {
    // stats completos (não mexemos no compute)
    const stats = computeMemberStats(hist);

    // =========================
    // REGRA: só entra em títulos quem tem 1+ cultos
    // =========================
    const eligibleIds = new Set(
      Array.from(stats.values())
        .filter((s) => s.cultos >= 1)
        .map((s) => s.memberId)
    );

    // integrantes elegíveis para títulos
    const integrantes = INTEGRANTES_RAW.filter((i) => eligibleIds.has(i.id));

    // ordem fixa de categorias (agrupamento lógico)
    const CATEGORY_ORDER = [
      "presenca",
      "banda",
      "repertorio",
      "diversidade",
      "perfil",
      "tecnica",
      "curadoria",
      "popularidade",
    ];

    const catIndex = (c) => {
      const i = CATEGORY_ORDER.indexOf(c);
      return i === -1 ? 999 : i;
    };

    const sortedTitles = [...TITLES].sort((a, b) => {
      const da = catIndex(a.categoria);
      const db = catIndex(b.categoria);
      if (da !== db) return da - db;
      return 0;
    });

    sortedTitles.forEach((title) => {
      const rankingData =
        typeof title.ranking === "function" ? title.ranking() : title.ranking;

      if (!Array.isArray(rankingData)) return;

      // 🔽 filtra ranking para só integrantes elegíveis
      const filteredRanking = rankingData.filter((r) =>
        eligibleIds.has(r.memberId)
      );

      if (filteredRanking.length === 0) return;

      const winner = filteredRanking[0];
      if (!winner || winner.memberId == null) return;

      const winnerMember = integrantes.find((i) => i.id === winner.memberId);
      if (!winnerMember) return;

      const card = document.createElement("div");
      card.className = "title-card";

      // THUMB
      const thumb = document.createElement("div");
      thumb.className = "title-thumb";

      const img = document.createElement("img");
      img.src = `integrantes/${winnerMember.nome.toLowerCase()}.jpeg`;
      img.onerror = () => (img.src = "integrantes/default.jpeg");
      thumb.appendChild(img);

      // BODY
      const body = document.createElement("div");
      body.className = "title-body";

      const name = document.createElement("div");
      name.className = "title-name";
      name.textContent = title.nome;

      const catMeta = TITLE_CATEGORIES[title.categoria] || {
        icon: "🏷️",
        label: "Outros",
      };

      const cat = document.createElement("div");
      cat.className = "title-category";
      cat.textContent = `${catMeta.icon} ${catMeta.label}`;

      const desc = document.createElement("div");
      desc.className = "title-description";
      desc.textContent = title.descricao;

      // RANKING
      const ranking = document.createElement("div");
      ranking.className = "title-ranking";

      filteredRanking.slice(0, 10).forEach((r, idx) => {
        const member = integrantes.find((i) => i.id === r.memberId);
        if (!member) return;

        const item = document.createElement("div");
        item.className = "title-ranking-item";

        const medal = document.createElement("span");
        medal.className = "title-ranking-medal";
        if (idx === 0) medal.textContent = "🥇";
        else if (idx === 1) medal.textContent = "🥈";
        else if (idx === 2) medal.textContent = "🥉";

        const pos = document.createElement("span");
        pos.className = "pos";
        pos.textContent = `#${idx + 1}`;

        const nome = document.createElement("span");
        nome.className = "name";
        nome.textContent = member.nome;

        const valor = document.createElement("span");
        valor.className = "value";
        valor.textContent = `${r.value}`;

        if (idx === 0) pos.style.color = "#facc15";
        if (idx === 1) pos.style.color = "#e5e7eb";
        if (idx === 2) pos.style.color = "#f59e0b";

        item.append(medal, pos, nome, valor);
        ranking.appendChild(item);
      });

      body.append(name, cat, desc, ranking);
      card.append(thumb, body);
      grid.appendChild(card);
    });
  } finally {
    HISTORICO = __HIST_ORIG;
  }
}

// =========================================================
// RANKINGS POR POPULARIDADE (CLÁSSICOS / RAROS)
// =========================================================
function gerarRankingPorPopularidade(nivelDesejado) {
  const popMap = computePopularidadeCatalog();
  const contador = new Map();

  HISTORICO.forEach((evento) => {
    if (!Array.isArray(evento.musicas) || !Array.isArray(evento.integrantes))
      return;

    evento.musicas.forEach((mid) => {
      const info = popMap.get(mid);
      if (!info || info.tier !== nivelDesejado) return;

      evento.integrantes.forEach((iid) => {
        contador.set(iid, (contador.get(iid) || 0) + 1);
      });
    });
  });

  return Array.from(contador.entries())
    .map(([memberId, value]) => ({ memberId, value }))
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

// =========================================================
// TITLES ENGINE — métricas e rankings
// =========================================================

// ---- Util: data parsing (para streaks)
function parseEventDate(ev) {
  const raw = ev?.data || ev?.date || ev?.dia || ev?.quando || null;
  if (!raw) return null;
  // aceita "YYYY-MM-DD", "DD/MM/YYYY", ISO etc.
  const d1 = new Date(raw);
  if (!isNaN(d1.getTime())) return d1;

  if (typeof raw === "string" && raw.includes("/")) {
    const [dd, mm, yyyy] = raw.split("/").map((x) => parseInt(x, 10));
    if (dd && mm && yyyy) {
      const d2 = new Date(yyyy, mm - 1, dd);
      if (!isNaN(d2.getTime())) return d2;
    }
  }
  return null;
}

// ---- Util: pegar arrays com fallback
function getEventMusicas(ev) {
  if (!ev || !Array.isArray(ev.musicas)) return [];

  return ev.musicas.map((id) => Number(id)).filter((id) => Number.isFinite(id));
}

function getEventIntegrantes(ev) {
  if (!ev) return [];

  // formato oficial
  if (Array.isArray(ev.integrantes)) {
    return ev.integrantes.filter(Number.isFinite);
  }

  // fallbacks defensivos
  if (Array.isArray(ev.integrantesIds)) {
    return ev.integrantesIds.filter(Number.isFinite);
  }

  if (Array.isArray(ev.membros)) {
    return ev.membros.filter(Number.isFinite);
  }

  return [];
}

function buildMusicById() {
  // Se já existe um Map populado, usa ele.
  if (MUSIC_BY_ID instanceof Map && MUSIC_BY_ID.size > 0) {
    return MUSIC_BY_ID;
  }

  // Senão, tenta construir a partir do array cru (quando já estiver carregado)
  const arr = Array.isArray(MUSICAS_RAW) ? MUSICAS_RAW : [];
  const mp = new Map();
  for (const s of arr) {
    if (!s) continue;
    const id = Number(s.id);
    if (Number.isFinite(id)) mp.set(id, s);
  }
  return mp;
}

const _MUSIC_BY_ID_LOCAL = buildMusicById();

// ---- Categorias da música (robusto)
function normalizeCategoriasField(musica) {
  const raw =
    musica?.categorias ?? musica?.categories ?? musica?.categoria ?? "";
  if (Array.isArray(raw))
    return raw.map((s) => String(s).trim()).filter(Boolean);

  if (typeof raw === "string") {
    return raw
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

// ---- Instrumento principal do integrante (robusto)
function getPrimaryInstrument(member) {
  // integrante.function pode ser array de objetos {instrumento: nivel}
  const fn = member?.function ?? member?.funcoes ?? member?.funcao;
  if (Array.isArray(fn) && fn.length) {
    const firstObj = fn[0];
    if (firstObj && typeof firstObj === "object") {
      const k = Object.keys(firstObj)[0];
      if (k) return k;
    }
  }
  // fallback: string
  if (typeof fn === "string" && fn.trim()) return fn.trim();
  return null;
}

// ---- Dificuldade da música por instrumento (robusto)
function normalizeDifficultyValue(v) {
  if (v == null) return null;

  // number scale
  if (typeof v === "number") {
    if (v >= 3) return "hard";
    if (v === 2) return "medium";
    if (v <= 1) return "easy";
  }

  const s = String(v).toLowerCase().trim();
  if (!s) return null;

  // pt/br
  if (s.includes("dif")) return "hard"; // difícil
  if (s.includes("med")) return "medium"; // médio
  if (s.includes("fac") || s.includes("fác")) return "easy"; // fácil

  // en
  if (s.includes("hard")) return "hard";
  if (s.includes("med")) return "medium";
  if (s.includes("easy")) return "easy";

  // numeric as string
  const n = parseFloat(s);
  if (!isNaN(n)) return normalizeDifficultyValue(n);

  return null;
}

// ---- Popularidade (tier) — usa seu computePopularidadeCatalog()
function getTierForMusicId(mid) {
  const pop = computePopularidadeCatalog?.();
  if (pop?.get) return pop.get(mid)?.tier || "common";
  return "common";
}

// ---- Execuções por música no período (histórico)
function buildExecCountMap(events) {
  const map = new Map();
  (events || []).forEach((ev) => {
    for (const mid of getEventMusicas(ev)) {
      map.set(mid, (map.get(mid) || 0) + 1);
    }
  });
  return map;
}

// ---- Métricas por integrante
function computeMemberStats(events) {
  const stats = new Map();

  const initStats = (memberId) => ({
    memberId,
    cultos: 0,

    // Presença
    attendanceCount: 0,

    // Repertório tocado pelo integrante
    repertorioSet: new Set(),
    repertorioPct: 0,

    // Alias (contrato)
    uniqueSongsPct: 0,

    // Parceiros / formações
    formationsSet: new Set(),
    formationsCount: 0,

    // Técnica (padronizada pela dificuldade média da música)
    diff: { easy: 0, medium: 0, hard: 0, total: 0 },
    diffPct: { easy: 0, medium: 0, hard: 0 },

    // Popularidade (tocadas)
    pop: { classic: 0, common: 0, rare: 0, total: 0 },
    popPct: { classic: 0, common: 0, rare: 0 },

    // Curadoria (geral)
    chosenSongsCount: 0,
    chosenSongsSet: new Set(),
    chosenSongsUniquePct: 0,

    chosenArtistsSet: new Set(),
    chosenArtistsCatalogPct: 0,

    chosenDaysSet: new Set(),
    chosenDaysCount: 0,

    // Curadoria por dificuldade (padronizada pela dificuldade média da música)
    chosenDiff: { easy: 0, medium: 0, hard: 0, total: 0 },
    chosenDiffPct: { easy: 0, medium: 0, hard: 0 },

    // Inaugurações
    inauguratedSongsSet: new Set(),
    inauguratedSongsCount: 0,
  });

  const getOrInit = (memberIdRaw) => {
    const memberId = Number(memberIdRaw);
    if (!Number.isFinite(memberId)) return null;
    if (!stats.has(memberId)) stats.set(memberId, initStats(memberId));
    return stats.get(memberId);
  };

  // --------- catálogo (para percentuais) ----------
  const totalSongsCatalog = Array.isArray(MUSICAS_RAW) ? MUSICAS_RAW.length : 0;
  const totalArtistsCatalog = (() => {
    const s = new Set();
    (Array.isArray(MUSICAS_RAW) ? MUSICAS_RAW : []).forEach((m) => {
      const a = (m?.artista || "").trim();
      if (a) s.add(a);
    });
    return s.size || 0;
  })();

  // --------- tier de dificuldade média da música (única régua) ----------
  const getAverageMusicTier = (musica) => {
    if (!musica) return null;

    const diffRaw =
      musica?.level ??
      musica?.dificuldades ??
      musica?.dificuldade ??
      musica?.difficulty ??
      null;

    if (!diffRaw || typeof diffRaw !== "object") return null;

    const nums = Object.values(diffRaw)
      .map((v) => {
        const t = normalizeDifficultyValue(v);
        if (t === "easy") return 1;
        if (t === "medium") return 2;
        if (t === "hard") return 3;
        return null;
      })
      .filter((x) => x != null);

    if (!nums.length) return null;

    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;

    if (avg >= 2.5) {
      // console.log(musica.titulo);
      // console.log(avg);
    }

    // thresholds atuais do projeto (mantidos)
    if (avg >= 2.5) return "hard";
    if (avg >= 1.5) return "medium";
    return "easy";
  };

  // --------- ordenar eventos para inaugurações ----------
  const evs = Array.isArray(events) ? events : [];
  const ordered = [...evs].sort((a, b) => {
    const da = parseEventDate(a);
    const db = parseEventDate(b);
    return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
  });

  const firstSeenSong = new Set();

  ordered.forEach((ev) => {
    const musicas =
      typeof getEventMusicas === "function"
        ? getEventMusicas(ev)
        : Array.isArray(ev?.musicas)
        ? ev.musicas
        : [];

    const integrantesEv =
      typeof getEventIntegrantes === "function"
        ? getEventIntegrantes(ev)
        : Array.isArray(ev?.integrantes)
        ? ev.integrantes
        : [];

    // ---------- formações ----------
    if (integrantesEv.length) {
      const formationKey = [...integrantesEv]
        .map((x) => String(Number(x)))
        .sort()
        .join("|");
      integrantesEv.forEach((mid) => {
        const st = getOrInit(mid);
        if (!st) return;
        st.formationsSet.add(formationKey);
      });
    }

    // ---------- execução (tocadas) ----------
    integrantesEv.forEach((mid) => {
      const st = getOrInit(mid);
      if (!st) return;

      st.cultos++;
      st.attendanceCount = st.cultos;

      musicas.forEach((songIdRaw) => {
        const songId = Number(songIdRaw);
        if (!Number.isFinite(songId)) return;

        const musica = MUSIC_BY_ID.get(songId) || null;
        if (!musica) return;

        // repertório
        st.repertorioSet.add(songId);

        // técnica (média da música)
        const tier = getAverageMusicTier(musica);
        if (tier) {
          st.diff[tier] = (st.diff[tier] || 0) + 1;
          st.diff.total++;
        }

        // popularidade (classic/common/secret -> rare)
        const rawTier = getTierForMusicId(songId);
        const popTier = rawTier === "secret" ? "rare" : rawTier;
        if (
          popTier === "classic" ||
          popTier === "common" ||
          popTier === "rare"
        ) {
          st.pop[popTier] = (st.pop[popTier] || 0) + 1;
          st.pop.total++;
        }
      });
    });

    // ---------- curadoria (cabeça) ----------
    const headerRaw =
      ev?.header ??
      ev?.cabeca ??
      ev?.curador ??
      ev?.escolhedor ??
      ev?.escolhidos ??
      null;

    const escolhidos = Array.isArray(headerRaw)
      ? headerRaw
      : headerRaw != null
      ? [headerRaw]
      : [];

    const d = parseEventDate(ev);
    const dayKey = d
      ? d.toISOString().slice(0, 10)
      : ev?.data
      ? String(ev.data)
      : null;

    if (escolhidos.length && musicas.length) {
      escolhidos.forEach((mid) => {
        const st = getOrInit(mid);
        if (!st) return;

        // 1x por culto
        if (dayKey && !st.chosenDaysSet.has(dayKey)) {
          st.chosenDaysSet.add(dayKey);
          st.chosenDaysCount++;
        }

        musicas.forEach((songIdRaw) => {
          const songId = Number(songIdRaw);
          if (!Number.isFinite(songId)) return;

          const musica = MUSIC_BY_ID.get(songId) || null;
          if (!musica) return;

          // contagem de músicas escolhidas (com repetição)
          st.chosenSongsCount++;

          // únicas
          st.chosenSongsSet.add(songId);

          // artistas únicos
          const art = (musica.artista || "").trim();
          if (art) st.chosenArtistsSet.add(art);

          // curadoria por dificuldade (média da música — mesma régua da execução)
          const tier = getAverageMusicTier(musica);
          if (tier) {
            st.chosenDiff[tier] = (st.chosenDiff[tier] || 0) + 1;
            st.chosenDiff.total++;
          }
        });
      });
    }

    // ---------- inaugurações ----------
    if (escolhidos.length && musicas.length) {
      musicas.forEach((songIdRaw) => {
        const songId = Number(songIdRaw);
        if (!Number.isFinite(songId)) return;

        if (firstSeenSong.has(songId)) return;
        firstSeenSong.add(songId);

        escolhidos.forEach((mid) => {
          const st = getOrInit(mid);
          if (!st) return;
          st.inauguratedSongsSet.add(songId);
        });
      });
    }
  });

  // ---------- pós-processamento ----------
  stats.forEach((st) => {
    const uniqSongs = st.repertorioSet.size;

    st.repertorioPct = totalSongsCatalog ? uniqSongs / totalSongsCatalog : 0;
    st.uniqueSongsPct = st.repertorioPct;

    st.chosenSongsUniquePct = st.chosenSongsCount
      ? st.chosenSongsSet.size / st.chosenSongsCount
      : 0;

    st.chosenArtistsCatalogPct = totalArtistsCatalog
      ? st.chosenArtistsSet.size / totalArtistsCatalog
      : 0;

    st.formationsCount = st.formationsSet.size;
    st.inauguratedSongsCount = st.inauguratedSongsSet.size;

    // diff %
    if (st.diff.total > 0) {
      st.diffPct.easy = st.diff.easy / st.diff.total;
      st.diffPct.medium = st.diff.medium / st.diff.total;
      st.diffPct.hard = st.diff.hard / st.diff.total;
    } else {
      st.diffPct.easy = 0;
      st.diffPct.medium = 0;
      st.diffPct.hard = 0;
    }

    // chosen diff %
    if (st.chosenDiff.total > 0) {
      st.chosenDiffPct.easy = st.chosenDiff.easy / st.chosenDiff.total;
      st.chosenDiffPct.medium = st.chosenDiff.medium / st.chosenDiff.total;
      st.chosenDiffPct.hard = st.chosenDiff.hard / st.chosenDiff.total;
    } else {
      st.chosenDiffPct.easy = 0;
      st.chosenDiffPct.medium = 0;
      st.chosenDiffPct.hard = 0;
    }

    // pop %
    if (st.pop.total > 0) {
      st.popPct.classic = st.pop.classic / st.pop.total;
      st.popPct.common = st.pop.common / st.pop.total;
      st.popPct.rare = st.pop.rare / st.pop.total;
    } else {
      st.popPct.classic = 0;
      st.popPct.common = 0;
      st.popPct.rare = 0;
    }

    // garantias numéricas
    st.attendanceCount = Number.isFinite(st.attendanceCount)
      ? st.attendanceCount
      : 0;
    st.chosenSongsCount = Number.isFinite(st.chosenSongsCount)
      ? st.chosenSongsCount
      : 0;
    st.chosenDaysCount = Number.isFinite(st.chosenDaysCount)
      ? st.chosenDaysCount
      : 0;
    st.chosenArtistsCatalogPct = Number.isFinite(st.chosenArtistsCatalogPct)
      ? st.chosenArtistsCatalogPct
      : 0;
    st.formationsCount = Number.isFinite(st.formationsCount)
      ? st.formationsCount
      : 0;
    st.inauguratedSongsCount = Number.isFinite(st.inauguratedSongsCount)
      ? st.inauguratedSongsCount
      : 0;
  });

  return stats;
}

// ---- streak (maratonista)
function computeLongestStreak(events) {
  // streak de participação em datas ordenadas
  const dated = (events || [])
    .map((ev) => ({ ev, d: parseEventDate(ev) }))
    .filter((x) => x.d)
    .sort((a, b) => a.d - b.d);

  const memberIds = (INTEGRANTES_RAW || []).map((m) => m.id);
  const streaks = new Map(); // memberId -> best

  memberIds.forEach((id) =>
    streaks.set(id, { best: 0, current: 0, lastDay: null })
  );

  for (const { ev, d } of dated) {
    const dayKey = d.toISOString().slice(0, 10);
    const present = new Set(getEventIntegrantes(ev));

    memberIds.forEach((mid) => {
      const s = streaks.get(mid);

      if (present.has(mid)) {
        if (s.lastDay == null) {
          s.current = 1;
        } else {
          // se for próximo evento em sequência (não exigimos diário, só sequência de eventos)
          // qualquer evento seguinte mantém streak
          s.current = s.current + 1;
        }
        s.best = Math.max(s.best, s.current);
      } else {
        s.current = 0;
      }
      s.lastDay = dayKey;
    });
  }

  const out = [];
  streaks.forEach((v, mid) => out.push({ memberId: mid, value: v.best }));
  out.sort((a, b) => b.value - a.value);
  return out;
}

// ---- Helpers: ranking builder
function rankBy(statsMap, valueFn, topN = 10, filterFn = null) {
  const arr = [];
  statsMap.forEach((st) => {
    if (filterFn && !filterFn(st)) return;
    const v = valueFn(st);
    if (v == null || isNaN(v)) return;
    arr.push({ memberId: st.memberId, value: v });
  });
  arr.sort((a, b) => b.value - a.value);
  return arr.slice(0, topN);
}

function rankByAsc(statsMap, valueFn, topN = 10, filterFn = null) {
  const arr = [];
  statsMap.forEach((st) => {
    if (filterFn && !filterFn(st)) return;
    const v = valueFn(st);
    if (v == null || isNaN(v)) return;
    arr.push({ memberId: st.memberId, value: v });
  });
  arr.sort((a, b) => a.value - b.value);
  return arr.slice(0, topN);
}

function rankByChosenOnly(statsMap, valueFn, topN = 10) {
  return rankBy(statsMap, valueFn, topN, (s) => (s.chosenSongsCount || 0) > 0);
}

function rankByAscChosenOnly(statsMap, valueFn, topN = 10) {
  return rankByAsc(
    statsMap,
    valueFn,
    topN,
    (s) => (s.chosenSongsCount || 0) > 0
  );
}

function rankByChosenDaysOnly(statsMap, valueFn, topN = 10) {
  return rankBy(statsMap, valueFn, topN, (s) => (s.chosenDaysCount || 0) > 0);
}

function rankByAscChosenDaysOnly(statsMap, valueFn, topN = 10) {
  return rankByAsc(
    statsMap,
    valueFn,
    topN,
    (s) => (s.chosenDaysCount || 0) > 0
  );
}

function getHojeZerado() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateSafe(str) {
  if (!str) return null;
  const d = parseEventDate(str);
  if (!d || isNaN(d)) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function pct(v) {
  return Math.round((v || 0) * 1000) / 10; // 1 casa decimal
}
