// prova-fotocamera.js – la prova degli occhiali con la fotocamera, per le pagine Boccarossa.
// Lo usano boccarossa.index.html (l'ultima pagina, "Provali") e boccarossa_prova.html.
//
// Come funziona: MediaPipe (di Google) trova i punti del viso in ogni fotogramma (fino a 4 visi).
// Con gli occhi, la fronte, il mento e la radice del naso calcoliamo dove mettere ogni paio di occhiali,
// quanto grandi e come girati. Si disegna con una camera "piatta" (ortografica) grande come il riquadro,
// così un punto del viso sullo schermo e un punto della scena coincidono pixel per pixel.
import * as THREE from 'three';

export const MAX_VISI = 4;                 // quanti visi riconosce insieme (= quante copie di occhiali servono)

// di quanti gradi si inclinano gli occhiali sulla radice del naso: le aste scendono verso le orecchie.
// Se stanno ancora alte sulle orecchie, aumenta; se finiscono troppo in basso, diminuisci
const INCLINAZIONE_GRADI = 10;

// el: gli elementi della pagina { palco, video, stato, avviso, btnAccendi, btnSpegni, btnFoto }
// (btnSpegni si può non mettere: la fotocamera si spegne comunque da sola quando il palco esce dallo schermo)
// Restituisce mettiOcchiali(copie, misure): da chiamare quando il modello è arrivato,
// con MAX_VISI copie degli occhiali (la prima gira nell'anteprima) e le misure del file
export function creaProva(el) {
    const { palco, video, stato, avviso, btnAccendi, btnSpegni, btnFoto } = el;

    // ===== A. il renderer: uno solo, disegna l'anteprima oppure la prova =====
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    palco.appendChild(renderer.domElement);

    function luci(scena, camera) {
        scena.add(new THREE.HemisphereLight(0xffffff, 0xe6ecf1, 1.6));
        const principale = new THREE.DirectionalLight(0xffffff, 2.2);
        principale.position.set(-4, 5, 3);
        const contorno = new THREE.DirectionalLight(0xffffff, 1.4);
        contorno.position.set(4, 2, -4);
        if (camera) { camera.add(principale); camera.add(contorno); scena.add(camera); }
        else { scena.add(principale); scena.add(contorno); }
    }

    // ===== B. l'anteprima: prima di accendere, gli occhiali girano da soli al centro =====
    const scenaAnteprima = new THREE.Scene();
    const cameraAnteprima = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    cameraAnteprima.position.set(0, 0.9, 4.6);
    cameraAnteprima.lookAt(0, 0, 0);
    luci(scenaAnteprima, cameraAnteprima);
    const giostra = new THREE.Group();
    scenaAnteprima.add(giostra);

    // ===== C. la prova: per ogni viso un'àncora (segue il viso) e una testa invisibile =====
    //     (la testa non si vede ma nasconde le aste che passano dietro il viso)
    const scenaProva = new THREE.Scene();
    const cameraProva = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 10000);
    cameraProva.position.z = 5000;
    luci(scenaProva, null);

    const formaTesta = new THREE.SphereGeometry(1, 32, 16);
    const materialeTesta = new THREE.MeshBasicMaterial({ colorWrite: false });
    const visi = [];
    for (let i = 0; i < MAX_VISI; i++) {
        const ancora = new THREE.Group();
        const interno = new THREE.Group();     // dentro l'àncora: gli occhiali spostati con il frontale sul naso
        // in mezzo, l'inclinazione: gira intorno alla radice del naso (l'origine dell'àncora),
        // così il frontale resta al suo posto e solo le aste si abbassano
        const inclina = new THREE.Group();
        inclina.rotation.x = -THREE.MathUtils.degToRad(INCLINAZIONE_GRADI);
        ancora.add(inclina);
        inclina.add(interno);
        ancora.visible = false;
        scenaProva.add(ancora);
        const testa = new THREE.Mesh(formaTesta, materialeTesta);
        testa.renderOrder = -1;
        testa.visible = false;
        scenaProva.add(testa);
        visi.push({ ancora: ancora, interno: interno, testa: testa, occhiali: null, pronta: false });
    }

    // il canvas prende sempre la misura del palco
    function adattaMisura() {
        const l = renderer.domElement.clientWidth, a = renderer.domElement.clientHeight;
        renderer.setSize(l, a, false);
        cameraAnteprima.aspect = l / a;
        cameraAnteprima.updateProjectionMatrix();
        cameraProva.left = -l / 2; cameraProva.right = l / 2;
        cameraProva.top = a / 2; cameraProva.bottom = -a / 2;
        cameraProva.updateProjectionMatrix();
    }
    new ResizeObserver(adattaMisura).observe(palco);

    // si disegna solo quando il palco è sullo schermo;
    // e se scorri via con la fotocamera accesa, si spegne da sola (non resta accesa di nascosto)
    let visibile = false;
    new IntersectionObserver(function(v) {
        visibile = v[0].isIntersecting;
        if (!visibile && acceso) { spegni(); }
    }).observe(palco);

    // ===== D. gli occhiali: arrivano dalla pagina quando il modello è pronto =====
    let misure = null, lato = 1;
    function mettiOcchiali(copie, m) {
        misure = m;
        lato = Math.max(m.x, m.y, m.z);
        visi.forEach(function(v, i) {
            v.occhiali = copie[i];
            v.interno.position.z = -m.z / lato * 0.85;   // il frontale va sulla radice del naso
            if (i > 0) { v.interno.add(copie[i]); }
        });
        giostra.add(copie[0]);                 // il primo paio gira nell'anteprima
        btnAccendi.disabled = false;
        avviso.textContent = '';                   // sotto il bottone non si scrive niente
    }

    // ===== E. accendere e spegnere la fotocamera =====
    let rilevatore = null;                     // il riconoscimento del viso (si scarica la prima volta)
    let flusso = null;
    let acceso = false;

    async function preparaRilevatore() {
        const VERSIONE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
        const { FaceLandmarker, FilesetResolver } = await import(VERSIONE + '/vision_bundle.mjs');
        const file = await FilesetResolver.forVisionTasks(VERSIONE + '/wasm');
        return FaceLandmarker.createFromOptions(file, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numFaces: MAX_VISI
        });
    }

    async function accendi() {
        btnAccendi.disabled = true;
        avviso.textContent = '';
        btnAccendi.textContent = 'Avvio…';      // mentre parte, lo dice il bottone stesso
        try {
            flusso = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720 }, audio: false });
            video.srcObject = flusso;
            await video.play();
            if (!rilevatore) {
                btnAccendi.textContent = 'Un momento…';   // la prima volta si scarica il riconoscimento del viso
                rilevatore = await preparaRilevatore();
            }
        } catch (errore) {
            console.error('fotocamera:', errore);
            spegni();
            avviso.textContent = errore.name === 'NotAllowedError'
                ? 'Permesso negato: consenti la fotocamera nelle impostazioni del browser.'
                : 'Fotocamera non disponibile (serve Live Server o un sito https).';
            return;
        }
        visi[0].interno.add(visi[0].occhiali);   // il primo paio passa dalla giostra al primo viso
        visi.forEach(function(v) { v.pronta = false; });
        palco.classList.add('acceso');
        acceso = true;
        if (btnSpegni) { btnSpegni.disabled = false; }
        btnFoto.disabled = false;
    }

    function spegni() {
        if (flusso) { flusso.getTracks().forEach(function(t) { t.stop(); }); }
        flusso = null;
        video.srcObject = null;
        if (visi[0].occhiali) { giostra.add(visi[0].occhiali); }   // torna a girare al centro
        palco.classList.remove('acceso');
        acceso = false;
        btnAccendi.disabled = !visi[0].occhiali;
        if (btnSpegni) { btnSpegni.disabled = true; }
        btnFoto.disabled = true;
        avviso.textContent = '';
        btnAccendi.textContent = 'Provali';
        stato.textContent = 'Fotocamera spenta';
        stato.classList.remove('trovato');
    }

    btnAccendi.addEventListener('click', accendi);
    if (btnSpegni) { btnSpegni.addEventListener('click', spegni); }

    // ===== F. seguire i visi =====
    // da un punto di MediaPipe (0–1 sul video) a un punto della scena (pixel, centro del palco = 0).
    // Il video è a specchio e riempie il palco tagliando i bordi (come object-fit: cover)
    function misuraVideo(L, A) {
        const s = Math.max(L / video.videoWidth, A / video.videoHeight);
        return { lv: video.videoWidth * s, av: video.videoHeight * s };
    }

    function puntoScena(p, L, A) {
        const m = misuraVideo(L, A);
        const x = (L - m.lv) / 2 + (1 - p.x) * m.lv;
        const y = (A - m.av) / 2 + p.y * m.av;
        return new THREE.Vector3(x - L / 2, A / 2 - y, -p.z * m.lv);
    }

    const assi = { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };
    const rotazione = new THREE.Matrix4(), giroViso = new THREE.Quaternion();
    let ultimoTempo = -1;

    function seguiVisi() {
        if (video.readyState < 2 || video.currentTime === ultimoTempo) { return; }
        ultimoTempo = video.currentTime;
        const L = renderer.domElement.clientWidth, A = renderer.domElement.clientHeight;
        const trovati = rilevatore.detectForVideo(video, performance.now()).faceLandmarks || [];

        // ogni viso trovato prende il suo paio di occhiali; quelli senza viso si nascondono
        visi.forEach(function(v, i) {
            if (trovati[i]) { seguiViso(v, trovati[i], L, A); }
            else { v.ancora.visible = v.testa.visible = false; v.pronta = false; }
        });

        const n = Math.min(trovati.length, MAX_VISI);
        stato.textContent = n === 0 ? 'Non vedo nessun viso' : (n === 1 ? '1 viso trovato' : n + ' visi trovati');
        stato.classList.toggle('trovato', n > 0);
    }

    function seguiViso(v, punti, L, A) {
        const ancora = v.ancora, testa = v.testa;
        ancora.visible = testa.visible = true;

        // i punti che servono: angoli esterni degli occhi (33, 263), radice del naso (168), fronte (10), mento (152)
        const occhioA = puntoScena(punti[33], L, A), occhioB = puntoScena(punti[263], L, A);
        const naso = puntoScena(punti[168], L, A);
        const fronte = puntoScena(punti[10], L, A), mento = puntoScena(punti[152], L, A);

        // come è girato il viso: x da un occhio all'altro, y dal mento alla fronte, z verso di noi
        assi.x.subVectors(occhioA, occhioB).normalize();
        assi.y.subVectors(fronte, mento);
        assi.y.addScaledVector(assi.x, -assi.y.dot(assi.x)).normalize();
        assi.z.crossVectors(assi.x, assi.y);
        rotazione.makeBasis(assi.x, assi.y, assi.z);
        giroViso.setFromRotationMatrix(rotazione);

        // quanto grandi: la montatura è circa 1,5 volte la distanza tra gli angoli esterni degli occhi
        const distanzaOcchi = occhioA.distanceTo(occhioB);
        const scala = distanzaOcchi * 1.5 / (2 * misure.x / lato);

        // un po' di morbidezza: niente salti, meno tremolio.
        // Se il viso è "saltato" lontano (con più persone l'ordine dei visi a volte si scambia),
        // gli occhiali vanno subito al posto nuovo invece di attraversare lo schermo
        const lontano = ancora.position.distanceTo(naso) > distanzaOcchi * 1.5;
        const morbido = (v.pronta && !lontano) ? 0.5 : 1;
        ancora.position.lerp(naso, morbido);
        ancora.quaternion.slerp(giroViso, morbido);
        ancora.scale.lerp(new THREE.Vector3(scala, scala, scala), morbido);
        v.pronta = true;

        // la testa invisibile: un ovale grande come il viso, dietro la radice del naso
        const altezzaViso = fronte.distanceTo(mento);
        testa.position.copy(naso).addScaledVector(assi.z, -distanzaOcchi * 0.75);
        testa.quaternion.copy(ancora.quaternion);
        testa.scale.set(distanzaOcchi * 0.72, altezzaViso * 0.65, distanzaOcchi * 0.8);
    }

    // ===== G. la foto: il video a specchio + gli occhiali, in un'immagine da scaricare =====
    let scatta = false;
    btnFoto.addEventListener('click', function() { scatta = true; });

    function salvaFoto() {
        const tela = renderer.domElement;
        const foto = document.createElement('canvas');
        foto.width = tela.width;
        foto.height = tela.height;
        const ctx = foto.getContext('2d');
        const m = misuraVideo(foto.width, foto.height);
        ctx.save();
        ctx.translate(foto.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, (foto.width - m.lv) / 2, (foto.height - m.av) / 2, m.lv, m.av);
        ctx.restore();
        ctx.drawImage(tela, 0, 0);              // sopra, gli occhiali (va fatto subito dopo il disegno)
        ctx.font = '600 ' + Math.round(foto.width / 40) + 'px -apple-system, Helvetica, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.textAlign = 'right';
        ctx.fillText('Boccarossa', foto.width * 0.97, foto.height * 0.95);
        foto.toBlob(function(file) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(file);
            link.download = 'boccarossa-foto.png';
            link.click();
            setTimeout(function() { URL.revokeObjectURL(link.href); }, 1000);
        }, 'image/png');
    }

    // ===== H. il ciclo di disegno =====
    function anima() {
        if (acceso && rilevatore) {
            seguiVisi();
            renderer.render(scenaProva, cameraProva);
            if (scatta) { scatta = false; salvaFoto(); }
        } else if (visibile) {
            giostra.rotation.y += 0.006;       // l'anteprima gira piano
            renderer.render(scenaAnteprima, cameraAnteprima);
        }
        requestAnimationFrame(anima);
    }
    anima();

    return mettiOcchiali;
}
