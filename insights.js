document.addEventListener("DOMContentLoaded", async function () {
  const resultado = await analisarDados();

  // Preencher os dados do grupo na página (limitando aos 5 primeiros itens)
  function populateGroup() {
    const topMusicasUl = document.getElementById("top-musicas");
    const bottomMusicasUl = document.getElementById("bottom-musicas");
    const topCategoriasUl = document.getElementById("top-categorias");
    const bottomCategoriasUl = document.getElementById("bottom-categorias");
    const topArtistasUl = document.getElementById("top-artistas");
    const bottomArtistasUl = document.getElementById("bottom-artistas");

    function createListItems(data, top = true) {
      // Itens mais tocados: slice(0,5). Menos tocados: últimos 5 itens (revertendo para manter ordem crescente).
      let items = top ? data.slice(0, 10) : data.slice(-10).reverse();
      return items
        .map(
          (item) => `<li>
                <span class="stat-text">${limitText(item[0])}</span>
                <span class="stat-value">${item[1]}</span>
              </li>`
        )
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
              <h4><i class="fas fa-music"></i> Músicas</h4>
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
              <h4><i class="fas fa-th-list"></i> Categorias</h4>
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
              <h4><i class="fas fa-microphone-alt"></i> Artistas</h4>
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

  const sortData = (data) => Object.entries(data).sort((a, b) => b[1] - a[1]);

  // Resultado por grupo
  const resultadoGrupo = {
    musica: sortData(musicaCount),
    categoria: sortData(categoriaCount),
    artista: sortData(artistaCount),
  };

  // Resultado por integrante, ordenado por aparições (DESC)
  const resultadoIntegrantes = Array.from(integranteStats.values())
    .map((stats) => ({
      nome: stats.nome,
      aparicoes: stats.aparicoes,
      musica: sortData(stats.musicas),
      categoria: sortData(stats.categorias),
      artista: sortData(stats.artistas),
    }))
    .sort((a, b) => b.aparicoes - a.aparicoes);

  console.log(resultadoGrupo);
  console.log(resultadoIntegrantes);

  return { resultadoGrupo, resultadoIntegrantes };
}

function limitText(str) {
  return str.length > 30 ? str.substring(0, 25) + "..." : str;
}
