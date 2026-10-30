/** Scroll, media and WebGL choreography. Native scrolling is the only timeline. */
export function createExperience(THREE, mode) {
    const root = document.documentElement;
    const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
    let paused = reduceQuery.matches, frameId = 0, lastY = scrollY, lastTime = 0;
    let scrollImpulse = 0, hop = 0, hopV = 0, pointer = { x: 0, y: 0 }, interactions = 0;
    const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
    const mix = (a, b, t) => a + (b - a) * t;
    const story = document.querySelector('[data-story]');
    const steps = [...document.querySelectorAll('.story-step')];
    const videos = [...document.querySelectorAll('video')];
    const buttons = [...document.querySelectorAll('[data-motion]')];
    const slots = [...document.querySelectorAll('[data-object-slot]')];
    const timeline = [...document.querySelectorAll('[data-chapter]')];
    const readout = document.querySelector('[data-scene-name]');
    const progress = document.querySelector('[data-progress]');
    const filmButtons = [...document.querySelectorAll('[data-film-toggle]')];
    let manualFilmPaused = false;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting)
            entry.target.classList.add('is-visible');
    }), { threshold: .12 });
    document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
    root.classList.add('enhanced');
    const syncVideos = () => videos.forEach(v => {
        const r = v.getBoundingClientRect();
        if (!paused && !manualFilmPaused && !document.hidden && r.bottom > 0 && r.top < innerHeight)
            v.play().catch(() => { });
        else
            v.pause();
    });
    const mediaObserver = new IntersectionObserver(syncVideos, { threshold: .05 });
    videos.forEach(v => mediaObserver.observe(v));
    function motionState() {
        root.dataset.motion = paused ? 'paused' : 'running';
        buttons.forEach(b => { b.setAttribute('aria-pressed', String(paused)); b.textContent = paused ? 'Motion off' : 'Motion on'; });
        filmButtons.forEach(b => { b.disabled = paused; b.textContent = paused ? 'Motion is off' : manualFilmPaused ? 'Play film ↗' : 'Pause film Ⅱ'; });
        syncVideos();
    }
    buttons.forEach(b => b.addEventListener('click', () => { paused = !paused; motionState(); }));
    reduceQuery.addEventListener('change', e => { paused = e.matches; motionState(); });
    filmButtons.forEach(b => b.addEventListener('click', () => {
        manualFilmPaused = !manualFilmPaused;
        filmButtons.forEach(x => { x.textContent = manualFilmPaused ? 'Play film ↗' : 'Pause film Ⅱ'; x.setAttribute('aria-pressed', String(manualFilmPaused)); });
        syncVideos();
    }));
    motionState();
    addEventListener('pointermove', e => { pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = e.clientY / innerHeight * 2 - 1; }, { passive: true });
    addEventListener('scroll', () => {
        const delta = scrollY - lastY;
        if (Math.abs(delta) > 1) {
            root.dataset.direction = delta > 0 ? 'down' : 'up';
            scrollImpulse = clamp(delta, -80, 80);
            if (!paused)
                hopV = clamp(hopV + clamp(delta * .075, -4, 4), -14, 14);
        }
        lastY = scrollY;
    }, { passive: true });
    const visitLabel = document.querySelector('[data-visits]');
    const blooms = [];
    document.querySelectorAll('[data-cultivate]').forEach(b => b.addEventListener('click', () => {
        interactions++;
        if (visitLabel)
            visitLabel.textContent = String(interactions).padStart(2, '0');
        b.textContent = interactions === 1 ? 'You planted a memory. Plant another ↗' : 'A little more life. Plant again ↗';
        const bed = document.querySelector('.memory-bed');
        if (bed) {
            const leaf = document.createElement('i');
            leaf.className = 'memory-leaf';
            leaf.style.setProperty('--r', `${(interactions * 137.5) % 360}deg`);
            leaf.style.left = `${12 + (interactions * 23) % 76}%`;
            leaf.style.top = `${18 + (interactions * 31) % 58}%`;
            bed.append(leaf);
            blooms.push(leaf);
            if (blooms.length > 24)
                blooms.shift().remove();
        }
        hopV = -4;
    }));
    document.querySelector('[data-download]')?.addEventListener('click', () => {
        const visited = steps.filter(x => x.getBoundingClientRect().top < innerHeight).length;
        const petals = Array.from({ length: 12 }, (_, i) => `<ellipse cx="300" cy="245" rx="35" ry="105" transform="rotate(${i * 30} 300 320)" fill="none" stroke="#254d37" stroke-width="1.5"/>`).join('');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><rect width="600" height="800" fill="#e8edc8"/><text x="40" y="65" font-family="Georgia" font-size="40" fill="#183829">ANIMA</text><text x="40" y="100" font-family="monospace" font-size="12">A GARDEN THAT REMEMBERS YOU</text>${petals}<circle cx="300" cy="320" r="45" fill="#c1d86f"/><path d="M300 365 Q270 480 300 570" fill="none" stroke="#254d37" stroke-width="2"/><text x="40" y="650" font-family="monospace" font-size="14">SPECIMEN 001 / ${visited} CHAPTERS / ${interactions} MEMORIES</text><text x="40" y="690" font-family="Georgia" font-size="25">Something of you is growing here.</text><text x="40" y="750" font-family="monospace" font-size="13">made with Purvang · purvang.vercel.app</text></svg>`;
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'anima-your-specimen.svg';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        const status = document.querySelector('[data-download-status]');
        if (status)
            status.textContent = 'Your specimen is ready. Keep it somewhere safe.';
    });
    let audioContext, gain, audioOn = false;
    document.querySelector('[data-sound]')?.addEventListener('click', async (e) => {
        const soundButton = e.currentTarget;
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                gain = audioContext.createGain();
                gain.gain.value = 0;
                gain.connect(audioContext.destination);
                [55, 82.4, 110, 164.8].forEach((f, i) => { const o = audioContext.createOscillator(), g = audioContext.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.value = .07 / (i + 1); o.connect(g); g.connect(gain); o.start(); });
            }
            await audioContext.resume();
            audioOn = !audioOn;
            gain.gain.setTargetAtTime(audioOn ? .5 : 0, audioContext.currentTime, .4);
            soundButton.textContent = audioOn ? 'Sound on' : 'Sound off';
            soundButton.setAttribute('aria-pressed', String(audioOn));
        }
        catch {
            soundButton.textContent = 'Sound unavailable';
        }
    });
    let renderer, scene, camera, object, modelUpdate = () => { };
    const canvas = document.querySelector('#world');
    let width = innerWidth, height = innerHeight;
    const loc = { x: width * .88, y: height * .78, s: 0 };
    const fallback = document.querySelector('.traveler-fallback');
    try {
        if (!THREE)
            throw Error('3D unavailable');
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        renderer.setSize(width, height);
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(35, width / height, .1, 100);
        camera.position.z = 12;
        scene.add(new THREE.HemisphereLight(0xffffff, mode === 'anima' ? 0x153825 : 0x554338, 2.5));
        const key = new THREE.DirectionalLight(0xffffff, 3.2);
        key.position.set(-3, 5, 5);
        scene.add(key);
        const rim = new THREE.DirectionalLight(mode === 'anima' ? 0xe9a4cb : 0xffbc83, 2);
        rim.position.set(4, -1, 2);
        scene.add(rim);
        object = new THREE.Group();
        scene.add(object);
        if (mode === 'halcyon')
            modelUpdate = buildGravity(THREE, object, renderer, scene);
        if (mode === 'anima')
            modelUpdate = buildOrganism(THREE, object);
        if (mode === 'nihilo')
            modelUpdate = buildStar(THREE, object);
        root.dataset.webgl = 'ready';
        if (fallback)
            fallback.hidden = true;
        canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); root.dataset.webgl = 'fallback'; canvas.style.display = 'none'; if (fallback)
            fallback.hidden = false; });
    }
    catch (error) {
        root.dataset.webgl = 'fallback';
        if (canvas)
            canvas.style.display = 'none';
        if (fallback)
            fallback.hidden = false;
    }
    const chapterNames = steps.map(s => s.dataset.name || '');
    const stickyStage = document.querySelector('.collection-stage,.growth-sticky,.stellar-stage');
    const mobileCaption = document.createElement('div');
    mobileCaption.className = 'mobile-caption';
    if (stickyStage)
        stickyStage.append(mobileCaption);
    function updateMobileCaption(idx) {
        if (!steps[idx])
            return;
        mobileCaption.replaceChildren(...[...steps[idx].children].filter(el => el.matches('.eyebrow,h2,p')).map(el => el.cloneNode(true)));
    }
    let choice = 0;
    document.querySelectorAll('[data-form]').forEach(b => b.addEventListener('click', () => {
        choice = Number(b.dataset.form);
        document.querySelectorAll('[data-form]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        const title = document.querySelector('[data-form-title]');
        if (title)
            title.textContent = b.dataset.title;
        hopV = -4;
    }));
    function resize() { width = innerWidth; height = innerHeight; steps.forEach(s => { if (width < 801)
        s.setAttribute('aria-hidden', 'true');
    else
        s.removeAttribute('aria-hidden'); }); if (renderer) {
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    } }
    addEventListener('resize', resize, { passive: true });
    resize();
    let active = -1;
    function frame(now) {
        frameId = requestAnimationFrame(frame);
        const dt = Math.min((now - lastTime) / 16.667, 2) || 1;
        lastTime = now;
        const total = Math.max(1, document.documentElement.scrollHeight - height);
        const pageP = clamp(scrollY / total);
        if (progress)
            progress.style.transform = `scaleX(${pageP})`;
        const percent = document.querySelector('[data-percent]');
        if (percent)
            percent.textContent = String(Math.round(pageP * 100)).padStart(2, '0');
        let p = 0;
        if (story) {
            const r = story.getBoundingClientRect();
            p = clamp(-r.top / Math.max(1, r.height - height));
        }
        let idx = 0;
        steps.forEach((s, i) => { if (s.getBoundingClientRect().top < height * .6)
            idx = i; });
        if (idx !== active) {
            active = idx;
            updateMobileCaption(idx);
            root.dataset.chapter = idx;
            timeline.forEach((a, i) => { a.classList.toggle('is-active', i === idx); if (i === idx)
                a.setAttribute('aria-current', 'step');
            else
                a.removeAttribute('aria-current'); });
            if (readout)
                readout.textContent = chapterNames[idx] || '';
        }
        // Each visible stage attracts the traveller. Between stages it becomes a small companion.
        let tx = width - (width < 700 ? 35 : 65), ty = height * .76, rad = width < 700 ? 15 : 24, best = 0;
        slots.forEach(slot => { const r = slot.getBoundingClientRect(); const center = r.top + r.height / 2; const visibility = clamp(1 - Math.abs(center - height * .5) / (height * .72)); if (visibility > best) {
            best = visibility;
            const a = visibility * visibility * (3 - 2 * visibility);
            tx = mix(tx, r.left + r.width / 2, a);
            ty = mix(ty, center, a);
            rad = mix(rad, Math.min(r.width, r.height) * .31, a);
        } });
        if (paused) {
            hop = 0;
            hopV = 0;
        }
        else {
            hopV += -hop * .075 * dt;
            hopV *= Math.pow(.79, dt);
            hop += hopV * dt;
        }
        const ease = paused ? 1 : 1 - Math.pow(.84, dt);
        loc.x = mix(loc.x, tx, ease);
        loc.y = mix(loc.y, ty, ease);
        loc.s = mix(loc.s, rad, ease);
        if (renderer && root.dataset.webgl === 'ready') {
            const viewH = 2 * Math.tan(35 * Math.PI / 360) * 12;
            object.position.set((loc.x / width - .5) * viewH * width / height, (.5 - loc.y / height) * viewH - hop * .012, 0);
            object.scale.setScalar(loc.s / height * viewH);
            const time = paused ? 4 : now * .001;
            modelUpdate(time, p, choice, paused ? 0 : scrollImpulse, paused ? { x: 0, y: 0 } : pointer);
            if (!paused || Math.abs(scrollImpulse) > .1 || now < 1000)
                renderer.render(scene, camera);
            // Static rendering must still follow native scrolling and stage position.
            if (paused)
                renderer.render(scene, camera);
        }
        if (fallback && !fallback.hidden) {
            fallback.style.transform = `translate3d(${loc.x}px,${loc.y + hop}px,0)`;
            fallback.style.width = fallback.style.height = `${loc.s * 2}px`;
        }
        scrollImpulse *= .88;
        document.querySelectorAll('[data-parallax]').forEach(el => { if (paused) {
            el.style.transform = 'none';
            return;
        } const r = el.parentElement.getBoundingClientRect(); if (r.bottom > 0 && r.top < height)
            el.style.transform = `translate3d(0,${clamp(-r.top * .13, -100, 100)}px,0) scale(1.12)`; });
    }
    document.addEventListener('visibilitychange', () => { syncVideos(); if (document.hidden) {
        cancelAnimationFrame(frameId);
        audioContext?.suspend();
    }
    else {
        lastTime = performance.now();
        frameId = requestAnimationFrame(frame);
        if (audioOn)
            audioContext?.resume();
    } });
    requestAnimationFrame(frame);
}
function buildGravity(T, g, renderer, scene) {
    const env = document.createElement('canvas');
    env.width = 1024;
    env.height = 512;
    const ctx = env.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#fcf9ee');
    grad.addColorStop(.42, '#d1dce1');
    grad.addColorStop(.5, '#faf9f2');
    grad.addColorStop(.55, '#323b43');
    grad.addColorStop(.63, '#9da9b2');
    grad.addColorStop(1, '#e8d6bd');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = '#fff';
    ctx.fillRect(140, 10, 160, 260);
    ctx.fillRect(710, 20, 80, 260);
    const tex = new T.CanvasTexture(env);
    tex.mapping = T.EquirectangularReflectionMapping;
    const pmrem = new T.PMREMGenerator(renderer);
    const target = pmrem.fromEquirectangular(tex);
    scene.environment = target.texture;
    tex.dispose();
    pmrem.dispose();
    const chrome = new T.MeshStandardMaterial({ color: 0xe0e8ed, metalness: 1, roughness: .075, envMapIntensity: 1.3 });
    const sphere = new T.Mesh(new T.SphereGeometry(1, 64, 48), chrome);
    g.add(sphere);
    const ring = new T.Mesh(new T.TorusGeometry(1.52, .025, 16, 128), new T.MeshStandardMaterial({ color: 0xe8ac78, metalness: .6, roughness: .2 }));
    ring.rotation.x = 1.2;
    g.add(ring);
    const moon = new T.Mesh(new T.SphereGeometry(.15, 24, 24), new T.MeshStandardMaterial({ color: 0xdb7650, metalness: .4, roughness: .25 }));
    g.add(moon);
    const knot = new T.Mesh(new T.TorusKnotGeometry(.72, .23, 128, 20, 2, 3), chrome);
    g.add(knot);
    return (t, p, choice, v, pointer) => { sphere.visible = choice !== 1; knot.visible = choice === 1; sphere.scale.set(1 + Math.sin(t * .8) * .025, choice === 2 ? .78 + Math.sin(t) * .05 : 1, 1); g.rotation.y = t * .18 + pointer.x * .15; g.rotation.z = Math.sin(t * .4) * .1 + v * .001; ring.rotation.z = t * .2; moon.position.set(Math.cos(t * .7) * 1.65, Math.sin(t * .7) * .6, Math.sin(t * .7) * 1.5); knot.rotation.x = t * .15; };
}
function buildOrganism(T, g) {
    const core = new T.Mesh(new T.SphereGeometry(.4, 48, 32), new T.MeshPhysicalMaterial({ color: 0xe5eaa6, roughness: .22, metalness: .2, clearcoat: 1 }));
    g.add(core);
    const petals = [];
    for (let i = 0; i < 14; i++) {
        const mat = new T.MeshPhysicalMaterial({ color: i % 2 ? 0xc6d894 : 0xe8b9d0, metalness: .15, roughness: .26, clearcoat: 1, transparent: true, opacity: .84, side: T.DoubleSide });
        const geometry = new T.SphereGeometry(1, 36, 28);
        const positions = geometry.attributes.position;
        for (let j = 0; j < positions.count; j++) {
            const x = positions.getX(j), y = positions.getY(j), z = positions.getZ(j);
            positions.setXYZ(j, x * (.8 + .2 * y), y, z + Math.pow(y + 1, 2) * .18 + Math.sin(x * 3) * .08);
        }
        geometry.computeVertexNormals();
        const petal = new T.Mesh(geometry, mat);
        g.add(petal);
        petals.push(petal);
    }
    const dust = new T.BufferGeometry(), arr = new Float32Array(270);
    for (let i = 0; i < 90; i++) {
        const a = i * 2.399;
        arr[i * 3] = Math.cos(a) * (1 + i / 60);
        arr[i * 3 + 1] = Math.sin(a) * (1 + i / 60);
        arr[i * 3 + 2] = Math.sin(i) * 1.4;
    }
    dust.setAttribute('position', new T.BufferAttribute(arr, 3));
    g.add(new T.Points(dust, new T.PointsMaterial({ color: 0xd6f08b, size: .025, transparent: true, opacity: .6 })));
    return (t, p, choice, v, pointer) => { const open = .15 + .85 * Math.min(1, p * 1.6); petals.forEach((petal, i) => { const a = i / 14 * Math.PI * 2; const r = .3 + open * .55; petal.position.set(Math.cos(a) * r, Math.sin(a) * r, Math.sin(i * 2.3) * .2); petal.scale.set(.19 + open * .11, .43 + open * .5, .09); petal.rotation.z = a - Math.PI / 2; petal.rotation.x = Math.sin(t * .6 + i) * .08 + open * .35; }); g.rotation.y = Math.sin(t * .25) * .25 + pointer.x * .18; g.rotation.z = t * .04 + v * .001; core.scale.setScalar(1 + Math.sin(t * 1.1) * .06); };
}
function buildStar(T, g) {
    const uniforms = { time: { value: 0 }, phase: { value: 0 } };
    const material = new T.ShaderMaterial({ uniforms, vertexShader: `varying vec3 vNormal;varying vec3 vPos;void main(){vNormal=normalize(normalMatrix*normal);vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`, fragmentShader: `uniform float time;uniform float phase;varying vec3 vNormal;varying vec3 vPos;float field(vec3 p){return sin(p.x*16.+sin(p.y*19.)+time*.5)*sin(p.z*21.-time*.3)+sin(p.y*39.+p.x*14.+time)*.4;}void main(){float n=field(vPos);float f=pow(1.-max(0.,vNormal.z),2.);vec3 orange=vec3(1.,.21,.025);vec3 blue=vec3(.35,.65,1.);vec3 col=mix(orange,blue,smoothstep(.21,.36,phase)*(1.-smoothstep(.43,.55,phase)));col*=.8+n*.18;col+=vec3(1.,.7,.3)*f*.75;col+=pow(max(0.,n),4.)*.22;if(phase>.86)col=vec3(.006,.005,.007);gl_FragColor=vec4(col,1.);}` });
    const sun = new T.Mesh(new T.SphereGeometry(1, 64, 48), material);
    g.add(sun);
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 128;
    const c = glowCanvas.getContext('2d');
    const grad = c.createRadialGradient(64, 64, 18, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,160,60,.7)');
    grad.addColorStop(.5, 'rgba(255,70,10,.15)');
    grad.addColorStop(1, 'rgba(255,30,0,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, 128, 128);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(glowCanvas), color: 0xffbb88, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    glow.scale.set(3.8, 3.8, 1);
    g.add(glow);
    const disk = new T.Mesh(new T.TorusGeometry(1.2, .075, 12, 160), new T.MeshBasicMaterial({ color: 0xffc178, transparent: true, opacity: 0 }));
    disk.rotation.x = 1.17;
    disk.rotation.z = -.2;
    g.add(disk);
    const geom = new T.BufferGeometry(), N = 1300, arr = new Float32Array(N * 3), seeds = [];
    for (let i = 0; i < N; i++) {
        const a = i * 2.39996, z = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - z * z);
        seeds.push([Math.cos(a) * r, Math.sin(a) * r, z, .2 + (i % 53) / 53]);
    }
    geom.setAttribute('position', new T.BufferAttribute(arr, 3));
    const points = new T.Points(geom, new T.PointsMaterial({ color: 0xffc895, size: .028, transparent: true, opacity: .6, blending: T.AdditiveBlending, depthWrite: false }));
    g.add(points);
    return (t, p, choice, v, pointer) => {
        uniforms.time.value = t;
        uniforms.phase.value = p;
        const dust = p < .17 ? (1 - p / .17) : 0;
        const blast = Math.max(0, 1 - Math.abs(p - .76) / .12);
        const end = Math.min(1, Math.max(0, (p - .85) / .15));
        let scale = p < .17 ? .18 + p * 3 : p < .5 ? .74 : p < .68 ? .74 + (p - .5) * 4 : p < .86 ? Math.max(.22, 1.46 - (p - .68) * 6) : .52;
        sun.scale.setScalar(scale);
        glow.scale.setScalar((scale * 3.5) * (1 - end * .68));
        glow.material.opacity = (1 - dust * .75) * (1 - end * .75);
        disk.material.opacity = end;
        disk.scale.setScalar(.85 + end * .25);
        for (let i = 0; i < N; i++) {
            const s = seeds[i], r = scale * (1.05 + s[3] * .4) + dust * s[3] * 3 + blast * s[3] * 4;
            arr[i * 3] = s[0] * r;
            arr[i * 3 + 1] = s[1] * r;
            arr[i * 3 + 2] = s[2] * r;
        }
        geom.attributes.position.needsUpdate = true;
        points.material.opacity = .15 + dust * .7 + blast * .8;
        points.rotation.y = t * .025;
        g.rotation.y = pointer.x * .08;
        sun.rotation.y = t * .06;
        disk.rotation.z = -.2 + Math.sin(t * .2) * .04;
    };
}
