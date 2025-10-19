// puntos por tier
const puntosTier = {
  "LT5": 1, "HT5": 2, "LT4": 3, "HT4": 4,
  "LT3": 6, "HT3": 10, "LT2": 16, "HT2": 28,
  "LT1": 44, "HT1": 60
};

let rawData = {};      // el json original
let modes = new Set(); // listado de modalidades detectadas
let currentMode = "overall";
let rankingArray = []; // array construido para ordenar y render

// carga inicial
fetch("/static/ranking.json")
  .then(res => {
    if (!res.ok) throw new Error("No se pudo cargar ranking.json");
    return res.json();
  })
  .then(data => {
    rawData = data.usuarios || {};
    detectModes(rawData);
    buildTabs();
    renderTable("overall");
  })
  .catch(err => console.error("Error cargando ranking.json:", err));

// Detectar modos exclusivos en el JSON
function detectModes(data){
  modes.clear();
  for(const id in data){
    const u = data[id];
    for(const k in u){
      if(k === "discord_name") continue;
      modes.add(k);
    }
  }
}

// Construye botones/tabs dinámicamente
function buildTabs(){
  const tabs = document.getElementById("mode-tabs");
  tabs.innerHTML = "";

  // overall tab
  const overallBtn = makeTabButton("overall", "Overall", "/static/icons/trophy.png");
  tabs.appendChild(overallBtn);

  // modo por cada modalidad detectada (orden alfabético)
  Array.from(modes).sort().forEach(modeName => {
    // normalizar filename (minúscula, espacios -> guion bajo)
    const file = modeName.toLowerCase().replace(/\s+/g,"_") + ".png";
    const iconPath = `/static/icons/${file}`;
    const btn = makeTabButton(modeName.toLowerCase(), modeName, iconPath);
    tabs.appendChild(btn);
  });

  // evento delegado: al clickar un tab, render
  tabs.querySelectorAll(".tab-button").forEach(btn=>{
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.dataset.mode;
      currentMode = mode;
      renderTable(mode);
    });
  });

  // activar first tab por defecto
  const first = tabs.querySelector(".tab-button");
  if(first) first.classList.add("active");
}

function makeTabButton(mode, label, iconSrc){
  const btn = document.createElement("button");
  btn.className = "tab-button";
  btn.dataset.mode = mode;
  btn.innerHTML = `<img src="${iconSrc}" alt="${label}"> <span>${label}</span>`;
  return btn;
}

// Render: mode = "overall" o nombre de modalidad en minúsculas
function renderTable(mode){
  const tbody = document.querySelector("#ranking-table tbody");
  tbody.innerHTML = "";
  rankingArray = [];

  for(const id in rawData){
    const user = rawData[id];
    let puntos = 0;
    const modsPresent = {};

    for(const key in user){
      if(key === "discord_name") continue;
      const tier = user[key];
      modsPresent[key] = tier;
      // si overall: sumar todo; si modo específico: sumar solo ese modo
      if(mode === "overall"){
        puntos += puntosTier[tier] || 0;
      } else {
        if(key.toLowerCase() === mode.toLowerCase()){
          puntos += puntosTier[tier] || 0;
        }
      }
    }

    // si estamos en modo específico, sólo mostrar usuarios con puntos >0 (tuvieron esa modalidad)
    if(mode === "overall" ? puntos > -1 : puntos > 0){
      rankingArray.push({
        nombre: user.discord_name || "Sin nombre",
        modalidades: modsPresent,
        puntos: puntos
      });
    }
  }

  // ordenar descendente por puntos
  rankingArray.sort((a,b)=> b.puntos - a.puntos);

  // render
  rankingArray.forEach((u, i) => {
    const tr = document.createElement("tr");

    // construir HTML de modalidades (mostramos íconos de cualquier modalidad que el usuario tenga)
    const modsHtml = Object.entries(u.modalidades).map(([mod, tier]) => {
      const filename = mod.toLowerCase().replace(/\s+/g, "_") + ".png";
      const iconPath = `/static/icons/${filename}`;
      // si estamos en modo específico, queremos quizá destacar solo esa modalidad; mantenemos todo visible
      return `<div class="mod-item" title="${mod}: ${tier}">
                <img class="mod-icon" src="${iconPath}" alt="${mod}" onerror="this.style.display='none'">
                <div class="tier-label ${tier}">${tier}</div>
              </div>`;
    }).join("");

    tr.innerHTML = `<td>${i+1}</td>
                    <td>${escapeHtml(u.nombre)}</td>
                    <td class="mods-cell">${modsHtml}</td>
                    <td>${u.puntos}</td>`;
    tbody.appendChild(tr);
  });

  applySearchFilter(); // si hay texto en buscador, aplicar filtro inmediatamente
}

// Buscador en tiempo real
const searchInput = document.getElementById("search-input");
if(searchInput){
  // foco con tecla '/'
  document.addEventListener("keydown", (e)=>{
    if(e.key === "/" && document.activeElement !== searchInput){
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  searchInput.addEventListener("input", ()=> applySearchFilter());
}

function applySearchFilter(){
  const term = (document.getElementById("search-input")?.value || "").toLowerCase().trim();
  document.querySelectorAll("#ranking-table tbody tr").forEach(row=>{
    const name = row.children[1]?.textContent?.toLowerCase() || "";
    row.style.display = (term === "" || name.includes(term)) ? "" : "none";
  });
}

// simple escape to avoid injection
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
