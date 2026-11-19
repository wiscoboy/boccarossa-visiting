// archivio-occhiali.js – la lista degli occhiali e come prepararli.
// Lo usano sia index.html (la griglia "Tutti gli occhiali") sia dettaglio_occhiali.html (un modello alla volta):
// se correggi qualcosa qui, cambia in tutte e due le pagine.
import * as THREE from 'three';

export const CARTELLA = 'models/';                // tutti i modelli .glb sono nella cartella models

// un file per scheda; dove più persone hanno lo stesso modello, una scheda sola con tutti i nomi
// [file, nomi, pezzi da togliere (facoltativo), giro in gradi su x, y, z (facoltativo)]
export const ARCHIVIO = [
    ['takwaguezguez.glb', ['Takwa Guezguez', 'Anna Porcellini']],            // anche takwaguezguez(1).glb e AnnaPorcellini.glb
    ['Eleonora_Nobili.glb', ['Eleonora Nobili', 'Sofia Bezzicheri']],
    ['alessandromorri.glb', ['Alessandro Morri', 'Linda Garnaroli', 'Valentina Vicinanza']],
    // terzo elemento: i pezzi del file da togliere (la testa e la patina azzurra delle lenti)
    ['federicacancello.glb', ['Federica Cancello', 'Camila Saravia Ruiz'], ['testa_sx', 'testa_dx', 'lente_esterna', 'lente_interna']],
    ['davidesebastianelli.glb', ['Davide Sebastianelli', 'Luigi Boccarossa']],
    ['demariniadele.glb', ['Adele De Marini', 'Francesca Galli', 'Giulia Camasso']],
    // quarto elemento: come girare il modello prima di metterlo nel riquadro (gradi su x, y, z)
    ['fabbri_Edoardo.glb', ['Edoardo Fabbri', 'Martina Carnevali'], [], [0, 0, 180]],   // nel file è sottosopra
    ['giacomocerioni.glb', ['Giacomo Cerioni', 'Gianmarco Tito', 'Jacopo Del Bianco'], [], [0, 180, 0]],   // nel file è girato all'indietro
    ['lucagiorgetti.glb', ['Luca Giorgetti', 'Viola Mongiusti']],
    ['nico_senza_base.glb', ['Niccolò Casanova']]
];

// le informazioni scritte a mano, una voce per modello (la chiave è il nome del file senza .glb).
// Riempi i campi tra le virgolette: se un campo resta vuoto, la pagina di dettaglio non lo mostra
// (al posto del nome usa "Occhiali 01", "Occhiali 02"...)
export const INFO = {
    takwaguezguez:       { nome: '', descrizione: '', materiali: '' },
    Eleonora_Nobili:     { nome: '', descrizione: '', materiali: '' },
    alessandromorri:     { nome: '', descrizione: '', materiali: '' },
    federicacancello:    { nome: '', descrizione: '', materiali: '' },
    davidesebastianelli: { nome: '', descrizione: '', materiali: '' },
    demariniadele:       { nome: '', descrizione: '', materiali: '' },
    fabbri_Edoardo:      { nome: '', descrizione: '', materiali: '' },
    giacomocerioni:      { nome: '', descrizione: '', materiali: '' },
    lucagiorgetti:       { nome: '', descrizione: '', materiali: '' },
    nico_senza_base:     { nome: '', descrizione: '', materiali: '' }
};

// ['A', 'B', 'C'] → "A, B e C"
export function elencoNomi(nomi) {
    if (nomi.length === 1) { return nomi[0]; }
    return nomi.slice(0, -1).join(', ') + ' e ' + nomi[nomi.length - 1];
}

// il nome che va nell'indirizzo della pagina di dettaglio: "giacomocerioni.glb" → "giacomocerioni"
export function idModello(voce) {
    return voce[0].replace(/\.glb$/i, '');
}

// ogni modello prende la stessa grandezza (largo 2) e va al centro
export function sistemaModello(modello, nomiDaTogliere, giro) {
    // prima si gira (se serve), poi si misura: così centro e grandezza tengono conto del giro
    modello.rotation.set(
        THREE.MathUtils.degToRad(giro[0]),
        THREE.MathUtils.degToRad(giro[1]),
        THREE.MathUtils.degToRad(giro[2])
    );
    modello.updateMatrixWorld(true);

    // i pezzi indicati nella lista ARCHIVIO (es. la testa di Cancello/Saravia Ruiz): via
    const daTogliere = [];
    modello.traverse(function(pezzo) {
        if (nomiDaTogliere.indexOf(pezzo.name) !== -1) { daTogliere.push(pezzo); }
    });
    daTogliere.forEach(function(pezzo) { pezzo.removeFromParent(); });

    // facce a metà: pezzi con 4 angoli ma 1 solo triangolo (es. le stanghette di Cancello/Saravia Ruiz).
    // Il rettangolo va chiuso con il secondo triangolo: la diagonale è la coppia di angoli più lontana
    modello.traverse(function(pezzo) {
        if (!pezzo.isMesh) { return; }
        const g = pezzo.geometry;
        const pos = g.attributes.position;
        if (!g.index || pos.count !== 4 || g.index.count !== 3) { return; }
        const angoli = [0, 1, 2, 3].map(function(i) { return new THREE.Vector3().fromBufferAttribute(pos, i); });
        let diagonale = [0, 1], lontano = -1;
        for (let i = 0; i < 4; i++) {
            for (let j = i + 1; j < 4; j++) {
                const d = angoli[i].distanceToSquared(angoli[j]);
                if (d > lontano) { lontano = d; diagonale = [i, j]; }
            }
        }
        const altri = [0, 1, 2, 3].filter(function(i) { return diagonale.indexOf(i) === -1; });
        const a = diagonale[0], b = diagonale[1];
        g.setIndex([a, b, altri[0], a, altri[1], b]);
        g.computeVertexNormals();
        if (pezzo.material) { pezzo.material.side = THREE.DoubleSide; }   // si vede da tutte e due le parti
    });

    modello.traverse(function(pezzo) {
        if (pezzo.isLine || pezzo.isPoints) { pezzo.visible = false; }   // linee guida: via
    });
    const scatola = new THREE.Box3();
    modello.traverse(function(pezzo) {
        if (pezzo.isMesh) { scatola.expandByObject(pezzo); }       // solo le superfici vere
    });
    if (scatola.isEmpty()) { scatola.setFromObject(modello); }
    const misure = scatola.getSize(new THREE.Vector3());
    const lato = Math.max(misure.x, misure.y, misure.z) || 1;
    const centro = scatola.getCenter(new THREE.Vector3());
    const scala = 2 / lato;
    modello.scale.setScalar(scala);
    modello.position.copy(centro).multiplyScalar(-scala);

    // le misure vere del file (in metri), prima di ingrandirlo: servono alla pagina di dettaglio
    return misure;
}
