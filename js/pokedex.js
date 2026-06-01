/* =========================
   REFERENCIAS
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
const regionFilter = document.getElementById("regionFilter");
const countEl = document.getElementById("count");
const welcomeEl = document.getElementById("welcome");
const detailEl = document.getElementById("detail");

/* =========================
   ESTADO
========================= */
const START = 1;
const END = 649;          /* Gen I a V */

let baseList = [];        /* {id, name} ligero, para la lista */
let selectedId = null;
let shiny = false;

/* CACHÉS */
const pokeCache = {};     /* datos completos por id */
const typeCache = {};
const abilityCache = {};
const speciesCache = {};
const evoCache = {};

/* REGIONES (rangos de la Pokédex nacional) */
const REGIONS = {
    kanto:   [1, 151],
    johto:   [152, 251],
    hoenn:   [252, 386],
    sinnoh:  [387, 493],
    teselia: [494, 649]
};

/* TODOS LOS TIPOS (para el filtro, sin tener que cargar todo) */
const ALL_TYPES = ["normal","fire","water","grass","electric","ice","fighting",
"poison","ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"];

const FALLBACK = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png";

/* =========================
   SPRITES
========================= */
function getSprite(id) {
    const folder = shiny ? "shiny/" : "";
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${folder}${id}.gif`;
}
function getStaticSprite(id) {
    const folder = shiny ? "shiny/" : "";
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${folder}${id}.png`;
}
function handleBrokenImg(img, id) {
    img.onerror = () => {
        if (!img.dataset.fb) { img.dataset.fb = "1"; img.src = getStaticSprite(id); }
        else if (img.dataset.fb === "1") { img.dataset.fb = "2"; img.src = FALLBACK; }
        else img.onerror = null;
    };
}

/* =========================
   CARGA LIGERA INICIAL
   (una sola petición para los 649 nombres)
========================= */
async function loadBaseList() {

    list.innerHTML = `<p class="loading">Inicializando índice nacional...</p>`;

    try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${END}&offset=${START - 1}`);
        const data = await res.json();

        baseList = data.results.map((p, i) => ({
            id: START + i,
            name: p.name
        }));

        rellenarTipos();
        renderList();

    } catch (e) {
        list.innerHTML = `<p class="loading">Error de conexión. Recarga la página.</p>`;
    }
}

/* =========================
   FILTRO DE TIPOS
========================= */
function rellenarTipos() {
    ALL_TYPES.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t.toUpperCase();
        typeFilter.appendChild(opt);
    });
}

/* =========================
   OBTENER DATOS COMPLETOS (con caché)
========================= */
async function getPokemon(id) {
    if (pokeCache[id]) return pokeCache[id];
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    pokeCache[id] = await res.json();
    return pokeCache[id];
}

/* =========================
   CONTADOR
========================= */
function updateCount(n) {
    countEl.textContent = `${n} Pokémon`;
}

/* =========================
   LISTA FILTRADA
========================= */
function getFiltered() {
    const value = search.value.toLowerCase().trim();
    const region = regionFilter.value;
    const tipo = typeFilter.value;

    let arr = baseList;

    if (region && REGIONS[region]) {
        const [a, b] = REGIONS[region];
        arr = arr.filter(p => p.id >= a && p.id <= b);
    }

    if (value) {
        arr = arr.filter(p =>
            p.name.toLowerCase().includes(value) || String(p.id).includes(value)
        );
    }

    /* El filtro por tipo necesita datos; se aplica sobre los ya cargados.
       Para que funcione siempre, cargamos los datos de la región visible. */
    return { arr, tipo };
}

/* =========================
   RENDER LISTA
========================= */
async function renderList() {

    const { arr, tipo } = getFiltered();

    /* Si hay filtro por tipo, hace falta cargar los datos de esos Pokémon */
    let finalArr = arr;

    if (tipo) {
        list.innerHTML = `<p class="loading">Filtrando por tipo...</p>`;
        const datos = await Promise.all(arr.map(p => getPokemon(p.id).catch(() => null)));
        finalArr = arr.filter((p, i) =>
            datos[i] && datos[i].types.some(t => t.type.name === tipo)
        );
    }

    list.innerHTML = "";
    finalArr.forEach(createCard);
    updateCount(finalArr.length);

    if (!finalArr.length) {
        list.innerHTML = `<p class="loading">Sin resultados</p>`;
    }
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
    handleBrokenImg(img, p.id);
    img.src = getSprite(p.id);

    card.onclick = () => showPokemon(p.id);
    list.appendChild(card);
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
        } catch (e) {}
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
        } catch (e) {}
    }
    return Object.entries(mult).filter(([, v]) => v > 1).map(([name, v]) => ({ name, x: v }));
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
        const nombres = [];
        let nodo = evoCache[url].chain;
        while (nodo) { nombres.push(nodo.species.name); nodo = nodo.evolves_to[0]; }
        return nombres;
    } catch (e) { return []; }
}

function idFromName(name) {
    const found = baseList.find(p => p.name === name);
    return found ? found.id : null;
}

function renderEvolutions(nombres, actual) {
    if (nombres.length <= 1) {
        evoEl.innerHTML = `<p class="lbl">EVOLUCIÓN</p><p class="muted">No evoluciona</p>`;
        return;
    }
    const cadena = nombres.map((n, i) => {
        const id = idFromName(n);
        const flecha = i < nombres.length - 1 ? `<span class="evo-arrow">▶</span>` : "";
        if (!id) return `<span class="evo-stage">${n}${flecha}</span>`;
        const activo = id === actual ? " activo" : "";
        return `<span class="evo-stage${activo}" data-id="${id}">
            <img src="${getSprite(id)}" alt="${n}"><span>${n}</span></span>${flecha}`;
    }).join("");

    evoEl.innerHTML = `<p class="lbl">EVOLUCIÓN</p><div class="evo-chain">${cadena}</div>`;
    evoEl.querySelectorAll(".evo-stage[data-id]").forEach(el => {
        el.onclick = () => showPokemon(Number(el.dataset.id));
    });
}

/* =========================
   INFO EXTRA
========================= */
async function renderInfo(p) {
    const total = p.stats.reduce((s, st) => s + st.base_stat, 0);
    infoEl.innerHTML = `<p class="muted">Cargando datos...</p>`;

    const [abilities, weaknesses] = await Promise.all([
        getAbilities(p), getWeaknesses(p.types)
    ]);

    const abilHTML = abilities.map(a => `${a.name}${a.hidden ? " (oculta)" : ""}`).join(", ");
    const weakHTML = weaknesses.length
        ? weaknesses.map(w => `<span class="type ${w.name}">${w.name} x${w.x}</span>`).join("")
        : "Ninguna";

    infoEl.innerHTML = `
        <p><span class="lbl">HABILIDADES</span> ${abilHTML}</p>
        <p><span class="lbl">DÉBIL CONTRA</span><br>${weakHTML}</p>
        <p><span class="lbl">TOTAL STATS</span> <b class="total">${total}</b></p>
    `;
}

/* =========================
   GRITO
========================= */
function setCry(id) {
    cryAudio.src = `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`;
}
function playCry() {
    if (!cryAudio.src) return;
    cryAudio.currentTime = 0;
    cryAudio.volume = 0.5;
    cryAudio.play().catch(() => {});
    cryBtn.classList.remove("playing");
    void cryBtn.offsetWidth;
    cryBtn.classList.add("playing");
}

/* =========================
   ANIMACIÓN POKÉ BALL
========================= */
function playBallAnimation() {
    const screen = document.querySelector(".screen");
    if (!screen) return;
    const old = screen.querySelector(".ball-anim");
    if (old) old.remove();

    const wrap = document.createElement("div");
    wrap.className = "ball-anim";
    wrap.innerHTML = `
        <div class="ball-flash"></div>
        <div class="ball">
            <div class="ball-top"></div>
            <div class="ball-bottom"></div>
            <div class="ball-center"></div>
        </div>`;
    screen.appendChild(wrap);

    const sRect = screen.getBoundingClientRect();
    const iRect = imgEl.getBoundingClientRect();
    wrap.style.left = (iRect.left - sRect.left + iRect.width / 2 + screen.scrollLeft) + "px";
    wrap.style.top = (iRect.top - sRect.top + iRect.height / 2 + screen.scrollTop) + "px";

    setTimeout(() => wrap.remove(), 900);
}

/* =========================
   MOSTRAR POKÉMON
========================= */
async function showPokemon(id) {

    selectedId = id;
    welcomeEl.classList.add("hidden");
    detailEl.classList.remove("hidden");

    /* Marcar card */
    document.querySelectorAll(".card").forEach(c => c.classList.remove("selected"));
    const card = list.querySelector(`.card[data-id="${id}"]`);
    if (card) {
        card.classList.add("selected");
        card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    /* Estado de carga inmediato */
    const num = String(id).padStart(3, "0");
    const base = baseList.find(p => p.id === id);
    nameEl.innerHTML = `<span class="dexnum">#${num}</span> ${base ? base.name : ""}`;

    handleBrokenImg(imgEl, id);
    delete imgEl.dataset.fb;
    imgEl.src = getSprite(id);
    imgEl.classList.remove("appear");
    void imgEl.offsetWidth;
    imgEl.classList.add("appear");

    playBallAnimation();
    setCry(id);

    try {
        const p = await getPokemon(id);

        nameEl.innerHTML = `<span class="dexnum">#${num}</span> ${p.name}`;

        typesEl.innerHTML = "";
        p.types.forEach(t => {
            const span = document.createElement("span");
            span.className = `type ${t.type.name}`;
            span.textContent = t.type.name;
            typesEl.appendChild(span);
        });

        renderStats(p);

        if (!speciesCache[id]) {
            const res = await fetch(p.species.url);
            speciesCache[id] = await res.json();
        }
        const species = speciesCache[id];
        const flavor = species.flavor_text_entries.find(f => f.language.name === "es");
        descEl.textContent = flavor
            ? flavor.flavor_text.replace(/\n|\f/g, " ")
            : "Sin información disponible";

        renderInfo(p);
        const evos = await getEvolutions(species);
        renderEvolutions(evos, id);

    } catch (e) {
        descEl.textContent = "No se pudieron cargar los datos. Revisa tu conexión.";
    }
}

/* =========================
   STATS
========================= */
function renderStats(p) {
    const s = {
        hp: p.stats[0]?.base_stat || 0, atk: p.stats[1]?.base_stat || 0,
        def: p.stats[2]?.base_stat || 0, spAtk: p.stats[3]?.base_stat || 0,
        spDef: p.stats[4]?.base_stat || 0, speed: p.stats[5]?.base_stat || 0
    };
    statsEl.innerHTML = `<p class="lbl">ESTADÍSTICAS</p>
        ${bar("HP", s.hp, "hp")}${bar("ATK", s.atk, "atk")}${bar("DEF", s.def, "def")}
        ${bar("SP.ATK", s.spAtk, "spatk")}${bar("SP.DEF", s.spDef, "spdef")}${bar("VEL", s.speed, "speed")}`;
}
function bar(name, value, key) {
    const percent = Math.min(value / 1.6, 100); /* 160 = stat alta */
    return `<div class="stat"><span class="stat-name">${name}</span>
        <div class="bar"><div class="fill ${key}" style="width:${percent}%"></div></div>
        <span class="stat-val">${value}</span></div>`;
}

/* =========================
   TECLADO
========================= */
function getVisible() {
    return [...list.querySelectorAll(".card")].map(c => Number(c.dataset.id));
}
function move(dir) {
    const v = getVisible();
    if (!v.length) return;
    let idx = v.indexOf(selectedId);
    idx = idx === -1 ? 0 : (idx + dir + v.length) % v.length;
    showPokemon(v[idx]);
}
document.addEventListener("keydown", (e) => {
    if (document.activeElement === search) return;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
    else if (e.key === " ") { e.preventDefault(); playCry(); }
});

/* =========================
   BOTONES Y FILTROS
========================= */
randomBtn.addEventListener("click", () => {
    const v = getVisible();
    if (!v.length) return;
    showPokemon(v[Math.floor(Math.random() * v.length)]);
});

cryBtn.addEventListener("click", playCry);

shinyBtn.addEventListener("click", () => {
    shiny = !shiny;
    shinyBtn.classList.toggle("active", shiny);
    renderList();
    if (selectedId) {
        delete imgEl.dataset.fb;
        handleBrokenImg(imgEl, selectedId);
        imgEl.src = getSprite(selectedId);
    }
});

search.addEventListener("input", renderList);
regionFilter.addEventListener("change", renderList);
typeFilter.addEventListener("change", () => {
    typeFilter.className = "sel";
    if (typeFilter.value) typeFilter.classList.add("tf-" + typeFilter.value);
    renderList();
});

/* =========================
   INIT
========================= */
loadBaseList();