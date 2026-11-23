// Ano atual no rodapé
document.getElementById('year').textContent = new Date().getFullYear();

// Botão Login leva até o formulário de cadastro
document.getElementById('btn-login').addEventListener('click', () => {
  document.getElementById('entrar').scrollIntoView({ behavior: 'smooth' });
});

// Formulário de cadastro (sem API: apenas troca para a tela de sucesso)
const form = document.getElementById('join-form');
const success = document.getElementById('join-success');

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const nome = form.nome.value.trim();
  const email = form.email.value.trim();

  if (!nome || !email) return;

  form.hidden = true;
  success.hidden = false;
});
