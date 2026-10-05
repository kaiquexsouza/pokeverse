# pokeverse
Pokeverse é um projeto de uma comunidade/fraternidade universitária web voltada para fãs de Pokémon que desejam se conectar, compartilhar paixões e aprender juntos. Participando de encontros marcados na página

## Funcionalidades
- Cadastro (nome de usuário, e-mail e senha) e login com nome de usuário **ou** e-mail
- Contador de membros e de posts vindo do banco
- Feed com filtro por categoria (Jogos, Animes, Trading Cards, Assuntos Gerais)
- Criar posts, curtir/descurtir, comentar e apagar os próprios posts

## Tecnologias
- **Front-end:** HTML, CSS e JavaScript puro (`public/`)
- **Back-end:** Node.js + Express (`server/`)
- **Banco:** PostgreSQL (tabelas em `server/schema.sql`, criadas automaticamente ao iniciar)
- **Senhas:** bcrypt · **Sessão:** JWT

## Estrutura
```
public/            site (index.html, feed.html, style.css, app.js, script.js, feed.js)
server/index.js    servidor Express (serve o site e a API)
server/db.js       conexão com o PostgreSQL
server/auth.js     geração/validação do token de login
server/routes/     rotas da API (auth.js, posts.js)
server/schema.sql  tabelas: usuarios, posts, curtidas, comentarios
render.yaml        configuração de deploy no Render
```

## Modo demo (sem servidor e sem banco)
Hoje o site está em **modo demo**: basta abrir o `public/index.html` no navegador (ou pelo Live Server).
O `public/demo.js` imita a API e guarda cadastros e posts no `localStorage`, então o contador de
membros/discussões sobe ao se cadastrar ou postar. Os dados ficam só naquele navegador
(o botão "Zerar dados" no aviso do topo volta ao início), e o login não confere a senha.

Para usar o servidor de verdade, remova a linha `<script src="demo.js"></script>` do `index.html` e do `feed.html`.

## Rodando localmente
1. Instale o [Node.js](https://nodejs.org) 20+ e o PostgreSQL (o instalador já inclui o pgAdmin).
2. No **pgAdmin**: clique com o botão direito em *Databases → Create → Database…*, nome `pokeverse`.
   Na aba *Definition*, deixe **Encoding = UTF8** (senão acentos dão erro).
3. Copie `.env.example` para `.env` e coloque a senha do seu Postgres na `DATABASE_URL`.
4. No terminal, na pasta do projeto:
   ```bash
   npm install
   npm run dev
   ```
5. Acesse http://localhost:3000. As tabelas são criadas sozinhas na primeira execução.

> O site precisa do servidor rodando. Abrir o `index.html` direto no navegador não carrega login nem posts.

## Deploy no Render
1. Envie o código para o GitHub.
2. No [Render](https://dashboard.render.com): **New → Blueprint** e selecione o repositório.
   O `render.yaml` cria o site (`pokeverse`) e o banco (`pokeverse-db`), já conectados, e gera o `JWT_SECRET`.
3. Clique em **Apply** e aguarde o deploy. A URL aparece no serviço `pokeverse` (ex.: `https://pokeverse.onrender.com`).

Observações do plano gratuito:
- O site "dorme" após ~15 min sem acesso; o primeiro acesso depois disso demora uns 30–50 s.
- O PostgreSQL gratuito do Render tem prazo de validade. Confira a data no painel do banco.

## Acessando o banco do Render pelo pgAdmin
1. No Render, abra o banco `pokeverse-db` → **Connect** → aba **External** e copie os dados.
2. No pgAdmin: *Servers → Register → Server…*
   - **General → Name:** `Pokeverse (Render)`
   - **Connection → Host:** o host externo (ex.: `dpg-xxxxx-a.oregon-postgres.render.com`)
   - **Port:** `5432` · **Maintenance database:** `pokeverse`
   - **Username / Password:** os do Render
   - **Parameters → SSL mode:** `require`
3. As tabelas ficam em *pokeverse → Schemas → public → Tables*.

## API
| Método | Rota | Login? | Descrição |
|---|---|---|---|
| POST | `/api/auth/cadastro` | | `{ nome_usuario, email, senha }` |
| POST | `/api/auth/login` | | `{ login, senha }` (login = usuário ou e-mail) |
| GET | `/api/auth/eu` | ✔ | dados do usuário logado |
| GET | `/api/estatisticas` | | `{ membros, posts }` |
| GET | `/api/posts?categoria=` | | lista posts (categoria opcional) |
| POST | `/api/posts` | ✔ | `{ categoria, conteudo }` |
| DELETE | `/api/posts/:id` | ✔ | apaga (só o autor) |
| POST | `/api/posts/:id/curtir` | ✔ | curte/descurte |
| GET | `/api/posts/:id/comentarios` | | lista comentários |
| POST | `/api/posts/:id/comentarios` | ✔ | `{ conteudo }` |

Rotas com login exigem o header `Authorization: Bearer <token>`.
