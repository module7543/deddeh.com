#!/usr/bin/env python3
"""Recording -> compact, quantized spectral energy. Requires ffmpeg, numpy, scipy.
Usage: python scripts/analyze-audio.py public/audio/song.mp3 public/music/song.analysis.json
No pitch transcription or inferred note names. Times are decoded audio seconds.
"""
import argparse, hashlib, json, subprocess
from pathlib import Path
import numpy as np
from scipy.signal import stft, find_peaks, correlate
p = argparse.ArgumentParser(); p.add_argument('audio'); p.add_argument('output'); args = p.parse_args()
sr, hop, size = 24000, 1200, 2048
raw = subprocess.check_output(['ffmpeg','-v','error','-i',args.audio,'-vn','-ac','1','-ar',str(sr),'-f','f32le','-'])
y = np.frombuffer(raw, dtype='<f4')
f, t, z = stft(y, sr, nperseg=size, noverlap=size-hop, boundary='zeros')
power = np.abs(z)**2
edges = [40,160,400,900,1800,3500,7000,12000]
bands = np.stack([np.sqrt(power[(f >= lo)&(f < hi)].sum(axis=0)) for lo,hi in zip(edges,edges[1:])],axis=1)
# Per-band reference retains its dynamics while allowing quieter high bands to be visible.
refs = np.percentile(bands,98,axis=0)
bands = np.clip(bands / np.maximum(refs,1e-8),0,1)
rms = np.sqrt(power.sum(axis=0)); rms = np.clip(rms / max(np.percentile(rms,98),1e-8),0,1)
flux = np.maximum(np.diff(np.abs(z),axis=1,prepend=np.abs(z[:,:1])),0).sum(axis=0)
flux = np.clip(flux / max(np.percentile(flux,98),1e-8),0,1)
frames = np.round(np.column_stack([rms,flux,bands])*255).astype(int)
overview = [np.round(frames[ids].mean(axis=0)).astype(int).tolist() for ids in np.array_split(np.arange(len(frames)),20)]
peaks,_=find_peaks(flux,height=.45,distance=5)
# Periodicity is evidence, not a metrical claim; report strongest candidates for review.
ac=correlate(flux-flux.mean(),flux-flux.mean(),mode='full',method='fft')[len(flux)-1:]
lags=np.arange(6,31); candidates=lags[np.argsort(ac[lags])[-5:][::-1]]
out={'version':1,'sha256':hashlib.sha256(Path(args.audio).read_bytes()).hexdigest(),'duration':round(len(y)/sr,6),'step':hop/sr,'bandsHz':edges,'columns':['rms','flux','40–160','160–400','400–900','900–1800','1800–3500','3500–7000','7000–12000'],'frames':frames.tolist(),'overview':overview}
Path(args.output).write_text(json.dumps(out,separators=(',',':'))+'\n')
print(json.dumps({'duration':out['duration'],'frames':len(frames),'bytes':Path(args.output).stat().st_size,'pulseCandidatesBpm':(60/(candidates*hop/sr)).round(1).tolist(),'onsets':len(peaks)}))
