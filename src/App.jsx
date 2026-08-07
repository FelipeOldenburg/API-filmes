import React, { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useParams } from "react-router-dom";

const API = "https://api.themoviedb.org/3";
const KEY = import.meta.env.REACT_APP_KEY;
const IMG = "https://image.tmdb.org/t/p/w500";
const POSTER_FALLBACK = "https://placehold.co/500x750?text=Sem+poster";

const CATEGORIES = [
  { id: "popular", label: "Populares", path: "/movie/popular" },
  { id: "action", label: "Acao", genre: 28 },
  { id: "comedy", label: "Comedia", genre: 35 },
  { id: "drama", label: "Drama", genre: 18 },
  { id: "horror", label: "Terror", genre: 27 },
  { id: "animation", label: "Animacao", genre: 16 }
];

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function compactMovie(movie) {
  return {
    id: movie.id,
    title: movie.title,
    poster_path: movie.poster_path,
    vote_average: movie.vote_average,
    release_date: movie.release_date
  };
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function fetchTmdb(path) {
  if (!KEY) throw new Error("Chave da API nao encontrada no .env.");

  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(
    `${API}${path}${separator}api_key=${KEY}&language=pt-BR&include_adult=false`
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.status_message || "Erro ao carregar filmes.");
  }

  return data;
}

function poster(movie) {
  return movie.poster_path ? `${IMG}${movie.poster_path}` : POSTER_FALLBACK;
}

function App() {
  const [users, setUsers] = useState(() => readStorage("movie_users", {}));
  const [currentUser, setCurrentUser] = useState(() =>
    readStorage("movie_current_user", "")
  );
  const [favorites, setFavorites] = useState(() =>
    readStorage("movie_favorites", {})
  );
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    localStorage.setItem("movie_users", JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem("movie_current_user", JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem("movie_favorites", JSON.stringify(favorites));
  }, [favorites]);

  const userFavorites = currentUser ? favorites[currentUser] || [] : [];

  async function createUser(username, password) {
    const name = username.trim();
    if (!name || !password) return setAuthError("Informe login e senha.");
    if (users[name]) return setAuthError("Esse login ja existe.");

    // ponytail: login local para a atividade; trocar por Auth/API em producao.
    const passwordHash = await hashPassword(password);
    setUsers((oldUsers) => ({ ...oldUsers, [name]: { passwordHash } }));
    setCurrentUser(name);
    setAuthError("");
  }

  async function login(username, password) {
    const name = username.trim();
    const user = users[name];
    if (!user) return setAuthError("Login nao encontrado.");
    if (user.passwordHash !== (await hashPassword(password))) {
      return setAuthError("Senha incorreta.");
    }

    setCurrentUser(name);
    setAuthError("");
  }

  function logout() {
    setCurrentUser("");
  }

  function toggleFavorite(movie) {
    if (!currentUser) return setAuthError("Entre para salvar favoritos.");

    setFavorites((oldFavorites) => {
      const list = oldFavorites[currentUser] || [];
      const exists = list.some((item) => item.id === movie.id);
      const nextList = exists
        ? list.filter((item) => item.id !== movie.id)
        : [compactMovie(movie), ...list];

      return { ...oldFavorites, [currentUser]: nextList };
    });
  }

  const sharedProps = {
    currentUser,
    favorites: userFavorites,
    authError,
    onCreateUser: createUser,
    onLogin: login,
    onLogout: logout,
    onToggleFavorite: toggleFavorite
  };

  return (
    <Routes>
      <Route path="/" element={<Home {...sharedProps} />} />
      <Route path="/movie/:id" element={<MovieDetails {...sharedProps} />} />
      <Route path="*" element={<Home {...sharedProps} />} />
    </Routes>
  );
}

function AuthBar({
  currentUser,
  authError,
  onCreateUser,
  onLogin,
  onLogout
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event, action) {
    event.preventDefault();
    await action(username, password);
    setPassword("");
  }

  if (currentUser) {
    return (
      <div className="auth-box">
        <span>Usuario: {currentUser}</span>
        <button type="button" onClick={onLogout}>
          Sair
        </button>
      </div>
    );
  }

  return (
    <form className="auth-box" onSubmit={(event) => submit(event, onLogin)}>
      <input
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder="Login"
        aria-label="Login"
      />
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Senha"
        aria-label="Senha"
      />
      <button type="submit">Entrar</button>
      <button type="button" onClick={(event) => submit(event, onCreateUser)}>
        Criar conta
      </button>
      {authError && <small>{authError}</small>}
    </form>
  );
}

function Home(props) {
  const {
    currentUser,
    favorites,
    authError,
    onCreateUser,
    onLogin,
    onLogout,
    onToggleFavorite
  } = props;

  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].id);
  const [search, setSearch] = useState("");
  const [movies, setMovies] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  const category = useMemo(
    () => CATEGORIES.find((item) => item.id === selectedCategory),
    [selectedCategory]
  );

  useEffect(() => {
    fetchTmdb("/movie/top_rated")
      .then((data) => setTopRated((data.results || []).slice(0, 6)))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const query = search.trim();
      const path = query
        ? `/search/movie?query=${encodeURIComponent(query)}`
        : category.genre
          ? `/discover/movie?with_genres=${category.genre}&sort_by=popularity.desc`
          : category.path;

      setLoading(true);
      setError("");
      fetchTmdb(path)
        .then((data) => setMovies(data.results || []))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, 350);

    return () => clearTimeout(timeout);
  }, [category, search]);

  async function shareFavorites() {
    if (!favorites.length) return setShareMessage("Sua lista ainda esta vazia.");

    const text = favorites
      .map((movie) => `${movie.title} - ${window.location.origin}/movie/${movie.id}`)
      .join("\n");

    if (navigator.share) {
      await navigator.share({ title: "Minha lista de filmes", text });
      return setShareMessage("Lista compartilhada.");
    }

    await navigator.clipboard.writeText(text);
    setShareMessage("Lista copiada para a area de transferencia.");
  }

  return (
    <main>
      <header className="topbar">
        <Link to="/" className="brand">
          API Filmes
        </Link>
        <AuthBar
          currentUser={currentUser}
          authError={authError}
          onCreateUser={onCreateUser}
          onLogin={onLogin}
          onLogout={onLogout}
        />
      </header>

      <section className="toolbar" aria-label="Categorias e pesquisa">
        <nav className="categories" aria-label="Categorias">
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === selectedCategory ? "active" : ""}
              onClick={() => {
                setSelectedCategory(item.id);
                setSearch("");
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <label className="search">
          <span>Pesquisar</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Digite o nome do filme"
          />
        </label>
      </section>

      {error && <p className="message error">{error}</p>}

      <SectionTitle
        title={search.trim() ? "Resultado da pesquisa" : category.label}
        subtitle={loading ? "Carregando..." : `${movies.length} filmes encontrados`}
      />
      <MovieGrid
        movies={movies}
        favorites={favorites}
        currentUser={currentUser}
        onToggleFavorite={onToggleFavorite}
      />

      <SectionTitle title="Melhores avaliados" subtitle="Top da TMDB" />
      <MovieGrid
        movies={topRated}
        favorites={favorites}
        currentUser={currentUser}
        onToggleFavorite={onToggleFavorite}
      />

      <section className="list-panel">
        <div>
          <h2>Minha lista</h2>
          <p>
            {currentUser
              ? `${favorites.length} filmes salvos`
              : "Entre para salvar seus favoritos."}
          </p>
        </div>
        <button type="button" onClick={shareFavorites} disabled={!currentUser}>
          Compartilhar lista
        </button>
      </section>
      {shareMessage && <p className="message">{shareMessage}</p>}
      {currentUser && (
        <MovieGrid
          movies={favorites}
          favorites={favorites}
          currentUser={currentUser}
          onToggleFavorite={onToggleFavorite}
          compact
        />
      )}
    </main>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="section-title">
      <h1>{title}</h1>
      <span>{subtitle}</span>
    </div>
  );
}

function MovieGrid({
  movies,
  favorites,
  currentUser,
  onToggleFavorite,
  compact = false
}) {
  if (!movies.length) {
    return <p className="empty">Nenhum filme para mostrar.</p>;
  }

  return (
    <div className={compact ? "movie-grid compact" : "movie-grid"}>
      {movies.map((movie) => {
        const isFavorite = favorites.some((item) => item.id === movie.id);

        return (
          <article className="movie-card" key={movie.id}>
            <img src={poster(movie)} alt={movie.title} />
            <div className="movie-info">
              <h2>{movie.title}</h2>
              <p>
                Nota {Number(movie.vote_average || 0).toFixed(1)}
                {movie.release_date ? ` | ${movie.release_date.slice(0, 4)}` : ""}
              </p>
              <div className="actions">
                <Link to={`/movie/${movie.id}`}>Saiba mais</Link>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(movie)}
                  disabled={!currentUser}
                >
                  {isFavorite ? "Remover" : "Favoritar"}
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MovieDetails({
  currentUser,
  favorites,
  onToggleFavorite,
  onCreateUser,
  onLogin,
  onLogout,
  authError
}) {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [error, setError] = useState("");
  const [comments, setComments] = useState(() =>
    readStorage("movie_comments", {})
  );
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    localStorage.setItem("movie_comments", JSON.stringify(comments));
  }, [comments]);

  useEffect(() => {
    fetchTmdb(`/movie/${id}`)
      .then(setMovie)
      .catch((err) => setError(err.message));
  }, [id]);

  const movieComments = comments[id] || [];
  const isFavorite = movie && favorites.some((item) => item.id === movie.id);

  function addComment(event) {
    event.preventDefault();
    if (!currentUser || !commentText.trim()) return;

    const newComment = {
      user: currentUser,
      text: commentText.trim(),
      date: new Date().toLocaleString("pt-BR")
    };

    setComments((oldComments) => ({
      ...oldComments,
      [id]: [newComment, ...(oldComments[id] || [])]
    }));
    setCommentText("");
  }

  return (
    <main>
      <header className="topbar">
        <Link to="/" className="brand">
          API Filmes
        </Link>
        <AuthBar
          currentUser={currentUser}
          authError={authError}
          onCreateUser={onCreateUser}
          onLogin={onLogin}
          onLogout={onLogout}
        />
      </header>

      {error && <p className="message error">{error}</p>}
      {!movie && !error && <p className="message">Carregando filme...</p>}

      {movie && (
        <>
          <section className="details">
            <img src={poster(movie)} alt={movie.title} />
            <div>
              <Link to="/" className="back">
                Voltar
              </Link>
              <h1>{movie.title}</h1>
              <p className="meta">
                Nota {Number(movie.vote_average || 0).toFixed(1)} | Lancamento{" "}
                {movie.release_date || "sem data"}
              </p>
              <p>{movie.overview || "Sem descricao cadastrada."}</p>
              <button
                type="button"
                onClick={() => onToggleFavorite(movie)}
                disabled={!currentUser}
              >
                {isFavorite ? "Remover dos favoritos" : "Salvar favorito"}
              </button>
            </div>
          </section>

          <section className="comments">
            <h2>Comentarios</h2>
            <form onSubmit={addComment}>
              <textarea
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder={
                  currentUser
                    ? "Escreva seu comentario"
                    : "Entre para comentar"
                }
                disabled={!currentUser}
              />
              <button type="submit" disabled={!currentUser || !commentText.trim()}>
                Comentar
              </button>
            </form>
            {movieComments.map((comment, index) => (
              <article className="comment" key={`${comment.date}-${index}`}>
                <strong>{comment.user}</strong>
                <time>{comment.date}</time>
                <p>{comment.text}</p>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

export default App;
