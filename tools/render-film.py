#!/usr/bin/env python3
"""Original, seamless procedural website films. Requires NumPy and ffmpeg.

Usage: python tools/render-film.py nihilo
No downloaded imagery, generative-image inputs, or stock media are used.
"""
from pathlib import Path
import subprocess
import sys
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
W, H, FPS, DURATION = 960, 540, 24, 8
Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
x = (X - W / 2) / H
y = (Y - H / 2) / H
TAU = 2 * np.pi
RNG = np.random.default_rng(12371)
PARTICLES = RNG.uniform(0, 1, (66, 5))


def mix(a, b, t):
    return a * (1 - t) + b * t


def overlay(im, color, opacity):
    a = np.clip(opacity, 0, 1)[..., None]
    return im * (1 - a) + np.asarray(color) * a


def ball(im, cx, cy, radius, mode='chrome'):
    dx, dy = (x - cx) / radius, (y - cy) / radius
    d2 = dx * dx + dy * dy
    z = np.sqrt(np.maximum(1 - d2, 0))
    edge = np.clip((1 - d2) * H * radius, 0, 1)
    if mode == 'chrome':
        # Ray-traced sphere normals with a hand-authored studio reflection map.
        ry = 2 * dy * z
        rx = 2 * dx * z
        env = 0.30 + 0.56 * np.exp(-((ry + .42) / .22) ** 2)
        env += .17 * np.exp(-((ry - .74) / .12) ** 2)
        env -= .26 * np.exp(-((ry - .24) / .12) ** 2)
        env += .10 * np.sin(rx * 3.8 + ry * 2.5)
        rim = (1 - z) ** 4
        env = np.clip(env + .38 * rim, 0, 1)
        col = np.stack([env * 1.04 + .035, env * 1.01 + .023, env * .96 + .005], axis=-1)
        spec = np.exp(-((dx + .35) ** 2 + (dy + .58) ** 2) * 85)
        col += spec[..., None] * .45
    else:
        lambert = np.maximum(-dx * .4 - dy * .55 + z * .73, 0)
        col = np.stack([.40 + .52 * lambert, .13 + .29 * lambert, .055 + .14 * lambert], axis=-1)
        col += np.exp(-((dx + .3) ** 2 + (dy + .45) ** 2) * 45)[..., None] * .18
    return im * (1 - edge[..., None]) + col * edge[..., None]


def halcyon(t):
    p = t * TAU
    sky = .5 + y
    im = np.empty((H, W, 3), dtype=np.float32)
    for ch, top, bottom in [(0, .88, .97), (1, .83, .94), (2, .74, .88)]:
        im[..., ch] = mix(top, bottom, sky)
    # Pale orbital architecture drifts behind a levitating polished sphere.
    cy = -.07 + .025 * np.sin(p)
    for radius, width, tilt in [(.40, .014, .40), (.64, .006, -.24)]:
        dx, dy = x, y + .10
        u = dx * np.cos(tilt) + dy * np.sin(tilt)
        v = -dx * np.sin(tilt) + dy * np.cos(tilt)
        rr = np.sqrt((u / radius) ** 2 + (v / (radius * .48)) ** 2)
        band = np.exp(-((rr - 1) / width) ** 2)
        im = overlay(im, [.72, .66, .56], band * .65)
        highlight = np.exp(-((rr - .988) / (width * .45)) ** 2)
        im = overlay(im, [1, .99, .94], highlight * .8)
    shadow = np.exp(-((x / .24) ** 2 + ((y - .26) / .032) ** 2))
    im = overlay(im, [.46, .40, .33], shadow * .21)
    # Slow concentric floor ripples preserve the seamless phase.
    floor_r = np.sqrt(x * x + ((y - .27) * 4.8) ** 2)
    ripples = (np.cos(floor_r * 65 - p * 2) * .5 + .5) ** 8
    ripples *= np.exp(-floor_r * 5) * np.clip((y - .20) * 40, 0, 1)
    im = overlay(im, [.69, .64, .56], ripples * .16)
    im = ball(im, .025 * np.sin(p), cy, .204 + .004 * np.cos(p))
    im = ball(im, -.47 + .028 * np.cos(p), .065 + .03 * np.sin(p), .041, 'clay')
    im = ball(im, .47 + .02 * np.sin(p), -.27 + .017 * np.cos(p), .018)
    vignette = np.clip(x * x * .13 + y * y * .18, 0, .2)
    return im * (1 - vignette[..., None])


def anima(t):
    p = t * TAU
    im = np.empty((H, W, 3), dtype=np.float32)
    atmosphere = np.exp(-((x - .1) ** 2 / .6 + (y + .03) ** 2 / .3))
    im[..., 0] = .012 + .055 * atmosphere
    im[..., 1] = .037 + .095 * atmosphere
    im[..., 2] = .027 + .035 * atmosphere
    cells = [(-.53, -.23, .14, .7), (.44, .25, .16, 1.8), (-.60, .25, .085, 3.1),
             (.62, -.25, .095, 4.2), (.04, -.02, .24, 0), (.27, -.32, .062, 2.7)]
    for cx, cy, radius, phase in cells:
        cx += .025 * np.sin(p + phase)
        cy += .020 * np.cos(p + phase)
        dx, dy = x - cx, (y - cy) * 1.09
        angle = np.arctan2(dy, dx)
        radius_field = radius * (1 + .055 * np.sin(angle * 5 + p) + .026 * np.cos(angle * 8 - p * 2))
        rr = np.sqrt(dx * dx + dy * dy) / radius_field
        rim = np.exp(-((rr - 1) / .024) ** 2)
        inner = np.exp(-((rr - .92) / .07) ** 2)
        glow = np.exp(-((rr - 1) / .19) ** 2)
        membrane = np.clip(1 - rr ** 4, 0, 1)
        directional = .48 + .52 * (np.sin(angle - .7) * .5 + .5)
        im += glow[..., None] * np.array([.055, .09, .025])
        im = overlay(im, [.23, .33, .12], membrane * .32)
        im += (rim * directional)[..., None] * np.array([.66, .78, .39])
        im += inner[..., None] * np.array([.13, .20, .07])
        nucleus_r = np.sqrt((dx + radius * .22) ** 2 + (dy - radius * .15) ** 2) / radius
        nucleus = np.exp(-((nucleus_r - .25) / .025) ** 2)
        im += nucleus[..., None] * np.array([.19, .31, .12])
        # Fine suspended organelles travel in closed curves.
        for j in range(5):
            a = j * 2.399 + p * .0 + phase
            ox = cx + np.cos(a + .15 * np.sin(p)) * radius * .60
            oy = cy + np.sin(a + .15 * np.sin(p)) * radius * .55
            spot = np.exp(-((x - ox) ** 2 + (y - oy) ** 2) / (radius * .038) ** 2)
            im += spot[..., None] * np.array([.37, .50, .14])
    for a, b, c, d, e in PARTICLES:
        px = (a - .5) * 1.9 + .024 * np.sin(p + d * TAU)
        py = (b - .5) * 1.12 + .026 * np.cos(p + e * TAU)
        radius = .0015 + c * .0038
        spot = np.exp(-((x - px) ** 2 + (y - py) ** 2) / radius ** 2)
        im += spot[..., None] * np.array([.55, .67, .28]) * (.15 + .35 * d)
    return 1 - np.exp(-im * 1.4)


def nihilo(t):
    p = t * TAU
    cx, cy = .10, -.015
    dx, dy = x - cx, y - cy
    r = np.sqrt(dx * dx + dy * dy) + 1e-5
    a = np.arctan2(dy, dx)
    # Nested angular waves make the cloud evolve continuously and loop exactly.
    flow = a + r * 5.6 - p
    cloud = np.zeros((H, W), dtype=np.float32)
    for f, amp in [(3, .45), (7, .22), (13, .11), (23, .055)]:
        cloud += np.sin(flow * f + np.sin(r * f * 5 + p) * 1.3) * amp
    cloud = np.clip(cloud + .20, 0, 1)
    disc = np.exp(-((r - .28) / .16) ** 2)
    filaments = (np.sin(a * 5 + r * 27 - p) * .5 + .5) ** 12
    filaments *= np.exp(-((r - .32) / .18) ** 2)
    im = np.empty((H, W, 3), dtype=np.float32)
    im[..., 0] = .004 + cloud * disc * .38 + filaments * .10
    im[..., 1] = .005 + cloud * disc * .080 + filaments * .025
    im[..., 2] = .008 + cloud * disc * .017
    halo = np.exp(-r * 10) * .9
    im += halo[..., None] * np.array([.75, .17, .025])
    radius = .108 * (1 + .018 * np.sin(p))
    sphere = np.clip((radius - r) * H * 3, 0, 1)
    z = np.sqrt(np.maximum(1 - (r / radius) ** 2, 0))
    plasma = .5 + .17 * np.sin(dx * 235 + np.sin(dy * 145 + p) * 2)
    plasma += .14 * np.sin(dy * 291 + np.sin(dx * 157 - p) * 2)
    plasma += .07 * np.sin(dx * 508 + dy * 357 + np.sin(p) * 3)
    star = np.stack([1.05 + plasma * .5, .26 + plasma * .75, .04 + plasma * .30], axis=-1)
    star *= (.65 + .35 * z)[..., None]
    im = im * (1 - sphere[..., None]) + star * sphere[..., None]
    corona = np.exp(-((r - radius) / .006) ** 2)
    im += corona[..., None] * np.array([1.35, .64, .18])
    tendrils = np.exp(-((r - radius * 1.20) / .025) ** 2)
    tendrils *= (.5 + .5 * np.sin(a * 28 + np.sin(a * 11 - p) * 2)) ** 8
    im += tendrils[..., None] * np.array([.70, .14, .015])
    for aa, b, c, d, e in PARTICLES[:46]:
        px = (aa - .5) * 1.9
        py = (b - .5) * 1.1
        spot = np.exp(-((x - px) ** 2 + (y - py) ** 2) / (.0007 + c * .0014) ** 2)
        im += spot[..., None] * np.array([.40, .43, .48]) * (.45 + .15 * np.sin(p + e * TAU))
    return 1 - np.exp(-im * 1.4)


TARGETS = {'nihilo': (nihilo, ROOT / 'public/assets/stellar-film.mp4')}


def render(name):
    function, output = TARGETS[name]
    output.parent.mkdir(parents=True, exist_ok=True)
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo',
           '-vcodec', 'rawvideo', '-s', f'{W}x{H}', '-pix_fmt', 'rgb24', '-r', str(FPS),
           '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19',
           '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for frame in range(FPS * DURATION):
        color = function(frame / (FPS * DURATION))
        # A fixed sub-pixel grain reduces banding while remaining loop-safe.
        grain = (np.sin(X * 12.9898 + Y * 78.233) * 43758.5453) % 1
        color += (grain[..., None] - .5) / 450
        proc.stdin.write((np.clip(color, 0, 1) * 255).astype(np.uint8).tobytes())
        if frame % 48 == 0:
            print(f'{name}: {frame}/{FPS * DURATION}', flush=True)
    proc.stdin.close()
    if proc.wait():
        raise RuntimeError(f'ffmpeg failed for {name}')
    print(f'Finished: {output} ({output.stat().st_size:,} bytes)', flush=True)


if __name__ == '__main__':
    selected = sys.argv[1] if len(sys.argv) > 1 else 'all'
    for name in TARGETS if selected == 'all' else [selected]:
        render(name)
