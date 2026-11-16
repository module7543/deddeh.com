#!/usr/bin/env python3
"""Generate REVIEW-REQUIRED line cues with local wav2vec2 CTC alignment.

Usage: python scripts/align-lyrics.py vocals.wav lyrics.txt draft.lyrics.json
Needs ffmpeg, numpy, torch, torchaudio. A separated vocal WAV is recommended.
Models are downloaded from the official PyTorch model host. Never ship the model
or separated stems. Singing, delay and accompaniment need boundary review.
"""
import argparse, json, re, subprocess
from pathlib import Path
import numpy as np
import torch, torchaudio
p=argparse.ArgumentParser();p.add_argument('audio');p.add_argument('lyrics');p.add_argument('output');p.add_argument('--windows',help='Optional JSON mapping zero-based line indices to [start,end] seconds for reviewed ambiguous phrases');a=p.parse_args()
torch.set_num_threads(4)
y=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',a.audio,'-ac','1','-ar','16000','-f','f32le','-']),dtype='<f4').copy()
bundle=torchaudio.pipelines.WAV2VEC2_ASR_LARGE_LV60K_960H;model=bundle.get_model();labels=bundle.get_labels();parts=[]
for start in range(0,len(y),320000):
 lo=max(0,start-32000);hi=min(len(y),start+352000)
 with torch.inference_mode():e,_=model(torch.from_numpy(y[lo:hi]).unsqueeze(0))
 e=e[0].log_softmax(-1).numpy();offset=round((start-lo)/320)
 parts.append(e[offset:offset+1000]);print(f'Analyzed {start/16000:.0f}s',flush=True)
E=np.concatenate(parts)
def normalize(s):return re.sub("[^A-Z' ]",'',s.upper()).replace(' ','|')
def align(text,emission):
 tokens=np.array([labels.index(c) for c in text]);states=np.zeros(2*len(tokens)+1,dtype=int);states[1::2]=tokens
 skip=np.zeros(len(states),bool);skip[2:]=(states[2:]!=0)&(states[2:]!=states[:-2])
 v=np.full(len(states),-np.inf);v[0]=0;back=np.zeros((len(emission),len(states)),np.uint8)
 for t,frame in enumerate(emission):
  c=np.r_[-np.inf,-np.inf,v[:-2]];c[~skip]=-np.inf
  q=np.stack([v,np.r_[-np.inf,v[:-1]],c]);back[t]=q.argmax(0);v=q.max(0)+frame[states]
 s=len(states)-1 if v[-1]>v[-2] else len(states)-2;path=[]
 for t in range(len(emission)-1,-1,-1):
  if s%2:path.append((t,(s-1)//2))
  s-=int(back[t,s])
 return path
stanzas=Path(a.lyrics).read_text().strip().split('\n\n');lines=[(line,group) for group,stanza in enumerate(stanzas) for line in stanza.splitlines() if line]
path=align('|'.join(normalize(line) for line,_ in lines),E);offset=0;cues=[]
windows=json.loads(Path(a.windows).read_text()) if a.windows else {}
for i,(line,group) in enumerate(lines):
 text=normalize(line);times=[t for t,j in path if offset<=j<offset+len(text)];origin=0
 if str(i) in windows:
  lo,hi=windows[str(i)];origin=lo;times=[t for t,j in align(text,E[round(lo*50):round(hi*50)])]
 cues.append(dict(text=line,start=round(origin+min(times)*.02,2),end=round(origin+(max(times)+1)*.02,2),stanza=group));offset+=len(text)+1
Path(a.output).write_text(json.dumps({'version':1,'duration':len(y)/16000,'reviewRequired':True,'cues':cues},indent=2)+'\n')
