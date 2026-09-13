/* Azora Avatar — isolated character file
 * Load this BEFORE script.js.
 * If the main platform errors, this file can still draw the blocky avatar.
 */
(function (global) {
    "use strict";

    var AVATAR_FILE_VERSION = "1.0";

    function hasTHREE() {
        return typeof global.THREE !== "undefined";
    }

    function roundedBoxGeometry(w, h, d, radius) {
        if (!hasTHREE()) return null;
        w = Math.max(0.04, Number(w) || 0.3);
        h = Math.max(0.04, Number(h) || 0.3);
        d = Math.max(0.04, Number(d) || 0.3);
        var maxR = Math.min(w, h, d) * 0.32;
        var r = Math.min(Math.max(0.01, radius != null ? radius : Math.min(w, h, d) * 0.22), maxR);
        try {
            var geo = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
            var pos = geo.attributes.position;
            var hw = w / 2, hh = h / 2, hd = d / 2;
            var ix = Math.max(0.001, hw - r);
            var iy = Math.max(0.001, hh - r);
            var iz = Math.max(0.001, hd - r);
            var v = new THREE.Vector3();
            for (var i = 0; i < pos.count; i++) {
                v.fromBufferAttribute(pos, i);
                var x = v.x, y = v.y, z = v.z;
                var cx = Math.max(-ix, Math.min(ix, x));
                var cy = Math.max(-iy, Math.min(iy, y));
                var cz = Math.max(-iz, Math.min(iz, z));
                var dx = x - cx, dy = y - cy, dz = z - cz;
                var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (len > 1e-8) {
                    var s = r / len;
                    pos.setXYZ(i, cx + dx * s, cy + dy * s, cz + dz * s);
                }
            }
            pos.needsUpdate = true;
            try { geo.computeVertexNormals(); } catch (eN) {}
            return geo;
        } catch (eEx) {
            return new THREE.BoxGeometry(w, h, d);
        }
    }

    function girlTorsoGeometry(w, h, d) {
        if (!hasTHREE()) return null;
        w = w || 0.70; h = h || 1.02; d = d || 0.38;
        var hx = w / 2, hy = h / 2;
        var cut = w * 0.34;
        var band = h * 0.34;
        var shape = new THREE.Shape();
        shape.moveTo(-hx, hy);
        shape.lineTo(hx, hy);
        shape.lineTo(hx, band);
        shape.lineTo(hx - cut, 0);
        shape.lineTo(hx, -band);
        shape.lineTo(hx, -hy);
        shape.lineTo(-hx, -hy);
        shape.lineTo(-hx, -band);
        shape.lineTo(-hx + cut, 0);
        shape.lineTo(-hx, band);
        shape.closePath();
        var geo = new THREE.ExtrudeGeometry(shape, {
            depth: d,
            bevelEnabled: true,
            bevelThickness: Math.min(w, h, d) * 0.06,
            bevelSize: Math.min(w, h, d) * 0.06,
            bevelSegments: 3,
            steps: 1
        });
        geo.translate(0, 0, -d / 2);
        try { geo.computeVertexNormals(); } catch (eN) {}
        return geo;
    }

    function applyGirlTorsoCut(mesh, w, h, d) {
        if (!mesh || !hasTHREE()) return;
        try { if (mesh.geometry) mesh.geometry.dispose(); } catch (e) {}
        mesh.geometry = girlTorsoGeometry(w || 0.70, h || 1.02, d || 0.38);
    }

    function applyBoyTorsoBox(mesh, w, h, d) {
        if (!mesh || !hasTHREE()) return;
        w = w || 0.78; h = h || 1.12; d = d || 0.42;
        try { if (mesh.geometry) mesh.geometry.dispose(); } catch (e) {}
        mesh.geometry = roundedBoxGeometry(w, h, d, Math.min(w, h, d) * 0.18);
    }

    function makeBox(w, h, d, color) {
        return new THREE.Mesh(
            roundedBoxGeometry(w, h, d, Math.min(w, h, d) * 0.18),
            new THREE.MeshLambertMaterial({ color: color })
        );
    }

    function defaultColors(gender) {
        var girl = gender === "girl" || gender === "female";
        return {
            gender: girl ? "girl" : "boy",
            head: "#e0a870",
            torso: girl ? "#ec4899" : "#1d4ed8",
            leftArm: "#e0a870",
            rightArm: "#e0a870",
            leftLeg: "#334155",
            rightLeg: "#334155",
            hair: "#4a3728"
        };
    }

    function buildFace(gender) {
        if (!hasTHREE()) return null;
        gender = gender || "boy";
        var faceUrl = (gender === "girl" || gender === "female") ? "female_smile.png" : "Smile.png";
        var face = new THREE.Group();
        face.name = "face";
        var mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.FrontSide,
            alphaTest: 0.2
        });
        var plane = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.54), mat);
        plane.name = "faceDecal";
        plane.position.set(0, 0, 0.34);
        plane.visible = false;
        face.add(plane);
        try {
            var img = new Image();
            if (typeof location !== "undefined" && location.protocol !== "file:") img.crossOrigin = "anonymous";
            img.onload = function () {
                try {
                    var tex = new THREE.Texture(img);
                    tex.minFilter = THREE.LinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    tex.generateMipmaps = false;
                    tex.needsUpdate = true;
                    mat.map = tex;
                    mat.opacity = 1;
                    mat.needsUpdate = true;
                    plane.visible = true;
                } catch (e) {}
            };
            img.src = faceUrl;
        } catch (e2) {}
        return face;
    }

    function makeHair(hairColor, headY, headSize, styleId) {
        if (!hasTHREE()) return null;
        if (styleId === "hair_boy_none" || styleId === "none") return null;
        var group = new THREE.Group();
        group.name = "hair";
        var mat = new THREE.MeshLambertMaterial({ color: hairColor || "#4a3728" });
        var cap = new THREE.Mesh(roundedBoxGeometry(headSize * 1.08, headSize * 0.28, headSize * 1.08, 0.06), mat);
        cap.position.y = (headY || 1.12) + headSize * 0.28;
        group.add(cap);
        if (styleId === "hair_girl_long" || styleId === "hair_girl_default" || !styleId) {
            var left = new THREE.Mesh(roundedBoxGeometry(0.16, 0.72, 0.16, 0.05), mat);
            left.position.set(-0.28, (headY || 1.12) - 0.12, -0.02);
            var right = new THREE.Mesh(roundedBoxGeometry(0.16, 0.72, 0.16, 0.05), mat);
            right.position.set(0.28, (headY || 1.12) - 0.12, -0.02);
            group.add(left);
            group.add(right);
        }
        return group;
    }

    function clearGroup(group) {
        if (!group) return;
        while (group.children.length) {
            var ch = group.children[0];
            group.remove(ch);
            try {
                if (ch.geometry) ch.geometry.dispose();
                if (ch.material) {
                    if (Array.isArray(ch.material)) ch.material.forEach(function (m) { try { m.dispose(); } catch (e) {} });
                    else ch.material.dispose();
                }
            } catch (eD) {}
        }
    }

    function buildBlockyInto(group, gender, colors) {
        if (!hasTHREE() || !group) return null;
        colors = colors || defaultColors(gender);
        gender = (gender === "girl" || gender === "female") ? "girl" : "boy";
        var isGirl = gender === "girl";
        clearGroup(group);
        var refs = {};
        var torsoW = isGirl ? 0.70 : 0.78;
        var torsoH = isGirl ? 1.02 : 1.12;
        var torsoD = isGirl ? 0.38 : 0.42;
        refs.torso = makeBox(torsoW, torsoH, torsoD, colors.torso || "#1d4ed8");
        refs.torso.name = "torso";
        refs.torso.position.y = 0.42;
        if (isGirl) applyGirlTorsoCut(refs.torso, torsoW, torsoH, torsoD);
        group.add(refs.torso);

        var torsoTopY = 0.42 + torsoH / 2;
        var neckH = 0.07;
        refs.neck = makeBox(0.20, neckH, 0.20, colors.head || "#e0a870");
        refs.neck.name = "neck";
        refs.neck.position.y = torsoTopY + neckH / 2;
        group.add(refs.neck);

        refs.voiceBox = makeBox(0.07, 0.05, 0.06, "#6b7280");
        refs.voiceBox.name = "cvbVoiceBox";
        refs.voiceBox.position.y = refs.neck.position.y;
        refs.voiceBox.position.z = 0.14;
        group.add(refs.voiceBox);
        group.userData = group.userData || {};
        group.userData.cvbVoiceBox = refs.voiceBox;

        refs.head = makeBox(0.52, 0.52, 0.52, colors.head || "#e0a870");
        refs.head.name = "head";
        refs.head.position.y = torsoTopY + 0.05 + 0.26;
        group.add(refs.head);

        refs.face = buildFace(gender);
        if (refs.face) {
            refs.face.position.y = refs.head.position.y;
            group.add(refs.face);
        }

        refs.leftArm = makeBox(0.30, 1.08, 0.30, colors.leftArm || colors.head || "#e0a870");
        refs.leftArm.name = "leftArm";
        refs.leftArm.position.set(-0.56, 0.42, 0);
        group.add(refs.leftArm);

        refs.rightArm = makeBox(0.30, 1.08, 0.30, colors.rightArm || colors.head || "#e0a870");
        refs.rightArm.name = "rightArm";
        refs.rightArm.position.set(0.56, 0.42, 0);
        group.add(refs.rightArm);

        refs.leftLeg = makeBox(0.30, 1.12, 0.30, colors.leftLeg || "#334155");
        refs.leftLeg.name = "leftLeg";
        refs.leftLeg.position.set(-0.18, -0.70, 0);
        group.add(refs.leftLeg);

        refs.rightLeg = makeBox(0.30, 1.12, 0.30, colors.rightLeg || "#334155");
        refs.rightLeg.name = "rightLeg";
        refs.rightLeg.position.set(0.18, -0.70, 0);
        group.add(refs.rightLeg);

        if (isGirl) {
            var hair = makeHair(colors.hair || "#4a3728", refs.head.position.y, 0.52, "hair_girl_long");
            if (hair) group.add(hair);
        }

        group.userData.animStyle = "blocky";
        group.userData.gender = gender;
        group.userData.fromAvatarFile = true;
        return refs;
    }

    function makeNormAvatar(colors) {
        if (!hasTHREE()) return null;
        colors = colors || defaultColors((colors && colors.gender) || "boy");
        var g = new THREE.Group();
        g.name = "normAvatar";
        var gender = colors.gender || "boy";
        var isGirl = gender === "girl" || gender === "female";
        var legH = 1.12, torsoH = isGirl ? 1.02 : 1.12, headS = 0.52, armH = 1.08;
        var torsoW = isGirl ? 0.70 : 0.78;
        var torsoD = isGirl ? 0.38 : 0.42;

        var torso = makeBox(torsoW, torsoH, torsoD, colors.torso || "#1d4ed8");
        if (isGirl) applyGirlTorsoCut(torso, torsoW, torsoH, torsoD);
        torso.position.y = legH + torsoH / 2;
        torso.name = "torso";
        g.add(torso);

        var neckH = 0.07;
        var torsoTop = legH + torsoH;
        var neck = makeBox(0.20, neckH, 0.20, colors.head || "#e0a870");
        neck.name = "neck";
        neck.position.y = torsoTop + neckH / 2;
        g.add(neck);

        var voiceBox = makeBox(0.07, 0.05, 0.06, "#6b7280");
        voiceBox.name = "cvbVoiceBox";
        voiceBox.position.y = neck.position.y;
        voiceBox.position.z = 0.14;
        g.add(voiceBox);
        g.userData.cvbVoiceBox = voiceBox;

        var head = makeBox(headS, headS, headS, colors.head || "#e0a870");
        head.position.y = torsoTop + 0.05 + headS / 2;
        head.name = "head";
        g.add(head);

        function addLimbPivot(pivotName, limbName, jointX, jointY, height, thick, color) {
            var pivot = new THREE.Group();
            pivot.name = pivotName;
            pivot.position.set(jointX, jointY, 0);
            var limb = makeBox(thick, height, thick, color);
            limb.name = limbName;
            limb.position.set(0, -height / 2, 0);
            pivot.add(limb);
            g.add(pivot);
            return pivot;
        }
        addLimbPivot("leftArmPivot", "leftArm", -0.56, torsoTop, armH, 0.30, colors.leftArm || colors.head);
        addLimbPivot("rightArmPivot", "rightArm", 0.56, torsoTop, armH, 0.30, colors.rightArm || colors.head);
        addLimbPivot("leftLegPivot", "leftLeg", -0.18, legH, legH, 0.30, colors.leftLeg || "#334155");
        addLimbPivot("rightLegPivot", "rightLeg", 0.18, legH, legH, 0.30, colors.rightLeg || "#334155");

        if (isGirl) {
            var hair = makeHair(colors.hair || "#4a3728", head.position.y, headS, colors.hairStyle || "hair_girl_long");
            if (hair) g.add(hair);
        }
        var face = buildFace(gender);
        if (face) {
            face.position.copy(head.position);
            g.add(face);
        }
        g.userData.footOffset = 0;
        g.userData.gender = gender;
        g.userData.fromAvatarFile = true;
        return g;
    }

    function mountPreview(container, colors) {
        if (!hasTHREE() || !container) return null;
        if (container.querySelector("canvas") && container._azoraAvatarMounted) return container._azoraAvatarMounted;
        while (container.firstChild) container.removeChild(container.firstChild);
        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(45, Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1), 0.1, 100);
        camera.position.set(0, 1.2, 4.2);
        var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(Math.max(container.clientWidth, 160), Math.max(container.clientHeight, 160));
        renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
        container.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        var key = new THREE.DirectionalLight(0xfff7ed, 0.7);
        key.position.set(3, 8, 6);
        scene.add(key);
        var group = new THREE.Group();
        scene.add(group);
        var g = (colors && colors.gender) || "boy";
        buildBlockyInto(group, g, colors || defaultColors(g));
        function tick() {
            requestAnimationFrame(tick);
            group.rotation.y += 0.008;
            renderer.render(scene, camera);
        }
        tick();
        var handle = { scene: scene, camera: camera, renderer: renderer, group: group };
        container._azoraAvatarMounted = handle;
        return handle;
    }

    function watchdog() {
        try {
            var el = document.getElementById("avatar3d-canvas");
            if (!el) return;
            if (el.querySelector("canvas")) return;
            mountPreview(el, defaultColors("boy"));
        } catch (e) {}
    }

    var API = {
        version: AVATAR_FILE_VERSION,
        roundedBoxGeometry: roundedBoxGeometry,
        girlTorsoGeometry: girlTorsoGeometry,
        applyGirlTorsoCut: applyGirlTorsoCut,
        applyBoyTorsoBox: applyBoyTorsoBox,
        makeBox: makeBox,
        buildFace: buildFace,
        makeHair: makeHair,
        buildBlockyInto: buildBlockyInto,
        makeNormAvatar: makeNormAvatar,
        mountPreview: mountPreview,
        defaultColors: defaultColors
    };
    global.AzoraAvatar = API;
    global.azoraRoundedBoxGeometry = roundedBoxGeometry;
    global.azoraGirlCutTorsoGeometry = girlTorsoGeometry;
    global.applyGirlTorsoCut = applyGirlTorsoCut;
    global.applyBoyTorsoBox = applyBoyTorsoBox;
    global.makeBox = makeBox;
    if (typeof document !== "undefined") {
        if (document.readyState === "complete" || document.readyState === "interactive") setTimeout(watchdog, 2600);
        else document.addEventListener("DOMContentLoaded", function () { setTimeout(watchdog, 2600); });
    }
})(typeof window !== "undefined" ? window : this);
