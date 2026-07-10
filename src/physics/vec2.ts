export interface Vec2 {
  x: number;
  y: number;
}

export const v = (x: number, y: number): Vec2 => ({ x, y });

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const neg = (a: Vec2): Vec2 => ({ x: -a.x, y: -a.y });

export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

/** z-component of the 3D cross product. Positive means b is counter-clockwise from a. */
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;

export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const len2 = (a: Vec2): number => a.x * a.x + a.y * a.y;
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export const norm = (a: Vec2): Vec2 => {
  const l = len(a);
  return l === 0 ? v(0, 0) : scale(a, 1 / l);
};

/** Rotate counter-clockwise by `t` radians. */
export const rot = (a: Vec2, t: number): Vec2 => {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};

/** Rotate a quarter turn counter-clockwise. */
export const perp = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x });

/** Unit vector at angle `t` from the +x axis. */
export const dir = (t: number): Vec2 => ({ x: Math.cos(t), y: Math.sin(t) });

export const mirrorY = (a: Vec2): Vec2 => ({ x: a.x, y: -a.y });
