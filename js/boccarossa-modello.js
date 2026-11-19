// boccarossa-modello.js – le parti speciali degli occhiali di Luigi Boccarossa.
// Le usano boccarossa.index.html (la presentazione) e boccarossa_prova.html (la prova con la fotocamera):
// se cambi qui la bocca rossa o le cerniere, cambiano in tutte e due le pagine.
import * as THREE from 'three';

// ===== B. le stanghette: nel file sono attaccate al frontale =====
//     (è lo stesso file del configuratore in index.html: stesse misure della cerniera, in metri)
//     I pezzi di lato (oltre 5,5 cm dal centro) e dietro la cerniera formano l'asta intera:
//     li mettiamo dentro due "cerniere" che possono girare
export function preparaCerniere(modello) {
    const CERNIERA_Z = -0.033, CERNIERA_X = 0.066, LATO_X = 0.055;
    const cerniere = {};
    [-1, 1].forEach(function(lato) {
        const c = new THREE.Group();
        c.position.set(lato * CERNIERA_X, 0, CERNIERA_Z);
        c.name = lato < 0 ? 'cerniera-sinistra' : 'cerniera-destra';
        modello.add(c);
        cerniere[lato] = c;
    });
    const aste = [];
    modello.traverse(function(pezzo) {
        if (!pezzo.isMesh) { return; }
        pezzo.geometry.computeBoundingBox();
        const b = pezzo.geometry.boundingBox;
        const diLato = b.max.x < -LATO_X || b.min.x > LATO_X;
        if (diLato && b.max.z < -0.0305) { aste.push(pezzo); }
    });
    modello.updateMatrixWorld(true);
    aste.forEach(function(pezzo) {
        cerniere[pezzo.geometry.boundingBox.max.x < 0 ? -1 : 1].attach(pezzo);   // resta dov'è, ma gira con la cerniera
    });
}

// piega 0 = aperti, 1 = chiusi (76 gradi: restano dietro le lenti senza attraversarle)
export function piegaAste(modello, piega) {
    modello.getObjectByName('cerniera-sinistra').rotation.y = -piega * Math.PI * 0.42;
    modello.getObjectByName('cerniera-destra').rotation.y = piega * Math.PI * 0.42;
}

// ===== B2. la bocca rossa: il "marchio" di Boccarossa sul fianco dell'asta destra =====
//     Due labbra disegnate con le curve (come in Illustrator), poi rese spesse e gonfie (estrusione con smusso)
function formaLabbra() {
    // le misure sono in millimetri: la bocca è larga 12 mm, il centro è in (0, 0)
    const sopra = new THREE.Shape();
    sopra.moveTo(-6, 0);
    sopra.bezierCurveTo(-4.5, 1.2, -3, 2.8, -1.5, 2.7);      // sale verso la prima punta
    sopra.bezierCurveTo(-0.8, 2.65, -0.4, 2.0, 0, 1.9);      // scende nell'arco di Cupido
    sopra.bezierCurveTo(0.4, 2.0, 0.8, 2.65, 1.5, 2.7);      // risale verso la seconda punta
    sopra.bezierCurveTo(3, 2.8, 4.5, 1.2, 6, 0);             // scende all'angolo destro
    sopra.bezierCurveTo(3, 0.5, 1, 0.2, 0, 0.35);            // torna indietro lungo la riga della bocca
    sopra.bezierCurveTo(-1, 0.2, -3, 0.5, -6, 0);

    const sotto = new THREE.Shape();
    sotto.moveTo(-6, -0.2);
    sotto.bezierCurveTo(-3, 0.1, -1, -0.25, 0, -0.15);       // la riga della bocca, appena sotto quella di sopra
    sotto.bezierCurveTo(1, -0.25, 3, 0.1, 6, -0.2);
    sotto.bezierCurveTo(4.5, -1.8, 2.5, -3.4, 0, -3.4);      // il labbro di sotto, più pieno
    sotto.bezierCurveTo(-2.5, -3.4, -4.5, -1.8, -6, -0.2);
    return [sopra, sotto];
}

export function aggiungiBocca(modello) {
    const cerniera = modello.getObjectByName('cerniera-destra');
    modello.updateMatrixWorld(true);

    // dove appoggiarla: 2,2 cm dietro la cerniera, sul lato esterno della montatura NERA dell'asta.
    // (lì sotto c'è anche un pezzo grigio chiaro, più alto: lo saltiamo, se no la bocca finisce sul grigio)
    // Guardiamo i punti neri a quell'altezza e prendiamo quello più in fuori
    const zBocca = cerniera.position.z - 0.022;
    let fuori = -Infinity, basso = Infinity, alto = -Infinity;
    const v = new THREE.Vector3();
    const hsl = {};
    const nero = function(m) { return m && m.color && m.color.getHSL(hsl).l < 0.15; };
    cerniera.traverse(function(pezzo) {
        if (!pezzo.isMesh || ![].concat(pezzo.material).some(nero)) { return; }
        const pos = pezzo.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            pezzo.localToWorld(v.fromBufferAttribute(pos, i));   // il modello non è ancora ingrandito: mondo = file
            if (Math.abs(v.z - zBocca) > 0.004) { continue; }
            fuori = Math.max(fuori, v.x);
            basso = Math.min(basso, v.y);
            alto = Math.max(alto, v.y);
        }
    });
    if (fuori === -Infinity) { return; }      // asta non trovata: niente bocca

    // la bocca è alta 6,6 mm: se l'asta è più sottile, la rimpiccioliamo perché ci stia (75% dell'asta)
    const scala = Math.min(0.001, (alto - basso) * 0.75 / 6.6);   // da millimetri a metri
    const geometria = new THREE.ExtrudeGeometry(formaLabbra(), {
        depth: 0.6, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.3, bevelSegments: 4, curveSegments: 24
    });
    const bocca = new THREE.Mesh(geometria, new THREE.MeshPhysicalMaterial({
        color: '#d0021b', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08   // rosso rossetto, lucido
    }));
    bocca.name = 'bocca-rossa';
    bocca.scale.setScalar(scala);
    bocca.rotation.y = Math.PI / 2;            // girata verso l'esterno: il disegno guarda di lato
    bocca.position.set(fuori + 0.0002, (basso + alto) / 2 + 0.0002, zBocca);
    modello.add(bocca);
    modello.updateMatrixWorld(true);
    cerniera.attach(bocca);                    // da qui in poi gira e si piega insieme all'asta
}

