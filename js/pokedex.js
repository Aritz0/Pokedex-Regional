const list = document.getElementById("list");

const nameEl = document.getElementById("name");
const imgEl = document.getElementById("img");
const descEl = document.getElementById("desc");
const typesEl = document.getElementById("types");
const statsEl = document.getElementById("stats");
const infoEl = document.getElementById("info");
const search = document.getElementById("search");
const shinyBtn = document.getElementById("shinyBtn");

let allPokemon = [];

/* CACHÉS para no repetir peticiones */
const typeCache = {};
const abilityCache = {};

/* ESTADO SHINY */
let shiny = false;

/* POKÉMON SELECCIONADO ACTUALMENTE (para refrescar el panel) */
let selected = null;

const START = 252;
const END = 386;

/* =========================
   SPRITE SEGÚN MODO
========================= */
function getSprite(p) {

    const folder = shiny ? "shiny/" : "";

    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${folder}${p.id}.gif`;
}

/* =========================
   CARGA OPTIMIZADA
========================= */
async function loadPokedex() {

    for (let i = START; i <= END; i++) {

        try {

            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${i}`);
            const p = await res.json();

            allPokemon.push(p);

            createCard(p);

        } catch (e) {
            console.log("Error Pokémon:", i);
        }
    }
}

/* =========================
   CREAR CARD
========================= */
function createCard(p) {

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
        <img src="${getSprite(p)}" loading="lazy">
        <p>${p.name}</p>
    `;

    card.onclick = () => showPokemon(p);

    list.appendChild(card);
}

/* =========================
   REDIBUJAR LA LISTA
   (respeta el filtro del buscador)
========================= */
function renderList() {

    const value = search.value.toLowerCase();

    list.innerHTML = "";

    allPokemon
        .filter(p => p.name.toLowerCase().includes(value))
        .forEach(createCard);
}

/* =========================
   HABILIDADES (normal + oculta)
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

            const data = abilityCache[a.ability.name];
            const es = data.names.find(n => n.language.name === "es");
            if (es) name = es.name;

        } catch (e) {
            console.log("Error habilidad:", e);
        }

        result.push({ name, hidden: a.is_hidden });
    }

    return result;
}

/* =========================
   DEBILIDADES (combina tipos)
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

    /* Solo lo que hace MÁS daño de lo normal (x2 o x4) */
    return Object.entries(mult)
        .filter(([, v]) => v > 1)
        .map(([name, v]) => ({ name, x: v }));
}

/* =========================
   RENDER INFO EXTRA
========================= */
async function renderInfo(p) {

    /* TOTAL DE STATS */
    const total = p.stats.reduce((s, st) => s + st.base_stat, 0);

    /* Mensaje de carga mientras llegan los datos */
    infoEl.innerHTML = `<p>Cargando datos...</p>`;

    const [abilities, weaknesses] = await Promise.all([
        getAbilities(p),
        getWeaknesses(p.types)
    ]);

    /* HABILIDADES */
    const abilHTML = abilities
        .map(a => `${a.name}${a.hidden ? " (oculta)" : ""}`)
        .join(", ");

    /* DEBILIDADES como insignias de tipo */
    const weakHTML = weaknesses.length
        ? weaknesses
            .map(w => `<span class="type ${w.name}">${w.name} x${w.x}</span>`)
            .join("")
        : "Ninguna";

    infoEl.innerHTML = `
        <p><b>Habilidades:</b> ${abilHTML}</p>
        <p><b>Débil contra:</b><br>${weakHTML}</p>
        <p><b>Total stats:</b> ${total}</p>
    `;
}

/* =========================
   MOSTRAR POKÉMON
========================= */
async function showPokemon(p) {

    selected = p;

    try {

        const res = await fetch(p.species.url);
        const species = await res.json();

        const flavor = species.flavor_text_entries
            .find(f => f.language.name === "es");

        nameEl.textContent = p.name;
        imgEl.src = getSprite(p);

        /* TIPOS */
        typesEl.innerHTML = "";
        p.types.forEach(t => {
            const span = document.createElement("span");
            span.className = `type ${t.type.name}`;
            span.textContent = t.type.name;
            typesEl.appendChild(span);
        });

        /* DESCRIPCIÓN */
        descEl.textContent =
            flavor
                ? flavor.flavor_text.replace(/\n|\f/g, " ")
                : "Sin información disponible";

        /* INFO EXTRA */
        renderInfo(p);

        renderStats(p);

    } catch (e) {
        console.log("Error detalle Pokémon:", e);
    }
}

/* =========================
   STATS SEGURAS
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

/* =========================
   BARRA LIMPIA
========================= */
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
   BOTÓN SHINY
========================= */
shinyBtn.addEventListener("click", () => {

    shiny = !shiny;

    shinyBtn.classList.toggle("active", shiny);
    shinyBtn.textContent = shiny ? "✨ Shiny: ON" : "✨ Shiny: OFF";

    /* Recargar cards con el sprite correcto */
    renderList();

    /* Actualizar el sprite grande si hay uno seleccionado */
    if (selected) {
        imgEl.src = getSprite(selected);
    }
});

/* =========================
   BUSCADOR FIABLE
========================= */
search.addEventListener("input", renderList);

/* =========================
   INIT
========================= */
loadPokedex();