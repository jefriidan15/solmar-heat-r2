// render.js — everything Solmar Heat draws: the city, its cars and
// people, the HUD with cash / health / stars / ammo / speed / objective,
// and the live minimap. One canvas, no images, no DOM inside the frame.
import { WORLD, ROADS, ROAD_W, BEACH_Y, WATER_Y, GARAGE, SAFEHOUSE, DEPOT, PIER } from './city.js';
import { clamp, dist } from './rng.js';
import { objectiveText } from './missions.js';

const VIEW_W = 1280;
const VIEW_H = 720;

const PALETTES = {
  day: {
    grass: '#79b264', block: '#8a8f7a', road: '#3c3f46', line: '#d8d8c8',
    walk: '#a9a89a', sand: '#e0c98f', water: '#2f7fb8', waterDeep: '#256b9e',
    pier: '#8a6a44', label: 'rgba(255,255,255,0.55)', overlay: null,
  },
  dusk: {
    grass: '#7a7a4e', block: '#7d7460', road: '#38322e', line: '#d8c8a8',
    walk: '#9a8f78', sand: '#d9a86a', water: '#2a5f8a', waterDeep: '#1f4c72',
    pier: '#7a5a38', label: 'rgba(255,220,180,0.6)', overlay: 'rgba(255,110,40,0.10)',
  },
  night: {
    grass: '#2e4a33', block: '#3a4038', road: '#23242a', line: '#8a8a7a',
    walk: '#4a4a44', sand: '#8a7a55', water: '#16324a', waterDeep: '#0f2538',
    pier: '#4a3a28', label: 'rgba(180,200,255,0.5)', overlay: 'rgba(8,8,40,0.32)',
  },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Wheels.
  ctx.fillStyle = '#141414';
  ctx.fillRect(-13, -11, 9, 5);
  ctx.fillRect(4, -11, 9, 5);
  ctx.fillRect(-13, 6, 9, 5);
  ctx.fillRect(4, 6, 9, 5);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -18, -9, 36, 18, 5);
  ctx.fill();
  // Windshield + roof.
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  ctx.fillRect(6, -7, 6, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-8, -7, 10, 14);
  // Police light bar flashes red/blue.
  if (car.kind === 'police') {
    ctx.fillStyle = Math.floor(time * 4) % 2 === 0 ? '#ff2a2a' : '#2a6bff';
    ctx.fillRect(-3, -9, 6, 4);
    ctx.fillStyle = Math.floor(time * 4) % 2 === 0 ? '#2a6bff' : '#ff2a2a';
    ctx.fillRect(-3, 5, 6, 4);
  }
  // Headlights after dark.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(17, -7, 2, 3);
  ctx.fillRect(17, 4, 2, 3);
  ctx.restore();
}

function drawMarker(ctx, target, time, label) {
  const pulse = 1 + Math.sin(time * 4) * 0.12;
  const r = target.r * pulse;
  ctx.save();
  ctx.strokeStyle = '#ffd23a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,210,58,0.35)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(target.x, target.y, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  // Beacon column.
  const grad = ctx.createLinearGradient(target.x, target.y - 130, target.x, target.y);
  grad.addColorStop(0, 'rgba(255,210,58,0)');
  grad.addColorStop(1, 'rgba(255,210,58,0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(target.x - 7, target.y - 130, 14, 130);
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23a';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 4;
  const ly = target.y - r - 12;
  ctx.strokeText(label, target.x, ly);
  ctx.fillText(label, target.x, ly);
  ctx.restore();
}

function drawWorld(ctx, S, cam, pal) {
  const x0 = cam.x - 40;
  const y0 = cam.y - 40;
  const x1 = cam.x + VIEW_W + 40;
  const y1 = cam.y + VIEW_H + 40;
  // Ground.
  ctx.fillStyle = pal.grass;
  ctx.fillRect(cam.x, cam.y, VIEW_W, VIEW_H);
  // Beach sand, then water with a slow wave shimmer.
  ctx.fillStyle = pal.sand;
  ctx.fillRect(Math.max(cam.x, 0), Math.max(cam.y, BEACH_Y), VIEW_W, WORLD - BEACH_Y);
  ctx.fillStyle = pal.water;
  ctx.fillRect(Math.max(cam.x, 0), Math.max(cam.y, WATER_Y), VIEW_W, WORLD - WATER_Y);
  ctx.strokeStyle = pal.waterDeep;
  ctx.lineWidth = 2;
  for (let wy = WATER_Y + 14; wy < WORLD; wy += 34) {
    ctx.beginPath();
    for (let wx = Math.max(cam.x, 0); wx < Math.min(x1, WORLD); wx += 26) {
      const wave = Math.sin(wx * 0.02 + S.time * 1.4 + wy * 0.05) * 4;
      if (wx === Math.max(cam.x, 0)) ctx.moveTo(wx, wy + wave);
      else ctx.lineTo(wx, wy + wave);
    }
    ctx.stroke();
  }
  // Pier: wooden walkway into the water, posts on both sides.
  ctx.fillStyle = pal.pier;
  ctx.fillRect(580, BEACH_Y, 60, WORLD - BEACH_Y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let py = BEACH_Y + 10; py < WORLD; py += 44) {
    ctx.fillRect(580, py, 60, 3);
  }
  ctx.fillStyle = '#5d4526';
  for (let py = BEACH_Y + 8; py < WORLD; py += 88) {
    ctx.fillRect(574, py, 8, 8);
    ctx.fillRect(638, py, 8, 8);
  }
  // City blocks (pavement) and roads.
  ctx.fillStyle = pal.block;
  for (const park of S.city.parks) {
    if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
    ctx.fillStyle = park.lot ? '#55585e' : '#6f9a55';
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  ctx.fillStyle = pal.road;
  for (const r of ROADS) {
    ctx.fillRect(Math.max(cam.x, 0), r - ROAD_W / 2, VIEW_W, ROAD_W);
    ctx.fillRect(r - ROAD_W / 2, Math.max(cam.y, 0), ROAD_W, VIEW_H);
  }
  // Sidewalk edges.
  ctx.fillStyle = pal.walk;
  for (const r of ROADS) {
    ctx.fillRect(Math.max(cam.x, 0), r - ROAD_W / 2 - 6, VIEW_W, 6);
    ctx.fillRect(Math.max(cam.x, 0), r + ROAD_W / 2, VIEW_W, 6);
    ctx.fillRect(r - ROAD_W / 2 - 6, Math.max(cam.y, 0), 6, VIEW_H);
    ctx.fillRect(r + ROAD_W / 2, Math.max(cam.y, 0), 6, VIEW_H);
  }
  // Dashed centre lines.
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (const r of ROADS) {
    ctx.moveTo(Math.max(cam.x, 0), r);
    ctx.lineTo(Math.min(x1, WORLD), r);
    ctx.moveTo(r, Math.max(cam.y, 0));
    ctx.lineTo(r, Math.min(y1, WORLD));
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Buildings with a roof inset and a drop shadow.
  for (const b of S.city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 8);
    if (b.name) {
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
  }
  // Trees.
  for (const t of S.city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = '#3f7d33';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#57a047';
    ctx.beginPath();
    ctx.arc(t.x - 2, t.y - 2, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // District labels, big and faint.
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.label;
  const labels = [
    ['DOWNTOWN', 1350, 800],
    ['OLD TOWN', 500, 1100],
    ['HARBOR', 2050, 1000],
    ['NORTHSIDE', 1350, 200],
    ['BEACHFRONT', 1500, 2260],
  ];
  for (const [text, lx, ly] of labels) {
    if (lx > x0 - 200 && lx < x1 + 200 && ly > y0 - 60 && ly < y1 + 60) {
      ctx.fillText(text, lx, ly);
    }
  }
  // Mission + side-job markers.
  if (S.mission.target) drawMarker(ctx, S.mission.target, S.time, S.mission.target.label);
  if (S.side.active) drawMarker(ctx, S.side.target, S.time, S.side.target.label);
}

function drawEntities(ctx, S, cam) {
  const x0 = cam.x - 60;
  const y0 = cam.y - 60;
  const x1 = cam.x + VIEW_W + 60;
  const y1 = cam.y + VIEW_H + 60;
  const inView = (x, y) => x > x0 && x < x1 && y > y0 && y < y1;
  for (const car of S.cars.parked) {
    if (inView(car.x, car.y)) drawCarShape(ctx, car, S.time);
  }
  for (const car of S.cars.traffic) {
    if (inView(car.x, car.y)) drawCarShape(ctx, car, S.time);
  }
  for (const car of S.cars.police) {
    if (inView(car.x, car.y)) drawCarShape(ctx, car, S.time);
  }
  if (S.player.car && inView(S.player.car.x, S.player.car.y)) {
    drawCarShape(ctx, S.player.car, S.time);
  }
  // Pedestrians.
  for (const ped of S.peds) {
    if (!inView(ped.x, ped.y)) continue;
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 3, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Officers.
  for (const cop of S.cops) {
    if (!inView(cop.x, cop.y)) continue;
    ctx.fillStyle = '#20242e';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a6fd8';
    ctx.fillRect(cop.x - 6, cop.y - 14, 12, 4);
  }
  // Vipers.
  for (const v of S.vipers) {
    if (v.dead || !inView(v.x, v.y)) continue;
    ctx.fillStyle = v.color;
    ctx.beginPath();
    ctx.arc(v.x, v.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(v.x, v.y - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    // Health pips above the head.
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < v.hp ? '#ff4040' : 'rgba(0,0,0,0.4)';
      ctx.fillRect(v.x - 12 + i * 9, v.y - 24, 7, 4);
    }
  }
  // Dana on foot: teal jacket, facing the aim.
  const p = S.player;
  if (!p.car && inView(p.x, p.y)) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#2fae9e';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd9b0';
    ctx.beginPath();
    ctx.arc(3, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(24, 0);
    ctx.stroke();
    ctx.restore();
  }
  // Bullets.
  ctx.fillStyle = '#ffe14a';
  for (const b of S.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Particles.
  for (const f of S.fx) {
    const t = f.life / f.max;
    if (f.kind === 'spark' || f.kind === 'hit') {
      ctx.fillStyle = f.kind === 'spark' ? 'rgba(255,220,80,' + t + ')' : 'rgba(255,70,60,' + t + ')';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 4 + (1 - t) * 14, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.kind === 'flash') {
      ctx.fillStyle = 'rgba(255,180,60,' + t + ')';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 10 + (1 - t) * 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.kind === 'down') {
      ctx.strokeStyle = 'rgba(255,255,255,' + t + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(f.x - 10, f.y - 10);
      ctx.lineTo(f.x + 10, f.y + 10);
      ctx.moveTo(f.x + 10, f.y - 10);
      ctx.lineTo(f.x - 10, f.y + 10);
      ctx.stroke();
    }
  }
}

function drawMinimap(ctx, S) {
  const size = 190;
  const mx = VIEW_W - size - 14;
  const my = VIEW_H - size - 14;
  const scale = size / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,10,0.72)';
  ctx.fillRect(mx - 4, my - 4, size + 8, size + 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx - 4, my - 4, size + 8, size + 8);
  ctx.beginPath();
  ctx.rect(mx, my, size, size);
  ctx.clip();
  ctx.fillStyle = '#4a7a3e';
  ctx.fillRect(mx, my, size, size);
  ctx.fillStyle = '#c9b078';
  ctx.fillRect(mx, my + BEACH_Y * scale, size, size - BEACH_Y * scale);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(mx, my + WATER_Y * scale, size, size - WATER_Y * scale);
  ctx.strokeStyle = '#3c3f46';
  ctx.lineWidth = 2;
  for (const r of ROADS) {
    ctx.beginPath();
    ctx.moveTo(mx, my + r * scale);
    ctx.lineTo(mx + size, my + r * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx + r * scale, my);
    ctx.lineTo(mx + r * scale, my + size);
    ctx.stroke();
  }
  ctx.fillStyle = '#c8ccd4';
  for (const b of S.city.buildings) {
    ctx.fillRect(mx + b.x * scale, my + b.y * scale, Math.max(2, b.w * scale), Math.max(2, b.h * scale));
  }
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx + x * scale, my + y * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  if (S.mission.target) {
    const pulse = 3 + Math.sin(S.time * 5) * 1.5;
    dot(S.mission.target.x, S.mission.target.y, '#ffd23a', pulse);
  }
  if (S.side.active) dot(S.side.target.x, S.side.target.y, '#7fd0ff', 3);
  for (const car of S.cars.police) dot(car.x, car.y, '#ff4040', 3);
  for (const v of S.vipers) if (!v.dead) dot(v.x, v.y, '#c04ac0', 3);
  // Player arrow.
  const p = S.player;
  ctx.save();
  ctx.translate(mx + p.x * scale, my + p.y * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Viewport rectangle.
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + S.cam.x * scale, my + S.cam.y * scale, VIEW_W * scale, VIEW_H * scale);
  ctx.restore();
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('SOLMAR CITY', mx, my - 8);
}

function drawHud(ctx, S) {
  const p = S.player;
  // Top-left: cash, health, ammo.
  ctx.fillStyle = 'rgba(10,14,10,0.62)';
  roundRect(ctx, 12, 12, 250, 86, 8);
  ctx.fill();
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7dff8a';
  ctx.fillText('$' + p.cash, 26, 44);
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('HEALTH', 26, 66);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(92, 56, 150, 12);
  ctx.fillStyle = p.hp > 30 ? '#37d67a' : '#ff4040';
  ctx.fillRect(92, 56, 150 * clamp(p.hp, 0, 100) / 100, 12);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('AMMO  ' + p.ammo + ' / 24', 26, 88);
  if (p.bust > 0) {
    ctx.fillStyle = '#ff4040';
    ctx.fillText('BUSTED IN ' + (1.2 - p.bust).toFixed(1) + 's — RUN!', 26, 108);
  }
  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(10,14,10,0.62)';
  roundRect(ctx, VIEW_W - 212, 12, 200, 52, 8);
  ctx.fill();
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < p.wanted ? '#ffd23a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', VIEW_W - 182 + i * 36, 50);
  }
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(p.wanted > 0 ? 'WANTED' : 'CLEAN', VIEW_W - 112, 60);
  // Top-centre: objective.
  const lines = objectiveText(S);
  ctx.font = 'bold 14px sans-serif';
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 32;
  ctx.fillStyle = 'rgba(10,14,10,0.62)';
  roundRect(ctx, (VIEW_W - w) / 2, 12, w, 24 + lines.length * 20, 8);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 34 + i * 20));
  // Bottom-left: speed + car, or on-foot hint.
  if (p.car) {
    ctx.fillStyle = 'rgba(10,14,10,0.62)';
    roundRect(ctx, 12, VIEW_H - 66, 210, 54, 8);
    ctx.fill();
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(Math.round(p.speed * 0.9) + ' km/h', 26, VIEW_H - 32);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(p.car.model + '  ·  SPACE handbrake', 26, VIEW_H - 18);
  }
  // Bottom-centre: controls reminder.
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('WASD move · Shift run · E steal car · Click shoot · P pause · M mute', VIEW_W / 2, VIEW_H - 14);
  // Banner (mission complete / failed).
  if (S.bannerT > 0) {
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    const bw = ctx.measureText(S.banner).width + 48;
    ctx.fillStyle = 'rgba(10,14,10,0.75)';
    roundRect(ctx, (VIEW_W - bw) / 2, 130, bw, 46, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23a';
    ctx.fillText(S.banner, VIEW_W / 2, 161);
  }
  drawMinimap(ctx, S);
}

export function render(ctx, S) {
  const pal = PALETTES[S.timeOfDay] || PALETTES.day;
  const p = S.player;
  S.cam.x = clamp(p.x - VIEW_W / 2, 0, WORLD - VIEW_W);
  S.cam.y = clamp(p.y - VIEW_H / 2, 0, WORLD - VIEW_H);
  ctx.save();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.translate(-S.cam.x, -S.cam.y);
  drawWorld(ctx, S, S.cam, pal);
  drawEntities(ctx, S, S.cam);
  ctx.restore();
  if (pal.overlay) {
    ctx.fillStyle = pal.overlay;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  drawHud(ctx, S);
}
