/* Living Lands — tiny-pixel Earth painter + country sim */
(function () {
    var W = 360;
    var H = 180;
    var MAX_COUNTRIES = 180;
    var MAX_NOTES = 20;
    var MAX_CITIES = 360;
    var TICK_MS = 50;
    var SAVE_KEY = "azoraPixelEarthV2";

    var ELEV_COLOR = [
        [255, 255, 255],
        [212, 212, 212],
        [176, 176, 176],
        [138, 138, 138],
        [90, 90, 90],
        [17, 17, 17]
    ];
    var CITY_NAMES = ["Riverton","Oakvale","Greyport","Ashfield","Northmere","Kelwick","Dunhollow","Brightfen","Stoneford","Miregate","Calder","Pinesend","Lowmarsh","Highcliff","Amberly","Frosthaven","Redmill","Silverow","Westray","Norbrook","Elmstead","Cape Hollow","Littleford","Ironmere"];

    var elev = new Uint8Array(W * H);
    var owner = new Uint16Array(W * H);
    var cityOwn = new Uint16Array(W * H);
    var countries = [];
    var cities = [];
    var crafts = [];
    var nextId = 1;
    var nextCity = 1;
    var selectedId = 0;
    var mode = "edit";
    var notes = [];
    var snapshot = null;
    var tickTimer = null;
    var canvas, ctx, overlay;
    var painting = false;
    var lastPaint = { x: -1, y: -1 };
    var tool = "paint";
    var landCache = {};
    var simTick = 0;
    var cityRebuildTimer = null;
    var dirtyDraw = true;
    var landAge = new Uint16Array(W * H);

    function idx(x, y) { return y * W + x; }
    var mapPix = new Uint8ClampedArray(W * H * 4);
    var currentWorldMap = "blobs";
    var WORLD_MAPS = {
        blobs: [
            "earth-blobs-360x180.png",
            "earth-360x180.png",
            "map.png"
        ],
        realistic: [
            "earth-realistic-360x180.png",
            "earth-realistic-360x180-preview4x.png",
            "map2.png"
        ],
        countries: [
            "earth-countries-360x180.png"
        ]
    };
    var WORLD_MAP_DATA = {
        blobs: "data:image/png;base64,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",
        realistic: "data:image/png;base64,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"
    };

    function levelFromRgb(r, g, b) {
        var l = (r + g + b) / 3;
        if (l >= 242) return 0;
        if (l >= 194) return 1;
        if (l >= 154) return 2;
        if (l >= 112) return 3;
        if (l >= 52) return 4;
        return 5;
    }
    function applyImageToMap(img) {
        var off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        var octx = off.getContext("2d");
        octx.imageSmoothingEnabled = false;
        if (octx.webkitImageSmoothingEnabled !== undefined) octx.webkitImageSmoothingEnabled = false;
        if (octx.mozImageSmoothingEnabled !== undefined) octx.mozImageSmoothingEnabled = false;
        octx.clearRect(0, 0, W, H);
        octx.drawImage(img, 0, 0, W, H);
        var data = octx.getImageData(0, 0, W, H).data;
        mapPix.set(data);
        var i, p;
        for (i = 0; i < W * H; i++) {
            p = i * 4;
            elev[i] = levelFromRgb(data[p], data[p + 1], data[p + 2]);
        }
    }
    function loadImageSrc(src, ok, fail) {
        var im = new Image();
        im.onload = function () { ok(im); };
        im.onerror = fail;
        im.src = src;
    }
    function unpackU16(b64, into) {
        var bin = atob(b64);
        var i, n = Math.min(into.length, (bin.length / 2) | 0);
        for (i = 0; i < n; i++) into[i] = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8);
    }
    function applyPoliticalWorld() {
        var data = window.LL_POLITICAL;
        if (!data || !data.countries) {
            addNote("Country map image loaded, but political data file is missing.");
            return;
        }
        unpackU16(data.owner, owner);
        unpackU16(data.cityOwn, cityOwn);
        countries = data.countries.map(function (c) {
            return {
                id: c.id,
                name: c.name,
                fill: c.fill,
                stroke: c.stroke || "#111111",
                money: c.money || 100,
                military: c.military || 8,
                banks: c.banks || 3,
                farms: c.farms || 2,
                cities: c.cities || 2,
                diamonds: c.diamonds || 0,
                shield: 0,
                broke: false
            };
        });
        cities = (data.provinces || []).map(function (p) {
            return { id: p.id, name: p.name, country: p.country, x: p.x || 0, y: p.y || 0 };
        });
        nextId = 1;
        nextCity = 1;
        countries.forEach(function (c) { if (c.id >= nextId) nextId = c.id + 1; });
        cities.forEach(function (p) { if (p.id >= nextCity) nextCity = p.id + 1; });
        selectedId = countries[0] ? countries[0].id : 0;
        refreshLandCache();
    }
    function loadWorldMap(kind, done) {
        if (kind !== "realistic" && kind !== "countries") kind = "blobs";
        currentWorldMap = kind;
        var list = (WORLD_MAPS[kind] || []).slice();
        list.push(WORLD_MAP_DATA[kind]);
        function next() {
            if (!list.length) {
                if (typeof done === "function") done(false);
                return;
            }
            var src = list.shift();
            if (src.indexOf("data:") !== 0 && src.indexOf("?") < 0) src = src + "?v=72.13";
            loadImageSrc(src, function (im) {
                applyImageToMap(im);
                if (typeof done === "function") done(true);
            }, next);
        }
        next();
    }
    function expandChance(tileElev) {
        return Math.max(0.08, 0.95 - (tileElev || 0) * 0.17);
    }
    function hexToRgb(hex) {
        hex = String(hex || "#ef4444").replace("#", "");
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        var n = parseInt(hex, 16);
        if (isNaN(n)) n = 0xef4444;
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function defaultCountry(name) {
        var fills = ["#ef4444","#3b82f6","#22c55e","#eab308","#a855f7","#06b6d4","#f97316","#ec4899"];
        return {
            id: nextId++,
            name: name || ("Country " + (countries.length + 1)),
            fill: fills[(nextId - 2) % fills.length],
            stroke: "#111111",
            money: 100,
            military: 10,
            banks: 3,
            farms: 2,
            cities: 2,
            diamonds: 0
        };
    }
    function findCountry(id) {
        for (var i = 0; i < countries.length; i++) if (countries[i].id === id) return countries[i];
        return null;
    }
    function findCity(id) {
        for (var i = 0; i < cities.length; i++) if (cities[i].id === id) return cities[i];
        return null;
    }
    function addNote(text) {
        notes.unshift({ text: String(text || "") });
        if (notes.length > MAX_NOTES) notes.pop();
        var box = document.getElementById("llNotes");
        if (!box) return;
        box.innerHTML = notes.map(function (n) {
            return "<div>" + n.text.replace(/</g, "") + "</div>";
        }).join("");
    }
    function canvasPoint(ev) {
        var target = overlay || canvas;
        var r = target.getBoundingClientRect();
        var x = Math.floor((ev.clientX - r.left) / r.width * W);
        var y = Math.floor((ev.clientY - r.top) / r.height * H);
        if (x < 0 || y < 0 || x >= W || y >= H) return null;
        return { x: x, y: y };
    }
    function brushSize() {
        var el = document.getElementById("llBrush");
        var n = el ? parseInt(el.value, 10) : 2;
        if (isNaN(n)) n = 2;
        return Math.max(1, Math.min(6, n));
    }
    function paintAt(x, y) {
        if (mode !== "edit") return;
        var r = brushSize(), i, j, dx, dy, p, c;
        if (tool !== "erase") {
            if (!selectedId) return;
            c = findCountry(selectedId);
            if (!c) return;
        }
        for (j = -r; j <= r; j++) {
            for (i = -r; i <= r; i++) {
                if (i * i + j * j > r * r) continue;
                dx = x + i; dy = y + j;
                if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue;
                p = idx(dx, dy);
                if (elev[p] === 0) continue;
                if (tool === "erase") {
                    owner[p] = 0;
                    cityOwn[p] = 0;
                } else {
                    owner[p] = c.id;
                    landAge[p] = 0;
                }
            }
        }
        if (tool !== "erase" && currentWorldMap !== "countries") scheduleCityRebuild();
    }
    function scheduleCityRebuild() {
        if (cityRebuildTimer) clearTimeout(cityRebuildTimer);
        cityRebuildTimer = setTimeout(function () {
            fillCitiesInsideCountries();
            dirtyDraw = true;
            draw();
        }, 160);
    }
    function takeSnapshot() {
        snapshot = {
            owner: new Uint16Array(owner),
            cityOwn: new Uint16Array(cityOwn),
            countries: JSON.parse(JSON.stringify(countries)),
            cities: JSON.parse(JSON.stringify(cities)),
            nextId: nextId,
            nextCity: nextCity,
            selectedId: selectedId
        };
    }
    function restoreSnapshot() {
        if (!snapshot) return;
        owner.set(snapshot.owner);
        cityOwn.set(snapshot.cityOwn);
        countries = JSON.parse(JSON.stringify(snapshot.countries));
        cities = JSON.parse(JSON.stringify(snapshot.cities));
        nextId = snapshot.nextId;
        nextCity = snapshot.nextCity;
        selectedId = snapshot.selectedId;
        crafts = [];
        notes = [];
        var box = document.getElementById("llNotes");
        if (box) box.innerHTML = "";
        addNote("Stopped. Map restored to how it was before Play.");
    }
    function refreshLandCache() {
        landCache = {};
        var i, id;
        for (i = 0; i < W * H; i++) {
            id = owner[i];
            if (id) landCache[id] = (landCache[id] || 0) + 1;
        }
    }
    function landCount(id) {
        if (landCache[id] != null) return landCache[id];
        var n = 0, i;
        for (i = 0; i < W * H; i++) if (owner[i] === id) n++;
        landCache[id] = n;
        return n;
    }
    function upkeepOf(c) {
        return Math.max(2, Math.floor(landCount(c.id) * 0.4));
    }
    function canDefend(c) {
        if (!c) return false;
        if ((c.shield || 0) > 0) return true;
        return (Number(c.money) || 0) >= upkeepOf(c) + 12;
    }
    function canGrow(c) {
        if (!c) return false;
        return (Number(c.money) || 0) > upkeepOf(c);
    }
    function markBroke(c, broke) {
        if (!c) return;
        if (broke && !c.broke) addNote(c.name + " is too poor to defend.");
        if (!broke && c.broke) {
            c.shield = 8 + ((Math.random() * 36) | 0);
            addNote(c.name + " can defend again.");
        }
        c.broke = !!broke;
    }
    function provinceCount(id) {
        var n = 0, i;
        for (i = 0; i < W * H; i++) if (cityOwn[i] === id) n++;
        return n;
    }
    function power(c) {
        if (!c) return 0;
        return (Number(c.military) || 0) * 3 + (Number(c.cities) || 0) * 2 + (Number(c.money) || 0) * 0.03 + (Number(c.banks) || 0) + (Number(c.farms) || 0) + landCount(c.id) * 0.08;
    }
    function defense(c) {
        if (!c) return 4;
        return 8 + (Number(c.military) || 0) * 4 + (Number(c.cities) || 0) + landCount(c.id) * 0.05;
    }
    function provincePower(pr) {
        if (!pr) return 0;
        return 4 + provinceCount(pr.id) * 0.2;
    }
    function randomCityName() {
        return CITY_NAMES[(Math.random() * CITY_NAMES.length) | 0] + " Province";
    }
    function fillCitiesInsideCountries() {
        if (currentWorldMap === "countries") return;
        cityOwn.fill(0);
        var next = [];
        countries.forEach(function (c) {
            var want = Math.max(0, Math.min(8, Number(c.cities) || 0));
            if (want < 1) return;
            var mine = cities.filter(function (city) { return city.country === c.id; });
            while (mine.length > want) mine.pop();
            while (mine.length < want && next.length + mine.length < MAX_CITIES) {
                mine.push({ id: nextCity++, name: randomCityName(), country: c.id, x: 2, y: 2 });
            }
            var spots = [];
            var i, p, x, y, best, bi, n;
            for (i = 0; i < W * H; i++) if (owner[i] === c.id && elev[i]) spots.push(i);
            if (!spots.length) {
                mine.forEach(function (city) { next.push(city); });
                return;
            }
            for (n = 0; n < mine.length; n++) {
                p = spots[Math.floor((n + 0.35) * spots.length / mine.length) % spots.length];
                mine[n].x = p % W;
                mine[n].y = (p / W) | 0;
            }
            for (i = 0; i < spots.length; i++) {
                p = spots[i];
                x = p % W; y = (p / W) | 0;
                best = mine[0]; bi = 1e9;
                for (n = 0; n < mine.length; n++) {
                    var d = Math.abs(mine[n].x - x) + Math.abs(mine[n].y - y);
                    if (d < bi) { bi = d; best = mine[n]; }
                }
                cityOwn[p] = best.id;
            }
            mine.forEach(function (city) { next.push(city); });
        });
        cities = next;
    }
    function spawnCities() { fillCitiesInsideCountries(); }
    function tryFightBack(loserId, winnerId, atX, atY) {
        var loser = findCountry(loserId);
        var winner = findCountry(winnerId);
        if (!loser || !winner) return;
        if (!canDefend(loser)) return;
        if (power(winner) > power(loser)) {
            if (Math.random() < 0.12) addNote(loser.name + " tried to fight back, but " + winner.name + " was stronger.");
            return;
        }
        var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
        var k, nx, ny, np;
        for (k = 0; k < 4; k++) {
            nx = atX + dirs[k][0]; ny = atY + dirs[k][1];
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            np = idx(nx, ny);
            if (elev[np] === 0) continue;
            if (owner[np] !== winnerId) continue;
            owner[np] = loserId;
            cityOwn[np] = 0;
            landAge[np] = 0;
            if (Math.random() < 0.2) addNote(loser.name + " fought back and took a tile from " + winner.name);
            return;
        }
    }
    function cityTick() {
        if (!cities.length) return;
        var dirs = [1, -1, W, -W];
        var steps = Math.min(220, 30 + cities.length * 10);
        var s, p, q, d, x, cid, oid, a, b, atk, def;
        for (s = 0; s < steps; s++) {
            p = (Math.random() * W * H) | 0;
            cid = cityOwn[p];
            if (!cid) continue;
            a = findCity(cid);
            if (!a || owner[p] !== a.country) continue;
            d = dirs[(Math.random() * 4) | 0];
            q = p + d;
            if (q < 0 || q >= W * H) continue;
            x = p % W;
            if (d === 1 && x === W - 1) continue;
            if (d === -1 && x === 0) continue;
            if (elev[q] === 0) continue;
            if (owner[q] !== a.country) continue;
            if (landAge[q] < 8) continue;
            oid = cityOwn[q];
            if (!oid) {
                if (Math.random() < expandChance(elev[q])) cityOwn[q] = cid;
            } else if (oid !== cid) {
                b = findCity(oid);
                if (!b || b.country !== a.country) continue;
                atk = provincePower(a) + Math.random() * 4;
                def = provincePower(b) + Math.random() * 4;
                if (atk > def) {
                    cityOwn[q] = cid;
                    if (Math.random() < 0.06) addNote(a.name + " has invaded " + b.name);
                    if (provincePower(a) > provincePower(b)) {
                        if (Math.random() < 0.08) addNote(b.name + " tried to fight back, but " + a.name + " was stronger.");
                    } else if (Math.random() < 0.25) {
                        cityOwn[p] = oid;
                        if (Math.random() < 0.15) addNote(b.name + " fought back against " + a.name);
                    }
                } else if (Math.random() < 0.12) {
                    addNote(b.name + " resisted " + a.name);
                }
            }
        }
    }
    function spawnCraft(fromC, sx, sy) {
        if (crafts.length > 40) return;
        var types = ["ship", "plane", "sub"];
        var type = types[(Math.random() * 3) | 0];
        var t, tx, ty, p, tries;
        for (tries = 0; tries < 30; tries++) {
            tx = (Math.random() * W) | 0;
            ty = (Math.random() * H) | 0;
            p = idx(tx, ty);
            if (elev[p] && owner[p] !== fromC.id) {
                crafts.push({ type: type, x: sx + 0.5, y: sy + 0.5, tx: tx + 0.5, ty: ty + 0.5, from: fromC.id });
                if (Math.random() < 0.25) addNote(fromC.name + " sent a " + type + " across the water.");
                return;
            }
        }
    }
    function maybeLaunchCrafts() {
        if (crafts.length > 36) return;
        countries.forEach(function (c) {
            if (Math.random() > 0.35) return;
            var i, x, y, p, n;
            for (i = 0; i < 24; i++) {
                p = (Math.random() * W * H) | 0;
                if (owner[p] !== c.id) continue;
                x = p % W; y = (p / W) | 0;
                n = (x>0 && elev[p-1]===0) || (x<W-1 && elev[p+1]===0) || (y>0 && elev[p-W]===0) || (y<H-1 && elev[p+W]===0);
                if (n) { spawnCraft(c, x, y); return; }
            }
        });
    }
    function moveCrafts() {
        var keep = [];
        crafts.forEach(function (cr) {
            var dx = cr.tx - cr.x, dy = cr.ty - cr.y;
            var dist = Math.sqrt(dx * dx + dy * dy) || 1;
            var spd = cr.type === "plane" ? 2.4 : (cr.type === "sub" ? 1.1 : 1.6);
            cr.x += dx / dist * spd;
            cr.y += dy / dist * spd;
            if (dist < 2.2) {
                var px = Math.max(0, Math.min(W - 1, cr.tx | 0));
                var py = Math.max(0, Math.min(H - 1, cr.ty | 0));
                var p = idx(px, py);
                var me = findCountry(cr.from);
                if (elev[p] && me) {
                    var them = findCountry(owner[p]);
                    var atk = power(me) + Math.random() * 10;
                    var def = them ? defense(them) + Math.random() * 8 : 3;
                    if (!owner[p] || atk > def) {
                        owner[p] = me.id;
                        if (them && Math.random() < 0.4) addNote(me.name + " landed and took ground from " + them.name);
                    } else if (them && Math.random() < 0.3) {
                        addNote(them.name + " military stopped a " + cr.type);
                    }
                }
            } else keep.push(cr);
        });
        crafts = keep;
    }
    function bankTick() {
        refreshLandCache();
        countries.forEach(function (c) {
            if (c.shield) c.shield = Math.max(0, c.shield - 1);
            var banks = Number(c.banks) || 0;
            var farms = Number(c.farms) || 0;
            var size = landCount(c.id);
            var income = banks * 6 + farms * 2;
            var cost = upkeepOf(c);
            c.money = (Number(c.money) || 0) + income - cost;
            if (c.money < 0) c.money = 0;
            if (banks && Math.random() < Math.min(0.35, banks * 0.04)) {
                c.diamonds = (Number(c.diamonds) || 0) + 1;
            }
            if (size <= 0) {
                if (!c.collapsed) {
                    c.collapsed = true;
                    addNote(c.name + " has collapsed.");
                }
                markBroke(c, true);
                return;
            }
            c.collapsed = false;
            var poor = c.money < cost + 10;
            markBroke(c, poor);
            if (!poor && c.money >= cost + 28 && !c.shield) {
                c.shield = 10 + ((Math.random() * 40) | 0);
            }
        });
    }
    function tickSim() {
        if (mode !== "play" || !countries.length) return;
        simTick++;
        var dirs = [1, -1, W, -W];
        refreshLandCache();
        var attempts = Math.min(420, 90 + Math.min(80, countries.length) * 4);
        var k, p, q, x, cid, oid, me, them, d;
        for (k = 0; k < attempts; k++) {
            p = (Math.random() * W * H) | 0;
            cid = owner[p];
            if (!cid || elev[p] === 0) continue;
            d = dirs[(Math.random() * 4) | 0];
            q = p + d;
            if (q < 0 || q >= W * H) continue;
            x = p % W;
            if (d === 1 && x === W - 1) continue;
            if (d === -1 && x === 0) continue;
            if (elev[q] === 0) continue;
            oid = owner[q];
            if (oid === cid) continue;
            me = findCountry(cid);
            if (!me) continue;
            if (!canGrow(me)) continue;
            if (!oid) {
                if (Math.random() < expandChance(elev[q])) { owner[q] = cid; landAge[q] = 0; landCache[cid] = (landCache[cid] || 0) + 1; }
            } else {
                them = findCountry(oid);
                if (!them) continue;
                var atk = power(me) + Math.random() * 6;
                var def = defense(them) + elev[q] * 3 + Math.random() * 6;
                if (!canDefend(them)) { atk += 10; def *= 0.25; }
                if (atk > def) {
                    owner[q] = cid;
                    landAge[q] = 0;
                    cityOwn[q] = 0;
                    landCache[cid] = (landCache[cid] || 0) + 1;
                    landCache[them.id] = Math.max(0, (landCache[them.id] || 1) - 1);
                    if (Math.random() < (canDefend(them) ? 0.06 : 0.14)) addNote(me.name + " has invaded " + them.name);
                    if (canDefend(them)) tryFightBack(them.id, me.id, q % W, (q / W) | 0);
                } else if (canDefend(them) && Math.random() < 0.06) {
                    addNote(them.name + " resisted " + me.name);
                }
            }
        }
        if (simTick % 2 === 0) {
            for (k = 0; k < W * H; k++) if (owner[k] && landAge[k] < 40) landAge[k]++;
        }
        if (simTick % 2 === 0) cityTick();
        if (simTick % 8 === 0) maybeLaunchCrafts();
        moveCrafts();
        if (simTick % 8 === 0) bankTick();
        if (simTick % 2 === 0) draw();
    }
    function draw() {
        if (!canvas || !ctx) return;
        var img = ctx.createImageData(W, H);
        var data = img.data;
        var i, p, e, col, c, rgb, city, x, y, border;
        for (i = 0; i < W * H; i++) {
            p = i * 4;
            p = i * 4;
            col = [mapPix[p], mapPix[p + 1], mapPix[p + 2]];
            if (!mapPix[p + 3]) col = [255, 255, 255];
            if (owner[i]) {
                c = findCountry(owner[i]);
                if (c) {
                    rgb = hexToRgb(c.fill);
                    col = [(col[0]*0.25+rgb[0]*0.75)|0,(col[1]*0.25+rgb[1]*0.75)|0,(col[2]*0.25+rgb[2]*0.75)|0];
                    x = i % W; y = (i / W) | 0;
                    border = (x===0||owner[i-1]!==owner[i]) || (x===W-1||owner[i+1]!==owner[i]) || (y===0||owner[i-W]!==owner[i]) || (y===H-1||owner[i+W]!==owner[i]);
                    if (border) col = hexToRgb(c.stroke);
                }
            }
            if (cityOwn[i]) {
                x = i % W; y = (i / W) | 0;
                var shade = (cityOwn[i] % 3) * 18;
                col = [
                    Math.max(0, col[0] - 18 + shade),
                    Math.max(0, col[1] - 12 + shade),
                    Math.max(0, col[2] - 18 + shade)
                ];
                border = (x===0||cityOwn[i-1]!==cityOwn[i]) || (x===W-1||cityOwn[i+1]!==cityOwn[i]) || (y===0||cityOwn[i-W]!==cityOwn[i]) || (y===H-1||cityOwn[i+W]!==cityOwn[i]);
                if (border) col = [70, 70, 70];
            }
            data[p] = col[0]; data[p+1] = col[1]; data[p+2] = col[2]; data[p+3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        if (overlay) {
            var octx = overlay.getContext("2d");
            octx.imageSmoothingEnabled = false;
            if (octx.webkitImageSmoothingEnabled !== undefined) octx.webkitImageSmoothingEnabled = false;
            if (octx.mozImageSmoothingEnabled !== undefined) octx.mozImageSmoothingEnabled = false;
        if (ctx.webkitImageSmoothingEnabled !== undefined) ctx.webkitImageSmoothingEnabled = false;
        if (ctx.mozImageSmoothingEnabled !== undefined) ctx.mozImageSmoothingEnabled = false;
            octx.clearRect(0, 0, overlay.width, overlay.height);
            octx.drawImage(canvas, 0, 0, overlay.width, overlay.height);
            var sx = overlay.width / W, sy = overlay.height / H;
            octx.font = "10px sans-serif";
            octx.textAlign = "center";
            octx.font = "bold 11px sans-serif";
            if (cities.length <= 28) {
            cities.forEach(function (city) {
                var px = city.x * sx, py = city.y * sy;
                octx.fillStyle = "rgba(255,255,255,0.8)";
                octx.fillRect(px - 3, py - 3, 6, 6);
                octx.strokeStyle = "#111";
                octx.strokeRect(px - 3, py - 3, 6, 6);
                octx.fillStyle = "#111";
                octx.fillText(city.name, px, py - 6);
            });
            }
            crafts.forEach(function (cr) {
                octx.fillStyle = cr.type === "plane" ? "#0f172a" : (cr.type === "sub" ? "#334155" : "#1e3a8a");
                octx.fillRect(cr.x * sx - 2, cr.y * sy - 2, 4, 4);
            });
        }
    }
    function setMode(next) {
        mode = next;
        var locked = next !== "edit";
        document.querySelectorAll(".ll-edit-only").forEach(function (el) { el.disabled = locked; });
        var tag = document.getElementById("llSimTag");
        if (tag) tag.textContent = next === "play" ? "Playing" : (next === "pause" ? "Paused" : "Editing");
    }
    function startTicks() {
        if (tickTimer) clearInterval(tickTimer);
        tickTimer = setInterval(function () { if (mode === "play") tickSim(); }, TICK_MS);
    }
    function renderCountryList() {
        var box = document.getElementById("llCountryList");
        if (!box) return;
        box.innerHTML = "";
        countries.forEach(function (c) {
            var row = document.createElement("div");
            row.className = "ll-c-row" + (c.id === selectedId ? " on" : "");
            row.innerHTML =
                '<button type="button" class="ll-c-swatch" style="background:' + c.fill + ';box-shadow:0 0 0 2px ' + c.stroke + ' inset"></button>' +
                '<input class="ll-edit-only" maxlength="18" value="' + String(c.name).replace(/"/g, "") + '">' +
                '<span>💎' + (c.diamonds || 0) + '</span>';
            row.querySelector(".ll-c-swatch").onclick = function () {
                selectedId = c.id; syncEditorFromCountry(); renderCountryList();
            };
            row.querySelector("input").oninput = function () {
                if (mode === "edit") c.name = row.querySelector("input").value || c.name;
            };
            box.appendChild(row);
        });
        setMode(mode);
        var dia = document.getElementById("llDiamondsHud");
        if (dia) {
            var sum = 0;
            countries.forEach(function (c) { sum += Number(c.diamonds) || 0; });
            dia.textContent = String(sum);
        }
    }
    function syncEditorFromCountry() {
        var c = findCountry(selectedId);
        if (!c) return;
        function val(id, v) { var el = document.getElementById(id); if (el) el.value = v; }
        val("llFill", c.fill); val("llStroke", c.stroke); val("llActiveName", c.name);
        val("llStartMoney", c.money); val("llStartMil", c.military);
        val("llStartBanks", c.banks); val("llStartFarms", c.farms);
        val("llStartCities", c.cities);
    }
    function applyEditorToCountry() {
        var c = findCountry(selectedId);
        if (!c || mode !== "edit") return;
        c.fill = (document.getElementById("llFill") || {}).value || c.fill;
        c.stroke = (document.getElementById("llStroke") || {}).value || c.stroke;
        c.name = ((document.getElementById("llActiveName") || {}).value || c.name).slice(0, 18);
        c.money = Number((document.getElementById("llStartMoney") || {}).value) || 0;
        c.military = Number((document.getElementById("llStartMil") || {}).value) || 0;
        c.banks = Number((document.getElementById("llStartBanks") || {}).value) || 0;
        c.farms = Number((document.getElementById("llStartFarms") || {}).value) || 0;
        c.cities = Number((document.getElementById("llStartCities") || {}).value) || 0;
        fillCitiesInsideCountries();
        renderCountryList();
        draw();
    }
    function saveMap() {
        applyEditorToCountry();
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify({
                countries: countries, nextId: nextId, selectedId: selectedId, owner: Array.from(owner)
            }));
            addNote("Map saved.");
        } catch (e) { addNote("Could not save."); }
    }
    function loadMap() {
        try {
            var raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
            if (!raw || !raw.owner) return false;
            countries = raw.countries || [];
            countries.forEach(function (c) {
                if (c.cities == null) c.cities = 2;
                if (c.diamonds == null) c.diamonds = 0;
            });
            nextId = raw.nextId || (countries.length + 1);
            selectedId = raw.selectedId || (countries[0] && countries[0].id) || 0;
            owner = new Uint16Array(raw.owner);
            fillCitiesInsideCountries();
            return true;
        } catch (e) { return false; }
    }
    function fitOverlay() {
        if (!overlay) return;
        var wrap = document.getElementById("llStage");
        if (!wrap) return;
        overlay.width = Math.max(320, wrap.clientWidth);
        overlay.height = Math.max(180, wrap.clientHeight);
        draw();
    }
    function bind() {
        canvas = document.getElementById("llCanvas");
        overlay = document.getElementById("llView");
        if (!canvas) return;
        canvas.width = W; canvas.height = H;
        ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.imageSmoothingEnabled = false;
        if (ctx.webkitImageSmoothingEnabled !== undefined) ctx.webkitImageSmoothingEnabled = false;
        if (ctx.mozImageSmoothingEnabled !== undefined) ctx.mozImageSmoothingEnabled = false;
        fitOverlay();
        window.addEventListener("resize", fitOverlay);
        function down(ev) {
            if (mode !== "edit") return;
            var t = canvasPoint(ev); if (!t) return;
            painting = true; lastPaint = t; paintAt(t.x, t.y); draw();
        }
        function move(ev) {
            if (!painting || mode !== "edit") return;
            var t = canvasPoint(ev); if (!t) return;
            var steps = Math.max(Math.abs(t.x-lastPaint.x), Math.abs(t.y-lastPaint.y), 1);
            for (var s = 0; s <= steps; s++) {
                paintAt(Math.round(lastPaint.x + (t.x-lastPaint.x)*s/steps), Math.round(lastPaint.y + (t.y-lastPaint.y)*s/steps));
            }
            lastPaint = t; draw();
        }
        function up() { painting = false; if (mode === "edit") scheduleCityRebuild(); }
        if (overlay) {
            overlay.onmousedown = down;
            overlay.onmousemove = move;
            window.addEventListener("mouseup", up);
            overlay.oncontextmenu = function (ev) { ev.preventDefault(); };
        }
        ["llFill","llStroke","llActiveName","llStartMoney","llStartMil","llStartBanks","llStartFarms","llStartCities"].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.onchange = applyEditorToCountry;
        });
    }

    window.openLivingLands = function () {
        var ov = document.getElementById("livingLandsOverlay");
        if (!ov) return;
        ov.style.display = "flex";
        var sel = document.getElementById("llWorldMap");
        if (sel) sel.value = currentWorldMap;
        if (!countries.length && !loadMap()) {
            var first = defaultCountry("Red");
            countries.push(first);
            selectedId = first.id;
        }
        bind();
        setMode("edit");
        renderCountryList();
        syncEditorFromCountry();
        loadWorldMap(currentWorldMap, function () {
            if (currentWorldMap === "countries") applyPoliticalWorld();
            else fillCitiesInsideCountries();
            renderCountryList();
            syncEditorFromCountry();
            draw();
        });
        startTicks();
    };
    window.llSetTool = function (name) {
        tool = name === "erase" ? "erase" : "paint";
        var p = document.getElementById("llToolPaint");
        var e = document.getElementById("llToolErase");
        if (p) p.classList.toggle("on", tool === "paint");
        if (e) e.classList.toggle("on", tool === "erase");
    };
    window.llSetWorldMap = function (kind) {
        if (mode !== "edit") return;
        loadWorldMap(kind, function () {
            if (kind === "countries") {
                applyPoliticalWorld();
                addNote("Real countries map loaded.");
            } else {
                owner.fill(0);
                cityOwn.fill(0);
                cities = [];
                countries = [defaultCountry("Red")];
                selectedId = countries[0].id;
                fillCitiesInsideCountries();
                addNote(kind === "realistic" ? "Realistic Earth map loaded." : "Blob map loaded (default).");
            }
            renderCountryList();
            syncEditorFromCountry();
            draw();
        });
    };
    window.closeLivingLands = function () {
        if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
        var ov = document.getElementById("livingLandsOverlay");
        if (ov) ov.style.display = "none";
    };
    window.llAddCountry = function () {
        if (mode !== "edit") return;
        if (countries.length >= MAX_COUNTRIES) { addNote("Country limit reached to keep the map fast."); return; }
        applyEditorToCountry();
        var c = defaultCountry("");
        countries.push(c);
        selectedId = c.id;
        syncEditorFromCountry();
        renderCountryList();
    };
    window.llPlaySim = function () {
        applyEditorToCountry();
        if (!countries.length) { addNote("Add a country first."); return; }
        fillCitiesInsideCountries();
        crafts = [];
        takeSnapshot();
        notes = [];
        simTick = 0;
        addNote("Play started. Provinces expand inside countries.");
        setMode("play");
    };
    window.llPauseSim = function () {
        if (mode === "play") { setMode("pause"); addNote("Paused. Physics frozen."); }
        else if (mode === "pause") { setMode("play"); addNote("Resumed."); }
    };
    window.llStopSim = function () {
        restoreSnapshot();
        setMode("edit");
        renderCountryList();
        syncEditorFromCountry();
        draw();
    };
    window.llSaveMap = saveMap;
    window.llClearPaint = function () {
        if (mode !== "edit") return;
        if (!confirm("Clear all painted countries? Earth stays.")) return;
        owner.fill(0); cityOwn.fill(0); cities = []; crafts = []; draw();
    };
})();
