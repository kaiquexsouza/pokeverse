// ===== MODO DEMO: API falsa guardada no navegador (sem servidor e sem banco) =====
// Responde às mesmas rotas do server/ usando o localStorage, para o site rodar
// abrindo o index.html direto no navegador.
// Para voltar a usar o servidor de verdade: remova o <script src="demo.js"> das páginas.
const Demo = (() => {
  const CHAVE = 'pokeverse_demo';
  const CATEGORIAS = ['jogos', 'animes', 'cards', 'gerais'];
  const NOME_USUARIO_VALIDO = /^[a-zA-Z0-9_.]{3,20}$/;
  const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function minutosAtras(minutos) {
    return new Date(Date.now() - minutos * 60000).toISOString();
  }

  // Dados iniciais para o site não começar vazio
  function dadosIniciais() {
    return {
      proximoId: 100,
      usuarios: [
        { id: 1, nome_usuario: 'ash_ketchum', email: 'ash@pallet.town' },
        { id: 2, nome_usuario: 'misty', email: 'misty@cerulean.gym' },
        { id: 3, nome_usuario: 'brock', email: 'brock@pewter.gym' },
      ],
      posts: [
        { id: 10, usuario_id: 1, categoria: 'jogos', conteudo: 'Qual foi o primeiro jogo de Pokémon de vocês? O meu foi o Red!', criado_em: minutosAtras(180) },
        { id: 11, usuario_id: 2, categoria: 'animes', conteudo: 'Ainda não superei o final da jornada do Ash no anime.', criado_em: minutosAtras(95) },
        { id: 12, usuario_id: 3, categoria: 'cards', conteudo: 'Abri um booster hoje e veio um Charizard holo!', criado_em: minutosAtras(20) },
      ],
      curtidas: [
        { usuario_id: 2, post_id: 10 },
        { usuario_id: 3, post_id: 10 },
        { usuario_id: 1, post_id: 12 },
      ],
      comentarios: [
        { id: 20, post_id: 10, usuario_id: 3, conteudo: 'Yellow, com o Pikachu andando atrás!', criado_em: minutosAtras(150) },
      ],
    };
  }

  function carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE));
      if (salvo && Array.isArray(salvo.usuarios)) return salvo;
    } catch {
      /* sem localStorage ou dado inválido: começa do zero */
    }
    return dadosIniciais();
  }

  let db = carregar();

  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(db));
    } catch (err) {
      // Espaço do navegador cheio (normalmente por causa das imagens)
      if (err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        throw erro(413, 'O espaço da demonstração está cheio. Apague alguns posts com imagem ou use "Zerar dados".');
      }
      /* sem localStorage: os dados duram só até recarregar */
    }
  }

  function resetar() {
    db = dadosIniciais();
    salvar();
    try {
      localStorage.removeItem('pokeverse_token');
      localStorage.removeItem('pokeverse_usuario');
    } catch {
      /* ignora */
    }
    location.reload();
  }

  // Erro no mesmo formato que o servidor devolve
  function erro(status, mensagem) {
    const e = new Error(mensagem);
    e.status = status;
    return e;
  }

  function sessao(usuario) {
    return {
      token: `demo-${usuario.id}`,
      usuario: { id: usuario.id, nome_usuario: usuario.nome_usuario, email: usuario.email },
    };
  }

  function usuarioDoToken(token) {
    const id = Number(String(token || '').replace('demo-', ''));
    return db.usuarios.find((u) => u.id === id) || null;
  }

  function exigirLogin(token) {
    const usuario = usuarioDoToken(token);
    if (!usuario) throw erro(401, 'Faça login para continuar.');
    return usuario;
  }

  function buscarPost(id) {
    const post = db.posts.find((p) => p.id === Number(id));
    if (!post) throw erro(404, 'Post não encontrado.');
    return post;
  }

  function nomeDe(usuarioId) {
    const usuario = db.usuarios.find((u) => u.id === usuarioId);
    return usuario ? usuario.nome_usuario : 'desconhecido';
  }

  // Post no formato que o front espera
  function formatarPost(post, usuarioLogado) {
    return {
      id: post.id,
      categoria: post.categoria,
      conteudo: post.conteudo,
      imagem: post.imagem || null,
      criado_em: post.criado_em,
      autor_id: post.usuario_id,
      autor: nomeDe(post.usuario_id),
      curtidas: db.curtidas.filter((c) => c.post_id === post.id).length,
      comentarios: db.comentarios.filter((c) => c.post_id === post.id).length,
      curtido: Boolean(usuarioLogado && db.curtidas.some((c) => c.post_id === post.id && c.usuario_id === usuarioLogado.id)),
    };
  }

  // ===== Rotas =====
  function responder(metodo, caminho, corpo = {}, token) {
    const [rota, query = ''] = caminho.split('?');
    const partes = rota.split('/').filter(Boolean); // ex.: ['posts', '10', 'curtir']

    if (metodo === 'GET' && rota === '/estatisticas') {
      return { membros: db.usuarios.length, posts: db.posts.length };
    }

    // ----- auth -----
    if (metodo === 'POST' && rota === '/auth/cadastro') {
      const nome_usuario = String(corpo.nome_usuario || '').trim();
      const email = String(corpo.email || '').trim().toLowerCase();
      if (!NOME_USUARIO_VALIDO.test(nome_usuario)) {
        throw erro(400, 'Nome de usuário deve ter de 3 a 20 caracteres: letras, números, "_" ou ".".');
      }
      if (!EMAIL_VALIDO.test(email)) throw erro(400, 'Informe um e-mail válido.');
      if (String(corpo.senha || '').length < 6) throw erro(400, 'A senha deve ter pelo menos 6 caracteres.');
      if (db.usuarios.some((u) => u.nome_usuario.toLowerCase() === nome_usuario.toLowerCase())) {
        throw erro(409, 'Este nome de usuário já está cadastrado.');
      }
      if (db.usuarios.some((u) => u.email === email)) throw erro(409, 'Este e-mail já está cadastrado.');

      // A senha não é guardada: no modo demo o login não confere senha
      const usuario = { id: db.proximoId++, nome_usuario, email };
      db.usuarios.push(usuario);
      salvar();
      return sessao(usuario);
    }

    if (metodo === 'POST' && rota === '/auth/login') {
      const login = String(corpo.login || '').trim().toLowerCase();
      const usuario = db.usuarios.find((u) => u.nome_usuario.toLowerCase() === login || u.email === login);
      if (!usuario) throw erro(401, 'Usuário/e-mail não encontrado (modo demo: qualquer senha serve).');
      return sessao(usuario);
    }

    if (metodo === 'POST' && rota === '/auth/visitante') {
      let usuario = db.usuarios.find((u) => u.nome_usuario === 'visitante');
      if (!usuario) {
        usuario = { id: db.proximoId++, nome_usuario: 'visitante', email: 'visitante@pokeverse.local' };
        db.usuarios.push(usuario);
        salvar();
      }
      return sessao(usuario);
    }

    if (metodo === 'GET' && rota === '/auth/eu') {
      return exigirLogin(token);
    }

    // ----- posts -----
    if (partes[0] === 'posts') {
      if (metodo === 'GET' && partes.length === 1) {
        const categoria = new URLSearchParams(query).get('categoria');
        const logado = usuarioDoToken(token);
        return db.posts
          .filter((p) => !CATEGORIAS.includes(categoria) || p.categoria === categoria)
          .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
          .map((p) => formatarPost(p, logado));
      }

      if (metodo === 'POST' && partes.length === 1) {
        const usuario = exigirLogin(token);
        const categoria = String(corpo.categoria || '');
        const conteudo = String(corpo.conteudo || '').trim();
        const imagem = corpo.imagem ? String(corpo.imagem) : null;
        if (!CATEGORIAS.includes(categoria)) throw erro(400, 'Escolha uma categoria válida.');
        if (imagem && !imagem.startsWith('data:image/')) throw erro(400, 'Imagem inválida.');
        if (!conteudo && !imagem) throw erro(400, 'Escreva algo ou escolha uma imagem.');
        if (conteudo.length > 1000) throw erro(400, 'O post deve ter no máximo 1000 caracteres.');

        const post = { id: db.proximoId++, usuario_id: usuario.id, categoria, conteudo, imagem, criado_em: new Date().toISOString() };
        db.posts.push(post);
        try {
          salvar();
        } catch (err) {
          db.posts.pop(); // não deixa o post só na memória se não coube
          db.proximoId--;
          throw err;
        }
        return formatarPost(post, usuario);
      }

      if (metodo === 'DELETE' && partes.length === 2) {
        const usuario = exigirLogin(token);
        const post = buscarPost(partes[1]);
        if (post.usuario_id !== usuario.id) throw erro(403, 'Você só pode apagar seus próprios posts.');
        db.posts = db.posts.filter((p) => p.id !== post.id);
        db.curtidas = db.curtidas.filter((c) => c.post_id !== post.id);
        db.comentarios = db.comentarios.filter((c) => c.post_id !== post.id);
        salvar();
        return null;
      }

      if (metodo === 'POST' && partes[2] === 'curtir') {
        const usuario = exigirLogin(token);
        const post = buscarPost(partes[1]);
        const minha = (c) => c.post_id === post.id && c.usuario_id === usuario.id;
        const curtido = !db.curtidas.some(minha);
        if (curtido) db.curtidas.push({ usuario_id: usuario.id, post_id: post.id });
        else db.curtidas = db.curtidas.filter((c) => !minha(c));
        salvar();
        return { curtido, curtidas: db.curtidas.filter((c) => c.post_id === post.id).length };
      }

      if (partes[2] === 'comentarios') {
        const post = buscarPost(partes[1]);

        if (metodo === 'GET') {
          return db.comentarios
            .filter((c) => c.post_id === post.id)
            .sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em))
            .map((c) => ({ id: c.id, conteudo: c.conteudo, criado_em: c.criado_em, autor_id: c.usuario_id, autor: nomeDe(c.usuario_id) }));
        }

        if (metodo === 'POST') {
          const usuario = exigirLogin(token);
          const conteudo = String(corpo.conteudo || '').trim();
          if (!conteudo || conteudo.length > 500) throw erro(400, 'O comentário deve ter entre 1 e 500 caracteres.');
          const comentario = { id: db.proximoId++, post_id: post.id, usuario_id: usuario.id, conteudo, criado_em: new Date().toISOString() };
          db.comentarios.push(comentario);
          salvar();
          return { id: comentario.id, conteudo, criado_em: comentario.criado_em, autor_id: usuario.id, autor: usuario.nome_usuario };
        }
      }
    }

    throw erro(404, 'Rota não encontrada.');
  }

  // ===== Aviso de modo demo (com botão para zerar os dados) =====
  function mostrarAviso() {
    const aviso = document.createElement('div');
    aviso.className = 'demo-aviso';
    aviso.append('Modo demonstração: os dados ficam salvos só neste navegador. ');
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'link';
    botao.textContent = 'Zerar dados';
    botao.addEventListener('click', () => {
      if (confirm('Apagar todos os cadastros e posts da demonstração?')) resetar();
    });
    aviso.append(botao);
    document.body.prepend(aviso);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mostrarAviso);
  else mostrarAviso();

  return { responder };
})();
