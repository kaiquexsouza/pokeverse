// Feed: listar, criar e apagar posts; curtir; comentar.
const { el, icone, api, CATEGORIAS } = App;

const ICONES = {
  coracao:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  balao:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  lixeira:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
  imagem:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
};

const TAMANHO_MAXIMO_IMAGEM = 1080;
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function comprimirImagem(arquivo) {
  return new Promise((resolve, reject) => {
    if (!TIPOS_IMAGEM.includes(arquivo.type)) {
      reject(new Error('Escolha uma imagem JPG, PNG, WEBP ou GIF.'));
      return;
    }

    const url = URL.createObjectURL(arquivo);
    const imagem = new Image();
    imagem.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, TAMANHO_MAXIMO_IMAGEM / Math.max(imagem.width, imagem.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(imagem.width * escala);
      canvas.height = Math.round(imagem.height * escala);

      const contexto = canvas.getContext('2d');
      contexto.fillStyle = '#fff';
      contexto.fillRect(0, 0, canvas.width, canvas.height);
      contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    imagem.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir essa imagem.'));
    };
    imagem.src = url;
  });
}

let telaCheia = null;

function abrirImagem(src) {
  if (!telaCheia) {
    telaCheia = el('div', { class: 'imagem-tela-cheia', hidden: true, onclick: fecharImagem }, [
      el('img', { alt: 'Imagem do post' }),
      el('button', { type: 'button', class: 'modal-close', 'aria-label': 'Fechar', text: '×' }),
    ]);
    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape' && !telaCheia.hidden) fecharImagem();
    });
    document.body.append(telaCheia);
  }
  telaCheia.querySelector('img').src = src;
  telaCheia.hidden = false;
  document.body.classList.add('sem-rolagem');
}

function fecharImagem() {
  telaCheia.hidden = true;
  document.body.classList.remove('sem-rolagem');
}

const CORES_AVATAR = ['#DC2626', '#2563EB', '#D97706', '#7C3AED', '#059669', '#DB2777'];

const tabs = document.getElementById('tabs');
const composer = document.getElementById('composer');
const listaPosts = document.getElementById('posts');
const statusFeed = document.getElementById('feed-status');

let categoriaAtual = new URLSearchParams(location.search).get('categoria');
if (!CATEGORIAS[categoriaAtual]) categoriaAtual = '';

function avatar(nome) {
  let soma = 0;
  for (const letra of nome) soma += letra.charCodeAt(0);
  return el('span', {
    class: 'avatar',
    text: nome[0].toUpperCase(),
    style: { backgroundColor: CORES_AVATAR[soma % CORES_AVATAR.length] },
  });
}

function mostrarStatus(texto) {
  statusFeed.textContent = texto || '';
  statusFeed.hidden = !texto;
}

// ===== Abas de categoria =====
function atualizarAbas() {
  tabs.querySelectorAll('.tab').forEach((aba) => {
    const ativa = aba.dataset.categoria === categoriaAtual;
    aba.classList.toggle('tab-ativa', ativa);
    aba.setAttribute('aria-selected', ativa);
  });
}

tabs.addEventListener('click', (evento) => {
  const aba = evento.target.closest('.tab');
  if (!aba || aba.dataset.categoria === categoriaAtual) return;
  trocarCategoria(aba.dataset.categoria);
});

function trocarCategoria(categoria) {
  categoriaAtual = categoria;
  const url = categoria ? `?categoria=${categoria}` : location.pathname;
  history.replaceState(null, '', url);
  atualizarAbas();
  renderizarComposer();
  carregarPosts();
}

// ===== Novo post =====
function renderizarComposer() {
  composer.replaceChildren();
  const usuario = App.usuario;

  if (!usuario) {
    composer.append(
      el('div', { class: 'composer composer-convite' }, [
        el('div', {}, [
          el('h3', { class: 'composer-titulo font-outfit', text: 'Entre para participar' }),
          el('p', { class: 'form-sub', text: 'Faça login para publicar, curtir e comentar.' }),
        ]),
        el('div', { class: 'composer-botoes' }, [
          el('button', { type: 'button', class: 'btn btn-primary', text: 'Login', onclick: App.abrirLogin }),
          el('a', { href: 'index.html#entrar', class: 'btn btn-outline', text: 'Criar conta' }),
          // PROVISÓRIO: acesso sem login
          el('button', { type: 'button', class: 'btn btn-outline', text: 'Entrar sem login', onclick: App.entrarSemLogin }),
        ]),
      ])
    );
    return;
  }

  const texto = el('textarea', {
    name: 'conteudo',
    rows: 3,
    maxlength: 1000,
    placeholder: `No que você está pensando, @${usuario.nome_usuario}?`,
  });
  const contador = el('span', { class: 'composer-contador', text: '0/1000' });
  const seletor = el(
    'select',
    { name: 'categoria', 'aria-label': 'Categoria' },
    Object.entries(CATEGORIAS).map(([valor, { nome }]) =>
      el('option', { value: valor, text: nome, selected: valor === (categoriaAtual || 'gerais') })
    )
  );
  const erro = el('p', { class: 'form-error', role: 'alert', hidden: true });
  const botao = el('button', { type: 'submit', class: 'btn btn-primary', text: 'Publicar' });

  texto.addEventListener('input', () => {
    contador.textContent = `${texto.value.length}/1000`;
  });

  let imagemEscolhida = null;
  const campoImagem = el('input', { type: 'file', accept: TIPOS_IMAGEM.join(','), hidden: true });
  const botaoImagem = el('button', { type: 'button', class: 'btn-imagem', onclick: () => campoImagem.click() }, [
    icone(ICONES.imagem),
    el('span', { text: 'Imagem' }),
  ]);
  const previaImagem = el('img', { alt: 'Prévia da imagem' });
  const previa = el('div', { class: 'composer-previa', hidden: true }, [
    previaImagem,
    el('button', {
      type: 'button',
      class: 'composer-previa-remover',
      'aria-label': 'Remover imagem',
      title: 'Remover imagem',
      text: '×',
      onclick: () => definirImagem(null),
    }),
  ]);

  function definirImagem(dataUrl) {
    imagemEscolhida = dataUrl;
    previa.hidden = !dataUrl;
    if (dataUrl) previaImagem.src = dataUrl;
    else previaImagem.removeAttribute('src');
    campoImagem.value = '';
  }

  campoImagem.addEventListener('change', async () => {
    const arquivo = campoImagem.files[0];
    if (!arquivo) return;
    App.mostrarErro(erro, '');
    botaoImagem.disabled = true;
    try {
      definirImagem(await comprimirImagem(arquivo));
    } catch (err) {
      definirImagem(null);
      App.mostrarErro(erro, err.message);
    } finally {
      botaoImagem.disabled = false;
    }
  });

  const form = el(
    'form',
    {
      class: 'composer',
      onsubmit: async (evento) => {
        evento.preventDefault();
        App.mostrarErro(erro, '');
        if (!texto.value.trim() && !imagemEscolhida) {
          App.mostrarErro(erro, 'Escreva algo ou escolha uma imagem.');
          return;
        }
        botao.disabled = true;
        botao.textContent = 'Publicando…';
        try {
          const post = await api('/posts', {
            metodo: 'POST',
            corpo: { categoria: seletor.value, conteudo: texto.value, imagem: imagemEscolhida },
          });
          form.reset();
          definirImagem(null);
          contador.textContent = '0/1000';
          if (categoriaAtual && categoriaAtual !== post.categoria) {
            trocarCategoria(post.categoria);
          } else {
            mostrarStatus('');
            listaPosts.prepend(cartaoPost(post));
          }
        } catch (err) {
          App.mostrarErro(erro, err.message);
        } finally {
          botao.disabled = false;
          botao.textContent = 'Publicar';
        }
      },
    },
    [
      el('div', { class: 'composer-linha' }, [avatar(usuario.nome_usuario), texto]),
      previa,
      erro,
      el('div', { class: 'composer-rodape' }, [botaoImagem, campoImagem, seletor, contador, botao]),
    ]
  );

  composer.append(form);
}

// ===== Lista de posts =====
let carregamentoAtual = 0;

async function carregarPosts() {
  const meuCarregamento = ++carregamentoAtual;
  listaPosts.replaceChildren();
  mostrarStatus('Carregando posts…');

  try {
    const query = categoriaAtual ? `?categoria=${categoriaAtual}` : '';
    const posts = await api(`/posts${query}`);
    if (meuCarregamento !== carregamentoAtual) return; // usuário trocou de aba no meio

    if (posts.length === 0) {
      mostrarStatus('Nenhum post por aqui ainda. Que tal ser o primeiro?');
      return;
    }
    mostrarStatus('');
    listaPosts.append(...posts.map(cartaoPost));
  } catch (err) {
    if (meuCarregamento === carregamentoAtual) mostrarStatus(err.message);
  }
}

function cartaoPost(post) {
  const categoria = CATEGORIAS[post.categoria];
  const meu = App.usuario && App.usuario.id === post.autor_id;

  // Curtir
  const totalCurtidas = el('span', { text: post.curtidas });
  const botaoCurtir = el('button', { type: 'button', class: 'acao acao-curtir', 'aria-pressed': post.curtido }, [
    icone(ICONES.coracao),
    totalCurtidas,
  ]);
  botaoCurtir.classList.toggle('ativo', post.curtido);
  botaoCurtir.addEventListener('click', async () => {
    if (!App.usuario) return App.abrirLogin();
    botaoCurtir.disabled = true;
    try {
      const { curtido, curtidas } = await api(`/posts/${post.id}/curtir`, { metodo: 'POST' });
      botaoCurtir.classList.toggle('ativo', curtido);
      botaoCurtir.setAttribute('aria-pressed', curtido);
      totalCurtidas.textContent = curtidas;
    } catch (err) {
      alert(err.message);
    } finally {
      botaoCurtir.disabled = false;
    }
  });

  // Comentários
  const totalComentarios = el('span', { text: post.comentarios });
  const areaComentarios = el('div', { class: 'comentarios', hidden: true });
  let comentariosCarregados = false;

  const botaoComentar = el('button', { type: 'button', class: 'acao', 'aria-expanded': 'false' }, [
    icone(ICONES.balao),
    totalComentarios,
  ]);
  botaoComentar.addEventListener('click', async () => {
    areaComentarios.hidden = !areaComentarios.hidden;
    botaoComentar.setAttribute('aria-expanded', !areaComentarios.hidden);
    if (!areaComentarios.hidden && !comentariosCarregados) {
      comentariosCarregados = true;
      await carregarComentarios(post.id, areaComentarios, totalComentarios);
    }
  });

  // Apagar
  const botaoApagar =
    meu &&
    el('button', { type: 'button', class: 'post-apagar', 'aria-label': 'Apagar post', title: 'Apagar post' }, [
      icone(ICONES.lixeira),
    ]);

  const cartao = el('article', { class: 'post' }, [
    el('header', { class: 'post-topo' }, [
      avatar(post.autor),
      el('div', { class: 'post-info' }, [
        el('span', { class: 'post-autor', text: `@${post.autor}` }),
        el('time', {
          class: 'post-tempo',
          datetime: post.criado_em,
          title: new Date(post.criado_em).toLocaleString('pt-BR'),
          text: App.tempoRelativo(post.criado_em),
        }),
      ]),
      el('span', {
        class: 'post-categoria',
        text: categoria.nome,
        style: { color: categoria.cor, backgroundColor: categoria.fundo },
      }),
      botaoApagar,
    ]),
    post.conteudo && el('p', { class: 'post-texto', text: post.conteudo }),
    post.imagem &&
      el('button', { type: 'button', class: 'post-imagem', 'aria-label': 'Ver imagem em tela cheia', onclick: () => abrirImagem(post.imagem) }, [
        el('img', { src: post.imagem, alt: 'Imagem do post', loading: 'lazy' }),
      ]),
    el('div', { class: 'post-acoes' }, [botaoCurtir, botaoComentar]),
    areaComentarios,
  ]);

  if (botaoApagar) {
    botaoApagar.addEventListener('click', async () => {
      if (!confirm('Apagar este post? Essa ação não pode ser desfeita.')) return;
      botaoApagar.disabled = true;
      try {
        await api(`/posts/${post.id}`, { metodo: 'DELETE' });
        cartao.remove();
        if (!listaPosts.children.length) mostrarStatus('Nenhum post por aqui ainda. Que tal ser o primeiro?');
      } catch (err) {
        alert(err.message);
        botaoApagar.disabled = false;
      }
    });
  }

  return cartao;
}

// ===== Comentários =====
function itemComentario(comentario) {
  return el('li', { class: 'comentario' }, [
    avatar(comentario.autor),
    el('div', { class: 'comentario-corpo' }, [
      el('div', {}, [
        el('span', { class: 'post-autor', text: `@${comentario.autor}` }),
        el('span', { class: 'post-tempo', text: ` · ${App.tempoRelativo(comentario.criado_em)}` }),
      ]),
      el('p', { class: 'comentario-texto', text: comentario.conteudo }),
    ]),
  ]);
}

async function carregarComentarios(postId, area, totalComentarios) {
  const lista = el('ul', { class: 'comentario-lista' });
  const aviso = el('p', { class: 'comentario-aviso', text: 'Carregando comentários…' });
  area.replaceChildren(lista, aviso);

  try {
    const comentarios = await api(`/posts/${postId}/comentarios`);
    lista.append(...comentarios.map(itemComentario));
    aviso.textContent = comentarios.length ? '' : 'Nenhum comentário ainda.';
    aviso.hidden = comentarios.length > 0;
  } catch (err) {
    aviso.textContent = err.message;
  }

  if (!App.usuario) {
    area.append(
      el('p', { class: 'comentario-aviso' }, [
        el('button', { type: 'button', class: 'link', text: 'Faça login', onclick: App.abrirLogin }),
        ' para comentar.',
      ])
    );
    return;
  }

  const campo = el('input', {
    type: 'text',
    maxlength: 500,
    placeholder: 'Escreva um comentário…',
    'aria-label': 'Comentário',
    required: true,
  });
  const botao = el('button', { type: 'submit', class: 'btn btn-primary btn-pequeno', text: 'Enviar' });

  area.append(
    el(
      'form',
      {
        class: 'comentario-form',
        onsubmit: async (evento) => {
          evento.preventDefault();
          botao.disabled = true;
          try {
            const comentario = await api(`/posts/${postId}/comentarios`, {
              metodo: 'POST',
              corpo: { conteudo: campo.value },
            });
            lista.append(itemComentario(comentario));
            aviso.hidden = true;
            totalComentarios.textContent = Number(totalComentarios.textContent) + 1;
            campo.value = '';
          } catch (err) {
            alert(err.message);
          } finally {
            botao.disabled = false;
            campo.focus();
          }
        },
      },
      [campo, botao]
    )
  );
}

// Login/logout muda o que aparece (caixa de post, "curtido", botão apagar)
document.addEventListener('sessao', () => {
  renderizarComposer();
  carregarPosts();
});

atualizarAbas();
renderizarComposer();
carregarPosts();
