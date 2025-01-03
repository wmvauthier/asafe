// Função para carregar e preencher os membros da banda
function carregarIntegrantes() {
  fetch("integrantes/integrantes.json")
    .then((response) => response.json())
    .then((data) => {
      const container = document.querySelector(".row");
      // Guardar os integrantes carregados
      const integrantes = data;

      // Carregar a escala
      fetch("escala.json")
        .then((response) => response.json())
        .then((escala) => {
          // Iterar pelos integrantes tocando
          escala.integrantes_tocando.forEach((integranteEscala) => {
            // Encontrar o integrante completo pelo ID
            const integrante = integrantes.find(
              (i) => i.id === integranteEscala.id
            );
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

              // const h4 = document.createElement('h4');
              // h4.textContent = integrante.nome;

              const p = document.createElement("p");
              p.textContent = `${integranteEscala.funcao}`;
              p.style["margin-bottom"] = "0px";

              memberDiv.appendChild(img);
              memberDiv.appendChild(icon);
              // memberDiv.appendChild(h4);
              memberDiv.appendChild(p);

              col.appendChild(memberDiv);
              container.appendChild(col);
            }
          });
        })
        .catch((err) => console.error("Erro ao carregar a escala:", err));
    })
    .catch((err) => console.error("Erro ao carregar os integrantes:", err));
}

// Função para carregar e preencher as músicas
function carregarMusicas() {
  fetch("musicas.json")
    .then((response) => response.json())
    .then((data) => {
      const content = document.querySelector(".content");
      // Guardar as músicas carregadas
      const musicas = data;

      // Carregar a escala
      fetch("escala.json")
        .then((response) => response.json())
        .then((escala) => {
          // Iterar pelas músicas na escala
          escala.musicas.forEach((musicaEscala) => {
            // Encontrar a música completa pelo ID
            const musica = musicas.find((m) => m.id === musicaEscala.id);
            if (musica) {
              const card = document.createElement("div");
              card.classList.add("col-lg-4", "col-sm-6", "col-12", "mb-4");
              card.classList.add("card");

              const img = document.createElement("img");
              img.src = musica.thumbnail;
              img.alt = `Thumbnail de ${musica.titulo}`;

              const h3 = document.createElement("h3");
              h3.textContent = musica.titulo;

              const a = document.createElement("a");
              a.href = musica.link;
              a.target = "_blank";
              a.textContent = "Assistir no YouTube";

              card.appendChild(img);
              card.appendChild(h3);
              card.appendChild(a);

              content.appendChild(card);
            }
          });
        })
        .catch((err) => console.error("Erro ao carregar a escala:", err));
    })
    .catch((err) => console.error("Erro ao carregar as músicas:", err));
}

// Chamadas para carregar os dados ao carregar a página
window.onload = function () {
  carregarIntegrantes();
  carregarMusicas();
};
