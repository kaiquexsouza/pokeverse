-- Tabelas do Pokeverse. Executado automaticamente quando o servidor inicia
-- (IF NOT EXISTS: não apaga nada que já exista).

CREATE TABLE IF NOT EXISTS usuarios (
  id           SERIAL PRIMARY KEY,
  nome_usuario VARCHAR(20)  NOT NULL,
  email        VARCHAR(255) NOT NULL,
  senha_hash   TEXT         NOT NULL,
  criado_em    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Nome de usuário e e-mail únicos, sem diferenciar maiúsculas/minúsculas
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_nome_usuario_unico ON usuarios (LOWER(nome_usuario));
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_unico ON usuarios (LOWER(email));

CREATE TABLE IF NOT EXISTS posts (
  id         SERIAL PRIMARY KEY,
  usuario_id INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria  VARCHAR(20) NOT NULL CHECK (categoria IN ('jogos', 'animes', 'cards', 'gerais')),
  conteudo   TEXT        NOT NULL CHECK (char_length(conteudo) BETWEEN 1 AND 1000),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posts_criado_em_idx ON posts (criado_em DESC);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS imagem BYTEA;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS imagem_tipo VARCHAR(20);
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_conteudo_check;
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_conteudo_ou_imagem;
ALTER TABLE posts ADD CONSTRAINT posts_conteudo_ou_imagem
  CHECK (char_length(conteudo) <= 1000 AND (char_length(conteudo) >= 1 OR imagem IS NOT NULL));

CREATE TABLE IF NOT EXISTS curtidas (
  usuario_id INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  post_id    INTEGER     NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, post_id)
);

CREATE INDEX IF NOT EXISTS curtidas_post_idx ON curtidas (post_id);

CREATE TABLE IF NOT EXISTS comentarios (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER     NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  usuario_id INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  conteudo   TEXT        NOT NULL CHECK (char_length(conteudo) BETWEEN 1 AND 500),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comentarios_post_idx ON comentarios (post_id);

CREATE TABLE IF NOT EXISTS encontros (
  id             SERIAL PRIMARY KEY,
  organizador_id INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo           VARCHAR(20)  NOT NULL CHECK (tipo IN ('batalha', 'troca', 'torneio', 'anime', 'papo')),
  titulo         VARCHAR(80)  NOT NULL CHECK (char_length(titulo) >= 3),
  descricao      TEXT         NOT NULL DEFAULT '' CHECK (char_length(descricao) <= 1000),
  data_hora      TIMESTAMPTZ  NOT NULL,
  local          VARCHAR(160) NOT NULL CHECK (char_length(local) >= 3),
  cidade         VARCHAR(60)  NOT NULL CHECK (char_length(cidade) >= 2),
  vagas          INTEGER      CHECK (vagas BETWEEN 2 AND 500),
  criado_em      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS encontros_data_hora_idx ON encontros (data_hora);

CREATE TABLE IF NOT EXISTS encontro_participantes (
  encontro_id INTEGER     NOT NULL REFERENCES encontros(id) ON DELETE CASCADE,
  usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (encontro_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS encontro_participantes_usuario_idx ON encontro_participantes (usuario_id);
