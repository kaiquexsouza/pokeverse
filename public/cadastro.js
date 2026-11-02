const params = new URLSearchParams(location.search);
const token = params.get('token') || '';
const loading = document.getElementById('cadastro-loading');
const form = document.getElementById('cadastro-form');
const success = document.getElementById('cadastro-success');
const error = document.getElementById('cadastro-error');
const email = document.getElementById('cadastro-email');

async function carregarConvite() {
  try {
    const interessado = await App.api(`/auth/pre-cadastro/${encodeURIComponent(token)}`);
    email.textContent = `Convite enviado para ${interessado.email}`;
    loading.hidden = true;
    form.hidden = false;
  } catch (err) {
    loading.replaceChildren();
    const title = document.createElement('h1');
    title.className = 'form-title font-outfit';
    title.textContent = 'Convite inválido';
    const message = document.createElement('p');
    message.className = 'form-sub';
    message.textContent = err.message;
    loading.append(title, message);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  const submit = document.getElementById('cadastro-submit');
  submit.disabled = true;
  submit.textContent = 'Criando conta...';
  try {
    const dados = await App.api('/auth/pre-cadastro/finalizar', {
      metodo: 'POST',
      corpo: { token, nome_usuario: form.nome_usuario.value.trim(), senha: form.senha.value },
    });
    App.salvarSessao(dados);
    form.hidden = true;
    success.hidden = false;
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = 'Criar minha conta';
  }
});

if (token) carregarConvite();
else {
  loading.replaceChildren();
  const title = document.createElement('h1');
  title.className = 'form-title font-outfit';
  title.textContent = 'Convite ausente';
  const message = document.createElement('p');
  message.className = 'form-sub';
  message.textContent = 'Abra o link recebido por e-mail para continuar.';
  loading.append(title, message);
}
