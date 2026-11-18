// Rendering: top-down Canvas 2D. Draws the city (roads, beach, sea, pier,
// buildings, palms), cars, people, effects, the HUD, and the minimap.
// The camera follows the player with a smoothed chase offset.
import { WORLD_W, WORLD_H, BEACH_Y, WATER_Y, STREET, ROAD_W } from './world.js';

export function makeRenderer(canvas, miniCanvas) {
  const ctx = canvas.getContext('2d');
  const mctx = miniCanvas.getContext('2d');
  const cam = { x: 0, y: 0 };

  function updateCamera(px, py, vx, vy, dt) {
    const tx = px - canvas.width / 2 + vx * 0.12;
    const ty = py - canvas.height / 2 + vy * 0.12;
    cam.x += (tx - cam.x) * Math.min(1, dt * 5);
    cam.y += (ty - cam.y) * Math.min(1, dt * 5);
    cam.x = Math.max(-80, Math.min(WORLD_W - canvas.width + 80, cam.x));
    cam.y = Math.max(-80, Math.min(WORLD_H - canvas.height + 80, cam.y));
  }

  function drawCar(c, color, police) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    const L = c.w, W = c.h;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
    ctx.fillStyle = color;
    roundRect(-L / 2, -W / 2, L, W, 7);
    ctx.fill();
    // cabin + windshield
    ctx.fillStyle = 'rgba(20,28,38,0.85)';
    roundRect(-L * 0.18, -W / 2 + 4, L * 0.34, W - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.5)';
    ctx.fillRect(L * 0.16, -W / 2 + 5, 4, W - 10);
    // headlights / taillights
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(L / 2 - 2, -W / 2 + 2, 3, 5);
    ctx.fillRect(L / 2 - 2, W / 2 - 7, 3, 5);
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(-L / 2 - 1, -W / 2 + 2, 3, 5);
    ctx.fillRect(-L / 2 - 1, W / 2 - 7, 3, 5);
    if (police) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-6, -W / 2 - 2, 12, 4);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 2);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPerson(p, t) {
    ctx.save();
    ctx.translate(p.x, p.y);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 6, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(p.angle);
    // legs (simple walk cycle)
    const step = p.speed > 5 ? Math.sin(t * 12) * 4 : 0;
    ctx.strokeStyle = '#2b2b33';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 2); ctx.lineTo(-6 + step, 12);
    ctx.moveTo(0, 2); ctx.lineTo(-6 - step, 12);
    ctx.stroke();
    // torso
    ctx.fillStyle = p.shirt;
    roundRect(-7, -8, 14, 16, 5); ctx.fill();
    // arms
    ctx.strokeStyle = p.shirt; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(4, -4); ctx.lineTo(12, 2);
    ctx.moveTo(4, 4); ctx.lineTo(12, 8);
    ctx.stroke();
    // head
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(8, -2, 6, 0, Math.PI * 2); ctx.fill();
    // pistol in hand when armed
    if (p.kind !== 'ped') {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(11, 0, 9, 3);
    }
    ctx.restore();
    if (p.kind === 'viper') {
      ctx.fillStyle = '#ff5a5a';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VIPER', p.x, p.y - 16);
    }
  }

  function drawWorld(world, state, t) {
    const night = state.night;
    const dusk = state.dusk;
    // View rect for culling: skip anything fully off-screen.
    const vx0 = cam.x - 60, vy0 = cam.y - 60;
    const vx1 = cam.x + canvas.width + 60, vy1 = cam.y + canvas.height + 60;
    const visible = (x, y, w, h) => x + w > vx0 && x < vx1 && y + h > vy0 && y < vy1;
    // ground
    ctx.fillStyle = night ? '#23282e' : dusk ? '#c98a5e' : '#8fae6d';
    ctx.fillRect(cam.x - 100, cam.y - 100, canvas.width + 200, canvas.height + 200);
    // suburbs grass tint blocks
    ctx.fillStyle = night ? '#262b26' : dusk ? '#b98a5e' : '#a4bd7d';
    for (let gx = 0; gx < 8; gx++) {
      for (let gy = 0; gy < 5; gy++) {
        ctx.fillRect(gx * STREET + ROAD_W, gy * STREET + ROAD_W, STREET - ROAD_W, STREET - ROAD_W);
      }
    }
    // beach + sea
    ctx.fillStyle = night ? '#4a4238' : dusk ? '#e0a866' : '#e8d29a';
    ctx.fillRect(cam.x - 100, BEACH_Y, canvas.width + 200, WATER_Y - BEACH_Y);
    ctx.fillStyle = night ? '#0e2233' : dusk ? '#c96a3b' : '#2e7fa8';
    ctx.fillRect(cam.x - 100, WATER_Y, canvas.width + 200, WORLD_H - WATER_Y + 200);
    // waves
    ctx.strokeStyle = night ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const wy = WATER_Y + 24 + i * 26 + Math.sin(t * 1.2 + i * 2) * 4;
      ctx.beginPath();
      for (let x = cam.x - 100; x < cam.x + canvas.width + 100; x += 40) {
        ctx.lineTo(x, wy + Math.sin(x * 0.02 + t + i) * 3);
      }
      ctx.stroke();
    }
    // roads
    ctx.fillStyle = night ? '#2c3138' : '#3a3f46';
    for (let i = 0; i <= 8; i++) ctx.fillRect(i * STREET, 0, ROAD_W, BEACH_Y);
    for (let j = 0; j <= 5; j++) ctx.fillRect(0, j * STREET, WORLD_W, ROAD_W);
    // highway ring
    ctx.strokeStyle = night ? '#33383f' : '#454a52';
    ctx.lineWidth = 26;
    ctx.strokeRect(26, 26, WORLD_W - 52, WORLD_H - 52);
    // centre dashes
    ctx.strokeStyle = night ? '#8a7a3a' : '#e8d44d';
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo(i * STREET + ROAD_W / 2, 0); ctx.lineTo(i * STREET + ROAD_W / 2, BEACH_Y); ctx.stroke();
    }
    for (let j = 0; j <= 5; j++) {
      ctx.beginPath(); ctx.moveTo(0, j * STREET + ROAD_W / 2); ctx.lineTo(WORLD_W, j * STREET + ROAD_W / 2); ctx.stroke();
    }
    ctx.setLineDash([]);
    // crosswalks at the plaza
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let k = 0; k < 6; k++) ctx.fillRect(1560 + k * 12, 1180, 6, 40);
    // pier: wooden deck into the sea
    ctx.fillStyle = '#7a5a38';
    ctx.fillRect(1560, 2000, 80, 260);
    ctx.strokeStyle = '#5d4326';
    ctx.lineWidth = 2;
    for (let y = 2020; y < 2260; y += 18) {
      ctx.beginPath(); ctx.moveTo(1560, y); ctx.lineTo(1640, y); ctx.stroke();
    }
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(1520, 2240, 160, 60); // pier end platform
    // garage building (Rosa's) — big, with a sign
    const g = world.places.garage;
    ctx.fillStyle = '#b5543a';
    ctx.fillRect(g.x - 110, g.y - 90, 220, 150);
    ctx.fillStyle = '#3d4450';
    ctx.fillRect(g.x - 110, g.y - 100, 220, 16);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("ROSA'S GARAGE", g.x, g.y - 108);
    ctx.fillStyle = '#222';
    ctx.fillRect(g.x - 70, g.y + 20, 140, 40); // open bay
    // safehouse
    const s = world.places.safehouse;
    ctx.fillStyle = '#5d6f8c';
    ctx.fillRect(s.x - 60, s.y - 50, 120, 100);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('SAFEHOUSE', s.x, s.y - 58);
    // docks
    const d = world.places.docks;
    ctx.fillStyle = '#6f5a48';
    ctx.fillRect(d.x - 90, d.y - 40, 180, 90);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('EAST DOCKS', d.x, d.y - 48);
    // depot
    const dep = world.places.courierHub;
    ctx.fillStyle = '#8a6f5c';
    ctx.fillRect(dep.x - 70, dep.y - 50, 140, 100);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('COURIER DEPOT', dep.x, dep.y - 58);
    // buildings with fake height (offset roof)
    for (const b of world.buildings) {
      if (!visible(b.x, b.y, b.w + 12, b.h + 40)) continue;
      const h = 10 * b.tall;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + 6, b.y + h + 4, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      // windows
      ctx.fillStyle = night ? '#ffe9a8' : 'rgba(220,235,255,0.75)';
      const cols = b.windows, rows = Math.max(1, Math.floor(b.h / 46));
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          ctx.fillRect(b.x + 12 + cx * ((b.w - 24) / cols), b.y + 12 + cy * ((b.h - 24) / rows), 10, 12);
        }
      }
    }
    // palms and trees
    for (const tr of world.trees) {
      if (!visible(tr.x - 14, tr.y - 20, 28, 34)) continue;
      ctx.fillStyle = '#5d4326';
      ctx.fillRect(tr.x - 2, tr.y - 2, 4, 10);
      ctx.fillStyle = tr.palm ? '#3f9e4d' : '#2f7d3a';
      ctx.beginPath(); ctx.arc(tr.x, tr.y - 6, tr.palm ? 12 : 9, 0, Math.PI * 2); ctx.fill();
    }
    // lamps (glow at night)
    for (const l of world.lamps) {
      if (!visible(l.x - 30, l.y - 40, 60, 60)) continue;
      ctx.fillStyle = '#222';
      ctx.fillRect(l.x - 2, l.y - 8, 4, 16);
      ctx.fillStyle = night ? '#ffe9a8' : '#d8d8d8';
      ctx.beginPath(); ctx.arc(l.x, l.y - 9, 3, 0, Math.PI * 2); ctx.fill();
      if (night) {
        ctx.fillStyle = 'rgba(255,233,168,0.12)';
        ctx.beginPath(); ctx.arc(l.x, l.y - 9, 26, 0, Math.PI * 2); ctx.fill();
      }
    }
    // sun / moon + sky tint handled by the page background; draw a low sun at dusk
    if (dusk) {
      ctx.fillStyle = '#ff9a3d';
      ctx.beginPath(); ctx.arc(cam.x + canvas.width - 120, cam.y + 90, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,154,61,0.25)';
      ctx.beginPath(); ctx.arc(cam.x + canvas.width - 120, cam.y + 90, 60, 0, Math.PI * 2); ctx.fill();
    }
    if (night) {
      ctx.fillStyle = '#e8ecf2';
      ctx.beginPath(); ctx.arc(cam.x + canvas.width - 140, cam.y + 80, 22, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawMarker(marker, t) {
    if (!marker) return;
    const bob = Math.sin(t * 4) * 6;
    const pulse = 1 + Math.sin(t * 4) * 0.08;
    ctx.save();
    ctx.translate(marker.x, marker.y - 40 + bob);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.moveTo(0, 26); ctx.lineTo(-16, -6); ctx.lineTo(-16, -18);
    ctx.arc(0, -18, 16, Math.PI, 0);
    ctx.lineTo(16, -6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(0, -18, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(marker.label, marker.x, marker.y - 78 + bob);
    // ground ring
    ctx.strokeStyle = 'rgba(255,210,61,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(marker.x, marker.y, 34 + Math.sin(t * 3) * 4, 0, Math.PI * 2); ctx.stroke();
  }

  function drawEffects(effects) {
    for (const e of effects) {
      if (e.kind === 'muzzle') {
        ctx.fillStyle = 'rgba(255,220,120,0.9)';
        ctx.beginPath(); ctx.arc(e.x, e.y, 10 * e.life, 0, Math.PI * 2); ctx.fill();
      } else if (e.kind === 'blood') {
        ctx.fillStyle = 'rgba(160,20,20,0.7)';
        ctx.beginPath(); ctx.arc(e.x, e.y, 5 * e.life + 2, 0, Math.PI * 2); ctx.fill();
      } else if (e.kind === 'smoke') {
        ctx.fillStyle = `rgba(120,120,120,${0.4 * e.life})`;
        ctx.beginPath(); ctx.arc(e.x, e.y, 14 * (1.6 - e.life), 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function draw(state, t) {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    // sky tint overlay base
    ctx.fillStyle = state.night ? '#1a2027' : state.dusk ? '#e8915a' : '#7ec8e3';
    ctx.fillRect(0, 0, w, h);
    updateCamera(state.px, state.py, state.vx || 0, state.vy || 0, state.dt);
    ctx.save();
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
    // clip to world view
    drawWorld(state.world, state, t);
    drawMarker(state.marker, t);
    if (state.courier) {
      ctx.fillStyle = '#3ddc84';
      ctx.beginPath(); ctx.arc(state.courier.x, state.courier.y, 12 + Math.sin(t * 5) * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('$', state.courier.x, state.courier.y + 4);
    }
    for (const c of state.parked) drawCar(c, c.color, false);
    for (const c of state.traffic) drawCar(c, c.color, false);
    for (const c of state.policeCars) drawCar(c, '#1c2f4a', true);
    if (state.playerCar) drawCar(state.playerCar, state.playerCar.color, false);
    for (const p of state.peds) if (!p.dead) drawPerson(p, t);
    for (const e of state.enemies) if (!e.dead) drawPerson(e, t);
    if (!state.inCar) {
      drawPerson({ x: state.px, y: state.py, angle: state.aim, speed: state.pSpeed, shirt: '#e8c33a', skin: '#e8b98a', kind: 'player' }, t);
      // aim line + crosshair
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(state.px + Math.cos(state.aim) * 20, state.py + Math.sin(state.aim) * 20);
      ctx.lineTo(state.px + Math.cos(state.aim) * 46, state.py + Math.sin(state.aim) * 46);
      ctx.stroke();
    }
    drawEffects(state.effects);
    ctx.restore();
    // night / dusk vignette
    if (state.night) {
      ctx.fillStyle = 'rgba(8,12,28,0.28)';
      ctx.fillRect(0, 0, w, h);
    } else if (state.dusk) {
      ctx.fillStyle = 'rgba(255,120,40,0.10)';
      ctx.fillRect(0, 0, w, h);
    }
    drawHud(state, w, h);
    drawMinimap(state);
  }

  function drawHud(state, w, h) {
    // top-left: cash + health
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(12, 12, 250, 64, 8); ctx.fill();
    ctx.fillStyle = '#7dff8a';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('$' + state.cash.toLocaleString('en-US'), 24, 40);
    // health bar
    ctx.fillStyle = '#333';
    ctx.fillRect(24, 48, 150, 12);
    ctx.fillStyle = state.health > 30 ? '#3ddc84' : '#ff4d4d';
    ctx.fillRect(24, 48, 150 * Math.max(0, state.health) / 100, 12);
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.fillText('HP ' + Math.max(0, Math.round(state.health)), 182, 58);
    // wanted stars top-right
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(w - 210, 12, 198, 40, 8); ctx.fill();
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < state.wanted ? '#ffd23d' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', w - 196 + i * 38, 42);
    }
    // ammo + speed bottom-right
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(w - 210, h - 64, 198, 52, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('🔫 ' + state.ammo, w - 196, h - 34);
    if (state.inCar) {
      ctx.fillStyle = '#7ec8e3';
      ctx.fillText(Math.round(state.speedKmh) + ' km/h', w - 110, h - 34);
    }
    // objective bar top-centre
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const ow = Math.min(720, w - 480);
    roundRect((w - ow) / 2, 12, ow, 40, 8); ctx.fill();
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.objective, w / 2, 30);
    if (state.toast) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      roundRect((w - 420) / 2, 60, 420, 34, 8); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(state.toast, w / 2, 82);
    }
    if (state.busted) {
      ctx.fillStyle = 'rgba(20,20,60,0.75)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 64px sans-serif';
      ctx.fillText('BUSTED', w / 2, h / 2 - 10);
      ctx.font = '18px sans-serif';
      ctx.fillText('The cops caught Dana. Press Enter to continue.', w / 2, h / 2 + 30);
    }
    if (state.wasted) {
      ctx.fillStyle = 'rgba(60,10,10,0.75)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff5a5a';
      ctx.font = 'bold 64px sans-serif';
      ctx.fillText('WASTED', w / 2, h / 2 - 10);
      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.fillText('Dana is down. Press Enter to continue.', w / 2, h / 2 + 30);
    }
    if (state.allDone) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect((w - 520) / 2, h / 2 - 60, 520, 110, 10); ctx.fill();
      ctx.fillStyle = '#ffd23d';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('SOLMAR HEAT — COMPLETE', w / 2, h / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText("All five jobs done. Dana is family now. Free roam!", w / 2, h / 2 + 14);
    }
  }

  function drawMinimap(state) {
    const mw = miniCanvas.width, mh = miniCanvas.height;
    const sx = mw / WORLD_W, sy = mh / WORLD_H;
    mctx.clearRect(0, 0, mw, mh);
    mctx.fillStyle = state.night ? '#1c222a' : '#3a3f46';
    mctx.fillRect(0, 0, mw, mh);
    mctx.fillStyle = '#2e7fa8';
    mctx.fillRect(0, BEACH_Y * sy, mw, (WORLD_H - BEACH_Y) * sy);
    mctx.fillStyle = '#e8d29a';
    mctx.fillRect(0, BEACH_Y * sy, mw, (WATER_Y - BEACH_Y) * sy);
    mctx.fillStyle = '#5d6f8c';
    for (const b of state.world.buildings) mctx.fillRect(b.x * sx, b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
    // marker
    if (state.marker) {
      mctx.fillStyle = '#ffd23d';
      mctx.beginPath(); mctx.arc(state.marker.x * sx, state.marker.y * sy, 5, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#ffd23d';
      mctx.beginPath(); mctx.arc(state.marker.x * sx, state.marker.y * sy, 8 + Math.sin(Date.now() / 300) * 2, 0, Math.PI * 2); mctx.stroke();
    }
    if (state.courier) {
      mctx.fillStyle = '#3ddc84';
      mctx.beginPath(); mctx.arc(state.courier.x * sx, state.courier.y * sy, 4, 0, Math.PI * 2); mctx.fill();
    }
    for (const c of state.policeCars) {
      mctx.fillStyle = '#5aa2ff';
      mctx.beginPath(); mctx.arc(c.x * sx, c.y * sy, 3.5, 0, Math.PI * 2); mctx.fill();
    }
    // player arrow
    mctx.save();
    mctx.translate(state.px * sx, state.py * sy);
    mctx.rotate(state.inCar ? state.playerCar.angle : state.aim);
    mctx.fillStyle = '#fff';
    mctx.beginPath(); mctx.moveTo(7, 0); mctx.lineTo(-5, -4); mctx.lineTo(-5, 4); mctx.closePath(); mctx.fill();
    mctx.restore();
    mctx.strokeStyle = 'rgba(255,255,255,0.5)';
    mctx.strokeRect(0.5, 0.5, mw - 1, mh - 1);
  }

  return { draw, cam };
}
