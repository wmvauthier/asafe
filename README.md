# Projeto Asafe

Aplicação para organizar escalas e repertórios de uma banda/ministério de louvor, consultar o catálogo musical e acompanhar participação, preferências e títulos dos integrantes.

## Executar localmente

Não há instalação de dependências nem compilação. Na raiz do projeto:

```sh
python3 -m http.server 5502 --bind 127.0.0.1
```

Acesse <http://localhost:5502>. Também é possível usar o Live Server do VS Code, configurado na porta 5502. Use um servidor HTTP: abrir `index.html` via `file://` pode impedir o carregamento dos JSONs por `fetch`.

A aplicação pode ser hospedada em um servidor estático que preserve os caminhos relativos. As imagens e links do YouTube precisam de internet; a cópia para a área de transferência depende das permissões do navegador e de contexto seguro (HTTPS ou localhost).

## Arquitetura atual

HTML, CSS e JavaScript puro, executados no navegador. Não há backend, banco de dados, autenticação, framework, gerenciador de pacotes ou processo de build. A interface principal é uma página única com quatro destinos principais; a navegação alterna sua visibilidade, sem roteador ou mudança de URL.

```text
index.html + index.css + mobile-ui.css
        |
      app.js + mobile-ui.js <-- fetch -- musicas.json
        |                historico.json
        |                integrantes/integrantes.json
        v
Normalização -> estado em memória -> regras e estatísticas -> DOM
        |
        +-- localStorage: preferências, filtros e rascunhos
```

| Caminho | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura, navegação desktop/mobile e pontos de montagem das telas |
| `app.js` | Inicialização, estado, regras de negócio, consultas e renderização |
| `index.css` | Estilos base e componentes de estatísticas/análises |
| `mobile-ui.css` | Hierarquia mobile-first, cards de músicas, navegação, montagem e detalhes; carregado após os estilos base |
| `mobile-ui.js` | Componentes de música, detalhes, resultados da busca, reordenação e navegação da banda |
| `musicas.json` | Catálogo musical compartilhado |
| `historico.json` | Eventos realizados e escalas futuras |
| `integrantes/integrantes.json` | Cadastro e habilidades dos integrantes |
| `artistas/` | Fotos dos artistas e imagem padrão |
| `integrantes/` | Fotos dos integrantes e imagem padrão |
| `docs/curadoria-musical.md` | Anotações humanas de curadoria, fora da execução |
| `.vscode/settings.json` | Porta do Live Server |
| `tests/repertoire.test.cjs` | Regressão das regras, persistência, reordenação e referências dos dados |

### Inicialização e estado

`DOMContentLoaded` chama `init()`, que carrega os três JSONs em paralelo com `Promise.all`. `normalizeSongs()` transforma categorias em arrays e prepara caminhos de imagens; `normalizeHistory()` converte datas e normaliza listas. Depois são calculadas categorias e popularidade, conectados os eventos e renderizadas as telas.

Os dados ficam nas variáveis globais `integrantes`, `musicas`, `historico` e `categorias`. `popularityCache` guarda a classificação calculada na inicialização. O objeto `state` concentra preferências e rascunhos; suas chaves de armazenamento usam o prefixo `asafe:v2:`.

As funções de renderização criam elementos com APIs do DOM e templates HTML. `escapeHTML()` e `escapeAttr()` são os helpers de escape disponíveis para valores interpolados. `app.js` mantém o domínio, o carregamento e a composição das telas; `mobile-ui.js` concentra os componentes da nova experiência. Os scripts ainda compartilham estado global e são carregados nessa ordem, sem módulos ES ou compilação. O objeto `ui` guarda apenas o estado transitório da interface (modo de montagem, etapa, filtros abertos e detalhes).

### Telas e fluxos

- **Próximo:** cabeçalho compacto, repertório na ordem, ações, equipe com nomes/papéis e análise recolhível. As músicas vêm antes dos integrantes.
- **Agenda:** todos os cultos futuros, incluindo o próximo, com preview visual no card fechado: capa ampla com data sobre degradê, no mesmo estilo dos cards de música, usando a música mais executada do repertório (contagem histórica, desempate pela ordem da escala), fotos da equipe em uma faixa de até nove colunas, nomes de header/ministrante e quatro métricas apenas com ícone e porcentagem. Sem repertório, as métricas mostram travessões em vez de percentuais fictícios. Ao expandir, aparecem as músicas, a montagem do rascunho e uma grade de integrantes que aproveita a largura disponível. Papéis cadastrados fora da lista de participantes também são exibidos, sem duplicar pessoas.
- **Músicas:** catálogo independente do montador, com busca contínua, filtros recolhíveis e disponibilidade. A busca atualiza somente os resultados para preservar foco e digitação.
- **Banda:** reúne Wrapped, integrantes e títulos em três abas. Wrapped usa período/integrante; títulos usam o período para os rankings e o integrante para destaque individual.

A montagem começa em um culto e oferece **Selecionadas**, **Adicionar** e **Sugestões**. O contexto da data acompanha a rolagem, e uma barra inferior com a contagem substitui a navegação mobile. É possível adicionar, remover, reordenar, aplicar uma sugestão e copiar o rascunho. Qualquer culto futuro pode ter um rascunho, inclusive o próximo e os que já possuem músicas. Se ainda não há rascunho salvo, ele começa com as músicas cadastradas no evento; o histórico original não é alterado.

Os cards de músicas separam identificação, contexto e ações, com capa ampla na proporção 16:10, título e artista sobre um degradê de contraste e número da faixa no canto da imagem. Categorias, dificuldade média, popularidade e disponibilidade usam mini badges com ícones SVG locais; até duas categorias aparecem no card, com indicação das demais. O título aceita duas linhas; detalhes apresentam capa e título integrados, botão Ouvir junto às qualificações e aviso de disponibilidade contextual. Categorias, dificuldade por instrumento (ícones e indicadores de três níveis) e histórico ficam em três painéis; as estatísticas do artista/categorias ficam recolhidas dentro do histórico. O botão **Ouvir** abre a referência do YouTube nos detalhes e no rodapé dos cards fora da montagem. A capa/título abre os detalhes; não há botão redundante para essa ação. Os ícones de ações e qualificações usam traços consistentes, sem dependências externas. Os detalhes usam um diálogo nativo em tela cheia no mobile, com retorno à lista e suporte a Escape, preservando busca e rolagem.

As chaves `asafe:v2:` dos rascunhos e filtros foram mantidas. Valores antigos de tela `wrapped`/`titulos` são encaminhados para a aba correspondente em Banda.

## Modelo de dados

Os relacionamentos usam IDs numéricos. Preserve os IDs existentes: renumerar cadastros quebra referências históricas e rascunhos.

### Músicas (`musicas.json`)

Array de objetos com:

- `id`: identificador numérico único.
- `titulo` e `artista`: nomes exibidos.
- `referLink`: ID do vídeo no YouTube, não a URL completa.
- `categorias`: texto separado por ponto e vírgula; a normalização também aceita vírgulas ou array.
- `versiculos`: campo de texto disponível no cadastro.
- `level`: dificuldade por instrumento, com `easy`, `medium`, `hard` ou vazio.
- `intensidade`: `"baixa"`, `"media"`, `"alta"` ou `null` (não informada). Intensidade musical é independente da dificuldade técnica; não é inferida automaticamente.

O código também reconhece `banned: true` ou `ban: true`, mas o catálogo auditado não contém esses campos. As notas de curadoria não são importadas automaticamente.

### Informar intensidade

Edite o campo `intensidade` no objeto da música em `musicas.json`. Por exemplo, use `"intensidade": "media"` para Média. Os valores canônicos são `baixa`, `media` e `alta`; a leitura também normaliza maiúsculas e acentos. Campo ausente, vazio ou inválido é tratado como não informado. As músicas receberam `null` inicialmente, sem classificação automática.

Depois de salvar e recarregar a página, a intensidade aparece nos badges, na escala visual dos detalhes e no filtro da biblioteca. Não há edição de intensidade pela interface nem sobreposição no armazenamento do navegador. O filtro de intensidade preserva a ordenação do ciclo das músicas.

### Insights por integrante

A ficha da música compara **Tocaram** e **Escolheram**, usando apenas eventos anteriores a hoje em que a música está presente:

- Participação: integrante listado em `integrantes`.
- Escolha: integrante listado em `header`, mesmo quando não está na lista de participantes.
- Cada integrante conta no máximo uma vez por evento em cada métrica; IDs desconhecidos são ignorados.
- Rankings mostram até três integrantes em cada direção; os menores valores consideram apenas registros positivos. Quem tem zero fica em **Nunca tocaram/escolheram**.
- Empates são ordenados por nome, com acesso à lista completa. Se todos têm a mesma contagem, isso é indicado em vez de criar um grupo artificial de menos participações.
- Sem eventos passados, a ficha apresenta um estado vazio, sem ranking ou preferências presumidas.

As contagens dependem do preenchimento do histórico, não indicam oportunidade de participação ou preferência pessoal.

### Integrantes (`integrantes/integrantes.json`)

Array de objetos com `id`, `nome`, `icon` e `function`. O campo `function` é um array de objetos que associa instrumentos a níveis técnicos; um integrante pode ter várias habilidades. Não confundir esse cadastro de capacidades com a definição do instrumento efetivamente tocado em cada evento.

### Eventos (`historico.json`)

Array de objetos com:

- `data`: formato `DD/MM/AAAA`.
- `integrantes`: IDs dos participantes.
- `musicas`: IDs das músicas; array vazio representa repertório ainda não definido.
- `header` e `minister`: IDs dos responsáveis nos respectivos papéis.
- `faltas`: presente em alguns registros, sem tratamento específico na aplicação atual.

O mesmo arquivo guarda passado e futuro. A aplicação separa os eventos pela data local do navegador, sem um campo explícito de conclusão. O Wrapped considera eventos anteriores a hoje e com músicas cadastradas.

Na auditoria de 23/11/2026 havia 80 músicas, 17 integrantes e 97 eventos, entre 02/02/2025 e 29/11/2026. Não foram encontrados IDs duplicados nos cadastros nem referências inexistentes em `musicas`, `integrantes`, `header` e `minister` dos eventos. Esses números são um retrato da auditoria, não limites do sistema.

## Persistência e manutenção dos dados

Os JSONs são a fonte compartilhada. Para cadastrar músicas, integrantes ou escalas, edite os respectivos arquivos e publique a versão atualizada no servidor estático.

O navegador salva apenas preferências e rascunhos no `localStorage`. Montar, limpar ou copiar um repertório não escreve em `historico.json`. Os rascunhos não são sincronizados entre dispositivos e podem ser perdidos ao limpar o armazenamento do navegador. A cópia produz texto com escala, análises e links do YouTube.

Antes de atualizar os dados:

1. Verifique JSON válido e IDs únicos.
2. Confira se cada ID referenciado existe no cadastro correspondente.
3. Use datas válidas em `DD/MM/AAAA` e listas de IDs numéricos.
4. Preserve fotos e caminhos esperados por `memberImg()` e pelo campo normalizado `_artistImage`, incluindo imagens padrão.
5. Confira as telas e o console após recarregar a aplicação.

## Ordenação da biblioteca e ciclo de liberação

Na aba **Músicas**, inclusive após aplicar busca/filtros:

1. **Disponíveis:** menor número de execuções primeiro (inéditas ficam no início).
2. **Bloqueadas pelo intervalo:** última execução mais antiga primeiro.
3. **Agendadas:** próximo agendamento mais próximo primeiro, incluindo hoje.
4. **Banidas permanentemente:** ao final, sem promessa de liberação.

Empates usam título e ID. Uma música recente que também está agendada pertence ao grupo Agendadas, conforme a prioridade de status existente. A montagem de repertório mantém a ordenação contextual por afinidade de categorias.

Cards bloqueados e agendados exibem **Libera em X dias**. A regra existente bloqueia até o 56º dia inclusive, portanto a liberação é no 57º dia após a execução. Para agendadas, a espera até o culto também entra na contagem; se houver várias reservas, a data de liberação considera a última delas. O badge usa dias de calendário e informa a data completa na descrição acessível. Trata-se de uma previsão baseada no histórico e nos agendamentos cadastrados; alterações nas escalas alteram essa previsão. As regras são recalculadas ao carregar a aplicação.

## Regras de repertório

- **Intervalo:** `COOLDOWN_DAYS = 56`; uma música tocada até 56 dias antes da data de referência é considerada recente.
- **Agendamento:** músicas programadas para outro culto futuro são identificadas como agendadas.
- **Banimento:** flags `banned`/`ban` excluem músicas das sugestões. A inclusão manual permite músicas indisponíveis com alerta, inclusive banidas; não é um bloqueio absoluto.
- **Categorias:** em qualquer trio do rascunho, pelo menos duas músicas devem compartilhar alguma categoria. A inclusão que viola a regra é recusada.
- **Popularidade:** ranking de execuções passadas, com desempate por título; `índice / total <= 0,15` define clássicas, até `0,6` comuns, e as demais raras. É posição relativa no catálogo, não um limiar fixo de execuções.
- **Análises:** segurança, familiaridade, desafio e renovação combinam dificuldade, habilidades dos participantes, exposições anteriores, popularidade e disponibilidade. São indicadores heurísticos, não medições objetivas.
- **Sugestões:** até cinco trios distintos, nas estratégias Favoritas do Time, Fácil, Mediano, Desafiador e Renovação. A seleção usa candidatos elegíveis, pesos e combinações limitadas; não busca exaustivamente todas as possibilidades.

As sugestões são calculadas localmente, sem IA ou API externa. Os principais pontos de entrada são `analyzeSet()`, `generateSuggestedPlaylists()`, `getSongStatus()`, `classifyPopularity()`, `computeWrapped()` e `computeTitleGallery()`.

## Limitações conhecidas

- A data é a chave do culto/rascunho (`cultKey()`); dois cultos no mesmo dia não são distinguidos.
- Não há validação formal de esquema de cada registro dos JSONs. O carregamento verifica o status HTTP e o formato de array; falhas exibem mensagem com opção de tentar novamente.
- Os cálculos fazem várias buscas e filtragens sobre arrays. O aumento do histórico pode exigir índices e cache por contexto.
- A data local do navegador determina passado/futuro; algumas análises combinam histórico anterior ao culto com popularidade acumulada até hoje.
- O estado global e a concentração de responsabilidades dificultam manutenção isolada e testes.
- Os testes de domínio usam o executor nativo do Node.js; ainda não há configuração de integração contínua ou suíte permanente de navegador.

## Limpeza de legado

Na limpeza inicial, a entrada canônica foi consolidada em `index.html`, `app.js` e `index.css`. A implementação mobile-first acrescentou `mobile-ui.js` e `mobile-ui.css` a essa entrada.

Foram removidos `index.js`, `repertorio.css` e `tabs.css`, sem referências na entrada atual, e a implementação independente `wrapped.html`/`wrapped.js`/`wrapped.css`. Wrapped e Títulos continuam nas telas da aplicação principal; não se assume equivalência de todos os indicadores da versão antiga. O antigo endereço `wrapped.html` deixa de existir. O código removido permanece recuperável pelo histórico Git.

Também foram retiradas funções sem referências (`getOpenCultos`, `getNextScheduledAfter`, `memberFunctions`, `analysisChips`, `analysisCard`) e os estilos exclusivos dos componentes eliminados. Os dados e as regras ativas foram preservados.

O antigo `musicas_banidas.json` continha texto livre, não JSON. Suas anotações foram preservadas em [Curadoria musical](docs/curadoria-musical.md), sem convertê-las automaticamente em regras de bloqueio.

### Validação da limpeza

A sintaxe de `app.js` foi validada com `node --check`, e `git diff --check` não apontou erros. Uma comparação em Node entre a versão anterior e a versão limpa confirmou resultados idênticos para disponibilidade, popularidade, análises dos 97 eventos, sugestões dos três últimos eventos, Wrapped e títulos com os dados atuais. Os IDs e referências dos JSONs também foram conferidos. Essas verificações pontuais não constituem uma suíte permanente de testes nem cobrem todas as interações da interface.

## Interface mobile-first

A proposta visual foi implementada mantendo JavaScript puro e os dados existentes. A prioridade é ler e escolher músicas com contexto suficiente, sem comprimir título, imagem, status e ações na mesma linha.

### Convenções visuais

- Uma coluna no celular; listas da biblioteca e estatísticas passam a duas colunas a partir de 640 px.
- Navegação inferior com quatro destinos; barra lateral a partir de 980 px.
- Título da música em 16 px e artista/informações recorrentes em 14 px, com unidades relativas.
- Ações com altura mínima de 44 px, foco visível e textos explícitos.
- Detalhes ocupam a tela no celular e um diálogo central em telas maiores.
- Espaço inferior reservado para as barras fixas, incluindo a área segura do dispositivo.
- Análises, filtros e estatísticas secundárias são apresentados progressivamente.
- Badges de dificuldade resumem a média dos instrumentos: até 1,6 é Fácil; até 2,2 é Médio; acima disso é Difícil. Sem níveis cadastrados, o badge é omitido. Popularidade usa a classificação existente; zero execuções é exibido como Inédita. Esses rótulos não substituem o desafio calculado para a equipe.
- As thumbnails priorizam `maxresdefault.jpg` (wide), depois `mqdefault.jpg` e `hqdefault.jpg`, antes da foto local do artista e da imagem padrão. Resoluções indisponíveis que retornam placeholders pequenos também acionam fallback. Imagens do YouTube recebem zoom central de 1,12; variantes 4:3 recebem 1,38 para recortar tarjas embutidas. As fotos locais não recebem esse zoom. O recorte é aplicado às capas e aos detalhes, inclusive com movimento reduzido.
- O aviso de disponibilidade mostra somente o status e, quando aplicável, os dias restantes para liberação.
- Preferência por movimento reduzido respeitada.

### Evolução técnica

Os próximos passos estruturais são separar regras de domínio em módulos testáveis, criar IDs próprios para eventos, definir uma validação de esquema dos JSONs e decidir se haverá sincronização entre dispositivos. A nova interface não depende dessas decisões nem introduz backend, autenticação ou framework.

### Validação da interface

Execute os testes de domínio sem instalar dependências:

```sh
node --test tests/repertoire.test.cjs
node --check app.js
node --check mobile-ui.js
```

A validação em Chromium automatizado cobriu larguras de 320, 375, 390, 768 e 1280 px, busca sem perda de foco, filtros, abertura/fechamento de detalhes, inclusão, sugestões, reordenação, revisão, navegação e persistência após recarga. Também foram verificados texto a 200%, categorias completas, compatibilidade com rascunhos/telas salvos na versão anterior, cópia para a área de transferência, listas vazias e falha HTTP no carregamento. As referências externas do YouTube foram bloqueadas nesses testes, exercitando o fallback local das imagens. Esse teste com viewport emulado não substitui uma conferência em aparelhos físicos.
