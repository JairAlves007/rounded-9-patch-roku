import { test } from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { createRoundedNinePatch, getDefaultFileName, parseHexColor } from "../src/index.js";

function readPixel(png, x, y) {
  const index = (png.width * y + x) << 2;
  return { r: png.data[index], g: png.data[index + 1], b: png.data[index + 2], a: png.data[index + 3] };
}

function isMarker(pixel) {
  return pixel.r === 0 && pixel.g === 0 && pixel.b === 0 && pixel.a === 255;
}

test("radius is required: the user always chooses the border rounding", () => {
  assert.throws(() => createRoundedNinePatch({ stroke: 4 }), /radius é obrigatório/);
  assert.throws(() => createRoundedNinePatch(), /radius/);
});

test("image size is the fixed corners + stretch region + 1px marker frame", () => {
  const image = createRoundedNinePatch({ radius: 6, stroke: 4, stretch: 2 });

  assert.equal(image.cornerSize, 6);
  assert.equal(image.width, 6 * 2 + 2 + 2);
  assert.equal(image.height, image.width);
});

test("the corner size is the bigger of radius and stroke", () => {
  assert.equal(createRoundedNinePatch({ radius: 2, stroke: 5 }).cornerSize, 5);
  assert.equal(createRoundedNinePatch({ radius: 10, stroke: 2 }).cornerSize, 10);
});

test("top row and left column mark only the stretch region", () => {
  const image = createRoundedNinePatch({ radius: 6, stroke: 4, stretch: 2 });
  const png = PNG.sync.read(image.buffer);

  for (let i = 1; i < png.width - 1; i++) {
    const shouldBeMarker = i === 7 || i === 8;
    assert.equal(isMarker(readPixel(png, i, 0)), shouldBeMarker, `top marker at x=${i}`);
    assert.equal(isMarker(readPixel(png, 0, i)), shouldBeMarker, `left marker at y=${i}`);
  }
});

test("outline: rounded corner is transparent, straight edge is opaque, center is empty", () => {
  const png = PNG.sync.read(createRoundedNinePatch({ radius: 6, stroke: 4 }).buffer);

  assert.equal(readPixel(png, 1, 1).a, 0, "outside the rounded corner");
  assert.deepEqual(readPixel(png, 8, 1), { r: 255, g: 255, b: 255, a: 255 }, "top edge inside the stroke");
  assert.equal(readPixel(png, 8, 8).a, 0, "center of the outline");
});

test("fill: the center is opaque", () => {
  const png = PNG.sync.read(createRoundedNinePatch({ radius: 6, fill: true }).buffer);

  assert.equal(readPixel(png, 8, 8).a, 255);
  assert.equal(readPixel(png, 1, 1).a, 0);
});

test("inverse: only the area outside the rounded corner is painted", () => {
  const image = createRoundedNinePatch({ radius: 6, inverse: true });
  const png = PNG.sync.read(image.buffer);

  assert.equal(image.cornerSize, 6, "stroke does not change the corner size");
  assert.deepEqual(readPixel(png, 1, 1), { r: 255, g: 255, b: 255, a: 255 }, "outer corner is covered");
  assert.equal(readPixel(png, 8, 1).a, 0, "straight edge stays transparent");
  assert.equal(readPixel(png, 8, 8).a, 0, "center stays transparent");
  assert.ok(isMarker(readPixel(png, 7, 0)), "stretch markers are still written");
});

test("fill and inverse cannot be combined", () => {
  assert.throws(() => createRoundedNinePatch({ radius: 6, fill: true, inverse: true }), /fill e inverse/);
});

test("color and opacity are applied to the drawing", () => {
  const png = PNG.sync.read(createRoundedNinePatch({ radius: 4, stroke: 2, color: "#E96744", opacity: 0.5 }).buffer);

  assert.deepEqual(readPixel(png, 6, 1), { r: 0xe9, g: 0x67, b: 0x44, a: 128 });
});

test("padding writes the bottom/right content markers", () => {
  const png = PNG.sync.read(createRoundedNinePatch({ radius: 6, stroke: 4, padding: 4 }).buffer);
  const last = png.width - 1;

  assert.equal(isMarker(readPixel(png, 4, last)), false);
  assert.equal(isMarker(readPixel(png, 5, last)), true);
  assert.equal(isMarker(readPixel(png, last, 5)), true);
  assert.equal(isMarker(readPixel(png, last, last - 5)), true);
  assert.equal(isMarker(readPixel(png, last, last - 4)), false);
});

test("without padding the bottom row and right column stay transparent", () => {
  const png = PNG.sync.read(createRoundedNinePatch({ radius: 6, stroke: 4 }).buffer);
  const last = png.width - 1;

  for (let i = 0; i < png.width; i++) {
    assert.equal(readPixel(png, i, last).a, 0);
    assert.equal(readPixel(png, last, i).a, 0);
  }
});

test("invalid options throw clear errors", () => {
  assert.throws(() => createRoundedNinePatch({ radius: -1 }), /radius inválido/);
  assert.throws(() => createRoundedNinePatch({ radius: 1.5 }), /radius inválido/);
  assert.throws(() => createRoundedNinePatch({ radius: 6, stroke: 0 }), /stroke inválido/);
  assert.throws(() => createRoundedNinePatch({ radius: 6, opacity: 2 }), /opacity inválida/);
  assert.throws(() => createRoundedNinePatch({ radius: 6, color: "branco" }), /Cor inválida/);
});

test("parseHexColor accepts #RGB and #RRGGBB, with or without #", () => {
  assert.deepEqual(parseHexColor("#fff"), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseHexColor("FAFAFA"), { r: 250, g: 250, b: 250 });
});

test("default file name describes radius and stroke or fill", () => {
  assert.equal(getDefaultFileName({ radius: 6, stroke: 4 }), "rounded-radius-6-stroke-4.9.png");
  assert.equal(getDefaultFileName({ radius: 12, fill: true }), "rounded-radius-12-filled.9.png");
  assert.equal(getDefaultFileName({ radius: 6, inverse: true }), "rounded-radius-6-inverse.9.png");
});
