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
        return `<div class="card card-trunfo">
        <div class="card-image">
          <img src="integrantes/${String(
            integrante?.nome || ""
          ).toLowerCase()}.jpeg" alt="Imagem" />
        </div>
        <div class="card-content">
          <h3><i class="${integrante.icon}"></i> ${integrante.nome}</h3>
          <p><strong>Aparições:</strong> ${integrante.aparicoes}</p>
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
      return; // Pula para o próximo evento se a data for inválida
    }

    evento.integrantes.forEach((integranteId) => {
      const stats = integranteStats.get(integranteId);
      if (!stats) return;

      // Incrementa o contador de aparições
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

  // Adiciona músicas, artistas e categorias com contagem zero, se não foram tocados
  musicas.forEach((musica) => {
    // Músicas
    if (!(musica.titulo in musicaCount)) {
      musicaCount[musica.titulo] = 0;
    }
    // Artistas
    musica.artista.split(";").forEach((artista) => {
      const art = artista.trim();
      if (!(art in artistaCount)) {
        artistaCount[art] = 0;
      }
    });
    // Categorias
    musica.categorias.split(";").forEach((categoria) => {
      const cat = categoria.trim();
      if (!(cat in categoriaCount)) {
        categoriaCount[cat] = 0;
      }
    });
  });

  const tieBreakerMusic = (a, b, musicas, artistaCount, categoriaCount) => {
    // Critério principal: quantidade total de vezes tocada
    if (a[1] !== b[1]) {
      return b[1] - a[1];
    }

    // Se a contagem for igual, faça o desempate:
    // Obter os objetos de música com base no título:
    const musicaA = musicas.find((m) => m.titulo === a[0]) || {
      artista: "",
      categorias: "",
    };
    const musicaB = musicas.find((m) => m.titulo === b[0]) || {
      artista: "",
      categorias: "",
    };

    // 1. Desempate por categoria:
    const maxCatA = musicaA.categorias
      .split(";")
      .map((cat) => categoriaCount[cat.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);
    const maxCatB = musicaB.categorias
      .split(";")
      .map((cat) => categoriaCount[cat.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);

    if (maxCatA !== maxCatB) {
      return maxCatB - maxCatA; // Prioriza a música com a categoria mais tocada
    }

    // 2. Desempate por artista:
    const maxArtA = musicaA.artista
      .split(";")
      .map((art) => artistaCount[art.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);
    const maxArtB = musicaB.artista
      .split(";")
      .map((art) => artistaCount[art.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);

    if (maxArtA !== maxArtB) {
      return maxArtB - maxArtA;
    }

    return 0;
  };

  const tieBreakerCategory = (a, b, musicas, musicaCount, artistaCount) => {
    // a e b são arrays: [categoria, count]
    // Primeiro, critério principal: número total de vezes que a categoria foi tocada
    if (a[1] !== b[1]) {
      return b[1] - a[1];
    }

    const catA = a[0];
    const catB = b[0];

    // Filtrar as músicas que possuem cada categoria:
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

    // 1. Desempate por música: pegar o maior valor de aparição entre as músicas daquela categoria.
    const maxMusicaA = musicasCatA
      .map((m) => musicaCount[m.titulo] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);
    const maxMusicaB = musicasCatB
      .map((m) => musicaCount[m.titulo] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);

    if (maxMusicaA !== maxMusicaB) {
      return maxMusicaB - maxMusicaA;
    }

    // 2. Desempate por artista: pegar o maior valor de aparição entre os artistas das músicas dessa categoria.
    const maxArtistaA = musicasCatA
      .flatMap((m) => (m.artista || "").split(";"))
      .map((art) => artistaCount[art.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);
    const maxArtistaB = musicasCatB
      .flatMap((m) => (m.artista || "").split(";"))
      .map((art) => artistaCount[art.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);

    if (maxArtistaA !== maxArtistaB) {
      return maxArtistaB - maxArtistaA;
    }

    return 0;
  };

  const tieBreakerArtist = (a, b, musicas, musicaCount, categoriaCount) => {
    // a e b são arrays: [artista, count]
    if (a[1] !== b[1]) {
      return b[1] - a[1];
    }

    const artA = a[0];
    const artB = b[0];

    // Filtrar as músicas que contêm cada artista:
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

    // 1. Desempate por música: pegar o maior valor de aparição entre as músicas desse artista.
    const countsArtA = musicasArtA.map((m) => {
      const count = musicaCount[m.titulo] || 0;
      return count;
    });
    const countsArtB = musicasArtB.map((m) => {
      const count = musicaCount[m.titulo] || 0;
      return count;
    });
    const maxMusicaA = countsArtA.reduce((max, cur) => Math.max(max, cur), 0);
    const maxMusicaB = countsArtB.reduce((max, cur) => Math.max(max, cur), 0);

    if (maxMusicaA !== maxMusicaB) {
      return maxMusicaB - maxMusicaA;
    }

    // 2. Desempate por categoria: pegar o maior valor de aparição entre as categorias das músicas desse artista.
    const maxCategoriaA = musicasArtA
      .flatMap((m) => (m.categorias || "").split(";"))
      .map((cat) => categoriaCount[cat.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);
    const maxCategoriaB = musicasArtB
      .flatMap((m) => (m.categorias || "").split(";"))
      .map((cat) => categoriaCount[cat.trim()] || 0)
      .reduce((max, cur) => Math.max(max, cur), 0);

    if (maxCategoriaA !== maxCategoriaB) {
      return maxCategoriaB - maxCategoriaA;
    }

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
    nome: stats.nome,
    aparicoes: stats.aparicoes,
    musica: sortDataWithTieBreaker(stats.musicas, tieBreakerMusic, musicas, artistaCount, categoriaCount),
    categoria: sortDataWithTieBreaker(stats.categorias, tieBreakerCategory, musicas, musicaCount, artistaCount),
    artista: sortDataWithTieBreaker(stats.artistas, tieBreakerArtist, musicas, musicaCount, categoriaCount)
  }))
  .sort((a, b) => b.aparicoes - a.aparicoes);

  console.log(resultadoGrupo);
  console.log(resultadoIntegrantes);

  return { resultadoGrupo, resultadoIntegrantes };

}

function limitText(str) {
  return str.length > 30 ? str.substring(0, 25) + "..." : str;
}
