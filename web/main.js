let weights = {};
let people = [];
let events = [];
let spinning = false;

let eventRotation = 0;
let peopleRotation = 0;

// animated weights
let currentWeights = {};
let animatingWeights = false;

async function init() {
    let pdata = await eel.get_people()();
    people = pdata.people;
    weights = pdata.weights;
    currentWeights = {...weights};

    events = await eel.get_events()();

    drawRoulette("event-roulette", events.map(e => e.desc), Array(events.length).fill(1), eventRotation);
    drawRoulette("people-roulette", people.map(p => p.name), people.map(p => currentWeights[p.name]||0), peopleRotation);
}

function drawRoulette(canvasId, labels, ws, rotation=0) {
    let canvas = document.getElementById(canvasId);
    let ctx = canvas.getContext("2d");
    let total = ws.reduce((a,b)=>a+b,0) || 1; // avoid div/0
    ctx.clearRect(0,0,canvas.width,canvas.height);

    let start = rotation;
    for (let i=0; i<labels.length; i++) {
        let slice = (ws[i]/total) * 2*Math.PI;
        ctx.beginPath();
        ctx.moveTo(canvas.width/2, canvas.height/2);
        ctx.arc(canvas.width/2, canvas.height/2, canvas.width/2-5, start, start+slice);
        ctx.fillStyle = `hsl(${i*80},70%,50%)`;
        ctx.fill();
        ctx.stroke();

        // label
        ctx.save();
        ctx.translate(canvas.width/2, canvas.height/2);
        ctx.rotate(start + slice/2);
        ctx.fillStyle = "white";
        ctx.font = "14px sans-serif";
        ctx.fillText(labels[i], canvas.width/4-20, 0);
        ctx.restore();

        start += slice;
    }

    // Draw pointer marker at top
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.moveTo(canvas.width/2 - 10, 5);
    ctx.lineTo(canvas.width/2 + 10, 5);
    ctx.lineTo(canvas.width/2, 25);
    ctx.closePath();
    ctx.fill();
}

async function spinEvent() {
    if (spinning) return;
    spinning = true;

    // animate spin
    let speed = 0.3;
    let spin = () => {
        if (speed <= 0.002) {
            eel.spin_event()().then(result => {
                document.getElementById("event-result").innerText = "Event: " + result.event.desc;
                weights = result.weights;
                animateWeights();
                spinning = false;
            });
            return;
        }
        eventRotation += speed;
        speed *= 0.97;
        drawRoulette("event-roulette", events.map(e => e.desc), Array(events.length).fill(1), eventRotation);
        requestAnimationFrame(spin);
    };
    spin();
}

async function spinPerson() {
    if (spinning) return;
    spinning = true;

    let speed = 0.3;
    let spin = () => {
        if (speed <= 0.002) {
            eel.spin_person()().then(result => {
                if (result.done) {
                    document.getElementById("person-result").innerText = "Winner: " + result.chosen;
                } else {
                    document.getElementById("person-result").innerText = "Chosen: " + result.chosen;
                }
                people = people.filter(p => p.name !== result.chosen);
                drawRoulette("people-roulette",
                    people.map(p => p.name),
                    people.map(p => currentWeights[p.name]||0),
                    peopleRotation);
                spinning = false;
            });
            return;
        }
        peopleRotation += speed;
        speed *= 0.97;
        drawRoulette("people-roulette",
            people.map(p => p.name),
            people.map(p => currentWeights[p.name]||0),
            peopleRotation);
        requestAnimationFrame(spin);
    };
    spin();
}

function animateWeights() {
    animatingWeights = true;
    let steps = 30; // number of frames
    let frame = 0;
    let startWeights = {...currentWeights};
    let targetWeights = {...weights};

    let animate = () => {
        frame++;
        let t = frame/steps;
        for (let name in targetWeights) {
            let start = startWeights[name] || 0;
            let end = targetWeights[name];
            currentWeights[name] = start + (end - start)*t;
        }
        drawRoulette("people-roulette",
            people.map(p => p.name),
            people.map(p => currentWeights[p.name]||0),
            peopleRotation);

        if (frame < steps) {
            requestAnimationFrame(animate);
        } else {
            currentWeights = {...targetWeights};
            animatingWeights = false;
        }
    };
    animate();
}

init();
