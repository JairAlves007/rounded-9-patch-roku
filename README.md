# rounded-9-patch

Gera imagens **9-patch** (`.9.png`) de retângulos arredondados (com contorno, preenchidos ou invertidos), usando
[`pngjs`](https://github.com/lukeapage/pngjs).

O uso principal é em bordas de foco e contornos de apps **Roku SceneGraph**, num `Poster` com `uri` terminando em
`.9.png`. O Roku estica só o miolo da imagem; a espessura da borda e o arredondamento não mudam com o tamanho do
componente. O formato é o mesmo do Android.

## Requisitos

- [Node.js](https://nodejs.org) 18.3+ (ESM)

## Instalação

```bash
npm install
```

## Uso (CLI)

O **arredondamento da borda (`--radius`) é sempre escolha de quem gera a imagem**. Se a opção não vier na linha de
comando, a CLI pergunta no terminal.

```bash
# borda de foco: raio 6px, traço 4px, branca (para tingir no Roku)
node bin/rounded-9-patch.js --radius 6 --stroke 4 --out ../meu-app/images/masks/card_focus_border.9.png

# pergunta o raio interativamente
npm run generate

# fundo arredondado preenchido
node bin/rounded-9-patch.js --radius 12 --fill

# cobre-cantos invertido: arredonda um elemento quadrado sem MaskGroup
node bin/rounded-9-patch.js --radius 6 --inverse --out ../meu-app/images/masks/card_corners_inverse.9.png
```

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| `--radius <px>` | obrigatório | Arredondamento da borda (raio do canto) |
| `--stroke <px>` | `4` | Espessura do contorno (ignorada com `--fill`) |
| `--fill` | — | Retângulo preenchido em vez de contorno |
| `--inverse` | — | Pinta só **fora** do arredondado (cobre os cantos). Não combina com `--fill` |
| `--color <hex>` | `#FFFFFF` | `#RGB` ou `#RRGGBB`. Mantenha branco para tingir no Roku com `blendColor` |
| `--opacity <0-1>` | `1` | Opacidade |
| `--stretch <px>` | `2` | Tamanho da região esticável |
| `--padding <px>` | — | Margem de conteúdo: marcadores na borda de baixo e na da direita, lidos como `Poster.bitmapMargins` |
| `--out <arquivo>` | `./out/rounded-radius-<r>-<stroke-s\|filled\|inverse>.9.png` | Caminho de saída. Precisa terminar em `.9.png` |

## Uso (lib)

```js
import { createRoundedNinePatch } from "rounded-9-patch";

const { buffer, width, height, cornerSize } = createRoundedNinePatch({ radius: 6, stroke: 4 });
```

## Como funciona

```
   ·····██·····        linha de cima: pixels pretos = região que estica na horizontal
   ┌───┬──┬───┐
 · │ 1 │2 │ 3 │        1, 3, 7, 9 = cantos (max(radius, stroke) px): nunca esticam
 █ ├───┼──┼───┤        2, 8 = topo/base: esticam só na largura
 █ │ 4 │5 │ 6 │        4, 6 = laterais: esticam só na altura
 · ├───┼──┼───┤        5 = miolo: estica nos dois sentidos (transparente no contorno)
   │ 7 │8 │ 9 │
   └───┴──┴───┘
 ↑ coluna da esquerda: pixels pretos = região que estica na vertical
```

1. **Tamanho.** A imagem final tem `2 * canto + stretch` px de desenho, mais uma moldura de 1px para os marcadores.
2. **Desenho e antialias.** O retângulo arredondado é calculado por distância com sinal (SDF). Cada pixel é amostrado
   em 4×4 pontos, o que suaviza as curvas.
3. **Contorno.** É a área entre o retângulo externo (raio `radius`) e um retângulo interno recuado `stroke` px (raio
   `radius - stroke`).
4. **Marcadores.** Pixels pretos opacos na moldura indicam:
   - em cima e à esquerda, a região que estica;
   - embaixo e à direita, o padding (opcional).

## No Roku

```xml
<Poster id="focusBorder" uri="pkg:/images/masks/card_focus_border.9.png" />
```

```brightscript
m.focusBorder.width = cardWidth
m.focusBorder.height = cardHeight
m.focusBorder.blendColor = m.global.theme.colors.onSurface.neutral ' a imagem é branca; a cor vem do tema
```

Fontes oficiais:

- [Poster](https://developer.roku.com/docs/references/scenegraph/renderable-nodes/poster.md): `blendColor` e
  `bitmapMargins`.
- [RowList](https://developer.roku.com/docs/references/scenegraph/list-and-grid-nodes/rowlist.md): bitmaps de foco e
  divisores *"typically a 9-patch image"*.

### Cantos arredondados sem `MaskGroup` (`--inverse`)

O `MaskGroup` só funciona em players com OpenGL. Nos demais, ele desenha o conteúdo sem a máscara
([MaskGroup](https://developer.roku.com/docs/references/scenegraph/control-nodes/maskgroup.md)). Para arredondar um
elemento quadrado em qualquer player:

1. Desenhe o elemento com canto reto (por exemplo, um `Rectangle`).
2. Coloque por cima um `Poster` com a imagem `--inverse`, no mesmo tamanho.
3. Use a **cor do fundo da tela** em `blendColor`.

```brightscript
m.cardBackground.width = cardWidth      ' Rectangle
m.cardBackground.height = cardHeight
m.cardCorners.width = cardWidth         ' Poster com o .9.png --inverse
m.cardCorners.height = cardHeight
m.cardCorners.blendColor = m.global.theme.colors.surface.neutral ' cor do fundo atrás do card
```

Só funciona sobre fundo de **cor sólida**. Sobre imagem ou gradiente, os cantos aparecem.

## Testes

```bash
npm test
```
