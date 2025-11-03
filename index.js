let TOCADA_NOS_ULTIMOS_X_DIAS = 56;
let TOCADA_NOS_PROXIMOS_X_DIAS = 56;

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
              col.style.paddingLeft = "5px";
              col.style.paddingRight = "5px";
              col.style.marginBottom = "5px";

              const memberDiv = document.createElement("div");
              memberDiv.classList.add("band-member", "text-center");
              memberDiv.style.position = "relative";

              const img = document.createElement("img");
              img.src =
                "integrantes/" + integrante.nome.toLowerCase() + ".jpeg";
              img.alt = integrante.nome;
              img.classList.add("img-fluid", "rounded");

              // 🔥 Verifica se esse integrante está em header
              if (proximaEscala.header?.includes(integranteEscala)) {
                img.classList.add("integrante-header");

                const crown = document.createElement("div");
                crown.textContent = "👑";
                crown.classList.add("crown-icon");
                memberDiv.appendChild(crown);
              }

              const icon = document.createElement("i");
              icon.classList.add(...integrante.icon.split(" "));
              icon.style.display = "block";
              icon.style.marginTop = "4px";

              const p = document.createElement("p");
              p.style.marginBottom = "0px";
              // Caso você tenha uma propriedade função no integrante, pode ativar:
              // p.textContent = integrante.funcao || "";

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

          // Calcula resumo de categorias e níveis
          const resumoCategorias = {};
          const resumoLevels = {};

          proximaEscala.musicas.forEach((id) => {
            const musica = musicas.find((m) => m.id === id);
            if (musica) {
              // Categorias
              if (musica.categorias) {
                const categorias = musica.categorias
                  .split(";")
                  .map((c) => c.trim());
                categorias.forEach((cat) => {
                  resumoCategorias[cat] = (resumoCategorias[cat] || 0) + 1;
                });
              }

              // Levels
              if (musica.level && typeof musica.level === "object") {
                Object.entries(musica.level).forEach(
                  ([instrumento, dificuldade]) => {
                    if (!resumoLevels[instrumento]) {
                      resumoLevels[instrumento] = {
                        easy: 0,
                        medium: 0,
                        hard: 0,
                      };
                    }
                    if (["easy", "medium", "hard"].includes(dificuldade)) {
                      resumoLevels[instrumento][dificuldade]++;
                    }
                  }
                );
              }
            }
          });

          //**
          // Adiciona o painel de resumo antes da lista de músicas
          content.innerHTML = ""; // Limpa a lista

          const resumoDiv = document.createElement("div");
          resumoDiv.classList.add("mb-4", "text-white");
          // resumoDiv.style.padding = "0px!important";
          resumoDiv.style["padding"] = "0px!important";

          // Container dos badges
          const badgeContainer = document.createElement("div");
          badgeContainer.style.display = "flex";
          badgeContainer.style.flexWrap = "wrap";
          // badgeContainer.style.gap = "6px";

          // === BADGES DE CATEGORIAS ===
          const totalMusicas = proximaEscala.musicas.length;

          const sortedCategories = Object.entries(resumoCategorias).sort(
            (a, b) => b[1] - a[1]
          );

          sortedCategories.forEach(([categoria, count]) => {
            const porcentagem = (count / totalMusicas) * 100;
            let level;

            if (count === 1) {
              level = "hard";
            } else if (porcentagem > 50) {
              level = "easy";
            } else {
              level = "medium";
            }

            let colorClass, textColor;
            switch (level) {
              case "hard":
                colorClass = "bg-danger";
                textColor = "text-white";
                break;
              case "medium":
                colorClass = "bg-warning";
                textColor = "text-dark";
                break;
              case "easy":
                colorClass = "bg-success";
                textColor = "text-white";
                break;
            }

            if (level == "easy") {
              const badge = document.createElement("span");
              badge.textContent = categoria;
              badge.classList.add("badge", colorClass, textColor);
              badge.style.fontSize = "0.7rem";
              badge.style.margin = "2px";
              badgeContainer.appendChild(badge);
            }
          });

          // === BADGES DE LEVELS POR INSTRUMENTO ===
          const levelPoints = { easy: 1, medium: 3, hard: 5 };
          const levelTotals = {};

          proximaEscala.musicas.forEach((id) => {
            const musica = musicas.find((m) => m.id === id);
            if (musica?.level && typeof musica.level === "object") {
              Object.entries(musica.level).forEach(
                ([instrumento, dificuldade]) => {
                  if (!dificuldade || !levelPoints[dificuldade]) return;
                  if (!levelTotals[instrumento]) levelTotals[instrumento] = 0;
                  levelTotals[instrumento] += levelPoints[dificuldade];
                }
              );
            }
          });

          Object.entries(levelTotals).forEach(([instrumento, totalPontos]) => {
            let levelDoDia;
            if (totalPontos >= 10) {
              levelDoDia = "hard";
            } else if (totalPontos >= 6) {
              levelDoDia = "medium";
            } else {
              levelDoDia = "easy";
            }

            let colorClass, textColor;
            switch (levelDoDia) {
              case "hard":
                colorClass = "bg-danger";
                textColor = "text-white";
                break;
              case "medium":
                colorClass = "bg-warning";
                textColor = "text-dark";
                break;
              case "easy":
                colorClass = "bg-success";
                textColor = "text-white";
                break;
            }

            const formattedInstrument =
              instrumento.charAt(0).toUpperCase() + instrumento.slice(1);

            const badge = document.createElement("span");
            badge.textContent = formattedInstrument;
            badge.classList.add("badge", colorClass, textColor);
            badge.style.fontSize = "0.7rem";
            badge.style.margin = "2px";
            badgeContainer.appendChild(badge);
          });

          // Adiciona tudo no DOM
          resumoDiv.appendChild(badgeContainer);
          content.appendChild(resumoDiv);

          //** */

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
                badge.style.margin = "1px";
                badge.style.fontSize = "0.6rem";
                categoriasContainer.appendChild(badge);
              });

              if (musica.level && typeof musica.level === "object") {
                Object.entries(musica.level).forEach(([key, value]) => {
                  if (!value) return; // Se o valor for undefined/null, ignora

                  let colorClass, textColor;
                  switch (value) {
                    case "hard":
                      colorClass = "bg-danger"; // Vermelho
                      textColor = "text-white"; // Texto branco
                      break;
                    case "medium":
                      colorClass = "bg-warning"; // Amarelo
                      textColor = "text-dark"; // Texto preto
                      break;
                    case "easy":
                      colorClass = "bg-success"; // Verde
                      textColor = "text-white"; // Texto branco
                      break;
                    default:
                      colorClass = "bg-secondary"; // Cinza (caso tenha valores inesperados)
                      textColor = "text-dark"; // Texto preto por padrão
                  }

                  // Cria o badge
                  const badge = document.createElement("span");
                  badge.textContent = `${
                    key.charAt(0).toUpperCase() + key.slice(1)
                  }`;
                  badge.classList.add("badge", colorClass, textColor, "me-1");
                  badge.style.margin = "1px";
                  badge.style.fontSize = "0.6rem";

                  // Adiciona ao container
                  categoriasContainer.appendChild(badge);
                });
              } else {
                console.warn(
                  "musica.level não está definido ou não é um objeto."
                );
              }

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

        h3.textContent = `📅 ${
          diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)
        } - ${dia}/${mes}/${ano}`;
        h3.style["font-size"] = "1.3rem";
        h3.style["font-weight"] = "bold";
        h3.style["margin-top"] = "2px";
        h3.style["margin-bottom"] = "5px";
        h3.style["padding"] = "0px";

        // Container para os integrantes
        const integrantesDiv = document.createElement("div");
        integrantesDiv.classList.add("row", "g-3");
        integrantesDiv.style["margin-top"] = "2px";

        let integrantesTexto = `🧑‍🤝‍🧑 ** Integrantes:**\n`;

        if (escala.integrantes.length > 0) {
          const integrantesTitulo = document.createElement("h4");
          integrantesTitulo.textContent = "🧑‍🤝‍🧑 Integrantes";
          integrantesTitulo.style["margin-top"] = "5px";
          integrantesTitulo.style["font-size"] = "1rem";
          integrantesTitulo.style["font-weight"] = "bold";
          integrantesDiv.appendChild(integrantesTitulo);

          escala.integrantes.forEach((id) => {
            const integrante = integrantesData.find((p) => p.id === id);
            if (integrante) {
              const col = document.createElement("div");
              col.classList.add("col-3");
              col.style["margin-bottom"] = "13px";

              const imgWrapper = document.createElement("div");
              imgWrapper.style.position = "relative"; // para posicionar a coroa
              imgWrapper.style.display = "inline-block";

              const img = document.createElement("img");
              img.src = `integrantes/${integrante.nome.toLowerCase()}.jpeg`;
              img.alt = integrante.nome;
              img.classList.add("img-fluid", "rounded");

              // 👉 Se for header, adiciona borda e coroa
              if (escala.header?.includes(id)) {
                img.style.border = "3px solid gold"; // borda amarela
                img.style.boxShadow = "0 0 10px gold";

                // Adiciona um símbolo de coroa (pode ser substituído por <img>)
                const crown = document.createElement("div");
                crown.textContent = "👑";
                crown.style.position = "absolute";
                crown.style.top = "-25px";
                crown.style.right = "-8px";
                crown.style.fontSize = "15px";
                crown.style.textShadow = "0 0 3px black";

                imgWrapper.appendChild(crown);
              }

              imgWrapper.appendChild(img);
              col.appendChild(imgWrapper);
              integrantesDiv.appendChild(col);

              // Adiciona ao texto
              integrantesTexto += `- ${integrante.nome}`;
              if (escala.header?.includes(id)) {
                integrantesTexto += " 👑";
              }
              integrantesTexto += "\n";
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
          musicasTitulo.textContent = "🎶 Músicas";
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
          categoriasTitulo.textContent = "📌 Categorias";
          categoriasTitulo.style["margin-top"] = "10px";
          categoriasTitulo.style["font-size"] = "1rem";
          categoriasTitulo.style["font-weight"] = "bold";
          musicasDiv.appendChild(categoriasTitulo);

          const categoryCount = {};
          const totalMusicas = escala.musicas.length;

          // Conta quantas vezes cada categoria aparece
          escala.musicas.forEach((id) => {
            const musica = musicasData.find((m) => m.id === id);
            if (musica?.categorias) {
              let cats = musica.categorias.split(";");

              cats.forEach((categoria) => {
                const trimmedCategoria = categoria.trim();
                if (trimmedCategoria) {
                  categoryCount[trimmedCategoria] =
                    (categoryCount[trimmedCategoria] || 0) + 1;
                }
              });
            }
          });

          // Ordena as categorias da mais comum pra menos comum
          const sortedCategories = Object.entries(categoryCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

          // Cria os badges com cor baseada na "afinidade"
          sortedCategories.forEach(([categoria, count]) => {
            const porcentagem = (count / totalMusicas) * 100;
            let level;

            if (count === 1) {
              level = "hard";
            } else if (porcentagem > 50) {
              level = "easy";
            } else {
              level = "medium";
            }

            // Define a cor do badge
            let colorClass, textColor;
            switch (level) {
              case "hard":
                colorClass = "bg-danger";
                textColor = "text-white";
                break;
              case "medium":
                colorClass = "bg-warning";
                textColor = "text-dark";
                break;
              case "easy":
                colorClass = "bg-success";
                textColor = "text-white";
                break;
            }

            // if (level == "easy") {
            const badge = document.createElement("span");
            badge.textContent = `${categoria}`;
            badge.classList.add("badge", colorClass, textColor, "me-1", "col");
            badge.style.margin = "1px";
            badge.style.fontSize = "0.6rem";

            musicasDiv.appendChild(badge);
            // }
          });

          const levelsTitulo = document.createElement("h4");
          levelsTitulo.textContent = "🏷️Levels";
          levelsTitulo.style["margin-top"] = "10px";
          levelsTitulo.style["font-size"] = "1rem";
          levelsTitulo.style["font-weight"] = "bold";
          musicasDiv.appendChild(levelsTitulo);

          const levelPoints = { easy: 1, medium: 3, hard: 5 }; // Pontuação

          const levelTotals = {}; // Acumulador por instrumento

          // Itera sobre todas as músicas do repertório
          escala.musicas.forEach((id) => {
            const musica = musicasData.find((m) => m.id === id);
            if (musica?.level && typeof musica.level === "object") {
              Object.entries(musica.level).forEach(
                ([instrumento, dificuldade]) => {
                  if (!dificuldade || !levelPoints[dificuldade]) return;

                  // Acumula os pontos de dificuldade por instrumento
                  if (!levelTotals[instrumento]) {
                    levelTotals[instrumento] = 0;
                  }
                  levelTotals[instrumento] += levelPoints[dificuldade];
                }
              );
            }
          });

          // Agora percorremos os totais para determinar o "level do dia"
          Object.entries(levelTotals).forEach(([instrumento, totalPontos]) => {
            let levelDoDia;
            if (totalPontos >= 10) {
              levelDoDia = "hard";
            } else if (totalPontos >= 6) {
              levelDoDia = "medium";
            } else {
              levelDoDia = "easy";
            }

            let colorClass, textColor;
            switch (levelDoDia) {
              case "hard":
                colorClass = "bg-danger";
                textColor = "text-white";
                break;
              case "medium":
                colorClass = "bg-warning";
                textColor = "text-dark";
                break;
              case "easy":
                colorClass = "bg-success";
                textColor = "text-white";
                break;
            }

            // Formata o nome do instrumento
            const formattedInstrument =
              instrumento.charAt(0).toUpperCase() + instrumento.slice(1);

            // Cria o badge
            const badge = document.createElement("span");
            badge.textContent = `${formattedInstrument}`;
            badge.classList.add("badge", "col", colorClass, textColor, "me-1");
            badge.style.margin = "1px";
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

  // Filtra músicas que não foram tocadas
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

  // Cria um objeto com a quantidade de músicas disponíveis para cada categoria
  const musicasDisponiveis = {};
  categoriesSet.forEach((cat) => {
    musicasDisponiveis[cat] = musicas.filter(
      (musica) =>
        musica.categories.includes(cat) &&
        !musicasTocadas.has(musica.id) &&
        !musica.ban
    ).length;
  });

  // Ordena as categorias pela quantidade, em ordem decrescente
  const sortedCategories = Object.keys(musicasDisponiveis).sort(
    (a, b) => musicasDisponiveis[b] - musicasDisponiveis[a]
  );

  let container = document.querySelector(".categorias-container");
  if (!container) {
    container = document.createElement("div");
    container.classList.add("categorias-container", "mb-3");
    const repContainer = document.querySelector(".repertorio");
    repContainer.parentNode.insertBefore(container, repContainer);
  } else {
    container.innerHTML = "";
  }

  sortedCategories.forEach((cat) => {
    if (musicasDisponiveis[cat] > 0) {
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
    }
  });
}

// Função para renderizar as músicas do repertório com base no filtro
function renderRepertorio() {
  const activeArr = Array.from(activeCategories);
  const hoje = new Date();

  // --- Contagem de execuções (TODO o histórico) normalizando ID como string
  const contagemMusicas = new Map();

  // Mantém o set de "tocadas" dentro da janela caso você use em outro lugar
  const musicasTocadas = new Set();

  historicoEscalas.forEach((escala) => {
    // 1) Conta SEM janela (histórico completo)
    escala.musicas.forEach((rawId) => {
      const id = String(rawId);
      contagemMusicas.set(id, (contagemMusicas.get(id) || 0) + 1);
    });

    // 2) Opcional: marca tocadas dentro da janela (se ainda precisar disso)
    const [dia, mes, ano] = escala.data.split("/");
    const dataEscala = new Date(`${ano}-${mes}-${dia}T00:00:00`);
    const diffDias = (dataEscala - hoje) / (1000 * 60 * 60 * 24);
    const dentroDaJanela =
      Math.abs(diffDias) <= TOCADA_NOS_ULTIMOS_X_DIAS ||
      (diffDias >= 0 && diffDias <= TOCADA_NOS_PROXIMOS_X_DIAS);

    if (dentroDaJanela) {
      escala.musicas.forEach((rawId) => {
        const id = String(rawId);
        musicasTocadas.add(id);
      });
    }
  });

  const sortedMusicas = repertorioMusicas.slice().sort((a, b) => {
    // Prioridade 1: músicas banidas sempre por último
    if (a.ban !== b.ban) return a.ban ? 1 : -1;

    // Prioridade 2: menos tocada primeiro (usando o HISTÓRICO COMPLETO)
    const aCount = contagemMusicas.get(String(a.id)) || 0;
    const bCount = contagemMusicas.get(String(b.id)) || 0;
    if (aCount !== bCount) return aCount - bCount;

    // Prioridade 3: categorias ativas (exato > mais matches)
    if (activeCategories.size > 0) {
      const aExact =
        a.categories.length === activeCategories.size &&
        activeArr.every((c) => a.categories.includes(c));
      const bExact =
        b.categories.length === activeCategories.size &&
        activeArr.every((c) => b.categories.includes(c));

      if (aExact !== bExact) return aExact ? -1 : 1;

      const aMatchCount = a.categories.filter((c) =>
        activeCategories.has(c)
      ).length;
      const bMatchCount = b.categories.filter((c) =>
        activeCategories.has(c)
      ).length;

      if (aMatchCount !== bMatchCount) return bMatchCount - aMatchCount;
    }

    // Prioridade 4: ordem alfabética
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

    if (musicasTocadas.has(musica.id) || musica.ban == true) {
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
      badge.style.margin = "1px";
      badge.style.fontSize = "0.6rem";
      categoriasContainer.appendChild(badge);
    });

    if (musica.level && typeof musica.level === "object") {
      Object.entries(musica.level).forEach(([key, value]) => {
        if (!value) return; // Se o valor for undefined/null, ignora

        let colorClass, textColor;
        switch (value) {
          case "hard":
            colorClass = "bg-danger"; // Vermelho
            textColor = "text-white"; // Texto branco
            break;
          case "medium":
            colorClass = "bg-warning"; // Amarelo
            textColor = "text-dark"; // Texto preto
            break;
          case "easy":
            colorClass = "bg-success"; // Verde
            textColor = "text-white"; // Texto branco
            break;
          default:
            colorClass = "bg-secondary"; // Cinza (caso tenha valores inesperados)
            textColor = "text-dark"; // Texto preto por padrão
        }

        // Cria o badge
        const badge = document.createElement("span");
        badge.textContent = `${key.charAt(0).toUpperCase() + key.slice(1)}`;
        badge.classList.add("badge", colorClass, textColor, "me-1");
        badge.style.margin = "1px";
        badge.style.fontSize = "0.6rem";

        // Adiciona ao container
        categoriasContainer.appendChild(badge);
      });
    } else {
      console.warn("musica.level não está definido ou não é um objeto.");
    }

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
