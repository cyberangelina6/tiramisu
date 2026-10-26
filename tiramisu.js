const STILL_SRC = "tiramisu/pixil-frame-0%20(1).png";
const GIF_SRC = "tiramisu/output-onlinegiftools.gif";
const TIRAMISU_SRC = "tiramisu/pixil-frame-0%20(2).png";
const GIF_LENGTH = 600; // the gif is 3 frames: 100ms + 100ms + 400ms

// fill these in from the supabase project's settings > api keys page
const SUPABASE_URL = "https://jacahfpbgumspphitmby.supabase.co"; // e.g. "https://abcdefgh.supabase.co"
const SUPABASE_KEY = "sb_publishable_jy6Hsib5ViWwtbUC6QY1Lw_E6REL4eC"; // the publishable (anon) key, safe to show in the page
const LEADERBOARD_SIZE = 10;
const NAME_KEY = "tiramisu-player-name";

const stage = document.getElementById("stage");
const button = document.getElementById("character-button");
const character = document.getElementById("character");
const countDisplay = document.getElementById("count");
const saveForm = document.getElementById("save-form");
const nameInput = document.getElementById("player-name");
const saveButton = document.getElementById("save-button");
const statusText = document.getElementById("leaderboard-status");
const leaderboardList = document.getElementById("leaderboard-list");

let count = 0;
let gifTimer = null;

// load these up front so the first click doesn't flicker
[GIF_SRC, TIRAMISU_SRC].forEach((src) => {
    new Image().src = src;
});

function playGif() {
    // clearing the src first makes the gif start again from its first frame
    character.src = "";
    character.src = GIF_SRC;

    clearTimeout(gifTimer);
    gifTimer = setTimeout(() => {
        character.src = STILL_SRC;
    }, GIF_LENGTH);
}

function showPlusOne() {
    const popup = document.createElement("div");
    popup.className = "plus-one";

    const crop = document.createElement("div");
    crop.className = "plus-one-crop";

    const tiramisu = document.createElement("img");
    tiramisu.src = TIRAMISU_SRC;
    tiramisu.alt = "";

    const text = document.createElement("span");
    text.textContent = "+1";

    crop.appendChild(tiramisu);
    popup.appendChild(crop);
    popup.appendChild(text);
    stage.appendChild(popup);

    popup.addEventListener("animationend", () => popup.remove());
}

function eatTiramisu() {
    count += 1;
    countDisplay.textContent = count;
    playGif();
    showPlusOne();
}

button.addEventListener("click", eatTiramisu);

// space bar counts as a click from anywhere on the page
document.addEventListener("keydown", (event) => {
    if (event.code !== "Space") return;
    // let space type into the name box, and let focused buttons handle it themselves
    if (event.target.closest("input, textarea, button")) return;
    // stop the page from scrolling
    event.preventDefault();
    // holding space down doesn't keep eating
    if (event.repeat) return;
    eatTiramisu();
});


// leaderboard

// browser storage can be blocked (private windows etc.), so the name is just a convenience
function readSavedName() {
    try {
        return localStorage.getItem(NAME_KEY) || "";
    } catch {
        return "";
    }
}

function rememberName(name) {
    try {
        localStorage.setItem(NAME_KEY, name);
    } catch {
        // nothing to do, the name just won't be filled in next time
    }
}

async function supabaseFetch(path, options = {}) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers: {
            apikey: SUPABASE_KEY,
            "Content-Type": "application/json",
            ...options.headers,
        },
    });
    if (!response.ok) {
        throw new Error(`supabase answered ${response.status}: ${await response.text()}`);
    }
    return response;
}

function showLeaderboard(rows) {
    // rows come highest first; a player can save more than once, so keep only their best
    const best = [];
    const seen = new Set();
    for (const row of rows) {
        const key = row.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        best.push(row);
        if (best.length === LEADERBOARD_SIZE) break;
    }

    const you = readSavedName().toLowerCase();
    leaderboardList.replaceChildren(
        ...best.map((row, index) => {
            const item = document.createElement("li");
            if (row.name.toLowerCase() === you) item.className = "is-you";

            const rank = document.createElement("span");
            rank.className = "leaderboard-rank";
            rank.textContent = `${index + 1}.`;

            const name = document.createElement("span");
            name.className = "leaderboard-name";
            name.textContent = row.name;

            const score = document.createElement("span");
            score.textContent = row.score;

            item.append(rank, name, score);
            return item;
        })
    );
    statusText.textContent = best.length ? "" : "no scores yet, be the first!";
}

async function loadLeaderboard() {
    try {
        const response = await supabaseFetch("scores?select=name,score&order=score.desc&limit=100");
        showLeaderboard(await response.json());
    } catch (error) {
        console.error(error);
        statusText.textContent = "couldn't load the leaderboard";
    }
}

saveForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    // the count keeps going while saving, so save the number from this moment
    const score = count;

    if (!name) {
        statusText.textContent = "type your name first";
        return;
    }
    if (score === 0) {
        statusText.textContent = "eat a tiramisu first!";
        return;
    }

    rememberName(name);
    saveButton.disabled = true;
    // hand the space bar back to the game
    document.activeElement.blur();

    try {
        await supabaseFetch("scores", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ name, score }),
        });
        await loadLeaderboard();
        statusText.textContent = `saved ${score}!`;
    } catch (error) {
        console.error(error);
        statusText.textContent = "couldn't save, try again";
    } finally {
        saveButton.disabled = false;
    }
});

if (SUPABASE_URL && SUPABASE_KEY) {
    nameInput.value = readSavedName();
    statusText.textContent = "loading...";
    loadLeaderboard();
} else {
    saveForm.hidden = true;
    statusText.textContent = "leaderboard isn't set up yet";
}
