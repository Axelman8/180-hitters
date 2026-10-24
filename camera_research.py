"""Independent shadow experiment, never a scoring authority.

Uses recorded images and exported calibration (still an AutoDarts dependency).
Runs off the scoring thread; no training, no parameter fitting to target scores.
Agreement with AutoDarts is NOT accuracy without independent human labels.
"""
import json
import math
from pathlib import Path


def analyze(folder, previous):
    folder, previous = Path(folder), Path(previous) if previous else None
    result = {'experimental': True, 'verifiedByHuman': False,
              'method': 'Independent frame difference / robust axis / board-plane intersection',
              'limitations': 'Sequential snapshots; overlap and bent/hidden shafts can bias axes. Uses exported AutoDarts calibration. Never writes game scores.'}
    metadata = json.loads((folder/'observation.json').read_text())
    throws = metadata['state'].get('throws', [])
    if not throws or previous is None or not previous.is_dir():
        return {**result, 'status':'no-comparable-pair'}
    before_meta = json.loads((previous/'observation.json').read_text())
    if metadata.get('consistentVisit') is False or before_meta.get('consistentVisit') is False:
        return {**result, 'status':'board-changed-during-capture'}
    old = before_meta['state'].get('throws', [])
    if len(throws) != len(old)+1 or throws[:-1] != old:
        return {**result, 'status':'not-one-new-dart'}
    try:
        import cv2
        import numpy as np
    except ImportError:
        return {**result, 'status':'image-analysis-dependencies-unavailable'}
    cv2.setNumThreads(1)
    geometry = json.loads((folder/'config-calibration-geometry.json').read_text())
    ellipses = json.loads((folder/'config-calibration-ellipses.json').read_text())
    lines, observations = [], []
    for i, cam in enumerate(geometry['cams']):
        before=cv2.imread(str(previous/f'img-cams-{i}.jpg'))
        after=cv2.imread(str(folder/f'img-cams-{i}.jpg'))
        if before is None or after is None or before.shape!=after.shape: continue
        diff=cv2.absdiff(cv2.cvtColor(before,cv2.COLOR_BGR2GRAY),cv2.cvtColor(after,cv2.COLOR_BGR2GRAY))
        mask=(cv2.GaussianBlur(diff,(5,5),0)>25).astype(np.uint8)*255
        mask=cv2.morphologyEx(mask,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
        contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
        contours=[c for c in contours if cv2.contourArea(c)>100]
        if not contours: continue
        contour=max(contours,key=cv2.contourArea)
        points=contour.reshape(-1,2).astype(np.float32)
        vx,vy,x,y=cv2.fitLine(points,cv2.DIST_HUBER,0,.01,.01).ravel()
        length=float(np.ptp((points-[x,y])@[vx,vy]))
        width=float(np.percentile(np.abs((points-[x,y])@[-vy,vx]),90))
        H=np.array(cam['homography'],dtype=float)
        outer=np.array(ellipses[str(i)]['doubleOuterPoints'],dtype=float)
        ring=cv2.perspectiveTransform(outer.reshape(1,-1,2),H)[0]
        # Fit the exported outer double ring, whose physical radius is 170 mm.
        A=np.column_stack([2*ring,np.ones(len(ring))]);b=(ring*ring).sum(axis=1)
        cx,cy,c=np.linalg.lstsq(A,b,rcond=None)[0]
        radius=math.sqrt(max(1,c+cx*cx+cy*cy))
        ends=np.array([[x-vx*100,y-vy*100],[x+vx*100,y+vy*100]],dtype=float)
        plane=(cv2.perspectiveTransform(ends.reshape(1,-1,2),H)[0]-[cx,cy])*170/radius
        direction=plane[1]-plane[0];normal=np.array([-direction[1],direction[0]])/np.linalg.norm(direction)
        line=np.r_[normal,-normal@plane[0]]
        observations.append(dict(camera=i,lengthPx=round(length,2),widthPx=round(width,2),line=line.tolist()))
        if length>35 and length>3*width: lines.append(line)
    result['cameras']=observations
    result['autodartsLabel']=throws[-1].get('segment',{}).get('name')
    if len(lines)<3: return {**result,'status':'insufficient-three-camera-evidence'}
    L=np.array(lines);xy=np.linalg.lstsq(L[:,:2],-L[:,2],rcond=None)[0]
    residual=float(np.max(np.abs(L[:,:2]@xy+L[:,2])))
    r=float(np.linalg.norm(xy));angle=math.atan2(xy[0],-xy[1])%(2*math.pi)
    nums=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5]
    number=nums[int((angle+math.pi/20)/(math.pi/10))%20]
    label='DB' if r<6.35 else 'SB' if r<15.9 else 'MISS' if r>170 else ('D' if r>=162 else 'T' if 99.4<=r<=107.4 else 'S')+str(number)
    return {**result,'status':'experimental-estimate','xyMm':xy.tolist(),'residualMm':residual,
            'candidateLabel':label,'agreesWithAutodarts':label==result['autodartsLabel']}
