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

HTML, CSS e JavaScript puro, executados no navegador. Não há backend, banco de dados, autenticação, framework, gerenciador de pacotes ou processo de build. A interface principal é uma página única com cinco seções; a navegação alterna sua visibilidade, sem roteador ou mudança de URL.

```text
index.html + index.css
        |
      app.js <-- fetch -- musicas.json
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
| `index.css` | Tema escuro, componentes visuais e responsividade |
| `musicas.json` | Catálogo musical compartilhado |
| `historico.json` | Eventos realizados e escalas futuras |
| `integrantes/integrantes.json` | Cadastro e habilidades dos integrantes |
| `artistas/` | Fotos dos artistas e imagem padrão |
| `integrantes/` | Fotos dos integrantes e imagem padrão |
| `docs/curadoria-musical.md` | Anotações humanas de curadoria, fora da execução |
| `.vscode/settings.json` | Porta do Live Server |

### Inicialização e estado

`DOMContentLoaded` chama `init()`, que carrega os três JSONs em paralelo com `Promise.all`. `normalizeSongs()` transforma categorias em arrays e prepara caminhos de imagens; `normalizeHistory()` converte datas e normaliza listas. Depois são calculadas categorias e popularidade, conectados os eventos e renderizadas as cinco telas.

Os dados ficam nas variáveis globais `integrantes`, `musicas`, `historico` e `categorias`. `popularityCache` guarda a classificação calculada na inicialização. O objeto `state` concentra preferências e rascunhos; suas chaves de armazenamento usam o prefixo `asafe:v2:`.

As funções de renderização criam elementos com APIs do DOM e templates HTML. `escapeHTML()` e `escapeAttr()` são os helpers de escape disponíveis para valores interpolados. A separação entre dados, domínio e interface é conceitual: tudo ainda está concentrado em `app.js`.

### Telas

- **Próximo:** primeiro culto a partir de hoje, integrantes, músicas, análises e cópia da escala.
- **Cultos:** eventos futuros posteriores ao próximo culto, em painéis expansíveis; repertórios definidos ou sugestões para eventos em aberto.
- **Repertório:** biblioteca com busca e filtros, disponibilidade, detalhes e montagem de rascunhos.
- **Wrapped:** estatísticas por período e integrante, rankings de músicas/artistas e parcerias.
- **Títulos:** conquistas e rankings derivados do histórico. A galeria usa o período selecionado e ignora o filtro individual ao calcular os títulos.

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

O código também reconhece `banned: true` ou `ban: true`, mas o catálogo auditado não contém esses campos. As notas de curadoria não são importadas automaticamente.

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
4. Preserve fotos e caminhos esperados pelos helpers `memberImg()` e `artistImg()`, incluindo imagens padrão.
5. Confira as telas e o console após recarregar a aplicação.

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

- `getBuilderCultos()` exclui o primeiro culto futuro e aceita apenas os demais sem repertório. Se só existir um culto futuro, o montador ficará sem opções. Essa regra foi preservada na limpeza e precisa ser decidida antes de alteração funcional.
- A data é a chave do culto/rascunho (`cultKey()`); dois cultos no mesmo dia não são distinguidos.
- Não há validação formal de esquema dos JSONs. O carregamento trata falhas genericamente e não verifica `response.ok` antes de ler as respostas.
- Os cálculos fazem várias buscas e filtragens sobre arrays. O aumento do histórico pode exigir índices e cache por contexto.
- A data local do navegador determina passado/futuro; algumas análises combinam histórico anterior ao culto com popularidade acumulada até hoje.
- O estado global e a concentração de responsabilidades dificultam manutenção isolada e testes.
- Não há suíte automatizada de testes ou configuração de integração contínua no repositório.

## Limpeza de legado

A entrada canônica é `index.html`, que carrega somente `app.js` e `index.css`.

Foram removidos `index.js`, `repertorio.css` e `tabs.css`, sem referências na entrada atual, e a implementação independente `wrapped.html`/`wrapped.js`/`wrapped.css`. Wrapped e Títulos continuam nas telas da aplicação principal; não se assume equivalência de todos os indicadores da versão antiga. O antigo endereço `wrapped.html` deixa de existir. O código removido permanece recuperável pelo histórico Git.

Também foram retiradas funções sem referências (`getOpenCultos`, `getNextScheduledAfter`, `memberFunctions`, `analysisChips`, `analysisCard`) e os estilos exclusivos dos componentes eliminados. Os dados e as regras ativas foram preservados.

O antigo `musicas_banidas.json` continha texto livre, não JSON. Suas anotações foram preservadas em [Curadoria musical](docs/curadoria-musical.md), sem convertê-las automaticamente em regras de bloqueio.

### Validação da limpeza

A sintaxe de `app.js` foi validada com `node --check`, e `git diff --check` não apontou erros. Uma comparação em Node entre a versão anterior e a versão limpa confirmou resultados idênticos para disponibilidade, popularidade, análises dos 97 eventos, sugestões dos três últimos eventos, Wrapped e títulos com os dados atuais. Os IDs e referências dos JSONs também foram conferidos. Essas verificações pontuais não constituem uma suíte permanente de testes nem cobrem todas as interações da interface.

## Próxima etapa: planejamento mobile-first

Esta é uma proposta inicial para discussão, não uma reestruturação já implementada nem uma escolha definitiva de framework.

1. **Definir os fluxos prioritários:** consultar a próxima escala, encontrar uma música, montar e compartilhar repertório. Decidir a edição do próximo culto e como distinguir eventos no mesmo dia.
2. **Projetar a experiência para telas pequenas:** hierarquia de conteúdo, navegação inferior, filtros acessíveis, ações de toque e montagem de repertório com contexto visível. Expandir progressivamente para tablet/desktop.
3. **Separar responsabilidades:** módulos de carregamento/normalização, persistência, regras de repertório, estatísticas e componentes/telas. Preservar os contratos de dados e definir a migração dos rascunhos antes de mudar chaves.
4. **Definir o sistema visual:** tokens de cor, espaçamento, tipografia e componentes reutilizáveis; estados de carregamento, erro e vazio; foco visível, contraste, teclado e movimento reduzido.
5. **Migrar por fluxo:** estrutura/navegação, Próximo, Cultos, biblioteca/montador, Wrapped e Títulos. Validar cada etapa antes de substituir a seguinte.
6. **Estabelecer critérios de aceite:** telas de 320, 375, 390, 768 e 1280 px sem rolagem horizontal acidental; ações utilizáveis por toque e teclado; rascunhos preservados após recarga; regras cobertas por testes de domínio; dados ausentes tratados; verificação em navegador mobile.

As decisões sobre framework, backend, autenticação e sincronização devem seguir as necessidades definidas nessa etapa. Nenhum desses recursos é requisito da execução atual.
