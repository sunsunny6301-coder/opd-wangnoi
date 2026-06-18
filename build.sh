#!/bin/bash
# ── Build "OPD วังน้อยสัตวแพทย์.html" — single self-contained file ──
# Inlines: CSS, vendor React/ReactDOM/Babel, logo (base64), data + all components.
# No build toolchain required on the machine; Babel compiles JSX in the browser.
set -euo pipefail
cd "$(dirname "$0")"

OUT="OPD วังน้อยสัตวแพทย์.html"
LOGO_B64=$(base64 -w0 _design/opd/project/assets/logo.jpg)

{
cat <<'HEAD'
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>OPD วังน้อยสัตวแพทย์</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700;800&family=Quicksand:wght@400;500;600;700&family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
HEAD
cat src/styles.css
cat <<'MID1'
</style>
</head>
<body style="font-family: 'Quicksand', 'Anuphan', sans-serif">
<div id="root"></div>

<script>
MID1
cat vendor/react.production.min.js
echo '</script>'
echo '<script>'
cat vendor/react-dom.production.min.js
echo '</script>'
echo '<script>'
cat vendor/babel.min.js
echo '</script>'
echo '<script>'
cat vendor/xlsx.full.min.js
echo '</script>'
echo '<script>'
cat vendor/supabase.min.js
echo '</script>'

echo '<script>'
printf 'window.LOGO_SRC = "data:image/jpeg;base64,%s";\n' "$LOGO_B64"
cat src/data.js
echo '</script>'

for f in ui prints dashboard case-view pos-stock reports appointments history tax app; do
  printf '\n<!-- ── %s ── -->\n<script type="text/babel">\n' "$f"
  cat "src/$f.jsx"
  printf '\n</script>\n'
done

cat <<'TAIL'
</body>
</html>
TAIL
} > "$OUT"

ls -la "$OUT"
