/* Living Lands — country map game for Azora */
(function () {
    var COLS = 64;
    var ROWS = 40;
    var TICK_MS = 2200;
    var SAVE_KEY = "azoraLivingLandsV2";
    var ROOM_KEY = "azoraLivingLandsRoom";

    var TERRAIN = {
        ocean: { name: "Ocean", claim: false, color: [28, 92, 160] },
        coast: { name: "Coast", claim: true, color: [64, 140, 188] },
        sand: { name: "Sand", claim: true, color: [214, 196, 132] },
        grass: { name: "Grassland", claim: true, color: [92, 158, 74] },
        meadow: { name: "Meadow", claim: true, color: [126, 176, 82] },
        forest: { name: "Forest", claim: true, color: [46, 112, 58] },
        hills: { name: "Hills", claim: true, color: [120, 132, 72] },
        rock: { name: "Rock", claim: true, color: [128, 124, 118] },
        mountain: { name: "Mountain", claim: false, color: [168, 168, 172] },
        snow: { name: "Snowcap", claim: false, color: [236, 240, 246] }
    };

    var BUILDINGS = {
        farm: {
            name: "Farm", icon: "🌾", easy: true, food: true,
            desc: "Grows food. Always costs money.",
            canOn: ["grass", "meadow", "sand"],
            base: { money: 18, food: 0, stone: 0, bricks: 0, concrete: 0 },
            upkeep: { money: 1, food: 0 },
            output: { food: 6, money: 1 }
        },
        grocery: {
            name: "Grocery", icon: "🛒", easy: true, food: true,
            desc: "Stores and sells food in towns.",
            canOn: ["grass", "meadow", "sand", "coast"],
            base: { money: 24, food: 2, stone: 1, bricks: 0, concrete: 0 },
            upkeep: { money: 2, food: 0 },
            output: { food: 5, money: 3 }
        },
        quarry: {
            name: "Quarry", icon: "🪨", easy: true,
            desc: "Digs stone. Always costs money.",
            canOn: ["hills", "rock", "grass"],
            base: { money: 22, food: 0, stone: 0, bricks: 0, concrete: 0 },
            upkeep: { money: 2, food: 1 },
            output: { stone: 5 }
        },
        bank: {
            name: "Bank", icon: "🏦",
            desc: "Pays money each cycle. You start with 3.",
            canOn: ["grass", "meadow", "sand", "hills", "coast"],
            base: { money: 40, food: 2, stone: 2, bricks: 0, concrete: 0 },
            upkeep: { money: 2, food: 1 },
            output: { money: 14 }
        },
        house: {
            name: "House", icon: "🏠",
            desc: "Homes for people.",
            canOn: ["grass", "meadow", "sand", "coast"],
            base: { money: 28, food: 3, stone: 1, bricks: 0, concrete: 0 },
            upkeep: { money: 1, food: 2 },
            output: { money: 3 }
        },
        brickworks: {
            name: "Brickworks", icon: "🧱",
            desc: "Turns stone into bricks. Always costs money.",
            canOn: ["grass", "hills", "rock", "meadow"],
            base: { money: 36, food: 1, stone: 8, bricks: 0, concrete: 0 },
            upkeep: { money: 3, food: 1, stone: 1 },
            output: { bricks: 3, money: 1 }
        },
        mixer: {
            name: "Mixer", icon: "🏗️",
            desc: "Turns stone into concrete. Always costs money.",
            canOn: ["grass", "hills", "rock", "sand"],
            base: { money: 42, food: 1, stone: 10, bricks: 2, concrete: 0 },
            upkeep: { money: 3, food: 1, stone: 2 },
            output: { concrete: 3, money: 1 }
        },
        market: {
            name: "Market", icon: "🧺",
            desc: "Sells extra food for money.",
            canOn: ["grass", "meadow", "sand", "coast"],
            base: { money: 30, food: 4, stone: 2, bricks: 1, concrete: 0 },
            upkeep: { money: 2, food: 0 },
            output: { money: 8 }
        },
        city: {
            name: "City", icon: "🏙️",
            desc: "Needs bricks and concrete. Cities are the best way to grow military.",
            canOn: ["grass", "meadow", "sand", "hills", "coast"],
            base: { money: 80, food: 8, stone: 6, bricks: 12, concrete: 10 },
            upkeep: { money: 8, food: 4 },
            output: { money: 28, food: 2 }
        }
    };

    var FLAG_PATTERNS = ["stripes-h", "stripes-v", "tricolor", "canton", "diagonal", "cross"];

    var state = null;
    var map = [];
    var canvas, ctx;
    var cam = { x: 0, y: 0, z: 18 };
    var selected = null;
    var tickTimer = null;
    var dragging = false;
    var lastP = { x: 0, y: 0 };
    var anim = 0;
    var running = false;

    function hash2(x, y, seed) {
        var n = Math.sin(x * 127.1 + y * 311.7 + seed * 0.013) * 43758.5453;
        return n - Math.floor(n);
    }
    function noise2(x, y, seed) {
        var x0 = Math.floor(x), y0 = Math.floor(y);
        var fx = x - x0, fy = y - y0;
        var sx = fx * fx * (3 - 2 * fx);
        var sy = fy * fy * (3 - 2 * fy);
        var a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
        var c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
    function fbm(x, y, seed) {
        var v = 0, a = 1, f = 1, s = 0, i;
        for (i = 0; i < 5; i++) {
            v += noise2(x * f, y * f, seed + i * 19) * a;
            s += a; a *= 0.5; f *= 2.03;
        }
        return v / s;
    }
    function terrainAt(h, m) {
        if (h < 0.34) return "ocean";
        if (h < 0.38) return "coast";
        if (h < 0.44 && m < 0.42) return "sand";
        if (h > 0.82) return "snow";
        if (h > 0.74) return "mountain";
        if (h > 0.64) return "rock";
        if (h > 0.56) return "hills";
        if (m > 0.62 && h < 0.62) return "forest";
        if (m > 0.48) return "meadow";
        return "grass";
    }
    function hexToRgb(hex) {
        hex = String(hex || "#f59e0b").replace("#", "");
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        var n = parseInt(hex, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function myId() {
        try {
            var acc = JSON.parse(localStorage.getItem("azoraAccount") || "null");
            if (acc && acc.username) return String(acc.username);
            if (acc && acc.guestId) return String(acc.guestId);
        } catch (e) {}
        return "player";
    }

    function flagColorAt(nation, u, v) {
        var c1 = hexToRgb(nation.flag.c1);
        var c2 = hexToRgb(nation.flag.c2);
        var p = nation.flag.pattern || "stripes-h";
        var use2 = false;
        if (p === "stripes-h") use2 = Math.floor(v * 5) % 2 === 1;
        else if (p === "stripes-v") use2 = Math.floor(u * 5) % 2 === 1;
        else if (p === "tricolor") use2 = u > 0.33 && u < 0.66;
        else if (p === "canton") use2 = !(u < 0.38 && v < 0.42);
        else if (p === "diagonal") use2 = u + v > 1;
        else if (p === "cross") use2 = Math.abs(u - 0.5) < 0.12 || Math.abs(v - 0.5) < 0.12;
        return use2 ? c2 : c1;
    }

    function buildWorld(seed) {
        map = [];
        var i, j, x, y, h, m, t;
        for (j = 0; j < ROWS; j++) {
            var row = [];
            for (i = 0; i < COLS; i++) {
                x = i / COLS; y = j / ROWS;
                h = fbm(x * 3.2, y * 3.2, seed);
                m = fbm(x * 4.1 + 12, y * 4.1 - 7, seed + 91);
                var cx = (i - COLS / 2) / (COLS * 0.52);
                var cy = (j - ROWS / 2) / (ROWS * 0.52);
                var dist = Math.sqrt(cx * cx + cy * cy);
                h = h * 0.72 + (1 - Math.min(1, dist * 0.92)) * 0.28;
                t = terrainAt(h, m);
                row.push({ t: t, h: h, owner: null, b: null });
            }
            map.push(row);
        }
    }

    function emptyNationRes() {
        return { money: 220, food: 40, stone: 18, bricks: 8, concrete: 5, economy: 1, hungry: 0, buys: { farm: 0, grocery: 0, quarry: 0, bank: 3, house: 0, brickworks: 0, mixer: 0, market: 0, city: 0 } };
    }

    function defaultState(seed, setup) {
        var id = myId();
        var nations = {};
        nations[id] = {
            id: id,
            name: setup.name || "My Country",
            color: setup.color || "#f59e0b",
            flag: { pattern: setup.pattern || "stripes-h", c1: setup.c1 || "#1d4ed8", c2: setup.c2 || "#f8fafc" },
            isBot: false,
            isMe: true,
            stance: "grow"
        };
        return {
            seed: seed,
            mode: setup.mode || "box",
            me: id,
            tick: 0,
            log: ["Your country is planted. Grow cities for military. Keep people fed."],
            nations: nations,
            res: emptyNationRes()
        };
    }

    function saveKey() {
        return SAVE_KEY + "_" + myId();
    }
    function saveGame() {
        try {
            localStorage.setItem(saveKey(), JSON.stringify({
                state: state,
                tiles: map.map(function (row) {
                    return row.map(function (c) { return { o: c.owner || "", b: c.b || "" }; });
                })
            }));
            if (state && state.mode === "server") {
                localStorage.setItem(ROOM_KEY, JSON.stringify({
                    seed: state.seed,
                    nations: state.nations,
                    tiles: map.map(function (row) {
                        return row.map(function (c) { return { o: c.owner || "", b: c.b || "" }; });
                    }),
                    at: Date.now()
                }));
            }
        } catch (e) {}
    }
    function loadGame() {
        try {
            var raw = JSON.parse(localStorage.getItem(saveKey()) || "null");
            if (!raw || !raw.state) return false;
            state = raw.state;
            if (!state.nations || !state.me) return false;
            buildWorld(state.seed || 2026);
            if (raw.tiles && raw.tiles.length === ROWS) {
                for (var j = 0; j < ROWS; j++) {
                    for (var i = 0; i < COLS; i++) {
                        var s = raw.tiles[j] && raw.tiles[j][i];
                        if (!s) continue;
                        map[j][i].owner = s.o || null;
                        map[j][i].b = s.b || null;
                    }
                }
            }
            return true;
        } catch (e) { return false; }
    }

    function findHomeSpot(avoid) {
        var best = null, bestN = -1, i, j, n, a, b, ok;
        for (j = 6; j < ROWS - 6; j++) {
            for (i = 8; i < COLS - 8; i++) {
                ok = true;
                if (avoid) {
                    for (var k = 0; k < avoid.length; k++) {
                        if (Math.abs(avoid[k].x - i) + Math.abs(avoid[k].y - j) < 10) { ok = false; break; }
                    }
                }
                if (!ok) continue;
                n = 0;
                for (b = -2; b <= 2; b++) {
                    for (a = -2; a <= 2; a++) {
                        var c = map[j + b] && map[j + b][i + a];
                        if (c && TERRAIN[c.t].claim && !c.owner) n++;
                    }
                }
                if (n > bestN) { bestN = n; best = { x: i, y: j }; }
            }
        }
        return best || { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) };
    }

    function plantNation(id, center) {
        var spots = [];
        var a, b;
        for (b = -2; b <= 2; b++) {
            for (a = -2; a <= 2; a++) {
                var cell = map[center.y + b] && map[center.y + b][center.x + a];
                if (!cell || !TERRAIN[cell.t].claim || cell.owner) continue;
                cell.owner = id;
                spots.push(cell);
            }
        }
        var banks = 0;
        for (var s = 0; s < spots.length && banks < 3; s++) {
            if (!spots[s].b) { spots[s].b = "bank"; banks++; }
        }
        if (spots[3] && !spots[3].b) spots[3].b = "farm";
        return spots.length;
    }

    var BOT_PRESETS = [
        { name: "Pine Republic", color: "#16a34a", c1: "#14532d", c2: "#bbf7d0", pattern: "stripes-h", stance: "avoid" },
        { name: "Amber Coast", color: "#d97706", c1: "#9a3412", c2: "#fde68a", pattern: "canton", stance: "grow" },
        { name: "Silver Hills", color: "#64748b", c1: "#1e293b", c2: "#e2e8f0", pattern: "cross", stance: "contest" }
    ];

    function addBots(count) {
        var homes = [];
        var meHome = findHomeSpot(null);
        homes.push(meHome);
        plantNation(state.me, meHome);
        selected = { x: meHome.x, y: meHome.y };
        cam.x = meHome.x * cam.z - 320;
        cam.y = meHome.y * cam.z - 200;
        for (var i = 0; i < count; i++) {
            var p = BOT_PRESETS[i % BOT_PRESETS.length];
            var bid = "bot_" + (i + 1);
            var spot = findHomeSpot(homes);
            homes.push(spot);
            state.nations[bid] = {
                id: bid, name: p.name, color: p.color,
                flag: { pattern: p.pattern, c1: p.c1, c2: p.c2 },
                isBot: true, isMe: false, stance: p.stance,
                res: emptyNationRes()
            };
            plantNation(bid, spot);
        }
    }

    function mergeServerRoom() {
        try {
            var room = JSON.parse(localStorage.getItem(ROOM_KEY) || "null");
            if (!room || !room.tiles || room.seed !== state.seed) return;
            if (room.nations) {
                Object.keys(room.nations).forEach(function (id) {
                    if (!state.nations[id]) state.nations[id] = room.nations[id];
                });
            }
            for (var j = 0; j < ROWS; j++) {
                for (var i = 0; i < COLS; i++) {
                    var s = room.tiles[j] && room.tiles[j][i];
                    if (!s) continue;
                    if (s.o && s.o !== state.me && !map[j][i].owner) {
                        map[j][i].owner = s.o;
                        map[j][i].b = s.b || map[j][i].b;
                    }
                }
            }
        } catch (e) {}
    }

    function startWorld(setup) {
        var seed = (Date.now() % 80000) + 1400;
        if (setup.mode === "server") {
            try {
                var room = JSON.parse(localStorage.getItem(ROOM_KEY) || "null");
                if (room && room.seed && Date.now() - (room.at || 0) < 1000 * 60 * 60 * 8) seed = room.seed;
            } catch (e) {}
        }
        state = defaultState(seed, setup);
        buildWorld(seed);
        addBots(setup.mode === "box" ? 3 : 2);
        mergeServerRoom();
        pushLog(setup.mode === "box"
            ? "Box world ready. Three other countries are on the map. Some stay away. Some may contest land."
            : "Server world ready. Other players can join this shared map. Bots fill empty space.");
        saveGame();
    }

    function ownedBy(id) {
        var n = 0, j, i;
        for (j = 0; j < ROWS; j++) for (i = 0; i < COLS; i++) if (map[j][i].owner === id) n++;
        return n;
    }
    function countB(id, kind) {
        var n = 0, j, i;
        for (j = 0; j < ROWS; j++) for (i = 0; i < COLS; i++) if (map[j][i].owner === id && map[j][i].b === kind) n++;
        return n;
    }
    function militaryOf(id) {
        return countB(id, "city") * 14 + countB(id, "house") * 1 + Math.floor(ownedBy(id) / 8);
    }
    function foodBuildings(id) {
        return countB(id, "farm") + countB(id, "grocery") + countB(id, "market");
    }
    function bboxOf(id) {
        var minX = COLS, minY = ROWS, maxX = -1, maxY = -1, j, i;
        for (j = 0; j < ROWS; j++) {
            for (i = 0; i < COLS; i++) {
                if (map[j][i].owner !== id) continue;
                if (i < minX) minX = i; if (i > maxX) maxX = i;
                if (j < minY) minY = j; if (j > maxY) maxY = j;
            }
        }
        if (maxX < 0) return null;
        return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
    }
    function priceOf(id) {
        var def = BUILDINGS[id];
        if (!def) return null;
        var buys = (state.res.buys && state.res.buys[id]) || 0;
        var mul = Math.pow(1.13, buys) * (state.res.economy || 1);
        var out = {};
        Object.keys(def.base).forEach(function (k) {
            out[k] = Math.ceil((def.base[k] || 0) * mul);
        });
        if (!out.money || out.money < 1) out.money = Math.max(8, Math.ceil(10 * mul));
        return out;
    }
    function claimCost() {
        return Math.max(8, Math.round(6 + ownedBy(state.me) * 0.85 * (state.res.economy || 1)));
    }
    function upkeepNow() {
        var tiles = ownedBy(state.me);
        var money = tiles * 0.45 * (state.res.economy || 1);
        var food = Math.max(0, (tiles - 8) * 0.12);
        money = Math.max(1, money - countB(state.me, "house") * 0.35 - countB(state.me, "city") * 1.2);
        var j, i, b, def;
        for (j = 0; j < ROWS; j++) {
            for (i = 0; i < COLS; i++) {
                if (map[j][i].owner !== state.me) continue;
                b = map[j][i].b;
                if (!b || !BUILDINGS[b]) continue;
                def = BUILDINGS[b];
                money += (def.upkeep.money || 0) * (state.res.economy || 1) * 0.65;
                food += def.upkeep.food || 0;
            }
        }
        return { money: money, food: food };
    }
    function canPay(cost) {
        return state.res.money >= (cost.money || 0) &&
            state.res.food >= (cost.food || 0) &&
            state.res.stone >= (cost.stone || 0) &&
            state.res.bricks >= (cost.bricks || 0) &&
            state.res.concrete >= (cost.concrete || 0);
    }
    function pay(cost) {
        state.res.money -= cost.money || 0;
        state.res.food -= cost.food || 0;
        state.res.stone -= cost.stone || 0;
        state.res.bricks -= cost.bricks || 0;
        state.res.concrete -= cost.concrete || 0;
    }
    function pushLog(msg) {
        if (!state.log) state.log = [];
        state.log.unshift(msg);
        if (state.log.length > 8) state.log.pop();
        var el = document.getElementById("llLog");
        if (el) el.textContent = state.log[0];
    }
    function neighborsOwner(x, y, id) {
        var d = [[1,0],[-1,0],[0,1],[0,-1]];
        for (var k = 0; k < 4; k++) {
            var nx = x + d[k][0], ny = y + d[k][1];
            if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && map[ny][nx].owner === id) return true;
        }
        return false;
    }

    function claimTile(x, y) {
        var c = map[y] && map[y][x];
        if (!c) return;
        selected = { x: x, y: y };
        if (c.owner === state.me) { paintUI(); return; }
        if (c.owner && c.owner !== state.me) { paintUI(); return; }
        if (!TERRAIN[c.t].claim) { pushLog("You cannot claim " + TERRAIN[c.t].name + "."); return; }
        if (!neighborsOwner(x, y, state.me)) { pushLog("Expand next to your own border."); return; }
        var cost = claimCost();
        if (state.res.money < cost) { pushLog("Need $" + cost + " to expand."); return; }
        state.res.money -= cost;
        c.owner = state.me;
        state.res.economy = Math.round((state.res.economy + 0.01) * 1000) / 1000;
        pushLog("Expanded for $" + cost + ".");
        saveGame();
        paintUI();
    }

    function contestTile() {
        if (!selected) return;
        var c = map[selected.y][selected.x];
        if (!c || !c.owner || c.owner === state.me) {
            pushLog("Pick a neighboring country's tile first.");
            return;
        }
        if (!neighborsOwner(selected.x, selected.y, state.me)) {
            pushLog("You can only contest a tile touching your border.");
            return;
        }
        var cost = Math.max(25, Math.round(18 + militaryOf(c.owner) * 1.4));
        if (state.res.money < cost) { pushLog("Contesting costs $" + cost + ". Not recommended if you are short on money."); return; }
        var mine = militaryOf(state.me);
        var theirs = militaryOf(c.owner) + 4;
        state.res.money -= cost;
        state.res.economy = Math.round((state.res.economy + 0.04) * 1000) / 1000;
        if (mine > theirs) {
            var old = c.owner;
            c.owner = state.me;
            pushLog("That border tile is now yours. " + ((state.nations[old] && state.nations[old].name) || "They") + " lost a tile. Contesting raised prices.");
        } else {
            pushLog("The contest failed. You spent $" + cost + " and they kept the tile. Building cities is the safer path.");
        }
        saveGame();
        paintUI();
        draw();
    }

    function buildOn(id) {
        if (!selected) { pushLog("Select a tile first."); return; }
        var c = map[selected.y][selected.x];
        if (c.owner !== state.me) { pushLog("Build only on your land."); return; }
        if (c.b) { pushLog("That tile already has something."); return; }
        var def = BUILDINGS[id];
        if (!def) return;
        if (def.canOn.indexOf(c.t) === -1) {
            pushLog(def.name + " cannot go on " + TERRAIN[c.t].name + ".");
            return;
        }
        var cost = priceOf(id);
        if (!canPay(cost)) { pushLog("Not enough resources. Every building still needs money."); paintUI(); return; }
        pay(cost);
        c.b = id;
        state.res.buys[id] = (state.res.buys[id] || 0) + 1;
        state.res.economy = Math.round((state.res.economy + 0.03) * 1000) / 1000;
        pushLog("Built " + def.name + ". Prices and the people's economy went up.");
        saveGame();
        paintUI();
        draw();
    }

    function botAct() {
        if (!state) return;
        Object.keys(state.nations).forEach(function (id) {
            var n = state.nations[id];
            if (!n || !n.isBot) return;
            var tiles = [];
            var j, i, c;
            for (j = 0; j < ROWS; j++) for (i = 0; i < COLS; i++) if (map[j][i].owner === id) tiles.push({ x: i, y: j });
            if (!tiles.length) return;
            var tries = n.stance === "contest" ? 3 : 2;
            while (tries--) {
                var t = tiles[Math.floor(Math.random() * tiles.length)];
                var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
                var d = dirs[Math.floor(Math.random() * 4)];
                var nx = t.x + d[0], ny = t.y + d[1];
                if (ny < 0 || ny >= ROWS || nx < 0 || nx >= COLS) continue;
                c = map[ny][nx];
                if (!TERRAIN[c.t].claim) continue;
                if (!c.owner) {
                    if (n.stance === "avoid" && Math.random() < 0.55) continue;
                    c.owner = id;
                    if (!c.b && Math.random() < 0.25) {
                        c.b = Math.random() < 0.5 ? "farm" : (Math.random() < 0.5 ? "grocery" : "city");
                    }
                    break;
                }
                if (n.stance === "contest" && c.owner === state.me && Math.random() < 0.12) {
                    if (militaryOf(id) > militaryOf(state.me)) {
                        c.owner = id;
                        pushLog((n.name || "A neighbor") + " took a border tile. Cities help you hold land.");
                    }
                }
            }
        });
    }

    function tick() {
        if (!state || !map.length) return;
        state.tick++;
        var out = { money: 0, food: 0, stone: 0, bricks: 0, concrete: 0 };
        var j, i, b, def, k;
        for (j = 0; j < ROWS; j++) {
            for (i = 0; i < COLS; i++) {
                if (map[j][i].owner !== state.me) continue;
                b = map[j][i].b;
                if (!b || !BUILDINGS[b]) continue;
                def = BUILDINGS[b];
                for (k in def.output) if (def.output.hasOwnProperty(k)) out[k] += def.output[k];
            }
        }
        out.money += countB(state.me, "city") * 6;
        var up = upkeepNow();
        state.res.money += out.money - up.money;
        state.res.food += out.food - up.food;
        state.res.stone += out.stone || 0;
        state.res.bricks += out.bricks || 0;
        state.res.concrete += out.concrete || 0;
        if (state.res.food < 0) { state.res.hungry++; state.res.food = 0; } else state.res.hungry = 0;
        if (state.res.money < 0) state.res.money = 0;
        if (state.res.hungry >= 3) loseOuterTile();
        if (state.tick % 2 === 0) botAct();
        if (state.tick % 3 === 0) saveGame();
        paintUI();
    }

    function loseOuterTile() {
        var edges = [];
        var j, i;
        for (j = 0; j < ROWS; j++) {
            for (i = 0; i < COLS; i++) {
                if (map[j][i].owner !== state.me) continue;
                var nOwn = 0;
                [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (d) {
                    var nx = i + d[0], ny = j + d[1];
                    if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && map[ny][nx].owner === state.me) nOwn++;
                });
                if (nOwn <= 2) edges.push({ x: i, y: j, n: nOwn, bank: map[j][i].b === "bank" });
            }
        }
        edges.sort(function (a, b) { return a.n - b.n; });
        for (var e = 0; e < edges.length; e++) {
            if (edges[e].bank && countB(state.me, "bank") <= 3) continue;
            var cell = map[edges[e].y][edges[e].x];
            cell.owner = null; cell.b = null;
            pushLog("A tile faded — build farms or groceries so people stay fed.");
            return;
        }
    }

    function tileFromEvent(ev) {
        var r = canvas.getBoundingClientRect();
        var x = ev.clientX - r.left, y = ev.clientY - r.top;
        var tx = Math.floor((x + cam.x) / cam.z);
        var ty = Math.floor((y + cam.y) / cam.z);
        if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return null;
        return { x: tx, y: ty };
    }
    function shade(rgb, h) {
        var s = 0.72 + h * 0.4;
        return "rgb(" + Math.round(rgb[0] * s) + "," + Math.round(rgb[1] * s) + "," + Math.round(rgb[2] * s) + ")";
    }

    function draw() {
        if (!canvas || !ctx || !map.length) return;
        anim++;
        var w = canvas.width, h = canvas.height;
        ctx.fillStyle = "#0b1b2e";
        ctx.fillRect(0, 0, w, h);
        var z = cam.z;
        var boxes = {};
        Object.keys(state.nations || {}).forEach(function (id) {
            boxes[id] = bboxOf(id);
        });
        var x0 = Math.max(0, Math.floor(cam.x / z) - 1);
        var y0 = Math.max(0, Math.floor(cam.y / z) - 1);
        var x1 = Math.min(COLS, Math.ceil((cam.x + w) / z) + 1);
        var y1 = Math.min(ROWS, Math.ceil((cam.y + h) / z) + 1);
        var i, j, c, px, py, nation, box, u, v, fc;
        for (j = y0; j < y1; j++) {
            for (i = x0; i < x1; i++) {
                c = map[j][i];
                px = i * z - cam.x; py = j * z - cam.y;
                ctx.fillStyle = shade(TERRAIN[c.t].color, c.h);
                ctx.fillRect(px, py, z + 0.6, z + 0.6);
                if (c.t === "forest" && z >= 14) {
                    ctx.fillStyle = "rgba(20,70,30,0.55)";
                    ctx.fillRect(px + z * 0.25, py + z * 0.2, z * 0.18, z * 0.18);
                }
                if (c.owner && state.nations[c.owner]) {
                    nation = state.nations[c.owner];
                    box = boxes[c.owner];
                    if (box) {
                        u = (i - box.minX + 0.5) / (box.maxX - box.minX + 1);
                        v = (j - box.minY + 0.5) / (box.maxY - box.minY + 1);
                        fc = flagColorAt(nation, u, v);
                        ctx.fillStyle = "rgba(" + fc[0] + "," + fc[1] + "," + fc[2] + ",0.42)";
                        ctx.fillRect(px, py, z + 0.6, z + 0.6);
                    }
                    ctx.strokeStyle = nation.color || "#f59e0b";
                    ctx.lineWidth = c.owner === state.me ? 2 : 1.5;
                    ctx.strokeRect(px + 0.6, py + 0.6, z - 1.2, z - 1.2);
                }
                if (c.b && BUILDINGS[c.b] && z >= 12) {
                    ctx.font = Math.max(10, z * 0.58) + "px sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(BUILDINGS[c.b].icon, px + z / 2, py + z / 2);
                }
            }
        }
        if (selected) {
            px = selected.x * z - cam.x; py = selected.y * z - cam.y;
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 1, py + 1, z - 2, z - 2);
        }
    }

    function fmt(n) { return String(Math.round(n * 10) / 10); }
    function costText(cost) {
        var bits = [];
        if (cost.money) bits.push("$" + cost.money);
        if (cost.food) bits.push(cost.food + " food");
        if (cost.stone) bits.push(cost.stone + " stone");
        if (cost.bricks) bits.push(cost.bricks + " bricks");
        if (cost.concrete) bits.push(cost.concrete + " concrete");
        return bits.join(" · ") || "$";
    }

    function paintUI() {
        if (!state) return;
        var set = function (id, v) {
            var el = document.getElementById(id);
            if (el) el.textContent = v;
        };
        var meN = state.nations[state.me];
        set("llNationName", meN ? meN.name : "Country");
        set("llModeTag", state.mode === "server" ? "Server" : "Box");
        set("llMoney", "$" + fmt(state.res.money));
        set("llFood", fmt(state.res.food));
        set("llStone", fmt(state.res.stone));
        set("llBricks", fmt(state.res.bricks));
        set("llConcrete", fmt(state.res.concrete));
        set("llTiles", String(ownedBy(state.me)));
        set("llEcon", Math.round(state.res.economy * 100) + "%");
        set("llMil", String(militaryOf(state.me)));
        set("llFoodBuild", String(foodBuildings(state.me)));
        var up = upkeepNow();
        set("llUpkeep", "$" + fmt(up.money) + " + " + fmt(up.food) + " food / cycle");
        var list = document.getElementById("llNations");
        if (list) {
            list.innerHTML = "";
            Object.keys(state.nations).forEach(function (id) {
                var n = state.nations[id];
                var row = document.createElement("div");
                row.className = "ll-nation-row";
                row.innerHTML = '<i style="background:' + n.color + '"></i><span>' +
                    (n.name || id) + (n.isMe ? " (you)" : (n.isBot ? " · bot" : " · player")) +
                    "</span><em>" + militaryOf(id) + " mil</em>";
                list.appendChild(row);
            });
        }
        var selBox = document.getElementById("llSelected");
        if (selBox) {
            if (!selected) selBox.textContent = "Click a tile.";
            else {
                var c = map[selected.y][selected.x];
                var who = c.owner && state.nations[c.owner] ? state.nations[c.owner].name : "Unclaimed";
                selBox.innerHTML = "<strong>" + TERRAIN[c.t].name + "</strong><br>" + who +
                    (c.b && BUILDINGS[c.b] ? "<br>" + BUILDINGS[c.b].icon + " " + BUILDINGS[c.b].name : "");
            }
        }
        var claimBtn = document.getElementById("llClaimCost");
        if (claimBtn) claimBtn.textContent = "Expand border · $" + claimCost();
        Object.keys(BUILDINGS).forEach(function (id) {
            var btn = document.getElementById("llBuild_" + id);
            if (!btn) return;
            var p = priceOf(id);
            var tag = btn.querySelector(".ll-price");
            if (tag) tag.textContent = costText(p);
            btn.classList.toggle("ll-cant", !canPay(p));
        });
        if (state.log && state.log[0]) {
            var log = document.getElementById("llLog");
            if (log) log.textContent = state.log[0];
        }
    }

    function loop() {
        draw();
        if (running) requestAnimationFrame(loop);
    }
    function bindCanvas() {
        canvas = document.getElementById("llCanvas");
        if (!canvas) return;
        ctx = canvas.getContext("2d");
        function fit() {
            var wrap = document.getElementById("llStage");
            if (!wrap) return;
            canvas.width = Math.max(320, wrap.clientWidth);
            canvas.height = Math.max(240, wrap.clientHeight);
        }
        fit();
        window.addEventListener("resize", fit);
        canvas.onmousedown = function (ev) {
            dragging = true; lastP.x = ev.clientX; lastP.y = ev.clientY;
        };
        window.addEventListener("mouseup", function () { dragging = false; });
        window.addEventListener("mousemove", function (ev) {
            if (!dragging) return;
            cam.x -= ev.clientX - lastP.x;
            cam.y -= ev.clientY - lastP.y;
            lastP.x = ev.clientX; lastP.y = ev.clientY;
        });
        canvas.onclick = function (ev) {
            var t = tileFromEvent(ev);
            if (!t) return;
            selected = t;
            var c = map[t.y][t.x];
            if (!c.owner) claimTile(t.x, t.y);
            else paintUI();
            draw();
        };
        canvas.onwheel = function (ev) {
            ev.preventDefault();
            var old = cam.z;
            cam.z = Math.max(8, Math.min(36, cam.z + (ev.deltaY > 0 ? -2 : 2)));
            cam.x *= cam.z / old; cam.y *= cam.z / old;
        };
        canvas.oncontextmenu = function (ev) { ev.preventDefault(); };
    }
    function showSetup(on) {
        var s = document.getElementById("llSetup");
        var g = document.getElementById("llGame");
        if (s) s.style.display = on ? "flex" : "none";
        if (g) g.style.display = on ? "none" : "flex";
    }
    function startTicks() {
        if (tickTimer) clearInterval(tickTimer);
        tickTimer = setInterval(tick, TICK_MS);
        running = true;
        requestAnimationFrame(loop);
    }

    window.openLivingLands = function () {
        var ov = document.getElementById("livingLandsOverlay");
        if (!ov) return;
        ov.style.display = "flex";
        if (loadGame()) {
            showSetup(false);
            bindCanvas();
            paintUI();
            startTicks();
        } else {
            showSetup(true);
            running = false;
        }
    };
    window.closeLivingLands = function () {
        if (state) saveGame();
        running = false;
        if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
        var ov = document.getElementById("livingLandsOverlay");
        if (ov) ov.style.display = "none";
    };
    window.llBegin = function (mode) {
        var name = ((document.getElementById("llNameInput") || {}).value || "").trim() || "My Country";
        var color = ((document.getElementById("llColorInput") || {}).value) || "#f59e0b";
        var c1 = ((document.getElementById("llFlagC1") || {}).value) || "#1d4ed8";
        var c2 = ((document.getElementById("llFlagC2") || {}).value) || "#f8fafc";
        var pattern = ((document.getElementById("llFlagPattern") || {}).value) || "stripes-h";
        startWorld({ mode: mode, name: name, color: color, c1: c1, c2: c2, pattern: pattern });
        showSetup(false);
        bindCanvas();
        paintUI();
        startTicks();
    };
    window.llBuild = buildOn;
    window.llClaimSelected = function () {
        if (!selected) return;
        claimTile(selected.x, selected.y);
    };
    window.llContest = contestTile;
    window.llNewMap = function () {
        if (!confirm("Start a new country? This save will be replaced.")) return;
        try { localStorage.removeItem(saveKey()); } catch (e) {}
        running = false;
        if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
        showSetup(true);
    };
})();
