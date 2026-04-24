import { useState, useRef, useEffect, useCallback } from "react";

const SHAPES = [
  { id:"circle",  label:"Circle"  },
  { id:"square",  label:"Square"  },
  { id:"stamp",   label:"Stamp"   },
  { id:"star",    label:"Star"    },
  { id:"heart",   label:"Heart"   },
  { id:"diamond", label:"Diamond" },
  { id:"leaf",    label:"Leaf"    },
  { id:"flower",  label:"Flower"  },
];

const C = {
  bg:"#f8f5f1", panel:"#f3ede8", border:"#e6ddd6",
  accent:"#c4a090", text:"#78706a", muted:"#b5aca5",
  faint:"#ede7e1", white:"#fdfaf8", dark:"#5a5250",
};

// ── clipShape: unit coords (0,0) center radius 1 ─────────
function clipShape(ctx, shape) {
  ctx.beginPath();
  switch(shape) {
    case "circle": ctx.arc(0,0,1,0,Math.PI*2); break;
    case "square": ctx.rect(-1,-1,2,2); break;
    case "stamp": {
      const b=0.14,n=4,s=2/n;
      ctx.moveTo(-1,-1);
      for(let i=0;i<n;i++) ctx.arc(-1+s*i+s/2,-1,b,Math.PI,0,false);
      ctx.lineTo(1,-1);
      for(let i=0;i<n;i++) ctx.arc(1,-1+s*i+s/2,b,-Math.PI/2,Math.PI/2,false);
      ctx.lineTo(1,1);
      for(let i=n-1;i>=0;i--) ctx.arc(-1+s*i+s/2,1,b,0,Math.PI,false);
      ctx.lineTo(-1,1);
      for(let i=n-1;i>=0;i--) ctx.arc(-1,-1+s*i+s/2,b,Math.PI/2,-Math.PI/2,false);
      ctx.closePath(); break;
    }
    case "star": {
      // 깔끔한 5각 별 — outer/inner 점 교차
      const pts=5, outer=1, inner=0.4;
      for(let i=0;i<pts*2;i++){
        const a=(i*Math.PI)/pts - Math.PI/2;
        const r=i%2===0 ? outer : inner;
        if(i===0) ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r);
        else       ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
      }
      ctx.closePath(); break;
    }
    case "heart": {
      // 좌우 대칭 하트 — 아래 뾰족, 위 두 봉우리
      // 중심 (0,0), 위로 ±0.5, 아래로 1
      ctx.moveTo(0, 1);                              // 아래 끝
      ctx.bezierCurveTo(-0.1, 0.6, -1, 0.4, -1, -0.2);  // 왼쪽 곡선
      ctx.bezierCurveTo(-1, -0.8, -0.5, -1, 0, -0.5);   // 왼쪽 봉우리
      ctx.bezierCurveTo(0.5, -1, 1, -0.8, 1, -0.2);     // 오른쪽 봉우리
      ctx.bezierCurveTo(1, 0.4, 0.1, 0.6, 0, 1);        // 오른쪽 곡선
      ctx.closePath(); break;
    }
    case "diamond":
      ctx.moveTo(0,-1); ctx.lineTo(1,0); ctx.lineTo(0,1); ctx.lineTo(-1,0);
      ctx.closePath(); break;
    case "leaf":
      ctx.moveTo(0,-1);
      ctx.bezierCurveTo(0.85,-0.5,0.85,0.5,0,1);
      ctx.bezierCurveTo(-0.85,0.5,-0.85,-0.5,0,-1);
      ctx.closePath(); break;
    case "flower": {
      const p=5,cr=0.22;
      for(let i=0;i<p;i++){
        const a=(i/p)*Math.PI*2-Math.PI/2;
        const tx=Math.cos(a),ty=Math.sin(a);
        const c1x=Math.cos(a-0.48)*0.65,c1y=Math.sin(a-0.48)*0.65;
        const c2x=Math.cos(a+0.48)*0.65,c2y=Math.sin(a+0.48)*0.65;
        const ix=Math.cos(a-0.52)*cr,iy=Math.sin(a-0.52)*cr;
        const ox=Math.cos(a+0.52)*cr,oy=Math.sin(a+0.52)*cr;
        if(i===0) ctx.moveTo(ix,iy); else ctx.lineTo(ix,iy);
        ctx.bezierCurveTo(c1x,c1y,tx,ty,tx,ty);
        ctx.bezierCurveTo(tx,ty,c2x,c2y,ox,oy);
      }
      ctx.closePath(); break;
    }
    default: break;
  }
}

function applyClip(ctx,x,y,size,shape){
  const s=size/2;
  ctx.translate(x,y);
  if(shape==="leaf") ctx.rotate(Math.PI/4);
  ctx.scale(s,s);
  clipShape(ctx,shape);
  ctx.clip();
  ctx.scale(1/s,1/s);
  if(shape==="leaf") ctx.rotate(-Math.PI/4);
  ctx.translate(-x,-y);
}

// ── Shape icon ────────────────────────────────────────────
function ShapeIcon({shape,active}){
  const f=active?C.accent:C.muted;
  if(shape==="heart") return(
    <svg width={22} height={22} viewBox="-1.2 -1.2 2.4 2.4">
      <path fill={f} d="M0,1 C-0.1,0.6 -1,0.4 -1,-0.2 C-1,-0.8 -0.5,-1 0,-0.5 C0.5,-1 1,-0.8 1,-0.2 C1,0.4 0.1,0.6 0,1 Z"/>
    </svg>
  );
  if(shape==="star") return(
    <svg width={22} height={22} viewBox="-1.2 -1.2 2.4 2.4">
      <polygon fill={f} points={Array.from({length:10},(_,i)=>{
        const a=(i*Math.PI)/5-Math.PI/2, r=i%2===0?1:0.4;
        return `${Math.cos(a)*r},${Math.sin(a)*r}`;
      }).join(" ")}/>
    </svg>
  );
  if(shape==="stamp"){
    const b=0.14,n=4,s=2/n;
    let d=`M-1,-1`;
    for(let i=0;i<n;i++) d+=` L${-1+s*i+s/2-b},-1 A${b},${b} 0 0,0 ${-1+s*i+s/2+b},-1`;
    d+=` L1,-1`;
    for(let i=0;i<n;i++) d+=` L1,${-1+s*i+s/2-b} A${b},${b} 0 0,0 1,${-1+s*i+s/2+b}`;
    d+=` L1,1`;
    for(let i=n-1;i>=0;i--) d+=` L${-1+s*i+s/2+b},1 A${b},${b} 0 0,0 ${-1+s*i+s/2-b},1`;
    d+=` L-1,1`;
    for(let i=n-1;i>=0;i--) d+=` L-1,${-1+s*i+s/2+b} A${b},${b} 0 0,0 -1,${-1+s*i+s/2-b}`;
    d+=" Z";
    return <svg width={22} height={22} viewBox="-1.2 -1.2 2.4 2.4"><path fill={f} d={d}/></svg>;
  }
  if(shape==="leaf") return(
    <svg width={22} height={22} viewBox="-1.2 -1.2 2.4 2.4">
      <path fill={f} transform="rotate(45)" d="M0,-1 C0.85,-0.5 0.85,0.5 0,1 C-0.85,0.5 -0.85,-0.5 0,-1 Z"/>
    </svg>
  );
  if(shape==="flower") return(
    <svg width={22} height={22} viewBox="-1.2 -1.2 2.4 2.4">
      {Array.from({length:5},(_,i)=>{
        const a=(i/5)*Math.PI*2-Math.PI/2;
        return <ellipse key={i} fill={f} cx={Math.cos(a)*0.55} cy={Math.sin(a)*0.55} rx="0.35" ry="0.55"
          transform={`rotate(${a*180/Math.PI+90} ${Math.cos(a)*0.55} ${Math.sin(a)*0.55})`}/>;
      })}
      <circle fill={C.white} cx="0" cy="0" r="0.28"/>
      <circle fill={f} cx="0" cy="0" r="0.18"/>
    </svg>
  );
  return <span style={{fontSize:16,color:f,lineHeight:1}}>
    {shape==="circle"?"●":shape==="square"?"■":"◆"}
  </span>;
}

// ── Main ──────────────────────────────────────────────────
export default function PunchCut(){
  const [imgs,setImgs]         = useState({top:null,bot:null});
  const [holes,setHoles]       = useState([]);
  const [shape,setShape]       = useState("circle");
  const [size,setSize]         = useState(25);
  const [open,setOpen]         = useState(true);
  const [ripples,setRipples]   = useState([]);
  // cropMode: null | "top" | "bot"
  const [cropMode,setCropMode] = useState(null);
  const [previewUrl,setPreviewUrl] = useState(null);

  const topSlot=useRef(null), botSlot=useRef(null);
  const topCvs=useRef(null),  botCvs=useRef(null);

  const draw=useCallback((slot)=>{
    const cvs=slot==="top"?topCvs.current:botCvs.current;
    const el =slot==="top"?topSlot.current:botSlot.current;
    if(!cvs||!el) return;
    const dpr=window.devicePixelRatio||1;
    const W=el.clientWidth,H=el.clientHeight;
    if(cvs.width!==W*dpr||cvs.height!==H*dpr){
      cvs.width=W*dpr; cvs.height=H*dpr;
      cvs.style.width=W+"px"; cvs.style.height=H+"px";
    }
    const ctx=cvs.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);
    const my=imgs[slot], opp=imgs[slot==="top"?"bot":"top"];
    if(!my&&!opp) return;
    holes.filter(h=>h.slot===slot).forEach(h=>{
      ctx.save();
      applyClip(ctx,h.x,h.y,h.size,h.shape);
      if(opp){ ctx.drawImage(opp,0,0,W,H); }
      else if(my){ ctx.translate(0,H); ctx.scale(1,-1); ctx.drawImage(my,0,0,W,H); }
      ctx.restore();
    });
  },[imgs,holes]);

  useEffect(()=>{draw("top");draw("bot");},[draw]);

  function loadImg(file,slot){
    if(!file||!file.type.startsWith("image/")) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const img=new Image();
      img.onload=()=>{
        setImgs(p=>({...p,[slot]:img}));
        setCropMode(slot); // 삽입 즉시 크롭 모드
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function applyCrop(slot,dataUrl){
    const img=new Image();
    img.onload=()=>setImgs(p=>({...p,[slot]:img}));
    img.src=dataUrl;
    setCropMode(null);
  }

  function punch(e,slot){
    if(cropMode) return;
    if(!imgs[slot]&&!imgs[slot==="top"?"bot":"top"]) return;
    e.preventDefault(); e.stopPropagation();
    const el=slot==="top"?topSlot.current:botSlot.current;
    const rect=el.getBoundingClientRect();
    const src=e.changedTouches?e.changedTouches[0]:e;
    const x=src.clientX-rect.left, y=src.clientY-rect.top;
    const id=Date.now(), opp=slot==="top"?"bot":"top";
    const nh=[{id,slot,x,y,shape,size}];
    if(imgs[opp]) nh.push({id:id+2,slot:opp,x,y,shape,size});
    setHoles(p=>[...p,...nh]);
    setRipples(p=>[...p,{id:id+1,slot,x,y,size}]);
    setTimeout(()=>setRipples(p=>p.filter(r=>r.id!==id+1)),600);
  }

  function exportImg(){
    const tC=topCvs.current,bC=botCvs.current;
    const tE=topSlot.current,bE=botSlot.current;
    if(!tE||!bE) return;
    const W=tE.clientWidth,tH=tE.clientHeight,bH=bE.clientHeight;
    const SC=4; // 4x resolution
    const out=document.createElement("canvas");
    out.width=W*SC; out.height=(tH+bH)*SC;
    const ctx=out.getContext("2d");
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality="high";
    if(imgs.top) ctx.drawImage(imgs.top,0,0,W*SC,tH*SC);
    if(imgs.bot) ctx.drawImage(imgs.bot,0,tH*SC,W*SC,bH*SC);
    if(tC) ctx.drawImage(tC,0,0,W*SC,tH*SC);
    if(bC) ctx.drawImage(bC,0,tH*SC,W*SC,bH*SC);
    setPreviewUrl(out.toDataURL("image/png"));
  }

  const sbtn=(active)=>({
    background:active?"#fdf5f2":C.white,
    border:`1.5px solid ${active?C.accent:C.border}`,
    borderRadius:8,cursor:"pointer",
    fontFamily:"'Jost',sans-serif",fontSize:9,letterSpacing:1,
    color:active?C.accent:C.muted,transition:"all 0.15s",
    boxShadow:active?"0 2px 8px rgba(196,160,144,0.15)":"none",
  });

  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400&display=swap');
        @keyframes rpl{from{opacity:.7;transform:scale(.2)}to{opacity:0;transform:scale(2.2)}}
        input[type=range]{-webkit-appearance:none;width:100%;height:1px;background:${C.border};border-radius:1px;outline:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:${C.accent};cursor:pointer;border:2px solid ${C.white};box-shadow:0 1px 4px rgba(0,0,0,.12)}
        *{box-sizing:border-box}
      `}</style>

      {/* SIDEBAR */}
      <div style={{
        width:open?238:40,minWidth:open?238:40,
        background:C.panel,borderRight:`1px solid ${C.border}`,
        display:"flex",flexDirection:"column",
        transition:"width .3s ease,min-width .3s ease",
        overflow:"hidden",flexShrink:0,position:"relative",
      }}>
        <button onClick={()=>setOpen(o=>!o)} style={{
          position:"absolute",top:13,right:9,zIndex:20,
          width:22,height:22,borderRadius:"50%",
          border:`1px solid ${C.border}`,background:C.white,
          color:C.muted,fontSize:13,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:"0 1px 4px rgba(0,0,0,.06)",
        }}>{open?"‹":"›"}</button>

        <div style={{
          opacity:open?1:0,transition:"opacity .18s",
          pointerEvents:open?"auto":"none",
          display:"flex",flexDirection:"column",gap:18,
          padding:"16px 14px",overflowY:"auto",flex:1,minWidth:238,
        }}>
          <div style={{paddingTop:2,paddingRight:28}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:22,color:C.dark,letterSpacing:2,fontWeight:300}}>Punch Cut</div>
            <div style={{fontFamily:"'Jost',sans-serif",fontSize:8,color:C.muted,letterSpacing:3,marginTop:2,textTransform:"uppercase"}}>photo editor</div>
          </div>
          <Sep/>
          <div>
            <Lbl>Punch Shape</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginTop:10}}>
              {SHAPES.map(s=>{
                const active=shape===s.id;
                return(
                  <button key={s.id} onClick={()=>setShape(s.id)} style={{
                    ...sbtn(active),aspectRatio:"1",
                    display:"flex",flexDirection:"column",
                    alignItems:"center",justifyContent:"center",gap:5,padding:"7px 2px",
                  }}>
                    <ShapeIcon shape={s.id} active={active}/>
                    <span style={{fontSize:8,fontFamily:"'Jost',sans-serif",letterSpacing:1,color:active?C.accent:C.muted}}>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <Sep/>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
              <Lbl style={{marginBottom:0}}>Size</Lbl>
              <span style={{fontFamily:"'Jost',sans-serif",fontSize:11,color:C.accent}}>{size}px</span>
            </div>
            <input type="range" min="1" max="50" value={size} onChange={e=>setSize(+e.target.value)}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
              <span style={{fontFamily:"'Jost',sans-serif",fontSize:9,color:C.muted}}>small</span>
              <span style={{fontFamily:"'Jost',sans-serif",fontSize:9,color:C.muted}}>large</span>
            </div>
          </div>
          <Sep/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setHoles(p=>p.slice(0,-1))} style={{
              flex:1,padding:"9px 0",
              background:C.white,border:`1px solid ${C.border}`,
              borderRadius:8,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:5,
              fontFamily:"'Jost',sans-serif",fontSize:9,color:C.muted,letterSpacing:1,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
                <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
              </svg>
              Undo
            </button>
            <button onClick={()=>setHoles([])} style={{
              flex:1,padding:"9px 0",
              background:"transparent",border:`1px solid ${C.border}`,
              borderRadius:8,cursor:"pointer",
              fontFamily:"'Jost',sans-serif",fontSize:9,color:C.muted,letterSpacing:1,
            }}>Reset</button>
          </div>
        </div>
        {!open&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:50,gap:10}}>
            {[C.accent,C.border,C.border].map((c,i)=>(
              <div key={i} style={{width:6,height:6,borderRadius:"50%",background:c}}/>
            ))}
          </div>
        )}
      </div>

      {/* MAIN */}
      <div style={{
        flex:1,display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",
        padding:24,overflow:"auto",background:C.bg,
        backgroundImage:"radial-gradient(circle at 65% 25%,#f4ece6 0%,transparent 50%),radial-gradient(circle at 20% 80%,#edf0f5 0%,transparent 50%)",
      }}>
        <div style={{
          width:300,overflow:"visible",
          boxShadow:"0 20px 60px rgba(180,155,145,.2),0 4px 16px rgba(180,155,145,.1)",
          border:`1px solid ${C.border}`,position:"relative",
        }}>
          <Slot slot="top" slotRef={topSlot} cvsRef={topCvs} img={imgs.top}
            ripples={ripples} onPunch={punch} onLoad={loadImg}
            isCropping={cropMode==="top"}
            onApplyCrop={(d)=>applyCrop("top",d)}
            onCancelCrop={()=>setCropMode(null)}/>
          <div style={{height:1,background:C.border,position:"relative"}}>
            <div style={{
              position:"absolute",left:"50%",top:"50%",
              transform:"translate(-50%,-50%)",
              background:C.faint,padding:"2px 12px",
              fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",
              fontSize:9,color:C.muted,letterSpacing:3,whiteSpace:"nowrap",borderRadius:4,
            }}>· punch cut ·</div>
          </div>
          <Slot slot="bot" slotRef={botSlot} cvsRef={botCvs} img={imgs.bot}
            ripples={ripples} onPunch={punch} onLoad={loadImg}
            isCropping={cropMode==="bot"}
            onApplyCrop={(d)=>applyCrop("bot",d)}
            onCancelCrop={()=>setCropMode(null)}/>
        </div>

        <p style={{
          marginTop:14,fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",
          fontSize:13,color:C.muted,letterSpacing:1,textAlign:"center",
        }}>
          {cropMode
            ? "Drag edges or corners to crop ✦"
            : (!imgs.top&&!imgs.bot ? "Add an image to get started" : "Click the image to punch a hole ✦")}
        </p>

        {(imgs.top||imgs.bot)&&!cropMode&&(
          <button onClick={exportImg} style={{
            marginTop:16,background:C.accent,border:"none",color:"#fff",
            padding:"12px 40px",borderRadius:50,
            fontFamily:"'Jost',sans-serif",fontSize:10,letterSpacing:3,
            textTransform:"uppercase",cursor:"pointer",
            boxShadow:"0 6px 20px rgba(196,160,144,.4)",
          }}>↓ Save</button>
        )}
      </div>

      {previewUrl&&(
        <div onClick={()=>setPreviewUrl(null)} style={{
          position:"fixed",inset:0,zIndex:100,
          background:"rgba(90,82,80,0.7)",
          display:"flex",alignItems:"center",justifyContent:"center",
          backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",padding:16,
        }}>
          <div onClick={e=>e.stopPropagation()} style={{
            background:C.white,borderRadius:20,padding:20,
            display:"flex",flexDirection:"column",alignItems:"center",gap:12,
            boxShadow:"0 24px 60px rgba(0,0,0,0.2)",width:"100%",maxWidth:340,
          }}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:17,color:C.dark}}>Save Image ✦</div>
            <img src={previewUrl} alt="" style={{
              width:"100%",borderRadius:12,objectFit:"contain",
              boxShadow:"0 8px 24px rgba(0,0,0,0.1)",WebkitTouchCallout:"default",
            }}/>
            <div style={{background:C.faint,borderRadius:8,padding:"10px 14px",width:"100%",
              fontFamily:"'Jost',sans-serif",fontSize:10,color:C.text,letterSpacing:0.5,lineHeight:1.9,textAlign:"center"}}>
              📱 <b>Mobile</b>: press & hold image → save<br/>
              💻 <b>Desktop</b>: click the button below
            </div>
            <a href={previewUrl} download="punchcut.png" style={{
              width:"100%",textAlign:"center",
              background:C.accent,color:"#fff",textDecoration:"none",
              padding:"12px",borderRadius:8,
              fontFamily:"'Jost',sans-serif",fontSize:10,letterSpacing:2,textTransform:"uppercase",
              boxShadow:"0 4px 12px rgba(196,160,144,.3)",
            }}>↓ Download</a>
            <button onClick={()=>setPreviewUrl(null)} style={{
              background:"transparent",border:"none",color:C.muted,
              fontFamily:"'Jost',sans-serif",fontSize:10,letterSpacing:1,cursor:"pointer",padding:"4px",
            }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Slot ─────────────────────────────────────────────────
function Slot({slot,slotRef,cvsRef,img,ripples,onPunch,onLoad,isCropping,onApplyCrop,onCancelCrop}){
  const hasImg=!!img;
  const SLOT_W=300;
  const slotH=hasImg ? Math.round(SLOT_W*img.naturalHeight/img.naturalWidth) : 240;

  return(
    <div ref={slotRef} style={{
      position:"relative",width:"100%",height:slotH,
      overflow:"hidden",
      background:hasImg?"transparent":C.faint,
      cursor:isCropping?"default":(hasImg?"crosshair":"pointer"),
    }}
      onClick={e=>{if(hasImg&&!isCropping) onPunch(e,slot);}}
      onTouchEnd={e=>{if(hasImg&&!isCropping) onPunch(e,slot);}}
      onDragOver={e=>{e.preventDefault();}}
      onDrop={e=>{e.preventDefault();onLoad(e.dataTransfer.files[0],slot);}}
    >
      {hasImg&&<img src={img.src} alt="" style={{
        position:"absolute",inset:0,width:"100%",height:"100%",
        objectFit:"fill",pointerEvents:"none",
      }}/>}

      <canvas ref={cvsRef} style={{
        position:"absolute",inset:0,width:"100%",height:"100%",
        pointerEvents:"none",zIndex:2,
      }}/>

      {ripples.filter(r=>r.slot===slot).map(r=>(
        <div key={r.id} style={{
          position:"absolute",width:r.size,height:r.size,
          left:r.x-r.size/2,top:r.y-r.size/2,
          borderRadius:"50%",border:`1.5px solid ${C.accent}`,
          pointerEvents:"none",zIndex:10,
          animation:"rpl 0.6s ease-out forwards",
        }}/>
      ))}

      <div style={{
        position:"absolute",top:10,left:12,zIndex:4,
        fontFamily:"serif",fontStyle:"italic",
        fontSize:10,letterSpacing:3,pointerEvents:"none",
        color:hasImg?"rgba(255,255,255,0.5)":C.muted,
      }}>{slot==="top"?"Top":"Bottom"}</div>

      {!hasImg&&<UploadZone slot={slot} onFile={f=>onLoad(f,slot)}/>}

      {/* iOS-style crop overlay */}
      {isCropping&&hasImg&&(
        <CropOverlay
          img={img}
          slotW={SLOT_W}
          slotH={slotH}
          onApply={onApplyCrop}
          onCancel={onCancelCrop}
        />
      )}
    </div>
  );
}

// ── CropOverlay: iOS-style edge handles ──────────────────
function CropOverlay({img,slotW,slotH,onApply,onCancel}){
  // crop rect in px, relative to slot
  const [rect,setRect]=useState({x:0,y:0,w:slotW,h:slotH});
  const dragRef=useRef(null); // {edge, startX,startY, startRect}

  const HANDLE=18; // handle hit area
  const MIN=40;

  function getEdge(cx,cy,r){
    const atL=cx<r.x+HANDLE, atR=cx>r.x+r.w-HANDLE;
    const atT=cy<r.y+HANDLE, atB=cy>r.y+r.h-HANDLE;
    if(atT&&atL) return "tl";
    if(atT&&atR) return "tr";
    if(atB&&atL) return "bl";
    if(atB&&atR) return "br";
    if(atL) return "l";
    if(atR) return "r";
    if(atT) return "t";
    if(atB) return "b";
    return null;
  }

  function clientXY(e){
    const src=e.touches?e.touches[0]:e;
    return {cx:src.clientX,cy:src.clientY};
  }

  function onDown(e){
    e.stopPropagation(); e.preventDefault();
    const el=e.currentTarget;
    const elRect=el.getBoundingClientRect();
    const {cx,cy}=clientXY(e);
    const lx=cx-elRect.left, ly=cy-elRect.top;
    const edge=getEdge(lx,ly,rect);
    if(!edge) return;
    dragRef.current={edge,startX:cx,startY:cy,startRect:{...rect}};
  }

  function onMove(e){
    if(!dragRef.current) return;
    e.stopPropagation(); e.preventDefault();
    const {edge,startX,startY,startRect}=dragRef.current;
    const {cx,cy}=clientXY(e);
    const dx=cx-startX, dy=cy-startY;
    let {x,y,w,h}=startRect;
    if(edge==="l"||edge==="tl"||edge==="bl"){
      const nx=Math.max(0,Math.min(x+dx,x+w-MIN));
      w=w+(x-nx); x=nx;
    }
    if(edge==="r"||edge==="tr"||edge==="br"){
      w=Math.max(MIN,Math.min(w+dx,slotW-x));
    }
    if(edge==="t"||edge==="tl"||edge==="tr"){
      const ny=Math.max(0,Math.min(y+dy,y+h-MIN));
      h=h+(y-ny); y=ny;
    }
    if(edge==="b"||edge==="bl"||edge==="br"){
      h=Math.max(MIN,Math.min(h+dy,slotH-y));
    }
    setRect({x,y,w,h});
  }

  function onUp(e){ dragRef.current=null; }

  function doApply(){
    const scaleX=img.naturalWidth/slotW;
    const scaleY=img.naturalHeight/slotH;
    const out=document.createElement("canvas");
    out.width=Math.round(rect.w*scaleX);
    out.height=Math.round(rect.h*scaleY);
    out.getContext("2d").drawImage(img,
      rect.x*scaleX,rect.y*scaleY,rect.w*scaleX,rect.h*scaleY,
      0,0,out.width,out.height);
    onApply(out.toDataURL("image/png"));
  }

  const borderC="rgba(255,255,255,0.9)";
  const dimC="rgba(0,0,0,0.45)";

  // cursor per edge
  function edgeCursor(edge){
    return {tl:"nwse-resize",tr:"nesw-resize",bl:"nesw-resize",br:"nwse-resize",
      t:"ns-resize",b:"ns-resize",l:"ew-resize",r:"ew-resize"}[edge]||"default";
  }

  return(
    <div
      style={{position:"absolute",inset:0,zIndex:20,touchAction:"none"}}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
      onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
    >
      {/* dim outside crop */}
      <div style={{position:"absolute",left:0,top:0,width:"100%",height:rect.y,background:dimC,pointerEvents:"none"}}/>
      <div style={{position:"absolute",left:0,top:rect.y+rect.h,width:"100%",height:Math.max(0,slotH-rect.y-rect.h),background:dimC,pointerEvents:"none"}}/>
      <div style={{position:"absolute",left:0,top:rect.y,width:rect.x,height:rect.h,background:dimC,pointerEvents:"none"}}/>
      <div style={{position:"absolute",left:rect.x+rect.w,top:rect.y,right:0,height:rect.h,background:dimC,pointerEvents:"none"}}/>

      {/* crop border */}
      <div style={{
        position:"absolute",
        left:rect.x,top:rect.y,width:rect.w,height:rect.h,
        border:`1.5px solid ${borderC}`,pointerEvents:"none",
      }}>
        {[1/3,2/3].map(f=>(
          <div key={f} style={{position:"absolute",left:`${f*100}%`,top:0,width:1,height:"100%",background:"rgba(255,255,255,0.25)"}}/>
        ))}
        {[1/3,2/3].map(f=>(
          <div key={f+"h"} style={{position:"absolute",top:`${f*100}%`,left:0,height:1,width:"100%",background:"rgba(255,255,255,0.25)"}}/>
        ))}
      </div>

      {/* corner L-bracket handles */}
      {[
        {x:rect.x,        y:rect.y,        dx:1, dy:1 },
        {x:rect.x+rect.w, y:rect.y,        dx:-1,dy:1 },
        {x:rect.x,        y:rect.y+rect.h, dx:1, dy:-1},
        {x:rect.x+rect.w, y:rect.y+rect.h, dx:-1,dy:-1},
      ].map(({x,y,dx,dy},i)=>(
        <div key={i} style={{position:"absolute",left:x,top:y,width:0,height:0,pointerEvents:"none"}}>
          <svg width="22" height="22" style={{
            position:"absolute",
            left:dx>0?-2:-20, top:dy>0?-2:-20,
          }}>
            <path d={dx>0&&dy>0  ? "M2,14 L2,2 L14,2"
                   :dx<0&&dy>0  ? "M8,2 L20,2 L20,14"
                   :dx>0&&dy<0  ? "M2,8 L2,20 L14,20"
                                : "M8,20 L20,20 L20,8"}
              stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          </svg>
        </div>
      ))}

      {/* 버튼 — 항상 슬롯 내부 상단에 고정 */}
      <div style={{
        position:"absolute", top:8, right:8,
        display:"flex", gap:6, zIndex:30,
      }}>
        <button
          onMouseDown={e=>e.stopPropagation()}
          onTouchStart={e=>e.stopPropagation()}
          onClick={(e)=>{e.stopPropagation();onCancel();}}
          style={{
            padding:"6px 14px", borderRadius:20,
            background:"rgba(0,0,0,0.55)", border:"none",
            color:"#fff", fontFamily:"'Jost',sans-serif", fontSize:10,
            letterSpacing:1, cursor:"pointer",
            backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)",
          }}>Cancel</button>
        <button
          onMouseDown={e=>e.stopPropagation()}
          onTouchStart={e=>e.stopPropagation()}
          onClick={(e)=>{e.stopPropagation();doApply();}}
          style={{
            padding:"6px 14px", borderRadius:20,
            background:C.accent, border:"none",
            color:"#fff", fontFamily:"'Jost',sans-serif", fontSize:10,
            letterSpacing:1, cursor:"pointer",
            boxShadow:"0 2px 8px rgba(196,160,144,.5)",
          }}>Done</button>
      </div>
    </div>
  );
}

// ── UploadZone ───────────────────────────────────────────
function UploadZone({slot,onFile}){
  const inputRef=useRef(null);
  return(
    <div style={{position:"absolute",inset:0,zIndex:5,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10}}>
      <div onClick={()=>inputRef.current?.click()} style={{
        width:54,height:54,borderRadius:"50%",
        border:`1px dashed #c8b9b0`,background:"rgba(255,255,255,0.7)",
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:24,color:"#c4a090",cursor:"pointer",
      }}>＋</div>
      <span style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",
        fontSize:13,color:"#b5aca5",letterSpacing:1}}>Tap to add a photo</span>
      <input ref={inputRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e=>{if(e.target.files?.[0]) onFile(e.target.files[0]); e.target.value="";}}/>
    </div>
  );
}

function Sep(){return <div style={{height:1,background:"#e6ddd6"}}/>;}
function Lbl({children,style}){
  return <div style={{fontFamily:"'Jost',sans-serif",fontSize:9,letterSpacing:3,
    color:"#b5aca5",textTransform:"uppercase",marginBottom:2,...style}}>{children}</div>;
}
