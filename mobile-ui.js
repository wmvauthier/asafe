// Componentes e navegação da experiência mobile-first.
function renderBandTabs() {
  document.querySelectorAll('[data-band-tab]').forEach(btn => {
    const active = btn.dataset.bandTab === ui.bandTab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  ['wrapped', 'affinities', 'titulos'].forEach(key => {
    document.getElementById(`view-${key}`).hidden = key !== ui.bandTab;
  });
  if (ui.bandTab === 'affinities') renderBandAffinities();
}

function renderBandAffinities() {
  const root = document.getElementById('view-affinities');
  root.replaceChildren(sectionHeader('Afinidades por música', '', 'Veja quem tem maior conexão com cada canção.'));
  const filter = document.createElement('select'); filter.className = 'select'; filter.setAttribute('aria-label', 'Filtrar afinidade');
  filter.innerHTML = '<option value="all">Todas as afinidades</option><option value="very-high">Altíssima</option><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option>';
  const exportButton = button('Copiar como texto', 'ghost-button', () => {
    const text = musicas.map(song => {
      const stats = computeSongMemberInsights(song.id);
      const groups = ['very-high', 'high', 'medium', 'low'].map(level => `${{ 'very-high': 'Altíssima', high: 'Alta', medium: 'Média', low: 'Baixa' }[level]}: ${stats.members.filter(row => row.affinity === level).map(row => row.member.nome).join(', ') || '—'}`).join(' | ');
      return `${song.titulo} — ${groups}`;
    }).join('\n');
    navigator.clipboard?.writeText(text).then(() => toast('Afinidades copiadas.'));
  });
  const list = div('band-affinity-list');
  const paint = () => { list.replaceChildren(); musicas.slice().sort((a, b) => {
    const score = song => { const rows = computeSongMemberInsights(song.id).members; return rows.length ? avg(rows.map(row => row.score)) : -Infinity; };
    return score(b) - score(a) || a.titulo.localeCompare(b.titulo, 'pt-BR');
  }).forEach(song => {
    const stats = computeSongMemberInsights(song.id);
    if (filter.value !== 'all' && !stats.members.some(row => row.affinity === filter.value)) return;
    const card = div('band-affinity-card');
    card.innerHTML = `<div class="band-affinity-art">${songArtworkHTML(song, 'band-affinity-cover')}</div><div><h3>${escapeHTML(song.titulo)}</h3><p>${escapeHTML(song.artista)}</p><div class="affinity-summary">${['very-high','high','medium','low'].map(level => { const count = stats.members.filter(row => row.affinity === level).length; return count ? `<span class="affinity-count affinity-${level}">${{ 'very-high':'Altíssima', high:'Alta', medium:'Média', low:'Baixa' }[level]} · ${count}</span>` : ''; }).join('')}</div></div>`;
    list.append(card);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Ver afinidades de ${song.titulo}`);
    card.addEventListener('click', () => openSongDetail(song));
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openSongDetail(song); } });
  }); };
  filter.addEventListener('change', paint); paint();
  root.append(filter, exportButton, list);
}

function renderLibraryResults() {
  const root = document.getElementById('libraryResults');
  if (!root) return;
  const songs = getFilteredSongs();
  root.replaceChildren();
  const statusCounts = div('library-status-counts');
  [['available','Disponíveis','check'],['recent','Bloqueadas','clock'],['future','Agendadas','calendar']].forEach(([key,label,icon]) => {
    const total = musicas.filter(song => getSongStatus(song.id).status === key).length;
    statusCounts.append(musicBadge(`${total} ${label}`, key, label));
  });
  root.append(statusCounts);
  if (state.libraryCategory !== 'all' || state.libraryStatus !== 'all' || state.libraryIntensity !== 'all') {
    root.append(div('active-filter-note', `Filtros ativos: ${state.libraryCategory === 'all' ? 'todas as categorias' : state.libraryCategory} · ${state.libraryStatus === 'all' ? 'todos os status' : ({ available: 'disponíveis', recent: 'bloqueadas', future: 'agendadas', banned: 'banidas' }[state.libraryStatus])} · ${state.libraryIntensity === 'all' ? 'todas as intensidades' : intensityLabel(state.libraryIntensity)}`));
  }
  root.append(songs.length ? renderLibraryTrackList(songs) : emptyState('Nenhuma música encontrada. Experimente outro termo ou limpe os filtros.'));
}

function songStatusText(song, culto = null) {
  const status = getSongStatus(song.id, culto);
  if (status.status === 'banned') return 'Banida do repertório';
  if (status.status === 'future') {
    const next = getNextScheduledOnOrAfter(song.id, today());
    return `Agendada para ${formatDateCompact(next)}`;
  }
  if (status.status === 'recent') {
    const last = getLastPlayedBefore(song.id, culto ? culto.dataObj : today());
    return `Tocada em ${formatDateCompact(last)} · intervalo de ${COOLDOWN_DAYS} dias`;
  }
  return culto ? 'Disponível para este culto' : 'Disponível';
}

function renderSongCard(song, opts = {}) {
  const card = document.createElement('article');
  card.className = 'music-card';
  card.dataset.songId = song.id;
  const status = getSongStatus(song.id, opts.culto || null);
  card.classList.add(`status-${status.status}`);
  const selectedCulto = ui.building ? getCultByKey(state.builderCult) : null;
  const selected = selectedCulto && getDraft(cultKey(selectedCulto), selectedCulto).includes(song.id);
  if (opts.library && selected) card.classList.add('is-selected');

  const identity = button('', 'music-identity', () => openSongDetail(song, opts.culto || null));
  identity.setAttribute('aria-label', `Ver detalhes de ${song.titulo}, ${song.artista}`);
  identity.innerHTML = `<span class="music-cover">${songArtworkHTML(song, 'music-art')}${opts.library ? '' : `<span class="music-order" aria-label="Faixa ${opts.index + 1}">${String(opts.index + 1).padStart(2, '0')}</span>`}</span>
    <span class="music-identity-text"><strong>${escapeHTML(song.titulo)}</strong><span class="music-artist">${musicIcon('artist')}<span>${escapeHTML(song.artista)}</span></span></span>`;
  card.append(identity);
  const context = div('music-context');
  const categories = div('music-badges category-badges');
  song.categorias.slice(0, 2).forEach(category => categories.append(musicBadge(category, 'category', `Categoria: ${category}`)));
  if (song.categorias.length > 2) categories.append(musicBadge(`+${song.categorias.length - 2}`, 'more', `Outras categorias: ${song.categorias.slice(2).join(', ')}. Veja todas nos detalhes.`));
  const qualities = renderSongQualifications(song);
  if (opts.library || opts.builder) {
    const label = { available: 'Disponível', recent: 'Bloqueada', future: 'Agendada', banned: 'Banida' }[status.status];
    qualities.append(musicBadge(label, status.status, songStatusText(song, opts.culto)));
    const release = getSongReleaseInfo(song.id, opts.culto || null);
    if (release) qualities.append(musicBadge(`Libera em ${release.days} ${release.days === 1 ? 'dia' : 'dias'}`, 'release', `Disponível em ${formatDateCompact(release.date)}, considerando o intervalo e os agendamentos cadastrados.`));
    if (selected && opts.library) qualities.append(musicBadge('Adicionada', 'selected', 'Já adicionada ao rascunho'));
  }
  context.append(categories, qualities);
  card.append(context);
  const actions = div('music-actions');
  if (opts.library && selectedCulto) {
    const toggle = musicAction(selected ? 'Remover' : 'Adicionar', selected ? 'minus' : 'plus', selected ? 'ghost-button' : 'pill-button', () => {
      if (selected) removeFromDraft(song.id); else addSongFromLibrary(song);
    });
    toggle.dataset.songToggle = song.id;
    toggle.setAttribute('aria-label', `${selected ? 'Remover' : 'Adicionar'} ${song.titulo}`);
    actions.append(toggle);
  } else if (opts.builder) {
    const move = div('music-order-actions');
    [['Subir', -1], ['Descer', 1]].forEach(([label, delta]) => {
      const btn = button(label, 'text-button', () => moveDraftSong(song.id, delta));
      btn.disabled = delta < 0 ? opts.index === 0 : opts.index === opts.total - 1;
      btn.setAttribute('aria-label', `${label} ${song.titulo} na ordem`);
      move.append(btn);
    });
    actions.append(musicAction('Remover', 'minus', 'text-button danger-text', () => removeFromDraft(song.id)));
    card.append(move);
  }
  if (actions.children.length) card.append(actions);
  return card;
}

function openSongDetail(song, culto = null) {
  ui.detailSong = song.id;
  ui.detailCult = culto;
  const dialog = document.getElementById('songDialog');
  document.getElementById('songDetailBody').replaceChildren(renderSongDetails(song));
  dialog.showModal();
  document.body.classList.add('detail-open');
  dialog.scrollTop = 0;
}

function refreshSelection(songId) {
  const scrollY = window.scrollY;
  renderRepertorio();
  window.scrollTo({ top: scrollY, behavior: 'instant' });
  const toggle = document.querySelector(`[data-song-toggle="${songId}"]`);
  const focusTarget = toggle || document.querySelector(`.builder-workspace [data-song-id="${songId}"] .music-identity`) || document.querySelector('.builder-workspace .music-identity') || document.querySelector('.builder-workspace .segment.active');
  if (focusTarget) focusTarget.focus({ preventScroll: true });
}

function showBuilderFeedback(message) {
  const target = document.getElementById('builderFeedback');
  if (target) {
    target.textContent = message;
    target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  toast(message);
}

function moveDraftSong(songId, delta) {
  const culto = getCultByKey(state.builderCult);
  const ids = [...getDraft(cultKey(culto), culto)];
  const index = ids.indexOf(songId), next = index + delta;
  if (index < 0 || next < 0 || next >= ids.length) return;
  [ids[index], ids[next]] = [ids[next], ids[index]];
  setDraft(cultKey(culto), ids);
  refreshSelection(songId);
}

function musicBadge(label, kind, description = label) {
  const badge = document.createElement('span');
  badge.className = `music-badge badge-${kind}`;
  const icons = { category: 'tag', popularity: 'spark', easy: 'level1', medium: 'level2', hard: 'level3', available: 'check', selected: 'check', recent: 'clock', future: 'calendar', banned: 'ban', release: 'clock', intensity: 'wave' };
  badge.innerHTML = `${icons[kind] ? musicIcon(icons[kind]) : ''}<span>${escapeHTML(label)}</span>`;
  badge.title = description;
  badge.setAttribute('aria-label', description);
  return badge;
}

function renderSongQualifications(song) {
  const badges = div('music-badges qualification-badges');
  const difficulty = songDifficultyValue(song);
  if (difficulty > 0) {
    const level = difficulty <= 1.6 ? 'easy' : difficulty <= 2.2 ? 'medium' : 'hard';
    badges.append(musicBadge(levelLabel(level), level, `Dificuldade média dos instrumentos: ${levelLabel(level)}`));
  }
  if (song.intensidade) badges.append(musicBadge(intensityLabel(song.intensidade), 'intensity', `Intensidade musical: ${intensityLabel(song.intensidade)}`));
  const popularity = getPopularity(song.id);
  const label = popularity.count === 0 ? 'Inédita' : { classic: 'Clássica', common: 'Comum', rare: 'Rara' }[popularity.nivel];
  badges.append(musicBadge(label, 'popularity', `${label} · ${popularity.count} execuções passadas`));
  return badges;
}

function songArtworkSources(song) {
  const sources = song.referLink ? [
    `https://img.youtube.com/vi/${encodeURIComponent(song.referLink)}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${encodeURIComponent(song.referLink)}/mqdefault.jpg`,
    `https://img.youtube.com/vi/${encodeURIComponent(song.referLink)}/hqdefault.jpg`,
  ] : [];
  if (song._artistImage) sources.push(song._artistImage);
  sources.push('artistas/default.jpg');
  return sources;
}

function songArtworkHTML(song, className) {
  return `<img class="${className}" src="${escapeAttr(songArtworkSources(song)[0])}" alt="" loading="lazy" data-artwork-step="0" onload="handleSongArtworkLoad(this, ${Number(song.id)})" onerror="fallbackSongArtwork(this, ${Number(song.id)})" />`;
}

function handleSongArtworkLoad(img, songId) {
  const fromYoutube = img.currentSrc.includes('img.youtube.com/');
  // Some unavailable resolutions return a tiny placeholder with HTTP 200.
  if (fromYoutube && img.naturalWidth <= 120) {
    fallbackSongArtwork(img, songId);
    return;
  }
  const letterboxed = fromYoutube && img.naturalWidth / img.naturalHeight < 1.5;
  img.style.setProperty('--artwork-zoom', letterboxed ? '1.38' : fromYoutube ? '1.12' : '1');
}

function fallbackSongArtwork(img, songId) {
  const sources = songArtworkSources(getSong(songId) || {});
  const step = Number(img.dataset.artworkStep || 0) + 1;
  if (step >= sources.length) { img.onerror = null; img.onload = null; return; }
  img.dataset.artworkStep = String(step);
  img.src = sources[step];
}

// Ícones vetoriais locais: mesma espessura de traço, sem fonte ou CDN.
function musicIcon(name) {
  const paths = {
    wave: '<path d="M3 12h3l3-8 6 16 3-8h3"/>',
    crown: '<path d="m3 6 5 4 4-7 4 7 5-4-2 13H5Z"/><path d="M5 16h14"/>',
    people: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m3 11v-3a6 6 0 0 0-2-4"/>',
    music: '<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1m-7 8v4m-4 0h8"/>',
    strings: '<path d="m15 9 6-6m-5 1 4 4M6 13l5 5"/><path d="M14 7c-3-2-5 0-5 3-4-1-7 2-7 5a7 7 0 0 0 7 7c3 0 6-3 5-7 3 0 5-2 3-5Z"/>',
    keys: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m6-16v16M7 4v8m6-8v8m6-8v8"/>',
    drums: '<ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v8c0 5 18 5 18 0V9M7 12v7m10-7v7M5 2l5 5m9-5-5 5"/>',
    repeat: '<path d="M4 7h14l-3-3m5 13H6l3 3M3 7v6m18 4v-6"/>',
    artist: '<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    tag: '<path d="M3 3h7l11 11-7 7L3 10Z"/><circle cx="7.5" cy="7.5" r=".8"/>',
    spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
    details: '<path d="M9 5h12M9 12h12M9 19h12"/><circle cx="3" cy="5" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="19" r="1"/>',
    play: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    level1: '<path d="M5 19v-5"/><path opacity=".25" d="M12 19V9m7 10V4"/>',
    level2: '<path d="M5 19v-5m7 5V9"/><path opacity=".25" d="M19 19V4"/>',
    level3: '<path d="M5 19v-5m7 5V9m7 10V4"/>',
  };
  return `<svg class="music-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.spark}</svg>`;
}

function musicAction(label, icon, className, handler) {
  const action = button('', className, handler);
  action.innerHTML = `${musicIcon(icon)}<span>${escapeHTML(label)}</span>`;
  return action;
}

function detailPanel(title, icon) {
  const panel = document.createElement('section');
  panel.className = 'song-detail-panel';
  panel.innerHTML = `<h3>${musicIcon(icon)}<span>${escapeHTML(title)}</span></h3>`;
  return panel;
}

function renderIntensityPanel(song) {
  const panel = detailPanel('Intensidade', 'wave');
  if (!song.intensidade) {
    panel.append(div('muted-line', 'Ainda não informada.'));
    return panel;
  }
  const scale = div('intensity-scale');
  scale.setAttribute('aria-label', `Intensidade ${intensityLabel(song.intensidade)}`);
  ['baixa', 'media', 'alta'].forEach((key, index) => {
    const item = div(`intensity-step ${key === song.intensidade ? 'active' : ''}`);
    item.innerHTML = `${musicIcon(`level${index + 1}`)}<span>${intensityLabel(key)}</span>`;
    item.setAttribute('aria-hidden', 'true'); scale.append(item);
  });
  panel.append(scale);
  return panel;
}

function renderSongMemberInsights(songId, culto = null) {
  const panel = detailPanel('Afinidade', 'people');
  const stats = computeSongMemberInsights(songId, culto);
  panel.append(div('member-insights-note', 'Índice baseado em escolhas, participações recentes e histórico de execução.'));
  if (!stats.eventCount) {
    panel.append(div('empty-insights', 'Essa música ainda não tem execuções no histórico. Não há participações ou escolhas para comparar.'));
    return panel;
  }
  if (!stats.members.length) { panel.append(div('empty-insights', 'Nenhum integrante cadastrado.')); return panel; }
  ['very-high', 'high', 'medium', 'low'].forEach(level => {
    const rows = stats.members.filter(row => row.affinity === level).sort((a, b) => b.score - a.score || a.member.nome.localeCompare(b.member.nome, 'pt-BR'));
    if (rows.length) {
      const group = div(`affinity-group affinity-${level}`);
      group.innerHTML = `<span class="affinity-badge">${{ 'very-high': 'Altíssima', high: 'Alta', medium: 'Média', low: 'Baixa' }[level]}</span><div class="affinity-avatars">${rows.map(({ member }) => `<img src="${escapeAttr(memberImg(member))}" alt="${escapeAttr(member.nome)}" title="${escapeAttr(member.nome)}" loading="lazy" onerror="this.onerror=null;this.src='integrantes/default.jpeg'" />`).join('')}</div>`;
      panel.append(group);
    }
  });
  return panel;
}

function memberInsightGroup(title, rows, metric) {
  const group = div('member-insight-group');
  if (title) { const heading = document.createElement('h4'); heading.textContent = title; group.append(heading); }
  const list = document.createElement('ul'); list.className = 'member-insight-list';
  rows.forEach(({ member, ...counts }) => {
    const row = document.createElement('li');
    const value = metric === 'affinity' ? ({ high: 'Alta', medium: 'Média', low: 'Baixa' }[counts[metric]] || '') : `${counts[metric]}×`;
    row.innerHTML = `<img src="${escapeAttr(memberImg(member))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='integrantes/default.jpeg'" /><span>${escapeHTML(member.nome)}</span><strong aria-label="Afinidade ${escapeAttr(value)}">${value}</strong>`;
    list.append(row);
  });
  group.append(list); return group;
}

function agendaThumbnailScore(song, culto) {
  const cutoff = new Date(today()); cutoff.setMonth(cutoff.getMonth() - 6);
  const recent = historico.filter(ev => ev.dataObj && ev.dataObj >= cutoff && ev.dataObj < today() && (ev.musicas || []).includes(song.id)).length;
  const stats = computeSongMemberInsights(song.id);
  const ids = new Set(culto.integrantes || []);
  const rows = stats.members.filter(row => ids.has(row.member.id));
  const affinity = rows.length ? avg(rows.map(row => row.score)) : 0;
  return recent * 3 + affinity;
}

function renderAgendaPreview(culto) {
  const preview = div('agenda-preview');
  const song = (culto.musicas || []).map(getSong).filter(Boolean)
    .sort((a, b) => agendaThumbnailScore(b, culto) - agendaThumbnailScore(a, culto))[0];
  const cover = div('agenda-cover');
  if (song) {
    cover.innerHTML = songArtworkHTML(song, 'agenda-artwork');
    cover.title = `${song.titulo} · mais tocada deste repertório (${getTotalExecucoes(song.id)}× no histórico)`;
    cover.querySelector('img').alt = `${song.titulo} — ${song.artista}`;
  } else {
    cover.innerHTML = musicIcon('music');
    cover.setAttribute('aria-label', 'Repertório ainda não definido');
  }
  const members = getAgendaMembers(culto);
  const avatars = div('agenda-avatars');
  avatars.style.setProperty('--agenda-member-count', Math.max(1, Math.min(9, members.length)));
  avatars.setAttribute('role', 'group'); avatars.setAttribute('aria-label', 'Equipe escalada');
  members.forEach(member => {
    const header = getHeaderIds(culto).includes(member.id);
    const minister = getMinisterIds(culto).includes(member.id);
    const image = document.createElement('img');
    image.className = [header ? 'is-header' : '', minister ? 'is-minister' : ''].filter(Boolean).join(' ');
    image.src = memberImg(member); image.alt = member.nome;
    image.title = [member.nome, header ? 'Header' : '', minister ? 'Ministrante' : ''].filter(Boolean).join(' · ');
    image.loading = 'lazy'; image.width = image.height = 40;
    image.onerror = () => { image.onerror = null; image.src = 'integrantes/default.jpeg'; };
    avatars.append(image);
  });
  const roles = div('agenda-roles');
  [['Header', 'crown', getHeaderIds(culto), 'header'], ['Ministrante', 'mic', getMinisterIds(culto), 'minister']].forEach(([label, icon, ids, kind]) => {
    const names = [...new Set(ids)].map(getMember).filter(Boolean).map(member => member.nome);
    const role = div(`agenda-role agenda-role-${kind}`);
    role.innerHTML = `${musicIcon(icon)}<span><span class="agenda-role-label">${label}</span> ${escapeHTML(names.join(', ') || 'A definir')}</span>`;
    roles.append(role);
  });
  const analysis = analyzeSet(culto, culto.musicas || []);
  const metrics = div('agenda-metrics');
  getMetricItems(analysis).forEach(item => {
    const value = song ? `${Math.round(item.score * 100)}%` : '—';
    const metric = div(`agenda-metric ${song ? metricTone(item.toneScore ?? item.score) : 'pending'}`);
    const label = `${item.label}: ${song ? value : 'aguardando repertório'}`;
    metric.title = label; metric.setAttribute('aria-label', label);
    metric.innerHTML = `<span aria-hidden="true">${item.icon}</span><strong aria-hidden="true">${value}</strong>`;
    metrics.append(metric);
  });
  preview.append(cover, metrics);
  if (!song) preview.append(div('agenda-unset', ''));
  if (avatars.children.length) preview.append(avatars);
  preview.append(roles);
  return preview;
}

function getAgendaMembers(culto) {
  return [...new Set([...(culto.integrantes || []), ...getHeaderIds(culto), ...getMinisterIds(culto)])].map(getMember).filter(Boolean);
}
