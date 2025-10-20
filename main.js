// main.js
const API_KEY_LASTFM = "92c19e9a34d731629e8f792a656e4a06";
const API_KEY_SPOTIFY = "YOUR_SPOTIFY_API_KEY"; // Replace with your actual Spotify API key

const regiones = {
  latin: ["Argentina", "México", "Chile", "Colombia", "España", "Perú"],
  english: ["Estados Unidos", "Reino Unido", "Australia", "Canadá"],
  french: ["Francia", "Bélgica"],
  german: ["Alemania", "Austria"],
  japanese: ["Japón"],
  korean: ["Corea del Sur"],
  indian: ["India"]
};

let offsetActual = 0;         
const LIMIT_FETCH = 20;      
const MAX_RENDER = 5;        
const mostradosSet = new Set(); 

function sanitizeId(name){
  return (name || '').replace(/\s+/g,'-').replace(/[^a-z0-9\-]/gi,'').toLowerCase();
}

function shuffleArray(arr){
  for(let i = arr.length -1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalize(s){
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/gi,'').trim();
}

function artistMatchesGenre(artist, genreTokenList){
  if (!genreTokenList || genreTokenList.length === 0) return true;

  const tokens = genreTokenList.map(t => t.toLowerCase().replace(/[^a-z0-9]/g,'').trim()).filter(Boolean);
  if (tokens.length === 0) return true;

  const tags = (artist.tags || []).map(t => normalize(t.name));
  for (const tk of tokens) {
    if (tags.some(t => t.includes(tk))) return true;
  }

  const aliases = (artist.aliases || []).map(a => normalize(a.name));
  if (aliases.some(a => tokens.some(tk => a.includes(tk)))) return true;

  const name = normalize(artist.name || '');
  if (tokens.some(tk => name.includes(tk))) return true;
  const dis = normalize(artist.disambiguation || '');
  if (tokens.some(tk => dis.includes(tk))) return true;

  return false;
}

async function buscarVariedadGlobal(maxResults = MAX_RENDER) {
  const generosPool = ["rock","pop","metal","jazz","electronic","hip hop","reggae","punk","trap","r&b","folk","ambient","flamenco","tango","cumbia","soul","indie","latin","disco","funk"];
  shuffleArray(generosPool);
  const attempts = Math.min(10, generosPool.length);
  const fetches = [];
  for (let i=0;i<attempts;i++){
    const g = generosPool[i];
    const off = Math.floor(Math.random()*200);
    const query = `tag:"${g}"`;
    const url = 'https://musicbrainz.org/ws/2/artist?query=' + encodeURIComponent(query) + `&fmt=json&limit=1&offset=${off}`;
    fetches.push(fetch(url).then(r=> r.ok ? r.json().catch(()=>null) : null).catch(()=>null));
  }

  const responses = await Promise.all(fetches);
  const seen = new Set();
  const resultados = [];
  for (const resp of responses) {
    if (!resp || !resp.artists) continue;
    const a = resp.artists[0];
    if (!a || !a.id) continue;
    if (mostradosSet.has(a.id)) continue;
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    resultados.push(a);
    if (resultados.length >= maxResults) break;
  }
  return resultados;
}

const btnSearch = document.getElementById('btn-search');
const btnMore = document.getElementById('btn-more');
const selectGenre = document.getElementById('genre');
const selectRegion = document.getElementById('region');
const selectDecade = document.getElementById('decade');
const selectSubgenre = document.getElementById('subgenre');
const contenedor = document.getElementById('results');

btnMore.disabled = true;

function onFilterChange() {
  offsetActual = 0;
  btnSearch.disabled = false;
  btnMore.disabled = true;
}
selectGenre.addEventListener('change', onFilterChange);
selectRegion.addEventListener('change', onFilterChange);
selectDecade.addEventListener('change', onFilterChange);
selectSubgenre && selectSubgenre.addEventListener('change', onFilterChange);

btnSearch.addEventListener('click', ()=> buscarMusica(false));
btnMore.addEventListener('click', ()=> buscarMusica(true));

async function buscarMusica(refresh = false) {
  const genreSel = selectGenre.value;
  const regionSel = selectRegion.value;
  const decadeSel = selectDecade.value;
  const subSel = (selectSubgenre && selectSubgenre.value) ? selectSubgenre.value : 'any';

  if (refresh) offsetActual += LIMIT_FETCH;
  else {
    offsetActual = 0;
    mostradosSet.clear();
  }

  contenedor.innerHTML = "<p>Buscando artistas...</p>";

  const esTodoCualquiera = genreSel === "any" && regionSel === "any" && decadeSel === "any" && (subSel === 'any');

  try {
    let artistas = [];

    if (esTodoCualquiera) {
      artistas = await buscarVariedadGlobal(MAX_RENDER);
      if (!artistas.length) {
        contenedor.innerHTML = "<p>No se encontraron artistas (variedad global).</p>";
        return;
      }
    } else {
      let generoElegido;
      if (subSel && subSel !== "any") generoElegido = subSel;
      else if (genreSel !== "any") generoElegido = genreSel;
      else generoElegido = elegirGeneroAleatorio();

      const regionKey = regionSel === "any" ? null : regionSel;
      const paises = regionKey ? (regiones[regionKey] || []) : Object.values(regiones).flat();
      if (!paises || paises.length === 0) {
        contenedor.innerHTML = "<p>Región no soportada.</p>";
        return;
      }

      const paisesQuery = paises.map(p => `area:"${p}"`).join(" OR ");
      const queryTag = `tag:"${generoElegido}"`;
      let query = queryTag;
      if (paisesQuery) query += ` AND (${paisesQuery})`;
      const url = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(query)}&fmt=json&limit=${LIMIT_FETCH}&offset=${offsetActual}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error en MusicBrainz: ' + res.status);
      const data = await res.json();
      if (!data.artists || data.artists.length === 0) {
        contenedor.innerHTML = "<p>No se encontraron artistas.</p>";
        return;
      }

      const tokens = generoElegido.split(/\s+|&/).map(t=>t.toLowerCase().replace(/[^a-z0-9]/g,'')).filter(Boolean);
      const candidatos = data.artists.filter(a => artistMatchesGenre(a, tokens));
      artistas = candidatos.length ? candidatos.slice(0, MAX_RENDER) : data.artists.slice(0, MAX_RENDER);
      artistas = artistas.filter(a => !mostradosSet.has(a.id));
    }

    if (!refresh) contenedor.innerHTML = "";
    let añadidos = 0;
    for (const a of artistas) {
      if (!a || !a.id) continue;
      if (mostradosSet.has(a.id)) continue;
      renderizarArtista(a, (genreSel === 'any' && subSel === 'any') ? null : (subSel !== 'any' ? subSel : genreSel));
      mostradosSet.add(a.id);
      añadidos++;
      if (añadidos >= MAX_RENDER) break;
    }

    if (!refresh) {
      btnSearch.disabled = true;
      btnMore.disabled = false;
    } else {
      btnMore.disabled = false;
    }

  } catch (e) {
    console.error(e);
    contenedor.innerHTML = "<p>Error al buscar artistas.</p>";
  }
}

function elegirGeneroAleatorio() {
  const generos = ["rock","pop","metal","jazz","electronic","hip hop","reggae","punk","trap","r&b","folk","ambient","flamenco","tango","afrobeat","cumbia","soul","indie","latin","disco"];
  return generos[Math.floor(Math.random() * generos.length)];
}

function renderizarArtista(artista, genero) {
  const card = document.createElement("div");
  card.className = "card";

  const img = document.createElement("img");
  img.src = "https://via.placeholder.com/100";
  img.alt = artista.name || "Artista";

  const content = document.createElement("div");
  content.className = "card-content";

  const title = document.createElement("h3");
  title.textContent = artista.name || "Desconocido";

  const inicio = artista["life-span"]?.begin || "Desconocido";
  const regionName = artista.area?.name || artista['begin-area']?.name || artista.country || "Desconocido";

  const info = document.createElement("small");
  info.textContent = `Región: ${regionName} | Inicio: ${inicio}`;

  const btnInfo = document.createElement("button");
  btnInfo.type = "button";
  btnInfo.textContent = "Más información";
  const artistName = artista.name || "";
  const songsId = "songs-" + sanitizeId(artistName);
  btnInfo.addEventListener('click', ()=> mostrarCanciones(artistName));

  const ul = document.createElement("ul");
  ul.className = "songs";
  ul.id = songsId;

  if (genero) {
    const tag = document.createElement("span");
    tag.className = "tag-genero";
    tag.textContent = genero;
    content.appendChild(tag);
    content.appendChild(document.createElement("br"));
  }

  content.appendChild(title);
  content.appendChild(info);
  content.appendChild(document.createElement("br"));
  content.appendChild(btnInfo);
  content.appendChild(ul);

  card.appendChild(img);
  card.appendChild(content);
  contenedor.appendChild(card);

  cargarFotoArtista(artistName, img);
}

async function cargarFotoArtista(nombreArtista, imgElement){
  if (!nombreArtista) return;

  try {
    const localUrl = 'http://localhost:3000/api/spotify-image?name=' + encodeURIComponent(nombreArtista);
    const localRes = await fetch(localUrl);
    if (localRes.ok) {
      const localData = await localRes.json().catch(()=>null);
      if (localData && localData.image) {
        imgElement.src = localData.image;
        return;
      }
    }
  } catch(e){}

  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(nombreArtista)}&prop=pageimages&format=json&pithumbsize=200&origin=*`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return;
    const page = Object.values(pages)[0];
    if (page?.thumbnail?.source) imgElement.src = page.thumbnail.source;
  } catch(e){}
}

async function mostrarCanciones(nombreArtista){
  const id = "songs-" + sanitizeId(nombreArtista);
  const lista = document.getElementById(id);
  if (!lista) return;
  lista.innerHTML = "<li>Cargando canciones...</li>";

  try {
    const limpio = nombreArtista.replace(/\s*\(.*?\)\s*/g, '').trim();
    const url = `https://corsproxy.io/?https://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&artist=${encodeURIComponent(limpio)}&api_key=${API_KEY_LASTFM}&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error LastFM');
    const data = await res.json();
    const tracks = data.toptracks?.track?.slice(0, 3);
    if (!tracks || tracks.length === 0) {
      lista.innerHTML = "<li>No se encontraron canciones.</li>";
      return;
    }
    lista.innerHTML = tracks.map(t => {
      const plays = t.playcount ? `${Math.round(t.playcount/1000)}k` : "—";
      const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(limpio + ' ' + t.name)}`;
      return `<li>${t.name} <small>(${plays} reproducciones)</small> - <a href="${youtubeUrl}" target="_blank" rel="noopener">🎧 Escuchar</a></li>`;
    }).join("");
  } catch (e) {
    console.error(e);
    lista.innerHTML = "<li>Error al obtener canciones.</li>";
  }
}

async function buscarArtistasSpotify(query) {
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=5`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${API_KEY_SPOTIFY}`
    }
  });
  if (!res.ok) throw new Error('Error en Spotify: ' + res.status);
  const data = await res.json();
  return data.artists.items;
}