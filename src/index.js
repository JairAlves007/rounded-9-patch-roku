import { PNG } from "pngjs";

const SUPERSAMPLING = 4;
const MARKER = { r: 0, g: 0, b: 0, a: 255 };

/**
 * Builds a rounded-rectangle 9-patch PNG.
 *
 * Layout: a 1px marker frame around the drawing. Black pixels on the top row / left column mark the
 * stretchable region; the corners (max(radius, stroke) px) never stretch, so the stroke and the radius keep
 * their size at any rendered size. Optional black pixels on the bottom row / right column mark the content
 * padding (read by Roku as Poster.bitmapMargins).
 *
 * @param {object} options
 * @param {number} options.radius corner radius in px (required: the border rounding is always chosen by the user)
 * @param {number} [options.stroke=4] outline width in px (ignored when fill is true)
 * @param {boolean} [options.fill=false] true draws a filled shape instead of an outline
 * @param {boolean} [options.inverse=false] true paints only OUTSIDE the rounded shape (corner cover): put it over a
 *   square element and tint it with the background color to get rounded corners without MaskGroup
 * @param {string} [options.color="#FFFFFF"] #RGB or #RRGGBB. Keep white to tint at runtime (Roku blendColor)
 * @param {number} [options.opacity=1] 0..1
 * @param {number} [options.stretch=2] size in px of the stretchable center region
 * @param {number} [options.padding] content padding in px; when set, the bottom/right markers are written
 * @returns {{ buffer: Buffer, width: number, height: number, cornerSize: number }}
 */
export function createRoundedNinePatch(options) {
  const config = normalizeOptions(options);
  const isSolid = config.fill || config.inverse;
  const cornerSize = Math.max(config.radius, isSolid ? 0 : config.stroke, 1);
  const contentSize = cornerSize * 2 + config.stretch;
  const size = contentSize + 2;

  const png = new PNG({ width: size, height: size });
  png.data.fill(0);

  for (let y = 0; y < contentSize; y++) {
    for (let x = 0; x < contentSize; x++) {
      const coverage = getCoverage(x, y, contentSize, config);
      if (coverage <= 0) continue;

      setPixel(png, x + 1, y + 1, { ...config.rgb, a: Math.round(255 * coverage * config.opacity) });
    }
  }

  for (let i = 0; i < config.stretch; i++) {
    setPixel(png, 1 + cornerSize + i, 0, MARKER);
    setPixel(png, 0, 1 + cornerSize + i, MARKER);
  }

  if (config.padding !== undefined) {
    for (let i = 1 + config.padding; i < size - 1 - config.padding; i++) {
      setPixel(png, i, size - 1, MARKER);
      setPixel(png, size - 1, i, MARKER);
    }
  }

  return { buffer: PNG.sync.write(png), width: size, height: size, cornerSize };
}

export function getDefaultFileName(options) {
  const config = normalizeOptions(options);
  let shape = `stroke-${config.stroke}`;
  if (config.fill) shape = "filled";
  if (config.inverse) shape = "inverse";

  return `rounded-radius-${config.radius}-${shape}.9.png`;
}

export function parseHexColor(hex) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!match) throw new Error(`Cor inválida: "${hex}". Use #RGB ou #RRGGBB.`);

  const digits = match[1].length === 3 ? match[1].replace(/./g, "$&$&") : match[1];

  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16)
  };
}

function normalizeOptions(options) {
  if (options === null || typeof options !== "object") throw new Error("options é obrigatório e precisa ter radius.");
  if (options.radius === undefined) throw new Error("radius é obrigatório: escolha o arredondamento da borda em px.");

  const config = {
    radius: options.radius,
    stroke: options.stroke ?? 4,
    fill: Boolean(options.fill),
    inverse: Boolean(options.inverse),
    opacity: options.opacity ?? 1,
    stretch: options.stretch ?? 2,
    padding: options.padding
  };

  if (config.fill && config.inverse) throw new Error("fill e inverse não podem ser usados juntos.");

  assertInteger("radius", config.radius, 0);
  assertInteger("stroke", config.stroke, 1);
  assertInteger("stretch", config.stretch, 1);
  if (config.padding !== undefined) assertInteger("padding", config.padding, 0);

  if (typeof config.opacity !== "number" || Number.isNaN(config.opacity) || config.opacity < 0 || config.opacity > 1) {
    throw new Error(`opacity inválida: "${config.opacity}". Use um número entre 0 e 1.`);
  }

  config.rgb = parseHexColor(options.color ?? "#FFFFFF");

  return config;
}

function assertInteger(name, value, min) {
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} inválido: "${value}". Use um inteiro >= ${min}.`);
  }
}

// Fraction of the pixel covered by the shape, sampled on a SUPERSAMPLING x SUPERSAMPLING grid.
function getCoverage(x, y, contentSize, config) {
  let inside = 0;

  for (let sy = 0; sy < SUPERSAMPLING; sy++) {
    for (let sx = 0; sx < SUPERSAMPLING; sx++) {
      const px = x + (sx + 0.5) / SUPERSAMPLING;
      const py = y + (sy + 0.5) / SUPERSAMPLING;

      if (isInsideShape(px, py, contentSize, config)) inside++;
    }
  }

  return inside / (SUPERSAMPLING * SUPERSAMPLING);
}

function isInsideShape(px, py, contentSize, config) {
  const outer = roundedRectDistance(px, py, 0, 0, contentSize, contentSize, config.radius);
  if (config.inverse) return outer > 0;
  if (outer > 0) return false;
  if (config.fill) return true;

  const inset = config.stroke;
  const innerRadius = Math.max(config.radius - inset, 0);
  const inner = roundedRectDistance(px, py, inset, inset, contentSize - inset, contentSize - inset, innerRadius);

  return inner > 0;
}

// Signed distance from (px, py) to a rounded rectangle [x0, x1] x [y0, y1]: negative inside, positive outside.
function roundedRectDistance(px, py, x0, y0, x1, y1, radius) {
  const halfWidth = (x1 - x0) / 2;
  const halfHeight = (y1 - y0) / 2;
  if (halfWidth <= 0 || halfHeight <= 0) return 1;

  const r = Math.min(radius, halfWidth, halfHeight);
  const qx = Math.abs(px - (x0 + halfWidth)) - (halfWidth - r);
  const qy = Math.abs(py - (y0 + halfHeight)) - (halfHeight - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);

  return outside + inside - r;
}

function setPixel(png, x, y, { r, g, b, a }) {
  const index = (png.width * y + x) << 2;
  png.data[index] = r;
  png.data[index + 1] = g;
  png.data[index + 2] = b;
  png.data[index + 3] = a;
}
