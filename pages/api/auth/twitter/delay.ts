export function secondsBetween(a?: Date | null, b?: Date | null) {
  if (!a || !b) return Infinity;
  return Math.max(0, Math.floor((+b - +a) / 1000));
}

export function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
