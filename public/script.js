// Landing page: contador de membros e cadastro.

const form = document.getElementById('join-form');
const success = document.getElementById('join-success');
const successTitle = document.getElementById('success-title');
const joinError = document.getElementById('join-error');
const joinSubmit = document.getElementById('join-submit');

// ===== Contadores (vêm do banco) =====
function animarContador(elemento, valorFinal) {
  const valorInicial = Number(elemento.dataset.valor) || 0;
  elemento.dataset.valor = valorFinal;
  const duracao = 800;
  const inicio = performance.now();

  function passo(agora) {
    const progresso = Math.min((agora - inicio) / duracao, 1);
    const atual = Math.round(valorInicial + (valorFinal - valorInicial) * progresso);
    elemento.textContent = App.formatarNumero(atual);
    if (progresso < 1) requestAnimationFrame(passo);
  }
  requestAnimationFrame(passo);
}

async function carregarEstatisticas() {
  try {
    const { membros, posts } = await App.api('/estatisticas');
    animarContador(document.getElementById('stat-membros'), membros);
    animarContador(document.getElementById('stat-posts'), posts);

    const cta = document.getElementById('cta-membros');
    if (membros === 0) cta.textContent = 'Seja o primeiro treinador a entrar!';
    else if (membros === 1) cta.textContent = '1 treinador já está esperando por você.';
    else cta.textContent = `${App.formatarNumero(membros)} treinadores já estão esperando por você.`;
  } catch {
    // Sem servidor: mantém os textos padrão
  }
}

// ===== Logado x deslogado =====
function atualizarTela() {
  const usuario = App.usuario;

  form.hidden = Boolean(usuario);
  success.hidden = !usuario;
  if (usuario) successTitle.textContent = `Bem-vindo, @${usuario.nome_usuario}!`;

  // Botões de chamada: deslogado vai para o cadastro, logado vai para o feed
  document.querySelectorAll('[data-cta]').forEach((link) => {
    link.href = usuario ? 'feed.html' : '#entrar';
  });
}

// ===== Cadastro =====
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  App.mostrarErro(joinError, '');

  joinSubmit.disabled = true;
  joinSubmit.textContent = 'Criando conta…';

  try {
    const dados = await App.api('/auth/cadastro', {
      metodo: 'POST',
      corpo: {
        nome_usuario: form.nome_usuario.value.trim(),
        email: form.email.value.trim(),
        senha: form.senha.value,
      },
    });
    form.reset();
    App.salvarSessao(dados);
  } catch (err) {
    App.mostrarErro(joinError, err.message);
  } finally {
    joinSubmit.disabled = false;
    joinSubmit.textContent = 'Juntar-se à Comunidade';
  }
});

document.getElementById('join-login').addEventListener('click', App.abrirLogin);
document.addEventListener('sessao', () => {
  atualizarTela();
  carregarEstatisticas();
});

atualizarTela();
carregarEstatisticas();
