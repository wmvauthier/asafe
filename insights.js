document.addEventListener("DOMContentLoaded", async function () {
  const resultado = await analisarDados();

  function populateGroup() {
    const topMusicasUl = document.getElementById("top-musicas");
    const bottomMusicasUl = document.getElementById("bottom-musicas");
    const topCategoriasUl = document.getElementById("top-categorias");
    const bottomCategoriasUl = document.getElementById("bottom-categorias");
    const topArtistasUl = document.getElementById("top-artistas");
    const bottomArtistasUl = document.getElementById("bottom-artistas");

    function createListItems(data, top = true) {
      // Itens mais tocados: slice(0, 10). Menos tocados: últimos 10 itens (revertendo para manter ordem crescente).
      let items = top ? data.slice(0, 10) : data.slice(-10).reverse();

      return items
        .map((item, index) => {
          // Ajuste no rank para menos tocados. Agora, para "menos", começamos de 1 para o primeiro da lista.
          const rank = top ? index + 1 : data.length - index; // Para "menos tocados", o rank começa a partir de 1

          const isTop = top && index < 3;
          const isBot = !top && index < 3; // Para "menos tocados", os 3 primeiros devem ser considerados bot (vermelho)
          const rankClass = isTop
            ? "top-rank"
            : isBot
            ? "bot-rank"
            : "stat-rank";

          return `
            <li class="${isTop || isBot ? "bold-item" : ""}">
              <span class="${rankClass}">#${rank}</span>
              <span class="stat-text">${limitText(item[0])}</span>
              <span class="stat-value">${item[1]}</span>
            </li>`;
        })
        .join("");
    }

    topMusicasUl.innerHTML = createListItems(
      resultado.resultadoGrupo.musica,
      true
    );
    bottomMusicasUl.innerHTML = createListItems(
      resultado.resultadoGrupo.musica,
      false
    );
    topCategoriasUl.innerHTML = createListItems(
      resultado.resultadoGrupo.categoria,
      true
    );
    bottomCategoriasUl.innerHTML = createListItems(
      resultado.resultadoGrupo.categoria,
      false
    );
    topArtistasUl.innerHTML = createListItems(
      resultado.resultadoGrupo.artista,
      true
    );
    bottomArtistasUl.innerHTML = createListItems(
      resultado.resultadoGrupo.artista,
      false
    );
  }

  populateGroup();

  // Preencher o carousel dos integrantes
  const carouselSlides = document.getElementById("carousel-slides");
  let currentSlide = 0;

  function populateCarousel() {
    const slidesHTML = resultado.resultadoIntegrantes
      .map((integrante) => {
        // Cria o HTML para as aparições, se houver levels
        let aparicoesHTML = "";

        if (integrante.levels && Object.keys(integrante.levels).length > 0) {
          aparicoesHTML = `
            <br><div class="stat-group">
              <h4><i class="fas fa-guitar"></i> PARTICIPAÇÕES</h4>
              <ul>
                <li>
                  <span class="stat-text">Aparições</span>
                  <span class="stat-value">${integrante.aparicoes}</span>
                </li>
                ${Object.entries(integrante.levels)
                  .map(([instrumento, difficulties]) => {
                    const hardCount = difficulties.hard || 0;
                    const mediumCount = difficulties.medium || 0;
                    const easyCount = difficulties.easy || 0;
                    return `<li>
                      <span class="stat-text">${
                        instrumento.charAt(0).toUpperCase() +
                        instrumento.slice(1)
                      }</span>
                      <span class="stat-value">
                        <span class="circle circle-hard">${hardCount}</span>
                        <span class="circle circle-medium">${mediumCount}</span>
                        <span class="circle circle-easy">${easyCount}</span>
                      </span>
                    </li>`;
                  })
                  .join("")}
              </ul>
            </div><br>
          `;
        }

        return `<div class="card card-trunfo">
          <div class="card-image">
            <img src="integrantes/${String(
              integrante?.nome || ""
            ).toLowerCase()}.jpeg" alt="Imagem" />
          </div>
          <div class="card-content">
            <h3><i class="${integrante.icon}"></i> ${integrante.nome}</h3>
            ${aparicoesHTML}
            <div class="stats">
              <div class="stat-group">
                <h4><i class="fas fa-music"></i> MÚSICAS</h4>
                <ul>
                  ${integrante.musica
                    .slice(0, 5)
                    .map(
                      (item) => `<li>
                        <span class="stat-text">${limitText(item[0])}</span>
                        <span class="stat-value">${item[1]}</span>
                      </li>`
                    )
                    .join("")}
                </ul>
              </div>
              <div class="stat-group">
                <h4><i class="fas fa-th-list"></i> CATEGORIAS</h4>
                <ul>
                  ${integrante.categoria
                    .slice(0, 5)
                    .map(
                      (item) => `<li>
                        <span class="stat-text">${limitText(item[0])}</span>
                        <span class="stat-value">${item[1]}</span>
                      </li>`
                    )
                    .join("")}
                </ul>
              </div>
              <div class="stat-group">
                <h4><i class="fas fa-microphone-alt"></i> ARTISTAS</h4>
                <ul>
                  ${integrante.artista
                    .slice(0, 5)
                    .map(
                      (item) => `<li>
                        <span class="stat-text">${limitText(item[0])}</span>
                        <span class="stat-value">${item[1]}</span>
                      </li>`
                    )
                    .join("")}
                </ul>
              </div>
            </div>
          </div>
        </div>`;
      })
      .join("");
    carouselSlides.innerHTML = slidesHTML;
  }

  populateCarousel();

  // Função para exibir o slide correto no carousel
  function showSlide(index) {
    const slides = document.querySelectorAll(".carousel-slides .card");
    const totalSlides = slides.length;
    if (index < 0) {
      currentSlide = totalSlides - 1;
    } else if (index >= totalSlides) {
      currentSlide = 0;
    } else {
      currentSlide = index;
    }
    // Cada card tem largura mínima de 300px + margin de 20px (10px cada lado)
    const slideWidth = slides[0].offsetWidth + 20;
    const offset = -currentSlide * slideWidth;
    carouselSlides.style.transform = `translateX(${offset}px)`;
  }

  // Função para alterar o slide
  window.changeSlide = function (n) {
    showSlide(currentSlide + n);
  };

  // Exibe o primeiro slide ao carregar
  showSlide(0);
});

async function analisarDados() {
  // Carrega os dados
  const response1 = await fetch("historico.json");
  if (!response1.ok) throw new Error("Erro ao carregar o histórico");
  let historico = await response1.json();

  const response2 = await fetch("musicas.json");
  if (!response2.ok) throw new Error("Erro ao carregar as músicas");
  let musicas = await response2.json();

  const response3 = await fetch("integrantes/integrantes.json");
  if (!response3.ok) throw new Error("Erro ao carregar os integrantes");
  let integrantes = await response3.json();

  const musicaMap = new Map(musicas.map((m) => [m.id, m]));

  // Contadores gerais
  const musicaCount = {};
  const categoriaCount = {};
  const artistaCount = {};
  const integranteStats = new Map(
    integrantes.map((i) => [
      i.id,
      { ...i, aparicoes: 0, musicas: {}, categorias: {}, artistas: {} },
    ])
  );

  historico.forEach((evento) => {
    // Converte "DD/MM/YYYY" para "YYYY-MM-DD"
    const partesData = evento.data.split("/");
    const dataFormatada = `${partesData[2]}-${partesData[1]}-${partesData[0]}`;
    const dataEvento = new Date(dataFormatada);
    if (isNaN(dataEvento)) {
      console.error(`Data inválida encontrada: ${evento.data}`);
      return;
    }
    evento.integrantes.forEach((integranteId) => {
      const stats = integranteStats.get(integranteId);
      if (!stats) return;
      stats.aparicoes += 1;
    });
    evento.musicas.forEach((musicaId) => {
      const musica = musicaMap.get(musicaId);
      if (!musica) return;
      // Contagem Geral para Música
      musicaCount[musica.titulo] = (musicaCount[musica.titulo] || 0) + 1;
      // Contagem Geral para Artistas
      musica.artista.split(";").forEach((artista) => {
        const art = artista.trim();
        artistaCount[art] = (artistaCount[art] || 0) + 1;
      });
      // Contagem Geral para Categorias
      musica.categorias.split(";").forEach((categoria) => {
        const cat = categoria.trim();
        categoriaCount[cat] = (categoriaCount[cat] || 0) + 1;
      });
      // Contagem por Integrante
      evento.integrantes.forEach((integranteId) => {
        const stats = integranteStats.get(integranteId);
        if (!stats) return;
        stats.musicas[musica.titulo] = (stats.musicas[musica.titulo] || 0) + 1;
        musica.categorias.split(";").forEach((categoria) => {
          const cat = categoria.trim();
          stats.categorias[cat] = (stats.categorias[cat] || 0) + 1;
        });
        musica.artista.split(";").forEach((artista) => {
          const art = artista.trim();
          stats.artistas[art] = (stats.artistas[art] || 0) + 1;
        });
      });
    });
  });

  // Garante que todas as músicas, artistas e categorias tenham uma contagem (mesmo que zero)
  musicas.forEach((musica) => {
    if (!(musica.titulo in musicaCount)) {
      musicaCount[musica.titulo] = 0;
    }
    musica.artista.split(";").forEach((artista) => {
      const art = artista.trim();
      if (!(art in artistaCount)) {
        artistaCount[art] = 0;
      }
    });
    musica.categorias.split(";").forEach((categoria) => {
      const cat = categoria.trim();
      if (!(cat in categoriaCount)) {
        categoriaCount[cat] = 0;
      }
    });
  });

  // Tie-breaker functions
  const tieBreakerMusic = (a, b, musicas, artistaCount, categoriaCount) => {
    if (a[1] !== b[1]) return b[1] - a[1];
    const musicaA = musicas.find((m) => m.titulo === a[0]) || {
      artista: "",
      categorias: "",
    };
    const musicaB = musicas.find((m) => m.titulo === b[0]) || {
      artista: "",
      categorias: "",
    };
    const maxCatA = musicaA.categorias
      .split(";")
      .map((cat) => categoriaCount[cat.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);
    const maxCatB = musicaB.categorias
      .split(";")
      .map((cat) => categoriaCount[cat.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);
    if (maxCatA !== maxCatB) return maxCatB - maxCatA;
    const maxArtA = musicaA.artista
      .split(";")
      .map((art) => artistaCount[art.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);
    const maxArtB = musicaB.artista
      .split(";")
      .map((art) => artistaCount[art.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);
    if (maxArtA !== maxArtB) return maxArtB - maxArtA;
    return 0;
  };

  const tieBreakerCategory = (a, b, musicas, musicaCount, artistaCount) => {
    if (a[1] !== b[1]) return b[1] - a[1];
    const catA = a[0],
      catB = b[0];
    const musicasCatA = musicas.filter((m) =>
      (m.categorias || "")
        .split(";")
        .map((c) => c.trim())
        .includes(catA)
    );
    const musicasCatB = musicas.filter((m) =>
      (m.categorias || "")
        .split(";")
        .map((c) => c.trim())
        .includes(catB)
    );
    const maxMusicaA = musicasCatA
      .map((m) => musicaCount[m.titulo] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);
    const maxMusicaB = musicasCatB
      .map((m) => musicaCount[m.titulo] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);
    if (maxMusicaA !== maxMusicaB) return maxMusicaB - maxMusicaA;
    const maxArtistaA = musicasCatA
      .flatMap((m) => (m.artista || "").split(";"))
      .map((art) => artistaCount[art.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);
    const maxArtistaB = musicasCatB
      .flatMap((m) => (m.artista || "").split(";"))
      .map((art) => artistaCount[art.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);
    if (maxArtistaA !== maxArtistaB) return maxArtistaB - maxArtistaA;
    return 0;
  };

  const tieBreakerArtist = (a, b, musicas, musicaCount, categoriaCount) => {
    if (a[1] !== b[1]) return b[1] - a[1];
    const artA = a[0],
      artB = b[0];
    const musicasArtA = musicas.filter((m) =>
      (m.artista || "")
        .split(";")
        .map((x) => x.trim())
        .includes(artA)
    );
    const musicasArtB = musicas.filter((m) =>
      (m.artista || "")
        .split(";")
        .map((x) => x.trim())
        .includes(artB)
    );
    const countsArtA = musicasArtA.map((m) => musicaCount[m.titulo] || 0);
    const countsArtB = musicasArtB.map((m) => musicaCount[m.titulo] || 0);
    const maxMusicaA = countsArtA.reduce((max, cur) => Math.max(max, cur), 0);
    const maxMusicaB = countsArtB.reduce((max, cur) => Math.max(max, cur), 0);
    if (maxMusicaA !== maxMusicaB) return maxMusicaB - maxMusicaA;
    const maxCategoriaA = musicasArtA
      .flatMap((m) => (m.categorias || "").split(";"))
      .map((cat) => categoriaCount[cat.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);
    const maxCategoriaB = musicasArtB
      .flatMap((m) => (m.categorias || "").split(";"))
      .map((cat) => categoriaCount[cat.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);
    if (maxCategoriaA !== maxCategoriaB) return maxCategoriaB - maxCategoriaA;
    return 0;
  };

  const sortDataWithTieBreaker = (data, tieBreaker, ...args) => {
    return Object.entries(data).sort((a, b) => tieBreaker(a, b, ...args));
  };

  const resultadoGrupo = {
    musica: sortDataWithTieBreaker(
      musicaCount,
      tieBreakerMusic,
      musicas,
      artistaCount,
      categoriaCount
    ),
    categoria: sortDataWithTieBreaker(
      categoriaCount,
      tieBreakerCategory,
      musicas,
      musicaCount,
      artistaCount
    ),
    artista: sortDataWithTieBreaker(
      artistaCount,
      tieBreakerArtist,
      musicas,
      musicaCount,
      categoriaCount
    ),
  };

  const resultadoIntegrantes = Array.from(integranteStats.values())
    .map((stats) => ({
      id: stats.id,
      nome: stats.nome,
      aparicoes: stats.aparicoes,
      musica: sortDataWithTieBreaker(
        stats.musicas,
        tieBreakerMusic,
        musicas,
        artistaCount,
        categoriaCount
      ),
      categoria: sortDataWithTieBreaker(
        stats.categorias,
        tieBreakerCategory,
        musicas,
        musicaCount,
        artistaCount
      ),
      artista: sortDataWithTieBreaker(
        stats.artistas,
        tieBreakerArtist,
        musicas,
        musicaCount,
        categoriaCount
      ),
    }))
    .sort((a, b) => b.aparicoes - a.aparicoes);

  // -------------------------
  // Função auxiliar: obterEscalaPorData
  function obterEscalaPorData(dataEscolhida, musicas, historico, integrantes) {
    const funcoesPrioridade = [
      "bateria",
      "baixo",
      "guitarra",
      "teclado",
      "sax",
      "vocal",
    ];
    const escala = historico.find((e) => e.data === dataEscolhida);
    if (!escala) {
      console.log("Nenhuma escala encontrada para essa data.");
      return;
    }
    // Filtra somente integrantes que possuem a propriedade 'function'
    const integrantesEscalados = integrantes.filter(
      (i) =>
        escala.integrantes.includes(i.id) && i.function && i.function.length > 0
    );
    const musicasEscaladas = escala.musicas.map((musicaId) => {
      const musicaInfo = musicas.find((m) => m.id == musicaId);
      return musicaInfo
        ? {
            id: musicaInfo.id,
            titulo: musicaInfo.titulo,
            artista: musicaInfo.artista,
            level: musicaInfo.level || {},
          }
        : { id: musicaId, titulo: "Música não encontrada" };
    });
    // Objeto para rastrear funções já atribuídas (exceto vocal)
    const funcoesAtribuidas = {};
    // Primeira etapa: para integrantes com única função disponível
    const escalaFinalParcial = integrantesEscalados.map((integrante) => {
      const funcoesDisponiveis = Object.keys(integrante.function[0]);
      let funcaoAtribuida = "Sem função";
      if (funcoesDisponiveis.length === 1) {
        funcaoAtribuida = funcoesDisponiveis[0];
        if (funcaoAtribuida !== "vocal") {
          funcoesAtribuidas[funcaoAtribuida] = true;
        }
      }
      return { ...integrante, funcao: funcaoAtribuida, niveis: {} };
    });
    // Segunda etapa: para integrantes com mais de uma função ou sem função atribuída
    const escalaFinal = escalaFinalParcial.map((integrante) => {
      if (integrante.funcao !== "Sem função") return integrante;
      const funcoesDisponiveis = Object.keys(integrante.function[0]);
      let funcaoAtribuida = "Sem função";
      for (const func of funcoesDisponiveis) {
        if (func === "vocal") {
          funcaoAtribuida = func;
          break;
        }
        if (!funcoesAtribuidas[func]) {
          funcaoAtribuida = func;
          funcoesAtribuidas[func] = true;
          break;
        }
      }
      return { ...integrante, funcao: funcaoAtribuida };
    });
    // Coleta os níveis (permitindo repetições) de acordo com a função atribuída
    const escalaFinalComLevels = escalaFinal.map((integrante) => {
      let niveis = {};
      if (integrante.funcao !== "Sem função") {
        musicasEscaladas.forEach((musica) => {
          if (musica.level && musica.level[integrante.funcao]) {
            const nivel = musica.level[integrante.funcao].trim();
            if (nivel !== "") {
              if (!niveis[integrante.funcao]) {
                niveis[integrante.funcao] = [];
              }
              niveis[integrante.funcao].push(nivel);
            }
          }
        });
      }
      // Remove as propriedades: function, icon e nome
      const { function: funcOrig, icon, nome, ...rest } = integrante;
      return {
        ...rest,
        niveis: niveis,
      };
    });
    return {
      data: escala.data,
      integrantes: escalaFinalComLevels,
      musicas: musicasEscaladas,
    };
  }
  // -------------------------
  // Agrega os levels de todas as escalas para cada integrante
  const aggregatedLevels = {};
  historico.forEach((escalaItem) => {
    const escalaResult = obterEscalaPorData(
      escalaItem.data,
      musicas,
      historico,
      integrantes
    );
    if (escalaResult && escalaResult.integrantes) {
      escalaResult.integrantes.forEach((integEscalado) => {
        if (!aggregatedLevels[integEscalado.id]) {
          aggregatedLevels[integEscalado.id] = {};
        }
        // Para cada instrumento presente nos níveis do integrante naquela escala
        Object.entries(integEscalado.niveis).forEach(([instr, levelsArray]) => {
          if (!aggregatedLevels[integEscalado.id][instr]) {
            aggregatedLevels[integEscalado.id][instr] = {};
          }
          levelsArray.forEach((nivel) => {
            aggregatedLevels[integEscalado.id][instr][nivel] =
              (aggregatedLevels[integEscalado.id][instr][nivel] || 0) + 1;
          });
        });
      });
    }
  });

  // Agora, insere os levels agregados em resultadoIntegrantes
  const resultadoIntegrantesComLevels = resultadoIntegrantes.map((integ) => {
    return {
      ...integ,
      levels: aggregatedLevels[integ.id] || {},
    };
  });

  console.log(resultadoGrupo);
  console.log(resultadoIntegrantesComLevels);
  // Retorna os resultados com resultadoIntegrantes atualizado com levels
  return {
    resultadoGrupo,
    resultadoIntegrantes: resultadoIntegrantesComLevels,
  };
}

function limitText(str) {
  return str.length > 30 ? str.substring(0, 30) + "..." : str;
}
