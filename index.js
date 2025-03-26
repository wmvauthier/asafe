let TOCADA_NOS_ULTIMOS_X_DIAS = 35;
let TOCADA_NOS_PROXIMOS_X_DIAS = 35;

// Variáveis globais para controle do filtro
let activeCategories = new Set();
let repertorioMusicas = [];
let historicoEscalas = [];
let musicasTocadas = new Set();

// Função para carregar e preencher os membros da banda
function carregarIntegrantes() {
  fetch("historico.json")
    .then((response) => response.json())
    .then((escalas) => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0); // Remove horas para evitar problemas de comparação

      const parseData = (dataStr) => {
        const [dia, mes, ano] = dataStr.split("/").map(Number);
        return new Date(ano, mes - 1, dia); // Ajuste do mês (base 0)
      };

      const proximaEscala = escalas
        .map((escala) => ({ ...escala, data: parseData(escala.data) })) // Converte datas corretamente
        .filter((escala) => escala.data >= hoje) // Filtra apenas datas futuras
        .sort((a, b) => a.data - b.data) // Ordena da mais próxima para a mais distante
        .shift(); // Pega a mais próxima

      if (!proximaEscala) {
        console.warn("Nenhuma escala futura encontrada.");
        return;
      }

      fetch("integrantes/integrantes.json")
        .then((response) => response.json())
        .then((data) => {
          const container = document.querySelector(".integrantes");
          container.innerHTML = ""; // Limpa antes de adicionar

          proximaEscala.integrantes.forEach((integranteEscala) => {
            const integrante = data.find((i) => i.id === integranteEscala);
            if (integrante) {
              const col = document.createElement("div");
              col.classList.add("col-lg-1", "col-sm-6", "col-4", "mb-4");
              col.style["padding-left"] = "5px";
              col.style["padding-right"] = "5px";
              col.style["margin-bottom"] = "5px!important";

              const memberDiv = document.createElement("div");
              memberDiv.classList.add("band-member", "text-center");

              const img = document.createElement("img");
              img.src =
                "integrantes/" + integrante.nome.toLowerCase() + ".jpeg";
              img.alt = integrante.nome;

              const icon = document.createElement("i");
              icon.classList.add(...integrante.icon.split(" "));

              const p = document.createElement("p");
              // p.textContent = `${integranteEscala.funcao}`;
              p.style["margin-bottom"] = "0px";

              memberDiv.appendChild(img);
              memberDiv.appendChild(icon);
              memberDiv.appendChild(p);

              col.appendChild(memberDiv);
              container.appendChild(col);
            }
          });
        })
        .catch((err) => console.error("Erro ao carregar os integrantes:", err));
    })
    .catch((err) => console.error("Erro ao carregar o histórico:", err));
}

function carregarMusicas() {
  fetch("historico.json")
    .then((response) => response.json())
    .then((escalas) => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0); // Remove horas para evitar problemas de comparação

      const parseData = (dataStr) => {
        const [dia, mes, ano] = dataStr.split("/").map(Number);
        return new Date(ano, mes - 1, dia); // Ajuste do mês (base 0)
      };

      const proximaEscala = escalas
        .map((escala) => ({ ...escala, data: parseData(escala.data) })) // Converte datas corretamente
        .filter((escala) => escala.data >= hoje) // Filtra apenas datas futuras
        .sort((a, b) => a.data - b.data) // Ordena da mais próxima para a mais distante
        .shift(); // Pega a mais próxima

      if (!proximaEscala) {
        console.warn("Nenhuma escala futura encontrada.");
        return;
      }

      fetch("musicas.json")
        .then((response) => response.json())
        .then((musicas) => {
          const content = document.querySelector(".musicas");
          content.innerHTML = ""; // Limpa antes de adicionar

          proximaEscala.musicas.forEach((musicaEscala) => {
            const musica = musicas.find((m) => m.id === musicaEscala);
            if (musica) {
              const col = document.createElement("div");
              col.classList.add("col-lg-3", "col-sm-6", "col-6", "mb-4");
              col.style["padding-left"] = "5px";
              col.style["padding-right"] = "5px";
              col.style["margin-bottom"] = "0px!important";

              const card = document.createElement("div");
              card.classList.add("card");

              const link = document.createElement("a");
              link.href = "https://www.youtube.com/watch?v=" + musica.referLink;
              link.target = "_blank";

              const img = document.createElement("img");
              img.src =
                "https://img.youtube.com/vi/" + musica.referLink + "/0.jpg";
              img.alt = `Thumbnail de ${musica.titulo}`;

              const h3 = document.createElement("h3");
              h3.textContent = musica.titulo;
              h3.style["font-size"] = "1rem";
              // h3.style["padding-bottom"] = "1px";
              h3.style["font-weight"] = "bold";
              h3.style["color"] = "white";
              h3.style["padding-bottom"] = "0px";

              const h32 = document.createElement("h3");
              h32.textContent = musica.artista;
              h32.style["font-size"] = "1rem";
              h32.style["padding-top"] = "0px";
              h32.style["color"] = "white";
              h32.style["padding-bottom"] = "0px";

              const categoriesSet = new Set();
              musicas.forEach((musica) => {
                if (musica.categorias) {
                  const cats = musica.categorias
                    .split(";")
                    .map((c) => c.trim());
                  cats.forEach((c) => categoriesSet.add(c));
                  musica.categories = cats;
                } else {
                  musica.categories = [];
                }
              });

              // Criar container para categorias
              const categoriasContainer = document.createElement("div");
              categoriasContainer.style.margin = "5px";

              musica.categories.forEach((categoria) => {
                const badge = document.createElement("span");
                badge.textContent = categoria;
                badge.classList.add("badge", "bg-light", "text-dark", "me-1");
                badge.style.margin = "5px";
                badge.style.fontSize = "0.6rem";
                categoriasContainer.appendChild(badge);
              });

              link.appendChild(img);
              card.appendChild(link);
              card.appendChild(h3);
              card.appendChild(h32);
              card.appendChild(categoriasContainer);
              col.appendChild(card);

              content.appendChild(col);
            }
          });
        })
        .catch((err) => console.error("Erro ao carregar as músicas:", err));
    })
    .catch((err) => console.error("Erro ao carregar o histórico:", err));
}

function carregarEscalasFuturas() {
  Promise.all([
    fetch("historico.json").then((res) => res.json()),
    fetch("integrantes/integrantes.json").then((res) => res.json()),
    fetch("musicas.json").then((res) => res.json()),
  ])
    .then(([escalas, integrantesData, musicasData]) => {
      const content = document.querySelector(".escala");
      content.innerHTML = ""; // Limpa o conteúdo antes de carregar

      const hoje = new Date();
      const parseData = (dataStr) => {
        const [dia, mes, ano] = dataStr.split("/").map(Number);
        return new Date(ano, mes - 1, dia); // Mês no JS começa do zero (Janeiro = 0)
      };

      // Filtrar apenas datas futuras e ordenar por proximidade
      const escalasFuturas = escalas
        .map((escala) => ({ ...escala, data: parseData(escala.data) })) // Converter string para Date
        .filter((escala) => escala.data >= hoje)
        .sort((a, b) => a.data - b.data);

      escalasFuturas.forEach((escala) => {
        const col = document.createElement("div");
        col.classList.add("col-lg-4", "col-sm-6", "mb-4");

        const card = document.createElement("div");
        card.classList.add("card", "p-3", "bg-dark", "text-white");

        // Título da escala
        const h3 = document.createElement("h3");

        const data = new Date(escala.data);

        const diaSemana = data.toLocaleDateString("pt-BR", { weekday: "long" });
        const dia = String(data.getDate()).padStart(2, "0");
        const mes = String(data.getMonth() + 1).padStart(2, "0");
        const ano = data.getFullYear();

        h3.textContent = `${
          diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)
        } - ${dia}/${mes}/${ano}`;
        h3.style["font-size"] = "1.3rem";
        h3.style["font-weight"] = "bold";
        h3.style["margin-top"] = "2px";
        h3.style["margin-bottom"] = "5px";
        h3.style["padding"] = "0px";

        // Container para os integrantes
        const integrantesDiv = document.createElement("div");
        integrantesDiv.classList.add("row", "g-2");
        integrantesDiv.style["margin-top"] = "2px";

        let integrantesTexto = "**Integrantes:**\n";

        if (escala.integrantes.length > 0) {
          const integrantesTitulo = document.createElement("h4");
          integrantesTitulo.textContent = "Integrantes";
          integrantesTitulo.style["margin-top"] = "5px";
          integrantesTitulo.style["font-size"] = "1rem";
          integrantesTitulo.style["font-weight"] = "bold";
          integrantesDiv.appendChild(integrantesTitulo);

          escala.integrantes.forEach((id) => {
            const integrante = integrantesData.find((p) => p.id === id);
            if (integrante) {
              const col = document.createElement("div");
              col.classList.add("col-2");
              col.style["margin-bottom"] = "13px";

              const img = document.createElement("img");
              img.src = `integrantes/${integrante.nome.toLowerCase()}.jpeg`;
              img.alt = integrante.nome;
              img.classList.add("img-fluid", "rounded");

              col.appendChild(img);
              integrantesDiv.appendChild(col);

              // Adiciona ao texto
              integrantesTexto += `- ${integrante.nome}\n`;
            }
          });
        } else {
          integrantesDiv.innerHTML = "<p>Nenhum integrante cadastrado.</p>";
          integrantesTexto += "Nenhum integrante cadastrado.\n";
        }

        // Container para músicas
        const musicasDiv = document.createElement("div");
        musicasDiv.classList.add("row", "g-3");
        musicasDiv.style["margin-top"] = "2px";

        let musicasTexto = "**Músicas:**\n";

        if (escala.musicas.length > 0) {
          const musicasTitulo = document.createElement("h4");
          musicasTitulo.textContent = "Músicas";
          musicasTitulo.style["margin-top"] = "5px";
          musicasTitulo.style["font-size"] = "1rem";
          musicasTitulo.style["font-weight"] = "bold";
          musicasDiv.appendChild(musicasTitulo);

          escala.musicas.forEach((id) => {
            const musica = musicasData.find((m) => m.id === id);
            if (musica) {
              const col = document.createElement("div");
              col.classList.add("col-4");

              const link = document.createElement("a");
              link.href = `https://www.youtube.com/watch?v=${musica.referLink}`;
              link.target = "_blank";

              const img = document.createElement("img");
              img.src = `https://img.youtube.com/vi/${musica.referLink}/0.jpg`;
              img.alt = `Thumbnail de ${musica.titulo}`;
              img.classList.add("img-fluid", "rounded");

              link.appendChild(img);
              col.appendChild(link);
              musicasDiv.appendChild(col);

              // Adiciona ao texto
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
                (musica.versiculos
                  ? `📖 Versículo: ${musica.versiculos}\n`
                  : "") +
                "\n";
            }
          });

          const categoriasTitulo = document.createElement("h4");
          categoriasTitulo.textContent = "Categorias";
          categoriasTitulo.style["margin-top"] = "10px";
          categoriasTitulo.style["font-size"] = "1rem";
          categoriasTitulo.style["font-weight"] = "bold";
          musicasDiv.appendChild(categoriasTitulo);

          const categoryCount = {};

          escala.musicas.forEach((id) => {
            const musica = musicasData.find((m) => m.id === id);
            if (musica && musica.categorias) {
              let cats = musica.categorias.split(";");
          
              // Contar as ocorrências de cada categoria, removendo espaços extras
              cats.forEach((categoria) => {
                const trimmedCategoria = categoria.trim();
                if (trimmedCategoria) {
                  categoryCount[trimmedCategoria] = (categoryCount[trimmedCategoria] || 0) + 1;
                }
              });
            }
          });
          
          // Ordenar as categorias pela quantidade de ocorrências, da mais frequente para a menos frequente
          const sortedCategories = Object.entries(categoryCount)
            .sort((a, b) => b[1] - a[1])  // Ordenar pelo valor (contagem), do maior para o menor
            .map(([categoria]) => categoria); // Extrair apenas as categorias ordenadas
          
          // Criar os badges com as categorias ordenadas
          sortedCategories.forEach((categoria) => {
            const badge = document.createElement("span");
            badge.textContent = categoria;
            badge.classList.add("badge", "bg-light", "text-dark", "me-1", "col");
            badge.style.margin = "5px";
            badge.style.fontSize = "0.6rem";
            musicasDiv.appendChild(badge);
          });
          

        } else {
          musicasDiv.innerHTML = "<p>Nenhuma música cadastrada.</p>";
          musicasTexto += "Nenhuma música cadastrada.\n";
        }

        // Criar botão de copiar
        const btnCopiar = document.createElement("button");
        btnCopiar.textContent = "Copiar escala";
        btnCopiar.classList.add("btn", "btn-primary", "mt-3");
        btnCopiar.style.width = "100%";

        btnCopiar.onclick = () => {
          const textoParaCopiar = `📅 *Escala: ${h3.textContent}*\n\n${integrantesTexto}\n${musicasTexto}`;

          navigator.clipboard
            .writeText(textoParaCopiar)
            .then(() => {
              alert("Escala copiada para a área de transferência!");
            })
            .catch((err) => {
              console.error("Erro ao copiar:", err);
            });
        };

        // Monta o card
        card.appendChild(h3);
        card.appendChild(integrantesDiv);
        card.appendChild(musicasDiv);
        card.appendChild(btnCopiar);
        col.appendChild(card);
        content.appendChild(col);
      });
    })
    .catch((err) => console.error("Erro ao carregar as escalas:", err));
}

// Cria os botões de categorias (singleton) e os insere acima do repertório
function setupCategoriasButtons(musicas) {
  const categoriesSet = new Set();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0); // Remove horas para evitar problemas de comparação

  const musicasTocadas = new Set();
  historicoEscalas.forEach((escala) => {
    const dataEscala = new Date(escala.data.split("/").reverse().join("-"));
    const diffDias = (dataEscala - hoje) / (1000 * 60 * 60 * 24);
    if (
      Math.abs(diffDias) <= TOCADA_NOS_ULTIMOS_X_DIAS ||
      (diffDias >= 0 && diffDias <= TOCADA_NOS_PROXIMOS_X_DIAS)
    ) {
      escala.musicas.forEach((id) => musicasTocadas.add(id));
    }
  });

  musicas = musicas.filter((musica) => !musicasTocadas.has(musica.id));

  musicas.forEach((musica) => {
    if (musica.categorias) {
      const cats = musica.categorias.split(";").map((c) => c.trim());
      cats.forEach((c) => categoriesSet.add(c));
      musica.categories = cats;
    } else {
      musica.categories = [];
    }
  });

  const uniqueCategories = Array.from(categoriesSet).sort();

  let container = document.querySelector(".categorias-container");
  if (!container) {
    container = document.createElement("div");
    container.classList.add("categorias-container", "mb-3");
    const repContainer = document.querySelector(".repertorio");
    repContainer.parentNode.insertBefore(container, repContainer);
  } else {
    container.innerHTML = "";
  }

  const musicasDisponiveis = {};
  uniqueCategories.forEach((cat) => {
    musicasDisponiveis[cat] = musicas.filter(
      (musica) =>
        musica.categories.includes(cat) && !musicasTocadas.has(musica.id)
    ).length;
  });

  uniqueCategories.forEach((cat) => {
    const button = document.createElement("button");
    button.innerHTML = `${cat} <span class="badge bg-light text-dark">${musicasDisponiveis[cat]}</span>`;
    button.classList.add("btn", "btn-sm", "btn-outline-light", "me-2");
    button.style.margin = "2px";

    button.addEventListener("click", function () {
      if (activeCategories.has(cat)) {
        activeCategories.delete(cat);
        button.classList.remove("active");
      } else {
        activeCategories.add(cat);
        button.classList.add("active");
      }
      renderRepertorio();
    });

    container.appendChild(button);
  });
}

// Função para renderizar as músicas do repertório com base no filtro
function renderRepertorio() {
  const activeArr = Array.from(activeCategories);
  const hoje = new Date();

  // Filtrar músicas tocadas ou agendadas nos últimos/próximos X dias
  const musicasTocadas = new Set();
  historicoEscalas.forEach((escala) => {
    const dataEscala = new Date(escala.data.split("/").reverse().join("-"));
    const diffDias = (dataEscala - hoje) / (1000 * 60 * 60 * 24);
    if (
      Math.abs(diffDias) <= TOCADA_NOS_ULTIMOS_X_DIAS ||
      (diffDias >= 0 && diffDias <= TOCADA_NOS_PROXIMOS_X_DIAS)
    ) {
      escala.musicas.forEach((id) => musicasTocadas.add(id));
    }
  });

  const sortedMusicas = repertorioMusicas.slice().sort((a, b) => {
    const aTocada = musicasTocadas.has(a.id);
    const bTocada = musicasTocadas.has(b.id);

    if (aTocada !== bTocada) {
      return aTocada ? 1 : -1; // Músicas tocadas vão para o final
    }

    if (activeCategories.size > 0) {
      const aExact =
        a.categories.length === activeCategories.size &&
        activeArr.every((c) => a.categories.includes(c));
      const bExact =
        b.categories.length === activeCategories.size &&
        activeArr.every((c) => b.categories.includes(c));

      if (aExact !== bExact) {
        return aExact ? -1 : 1;
      }

      const aMatchCount = a.categories.filter((c) =>
        activeCategories.has(c)
      ).length;
      const bMatchCount = b.categories.filter((c) =>
        activeCategories.has(c)
      ).length;
      if (aMatchCount !== bMatchCount) {
        return bMatchCount - aMatchCount;
      }
    }
    return a.titulo.localeCompare(b.titulo);
  });

  const content = document.querySelector(".repertorio");
  content.innerHTML = "";

  sortedMusicas.forEach((musica) => {
    const col = document.createElement("div");
    col.classList.add("col-lg-3", "col-sm-6", "col-6", "mb-4");
    col.style.paddingLeft = "5px";
    col.style.paddingRight = "5px";
    col.style.marginBottom = "0px!important";

    const card = document.createElement("div");
    card.classList.add("card");

    const link = document.createElement("a");
    link.href = "https://www.youtube.com/watch?v=" + musica.referLink;
    link.target = "_blank";

    const img = document.createElement("img");
    img.src = "https://img.youtube.com/vi/" + musica.referLink + "/0.jpg";
    img.alt = `Thumbnail de ${musica.titulo}`;
    img.classList.add("img-fluid", "rounded");

    const h3 = document.createElement("h3");
    h3.textContent = musica.titulo;
    h3.style.fontSize = "1rem";
    h3.style.paddingTop = "10px";
    h3.style.paddingBottom = "1px";
    h3.style.fontWeight = "bold";
    h3.style.color = "white";

    const h32 = document.createElement("h3");
    h32.textContent = musica.artista;
    h32.style.fontSize = "1rem";
    h32.style.paddingTop = "0px";
    h32.style.paddingBottom = "1px";
    h32.style.color = "white";

    if (musicasTocadas.has(musica.id)) {
      img.style.filter = "grayscale(100%)";
      h3.style.textDecoration = "line-through";
      h32.style.textDecoration = "line-through";
    }

    if (musica.categories.some((c) => activeCategories.has(c))) {
      card.style.border = "2px solid white";
    }

    // Criar container para categorias
    const categoriasContainer = document.createElement("div");
    categoriasContainer.style.margin = "5px";

    musica.categories.forEach((categoria) => {
      const badge = document.createElement("span");
      badge.textContent = categoria;
      badge.classList.add("badge", "bg-light", "text-dark", "me-1");
      badge.style.margin = "5px";
      badge.style.fontSize = "0.6rem";
      categoriasContainer.appendChild(badge);
    });

    link.appendChild(img);
    card.appendChild(link);
    card.appendChild(h3);
    card.appendChild(h32);
    card.appendChild(categoriasContainer);
    col.appendChild(card);
    content.appendChild(col);
  });
}

// Função para carregar o repertório e configurar os filtros de categoria
function carregarRepertorio() {
  fetch("musicas.json")
    .then((res) => res.json())
    .then((data) => {
      repertorioMusicas = data.slice(); // Armazena uma cópia das músicas

      // Preprocessa para extrair as categorias, se houver
      repertorioMusicas.forEach((musica) => {
        if (musica.categorias) {
          musica.categories = musica.categorias.split(";").map((c) => c.trim());
        } else {
          musica.categories = [];
        }
      });

      activeCategories = new Set(); // Reinicia os filtros
      setupCategoriasButtons(repertorioMusicas);
      renderRepertorio();
    })
    .catch((err) => console.error("Erro ao carregar as músicas:", err));
}

async function carregarHistorico() {
  try {
    const response = await fetch("historico.json");
    if (!response.ok) throw new Error("Erro ao carregar o histórico");
    historicoEscalas = await response.json();
    renderRepertorio();
  } catch (error) {
    console.error("Erro ao carregar o histórico:", error);
  }
}

// Chamadas para carregar os dados ao carregar a página
window.onload = async function () {
  await carregarIntegrantes();
  await carregarMusicas();
  await carregarHistorico();
  // renderRepertorio();
  await carregarRepertorio();
  await carregarEscalasFuturas();
};
