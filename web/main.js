let weights = {};
let people = [];
let events = [];
let spinning = false;

let eventRotation = 0;
let peopleRotation = 0;

// animated weights for people
let currentWeights = {};
let animatingWeights = false;

async function init() {
    const pdata = await eel.get_people()();
    people = pdata.people;
    weights = pdata.weights;
    currentWeights = {...weights};

    events = await eel.get_events()();

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
    if (total <= 0) total = labels.length; // fallback: equal slices

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = (canvas.width / 2) - 5;

    let start = rotation;
    const twoPi = Math.PI * 2;

    for (let i = 0; i < labels.length; i++) {
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
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labels[i], r * 0.6, 0);
        ctx.restore();

        start += slice;
    }

    // pointer at top center
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.moveTo(cx - 10, 5);
    ctx.lineTo(cx + 10, 5);
    ctx.lineTo(cx, 25);
    ctx.closePath();
    ctx.fill();
}

// EASING
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

// Compute rotation so the center of slice[index] lands at the top pointer
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
    let base = pointerAngle - sumPrev - slice / 2;

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
            const eased = easeOutCubic(t);
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
    if (spinning) return;
    spinning = true;

    // Ask backend which event happens + updated weights
    const result = await eel.spin_event()();
    const labels = events.map(e => e.desc);
    const ws = Array(events.length).fill(1); // uniform slices for events
    const idx = labels.findIndex(d => d === result.event.desc);

    // Animate wheel so the chosen event lands under the pointer
    const end = computeEndRotation(ws, idx, eventRotation, 3);
    await animateTo("event", labels, ws, end, 2000);

    // Show result and animate people weights
    document.getElementById("event-result").innerText = "Event: " + result.event.desc;
    weights = result.weights;
    animateWeights(); // smoothly grow/shrink people slices

    spinning = false;
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
    if (ws.reduce((a,b)=>a+b,0) <= 0) ws = labels.map(_ => 1);

    const idx = labels.indexOf(chosen);

    // Animate to land on the chosen person BEFORE removing locally
    const end = computeEndRotation(ws, idx, peopleRotation, 3);
    await animateTo("people", labels, ws, end, 2200);

    // Show result, then remove locally to match backend state
    document.getElementById("person-result").innerText =
        result.done ? `Winner: ${chosen}` : `Chosen: ${chosen}`;

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
    const steps = 30;
    let frame = 0;
    const startWeights = {...currentWeights};
    const targetWeights = {...weights};

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
            currentWeights = {...targetWeights};
            animatingWeights = false;
        }
    }
    animate();
}

init();
