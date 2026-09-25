#!/usr/bin/env bash
# Subset display fonts to the glyphs the page uses. Re-run after changing copy in index.html.
# Requires: pip install fonttools brotli; npm i @fontsource-variable/fraunces @expo-google-fonts/shippori-mincho-b1 (in tools/)
set -euo pipefail
cd "$(dirname "$0")/.."
NM=tools/node_modules
LATIN="U+0020-007E,U+00A9,U+00B0,U+00D7,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026,U+2192,U+2193"
for style in normal italic; do
  pyftsubset "$NM/@fontsource-variable/fraunces/files/fraunces-latin-full-$style.woff2" \
    --unicodes="$LATIN" --layout-features='*' --flavor=woff2 --output-file="assets/fonts/fraunces-$style.woff2"
done
python3 - <<'PY' > /tmp/jp-glyphs.txt
s = open('index.html', encoding='utf-8').read()
print(''.join(sorted({c for c in s if ord(c) > 0x2000})) + '、。「」『』（）・ー〜！？')
PY
pyftsubset "$NM/@expo-google-fonts/shippori-mincho-b1/500Medium/ShipporiMinchoB1_500Medium.ttf" \
  --text-file=/tmp/jp-glyphs.txt --unicodes="U+0020-007E" --layout-features='palt,kern,liga' \
  --flavor=woff2 --output-file=assets/fonts/shippori-b1-500.woff2
