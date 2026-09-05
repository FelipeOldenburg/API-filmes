import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Route, Routes, useLocation, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  Film,
  Grid3X3,
  Heart,
  Home as HomeIcon,
  Info,
  ListPlus,
  LogOut,
  Menu,
  Play,
  Search,
  Share2,
  Sparkles,
  Star,
  Trophy,
  User,
  X
} from "lucide-react";

const API = "https://api.themoviedb.org/3";
const KEY = import.meta.env.REACT_APP_KEY;
const POSTER_IMG = "https://image.tmdb.org/t/p/w500";
const BACKDROP_IMG = "https://image.tmdb.org/t/p/w1280";
const POSTER_FALLBACK = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750">
  <rect width="500" height="750" fill="#151b24"/>
  <rect x="48" y="72" width="404" height="606" rx="24" fill="#202938" stroke="#344154"/>
  <circle cx="250" cy="318" r="82" fill="#2b3545"/>
  <path d="M216 282v72l70-36-70-36z" fill="#f04f5f"/>
  <text x="250" y="478" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#d9e2ef">Sem poster</text>
</svg>`)}`;

const FALLBACK_GENRES = [
  { id: "28", label: "Acao", genre: 28 },
  { id: "12", label: "Aventura", genre: 12 },
  { id: "16", label: "Animacao", genre: 16 },
  { id: "35", label: "Comedia", genre: 35 },
  { id: "80", label: "Crime", genre: 80 },
  { id: "99", label: "Documentario", genre: 99 },
  { id: "18", label: "Drama", genre: 18 },
  { id: "14", label: "Fantasia", genre: 14 },
  { id: "27", label: "Terror", genre: 27 },
  { id: "10749", label: "Romance", genre: 10749 },
  { id: "878", label: "Ficcao cientifica", genre: 878 },
  { id: "53", label: "Thriller", genre: 53 }
];

const BASE_CATEGORIES = [
  { id: "popular", label: "Populares", path: "/movie/popular" },
  { id: "top", label: "Melhores avaliados", path: "/movie/top_rated" }
];

const NAV_ITEMS = [
  { label: "Inicio", href: "/", icon: HomeIcon },
  { label: "Filmes", href: "/#movies", icon: Film },
  { label: "Categorias", href: "/#categories", icon: Grid3X3 },
  { label: "Melhores avaliados", href: "/#top-rated", icon: Trophy },
  { label: "Minha lista", href: "/#my-list", icon: ListPlus }
];

const GRID_SKELETON_KEYS = [
  "grid-skeleton-1",
  "grid-skeleton-2",
  "grid-skeleton-3",
  "grid-skeleton-4",
  "grid-skeleton-5",
  "grid-skeleton-6",
  "grid-skeleton-7",
  "grid-skeleton-8",
  "grid-skeleton-9",
  "grid-skeleton-10"
];

const CAROUSEL_SKELETON_KEYS = [
  "carousel-skeleton-1",
  "carousel-skeleton-2",
  "carousel-skeleton-3",
  "carousel-skeleton-4",
  "carousel-skeleton-5",
  "carousel-skeleton-6",
  "carousel-skeleton-7"
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
    backdrop_path: movie.backdrop_path,
    vote_average: movie.vote_average,
    release_date: movie.release_date,
    overview: movie.overview
  };
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function fetchTmdb(path, options = {}) {
  if (!KEY) throw new Error("Chave da API nao encontrada no .env.");

  const url = new URL(`${API}${path}`);
  url.searchParams.set("api_key", KEY);
  url.searchParams.set("language", "pt-BR");
  url.searchParams.set("include_adult", "false");

  const response = await fetch(url, { signal: options.signal });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.status_message || "Erro ao carregar filmes.");
  }

  return data;
}

function posterUrl(movie) {
  return movie?.poster_path ? `${POSTER_IMG}${movie.poster_path}` : POSTER_FALLBACK;
}

function backdropUrl(movie) {
  if (movie?.backdrop_path) return `${BACKDROP_IMG}${movie.backdrop_path}`;
  if (movie?.poster_path) return `${POSTER_IMG}${movie.poster_path}`;
  return "";
}

function year(date) {
  return date ? date.slice(0, 4) : "Sem data";
}

function runtime(minutes) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${String(mins).padStart(2, "0")}min` : `${mins}min`;
}

function ratingLevel(value = 0) {
  if (value >= 8) return "excellent";
  if (value >= 6.5) return "good";
  return "average";
}

function useCategoryReveal() {
  const ref = useRef(null);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) {
      setIsRevealed(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsRevealed(entry.isIntersecting),
      { threshold: 0.18 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, isRevealed];
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
  const [toast, setToast] = useState("");
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    localStorage.setItem("movie_users", JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem("movie_current_user", JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem("movie_favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timeout);
  }, [toast]);

  const userFavorites = currentUser ? favorites[currentUser] || [] : [];

  async function createUser(username, password) {
    const name = username.trim();
    if (!name || !password) {
      setAuthError("Informe login e senha.");
      return;
    }
    if (users[name]) {
      setAuthError("Esse login ja existe.");
      return;
    }

    // ponytail: login local para a atividade; trocar por Auth/API em producao.
    const passwordHash = await hashPassword(password);
    setUsers((oldUsers) => ({ ...oldUsers, [name]: { passwordHash } }));
    setCurrentUser(name);
    setAuthError("");
    setToast("Conta criada.");
  }

  async function login(username, password) {
    const name = username.trim();
    const user = users[name];
    if (!user) {
      setAuthError("Login nao encontrado.");
      return;
    }
    if (user.passwordHash !== (await hashPassword(password))) {
      setAuthError("Senha incorreta.");
      return;
    }

    setCurrentUser(name);
    setAuthError("");
    setToast("Sessao iniciada.");
  }

  function logout() {
    setCurrentUser("");
    setToast("Sessao encerrada.");
  }

  function dismissIntro() {
    setShowIntro(false);
  }

  function toggleFavorite(movie) {
    if (!currentUser) {
      setAuthError("Entre para salvar favoritos.");
      setToast("Entre para salvar favoritos.");
      return;
    }

    const exists = userFavorites.some((item) => item.id === movie.id);

    setFavorites((oldFavorites) => {
      const list = oldFavorites[currentUser] || [];
      const nextList = exists
        ? list.filter((item) => item.id !== movie.id)
        : [compactMovie(movie), ...list];

      return { ...oldFavorites, [currentUser]: nextList };
    });
    setToast(exists ? "Removido dos favoritos." : "Adicionado aos favoritos.");
  }

  const sharedProps = {
    currentUser,
    favorites: userFavorites,
    authError,
    onCreateUser: createUser,
    onLogin: login,
    onLogout: logout,
    onToggleFavorite: toggleFavorite,
    onToast: setToast
  };

  return (
    <>
      {showIntro && <SiteIntro onComplete={dismissIntro} />}
      <div
        className="app-shell"
        aria-hidden={showIntro || undefined}
        inert={showIntro ? "" : undefined}
      >
        <Routes>
          <Route path="/" element={<Home {...sharedProps} />} />
          <Route path="/movie/:id" element={<MovieDetails {...sharedProps} />} />
          <Route path="*" element={<Home {...sharedProps} />} />
        </Routes>
        <Toast message={toast} />
      </div>
    </>
  );
}

function SiteIntro({ onComplete }) {
  return (
    <section
      className="site-intro"
      role="dialog"
      aria-label="Abertura do CineAtlas"
      aria-modal="true"
    >
      <video
        autoPlay
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        onEnded={onComplete}
        onError={onComplete}
      >
        <source src="/cineatlas-intro.mp4" type="video/mp4" />
      </video>
      <button className="button button-secondary" type="button" onClick={onComplete} autoFocus>
        Pular abertura
      </button>
    </section>
  );
}

function Header({
  currentUser,
  authError,
  onCreateUser,
  onLogin,
  onLogout,
  inDetails = false
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className={`site-header ${scrolled || inDetails ? "is-solid" : ""}`}>
      <div className="nav-shell">
        <Link to="/" className="brand" aria-label="Ir para o inicio">
          <Clapperboard size={28} aria-hidden="true" />
          <span>CineAtlas</span>
        </Link>

        <nav className="desktop-nav" aria-label="Navegacao principal">
          {NAV_ITEMS.slice(0, 4).map((item) => (
            <Link key={item.label} to={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="desktop-auth">
          <AuthPanel
            currentUser={currentUser}
            authError={authError}
            onCreateUser={onCreateUser}
            onLogin={onLogin}
            onLogout={onLogout}
          />
        </div>

        <button
          className="icon-button mobile-menu-button"
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="mobile-overlay" role="presentation" onClick={() => setOpen(false)}>
          <aside
            className="mobile-drawer"
            aria-label="Menu mobile"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-head">
              <span>Menu</span>
              <button
                className="icon-button"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <nav className="mobile-nav" aria-label="Navegacao mobile">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.label} to={item.href} onClick={() => setOpen(false)}>
                    <Icon size={18} aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <AuthPanel
              currentUser={currentUser}
              authError={authError}
              onCreateUser={onCreateUser}
              onLogin={onLogin}
              onLogout={onLogout}
            />
          </aside>
        </div>
      )}
    </header>
  );
}

function AuthPanel({
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
      <div className="auth-panel signed-in">
        <span className="user-chip">
          <User size={16} aria-hidden="true" />
          {currentUser}
        </span>
        <button className="button button-ghost button-icon-text" type="button" onClick={onLogout}>
          <LogOut size={16} aria-hidden="true" />
          Sair
        </button>
      </div>
    );
  }

  return (
    <form className="auth-panel" onSubmit={(event) => submit(event, onLogin)}>
      <label>
        <span className="sr-only">Login</span>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Login"
          autoComplete="username"
        />
      </label>
      <label>
        <span className="sr-only">Senha</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Senha"
          autoComplete="current-password"
        />
      </label>
      <button className="button button-primary" type="submit">
        Entrar
      </button>
      <button
        className="button button-secondary"
        type="button"
        onClick={(event) => submit(event, onCreateUser)}
      >
        Criar
      </button>
      {authError && <small role="alert">{authError}</small>}
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
    onToggleFavorite,
    onToast
  } = props;

  const [genres, setGenres] = useState(FALLBACK_GENRES);
  const [selectedCategory, setSelectedCategory] = useState(BASE_CATEGORIES[0].id);
  const [search, setSearch] = useState("");
  const [movies, setMovies] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topLoading, setTopLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const location = useLocation();
  const [categoryRef, isCategoryRevealed] = useCategoryReveal();

  const categories = useMemo(() => [...BASE_CATEGORIES, ...genres], [genres]);
  const category = useMemo(
    () => categories.find((item) => item.id === selectedCategory) || categories[0],
    [categories, selectedCategory]
  );
  const heroMovie = topRated[0] || movies[0];

  useEffect(() => {
    document.title = "CineAtlas | Filmes";
  }, []);

  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    if (!target) return;
    const timeout = window.setTimeout(() => target.scrollIntoView({ block: "start" }), 0);
    return () => window.clearTimeout(timeout);
  }, [location.hash]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTmdb("/genre/movie/list", { signal: controller.signal })
      .then((data) => {
        const apiGenres = (data.genres || []).map((genre) => ({
          id: String(genre.id),
          label: genre.name,
          genre: genre.id
        }));
        if (apiGenres.length) setGenres(apiGenres);
      })
      .catch((err) => {
        if (err.name !== "AbortError") onToast("Categorias padrao carregadas.");
      });

    return () => controller.abort();
  }, [onToast]);

  useEffect(() => {
    const controller = new AbortController();
    setTopLoading(true);

    fetchTmdb("/movie/top_rated", { signal: controller.signal })
      .then((data) => setTopRated((data.results || []).slice(0, 14)))
      .catch((err) => {
        if (err.name !== "AbortError") onToast(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTopLoading(false);
      });

    return () => controller.abort();
  }, [onToast, retry]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      const query = search.trim();
      const path = query
        ? `/search/movie?query=${encodeURIComponent(query)}`
        : category.genre
          ? `/discover/movie?with_genres=${category.genre}&sort_by=popularity.desc`
          : category.path;

      setLoading(true);
      setError("");

      fetchTmdb(path, { signal: controller.signal })
        .then((data) => setMovies(data.results || []))
        .catch((err) => {
          if (err.name !== "AbortError") setError(err.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, search.trim() ? 320 : 0);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [category, search, retry]);

  async function shareFavorites() {
    if (!currentUser) {
      onToast("Entre para compartilhar sua lista.");
      return;
    }
    if (!favorites.length) {
      onToast("Sua lista ainda esta vazia.");
      return;
    }

    const text = favorites
      .map((movie) => `${movie.title} - ${window.location.origin}/movie/${movie.id}`)
      .join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ title: "Minha lista de filmes", text });
        onToast("Lista compartilhada.");
        return;
      }

      await navigator.clipboard.writeText(text);
      onToast("Lista copiada.");
    } catch {
      onToast("Nao foi possivel compartilhar.");
    }
  }

  return (
    <>
      <Header
        currentUser={currentUser}
        authError={authError}
        onCreateUser={onCreateUser}
        onLogin={onLogin}
        onLogout={onLogout}
      />
      <MovieCursorTrail movies={topRated.concat(movies)}>
        <main id="top" className="page">
          <MovieHero
            movie={heroMovie}
            loading={topLoading && loading}
            favorites={favorites}
            currentUser={currentUser}
            onToggleFavorite={onToggleFavorite}
          />

        <section
          id="categories"
          ref={categoryRef}
          className={`category-stage ${isCategoryRevealed ? "is-revealed" : ""}`}
          aria-labelledby="discover-title"
        >
          <CategoryAtmosphere key={`${selectedCategory}-${movies[0]?.id ?? "empty"}`} movies={movies} />
          <div className="content-shell category-stage-content">
            <div className="discovery-panel">
            <div className="panel-copy">
              <p className="category-current">
                <Sparkles size={16} aria-hidden="true" />
                Explorando <strong>{category.label}</strong>
              </p>
              <h1 id="discover-title">Escolha um universo. Deixe o filme encontrar voce.</h1>
              <p>
                As cenas entram em cartaz enquanto voce percorre as categorias.
                Escolha o clima, pesquise um titulo ou salve o que merece replay.
              </p>
            </div>

            <SearchBar value={search} onChange={setSearch} loading={loading} />

            <CategoryMenu
              categories={categories}
              selected={selectedCategory}
              onSelect={(item) => {
                setSelectedCategory(item.id);
                setSearch("");
              }}
            />
            </div>
          </div>
        </section>

        <div className="content-shell">
          <section id="movies" className="section-block" aria-labelledby="movies-title">
            <SectionHeader
              title={search.trim() ? "Resultado da pesquisa" : category.label}
              subtitle={
                loading
                  ? "Buscando filmes..."
                  : `${movies.length} ${movies.length === 1 ? "filme" : "filmes"}`
              }
            />

            {error ? (
              <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />
            ) : (
              <MovieGrid
                movies={movies}
                loading={loading}
                favorites={favorites}
                currentUser={currentUser}
                onToggleFavorite={onToggleFavorite}
                emptyText={
                  search.trim()
                    ? `Nenhum filme encontrado para "${search.trim()}".`
                    : "Nenhum filme para mostrar nesta categoria."
                }
              />
            )}
          </section>

          <section id="top-rated" className="section-block" aria-labelledby="top-title">
            <SectionHeader
              title="Melhores avaliados"
              subtitle="Top da TMDB em um carrossel rapido"
            />
            <MovieCarousel
              movies={topRated}
              loading={topLoading}
              favorites={favorites}
              currentUser={currentUser}
              onToggleFavorite={onToggleFavorite}
            />
          </section>

          <section id="my-list" className="section-block" aria-labelledby="list-title">
            <div className="list-panel">
              <div>
                <span className="eyebrow">
                  <Heart size={16} aria-hidden="true" />
                  Minha lista
                </span>
                <h2 id="list-title">Favoritos salvos</h2>
                <p>
                  {currentUser
                    ? `${favorites.length} ${favorites.length === 1 ? "filme salvo" : "filmes salvos"}`
                    : "Entre para salvar seus favoritos."}
                </p>
              </div>
              <button
                className="button button-outline button-icon-text"
                type="button"
                onClick={shareFavorites}
              >
                <Share2 size={17} aria-hidden="true" />
                Compartilhar
              </button>
            </div>

            {currentUser && (
              <MovieGrid
                movies={favorites}
                favorites={favorites}
                currentUser={currentUser}
                onToggleFavorite={onToggleFavorite}
                compact
                emptyText="Sua lista ainda esta vazia. Explore alguns filmes e adicione favoritos."
              />
            )}
          </section>
        </div>
        </main>
      </MovieCursorTrail>
      <Footer />
    </>
  );
}

function MovieCursorTrail({ movies, children }) {
  const [trail, setTrail] = useState([]);
  const lastTrailRef = useRef({ x: 0, y: 0, time: 0 });
  const trailIndexRef = useRef(0);
  const trailIdRef = useRef(0);
  const trailTimersRef = useRef(new Set());
  const availableMovies = movies.filter((movie) => movie?.poster_path);

  useEffect(
    () => () => {
      trailTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    },
    []
  );

  function handlePointerMove(event) {
    const target = event.target;

    if (
      event.pointerType !== "mouse" ||
      !(target instanceof Element) ||
      target.closest("a, button, input, select, textarea, [role='button']")
    ) {
      return;
    }

    const x = event.clientX;
    const y = event.clientY;
    const now = performance.now();
    const lastTrail = lastTrailRef.current;

    if (now - lastTrail.time < 56 || Math.hypot(x - lastTrail.x, y - lastTrail.y) < 28) {
      return;
    }

    if (!availableMovies.length) return;

    const selectedMovie = availableMovies[trailIndexRef.current % availableMovies.length];
    const id = trailIdRef.current;
    trailIndexRef.current += 1;
    trailIdRef.current += 1;
    lastTrailRef.current = { x, y, time: now };

    setTrail((items) => [
      ...items.slice(-7),
      {
        id,
        src: posterUrl(selectedMovie),
        x,
        y,
        rotation: `${((id % 5) - 2) * 4}deg`
      }
    ]);

    const timer = window.setTimeout(() => {
      setTrail((items) => items.filter((item) => item.id !== id));
      trailTimersRef.current.delete(timer);
    }, 1000);
    trailTimersRef.current.add(timer);
  }

  return (
    <div
      className="movie-cursor-zone"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setTrail([])}
    >
      <div className="cursor-poster-trail" aria-hidden="true">
        {trail.map((poster) => (
          <img
            key={poster.id}
            className="cursor-trail-poster"
            src={poster.src}
            alt=""
            decoding="async"
            onError={setFallback}
            style={{
              "--trail-x": `${poster.x}px`,
              "--trail-y": `${poster.y}px`,
              "--trail-rotate": poster.rotation
            }}
          />
        ))}
      </div>
      {children}
    </div>
  );
}

function MovieHero({ movie, loading, favorites, currentUser, onToggleFavorite }) {
  const isFavorite = movie && favorites.some((item) => item.id === movie.id);
  const meta = movie
    ? [year(movie.release_date), movie.vote_count ? `${movie.vote_count} votos` : null]
        .filter(Boolean)
        .join(" / ")
    : "";

  if (loading && !movie) {
    return (
      <section className="hero hero-loading" aria-label="Filme em destaque carregando">
        <div className="hero-content">
          <Skeleton className="hero-kicker" />
          <Skeleton className="hero-title-skeleton" />
          <Skeleton className="hero-line" />
          <Skeleton className="hero-line short" />
        </div>
      </section>
    );
  }

  if (!movie) return null;

  return (
    <section
      className="hero"
      aria-label={`Filme em destaque: ${movie.title}`}
      style={{ "--hero-image": `url("${backdropUrl(movie)}")` }}
    >
      <div className="hero-content">
        <span className="eyebrow hero-kicker">
          <Clapperboard size={16} aria-hidden="true" />
          Filme em destaque
        </span>
        <h1>{movie.title}</h1>
        <div className="hero-meta">
          <RatingBadge value={movie.vote_average} />
          <span>{meta}</span>
        </div>
        <p>{movie.overview || "Sem sinopse cadastrada para este titulo."}</p>
        <div className="hero-actions">
          <TrailerButton movie={movie} />
          <Link className="button button-secondary button-icon-text" to={`/movie/${movie.id}`}>
            <Info size={18} aria-hidden="true" />
            Saiba mais
          </Link>
          <button
            className="button button-secondary button-icon-text"
            type="button"
            onClick={() => onToggleFavorite(movie)}
            aria-pressed={Boolean(isFavorite)}
          >
            <Heart size={18} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
            {isFavorite ? "Na lista" : "Minha lista"}
          </button>
        </div>
      </div>
      <div className="hero-poster" aria-hidden="true">
        <img src={posterUrl(movie)} alt="" onError={(event) => setFallback(event)} />
      </div>
    </section>
  );
}

function TrailerButton({ movie, className = "button button-primary button-icon-text" }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button className={className} type="button" onClick={() => setIsOpen(true)}>
        <Play size={18} fill="currentColor" aria-hidden="true" />
        Assistir trailer
      </button>
      <TrailerDialog movie={movie} isOpen={isOpen} setIsOpen={setIsOpen} />
    </>
  );
}

function TrailerDialog({ movie, isOpen, setIsOpen }) {
  const dialogRef = useRef(null);
  const [trailer, setTrailer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const onClose = () => setIsOpen(false);
    const onCancel = (event) => {
      event.preventDefault();
      dialog.close();
    };

    dialog.addEventListener("close", onClose);
    dialog.addEventListener("cancel", onCancel);

    return () => {
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("cancel", onCancel);
    };
  }, [setIsOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(
    () => () => {
      if (dialogRef.current?.open) dialogRef.current.close();
    },
    []
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setTrailer(null);

    fetchTmdb(`/movie/${movie.id}/videos`, { signal: controller.signal })
      .then((data) => {
        const videos = data.results || [];
        const selectedTrailer =
          videos.find(
            (video) => video.site === "YouTube" && video.type === "Trailer" && video.official
          ) ||
          videos.find((video) => video.site === "YouTube" && video.type === "Trailer") ||
          videos.find((video) => video.site === "YouTube" && video.type === "Teaser");

        if (!selectedTrailer?.key) {
          throw new Error("Trailer indisponivel para este titulo.");
        }

        setTrailer(selectedTrailer);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setError(requestError.message || "Nao foi possivel carregar o trailer.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, movie.id]);

  return (
    <dialog className="trailer-dialog" ref={dialogRef} aria-labelledby="trailer-title">
      <div className="trailer-dialog-header">
        <div>
          <p>Em exibicao</p>
          <h2 id="trailer-title">{movie.title}</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Fechar trailer"
          autoFocus
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="trailer-frame">
        {loading && <span className="trailer-state">Carregando trailer...</span>}
        {error && !loading && <span className="trailer-state">{error}</span>}
        {trailer && !loading && (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?autoplay=1&rel=0&modestbranding=1`}
            title={`Trailer de ${movie.title}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
    </dialog>
  );
}

function SearchBar({ value, onChange, loading }) {
  return (
    <label className="search-bar" id="search">
      <Search size={20} aria-hidden="true" />
      <span className="sr-only">Pesquisar filmes</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onChange("");
        }}
        placeholder="Pesquisar filmes..."
        autoComplete="off"
      />
      {loading && value.trim() && <span className="search-status">Buscando</span>}
      {value && (
        <button
          className="icon-button"
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar pesquisa"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </label>
  );
}

function CategoryMenu({ categories, selected, onSelect }) {
  return (
    <nav className="category-menu" aria-label="Categorias de filmes">
      {categories.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.id === selected ? "is-active" : ""}
          onClick={() => onSelect(item)}
          aria-pressed={item.id === selected}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function CategoryAtmosphere({ movies }) {
  const cast = movies
    .filter((movie) => movie.backdrop_path || movie.poster_path)
    .slice(0, 4);

  return (
    <div className="category-atmosphere" aria-hidden="true">
      {cast.map((movie, index) => (
        <div className={`category-cast cast-${index}`} key={movie.id}>
          <img src={movie.backdrop_path ? backdropUrl(movie) : posterUrl(movie)} alt="" decoding="async" />
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ id, title, subtitle }) {
  return (
    <div className="section-header">
      <div>
        <h2 id={id}>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function MovieGrid({
  movies,
  favorites,
  currentUser,
  onToggleFavorite,
  loading = false,
  compact = false,
  emptyText
}) {
  if (loading) {
    const skeletonKeys = compact ? GRID_SKELETON_KEYS.slice(0, 4) : GRID_SKELETON_KEYS;
    return (
      <div className={compact ? "movie-grid compact" : "movie-grid"} aria-hidden="true">
        {skeletonKeys.map((key) => (
          <MovieCardSkeleton key={key} />
        ))}
      </div>
    );
  }

  if (!movies.length) {
    return <EmptyState message={emptyText || "Nenhum filme para mostrar."} />;
  }

  return (
    <div className={compact ? "movie-grid compact" : "movie-grid"}>
      {movies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          isFavorite={favorites.some((item) => item.id === movie.id)}
          currentUser={currentUser}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}

function MovieCarousel({
  movies,
  favorites,
  currentUser,
  onToggleFavorite,
  loading = false
}) {
  const trackRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });

  function scrollByCard(direction) {
    trackRef.current?.scrollBy({
      left: direction * 360,
      behavior: "smooth"
    });
  }

  function onPointerDown(event) {
    const track = trackRef.current;
    if (!track) return;
    dragRef.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: track.scrollLeft,
      moved: false
    };
    track.setPointerCapture(event.pointerId);
    track.classList.add("is-dragging");
  }

  function onPointerMove(event) {
    const track = trackRef.current;
    if (!track || !dragRef.current.active) return;
    const distance = event.clientX - dragRef.current.startX;
    if (Math.abs(distance) > 6) dragRef.current.moved = true;
    track.scrollLeft = dragRef.current.scrollLeft - distance;
  }

  function stopDrag(event) {
    const track = trackRef.current;
    if (!track) return;
    dragRef.current.active = false;
    track.classList.remove("is-dragging");
    if (event.pointerId) track.releasePointerCapture?.(event.pointerId);
  }

  if (loading) {
    return (
      <div className="carousel-shell" aria-hidden="true">
        <div className="carousel-track">
          {CAROUSEL_SKELETON_KEYS.map((key) => (
            <MovieCardSkeleton key={key} />
          ))}
        </div>
      </div>
    );
  }

  if (!movies.length) return <EmptyState message="Nao foi possivel carregar o carrossel." />;

  return (
    <div className="carousel-shell">
      <div className="carousel-controls" aria-label="Controles do carrossel">
        <button
          className="icon-button"
          type="button"
          onClick={() => scrollByCard(-1)}
          aria-label="Filmes anteriores"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={() => scrollByCard(1)}
          aria-label="Proximos filmes"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
      <div
        className="carousel-track"
        ref={trackRef}
        role="region"
        aria-roledescription="carrossel"
        tabIndex={0}
        aria-label="Melhores avaliados"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            scrollByCard(-1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            scrollByCard(1);
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onPointerLeave={stopDrag}
      >
        {movies.map((movie) => (
          <MovieCard
            key={movie.id}
            movie={movie}
            isFavorite={favorites.some((item) => item.id === movie.id)}
            currentUser={currentUser}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}

function MovieCard({ movie, isFavorite, onToggleFavorite }) {
  return (
    <article className="movie-card">
      <Link className="poster-link" to={`/movie/${movie.id}`} aria-label={`Ver detalhes de ${movie.title}`}>
        <img
          src={posterUrl(movie)}
          alt={`Poster de ${movie.title}`}
          loading="lazy"
          decoding="async"
          onError={(event) => setFallback(event)}
        />
        <span className="quick-view">
          <Info size={16} aria-hidden="true" />
          Detalhes
        </span>
      </Link>
      <div className="movie-info">
        <div>
          <h3>{movie.title}</h3>
          <p>{year(movie.release_date)}</p>
        </div>
        <div className="movie-actions">
          <RatingBadge value={movie.vote_average} />
          <button
            className="icon-button favorite-button"
            type="button"
            onClick={() => onToggleFavorite(movie)}
            aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            aria-pressed={Boolean(isFavorite)}
            title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Heart size={18} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

function RatingBadge({ value = 0 }) {
  const rating = Number(value || 0).toFixed(1);
  return (
    <span className={`rating-badge ${ratingLevel(Number(value || 0))}`}>
      <Star size={15} fill="currentColor" aria-hidden="true" />
      <span>{rating}</span>
    </span>
  );
}

function MovieCardSkeleton() {
  return (
    <article className="movie-card skeleton-card">
      <Skeleton className="poster-skeleton" />
      <div className="movie-info">
        <Skeleton className="text-skeleton wide" />
        <Skeleton className="text-skeleton" />
      </div>
    </article>
  );
}

function Skeleton({ className = "" }) {
  return <span className={`skeleton ${className}`} />;
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="state-box error-state" role="alert">
      <AlertTriangle size={24} aria-hidden="true" />
      <div>
        <h3>Nao foi possivel carregar os filmes.</h3>
        <p>{message}</p>
      </div>
      <button className="button button-outline" type="button" onClick={onRetry}>
        Tentar novamente
      </button>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="state-box empty-state">
      <Film size={24} aria-hidden="true" />
      <p>{message}</p>
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
  authError,
  onToast
}) {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comments, setComments] = useState(() =>
    readStorage("movie_comments", {})
  );
  const [commentText, setCommentText] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    localStorage.setItem("movie_comments", JSON.stringify(comments));
  }, [comments]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    fetchTmdb(`/movie/${id}`, { signal: controller.signal })
      .then((data) => {
        setMovie(data);
        document.title = `${data.title} | CineAtlas`;
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, retry]);

  const movieComments = comments[id] || [];
  const isFavorite = movie && favorites.some((item) => item.id === movie.id);

  function addComment(event) {
    event.preventDefault();
    if (!currentUser || !commentText.trim()) return;

    const newComment = {
      id: crypto.randomUUID(),
      user: currentUser,
      text: commentText.trim(),
      date: new Date().toLocaleString("pt-BR")
    };

    setComments((oldComments) => ({
      ...oldComments,
      [id]: [newComment, ...(oldComments[id] || [])]
    }));
    setCommentText("");
    onToast("Comentario publicado.");
  }

  async function shareMovie() {
    if (!movie) return;
    const url = `${window.location.origin}/movie/${movie.id}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: movie.title, text: movie.overview, url });
        onToast("Filme compartilhado.");
        return;
      }

      await navigator.clipboard.writeText(url);
      onToast("Link copiado.");
    } catch {
      onToast("Nao foi possivel compartilhar.");
    }
  }

  return (
    <>
      <Header
        currentUser={currentUser}
        authError={authError}
        onCreateUser={onCreateUser}
        onLogin={onLogin}
        onLogout={onLogout}
        inDetails
      />
      <main className="page details-page">
        {loading && <DetailsSkeleton />}

        {error && !loading && (
          <div className="content-shell">
            <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />
          </div>
        )}

        {movie && !loading && (
          <>
            <section
              className="details-hero"
              style={{ "--details-image": `url("${backdropUrl(movie)}")` }}
              aria-label={`Detalhes de ${movie.title}`}
            >
              <div className="details-shell">
                <Link className="back-link" to="/">
                  <ArrowLeft size={18} aria-hidden="true" />
                  Voltar
                </Link>
                <div className="details-layout">
                  <img
                    className="details-poster"
                    src={posterUrl(movie)}
                    alt={`Poster de ${movie.title}`}
                    onError={(event) => setFallback(event)}
                  />
                  <div className="details-copy">
                    <span className="eyebrow">
                      <Clapperboard size={16} aria-hidden="true" />
                      Filme
                    </span>
                    <h1>{movie.title}</h1>
                    {movie.original_title && movie.original_title !== movie.title && (
                      <p className="original-title">{movie.original_title}</p>
                    )}
                    <div className="details-meta">
                      <RatingBadge value={movie.vote_average} />
                      <span>{year(movie.release_date)}</span>
                      {runtime(movie.runtime) && <span>{runtime(movie.runtime)}</span>}
                      {movie.genres?.length > 0 && (
                        <span>{movie.genres.map((genre) => genre.name).join(" / ")}</span>
                      )}
                    </div>
                    <p className="overview">
                      {movie.overview || "Sem descricao cadastrada para este titulo."}
                    </p>
                    <div className="details-actions">
                      <TrailerButton
                        movie={movie}
                        className="button button-outline button-icon-text"
                      />
                      <button
                        className="button button-primary button-icon-text"
                        type="button"
                        onClick={() => onToggleFavorite(movie)}
                        aria-pressed={Boolean(isFavorite)}
                      >
                        <Heart
                          size={18}
                          fill={isFavorite ? "currentColor" : "none"}
                          aria-hidden="true"
                        />
                        {isFavorite ? "Favorito salvo" : "Favoritar"}
                      </button>
                      <button
                        className="button button-outline button-icon-text"
                        type="button"
                        onClick={shareMovie}
                      >
                        <Share2 size={18} aria-hidden="true" />
                        Compartilhar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="content-shell details-content">
              <section className="section-block" aria-labelledby="comments-title">
                <SectionHeader
                  id="comments-title"
                  title="Comentarios"
                  subtitle={
                    currentUser
                      ? "Compartilhe sua leitura do filme"
                      : "Entre para participar da conversa"
                  }
                />
                <form className="comment-form" onSubmit={addComment}>
                  <label>
                    <span className="sr-only">Escreva seu comentario</span>
                    <textarea
                      value={commentText}
                      onChange={(event) => setCommentText(event.target.value)}
                      placeholder={
                        currentUser
                          ? "Escreva seu comentario..."
                          : "Entre para comentar"
                      }
                      disabled={!currentUser}
                    />
                  </label>
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={!currentUser || !commentText.trim()}
                  >
                    Comentar
                  </button>
                </form>

                <div className="comment-list">
                  {movieComments.length ? (
                    movieComments.map((comment) => (
                      <article
                        className="comment"
                        key={comment.id || `${comment.date}-${comment.user}-${comment.text}`}
                      >
                        <div className="avatar" aria-hidden="true">
                          {comment.user.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="comment-head">
                            <strong>{comment.user}</strong>
                            <time>{comment.date}</time>
                          </div>
                          <p>{comment.text}</p>
                        </div>
                      </article>
                    ))
                  ) : (
                    <EmptyState message="Ainda nao ha comentarios para este filme." />
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}

function DetailsSkeleton() {
  return (
    <section className="details-hero details-loading" aria-label="Carregando detalhes">
      <div className="details-shell">
        <Skeleton className="back-skeleton" />
        <div className="details-layout">
          <Skeleton className="details-poster poster-skeleton" />
          <div className="details-copy">
            <Skeleton className="hero-kicker" />
            <Skeleton className="details-title-skeleton" />
            <Skeleton className="hero-line" />
            <Skeleton className="hero-line" />
            <Skeleton className="hero-line short" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <Copy size={17} aria-hidden="true" />
      {message}
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="content-shell">
        <span>CineAtlas</span>
        <p>Catalogo cinematografico com dados da TMDB.</p>
      </div>
    </footer>
  );
}

function setFallback(event) {
  event.currentTarget.src = POSTER_FALLBACK;
}

export default App;
