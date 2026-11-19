// camo.js – i sei motivi camo (gli stessi del configuratore in index.html) per gli occhiali Boccarossa.
// Le trame si disegnano con il canvas: niente immagini da scaricare.
// Lo usano boccarossa.index.html e boccarossa_prova.html.
import * as THREE from 'three';

// A. le trame: sei immagini disegnate con il canvas (niente file da scaricare)
//    si fanno una volta sola e servono a tutti e due i visori
const LATO = 512;                      // l'immagine è 512 × 512 pixel e si ripete senza giunte

// numeri "a caso" ma sempre uguali a ogni apertura (stesso seme = stessa trama)
function casuale(seme) {
    return function() {
        seme = (seme * 16807) % 2147483647;
        return (seme - 1) / 2147483646;
    };
}

// disegna una cosa anche sui bordi opposti: così la trama si ripete senza tagli
function suiBordi(ctx, disegna) {
    for (const dx of [-LATO, 0, LATO]) {
        for (const dy of [-LATO, 0, LATO]) {
            ctx.save();
            ctx.translate(dx, dy);
            disegna();
            ctx.restore();
        }
    }
}

function nuovaTela() {
    const tela = document.createElement('canvas');
    tela.width = LATO;
    tela.height = LATO;
    return tela;
}

// camouflage: macchie morbide una sopra l'altra (seme, colore di base e colori delle macchie cambiano)
function tramaCamo(seme, base, colori) {
    const tela = nuovaTela();
    const ctx = tela.getContext('2d');
    const r = casuale(seme);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, LATO, LATO);
    colori.forEach(function(colore) {
        for (let i = 0; i < 14; i++) {
            const cx = r() * LATO, cy = r() * LATO, raggio = 22 + r() * 40;
            const giro = r() * Math.PI;            // ogni macchia inclinata in modo diverso

            // una macchia = un contorno chiuso di 9-13 punti a distanza diversa dal centro:
            // vengono fuori lobi e rientranze netti, come nel camouflage militare
            const punti = [];
            const quanti = 9 + Math.floor(r() * 5);
            for (let k = 0; k < quanti; k++) {
                const a = (k / quanti) * Math.PI * 2;
                const d = raggio * (0.35 + r() * 0.85);
                const px = Math.cos(a) * d * 1.7;  // più larga che alta: macchia allungata
                const py = Math.sin(a) * d;
                punti.push([
                    cx + px * Math.cos(giro) - py * Math.sin(giro),
                    cy + px * Math.sin(giro) + py * Math.cos(giro)
                ]);
            }

            suiBordi(ctx, function() {
                ctx.fillStyle = colore;
                ctx.beginPath();
                // la curva passa a metà tra un punto e l'altro: bordo pulito, senza spigoli
                const ultimo = punti[punti.length - 1];
                ctx.moveTo((ultimo[0] + punti[0][0]) / 2, (ultimo[1] + punti[0][1]) / 2);
                for (let k = 0; k < punti.length; k++) {
                    const p = punti[k], dopo = punti[(k + 1) % punti.length];
                    ctx.quadraticCurveTo(p[0], p[1], (p[0] + dopo[0]) / 2, (p[1] + dopo[1]) / 2);
                }
                ctx.fill();
            });
        }
    });
    return tela;
}

// pixel camo: quadretti grigi e gialli, a gruppi
function tramaPixel() {
    const tela = nuovaTela();
    const ctx = tela.getContext('2d');
    const r = casuale(5);
    const CELLE = 32, PASSO = LATO / CELLE;        // 32 × 32 quadretti da 16 px
    const colori = ['#8e8e88', '#d4b93c', '#5e5e5a', '#bdbdb5'];   // grigio base, giallo, grigio scuro, grigio chiaro
    const griglia = [];
    for (let i = 0; i < CELLE * CELLE; i++) { griglia.push(0); }
    // ogni gruppo nasce in un punto e "cammina" a caso, colorando i quadretti
    [1, 2, 3, 1, 2].forEach(function(indice) {
        for (let g = 0; g < 14; g++) {
            let x = Math.floor(r() * CELLE), y = Math.floor(r() * CELLE);
            for (let passo = 0; passo < 22; passo++) {
                griglia[y * CELLE + x] = indice;
                if (r() < 0.6) { griglia[y * CELLE + ((x + 1) % CELLE)] = indice; }
                x = (x + Math.floor(r() * 3) - 1 + CELLE) % CELLE;   // il % fa ripartire dal bordo opposto
                y = (y + Math.floor(r() * 3) - 1 + CELLE) % CELLE;
            }
        }
    });
    for (let y = 0; y < CELLE; y++) {
        for (let x = 0; x < CELLE; x++) {
            ctx.fillStyle = colori[griglia[y * CELLE + x]];
            ctx.fillRect(x * PASSO, y * PASSO, PASSO, PASSO);
        }
    }
    return tela;
}

// dalle tele alle trame di Three.js
function inTrama(tela, pixelNetti) {
    const trama = new THREE.CanvasTexture(tela);
    trama.colorSpace = THREE.SRGBColorSpace;      // colori giusti, non sbiaditi
    trama.wrapS = trama.wrapT = THREE.RepeatWrapping;
    if (pixelNetti) { trama.magFilter = THREE.NearestFilter; }   // quadretti netti, non sfocati
    return trama;
}

export const tele = {
    // terra camo: oliva di base; marrone, verde scuro, marrone scuro, quasi nero
    camo: tramaCamo(7, '#6b7a45', ['#8a6a3f', '#3f4d27', '#5a3e24', '#2a2719']),
    // acqua camo: azzurro polvere di base; blu notte, celeste chiaro, blu acciaio, quasi nero
    camoBlu: tramaCamo(13, '#7f9bb8', ['#3e5a7a', '#c3d3e2', '#5b7896', '#1e2b3c']),
    // fuoco camo: arancione di base; giallo fiamma, rosso, rosso brace, quasi nero
    camoFuoco: tramaCamo(29, '#e0661f', ['#f4b733', '#c0301c', '#74170f', '#2a0f08']),
    // aria camo: celeste cielo di base; bianco nuvola, grigio perla, azzurro, grigio-blu
    camoAria: tramaCamo(41, '#b9cfe0', ['#f4f7fa', '#d5dde4', '#8fb0cc', '#6d8296']),
    // china camo: bianco e rosso; bianco di base, rosa, rosso, rosso scuro, bianco caldo
    camoChina: tramaCamo(53, '#f6f3ee', ['#eab0a6', '#d2382b', '#8f1c15', '#fbf8f4']),
    pixel: tramaPixel()
};
const trame = {
    camo: inTrama(tele.camo, false),
    camoBlu: inTrama(tele.camoBlu, false),
    camoFuoco: inTrama(tele.camoFuoco, false),
    camoAria: inTrama(tele.camoAria, false),
    camoChina: inTrama(tele.camoChina, false),
    pixel: inTrama(tele.pixel, true)
};

// i motivi tra cui scegliere, nell'ordine dei bottoni ("originale" = i colori del file)
export const MOTIVI = [
    { id: 'originale', nome: 'Originale' },
    { id: 'camo', nome: 'Terra camo' },
    { id: 'camoBlu', nome: 'Acqua camo' },
    { id: 'camoFuoco', nome: 'Fuoco camo' },
    { id: 'camoAria', nome: 'Aria camo' },
    { id: 'camoChina', nome: 'China camo' },
    { id: 'pixel', nome: 'Pixel camo' }
];

// le coordinate UV: dicono come stendere la trama sugli occhiali
// (ogni faccia guardata dal lato verso cui è girata: davanti, sopra o di lato)
function uvOcchiali(geometria, tessera) {
    if (!geometria.attributes.normal) { geometria.computeVertexNormals(); }
    const pos = geometria.attributes.position;
    const nor = geometria.attributes.normal;
    const uv = [];
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
        if (ny >= nx && ny >= nz) {
            uv.push(x / tessera, z / tessera);   // faccia girata in su o in giù
        } else if (nx >= nz) {
            uv.push(z / tessera, y / tessera);   // faccia girata di lato (le aste)
        } else {
            uv.push(x / tessera, y / tessera);   // faccia girata davanti o dietro
        }
    }
    geometria.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
}

// prepara i modelli per cambiare colore e restituisce la funzione che lo cambia.
// modelli: tutti gli occhiali della pagina (anche le copie); lato: la misura più grande del file
export function preparaColori(modelli, lato) {
    const materiale = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    const originali = new Map();           // pezzo → il suo materiale del file, per tornare a "Originale"
    const fatte = new Set();               // le forme che hanno già le coordinate UV (le copie le condividono)

    modelli.forEach(function(modello) {
        modello.traverse(function(pezzo) {
            if (!pezzo.isMesh || pezzo.name === 'bocca-rossa') { return; }   // la bocca resta rossa
            let lente = false;
            pezzo.traverseAncestors(function(a) { if (a.name === 'lente') { lente = true; } });
            if (lente) { return; }                                             // le lenti restano lenti
            originali.set(pezzo, pezzo.material);
            if (!fatte.has(pezzo.geometry)) {
                uvOcchiali(pezzo.geometry, lato / 3);   // la trama si ripete 3 volte sulla larghezza
                fatte.add(pezzo.geometry);
            }
        });
    });

    return function applica(id) {
        const trama = trame[id];
        originali.forEach(function(suo, pezzo) {
            pezzo.material = trama ? materiale : suo;
        });
        if (trama) {
            materiale.map = trama;
            materiale.needsUpdate = true;
        }
    };
}

// la scelta resta anche cambiando pagina (dalla presentazione alla prova con la fotocamera)
const CHIAVE = 'boccarossa-colore';
export function coloreSalvato() {
    try { return localStorage.getItem(CHIAVE) || 'originale'; } catch (e) { return 'originale'; }
}
export function salvaColore(id) {
    try { localStorage.setItem(CHIAVE, id); } catch (e) { /* senza memoria: pazienza */ }
}

// ===== le lenti: sette colori, tutti trasparenti tranne la nera =====
// Sono nello stesso ordine delle montature (MOTIVI): ogni lente sta sotto il camo con cui si abbina.
// colore = la tinta; opacita = quanto copre (0 = invisibile, 1 = piena)
export const LENTI = [
    { id: 'nera', nome: 'Nera', colore: '#111111', opacita: 0.88 },              // sotto Originale (nero e grigio)
    { id: 'verdefluo', nome: 'Verde fluo', colore: '#39ff14', opacita: 0.45 },   // sotto Terra camo (verde)
    { id: 'blu', nome: 'Blu', colore: '#1f6bff', opacita: 0.45 },                // sotto Acqua camo (blu)
    { id: 'arancione', nome: 'Arancione', colore: '#ff7a00', opacita: 0.45 },    // sotto Fuoco camo (arancione)
    { id: 'trasparente', nome: 'Trasparente', colore: '#ffffff', opacita: 0.12 },// sotto Aria camo (cielo e bianco)
    { id: 'rossa', nome: 'Rossa', colore: '#e0101e', opacita: 0.45 },            // sotto China camo (rosso)
    { id: 'gialla', nome: 'Gialla', colore: '#ffd000', opacita: 0.42 }           // sotto Pixel camo (giallo)
];

// prepara le lenti di tutti gli occhiali della pagina e restituisce la funzione che cambia il loro colore.
// Le lenti sono i pezzi dentro il gruppo "lente" del file: prendono tutte lo stesso materiale di vetro
export function preparaLenti(modelli) {
    const vetro = new THREE.MeshPhysicalMaterial({
        color: '#ffffff', transparent: true, opacity: 0.12,
        roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false                  // trasparenti: non nascondono quello che c'è dietro
    });
    modelli.forEach(function(modello) {
        modello.traverse(function(pezzo) {
            if (!pezzo.isMesh) { return; }
            let lente = false;
            pezzo.traverseAncestors(function(a) { if (a.name === 'lente') { lente = true; } });
            if (lente) { pezzo.material = vetro; pezzo.renderOrder = 1; }   // le lenti si disegnano dopo la montatura
        });
    });
    return function applica(id) {
        const l = LENTI.find(function(x) { return x.id === id; }) || LENTI.find(function(x) { return x.id === 'trasparente'; });
        vetro.color.set(l.colore);
        vetro.opacity = l.opacita;
    };
}

// la lente scelta resta anche cambiando pagina, come il colore
const CHIAVE_LENTE = 'boccarossa-lente';
export function lenteSalvata() {
    try { return localStorage.getItem(CHIAVE_LENTE) || 'trasparente'; } catch (e) { return 'trasparente'; }
}

// ===== i tondini per scegliere (camo e lenti usano lo stesso codice) =====
// lista: le voci; sfondo(voce, bottone): come colorare il tondino; chiave: dove ricordare la scelta
function campioni(lista, sfondo, chiave, contenitore, scritta, quandoScegli) {
    lista.forEach(function(voce) {
        const b = document.createElement('button');
        b.className = 'campione-camo';
        b.dataset.motivo = voce.id;
        b.title = voce.nome;
        b.setAttribute('aria-label', voce.nome);
        sfondo(voce, b);
        b.addEventListener('click', function() { scegli(voce.id); });
        contenitore.appendChild(b);
    });
    function scegli(id) {
        contenitore.querySelectorAll('.campione-camo').forEach(function(b) {
            b.classList.toggle('selected', b.dataset.motivo === id);
        });
        scritta.textContent = (lista.find(function(v) { return v.id === id; }) || lista[0]).nome;
        try { localStorage.setItem(chiave, id); } catch (e) { /* senza memoria: pazienza */ }
        quandoScegli(id);
    }
    return scegli;
}

// i tondini dei camo: la trama in piccolo dentro.
// contenitore: dove metterli; scritta: dove scrivere il nome scelto; quandoScegli(id): cosa fare al clic
export function creaCampioni(contenitore, scritta, quandoScegli) {
    return campioni(MOTIVI, function(m, b) {
        if (tele[m.id]) { b.style.backgroundImage = 'url(' + tele[m.id].toDataURL() + ')'; }
    }, CHIAVE, contenitore, scritta, quandoScegli);
}

// i tondini delle lenti: il colore della lente, trasparente come lei (sopra un fondo a quadretti)
export function creaCampioniLenti(contenitore, scritta, quandoScegli) {
    return campioni(LENTI, function(l, b) {
        b.classList.add('campione-lente');
        const c = new THREE.Color(l.colore);
        const rgba = 'rgba(' + Math.round(c.r * 255) + ', ' + Math.round(c.g * 255) + ', ' + Math.round(c.b * 255) + ', ' + Math.max(l.opacita, 0.08) + ')';
        b.style.setProperty('--tinta', rgba);
    }, CHIAVE_LENTE, contenitore, scritta, quandoScegli);
}
