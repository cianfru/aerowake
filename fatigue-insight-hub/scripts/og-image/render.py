"""Render og.html to public/og-image.png (1200x630).

Run from fatigue-insight-hub after npm ci:  python scripts/og-image/render.py [out.png]
Needs Python Playwright with a Chromium build (set CHROMIUM_PATH to use a
specific binary). Fonts, node modules and the logo are served from this
checkout through a routed origin, so nothing is fetched from the network.
"""
import mimetypes
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
HUB = HERE.parents[1]
OUT = sys.argv[1] if len(sys.argv) > 1 else str(HUB / 'public' / 'og-image.png')

MAP = {
    '/og.html': HERE / 'og.html',
    '/logo.png': HUB / 'src/assets/logo-dark.png',
}


def serve(route):
    path = '/' + route.request.url.split('://', 1)[1].split('/', 1)[1]
    if path in MAP:
        f = MAP[path]
    elif path.startswith('/fonts/'):
        f = HUB / 'public' / path.lstrip('/')
    elif path.startswith('/node/'):
        f = HUB / 'node_modules' / path[len('/node/'):]
    else:
        route.abort()
        return
    route.fulfill(status=200, body=f.read_bytes(), headers={'content-type': mimetypes.guess_type(str(f))[0] or 'application/octet-stream'})


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None)
    ctx = b.new_context(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
    ctx.route('http://og.local/**', serve)
    pg = ctx.new_page()
    pg.on('console', lambda m: print('console', m.text))
    pg.on('pageerror', lambda e: print('error', e))
    pg.goto('http://og.local/og.html')
    pg.wait_for_selector('body[data-ready="1"]', timeout=10000)
    pg.evaluate('document.fonts.ready')
    pg.wait_for_timeout(300)
    pg.screenshot(path=OUT)
    b.close()
print('wrote', OUT)
