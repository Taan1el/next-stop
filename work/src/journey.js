// Player-facing railway guidance, derived from authoritative simulation state.
class NSJourney {
  static approach(sim,explorationStation=null) {
    const deliveryTarget=explorationStation===null;
    if (sim.player.mode !== 'train' || (deliveryTarget&&(!sim.delivery.started||sim.delivery.finished))) return null;
    const train = sim.train, world = sim.world, targetIndex=deliveryTarget?sim.delivery.index:explorationStation;
    const station = world.stations[targetIndex];
    const length = world.routeLength;
    const wrap = value => ((value % length) + length) % length;
    const direction = Math.abs(train.speed) > .025 ? Math.sign(train.speed) : train.direction;
    const signed = (wrap(station.s - train.s + length / 2) - length / 2) * direction;
    const distance = wrap((station.s - train.s) * direction);
    const inside = world.stationAt(train.s)?.index === targetIndex;
    const stopped = Math.abs(train.speed) <= .22;
    const stoppingDistance = sim.stoppingDistance();
    // Allow reaction time and aim short of the platform centre, inside its zone.
    const brakeAt = stoppingDistance + Math.max(8, Math.abs(train.speed) * 1.1) + 5;
    const passed = !inside && signed < -station.radius && signed > -station.radius - 100;
    let phase = 'cruise', hint;
    if (inside && stopped) {
      phase = 'ready'; hint = deliveryTarget?`At ${station.name} platform · E: deliver · Hold Space to stay stopped`:`At ${station.name} platform · E: leave train · Explore on foot`;
    } else if (inside || (!passed && distance <= brakeAt && !stopped)) {
      phase = 'brake'; hint = `BRAKE NOW · Hold Space · ${station.name} platform${inside ? '' : ` in ${Math.ceil(distance)} m`}`;
    } else if (passed) {
      phase = 'passed'; hint = 'Platform passed · Stop with Space, then R to reverse';
    } else if (stopped && train.throttle===0) {
      phase = 'departure';hint = `${station.name} · ${Math.ceil(distance)} m ${direction===-1?'in reverse':'ahead'} · Hold W to add power`;
    } else if (distance < 100) {
      phase = 'approach'; hint = `${station.name} · ${Math.ceil(distance)} m to platform centre · Space: brake`;
    } else {
      hint = `${station.name} · ${Math.ceil(distance)} m ahead · W/S: power · Space: brake · C: camera`;
    }
    return { phase, hint, distance: inside ? 0 : distance, signedDistance: signed,
      inside, stoppingDistance, brakeAt, station: station.name, direction,kind:deliveryTarget?'delivery':'exploration' };
  }

  static label(sim) {
    if (sim.delivery.finished) return 'Circuit complete';
    if (sim.player.mode === 'train') return `Delivery ${sim.delivery.completed + 1} of 3 · ${sim.cameraMode} · ${sim.train.direction === 1 ? 'forward' : 'reverse'}`;
    let closest = null, distance = Infinity;
    for (const station of sim.world.stations) {
      const d = Math.hypot(sim.player.x - station.x, sim.player.z - station.z);
      if (d < distance) { distance = d; closest = station; }
    }
    return distance < 70 ? `On foot · ${closest.name}` : 'On foot · open valley';
  }
}
