import eel
import random

eel.init("web")

# Example data
people = [
    {"name": "Berta", "gender": 1.0, "class": 0.9},  # woman, rich
    {"name": "Alex", "gender": 0.0, "class": 0.2},  # man, poor
    {"name": "Carla", "gender": 1.0, "class": 0.4},  # woman, middle
    {"name": "Diego", "gender": 0.0, "class": 0.8},  # man, rich
]

# Start with equal weights
weights = {p["name"]: 1.0 for p in people}

# Events (simplified rules)
events = [
    {"desc": "x2 if woman", "attr": "gender", "threshold": 0.5, "factor": 2},
    {"desc": "x2 if man", "attr": "gender", "threshold": 0.5, "factor": 2, "invert": True},
    {"desc": "x2 if rich", "attr": "class", "threshold": 0.7, "factor": 2},
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
        condition = value >= event["threshold"]
        if event.get("invert"):
            condition = not condition
        if condition:
            weights[name] *= event["factor"]

    return {"event": event, "weights": weights}


@eel.expose
def spin_person():
    global people, weights  # <--- add this line
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
