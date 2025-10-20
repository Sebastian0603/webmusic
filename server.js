const axios = require('axios');
require('dotenv').config();

const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

let accessToken = '';
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (accessToken && tokenExpiresAt && now < tokenExpiresAt - 5000) return accessToken;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) throw new Error('SPOTIFY_CLIENT_ID/SECRET no configurados');
  const resp = await axios.post('https://accounts.spotify.com/api/token', null, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
    },
    params: { grant_type: 'client_credentials' }
  });
  accessToken = resp.data.access_token;
  tokenExpiresAt = now + (resp.data.expires_in || 3600) * 1000;
  return accessToken;
}

// ...existing code...
const generosValidos = {
  metal: [
    "metal alternativo","metal","heavy metal","black metal","death metal","deathcore","doom metal","drone metal",
    "folk metal","freak metal","funk metal","glam metal","goregrind","gothic metal","metal gótico",
    "grindcore","groove metal","industrial metal","metal industrial","kawaii metal","downer metal",
    "brutal metal","metal brutal","extreme metal","metal extremo","melodic metal","melodic death metal",
    "satanic metal","teutonic metal","traditional metal","metalcore","noisegrind","nu metal","post-metal",
    "power metal","progressive metal","metal progresivo","proto-metal","rap metal","rap-metal",
    "symphonic metal","metal sinfónico","sludge metal","southern metal","speed metal","thrash metal","trash metal",
    "trap metal","unblack metal"
  ],
  rock: ["rock","hard rock","punk rock","alternative rock","garage rock","indie rock","progressive rock","post-rock","grunge"],
  pop: ["pop","synthpop","dance pop","electropop","teen pop"],
  jazz: ["jazz","smooth jazz","bebop","swing","fusion","acid jazz"],
  electronic: ["electronic","techno","house","ambient","drum and bass","drum & bass","synthwave","phonk","idm"],
  hiphop: ["hip hop","hip-hop","rap","trap","drill","boom bap","phonk"],
  rap: ["rap","gangsta rap","cloud rap","boom bap","trap rap","phonk"],
  reggae: ["reggae","roots reggae","dub","ska","dancehall"],
  punk: ["punk","hardcore punk","pop punk","post-punk"],
  folk: ["folk","neo folk","americana","british folk"],
  rnb: ["r&b","neo soul","contemporary r&b"],
  soul: ["soul","motown","deep soul","neo soul"],
  disco: ["disco","nu-disco"],
  dance: ["dance","edm","progressive house"],
  country: ["country","alt-country","bluegrass"],
  grunge: ["grunge","post-grunge"],
  blues: ["blues","delta blues","electric blues"],
  salsa: ["salsa","salsa dura","salsa romántica"],
  cumbia: ["cumbia","cumbia villera","cumbia pop"]
};
module.exports = { fetchArtists };

function normalizeKey(s=''){ return (s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }

function coincideGenero(artista, categoriaKey) {
  if (!artista || !artista.genres || artista.genres.length === 0) return false;
  const lista = generosValidos[categoriaKey] || [];
  return artista.genres.some(g => {
    const low = g.toLowerCase();
    return lista.some(valid => low.includes(valid));
  });
}

async function fetchArtists(params = {}) {
  const q = (params.q || params.name || params.genre || 'a').trim(); // 'a' fallback para resultados
  const limit = Math.min(50, parseInt(params.limit || '50', 10) || 50);

  const token = await getAccessToken();
  const url = `${SPOTIFY_API_URL}/search?q=${encodeURIComponent(q)}&type=artist&limit=${limit}`;

  const resp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
  const artistas = (resp.data && resp.data.artists && resp.data.artists.items) ? resp.data.artists.items : [];

  const genreRaw = (params.genre || '').toLowerCase().trim();
  const genreKey = normalizeKey(genreRaw);

  let filtrados = artistas;
  if (genreKey) {
    filtrados = artistas.filter(a => coincideGenero(a, genreKey));
    if (filtrados.length === 0) {
      filtrados = artistas.filter(a => (a.genres||[]).some(g => g.toLowerCase().includes(genreRaw)));
    }
    if (filtrados.length === 0) {
      const token = genreRaw.split(/\s+/)[0];
      filtrados = artistas.filter(a => a.name && a.name.toLowerCase().includes(token));
    }
  }

  const resultado = (filtrados.length ? filtrados : artistas).slice(0, 20).map(a => ({
    id: a.id,
    name: a.name,
    genres: a.genres,
    popularity: a.popularity,
    images: a.images,
    external_urls: a.external_urls
  }));

  return resultado;
}

module.exports = { fetchArtists };
const express = require('express');
const cors = require('cors');
const spotifyProxy = require('./spotify-proxy');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/spotify/artists', async (req, res) => {
  try {
    const result = await spotifyProxy.fetchArtists({
      q: req.query.q || req.query.name,
      genre: req.query.genre,
      limit: req.query.limit
    });
    res.json({ artists: result });
  } catch (error) {
    console.error('Error fetching artists from Spotify:', error.message || error);
    res.status(502).json({ error: 'Failed to fetch artists from Spotify' });
  }
});

app.listen(PORT, () => console.log(`Server running http://localhost:${PORT}`));
const nombreLimpio = artista.name.trim();
const imagen = data.image || `img/generos/${generoElegido}.jpg`;
const CACHE_NAME = "webmusic-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/styles.css",
  "/script.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js")
    .then(() => console.log("Service Worker registrado"))
    .catch(error => console.error("Error al registrar SW:", error));
}
