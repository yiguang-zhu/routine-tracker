"""Package the user-approved green ring artwork; never modify activity data/code."""
from pathlib import Path
from PIL import Image
import hashlib
import json

root = Path(__file__).resolve().parent.parent
assets = root / 'assets'
source = assets / 'approved-green-ring-source.webp'
assert hashlib.sha256(source.read_bytes()).hexdigest() == 'd7bcb4771b8060fe02d30e4eaddc65f7dfb9b82eab60d3bb4ee82afdf7bf7207', 'Approved artwork checksum mismatch'
image = Image.open(source).convert('RGB')
assert image.size == (256, 256)
protected = {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in ['app.js', 'storage.js', 'styles.css']}
for size, name in [(180, 'apple-touch-icon-green-ring.png'), (192, 'icon-green-ring-192.png'), (512, 'icon-green-ring-512.png'), (64, 'favicon-green-ring.png')]:
    icon = image.resize((size, size), Image.Resampling.LANCZOS)
    icon.save(assets / name, format='PNG', optimize=True)
    with Image.open(assets / name) as saved:
        assert saved.size == (size, size) and saved.mode == 'RGB'
for source_name, legacy_name in [('apple-touch-icon-green-ring.png', 'apple-touch-icon.png'), ('icon-green-ring-192.png', 'icon-192.png'), ('icon-green-ring-512.png', 'icon-512.png')]:
    (assets / legacy_name).write_bytes((assets / source_name).read_bytes())
(root / 'apple-touch-icon.png').write_bytes((assets / 'apple-touch-icon-green-ring.png').read_bytes())
image.save(root / 'favicon.ico', format='ICO', sizes=[(16,16), (32,32), (48,48)])
html_path = root / 'index.html'
html = html_path.read_text(encoding='utf-8')
old_favicon = '<link rel="icon" type="image/svg+xml" href="./assets/icon.svg">'
old_touch = '<link rel="apple-touch-icon" href="./assets/apple-touch-icon.png">'
assert old_favicon in html and old_touch in html
html = html.replace(old_favicon, '<link rel="icon" type="image/png" sizes="64x64" href="./assets/favicon-green-ring.png">')
html = html.replace(old_touch, '<link rel="apple-touch-icon" sizes="180x180" href="./assets/apple-touch-icon-green-ring.png">')
html_path.write_text(html, encoding='utf-8')
manifest_path = root / 'manifest.webmanifest'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
identity = {k: manifest.get(k) for k in ['id', 'start_url', 'scope', 'name', 'short_name', 'display']}
manifest['icons'] = [
    {'src':'./assets/icon-green-ring-192.png','sizes':'192x192','type':'image/png','purpose':'any maskable'},
    {'src':'./assets/icon-green-ring-512.png','sizes':'512x512','type':'image/png','purpose':'any maskable'}
]
assert identity == {k: manifest.get(k) for k in identity}
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
sw_path = root / 'sw.js'
sw = sw_path.read_text(encoding='utf-8')
assert "routine-v2-shell-2026-11-09-r1" in sw
sw = sw.replace('routine-v2-shell-2026-11-09-r1', 'routine-v2-shell-2026-11-09-r2-green-icon')
sw = sw.replace("'./assets/icon.svg'", "'./assets/favicon-green-ring.png'")
sw = sw.replace("'./assets/icon-192.png'", "'./assets/icon-green-ring-192.png'")
sw = sw.replace("'./assets/icon-512.png'", "'./assets/icon-green-ring-512.png'")
sw = sw.replace("'./assets/apple-touch-icon.png'", "'./assets/apple-touch-icon-green-ring.png'")
sw_path.write_text(sw, encoding='utf-8')
for name, expected in protected.items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name + ' unexpectedly changed'
print('PASS: PNG dimensions, artwork checksum, manifest identity, app logic and local storage preserved.')
