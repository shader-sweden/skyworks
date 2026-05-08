export function seededRandom(seed: number) {
  return fractNumber(Math.sin(seed * 12.9898) * 43758.5453);
}

function fractNumber(value: number) {
  return value - Math.floor(value);
}
