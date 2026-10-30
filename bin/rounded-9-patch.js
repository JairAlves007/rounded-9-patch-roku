#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { createRoundedNinePatch, getDefaultFileName } from "../src/index.js";

const USAGE = `Uso: rounded-9-patch --radius <px> [opções]

  --radius <px>    arredondamento da borda (raio do canto). Obrigatório: se faltar, é perguntado no terminal
  --stroke <px>    espessura do contorno (padrão 4)
  --fill           retângulo preenchido em vez de contorno
  --inverse        pinta só FORA do arredondado (cobre os cantos): por cima de um elemento quadrado, com a cor do
                   fundo em blendColor, arredonda sem MaskGroup. Exige fundo de cor sólida
  --color <hex>    #RGB ou #RRGGBB (padrão #FFFFFF; mantenha branco para tingir com blendColor no Roku)
  --opacity <0-1>  opacidade (padrão 1)
  --stretch <px>   tamanho da região esticável (padrão 2)
  --padding <px>   margem de conteúdo (marcadores de baixo/direita, lidos como Poster.bitmapMargins)
  --out <arquivo>  caminho do .9.png (padrão ./out/rounded-radius-<r>-<stroke-s|filled|inverse>.9.png)
  --help           mostra esta ajuda
`;

function toInteger(name, value) {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (value.trim() === "" || !Number.isInteger(number)) throw new Error(`--${name} precisa ser um inteiro: "${value}"`);
  return number;
}

function toNumber(name, value) {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (value.trim() === "" || Number.isNaN(number)) throw new Error(`--${name} precisa ser um número: "${value}"`);
  return number;
}

async function askRadius() {
  if (!process.stdin.isTTY) {
    throw new Error("--radius é obrigatório: escolha o arredondamento da borda em px.");
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question("Arredondamento da borda (raio do canto, em px): ");
    return toInteger("radius", answer);
  } finally {
    prompt.close();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      radius: { type: "string" },
      stroke: { type: "string" },
      fill: { type: "boolean", default: false },
      inverse: { type: "boolean", default: false },
      color: { type: "string" },
      opacity: { type: "string" },
      stretch: { type: "string" },
      padding: { type: "string" },
      out: { type: "string" },
      help: { type: "boolean", default: false }
    }
  });

  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }

  const options = {
    radius: values.radius === undefined ? await askRadius() : toInteger("radius", values.radius),
    stroke: toInteger("stroke", values.stroke),
    fill: values.fill,
    inverse: values.inverse,
    color: values.color,
    opacity: toNumber("opacity", values.opacity),
    stretch: toInteger("stretch", values.stretch),
    padding: toInteger("padding", values.padding)
  };

  const outPath = values.out ?? join("out", getDefaultFileName(options));
  if (!outPath.endsWith(".9.png")) throw new Error(`--out precisa terminar em ".9.png": "${outPath}"`);

  const image = createRoundedNinePatch(options);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, image.buffer);

  process.stdout.write(`${outPath} (${image.width}x${image.height}, cantos fixos de ${image.cornerSize}px)\n`);
}

main().catch((error) => {
  process.stderr.write(`Erro: ${error.message}\n\n${USAGE}`);
  process.exitCode = 1;
});
