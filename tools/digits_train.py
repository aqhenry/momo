"""Train the handwritten-digit recogniser used by the writing pad (js/digits.js).

A small CNN trained on MNIST with augmentation that imitates finger writing on an iPad (thick or thin
strokes, slant, rotation, squashing, off-centre), then quantised to int8 and saved as js/digits-model.json
(~60 KB). Inference runs in plain JS, no libraries.

    .venv/bin/pip install numpy torch
    # MNIST into .cache/mnist/ (see README in this script's docstring):
    #   https://ossci-datasets.s3.amazonaws.com/mnist/{train,t10k}-{images-idx3,labels-idx1}-ubyte.gz, gunzipped
    .venv/bin/python tools/digits_train.py
"""
import base64
import json
import pathlib

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / '.cache' / 'mnist'
OUT = ROOT / 'js' / 'digits-model.json'


def load(kind):
    imgs = np.frombuffer((DATA / f'{kind}-images-idx3-ubyte').read_bytes(), np.uint8, offset=16).reshape(-1, 1, 28, 28)
    labels = np.frombuffer((DATA / f'{kind}-labels-idx1-ubyte').read_bytes(), np.uint8, offset=8)
    return torch.tensor(imgs, dtype=torch.float32) / 255, torch.tensor(labels, dtype=torch.long)


class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.c1 = nn.Conv2d(1, 16, 3, padding=1)
        self.c2 = nn.Conv2d(16, 24, 3, padding=1)
        self.f1 = nn.Linear(24 * 7 * 7, 48)
        self.f2 = nn.Linear(48, 10)

    def forward(self, x):
        x = F.max_pool2d(F.relu(self.c1(x)), 2)
        x = F.max_pool2d(F.relu(self.c2(x)), 2)
        x = F.relu(self.f1(x.flatten(1)))
        return self.f2(F.dropout(x, 0.25, self.training))


def augment(x):
    """Finger-writing look: random affine, stroke thickness, then re-fit into the MNIST 20x20 box."""
    n = x.shape[0]
    ang = (torch.rand(n) - 0.5) * 0.5            # ±14°
    shear = (torch.rand(n) - 0.5) * 0.6
    sx = 0.75 + torch.rand(n) * 0.45              # squash / stretch
    sy = 0.85 + torch.rand(n) * 0.3
    cos, sin = torch.cos(ang), torch.sin(ang)
    theta = torch.zeros(n, 2, 3)
    theta[:, 0, 0] = cos / sx
    theta[:, 0, 1] = (-sin + shear) / sx
    theta[:, 1, 0] = sin / sy
    theta[:, 1, 1] = cos / sy
    theta[:, :, 2] = (torch.rand(n, 2) - 0.5) * 0.15
    grid = F.affine_grid(theta, x.shape, align_corners=False)
    x = F.grid_sample(x, grid, align_corners=False)
    # stroke thickness: some thicker (finger), some thinner
    r = torch.rand(n)
    thick = F.max_pool2d(x, 3, 1, 1)
    thin = -F.max_pool2d(-x, 2, 1, 1)[:, :, :28, :28]
    x = torch.where((r < 0.45)[:, None, None, None], thick, torch.where((r > 0.85)[:, None, None, None], thin, x))
    return refit(x.clamp(0, 1))


def refit(x):
    """Same normalisation as js/digits.js: crop to ink, fit the longer side to 20px, centre of mass at (14,14)."""
    out = torch.zeros_like(x)
    for i in range(x.shape[0]):
        img = x[i, 0]
        ys, xs = torch.nonzero(img > 0.1, as_tuple=True)
        if len(ys) == 0:
            continue
        crop = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        h, w = crop.shape
        s = 20 / max(h, w)
        nh, nw = max(1, round(h * s)), max(1, round(w * s))
        crop = F.interpolate(crop[None, None], size=(nh, nw), mode='bilinear', align_corners=False)[0, 0]
        canvas = torch.zeros(28, 28)
        tot = crop.sum()
        cy = (crop.sum(1) * torch.arange(nh)).sum() / tot
        cx = (crop.sum(0) * torch.arange(nw)).sum() / tot
        oy, ox = int(round(14 - cy.item())), int(round(14 - cx.item()))
        oy, ox = max(0, min(28 - nh, oy)), max(0, min(28 - nw, ox))
        canvas[oy:oy + nh, ox:ox + nw] = crop
        out[i, 0] = canvas
    return out


def main():
    torch.manual_seed(0)
    dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
    xtr, ytr = load('train')
    xte, yte = load('t10k')
    print('pre-augmenting…', flush=True)
    # two augmented copies plus the originals (refit for consistency); augmentation runs once, on CPU
    sets = [refit(xtr)] + [augment(xtr) for _ in range(2)]
    X = torch.cat(sets)
    Y = torch.cat([ytr] * len(sets))
    xte_aug = augment(xte)
    net = Net().to(dev)
    opt = torch.optim.Adam(net.parameters(), 2e-3)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, 4e-3, total_steps=8 * (len(X) // 256 + 1))
    for epoch in range(8):
        net.train()
        perm = torch.randperm(len(X))
        for k in range(0, len(X), 256):
            idx = perm[k:k + 256]
            loss = F.cross_entropy(net(X[idx].to(dev)), Y[idx].to(dev))
            opt.zero_grad()
            loss.backward()
            opt.step()
            sched.step()
        net.eval()
        with torch.no_grad():
            acc = (net(refit(xte).to(dev)).argmax(1).cpu() == yte).float().mean().item()
            acc2 = (net(xte_aug.to(dev)).argmax(1).cpu() == yte).float().mean().item()
        print(f'epoch {epoch + 1}: test {acc:.4f}, distorted test {acc2:.4f}', flush=True)

    # int8 per-tensor quantisation
    net = net.cpu()
    layers = []
    for name in ('c1', 'c2', 'f1', 'f2'):
        m = getattr(net, name)
        w = m.weight.detach().numpy().astype(np.float32)
        scale = float(np.abs(w).max() / 127)
        q = np.round(w / scale).astype(np.int8)
        layers.append({'name': name, 'shape': list(w.shape), 'scale': scale,
                       'w': base64.b64encode(q.tobytes()).decode(), 'b': [round(float(v), 6) for v in m.bias.detach()]})
    OUT.write_text(json.dumps({'input': 28, 'layers': layers}))
    print('saved', OUT, OUT.stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
