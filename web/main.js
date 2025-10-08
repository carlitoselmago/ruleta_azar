//SETTINGS
let weightsSpeed=400; //greater is slower
let spinSpeed=10000;//greater is slower
//


let weights = {};
let people = [];
let events = [];
let spinning = false;

let eventRotation = 0;
let peopleRotation = 0;

// Preload images (one per person)
let personImages = {};

// animated weights for people
let currentWeights = {};
let animatingWeights = false;

window.name = "main";

// Preload images (returns a Promise that resolves when all are loaded)
function preloadImages(people) {
    const promises = [];
    const images = {};

    for (const p of people) {
        const img = new Image();
        img.src = `images/${p.name.toLowerCase()}.png`; // <-- check your filenames!
        images[p.name] = img;

        promises.push(
            new Promise((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => {
                    console.warn(`⚠️ Could not load image for ${p.name} (${img.src})`);
                    resolve(); // still continue even if one fails
                };
            })
        );
    }

    return Promise.all(promises).then(() => images);
}


async function init() {
    const pdata = await eel.get_people()();
    people = pdata.people;
    weights = pdata.weights;
    currentWeights = { ...weights };
    events = await eel.get_events()();

    personImages = await preloadImages(people); // ⏳ wait for all images

    console.log("✅ All images loaded:", Object.keys(personImages));

    drawRoulette(
        "event-roulette",
        events.map(e => e.desc),
        Array(events.length).fill(1),
        eventRotation
    );
    drawRoulette(
        "people-roulette",
        people.map(p => p.name),
        people.map(p => currentWeights[p.name] || 0),
        peopleRotation
    );
}

function drawRoulette(canvasId, labels, ws, rotation = 0) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");
    let total = ws.reduce((a, b) => a + b, 0);
    if (total <= 0) total = labels.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = (canvas.width / 2) - 5;
    const fontSize = Math.max(14, r * 0.07);
    const textRadius = r * 0.65; // distance for text
    const imageRadius = r * 0.8; // distance for PNGs
    const imageSize = r * 0.15; // size of the icons

    let start = rotation;
    const twoPi = Math.PI * 2;

    for (let i = 0; i < labels.length; i++) {
        let label = labels[i];
       
        const slice = (ws[i] / total) * twoPi;

        // slice
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, start + slice);
        ctx.closePath();
        ctx.fillStyle = `hsl(${(i * 360) / Math.max(6, labels.length)}, 70%, 50%)`;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.stroke();

        // label
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(start + slice / 2);
        ctx.fillStyle = "white";
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        let labelprinted=label;
         if (canvasId=="people-roulette"){
            labelprinted+="                   ";
        }
        ctx.fillText(labelprinted, textRadius, 0);

        // image
        const img = personImages[label];
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.translate(imageRadius, 0);
            ctx.rotate(Math.PI / 2); // face outward
            // Maintain image aspect ratio
            const aspect = img.naturalWidth / img.naturalHeight;
            let drawW, drawH;
            let scale=4;

            if (aspect >= 1) {
                // wider than tall
                drawW = imageSize*2;
                drawH = (imageSize / aspect)*2;
            } else {
                // taller than wide
                drawH = imageSize*2;
                drawW = (imageSize * aspect)*2;
            }

            // Center the image
            ctx.drawImage(
                img,
                -drawW / 2,
                -drawH / 2,
                drawW,
                drawH
            );
            ctx.restore();
        }

        ctx.restore();
        start += slice;
    }

    // pointer
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.moveTo(cx - 20, 5);
    ctx.lineTo(cx + 20, 5);
    ctx.lineTo(cx, 30);
    ctx.closePath();
    ctx.fill();
}

// EASING
function easeInOutCubic(t) {
    return 1 - Math.pow(1 - t, 5);
}



function computeEndRotation(ws, index, currentRotation, extraTurns = 3) {
    let total = ws.reduce((a, b) => a + b, 0);
    if (total <= 0) total = ws.length;
    const twoPi = Math.PI * 2;

    let sumPrev = 0;
    for (let i = 0; i < index; i++) {
        sumPrev += (ws[i] / total) * twoPi;
    }
    const slice = (ws[index] / total) * twoPi;

    const pointerAngle = -Math.PI / 2; // top

    // 🎯 Instead of stopping at the center, add a small random offset
    // close to the slice border (like real wheel inertia)
    const edgeBias = (Math.random() * 0.6 + 0.2); 
    // 0.2–0.8 fraction of the slice — avoid exact borders
    //const offsetFromCenter = (edgeBias - 0.5) * slice * 0.9;
    const offsetFromCenter = (edgeBias - 0.5) * slice * 0.95;
    // the *0.9 keeps it safely inside the slice

    let base = pointerAngle - sumPrev - slice / 2 + offsetFromCenter;

    // ensure we rotate forward to a nice stopping point
    let end = base;
    while (end <= currentRotation + twoPi * extraTurns) {
        end += twoPi;
    }
    return end;
}

// Generic spin animation to a specific end rotation
function animateTo(which, labels, ws, end, duration = 2000) {
    const start = which === "event" ? eventRotation : peopleRotation;
    const canvasId = which === "event" ? "event-roulette" : "people-roulette";

    return new Promise(resolve => {
        let startTS = null;
        function step(ts) {
            if (!startTS) startTS = ts;
            const t = Math.min((ts - startTS) / duration, 1);
            const eased = easeInOutCubic(t);
            const rot = start + (end - start) * eased;

            if (which === "event") eventRotation = rot;
            else peopleRotation = rot;

            drawRoulette(canvasId, labels, ws, rot);

            if (t < 1) requestAnimationFrame(step);
            else resolve();
        }
        requestAnimationFrame(step);
    });
}

async function spinEvent() {
       document.querySelector("#people-roulette").classList.remove("changing");
    document.querySelector("#event-result span").innerText = "";
    if (spinning) return;
    spinning = true;
    document.querySelector("#person-result span").innerText = "";
    // Ask backend which event happens + updated weights
    const result = await eel.spin_event()();
    const labels = events.map(e => e.desc);
    const ws = Array(events.length).fill(1); // uniform slices for events
    const idx = labels.findIndex(d => d === result.event.desc);

    // Animate wheel so the chosen event lands under the pointer
    const end = computeEndRotation(ws, idx, eventRotation, 3);
    await animateTo("event", labels, ws, end, spinSpeed);

    // Show result and animate people weights
    document.querySelector("#event-result span").innerText = result.event.desc;
    weights = result.weights;
    setTimeout(() => {
        animateWeights(); // smoothly grow/shrink people slices
         document.querySelector("#people-roulette").classList.add("changing");
        spinning = false;
    }, 1000);

}

async function spinPerson() {
    if (spinning) return;
    spinning = true;

    // Ask backend to choose a person (probabilistic by weights)
    const result = await eel.spin_person()();
    const chosen = result.chosen;

    const labels = people.map(p => p.name);
    let ws = labels.map(n => currentWeights[n] || 0);
    // fallback to equal slices if all zero (shouldn't happen, but safe)
    if (ws.reduce((a, b) => a + b, 0) <= 0) ws = labels.map(_ => 1);

    const idx = labels.indexOf(chosen);

    // Animate to land on the chosen person BEFORE removing locally
    const end = computeEndRotation(ws, idx, peopleRotation, 3);
    await animateTo("people", labels, ws, end, spinSpeed);

    // Show result, then remove locally to match backend state
    document.querySelector("#person-result span").innerText = chosen;


    people = people.filter(p => p.name !== chosen);
    delete weights[chosen];
    delete currentWeights[chosen];

    // Redraw with updated list
    drawRoulette(
        "people-roulette",
        people.map(p => p.name),
        people.map(p => currentWeights[p.name] || 0),
        peopleRotation
    );

    spinning = false;
}

// Smoothly tween people weights after an event
function animateWeights() {
    animatingWeights = true;
    const steps = weightsSpeed;
    let frame = 0;
    const startWeights = { ...currentWeights };
    const targetWeights = { ...weights };

    function animate() {
        frame++;
        const t = frame / steps;
        for (const name in targetWeights) {
            const start = startWeights[name] || 0;
            const end = targetWeights[name];
            currentWeights[name] = start + (end - start) * t;
        }

        drawRoulette(
            "people-roulette",
            people.map(p => p.name),
            people.map(p => currentWeights[p.name] || 0),
            peopleRotation
        );

        if (frame < steps) {
            requestAnimationFrame(animate);
        } else {
            currentWeights = { ...targetWeights };
            animatingWeights = false;
        }
    }
    animate();
}


// Listen for key presses
document.addEventListener("keydown", (event) => {
    // Check if the key pressed is "1"
    if (event.key === "1") {
        spinEvent();
    }
    if (event.key === "2") {
        spinPerson();
    }
});

init();
