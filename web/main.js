let weights = {};
let people = [];

async function init() {
    let data = await eel.get_people()();
    people = data.people;
    weights = data.weights;
    drawRoulette();
}

async function spinEvent() {
    let result = await eel.spin_event()();
    document.getElementById("event-result").innerText =
        "Event: " + result.event.desc;
    weights = result.weights;
    drawRoulette();
}

async function spinPerson() {
    let result = await eel.spin_person()();
    document.getElementById("person-result").innerText =
        "Chosen: " + result.chosen;
    people = people.filter(p => p.name !== result.chosen);
    drawRoulette();
}

function drawRoulette() {
    let canvas = document.getElementById("roulette");
    let ctx = canvas.getContext("2d");
    ctx.clearRect(0,0,canvas.width,canvas.height);

    let names = people.map(p => p.name);
    let ws = names.map(n => weights[n] || 0);
    let total = ws.reduce((a,b)=>a+b,0);

    let start = 0;
    for (let i=0; i<names.length; i++) {
        let slice = (ws[i]/total) * 2*Math.PI;
        ctx.beginPath();
        ctx.moveTo(200,200);
        ctx.arc(200,200,200,start,start+slice);
        ctx.fillStyle = `hsl(${i*80},70%,60%)`;
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "black";
        ctx.fillText(names[i], 200+100*Math.cos(start+slice/2), 200+100*Math.sin(start+slice/2));
        start += slice;
    }
}

init();
