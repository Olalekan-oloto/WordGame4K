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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      host.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xe8f6ff, 0x4b5540, 1.75));
      const sun = new THREE.DirectionalLight(0xffe4b5, 3.0);
      sun.position.set(-24, 38, 16);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -48; sun.shadow.camera.right = 48;
      sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
      sun.shadow.bias = -0.00025;
      scene.add(sun);

      const mat = (color, roughness = 1, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
      // Procedural road grain and fine lane wear: no external assets or network required.
      const roadCanvas = document.createElement('canvas'); roadCanvas.width = 256; roadCanvas.height = 256;
      const roadCtx = roadCanvas.getContext('2d'); roadCtx.fillStyle = '#343a3e'; roadCtx.fillRect(0,0,256,256);
      let seed = country === 'Nigeria' ? 241 : 719;
      const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      for (let i=0;i<2600;i++) { const v=rand(); roadCtx.fillStyle = v>.5 ? 'rgba(220,220,210,.075)' : 'rgba(0,0,0,.12)'; roadCtx.fillRect(rand()*256,rand()*256,1+rand()*2,1+rand()*2); }
      const roadTexture = new THREE.CanvasTexture(roadCanvas); roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping; roadTexture.repeat.set(2,18); roadTexture.colorSpace = THREE.SRGBColorSpace;
      const grass = mat(country === 'Nigeria' ? '#78945c' : '#688b59');
      const road = new THREE.MeshStandardMaterial({ map: roadTexture, color: '#777f83', roughness: 0.94 });
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
              const frame = new THREE.Mesh(new THREE.BoxGeometry(0.64,0.71,0.045), mat(country === 'Nigeria' ? '#d6c3a2' : '#d9e0e5',0.8));
              frame.position.set(x + wx, wy, z + (side < 0 ? 3.50 : -3.50)); world.add(frame);
              windowMesh.position.z += side < 0 ? 0.035 : -0.035;
            }
          }
          // Facade ledges, balconies and air-conditioning units add layered architectural detail.
          for (let fy=3.2; fy<height; fy+=3.2) {
            const ledge = new THREE.Mesh(new THREE.BoxGeometry(width+0.18,0.12,7.16),mat('#b9b6ad',0.9));
            ledge.position.set(x,fy,z); world.add(ledge);
            if ((row + (side > 0 ? 1 : 0)) % 3 === 0) {
              const balcony = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72,0.12,0.72),mat(country === 'Nigeria' ? '#a99a83' : '#aab5bf',0.8));
              balcony.position.set(x,fy+0.48,z+(side<0?3.8:-3.8)); world.add(balcony);
              const rail = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72,0.38,0.07),mat('#46545a',0.65,{metalness:0.25}));
              rail.position.set(x,fy+0.72,z+(side<0?4.12:-4.12)); world.add(rail);
            }
          }
          for (let acy=2.4; acy<height-0.5; acy+=3.8) {
            const ac = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.38,0.32),mat('#c7c9c6',0.78,{metalness:0.15}));
            ac.position.set(x+width*0.32,acy,z+(side<0?3.62:-3.62)); world.add(ac);
          }
          if (row % 2 === 0) {
            const sign = new THREE.Mesh(new THREE.BoxGeometry(Math.min(width*0.78,4.1),0.55,0.14),mat(country === 'Nigeria' ? '#176d4b' : '#263e5b'));
            sign.position.set(x,2.25,z+(side<0?3.64:-3.64)); world.add(sign);
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
        const leafMat = mat(country === 'Nigeria' ? '#3d7842' : '#47794b',0.96);
        const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.12, 10, 8), leafMat);
        leaves.scale.set(1.12,1.0,1.0); leaves.position.set(x, 2.05, z); world.add(leaves);
        for (const [ox,oy,oz,s] of [[-0.48,0.35,0.12,0.72],[0.46,0.28,-0.12,0.78],[0,0.72,0,0.68]]) {
          const crown = new THREE.Mesh(new THREE.SphereGeometry(s,8,7),leafMat);
          crown.position.set(x+ox,2.0+oy,z+oz); world.add(crown);
        }
      }
      // Street furniture, overhead wires, lamps and roadside details.
      for (let z=-60; z<=60; z+=20) for (const side of [-1,1]) {
        const lamp = new THREE.Group();
        const poleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.11,4.4,8),mat('#4c5658',0.7));
        poleMesh.position.y=2.2; lamp.add(poleMesh);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.08,0.08),mat('#4c5658',0.7)); arm.position.set(side<0?0.38:-0.38,4.25,0); lamp.add(arm);
        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.12,0.22),mat('#f4e5b5',0.35,{emissive:'#5b5030',emissiveIntensity:0.35}));
        bulb.position.set(side<0?0.75:-0.75,4.18,0); lamp.add(bulb);
        lamp.position.set(side*12.8,0,z); world.add(lamp);
      }
      // Roadside drain covers, painted kerb breaks and small utility cabinets.
      for (let z=-62; z<70; z+=8) {
        const drain = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.025,1.15),mat('#555c5d',0.95));
        drain.position.set(-7.7,0.035,z); world.add(drain);
        if (z%16===-14 || z%16===2) {
          const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.62,1.1,0.55),mat('#77817b',0.85));
          cabinet.position.set(10.6,0.55,z+2); world.add(cabinet);
        }
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
      // Textured signboards for recognizable Lagos street commerce.
      const makeShopSign = (label, x, y, z, color = '#176746', width = 2.6) => {
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f7eed6'; ctx.fillRect(0,0,512,128);
        ctx.fillStyle = color; ctx.fillRect(7,7,498,114); ctx.fillStyle = '#fff7df';
        ctx.font = 'bold 42px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label,256,64,475);
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
        const board = new THREE.Mesh(new THREE.PlaneGeometry(width,width*0.25),new THREE.MeshStandardMaterial({map:texture,roughness:0.85}));
        board.position.set(x,y,z); world.add(board); return board;
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
        makeShopSign('EKO MARKET',-4.7,2.22,20.0,'#176746',2.5);
        makeShopSign('POS • AIRTIME',-1.5,2.22,22.2,'#b64a2f',2.5);
        makeShopSign('MAMA PUT',1.7,2.22,24.4,'#a66a18',2.5);
        // More roadside kiosks with painted awnings along the market street.
        for (let i=0;i<5;i++) {
          const x=i%2===0?-10.7:10.7, z=-26+i*11.5;
          makeBox(2.0,1.65,1.5,['#d0a05e','#9e6844','#c77a43'][i%3],x,0.83,z);
          makeBox(2.35,0.22,1.8,['#e3b72e','#247b4d','#d94e3f'][i%3],x,1.75,z);
          makeBox(0.58,0.7,0.08,'#39798b',x-0.48,1.0,z+0.78);
          makeBox(0.58,0.7,0.08,'#39798b',x+0.48,1.0,z+0.78);
        }
        // Keke Napep tricycle parked beside the curb.
        const keke=new THREE.Group();
        makeBox(1.45,0.7,1.8,'#e7c52a',0,0.82,0,keke);
        makeBox(1.38,0.12,1.72,'#176f42',0,1.2,0,keke);
        makeBox(1.3,0.08,1.55,'#e7c52a',0,1.9,-0.05,keke);
        for(const x of [-0.62,0.62]) for(const zz of [-0.7,0.65]) makeBox(0.07,0.68,0.07,'#26363a',x,1.54,zz,keke);
        makeBox(1.0,0.48,0.045,'#8db8c2',0,1.52,0.82,keke);
        for(const [x,zz] of [[-0.72,-0.55],[0.72,-0.55],[0,0.66]]) { const wh=new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.27,0.15,12),mat('#202528')); wh.rotation.z=Math.PI/2; wh.position.set(x,0.28,zz); keke.add(wh); }
        keke.position.set(5.7,0,13); keke.rotation.y=-0.15; world.add(keke);
        // Okada motorcycle: frame, saddle, handlebars and rubber wheels.
        const bike=new THREE.Group();
        for(const zz of [-0.72,0.72]) { const wh=new THREE.Mesh(new THREE.TorusGeometry(0.28,0.075,8,14),mat('#202326',0.95)); wh.rotation.y=Math.PI/2; wh.position.set(0,0.31,zz); bike.add(wh); }
        makeBox(0.14,0.38,0.58,'#d8a52a',0,0.62,0,bike); makeBox(0.52,0.12,0.32,'#1c2528',0,0.9,-0.08,bike);
        makeBox(0.12,0.44,0.12,'#2a3032',0,0.65,0.55,bike); makeBox(0.62,0.06,0.08,'#31383a',0,0.85,0.78,bike);
        bike.position.set(-5.6,0,11); bike.rotation.y=0.2; world.add(bike);
        // Power poles and overhead cables, a familiar detail on Lagos streets.
        for(const x of [-12.2,12.2]) for(let z=-50;z<=55;z+=26) {
          const poleMesh=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.13,6.2,7),mat('#665e50')); poleMesh.position.set(x,3.1,z); world.add(poleMesh);
          const arm=new THREE.Mesh(new THREE.BoxGeometry(1.25,0.1,0.12),mat('#665e50')); arm.position.set(x,5.7,z); world.add(arm);
        }
        const cableMat=new THREE.LineBasicMaterial({color:'#333a3b',transparent:true,opacity:0.72});
        for(let z=-50;z<55;z+=26) { const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-12.2,5.7,z),new THREE.Vector3(0,5.15,z+3),new THREE.Vector3(12.2,5.7,z)]); world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)),cableMat)); }
        // Stationary market pedestrians add a sense of scale.
        const makePedestrian=(x,z,shirtColor,skinColor)=>{ const ped=new THREE.Group(); const torso=new THREE.Mesh(new THREE.CapsuleGeometry(0.2,0.48,3,7),mat(shirtColor)); torso.position.y=1.12; ped.add(torso); const face=new THREE.Mesh(new THREE.SphereGeometry(0.16,10,8),mat(skinColor)); face.position.y=1.72; ped.add(face); for(const lx of [-0.11,0.11]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(0.065,0.35,2,5),mat('#303a42'));leg.position.set(lx,0.42,0);ped.add(leg);} ped.position.set(x,0,z); world.add(ped); };
        makePedestrian(-8.9,5.5,'#2d6f4e','#6e4935'); makePedestrian(8.9,7.2,'#d7a13a','#85563b'); makePedestrian(-9.3,29,'#b64b3d','#754a32');
        const bus = new THREE.Group(); driveVehicle = bus;
        makeBox(2.35, 1.5, 4.2, '#e6bd23', 0, 1.05, 0, bus);
        makeBox(2.38, 0.3, 4.22, '#208b4b', 0, 0.55, 0, bus);
        makeBox(1.88, 0.72, 2.35, '#e6bd23', 0, 1.72, -0.15, bus);
        makeBox(1.98, 0.52, 0.08, '#72a9ba', 0, 1.52, 2.12, bus);
        makeBox(1.98, 0.52, 0.08, '#72a9ba', 0, 1.52, -2.12, bus);
        for (const side of [-1,1]) for (const z of [-0.65,0.62]) makeBox(0.06,0.46,0.82,'#6a9eac',side*1.19,1.47,z,bus);
        makeBox(1.1,0.3,0.08,'#202a2e',0,0.72,2.13,bus);
        for (const x of [-0.82,0.82]) makeBox(0.36,0.2,0.08,'#fff2c6',x,1.12,2.14,bus);
        makeBox(0.4,0.22,0.08,'#e94c3e',-0.75,1.08,-2.14,bus);
        makeBox(0.4,0.22,0.08,'#e94c3e',0.75,1.08,-2.14,bus);
        for (const x of [-1.15, 1.15]) for (const z of [-1.35, 1.35]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 10), mat('#20272b'));
          wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.36, z); bus.add(wheel);
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,0.195,12),mat('#a9b0b2',0.45));
          hub.rotation.z=Math.PI/2; hub.position.set(x*1.015,0.36,z); bus.add(hub);
        }
        bus.position.set(3.8, 0, -3); bus.rotation.y = Math.PI / 2; world.add(bus);
      } else {
        // US flag stripes and blue canton, a yellow cab, and a small red hydrant.
        for (let i = 0; i < 7; i++) makeBox(0.08, 0.16, 2.1, i % 2 ? '#ffffff' : '#c83c45', -4.6, 4.7 - i * 0.23, -5);
        makeBox(0.08, 0.65, 0.78, '#254a87', -4.55, 4.55, -5.65);
        const taxi = new THREE.Group(); driveVehicle = taxi;
        makeBox(2.25, 1.05, 4.0, '#f2c52f', 0, 0.85, 0, taxi);
        makeBox(1.75, 0.78, 2.0, '#78a8bd', 0, 1.48, -0.12, taxi);
        makeBox(1.86,0.08,2.18,'#d9e0df',0,1.9,-0.12,taxi);
        makeBox(1.1,0.08,0.12,'#f7f1dd',0,1.48,2.02,taxi);
        for (const x of [-0.82,0.82]) {
          makeBox(0.32,0.18,0.08,'#fff4c9',x,0.93,2.03,taxi);
          makeBox(0.28,0.18,0.08,'#e84a42',x,0.8,-2.02,taxi);
        }
        makeBox(0.62,0.16,0.34,'#fff0b4',0,1.45,0.3,taxi);
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

      // Small vehicle details catch the light and make the cars read less like plain blocks.
      if (driveVehicle) {
        const isBus = country === 'Nigeria';
        const sideTrim = mat(isBus ? '#176b42' : '#c9a222',0.52,{metalness:0.22});
        for (const side of [-1,1]) {
          const trim = new THREE.Mesh(new THREE.BoxGeometry(0.055,0.12,isBus?3.1:2.8),sideTrim);
          trim.position.set(side*(isBus?1.205:1.14),isBus?0.82:0.9,0); driveVehicle.add(trim);
          const mirrorStem = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.08,0.28),mat('#252c30',0.42,{metalness:0.35}));
          mirrorStem.position.set(side*(isBus?1.25:1.18),1.42,1.35); driveVehicle.add(mirrorStem);
          const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.18,0.12),mat('#20282d',0.3,{metalness:0.4}));
          mirror.position.set(side*(isBus?1.32:1.25),1.46,1.42); driveVehicle.add(mirror);
        }
        const bumper = new THREE.Mesh(new THREE.BoxGeometry(isBus?2.18:2.12,0.16,0.16),mat('#41484b',0.55,{metalness:0.28}));
        bumper.position.set(0,0.46,2.15); driveVehicle.add(bumper);
      }

      // Player character: stylized third-person avatar with layered clothing and shoes.
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
      const touchDown = e => keys.add(String(e.detail || '').toLowerCase());
      const touchUp = e => keys.delete(String(e.detail || '').toLowerCase());
      window.addEventListener('wl4k-control-down', touchDown);
      window.addEventListener('wl4k-control-up', touchUp);
      let yaw = 0;
      const onKeyDown = e => { if (['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) { keys.add(e.key.toLowerCase()); } };
      const onKeyUp = e => keys.delete(e.key.toLowerCase());
      window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
      // Never leave a movement key stuck if the player switches apps or the browser loses focus.
      const clearControls = () => keys.clear();
      window.addEventListener('blur', clearControls);
      document.addEventListener('visibilitychange', clearControls);
      let dragging = false, lastX = 0;
      const down = e => {
        // Mouse, pen and finger drags all rotate the camera on desktop and mobile.
        dragging = true; lastX = e.clientX;
        renderer.domElement.setPointerCapture?.(e.pointerId);
      };
      const move = e => {
        if (dragging) { yaw -= (e.clientX - lastX) * 0.005; lastX = e.clientX; }
      };
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
        window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', clearControls); document.removeEventListener('visibilitychange', clearControls); window.removeEventListener('keydown', onDriveKey); window.removeEventListener('wl4k-control-down', touchDown); window.removeEventListener('wl4k-control-up', touchUp); multiplayer?.disconnect();
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
    <div className="world3d-heading"><div><span className="eyebrow">3D OPEN-WORLD STYLE · EARLY PROTOTYPE</span><h1>Explore <em>{city}</em></h1><p>{country === 'Nigeria' ? '🇳🇬 Nigeria world · local market stalls, danfo minibus and warm Lagos-style streets.' : '🇺🇸 USA world · taller city blocks, a yellow taxi and American street details.'} Use WASD/arrows or the on-screen pad; press E or DRIVE to enter/exit a vehicle; drag to look around.</p></div><div className="world3d-coords"><small>POSITION</small><b>{position.x}, {position.z}</b></div></div>
    <div className="world3d-stage" ref={hostRef}>
      <div className="world3d-hud"><span className="world3d-live"><i/> WORLD LIFE 4K</span><span>{username}</span></div>
      <div className="world3d-touch" aria-label="Touch game controls">
        <div className="world3d-pad">
          <button aria-label="Move forward" onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);window.dispatchEvent(new CustomEvent('wl4k-control-down',{detail:'w'}));}} onPointerUp={()=>window.dispatchEvent(new CustomEvent('wl4k-control-up',{detail:'w'}))} onPointerCancel={()=>window.dispatchEvent(new CustomEvent('wl4k-control-up',{detail:'w'}))} onLostPointerCapture={()=>window.dispatchEvent(new CustomEvent('wl4k-control-up',{detail:'w'}))}>▲</button>
          <div><button aria-label="Move left" onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);window.dispatchEvent(new CustomEvent('wl4k-control-down',{detail:'a'}));}} onPointerUp={()=>window.dispatchEvent(new CustomEvent('wl4k-control-up',{detail:'a'}))} onPointerCancel={()=>window.dispatchEvent(new CustomEvent('wl4k-control-up',{detail:'a'}))} onLostPointerCapture={()=>window.dispatchEvent(new CustomEvent('wl4k-control-up',{detail:'a'}))}>◀</button><button aria-label="Move backward" onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);window.dispatchEvent(new CustomEvent('wl4k-control-down',{detail:'s'}));}} onPointerUp={()=>window.dispatchEvent(new CustomEvent('wl4k-control-up',{detail:'s'}))} onPointerCancel={()=>window.dispatchEvent(new CustomEvent('wl4k-control-up',{detail:'s'}))} onLostPointerCapture={()=>window.dispatchEvent(new CustomEvent('wl4k-control-up',{detail:'s'}))}>▼</button><button aria-label="Move right" onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);window.dispatchEvent(new CustomEvent('wl4k-control-down',{detail:'d'}));}} onPointerUp={()=>window.dispatchEvent(new CustomEvent('wl4k-control-up',{detail:'d'}))} onPointerCancel={()=>window.dispatchEvent(new CustomEvent('wl4k-control-up',{detail:'d'}))} onLostPointerCapture={()=>window.dispatchEvent(new CustomEvent('wl4k-control-up',{detail:'d'}))}>▶</button></div>
        </div>
        <button className="world3d-drive" onClick={()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'e'}))}>DRIVE / EXIT</button>
      </div>
      {helpOpen && <div className="world3d-help"><button aria-label="Close controls" onClick={() => setHelpOpen(false)}>×</button><b>How to play</b><p><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or arrows to move.</p><p><kbd>E</kbd> to enter/exit the street vehicle; use arrows to steer.</p><p>Drag the scene to turn the camera.</p><small>Prototype multiplayer requires a reachable backend and matching country region.</small></div>}
    </div>
    <div className="world3d-note"><span>🕹️</span><div><b>Next game systems</b><p>Next: larger explorable districts, drivable vehicles, missions, character customization and synchronized multiplayer. Enhanced browser 3D prototype with textured roads, detailed street props and touch controls. It is not a AAA photorealistic game.</p></div></div>
  </div>;
}
