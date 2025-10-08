import eel
import random

eel.init("web",allowed_extensions=['.js', '.html'])

# Example data
people = [
    {"name": "Berta", "age": 0.6, "class": 0.9},  # woman, rich
    {"name": "Ada", "age": 0.5, "class": 0.2},  # man, poor
    {"name": "Carlos", "age": 1.0, "class": 0.4},  # woman, middle
    {"name": "German", "age": 0.1, "class": 0.8},  # man, rich
]

# Start with equal weights
weights = {p["name"]: 1.0 for p in people}

# Events (simplified rules)
events = [
    {"desc": "x2 si es jove", "attr": "age",  "factor": 2,"invert": True},
    {"desc": "x2 si es madurite", "attr": "age", "factor": 2 },
    {"desc": "x2 si te diners", "attr": "class", "factor": 2},
    {"desc": "x2 si és pobre", "attr": "class", "factor": 2,"invert": True},
]


@eel.expose
def get_people():
    return {"people": people, "weights": weights}


@eel.expose
def get_events():
    return events


@eel.expose
def spin_event():
    
    """Pick random event and update weights accordingly"""
    event = random.choice(events)

    for p in people:
        name = p["name"]
        value = p[event["attr"]]
        th = 0.5
        factor = event["factor"]
        invert = event.get("invert", False)

        # Distance from threshold, normalized between -1 and +1
        diff = value - th
        # Invert direction if event is inverted
        if invert:
            diff = -diff

        # Normalize into [-1, 1] range (assuming attributes ∈ [0,1])
        diff = max(-1, min(1, diff))

        # Compute influence: 0 means neutral (no change),
        # positive means apply factor proportionally, negative reduces it
        # For example, diff=1 → full factor, diff=-1 → divide by factor
        if diff >= 0:
            multiplier = 1 + (factor - 1) * diff
        else:
            multiplier = 1 + ((1/factor) - 1) * (-diff)

        weights[name] *= multiplier
    return {"event": event, "weights": weights}


@eel.expose
def spin_person():
    global people, weights 
    """Pick person based on weights and remove them"""
    if not people:
        return {"winner": None, "done": True}

    names = [p["name"] for p in people]
    ws = [weights[n] for n in names]
    chosen = random.choices(names, weights=ws, k=1)[0]

    # Remove chosen person
   
    people = [p for p in people if p["name"] != chosen]
    weights.pop(chosen, None)

    return {"chosen": chosen, "remaining": names, "done": len(people) == 0}



eel.start("index.html", size=(800, 600))
