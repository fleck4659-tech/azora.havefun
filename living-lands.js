/* Living Lands — tiny-pixel Earth painter + country sim */
(function () {
    var W = 360;
    var H = 180;
    var MAX_COUNTRIES = 24;
    var MAX_NOTES = 16;
    var MAX_CITIES = 48;
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
    var simTick = 0;
    var cityRebuildTimer = null;
    var dirtyDraw = true;
    var landAge = new Uint16Array(W * H);

    function idx(x, y) { return y * W + x; }
    function hash(x, y) {
        var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return n - Math.floor(n);
    }
    function noise(x, y) {
        var x0 = Math.floor(x), y0 = Math.floor(y);
        var fx = x - x0, fy = y - y0;
        var sx = fx * fx * (3 - 2 * fx);
        var sy = fy * fy * (3 - 2 * fy);
        var a = hash(x0, y0), b = hash(x0 + 1, y0);
        var c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
    function fbm(x, y) {
        return noise(x, y) * 0.55 + noise(x * 2.1, y * 2.1) * 0.28 + noise(x * 4.2, y * 4.2) * 0.17;
    }
    function blob(u, v, cx, cy, rx, ry) {
        var dx = (u - cx) / rx, dy = (v - cy) / ry;
        return 1 - (dx * dx + dy * dy);
    }
    function landValue(u, v) {
        var n = (fbm(u * 6.5, v * 6.5) - 0.5) * 0.28;
        var vland = -0.35 + n;
        vland = Math.max(vland, blob(u, v, 0.22, 0.32, 0.16, 0.16));
        vland = Math.max(vland, blob(u, v, 0.30, 0.38, 0.10, 0.12));
        vland = Math.max(vland, blob(u, v, 0.30, 0.62, 0.07, 0.18));
        vland = Math.max(vland, blob(u, v, 0.52, 0.28, 0.08, 0.08));
        vland = Math.max(vland, blob(u, v, 0.54, 0.52, 0.10, 0.20));
        vland = Math.max(vland, blob(u, v, 0.70, 0.32, 0.20, 0.14));
        vland = Math.max(vland, blob(u, v, 0.78, 0.42, 0.12, 0.10));
        vland = Math.max(vland, blob(u, v, 0.84, 0.64, 0.08, 0.07));
        vland = Math.max(vland, blob(u, v, 0.35, 0.12, 0.06, 0.07));
        vland = Math.max(vland, blob(u, v, 0.50, 0.95, 0.42, 0.08));
        vland = Math.max(vland, blob(u, v, 0.12, 0.22, 0.05, 0.06));
        if (v > 0.93) vland = Math.max(vland, 0.4);
        if (v < 0.035) vland = Math.max(vland, 0.25);
        return vland;
    }
    function mountainBoost(u, v) {
        var m = 0;
        m = Math.max(m, blob(u, v, 0.72, 0.36, 0.06, 0.025) * 1.4);
        m = Math.max(m, blob(u, v, 0.26, 0.60, 0.018, 0.16) * 1.1);
        m = Math.max(m, blob(u, v, 0.16, 0.30, 0.03, 0.10) * 0.9);
        m = Math.max(m, blob(u, v, 0.51, 0.27, 0.03, 0.02) * 0.8);
        m = Math.max(m, blob(u, v, 0.62, 0.30, 0.08, 0.04) * 0.55);
        m += (fbm(u * 18, v * 18) - 0.5) * 0.22;
        return m;
    }
    function buildEarth() {
        var x, y, u, v, land, mtn, e;
        for (y = 0; y < H; y++) {
            v = y / (H - 1);
            for (x = 0; x < W; x++) {
                u = x / (W - 1);
                land = landValue(u, v);
                if (land < 0.06) { elev[idx(x, y)] = 0; continue; }
                mtn = mountainBoost(u, v) + Math.max(0, land - 0.35) * 0.4;
                if (mtn > 0.92) e = 5;
                else if (mtn > 0.70) e = 4;
                else if (mtn > 0.48) e = 3;
                else if (mtn > 0.28) e = 2;
                else e = 1;
                elev[idx(x, y)] = e;
            }
        }
        owner.fill(0);
        cityOwn.fill(0);
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
        if (mode !== "edit" || !selectedId) return;
        var c = findCountry(selectedId);
        if (!c) return;
        var r = brushSize(), i, j, dx, dy, p;
        for (j = -r; j <= r; j++) {
            for (i = -r; i <= r; i++) {
                if (i * i + j * j > r * r) continue;
                dx = x + i; dy = y + j;
                if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue;
                p = idx(dx, dy);
                if (elev[p] === 0) continue;
                owner[p] = c.id;
                landAge[p] = 0;
            }
        }
        scheduleCityRebuild();
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
    function landCount(id) {
        var n = 0, i;
        for (i = 0; i < W * H; i++) if (owner[i] === id) n++;
        return n;
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
                if (Math.random() < 0.88) cityOwn[q] = cid;
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
        countries.forEach(function (c) {
            var banks = Number(c.banks) || 0;
            c.money = (Number(c.money) || 0) + banks * 6;
            if (banks && Math.random() < Math.min(0.35, banks * 0.04)) {
                c.diamonds = (Number(c.diamonds) || 0) + 1;
            }
        });
    }
    function tickSim() {
        if (mode !== "play" || !countries.length) return;
        simTick++;
        var dirs = [1, -1, W, -W];
        var attempts = Math.min(900, 140 + countries.length * 70);
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
            if (!oid) {
                if (Math.random() < 0.92) { owner[q] = cid; landAge[q] = 0; }
            } else {
                them = findCountry(oid);
                if (!them) continue;
                var atk = power(me) + Math.random() * 6;
                var def = defense(them) + elev[q] + Math.random() * 6;
                if (atk > def) {
                    owner[q] = cid;
                    landAge[q] = 0;
                    cityOwn[q] = 0;
                    if (Math.random() < 0.08) addNote(me.name + " has invaded " + them.name);
                    tryFightBack(them.id, me.id, q % W, (q / W) | 0);
                } else if (Math.random() < 0.08) {
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
            e = elev[i];
            col = ELEV_COLOR[e] || ELEV_COLOR[0];
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
            octx.clearRect(0, 0, overlay.width, overlay.height);
            octx.drawImage(canvas, 0, 0, overlay.width, overlay.height);
            var sx = overlay.width / W, sy = overlay.height / H;
            octx.font = "10px sans-serif";
            octx.textAlign = "center";
            octx.font = "bold 11px sans-serif";
            cities.forEach(function (city) {
                var px = city.x * sx, py = city.y * sy;
                octx.fillStyle = "rgba(255,255,255,0.8)";
                octx.fillRect(px - 3, py - 3, 6, 6);
                octx.strokeStyle = "#111";
                octx.strokeRect(px - 3, py - 3, 6, 6);
                octx.fillStyle = "#111";
                octx.fillText(city.name, px, py - 6);
            });
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
        buildEarth();
        if (!countries.length && !loadMap()) {
            var first = defaultCountry("Red");
            countries.push(first);
            selectedId = first.id;
        }
        bind();
        setMode("edit");
        renderCountryList();
        syncEditorFromCountry();
        fillCitiesInsideCountries();
        draw();
        startTicks();
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
