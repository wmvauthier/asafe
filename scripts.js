// Função para carregar e preencher os membros da banda
function carregarIntegrantes() {
  fetch("historico.json")
    .then((response) => response.json())
    .then((escalas) => {
      const hoje = new Date();
      const proximaEscala = escalas
        .filter((escala) => new Date(escala.data) >= hoje) // Filtra apenas datas futuras
        .sort((a, b) => new Date(a.data) - new Date(b.data)) // Ordena da mais próxima para a mais distante
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
              img.src = "integrantes/" + integrante.nome.toLowerCase() + ".jpeg";
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
      const proximaEscala = escalas
        .filter((escala) => new Date(escala.data) >= hoje)
        .sort((a, b) => new Date(a.data) - new Date(b.data))
        .shift();

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
              img.src = "https://img.youtube.com/vi/" + musica.referLink + "/0.jpg";
              img.alt = `Thumbnail de ${musica.titulo}`;

              const h3 = document.createElement("h3");
              h3.textContent = musica.titulo;
              h3.style["font-size"] = "1rem";
              h3.style["padding-bottom"] = "1px";
              h3.style["font-weight"] = "bold";
              h3.style["color"] = "white";

              const h32 = document.createElement("h3");
              h32.textContent = musica.artista;
              h32.style["font-size"] = "1rem";
              h32.style["padding-top"] = "0px";
              h32.style["color"] = "white";

              link.appendChild(img);
              card.appendChild(link);
              card.appendChild(h3);
              card.appendChild(h32);
              col.appendChild(card);

              content.appendChild(col);
            }
          });
        })
        .catch((err) => console.error("Erro ao carregar as músicas:", err));
    })
    .catch((err) => console.error("Erro ao carregar o histórico:", err));
}

// Função para carregar e preencher as músicas
function carregarRepertorio() {
  fetch("musicas.json")
    .then((response) => response.json())
    .then((data) => {
      const content = document.querySelector(".repertorio");
      // Guardar as músicas carregadas
      const musicas = data;

      // Iterar pelas músicas na escala
      musicas.forEach((musica) => {
        // Encontrar a música completa pelo ID

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
        img.src = "https://img.youtube.com/vi/" + musica.referLink + "/0.jpg";
        img.alt = `Thumbnail de ${musica.titulo}`;

        const h3 = document.createElement("h3");
        h3.textContent = musica.titulo;
        h3.style["font-size"] = "1rem";
        h3.style["padding-top"] = "10px";
        h3.style["padding-bottom"] = "1px";
        h3.style["font-weight"] = "bold";
        h3.style["color"] = "white";

        const h32 = document.createElement("h3");
        h32.textContent = musica.artista;
        h32.style["font-size"] = "1rem";
        h32.style["padding-top"] = "0px";
        h32.style["padding-bottom"] = "1px";
        h32.style["color"] = "grey";

        link.appendChild(img);
        card.appendChild(link);
        card.appendChild(h3);
        card.appendChild(h32);
        col.appendChild(card);

        content.appendChild(col);
      });
    })
    .catch((err) => console.error("Erro ao carregar as músicas:", err));
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

      console.log(escalas);
      console.log(escalasFuturas);      

      escalasFuturas.forEach((escala) => {
        const col = document.createElement("div");
        col.classList.add("col-lg-4", "col-sm-6", "mb-4");

        const card = document.createElement("div");
        card.classList.add("card", "p-3", "bg-dark", "text-white");

        // Título da escala
        const h3 = document.createElement("h3");

        const data = new Date(escala.data); // Certifique-se de que escala.data é uma string no formato "YYYY-MM-DD" ou similar

        const diaSemana = data.toLocaleDateString("pt-BR", { weekday: "long" });
        const dia = String(data.getDate()).padStart(2, "0");
        const mes = String(data.getMonth() + 1).padStart(2, "0");
        const ano = data.getFullYear();
        
        h3.textContent = `${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)} - ${dia}/${mes}/${ano}`;        

        h3.style["font-size"] = "1.2rem";
        h3.style["font-weight"] = "bold";
        h3.style["margin-bottom"] = "0px";
        h3.style["padding"] = "0px";
        h3.style["padding-bottom"] = "0px";

        // Container para os integrantes (4 por linha)
        const integrantesDiv = document.createElement("div");
        integrantesDiv.classList.add("row", "g-2"); // Adiciona uma row para organizar em 4 colunas

        if (escala.integrantes.length > 0) {

          const integrantesTitulo = document.createElement("h4");
          integrantesTitulo.textContent = "Integrantes";
          integrantesTitulo.style["margin-top"] = "5px";
          integrantesTitulo.style["margin-bottom"] = "10px";
          integrantesTitulo.style["font-size"] = "1rem";
          integrantesTitulo.style["font-weight"] = "bold";
          integrantesDiv.appendChild(integrantesTitulo);

          escala.integrantes.forEach((id) => {
            const integrante = integrantesData.find((p) => p.id === id);
            if (integrante) {
              const col = document.createElement("div");
              col.classList.add("col-2"); // 4 colunas por linha

              const img = document.createElement("img");
              img.src = `integrantes/${integrante.nome.toLowerCase()}.jpeg`;
              img.alt = integrante.nome;
              img.classList.add("img-fluid", "rounded");

              col.appendChild(img);
              integrantesDiv.appendChild(col);
            }
          });
        } else {
          integrantesDiv.innerHTML = "<p>Nenhum integrante cadastrado.</p>";
        }

        // Container para músicas (3 por linha)
        const musicasDiv = document.createElement("div");
        musicasDiv.classList.add("row", "g-3"); // Adiciona uma row para organizar em 3 colunas

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
              col.classList.add("col-4"); // 3 colunas por linha

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
            }
          });
        } else {
          musicasDiv.innerHTML = "<p>Nenhuma música cadastrada.</p>";
        }

        // Monta o card
        card.appendChild(h3);
        card.appendChild(integrantesDiv);
        card.appendChild(musicasDiv);
        col.appendChild(card);
        content.appendChild(col);
      });
    })
    .catch((err) => console.error("Erro ao carregar as escalas:", err));
}

// Chamadas para carregar os dados ao carregar a página
window.onload = function () {
  carregarIntegrantes();
  carregarMusicas();
  carregarRepertorio();
  carregarEscalasFuturas();
};
