/* =========================
   REFERENCIAS A ELEMENTOS
========================= */
const list = document.getElementById("list");

const nameEl = document.getElementById("name");
const imgEl = document.getElementById("img");
const descEl = document.getElementById("desc");
const typesEl = document.getElementById("types");
const statsEl = document.getElementById("stats");
const infoEl = document.getElementById("info");
const evoEl = document.getElementById("evo");
const cryBtn = document.getElementById("cryBtn");
const cryAudio = document.getElementById("cry");

const search = document.getElementById("search");
const shinyBtn = document.getElementById("shinyBtn");
const randomBtn = document.getElementById("randomBtn");
const typeFilter = document.getElementById("typeFilter");
const countEl = document.getElementById("count");
const welcomeEl = document.getElementById("welcome");
const detailEl = document.getElementById("detail");

/* =========================
   ESTADO
========================= */
let allPokemon = [];
let selectedId = null;
let shiny = false;

/* CACHÉS */
const typeCache = {};
const abilityCache = {};
const speciesCache = {};
const evoCache = {};

const START = 252;
const END = 386;

/* Sprite de repuesto si falta el gif animado */
const FALLBACK = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png";

/* =========================
   SPRITE SEGÚN MODO
========================= */
function getSprite(p) {
    const folder = shiny ? "shiny/" : "";
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${folder}${p.id}.gif`;
}

/* Sprite estático de respaldo (siempre existe) por si el gif no carga */
function getStaticSprite(p) {
    const folder = shiny ? "shiny/" : "";
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${folder}${p.id}.png`;
}

/* Maneja imágenes rotas: prueba el png estático y, si tampoco, el de repuesto */
function handleBrokenImg(img, p) {
    img.onerror = () => {
        if (!img.dataset.fallback) {
            img.dataset.fallback = "static";
            img.src = getStaticSprite(p);
        } else if (img.dataset.fallback === "static") {
            img.dataset.fallback = "missing";
            img.src = FALLBACK;
        } else {
            img.onerror = null;
        }
    };
}

/* =========================
   CARGA EN PARALELO (rápida)
========================= */
async function loadPokedex() {

    list.innerHTML = `<p class="loading">Cargando Pokédex...</p>`;

    /* Lanza todas las peticiones a la vez */
    const ids = [];
    for (let i = START; i <= END; i++) ids.push(i);

    const results = await Promise.all(
        ids.map(i =>
            fetch(`https://pokeapi.co/api/v2/pokemon/${i}`)
                .then(r => r.json())
                .catch(() => null)
        )
    );

    /* Filtra los que fallaron y ordena por id */
    allPokemon = results
        .filter(Boolean)
        .sort((a, b) => a.id - b.id);

    rellenarFiltroTipos();
    renderList();
}

/* =========================
   FILTRO DE TIPOS (rellena el desplegable)
========================= */
function rellenarFiltroTipos() {

    const tipos = new Set();
    allPokemon.forEach(p => p.types.forEach(t => tipos.add(t.type.name)));

    [...tipos].sort().forEach(t => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t.toUpperCase();
        typeFilter.appendChild(opt);
    });
}

/* =========================
   CONTADOR
========================= */
function updateCount() {
    const shown = list.querySelectorAll(".card").length;
    countEl.textContent = `${shown} Pokémon`;
}

/* =========================
   CREAR CARD
========================= */
function createCard(p) {

    const num = String(p.id).padStart(3, "0");

    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = p.id;
    if (p.id === selectedId) card.classList.add("selected");

    card.innerHTML = `
        <img alt="${p.name}" loading="lazy">
        <p><span class="num">#${num}</span> ${p.name}</p>
    `;

    const img = card.querySelector("img");
    handleBrokenImg(img, p);
    img.src = getSprite(p);

    card.onclick = () => showPokemon(p);

    list.appendChild(card);
}

/* =========================
   REDIBUJAR LA LISTA (nombre/nº + tipo)
========================= */
function renderList() {

    const value = search.value.toLowerCase().trim();
    const tipo = typeFilter.value;

    list.innerHTML = "";

    allPokemon
        .filter(p => {
            const coincideTexto =
                p.name.toLowerCase().includes(value) ||
                String(p.id).includes(value);
            const coincideTipo =
                !tipo || p.types.some(t => t.type.name === tipo);
            return coincideTexto && coincideTipo;
        })
        .forEach(createCard);

    updateCount();
}

/* =========================
   HABILIDADES
========================= */
async function getAbilities(p) {

    const result = [];

    for (const a of p.abilities) {
        let name = a.ability.name;
        try {
            if (!abilityCache[a.ability.name]) {
                const res = await fetch(a.ability.url);
                abilityCache[a.ability.name] = await res.json();
            }
            const es = abilityCache[a.ability.name].names.find(n => n.language.name === "es");
            if (es) name = es.name;
        } catch (e) {
            console.log("Error habilidad:", e);
        }
        result.push({ name, hidden: a.is_hidden });
    }
    return result;
}

/* =========================
   DEBILIDADES
========================= */
async function getWeaknesses(types) {

    const mult = {};

    for (const t of types) {
        const name = t.type.name;
        try {
            if (!typeCache[name]) {
                const res = await fetch(`https://pokeapi.co/api/v2/type/${name}`);
                typeCache[name] = await res.json();
            }
            const rel = typeCache[name].damage_relations;
            rel.double_damage_from.forEach(x => mult[x.name] = (mult[x.name] ?? 1) * 2);
            rel.half_damage_from.forEach(x => mult[x.name] = (mult[x.name] ?? 1) * 0.5);
            rel.no_damage_from.forEach(x => mult[x.name] = (mult[x.name] ?? 1) * 0);
        } catch (e) {
            console.log("Error tipo:", e);
        }
    }

    return Object.entries(mult)
        .filter(([, v]) => v > 1)
        .map(([name, v]) => ({ name, x: v }));
}

/* =========================
   EVOLUCIONES
========================= */
async function getEvolutions(species) {

    const url = species.evolution_chain.url;

    try {
        if (!evoCache[url]) {
            const res = await fetch(url);
            evoCache[url] = await res.json();
        }

        /* Recorre la cadena y saca los nombres en orden */
        const nombres = [];
        let nodo = evoCache[url].chain;
        while (nodo) {
            nombres.push(nodo.species.name);
            nodo = nodo.evolves_to[0];
        }
        return nombres;

    } catch (e) {
        console.log("Error evoluciones:", e);
        return [];
    }
}

/* =========================
   RENDER EVOLUCIONES (clicables)
========================= */
function renderEvolutions(nombres, actual) {

    if (nombres.length <= 1) {
        evoEl.innerHTML = `<p><b>Evolución:</b> no evoluciona</p>`;
        return;
    }

    const cadena = nombres.map((n, i) => {
        const poke = allPokemon.find(p => p.name === n);
        const flecha = i < nombres.length - 1 ? `<span class="evo-arrow">▶</span>` : "";

        if (!poke) {
            return `<span class="evo-stage">${n}${flecha}</span>`;
        }

        const activo = poke.id === actual ? " activo" : "";
        return `
            <span class="evo-stage${activo}" data-id="${poke.id}">
                <img src="${getSprite(poke)}" alt="${n}">
                <span>${n}</span>
            </span>${flecha}
        `;
    }).join("");

    evoEl.innerHTML = `<p><b>Evolución:</b></p><div class="evo-chain">${cadena}</div>`;

    /* Click en una evolución para saltar a ella */
    evoEl.querySelectorAll(".evo-stage[data-id]").forEach(el => {
        el.onclick = () => {
            const poke = allPokemon.find(p => p.id === Number(el.dataset.id));
            if (poke) showPokemon(poke);
        };
    });
}

/* =========================
   RENDER INFO EXTRA
========================= */
async function renderInfo(p) {

    const total = p.stats.reduce((s, st) => s + st.base_stat, 0);

    infoEl.innerHTML = `<p>Cargando datos...</p>`;

    const [abilities, weaknesses] = await Promise.all([
        getAbilities(p),
        getWeaknesses(p.types)
    ]);

    const abilHTML = abilities
        .map(a => `${a.name}${a.hidden ? " (oculta)" : ""}`)
        .join(", ");

    const weakHTML = weaknesses.length
        ? weaknesses.map(w => `<span class="type ${w.name}">${w.name} x${w.x}</span>`).join("")
        : "Ninguna";

    infoEl.innerHTML = `
        <p><b>Habilidades:</b> ${abilHTML}</p>
        <p><b>Débil contra:</b><br>${weakHTML}</p>
        <p><b>Total stats:</b> ${total}</p>
    `;
}

/* =========================
   GRITO DEL POKÉMON
========================= */
function setCry(p) {
    /* La PokeAPI sirve los gritos en este repo */
    cryAudio.src = `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${p.id}.ogg`;
}

function playCry() {
    if (!cryAudio.src) return;
    cryAudio.currentTime = 0;
    cryAudio.volume = 0.5;
    cryAudio.play().catch(() => {});

    /* Pequeña animación en el botón */
    cryBtn.classList.remove("playing");
    void cryBtn.offsetWidth; /* reinicia la animación */
    cryBtn.classList.add("playing");
}

/* =========================
   MOSTRAR POKÉMON
========================= */
async function showPokemon(p) {

    selectedId = p.id;

    welcomeEl.classList.add("hidden");
    detailEl.classList.remove("hidden");

    /* Marcar la card seleccionada y centrarla en la lista */
    document.querySelectorAll(".card").forEach(c => c.classList.remove("selected"));
    const card = list.querySelector(`.card[data-id="${p.id}"]`);
    if (card) {
        card.classList.add("selected");
        card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    const num = String(p.id).padStart(3, "0");
    nameEl.innerHTML = `<span class="dexnum">#${num}</span> ${p.name}`;

    /* SPRITE con respaldo */
    handleBrokenImg(imgEl, p);
    delete imgEl.dataset.fallback;
    imgEl.src = getSprite(p);

    /* GRITO */
    setCry(p);

    /* TIPOS */
    typesEl.innerHTML = "";
    p.types.forEach(t => {
        const span = document.createElement("span");
        span.className = `type ${t.type.name}`;
        span.textContent = t.type.name;
        typesEl.appendChild(span);
    });

    renderStats(p);

    try {
        if (!speciesCache[p.id]) {
            const res = await fetch(p.species.url);
            speciesCache[p.id] = await res.json();
        }
        const species = speciesCache[p.id];

        const flavor = species.flavor_text_entries.find(f => f.language.name === "es");
        descEl.textContent = flavor
            ? flavor.flavor_text.replace(/\n|\f/g, " ")
            : "Sin información disponible";

        renderInfo(p);

        const evos = await getEvolutions(species);
        renderEvolutions(evos, p.id);

    } catch (e) {
        console.log("Error detalle Pokémon:", e);
        descEl.textContent = "No se pudieron cargar los datos. Revisa tu conexión.";
    }
}

/* =========================
   STATS
========================= */
function renderStats(p) {

    const stats = {
        hp: p.stats[0]?.base_stat || 0,
        atk: p.stats[1]?.base_stat || 0,
        def: p.stats[2]?.base_stat || 0,
        spAtk: p.stats[3]?.base_stat || 0,
        spDef: p.stats[4]?.base_stat || 0,
        speed: p.stats[5]?.base_stat || 0
    };

    statsEl.innerHTML = `
        <div class="stats">
            ${createBar("HP", stats.hp, "hp")}
            ${createBar("ATK", stats.atk, "atk")}
            ${createBar("DEF", stats.def, "def")}
            ${createBar("SP. ATK", stats.spAtk, "spatk")}
            ${createBar("SP. DEF", stats.spDef, "spdef")}
            ${createBar("VEL", stats.speed, "speed")}
        </div>
    `;
}

function createBar(name, value, key) {
    const percent = Math.min(value, 100);
    return `
        <div class="stat">
            ${name}: ${value}
            <div class="bar">
                <div class="fill ${key}" style="width:${percent}%"></div>
            </div>
        </div>
    `;
}

/* =========================
   NAVEGACIÓN CON TECLADO
   (flechas para cambiar de Pokémon)
========================= */
function getVisibleList() {
    return [...list.querySelectorAll(".card")].map(c => Number(c.dataset.id));
}

function moveSelection(dir) {
    const visibles = getVisibleList();
    if (!visibles.length) return;

    let idx = visibles.indexOf(selectedId);

    /* Si no hay nada seleccionado, empieza por el primero */
    if (idx === -1) {
        idx = 0;
    } else {
        idx = (idx + dir + visibles.length) % visibles.length;
    }

    const poke = allPokemon.find(p => p.id === visibles[idx]);
    if (poke) showPokemon(poke);
}

document.addEventListener("keydown", (e) => {
    /* No interferir si el usuario está escribiendo en el buscador */
    if (document.activeElement === search) return;

    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        moveSelection(1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        moveSelection(-1);
    } else if (e.key === " ") {
        /* Espacio = reproducir grito */
        e.preventDefault();
        playCry();
    }
});

/* =========================
   BOTÓN ALEATORIO
========================= */
randomBtn.addEventListener("click", () => {
    const visibles = getVisibleList();
    if (!visibles.length) return;
    const id = visibles[Math.floor(Math.random() * visibles.length)];
    const poke = allPokemon.find(p => p.id === id);
    if (poke) showPokemon(poke);
});

/* =========================
   BOTÓN DE GRITO
========================= */
cryBtn.addEventListener("click", playCry);

/* =========================
   BOTÓN SHINY
========================= */
shinyBtn.addEventListener("click", () => {
    shiny = !shiny;
    shinyBtn.classList.toggle("active", shiny);
    shinyBtn.textContent = shiny ? "✨ Shiny: ON" : "✨ Shiny: OFF";

    renderList();

    const sel = allPokemon.find(p => p.id === selectedId);
    if (sel) {
        delete imgEl.dataset.fallback;
        handleBrokenImg(imgEl, sel);
        imgEl.src = getSprite(sel);
    }
});

/* =========================
   BUSCADOR Y FILTRO
========================= */
search.addEventListener("input", renderList);
typeFilter.addEventListener("change", () => {
    /* Pinta el desplegable con el color del tipo elegido */
    typeFilter.className = "type-filter";
    if (typeFilter.value) {
        typeFilter.classList.add("tf-" + typeFilter.value);
    }
    renderList();
});

/* =========================
   INIT
========================= */
loadPokedex();