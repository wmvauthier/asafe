const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
function app(saved = {}) {
  const storage = new Map(Object.entries(saved));
  const context = vm.createContext({
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    document: { addEventListener() {} },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'mobile-ui.js'), 'utf8'), context);
  const run = code => vm.runInContext(code, context);
  run(`
    today = () => new Date(2026, 10, 23);
    musicas = normalizeSongs([
      {id: 1, titulo: 'Primeira', artista: 'Banda', categorias: 'Adoração', level: {vocal: 'easy'}},
      {id: 2, titulo: 'Segunda', artista: 'Banda', categorias: 'Adoração; Esperança', level: {}},
      {id: 3, titulo: 'Terceira', artista: 'Banda', categorias: 'Esperança', level: {}},
      {id: 4, titulo: 'Quarta', artista: 'Banda', categorias: 'Natal', level: {}}
    ]);
    historico = normalizeHistory([
      {data: '28/09/2026', musicas: [1], integrantes: [], header: [], minister: []},
      {data: '29/11/2026', musicas: [2, 1], integrantes: [], header: [], minister: []},
      {data: '06/12/2026', musicas: [], integrantes: [], header: [], minister: []}
    ]);
    popularityCache = classifyPopularity();
  `);
  return { run, storage };
}

test('o próximo culto e cultos com repertório definido aceitam rascunhos', () => {
  const { run } = app();
  assert.equal(run('getBuilderCultos().length'), 2);
  assert.equal(run('getBuilderCultos()[0].data'), '29/11/2026');
});

test('rascunhos antigos são preservados e não alteram o repertório publicado', () => {
  const { run, storage } = app({ 'asafe:v2:builder-drafts': '{"29/11/2026":[4,3]}' });
  assert.equal(run('JSON.stringify(getDraft("29/11/2026", historico[1]))'), '[4,3]');
  run('setDraft("29/11/2026", [1,3])');
  assert.equal(run('JSON.stringify(historico[1].musicas)'), '[2,1]');
  assert.deepEqual(JSON.parse(storage.get('asafe:v2:builder-drafts')), { '29/11/2026': [1,3] });
});

test('rascunho inicial copia a escala sem compartilhar seu array', () => {
  const { run } = app();
  run('const draft = getDraft("29/11/2026", historico[1]); draft.reverse();');
  assert.equal(run('JSON.stringify(historico[1].musicas)'), '[2,1]');
});

test('agendamento e intervalo de 56 dias são avaliados no contexto do culto', () => {
  const { run } = app();
  assert.equal(run('getSongStatus(2).status'), 'future');
  assert.equal(run('getSongStatus(2, historico[1]).status'), 'available');
  assert.equal(run('getSongStatus(1, {dataObj: new Date(2026,10,23)}).status'), 'future');
  run('historico[1].musicas = [2]');
  assert.equal(run('getSongStatus(1).status'), 'recent');
  assert.equal(run('getSongStatus(1, {dataObj: new Date(2026,10,24)}).status'), 'available');
});

test('filtro de disponibilidade usa o culto durante a montagem', () => {
  const { run } = app();
  run('state.libraryStatus = "available"; state.builderCult = "29/11/2026";');
  assert.equal(run('getFilteredSongs().some(s => s.id === 2)'), false);
  run('ui.building = true');
  assert.equal(run('getFilteredSongs().some(s => s.id === 2)'), true);
});

test('categorias recusam trio sem pares compatíveis e aceitam categoria em comum', () => {
  const { run } = app();
  assert.equal(run('hasDisjointCategoryTriple([1,3,4])'), true);
  assert.equal(run('hasDisjointCategoryTriple([1,2,4])'), false);
});

test('reordenação persiste a ordem, respeita limites e preserva o histórico', () => {
  const { run } = app();
  run('state.builderCult = "29/11/2026"; refreshSelection = () => {}; moveDraftSong(2,1);');
  assert.equal(run('JSON.stringify(getDraft("29/11/2026"))'), '[1,2]');
  run('moveDraftSong(2,1);');
  assert.equal(run('JSON.stringify(getDraft("29/11/2026"))'), '[1,2]');
  assert.equal(run('JSON.stringify(historico[1].musicas)'), '[2,1]');
});

test('JSONs mantêm IDs únicos e referências válidas', () => {
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const songs = read('musicas.json'), members = read('integrantes/integrantes.json');
  const songIds = new Set(songs.map(s => s.id)), memberIds = new Set(members.map(m => m.id));
  assert.equal(songIds.size, songs.length); assert.equal(memberIds.size, members.length);
  for (const event of read('historico.json')) {
    for (const key of ['musicas','integrantes','header','minister']) {
      for (const id of event[key] || []) assert((key === 'musicas' ? songIds : memberIds).has(id), `${event.data}: ${key} ${id}`);
    }
  }
});

test('biblioteca ordena disponíveis por execuções, bloqueadas por última execução e agendadas por data', () => {
  const { run } = app();
  run(`
    musicas = normalizeSongs(Array.from({length: 8}, (_, i) => ({id: i+1, titulo: 'Música '+(i+1), categorias: 'Adoração'})));
    musicas[7].banned = true;
    historico = normalizeHistory([
      {data:'01/01/2026', musicas:[1,2]},
      {data:'01/02/2026', musicas:[1]},
      {data:'01/10/2026', musicas:[4]},
      {data:'20/11/2026', musicas:[5]},
      {data:'23/11/2026', musicas:[7]},
      {data:'29/11/2026', musicas:[6]}
    ]);
  `);
  assert.equal(run('JSON.stringify(getFilteredSongs().map(s=>s.id))'), '[3,2,1,4,5,7,6,8]');
  run('state.libraryStatus = "recent"');
  assert.equal(run('JSON.stringify(getFilteredSongs().map(s=>s.id))'), '[4,5]');
  run('state.libraryStatus = "future"');
  assert.equal(run('JSON.stringify(getFilteredSongs().map(s=>s.id))'), '[7,6]');
});

test('contador respeita a fronteira inclusiva de 56 dias e a liberação no dia seguinte', () => {
  const { run } = app();
  run('historico[1].musicas = [2]');
  assert.equal(run('getSongReleaseInfo(1).days'), 1);
  assert.equal(run('getSongReleaseInfo(3)'), null);
  run('today = () => new Date(2026,10,24)');
  assert.equal(run('getSongStatus(1).status'), 'available');
  assert.equal(run('getSongReleaseInfo(1)'), null);
});

test('agendadas contam a espera mais o intervalo e usam a última reserva para liberação', () => {
  const { run } = app();
  assert.equal(run('getSongReleaseInfo(2).days'), 63); // 6 dias até 29/11 + 57.
  assert.equal(run('getSongReleaseInfo(2, historico[1])'), null); // Livre para este culto.
  run('historico[2].musicas = [2]');
  assert.equal(run('getSongReleaseInfo(2).days'), 70);
  run('today = () => new Date(2026,11,6)');
  assert.equal(run('getSongReleaseInfo(2).days'), 57);
  run('today = () => new Date(2027,1,1)');
  assert.equal(run('getSongStatus(2).status'), 'available');
  assert.equal(run('getSongReleaseInfo(2)'), null);
});

test('banimento permanente não promete data de liberação e empates são determinísticos', () => {
  const { run } = app();
  run('musicas[3].banned = true');
  assert.equal(run('getSongReleaseInfo(4)'), null);
  run('historico = []; musicas[0].titulo = "Zebra"; musicas[1].titulo = "Alfa";');
  assert.equal(run('JSON.stringify(getFilteredSongs().map(s=>s.id))'), '[2,3,1,4]');
});

test('intensidade aceita Baixa/Média/Alta sem inferir a partir da dificuldade', () => {
  const { run } = app();
  assert.equal(run('normalizeIntensity("Média")'), 'media');
  assert.equal(run('normalizeIntensity(" ALTA ")'), 'alta');
  assert.equal(run('normalizeIntensity("baixa")'), 'baixa');
  assert.equal(run('normalizeIntensity("forte")'), null);
  assert.equal(run('musicas[0].intensidade'), null);
  assert.equal(run('normalizeSongs([{id: 9, intensidade: "Média"}])[0].intensidade'), 'media');
});

test('filtro de intensidade preserva a ordenação por ciclo e permite não informadas', () => {
  const { run } = app();
  run('musicas[0].intensidade = "alta"; musicas[2].intensidade = "alta"; state.libraryIntensity = "alta";');
  assert.equal(run('JSON.stringify(getFilteredSongs().map(s=>s.id))'), '[3,1]');
  run('state.libraryIntensity = "unset"');
  assert.equal(run('JSON.stringify(getFilteredSongs().map(s=>s.id))'), '[4,2]');
});

test('insights contam participação e escolha separadamente, sem duplicar IDs ou incluir cultos futuros', () => {
  const { run } = app();
  run(`
    integrantes = [{id:1,nome:'Ana'}, {id:2,nome:'Bruno'}, {id:3,nome:'Clara'}, {id:4,nome:'Davi'}];
    historico = normalizeHistory([
      {data:'01/09/2026', musicas:[1,1], integrantes:[1,1,2,99], header:[2,2,3,99]},
      {data:'01/10/2026', musicas:[1], integrantes:[1], header:[3]},
      {data:'02/10/2026', musicas:[2], integrantes:[4], header:[4]},
      {data:'23/11/2026', musicas:[1], integrantes:[4], header:[4]},
      {data:'29/11/2026', musicas:[1], integrantes:[4], header:[4]}
    ]);
  `);
  assert.equal(run('computeSongMemberInsights(1).eventCount'), 2);
  assert.equal(run('JSON.stringify(computeSongMemberInsights(1).members.map(x=>[x.member.id,x.played,x.chosen]))'), '[[1,2,0],[2,1,1],[3,0,2],[4,0,0]]');
  assert.equal(run('rankSongMembers(computeSongMemberInsights(1),"played").most[0].member.nome'), 'Ana');
  assert.equal(run('rankSongMembers(computeSongMemberInsights(1),"played").least[0].member.nome'), 'Bruno');
  assert.equal(run('rankSongMembers(computeSongMemberInsights(1),"chosen").most[0].member.nome'), 'Clara');
  assert.equal(run('JSON.stringify(rankSongMembers(computeSongMemberInsights(1),"played").never.map(x=>x.member.id))'), '[3,4]');
  assert.equal(run('computeSongMemberInsights(999).eventCount'), 0);
});

test('thumbnails priorizam wide, rejeitam placeholder e aplicam zoom em imagens com tarja', () => {
  const { run } = app();
  run(`
    musicas[0].referLink = 'video';
    const img = {dataset:{artworkStep:'0'}, currentSrc:'https://img.youtube.com/vi/video/maxresdefault.jpg', naturalWidth:120, naturalHeight:90, style:{setProperty(key,value){this[key]=value}}};
    handleSongArtworkLoad(img,1);
  `);
  assert.match(run('img.src'), /mqdefault\.jpg$/);
  run('img.naturalWidth=480; img.naturalHeight=360; handleSongArtworkLoad(img,1);');
  assert.equal(run('img.style["--artwork-zoom"]'), '1.38');
  run('img.naturalWidth=1280; img.naturalHeight=720; handleSongArtworkLoad(img,1);');
  assert.equal(run('img.style["--artwork-zoom"]'), '1.12');
  run('fallbackSongArtwork(img,1); fallbackSongArtwork(img,1);');
  assert.match(run('img.src'), /^artistas\//);
});
