import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { io } from 'socket.io-client';

/** A lightweight, browser-rendered 3D city prototype. No external assets required. */
export default function World3D({ username = 'Player', city = 'Lagos', country = 'Nigeria', token = '' }) {
  const hostRef = useRef(null);
  const [helpOpen, setHelpOpen] = useState(true);
  const [position, setPosition] = useState({ x: 0, z: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer;
    try {
      const scene = new THREE.Scene();
      const skyColor = country === 'Nigeria' ? '#a9c9dc' : '#b8cfe4';
      scene.background = new THREE.Color(skyColor);
      scene.fog = new THREE.Fog(skyColor, 58, 155);
      const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 250);
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      host.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xe8f6ff, 0x64744d, 2.1));
      const sun = new THREE.DirectionalLight(0xfff1d3, 2.2);
      sun.position.set(-20, 35, 12); scene.add(sun);

      const mat = (color, roughness = 1) => new THREE.MeshStandardMaterial({ color, roughness });
      const grass = mat(country === 'Nigeria' ? '#78945c' : '#688b59');
      const road = mat('#303941', 0.95);
      const pavement = mat(country === 'Nigeria' ? '#b9ad95' : '#c4c7c7');
      const white = mat('#f5f0df');
      const dark = mat('#273541');
      const world = new THREE.Group(); scene.add(world);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), grass);
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.12; world.add(ground);
      const street = new THREE.Mesh(new THREE.PlaneGeometry(14, 170), road);
      street.rotation.x = -Math.PI / 2; street.position.y = -0.04; world.add(street);
      for (let z = -78; z < 85; z += 9) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 4), white);
        stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, 0.01, z); world.add(stripe);
      }
      for (const side of [-1, 1]) {
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(4, 170), pavement);
        walk.rotation.x = -Math.PI / 2; walk.position.set(side * 9, -0.01, 0); world.add(walk);
      }
      // Curbs, lane edges and a worn centre line make the street read more naturally.
      const curbMat = mat(country === 'Nigeria' ? '#d6c5a5' : '#d5d8d9');
      for (const side of [-1, 1]) {
        const curb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 170), curbMat);
        curb.position.set(side * 7.15, 0.04, 0); world.add(curb);
        const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 170), mat('#d7d4c7'));
        edge.rotation.x = -Math.PI / 2; edge.position.set(side * 6.7, 0.015, 0); world.add(edge);
      }
      for (let z = -78; z < 82; z += 13) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 5.5), mat('#e5dfc9'));
        dash.rotation.x = -Math.PI / 2; dash.position.set(0, 0.018, z); world.add(dash);
      }
      // Repeated low-poly buildings create a compact, readable city block.
      const buildingColors = country === 'Nigeria'
        ? ['#e4b66f', '#d8c49d', '#c97845', '#d4a37b', '#8fae89', '#e2d6b7']
        : ['#c6d4e5', '#e0e4e9', '#aebdd0', '#d5d0c8', '#b5c8d4', '#e7d9c8'];
      for (let row = 0; row < 9; row++) {
        for (const side of [-1, 1]) {
          const x = side * (15 + (row % 2) * 2);
          const z = -48 + row * 12;
          const height = country === 'USA' ? 7 + ((row * 7 + (side > 0 ? 3 : 0)) % 6) * 2.0 : 4 + ((row * 7 + (side > 0 ? 3 : 0)) % 5) * 1.65;
          const width = 5 + (row % 3);
          const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, 7), mat(buildingColors[(row + (side > 0 ? 2 : 0)) % buildingColors.length]));
          building.position.set(x, height / 2 - 0.1, z); world.add(building);
          const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.18, 0.22, 7.18), dark);
          roof.position.set(x, height + 0.02, z); world.add(roof);
          // Slightly projecting roofline, entrance and alternating facade bands add depth.
          const entrance = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.9, 0.1), mat(country === 'Nigeria' ? '#6e4932' : '#566575'));
          entrance.position.set(x, 0.88, z + (side < 0 ? 3.58 : -3.58)); world.add(entrance);
          const lintel = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.14, 0.18), mat(country === 'Nigeria' ? '#a87545' : '#8796a4'));
          lintel.position.set(x, height * 0.72, z + (side < 0 ? 3.6 : -3.6)); world.add(lintel);
          // A few simple windows on the street-facing wall.
          for (let wy = 1.2; wy < height - 0.5; wy += 1.35) {
            for (let wx = -width / 2 + 0.8; wx < width / 2; wx += 1.35) {
              const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.06), mat(country === 'Nigeria' ? '#5c8790' : '#557b9b', 0.28));
              windowMesh.position.set(x + wx, wy, z + (side < 0 ? 3.54 : -3.54)); world.add(windowMesh);
            }
          }
        }
      }
      // Additional side streets and blocks make the starter district feel less like a single corridor.
      for (const z of [-58, -30, 0, 30, 58]) {
        const cross = new THREE.Mesh(new THREE.PlaneGeometry(54, 7), road);
        cross.rotation.x = -Math.PI / 2; cross.position.set(0, -0.035, z); world.add(cross);
        for (let k = -5; k <= 5; k++) {
          const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.16), white);
          dash.rotation.x = -Math.PI / 2; dash.position.set(k * 2.4, 0.012, z); world.add(dash);
        }
      }
      for (let row = 0; row < 12; row++) {
        for (const side of [-1, 1]) {
          const x = side * (28 + (row % 3) * 5);
          const z = -66 + row * 12;
          const h = country === 'USA' ? 12 + (row % 5) * 4 : 5 + (row % 4) * 2;
          const w = 7 + (row % 3) * 2;
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 9), mat(buildingColors[(row + 2) % buildingColors.length]));
          b.position.set(x, h / 2, z); world.add(b);
          for (let wy = 1.5; wy < h - 1; wy += 2.3) {
            for (let wx = -w / 2 + 1; wx < w / 2; wx += 1.8) {
              const win = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.85, 0.07), mat('#5f91a7', 0.3));
              win.position.set(x + wx, wy, z + 4.54); world.add(win);
            }
          }
        }
      }
      // Trees along the pavement.
      for (let z = -65; z <= 65; z += 13) for (const side of [-1, 1]) {
        const x = side * 11.2;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.5, 6), mat('#79553a'));
        trunk.position.set(x, 0.7, z); world.add(trunk);
        const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.05, 10, 8), mat('#43834d'));
        leaves.position.set(x, 1.95, z); world.add(leaves);
      }
      // Raised crosswalk bars near the intersection.
      for (let i = 0; i < 7; i++) {
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.42), mat('#e5e5dc'));
        bar.rotation.x = -Math.PI / 2; bar.position.set(-3.7 + i * 1.23, 0.022, 14); world.add(bar);
      }
      // Country-specific street props make each starter region feel distinct.
      const makeBox = (w, h, d, color, x, y, z, parent = world) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
        mesh.position.set(x, y, z); parent.add(mesh); return mesh;
      };
      // A simple flag pole and a deliberately low-poly country flag.
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 5.5, 6), mat('#d5d9dd'));
      pole.position.set(-5.3, 2.75, -5); world.add(pole);
      let driveVehicle = null;
      if (country === 'Nigeria') {
        makeBox(0.09, 1.7, 2.5, '#168447', -4.6, 4.1, -5);
        makeBox(0.09, 1.7, 0.84, '#f7f7f2', -4.55, 4.1, -5);
        // Market kiosks with colourful awnings and a yellow/green danfo minibus.
        for (let i = 0; i < 3; i++) {
          const x = -4.8 + i * 3.2, z = 19 + i * 2.2;
          makeBox(2.5, 1.55, 1.8, ['#b97843', '#a85e3d', '#d0a15e'][i], x, 0.8, z);
          makeBox(2.8, 0.25, 2.1, ['#e3bd42', '#c84b3f', '#27844d'][i], x, 1.75, z);
          makeBox(0.5, 0.7, 0.08, '#4b8190', x - 0.55, 1.05, z + 0.94);
          makeBox(0.5, 0.7, 0.08, '#4b8190', x + 0.55, 1.05, z + 0.94);
        }
        const bus = new THREE.Group(); driveVehicle = bus;
        makeBox(2.35, 1.5, 4.2, '#e6bd23', 0, 1.05, 0, bus);
        makeBox(2.38, 0.3, 4.22, '#208b4b', 0, 0.55, 0, bus);
        makeBox(2.0, 0.52, 0.08, '#75b7ca', 0, 1.45, 2.12, bus);
        makeBox(2.0, 0.52, 0.08, '#75b7ca', 0, 1.45, -2.12, bus);
        for (const x of [-1.15, 1.15]) for (const z of [-1.35, 1.35]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 10), mat('#20272b'));
          wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.36, z); bus.add(wheel);
        }
        bus.position.set(3.8, 0, -3); bus.rotation.y = Math.PI / 2; world.add(bus);
      } else {
        // US flag stripes and blue canton, a yellow cab, and a small red hydrant.
        for (let i = 0; i < 7; i++) makeBox(0.08, 0.16, 2.1, i % 2 ? '#ffffff' : '#c83c45', -4.6, 4.7 - i * 0.23, -5);
        makeBox(0.08, 0.65, 0.78, '#254a87', -4.55, 4.55, -5.65);
        const taxi = new THREE.Group(); driveVehicle = taxi;
        makeBox(2.25, 1.05, 4.0, '#f2c52f', 0, 0.85, 0, taxi);
        makeBox(1.65, 0.68, 1.75, '#78a8bd', 0, 1.55, -0.15, taxi);
        makeBox(0.9, 0.14, 0.45, '#fff5c6', 0, 1.45, 1.8, taxi);
        for (const x of [-1.1, 1.1]) for (const z of [-1.25, 1.25]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 10), mat('#20272b'));
          wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.3, z); taxi.add(wheel);
        }
        taxi.position.set(-3.6, 0, -4); taxi.rotation.y = -Math.PI / 2; world.add(taxi);
        const hydrant = new THREE.Group();
        const red = mat('#c7463d');
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.45, 8), red); base.position.y = 0.25; hydrant.add(base);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.42, 8), red); top.position.y = 0.66; hydrant.add(top);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), red); cap.position.y = 0.9; hydrant.add(cap);
        hydrant.position.set(5.5, 0, 8); world.add(hydrant);
      }

      // Player character: simple stylized body and head.
      const player = new THREE.Group();
      const shirt = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.65, 4, 8), mat('#19b7a1'));
      shirt.position.y = 1.12; player.add(shirt);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 10), mat('#9b6848'));
      head.position.y = 1.95; player.add(head);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#252323'));
      hair.position.y = 2.08; player.add(hair);
      const legMat = mat('#24374b');
      const animatedLegs = []; const animatedArms = [];
      const skinMat = mat(country === 'Nigeria' ? '#8f5d3e' : '#c48e69');
      for (const lx of [-0.18, 0.18]) {
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.38, 3, 6), legMat);
        leg.position.set(lx, 0.39, 0); player.add(leg); animatedLegs.push({ mesh: leg, side: lx < 0 ? -1 : 1 });
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.32), mat('#20252a'));
        shoe.position.set(lx, 0.08, 0.07); player.add(shoe);
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.38, 3, 6), skinMat);
        arm.position.set(lx * 2.25, 1.12, 0.02); arm.rotation.z = lx < 0 ? -0.12 : 0.12; player.add(arm); animatedArms.push({ mesh: arm, side: lx < 0 ? -1 : 1 });
      }
      player.position.set(0, 0, 8); world.add(player);

      // Enable shadows on geometry while keeping the renderer lightweight for phones.
      world.traverse(obj => {
        if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
      });
      const keys = new Set();
      let yaw = 0;
      const onKeyDown = e => { if (['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) { keys.add(e.key.toLowerCase()); } };
      const onKeyUp = e => keys.delete(e.key.toLowerCase());
      window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
      let dragging = false, lastX = 0;
      const down = e => { dragging = true; lastX = e.clientX; renderer.domElement.setPointerCapture?.(e.pointerId); };
      const move = e => { if (dragging) { yaw -= (e.clientX - lastX) * 0.005; lastX = e.clientX; } };
      const up = () => { dragging = false; };
      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);
      renderer.domElement.addEventListener('pointercancel', up);
      let driving = false, vehicleSpeed = 0, walkPhase = 0;
      let multiplayer = null; const remotePlayers = new Map();
      if (token) {
        multiplayer = io((import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '') || undefined, { transports: ['websocket','polling'], auth: { token } });
        multiplayer.on('world:positions', payload => {
          const live = new Set();
          for (const p of (payload.players || [])) {
            if (p.id === multiplayer.id) continue;
            live.add(p.id);
            let avatar = remotePlayers.get(p.id);
            if (!avatar) {
              avatar = new THREE.Group();
              const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38,0.65,4,8), mat('#e6a34a'));
              torso.position.y=1.1; avatar.add(torso);
              const h = new THREE.Mesh(new THREE.SphereGeometry(0.29,10,8), mat('#b9815d')); h.position.y=1.92; avatar.add(h);
              scene.add(avatar); remotePlayers.set(p.id, avatar);
            }
            avatar.position.set(THREE.MathUtils.clamp(p.x,-38,38),0,THREE.MathUtils.clamp(p.z,-78,78));
            avatar.rotation.y = Number(p.yaw) || 0;
          }
          for (const [id, avatar] of remotePlayers) if (!live.has(id)) { scene.remove(avatar); remotePlayers.delete(id); }
        });
      }
      const onDriveKey = e => {
        if (e.key.toLowerCase() === 'e' && !e.repeat) {
          driving = !driving;
          if (driveVehicle) {
            if (driving) { driveVehicle.position.set(player.position.x, 0, player.position.z); driveVehicle.rotation.y = player.rotation.y; }
            else { player.position.x = driveVehicle.position.x + 2.5; player.position.z = driveVehicle.position.z; }
          }
        }
      };
      window.addEventListener('keydown', onDriveKey);
      let lastTime = 0, frame = 0, active = true;
      const resize = () => {
        if (!host.clientWidth || !host.clientHeight) return;
        renderer.setSize(host.clientWidth, host.clientHeight, false);
        camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize); observer.observe(host); resize();
      const animate = now => {
        if (!active) return;
        frame = requestAnimationFrame(animate);
        const dt = Math.min((now - lastTime) / 1000 || 0, 0.05); lastTime = now;
        const forward = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
        const strafe = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
        if (driving && driveVehicle) {
          vehicleSpeed = THREE.MathUtils.damp(vehicleSpeed, forward * 18, 3.0, dt);
          driveVehicle.rotation.y += strafe * dt * (Math.abs(vehicleSpeed) > 0.2 ? 1.4 : 0.3);
          driveVehicle.position.x += Math.sin(driveVehicle.rotation.y) * vehicleSpeed * dt;
          driveVehicle.position.z += Math.cos(driveVehicle.rotation.y) * vehicleSpeed * dt;
          driveVehicle.position.x = THREE.MathUtils.clamp(driveVehicle.position.x, -40, 40);
          driveVehicle.position.z = THREE.MathUtils.clamp(driveVehicle.position.z, -78, 78);
          player.position.set(driveVehicle.position.x, 0, driveVehicle.position.z);
          player.visible = false;
        } else {
          player.visible = true;
          if (forward || strafe) {
            const speed = 7.5 * dt;
            player.position.x += (Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * speed;
            player.position.z += (Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * speed;
            player.position.x = THREE.MathUtils.clamp(player.position.x, -40, 40);
            player.position.z = THREE.MathUtils.clamp(player.position.z, -78, 78);
            player.rotation.y = Math.atan2(strafe, forward) + yaw;
            walkPhase += dt * 10;
          }
          animatedLegs.forEach(({mesh,side}) => { mesh.rotation.x = (forward || strafe) ? Math.sin(walkPhase) * 0.55 * side : 0; });
          animatedArms.forEach(({mesh,side}) => { mesh.rotation.x = (forward || strafe) ? -Math.sin(walkPhase) * 0.42 * side : 0; });
        }
        if (multiplayer?.connected && Math.floor(now / 100) !== Math.floor((now - dt * 1000) / 100)) {
          multiplayer.emit('world:position', { x: player.position.x, z: player.position.z, yaw: player.rotation.y, country, city });
        }
        const target = new THREE.Vector3(player.position.x, driving ? 1.8 : 1.4, player.position.z);
        const cameraOffset = new THREE.Vector3(Math.sin(driving ? driveVehicle.rotation.y : yaw) * (driving ? 10 : 6.4), driving ? 5.2 : 4.1, Math.cos(driving ? driveVehicle.rotation.y : yaw) * (driving ? 10 : 6.4));
        camera.position.lerp(target.clone().add(cameraOffset), 0.12);
        camera.lookAt(target);
        renderer.render(scene, camera);
        if (Math.floor(now / 250) !== Math.floor((now - dt * 1000) / 250)) setPosition({ x: Math.round(player.position.x), z: Math.round(player.position.z) });
      };
      frame = requestAnimationFrame(animate);
      return () => {
        active = false; cancelAnimationFrame(frame); observer.disconnect();
        window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('keydown', onDriveKey); multiplayer?.disconnect();
        renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move);
        renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointercancel', up);
        scene.traverse(obj => { obj.geometry?.dispose?.(); if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material?.dispose?.(); });
        renderer.dispose(); renderer.domElement.remove();
      };
    } catch (err) {
      console.error('3D world could not start:', err);
      host.innerHTML = '<div class="world3d-fallback">Your browser could not start WebGL. Try Chrome or enable hardware acceleration.</div>';
      return undefined;
    }
  }, []);

  return <div className="world3d-page">
    <div className="world3d-heading"><div><span className="eyebrow">3D OPEN-WORLD STYLE · EARLY PROTOTYPE</span><h1>Explore <em>{city}</em></h1><p>{country === 'Nigeria' ? '🇳🇬 Nigeria world · local market stalls, danfo minibus and warm Lagos-style streets.' : '🇺🇸 USA world · taller city blocks, a yellow taxi and American street details.'} Walk with WASD/arrows; press E near the street vehicle to drive/exit; drag to look around.</p></div><div className="world3d-coords"><small>POSITION</small><b>{position.x}, {position.z}</b></div></div>
    <div className="world3d-stage" ref={hostRef}>
      <div className="world3d-hud"><span className="world3d-live"><i/> WORLD LIFE 4K</span><span>{username}</span></div>
      {helpOpen && <div className="world3d-help"><button aria-label="Close controls" onClick={() => setHelpOpen(false)}>×</button><b>How to play</b><p><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or arrows to move.</p><p><kbd>E</kbd> to enter/exit the street vehicle; use arrows to steer.</p><p>Drag the scene to turn the camera.</p><small>Prototype multiplayer requires a reachable backend and matching country region.</small></div>}
    </div>
    <div className="world3d-note"><span>🕹️</span><div><b>Next game systems</b><p>Next: larger explorable districts, drivable vehicles, missions, character customization and synchronized multiplayer. This is a stylized low-poly 3D prototype, not GTA-level graphics yet.</p></div></div>
  </div>;
}
