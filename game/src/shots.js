// shots.js — deterministic screenshot scenes for Solmar Heat.
// ?shot=cover|street|pier|dusk&seed=1 builds a fixed tableau: the same
// seed rebuilds the same city, and each scene places the player, the
// cars, the wanted level and the mission by hand, so the screenshots are
// real renders of the game and reproducible.
import { makeCar, CAR_MODELS } from './vehicles.js';
import { spawnVipers } from './people.js';
import { GARAGE, DEPOT, PIER } from './city.js';

function putPlayerInCar(S, modelIndex, x, y, angle, speed) {
  const car = makeCar(CAR_MODELS[modelIndex], x, y, angle, 'player');
  car.speed = speed;
  S.player.car = car;
  S.player.x = x;
  S.player.y = y;
  S.player.angle = angle;
  S.player.speed = speed;
}

function setWanted(S, level) {
  S.player.heat = level * 2;
  S.player.wanted = level;
  S.lastCrimeAt = S.time;
}

function addPoliceBehind(S, spots) {
  for (const s of spots) {
    const car = makeCar(
      { name: 'Interceptor', color: '#20242e', max: 390, accel: 330 },
      s.x, s.y, s.angle, 'police',
    );
    car.speed = s.speed || 300;
    S.cars.police.push(car);
  }
}

export function setupShot(S, name) {
  S.shot = name;
  S.autoDrive = false;
  S.side.cooldown = 9999;
  S.timeOfDay = 'day';
  if (name === 'cover') {
    // Downtown chase: Dana in a Comet GT at full speed, 3 stars, two
    // interceptors on her tail, Heat Run on the HUD.
    S.mission.index = 3;
    S.mission.stage = 'heat';
    S.mission.text = 'Draw heat: steal cars, fire shots — get to 3 stars!';
    S.mission.target = { x: 450, y: 1500, r: 70, label: 'Safehouse' };
    putPlayerInCar(S, 0, 1380, 1200, 0, 320);
    S.autoDrive = true;
    setWanted(S, 3);
    addPoliceBehind(S, [
      { x: 1240, y: 1184, angle: 0, speed: 310 },
      { x: 1290, y: 1218, angle: 0, speed: 305 },
    ]);
  } else if (name === 'street') {
    // On foot at the plaza, First Wheels on the HUD, a Comet GT waiting
    // on the 1200 road and Rosa's Garage marker ahead.
    S.mission.index = 0;
    S.mission.stage = 'steal';
    S.mission.text = 'Steal a car and bring it to Rosa\u2019s Garage.';
    S.mission.target = { x: GARAGE.mx, y: GARAGE.my, r: GARAGE.mr, label: GARAGE.name };
    S.player.x = 1100;
    S.player.y = 1120;
    S.player.angle = 0.4;
    setWanted(S, 0);
  } else if (name === 'pier') {
    // Pier showdown: four Vipers on the docks, Dana on foot at the pier
    // mouth, pistol ready. Enemy fire is held for the first seconds so
    // the frame is clean.
    S.mission.index = 2;
    S.mission.stage = 'fight';
    S.mission.text = 'Clear the docks — 4 Vipers left.';
    S.mission.target = { x: PIER.mx, y: PIER.my, r: PIER.mr, label: PIER.name };
    S.player.x = 610;
    S.player.y = 2190;
    S.player.angle = Math.PI / 2;
    S.player.hp = 100;
    setWanted(S, 2);
    spawnVipers(S);
    for (const v of S.vipers) v.shootCd = 3;
  } else if (name === 'dusk') {
    // Sunset beach drive: dusk light, one star, a Night Hawk cruising
    // the 2100 road above the sand with a courier job on the HUD.
    S.timeOfDay = 'dusk';
    S.mission.index = 1;
    S.mission.stage = 'deliver';
    S.mission.timer = 62;
    S.mission.text = 'Deliver to the North Depot — 62s left!';
    S.mission.target = { x: DEPOT.mx, y: DEPOT.my, r: DEPOT.mr, label: 'Deliver: ' + DEPOT.name };
    putPlayerInCar(S, 5, 1450, 2100, 0, 280);
    S.autoDrive = true;
    setWanted(S, 1);
    addPoliceBehind(S, [{ x: 1330, y: 2084, angle: 0, speed: 270 }]);
  }
}
