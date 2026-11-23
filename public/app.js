// Código compartilhado entre as páginas: API, sessão, header e modal de login.
const App = (() => {
  const CHAVE_TOKEN = 'pokeverse_token';
  const CHAVE_USUARIO = 'pokeverse_usuario';

  const CATEGORIAS = {
    jogos: { nome: 'Jogos Pokémon', cor: '#DC2626', fundo: '#FEF2F2' },
    animes: { nome: 'Animes', cor: '#2563EB', fundo: '#EFF6FF' },
    cards: { nome: 'Trading Cards', cor: '#D97706', fundo: '#FFFBEB' },
    gerais: { nome: 'Assuntos Gerais', cor: '#7C3AED', fundo: '#F5F3FF' },
  };

  const TIPOS_ENCONTRO = {
    batalha: { nome: 'Batalha / jogatina', emoji: '⚔️', cor: '#DC2626', fundo: '#FEF2F2' },
    troca: { nome: 'Troca de cartas', emoji: '🃏', cor: '#D97706', fundo: '#FFFBEB' },
    torneio: { nome: 'Torneio', emoji: '🏆', cor: '#7C3AED', fundo: '#F5F3FF' },
    anime: { nome: 'Maratona de anime', emoji: '📺', cor: '#2563EB', fundo: '#EFF6FF' },
    papo: { nome: 'Bate-papo', emoji: '💬', cor: '#059669', fundo: '#ECFDF5' },
  };

  // ===== Sessão (guardada no navegador) =====
  function ler(chave) {
    try {
      return localStorage.getItem(chave);
    } catch {
      return null;
    }
  }

  function gravar(chave, valor) {
    try {
      if (valor === null) localStorage.removeItem(chave);
      else localStorage.setItem(chave, valor);
    } catch {
      /* navegador sem localStorage: a sessão dura só até recarregar */
    }
  }

  let token = ler(CHAVE_TOKEN);
  let usuario = null;
  try {
    usuario = JSON.parse(ler(CHAVE_USUARIO));
  } catch {
    usuario = null;
  }
  if (!token || !usuario) {
    token = null;
    usuario = null;
  }

  function avisarMudancaSessao() {
    renderizarNav();
    document.dispatchEvent(new CustomEvent('sessao', { detail: usuario }));
  }

  function salvarSessao(dados) {
    token = dados.token;
    usuario = dados.usuario;
    gravar(CHAVE_TOKEN, token);
    gravar(CHAVE_USUARIO, JSON.stringify(usuario));
    avisarMudancaSessao();
  }

  function sair() {
    token = null;
    usuario = null;
    gravar(CHAVE_TOKEN, null);
    gravar(CHAVE_USUARIO, null);
    avisarMudancaSessao();
  }

  // ===== API =====
  async function api(caminho, { metodo = 'GET', corpo } = {}) {
    const headers = {};
    if (corpo !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    let resposta;
    try {
      resposta = await fetch(`/api${caminho}`, {
        method: metodo,
        headers,
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      });
    } catch {
      throw new Error('Sem conexão com o servidor. Tente novamente.');
    }

    if (resposta.status === 204) return null;

    // Resposta que não é JSON = não é a nossa API (ex.: site aberto pelo Live Server)
    if (!(resposta.headers.get('content-type') || '').includes('application/json')) {
      throw new Error('Servidor da API não encontrado. Rode "npm run dev" e acesse http://localhost:3000');
    }
    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      // Token expirado ou inválido: desloga
      if (resposta.status === 401 && token) sair();
      throw new Error(dados.erro || 'Algo deu errado. Tente novamente.');
    }
    return dados;
  }

  // ===== Helpers de interface =====
  // Cria elementos sem innerHTML, para nunca interpretar texto do usuário como HTML
  function el(tag, atributos = {}, filhos = []) {
    const elemento = document.createElement(tag);
    for (const [nome, valor] of Object.entries(atributos)) {
      if (valor === null || valor === undefined || valor === false) continue;
      if (nome === 'class') elemento.className = valor;
      else if (nome === 'text') elemento.textContent = valor;
      else if (nome === 'style') {
        for (const [propriedade, valorEstilo] of Object.entries(valor)) {
          if (propriedade.startsWith('--')) elemento.style.setProperty(propriedade, valorEstilo);
          else elemento.style[propriedade] = valorEstilo;
        }
      }
      else if (nome.startsWith('on')) elemento.addEventListener(nome.slice(2), valor);
      else elemento.setAttribute(nome, valor === true ? '' : valor);
    }
    for (const filho of [].concat(filhos)) {
      if (filho === null || filho === undefined || filho === false) continue;
      elemento.append(filho);
    }
    return elemento;
  }

  const CORES_AVATAR = ['#DC2626', '#2563EB', '#D97706', '#7C3AED', '#059669', '#DB2777'];

  function avatar(nome) {
    let soma = 0;
    for (const letra of nome) soma += letra.charCodeAt(0);
    return el('span', {
      class: 'avatar',
      text: nome[0].toUpperCase(),
      style: { backgroundColor: CORES_AVATAR[soma % CORES_AVATAR.length] },
    });
  }

  // Ícones SVG fixos (sem conteúdo do usuário)
  function icone(svg) {
    const span = document.createElement('span');
    span.className = 'icon';
    span.innerHTML = svg;
    return span;
  }

  const relativo = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

  function tempoRelativo(data) {
    const segundos = Math.round((new Date(data) - Date.now()) / 1000);
    const unidades = [
      ['year', 31536000],
      ['month', 2592000],
      ['week', 604800],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
    ];
    for (const [unidade, tamanho] of unidades) {
      if (Math.abs(segundos) >= tamanho) return relativo.format(Math.round(segundos / tamanho), unidade);
    }
    return 'agora mesmo';
  }

  function blocoData(dataHora, tipo) {
    const data = new Date(dataHora);
    const parte = (opcoes) => new Intl.DateTimeFormat('pt-BR', opcoes).format(data).replace('.', '');
    return el('div', { class: 'bloco-data', style: { '--cor-tipo': TIPOS_ENCONTRO[tipo].cor } }, [
      el('span', { class: 'bloco-data-semana', text: parte({ weekday: 'short' }) }),
      el('span', { class: 'bloco-data-dia font-outfit', text: parte({ day: '2-digit' }) }),
      el('span', { class: 'bloco-data-mes', text: parte({ month: 'short' }) }),
      el('span', { class: 'bloco-data-hora', text: parte({ hour: '2-digit', minute: '2-digit' }) }),
    ]);
  }

  function formatarNumero(numero) {
    return new Intl.NumberFormat('pt-BR').format(numero);
  }

  function mostrarErro(elemento, mensagem) {
    elemento.textContent = mensagem || '';
    elemento.hidden = !mensagem;
  }

  // ===== Header =====
  function renderizarNav() {
    const area = document.getElementById('nav-auth');
    if (!area) return;
    area.replaceChildren();

    if (usuario) {
      area.append(
        el('span', { class: 'nav-user', title: usuario.email }, [
          el('span', { class: 'nav-user-avatar', text: usuario.nome_usuario[0].toUpperCase() }),
          el('span', { class: 'nav-user-name', text: `@${usuario.nome_usuario}` }),
        ]),
        el('button', { type: 'button', class: 'btn-login', text: 'Sair', onclick: sair })
      );
    } else {
      area.append(el('button', { type: 'button', class: 'btn-login', text: 'Login', onclick: abrirLogin }));
    }
  }

  // ===== Modal de login =====
  let modal = null;

  function criarModal() {
    const erro = el('p', { class: 'form-error', role: 'alert', hidden: true });
    const campoLogin = el('input', {
      id: 'login-usuario',
      name: 'login',
      type: 'text',
      placeholder: 'ash ou ash@pallet.town',
      autocomplete: 'username',
      required: true,
    });
    const campoSenha = el('input', {
      id: 'login-senha',
      name: 'senha',
      type: 'password',
      placeholder: '••••••',
      autocomplete: 'current-password',
      required: true,
    });
    const botao = el('button', { type: 'submit', class: 'btn-submit', text: 'Entrar' });

    const form = el(
      'form',
      {
        class: 'form',
        onsubmit: async (evento) => {
          evento.preventDefault();
          mostrarErro(erro, '');
          botao.disabled = true;
          botao.textContent = 'Entrando…';
          try {
            const dados = await api('/auth/login', {
              metodo: 'POST',
              corpo: { login: campoLogin.value.trim(), senha: campoSenha.value },
            });
            salvarSessao(dados);
            fecharLogin();
            form.reset();
          } catch (err) {
            mostrarErro(erro, err.message);
          } finally {
            botao.disabled = false;
            botao.textContent = 'Entrar';
          }
        },
      },
      [
        el('div', {}, [
          el('h3', { class: 'form-title font-outfit', id: 'modal-titulo', text: 'Entrar no Pokeverse' }),
          el('p', { class: 'form-sub', text: 'Use seu nome de usuário ou e-mail.' }),
        ]),
        el('div', { class: 'field' }, [el('label', { for: 'login-usuario', text: 'Usuário ou e-mail' }), campoLogin]),
        el('div', { class: 'field' }, [el('label', { for: 'login-senha', text: 'Senha' }), campoSenha]),
        erro,
        botao,
        el('p', { class: 'form-terms' }, [
          'Ainda não tem conta? ',
          el('a', { href: 'index.html#entrar', class: 'link', text: 'Cadastre-se', onclick: fecharLogin }),
        ]),
      ]
    );

    modal = el(
      'div',
      {
        class: 'modal-overlay',
        hidden: true,
        onclick: (evento) => {
          if (evento.target === modal) fecharLogin();
        },
      },
      el('div', { class: 'modal card-form', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-titulo' }, [
        el('div', { class: 'card-form-bar' }),
        el('button', { type: 'button', class: 'modal-close', 'aria-label': 'Fechar', text: '×', onclick: fecharLogin }),
        form,
      ])
    );

    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape' && !modal.hidden) fecharLogin();
    });

    document.body.append(modal);
  }

  function abrirLogin() {
    if (!modal) criarModal();
    modal.hidden = false;
    document.body.classList.add('sem-rolagem');
    modal.querySelector('#login-usuario').focus();
  }

  function fecharLogin() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('sem-rolagem');
  }

  // ===== Inicialização =====
  const ano = document.getElementById('year');
  if (ano) ano.textContent = new Date().getFullYear();

  renderizarNav();

  // Confere se o token salvo ainda vale (se não valer, api() desloga)
  if (token) api('/auth/eu').catch(() => {});

  return {
    CATEGORIAS,
    TIPOS_ENCONTRO,
    blocoData,
    api,
    el,
    avatar,
    icone,
    tempoRelativo,
    formatarNumero,
    mostrarErro,
    salvarSessao,
    sair,
    abrirLogin,
    get usuario() {
      return usuario;
    },
  };
})();
