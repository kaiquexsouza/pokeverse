const Laterais = (() => {
  const { el, api, avatar, TIPOS_ENCONTRO } = App;

  const esquerda = document.getElementById('lateral-esquerda');
  const direita = document.getElementById('lateral-direita');

  const TITULOS = {
    '': { destaques: 'Destaques', treinadores: 'Treinadores mais ativos', encontros: 'Próximos encontros', status: 'Status do feed' },
    jogos: { destaques: 'Destaques', treinadores: 'Treinadores da rota', encontros: 'Próximas batalhas', status: 'Ficha da categoria' },
    animes: { destaques: 'Cenas marcantes', treinadores: 'Elenco principal', encontros: 'Próximas maratonas', status: 'Audiência' },
    cards: { destaques: 'Cartas raras', treinadores: 'Colecionadores', encontros: 'Trocas e torneios', status: 'Coleção' },
    gerais: { destaques: 'Registros em destaque', treinadores: 'Pesquisadores ativos', encontros: 'Próximos bate-papos', status: 'Dados da Pokédex' },
  };

  const TIPOS_POR_CATEGORIA = {
    '': [],
    jogos: ['batalha', 'torneio'],
    animes: ['anime'],
    cards: ['troca', 'torneio'],
    gerais: ['papo'],
  };

  const ENFEITES = {
    '': () => el('div', { class: 'enfeite-pokebola' }),
    jogos: () => el('div', { class: 'enfeite-start' }, [el('span', { text: 'PRESS START' })]),
    animes: () => el('div', { class: 'enfeite-onomatopeia' }, [el('span', { text: 'GO!' })]),
    cards: () => el('div', { class: 'enfeite-deck' }, [el('span'), el('span'), el('span')]),
    gerais: () =>
      el('div', { class: 'enfeite-dex' }, [
        el('div', { class: 'enfeite-dex-luzes' }, [el('span'), el('span'), el('span')]),
        el('span', { text: 'Analisando registros…' }),
      ]),
  };

  const LIMITE_POSTS = 100;

  let categoria = '';
  let posts = [];
  let encontros = null;
  let pedidoEncontros = 0;
  let agendado = false;

  function bloco(classe, titulo, conteudo) {
    return el('section', { class: `lateral-bloco ${classe}` }, [el('h2', { class: 'lateral-titulo', text: titulo }), ...[].concat(conteudo)]);
  }

  function vazio(texto) {
    return el('p', { class: 'lateral-vazio', text: texto });
  }

  function resumo(post) {
    if (!post.conteudo) return '📷 Imagem';
    return post.conteudo.length > 70 ? `${post.conteudo.slice(0, 70).trimEnd()}…` : post.conteudo;
  }

  function irParaPost(id) {
    const alvo = document.getElementById(`post-${id}`);
    if (!alvo) return;
    alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    alvo.classList.remove('post-destacado');
    void alvo.offsetWidth;
    alvo.classList.add('post-destacado');
  }

  function blocoDestaques() {
    const melhores = posts
      .filter((post) => post.curtidas > 0)
      .sort((a, b) => b.curtidas - a.curtidas || b.id - a.id)
      .slice(0, 3);

    const conteudo = melhores.length
      ? el(
          'ol',
          { class: 'lateral-lista' },
          melhores.map((post) =>
            el('li', {}, [
              el('button', { type: 'button', class: 'lateral-destaque', onclick: () => irParaPost(post.id) }, [
                el('span', { class: 'lateral-destaque-topo' }, [
                  el('span', { class: 'lateral-autor', text: `@${post.autor}` }),
                  el('span', { class: 'lateral-curtidas', text: `♥ ${post.curtidas}` }),
                  el('span', { class: 'lateral-hp', text: `HP ${post.curtidas * 10}` }),
                ]),
                el('span', { class: 'lateral-destaque-texto', text: resumo(post) }),
              ]),
            ])
          )
        )
      : vazio('Nenhum post curtido ainda.');

    return bloco('bloco-destaques', TITULOS[categoria].destaques, conteudo);
  }

  function blocoTreinadores() {
    const contagem = new Map();
    for (const post of posts) contagem.set(post.autor, (contagem.get(post.autor) || 0) + 1);
    const ranking = [...contagem].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);

    const conteudo = ranking.length
      ? el(
          'ol',
          { class: 'lateral-lista' },
          ranking.map(([nome, total], indice) =>
            el('li', { class: 'lateral-treinador' }, [
              el('span', { class: 'lateral-posicao', text: indice + 1 }),
              avatar(nome),
              el('span', { class: 'lateral-nome', text: `@${nome}` }),
              el('span', { class: 'lateral-qtd', text: `${total} post${total === 1 ? '' : 's'}` }),
            ])
          )
        )
      : vazio('Ninguém postou aqui ainda.');

    return bloco('bloco-treinadores', TITULOS[categoria].treinadores, conteudo);
  }

  function blocoStatus() {
    const totais = posts.reduce(
      (soma, post) => ({
        posts: soma.posts + 1,
        curtidas: soma.curtidas + post.curtidas,
        comentarios: soma.comentarios + post.comentarios,
      }),
      { posts: 0, curtidas: 0, comentarios: 0 }
    );

    const item = (valor, rotulo) =>
      el('div', { class: 'lateral-stat' }, [
        el('span', { class: 'lateral-stat-valor', text: App.formatarNumero(valor) }),
        el('span', { class: 'lateral-stat-rotulo', text: rotulo }),
      ]);

    return bloco('bloco-status', TITULOS[categoria].status, [
      el('div', { class: 'lateral-stats' }, [
        item(totais.posts, 'Posts'),
        item(totais.curtidas, 'Curtidas'),
        item(totais.comentarios, 'Comentários'),
      ]),
      posts.length >= LIMITE_POSTS && el('p', { class: 'lateral-nota', text: `Contando os ${LIMITE_POSTS} posts mais recentes.` }),
    ]);
  }

  function dataCurta(dataHora) {
    const data = new Date(dataHora);
    const semana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(data).replace('.', '');
    const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(data);
    return `${semana} ${data.getDate()} · ${hora}`;
  }

  function blocoEncontros() {
    let conteudo;
    if (encontros === null) conteudo = vazio('Carregando encontros…');
    else if (encontros === 'erro') conteudo = vazio('Não foi possível carregar os encontros.');
    else if (!encontros.length) conteudo = vazio('Nenhum encontro marcado por enquanto.');
    else {
      conteudo = el(
        'ul',
        { class: 'lateral-lista' },
        encontros.map((encontro) => {
          const tipo = TIPOS_ENCONTRO[encontro.tipo];
          return el('li', {}, [
            el('a', { href: 'encontros.html', class: 'lateral-encontro', style: { '--cor-tipo': tipo.cor } }, [
              el('span', { class: 'lateral-encontro-data', text: dataCurta(encontro.data_hora) }),
              el('span', { class: 'lateral-encontro-titulo', text: encontro.titulo }),
              el('span', { class: 'lateral-encontro-cidade', text: `${tipo.emoji} ${encontro.cidade}` }),
            ]),
          ]);
        })
      );
    }

    return bloco('bloco-encontros', TITULOS[categoria].encontros, [
      conteudo,
      el('a', { href: 'encontros.html', class: 'lateral-link', text: 'Ver todos os encontros →' }),
    ]);
  }

  function renderizar() {
    agendado = false;
    esquerda.replaceChildren(blocoStatus(), el('div', { class: 'lateral-enfeite', 'aria-hidden': 'true' }, ENFEITES[categoria]()));
    direita.replaceChildren(blocoDestaques(), blocoEncontros(), blocoTreinadores());
  }

  function agendar() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(renderizar);
  }

  async function carregarEncontros() {
    const meuPedido = ++pedidoEncontros;
    encontros = null;
    agendar();

    const tipos = TIPOS_POR_CATEGORIA[categoria];
    try {
      const listas = tipos.length
        ? await Promise.all(tipos.map((tipo) => api(`/encontros?limite=3&tipo=${tipo}`)))
        : [await api('/encontros?limite=3')];
      if (meuPedido !== pedidoEncontros) return;
      encontros = listas
        .flat()
        .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora))
        .slice(0, 3);
    } catch {
      if (meuPedido !== pedidoEncontros) return;
      encontros = 'erro';
    }
    agendar();
  }

  return {
    trocarCategoria(nova) {
      categoria = nova;
      posts = [];
      carregarEncontros();
    },
    definirPosts(lista) {
      posts = lista;
      agendar();
    },
  };
})();
