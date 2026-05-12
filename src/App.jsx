import { useState, useRef, useEffect, useCallback } from "react";

const SHAPES = [
  { id:"circle",    label:"Circle"    },
  { id:"star",      label:"Star"      },
  { id:"heart",     label:"Heart"     },
  { id:"butterfly", label:"Butterfly" },
  { id:"flower",    label:"Flower"    },
  { id:"diamond",   label:"Diamond"   },
];

// Populate with { id, label, src } when wallpaper resources are ready
const WALLPAPERS = [];

const C = {
  bg:"#f8f5f1", panel:"#f3ede8", border:"#e6ddd6",
  accent:"#c4a090", text:"#78706a", muted:"#b5aca5",
  faint:"#ede7e1", white:"#fdfaf8", dark:"#5a5250",
};

// ── Mask images: preload + convert luminance→alpha ────────
// White pixels (shape) become opaque; black pixels become transparent
const MASKS = {};
const _maskCbs = [];
let _masksReady = false;
let _loaded = 0;
SHAPES.forEach(s => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    for(let i = 0; i < d.data.length; i += 4){
      d.data[i+3] = Math.round(d.data[i]*0.299 + d.data[i+1]*0.587 + d.data[i+2]*0.114);
    }
    ctx.putImageData(d, 0, 0);
    MASKS[s.id] = c;
    if(++_loaded === SHAPES.length){
      _masksReady = true;
      _maskCbs.forEach(cb => cb());
      _maskCbs.length = 0;
    }
  };
  img.src = `/masks/${s.id}.png`;
});

// ── Shape icon — uses PNG via CSS mask-image ──────────────
function ShapeIcon({shape, active}){
  const f = active ? C.accent : C.muted;
  return (
    <div style={{
      width:22, height:22,
      background: f,
      WebkitMaskImage: `url(/masks/${shape}.png)`,
      maskImage: `url(/masks/${shape}.png)`,
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
    }}/>
  );
}

// ── Main ──────────────────────────────────────────────────
export default function PunchCut(){
  const [imgs,setImgs]         = useState({top:null,bot:null});
  const [holes,setHoles]       = useState([]);
  const [shape,setShape]       = useState("circle");
  const [size,setSize]         = useState(25);
  const [open,setOpen]         = useState(true);
  const [ripples,setRipples]   = useState([]);
  const [cropMode,setCropMode] = useState(null);
  const [previewUrl,setPreviewUrl] = useState(null);
  const [isMobile,setIsMobile] = useState(()=>window.innerWidth<640);
  const [mobileOpen,setMobileOpen] = useState(false);

  const topSlot=useRef(null), botSlot=useRef(null);
  const topCvs=useRef(null),  botCvs=useRef(null);
  const drawRef=useRef(null);

  // Mobile detection
  useEffect(()=>{
    const h=()=>setIsMobile(window.innerWidth<640);
    window.addEventListener("resize",h);
    return ()=>window.removeEventListener("resize",h);
  },[]);

  // Auto-collapse mobile panel when entering crop mode
  useEffect(()=>{
    if(cropMode) setMobileOpen(false);
  },[cropMode]);

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
      const mask=MASKS[h.shape];
      if(!mask){
        // Not processed yet — retry when masks finish loading
        if(!_masksReady) _maskCbs.push(()=>{ drawRef.current?.("top"); drawRef.current?.("bot"); });
        return;
      }
      const s=h.size;
      const hx=h.x-s/2, hy=h.y-s/2;

      // Render hole content into an offscreen canvas, then apply the mask
      const off=document.createElement('canvas');
      off.width=s; off.height=s;
      const offCtx=off.getContext('2d');

      if(opp){
        offCtx.drawImage(opp,
          hx/W*opp.naturalWidth,  hy/H*opp.naturalHeight,
          s/W*opp.naturalWidth,   s/H*opp.naturalHeight,
          0, 0, s, s
        );
      } else if(my){
        // Draw same image flipped vertically (peek-through effect)
        offCtx.save();
        offCtx.translate(0,s); offCtx.scale(1,-1);
        offCtx.drawImage(my,
          hx/W*my.naturalWidth,  (H-hy-s)/H*my.naturalHeight,
          s/W*my.naturalWidth,   s/H*my.naturalHeight,
          0, 0, s, s
        );
        offCtx.restore();
      }

      offCtx.globalCompositeOperation='destination-in';
      offCtx.drawImage(mask, 0, 0, s, s);

      ctx.drawImage(off, hx, hy);
    });
  },[imgs,holes]);

  useEffect(()=>{ drawRef.current=draw; },[draw]);
  useEffect(()=>{draw("top");draw("bot");},[draw]);

  function loadImg(file,slot){
    if(!file||!file.type.startsWith("image/")) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const img=new Image();
      img.onload=()=>{
        setImgs(p=>({...p,[slot]:img}));
        setCropMode(slot);
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function loadImgFromUrl(url,slot){
    const img=new Image();
    img.crossOrigin="anonymous";
    img.onload=()=>{
      setImgs(p=>({...p,[slot]:img}));
      setCropMode(slot);
    };
    img.onerror=()=>{
      // Retry without CORS (for same-origin assets)
      const img2=new Image();
      img2.onload=()=>{
        setImgs(p=>({...p,[slot]:img2}));
        setCropMode(slot);
      };
      img2.src=url;
    };
    img.src=url;
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

  function sprinkle(){
    if(!imgs.top&&!imgs.bot) return;
    const COUNT=15;
    // Generate shared normalized positions so holes align across both slots
    const positions=Array.from({length:COUNT},()=>({nx:Math.random(),ny:Math.random()}));
    const id0=Date.now();
    const newHoles=[];
    ["top","bot"].forEach((slot,si)=>{
      if(!imgs[slot]) return;
      const el=slot==="top"?topSlot.current:botSlot.current;
      if(!el) return;
      const W=el.clientWidth, H=el.clientHeight;
      positions.forEach(({nx,ny},i)=>{
        const margin=size/2;
        const x=margin+(W-size)*nx;
        const y=margin+(H-size)*ny;
        newHoles.push({id:id0+si*1000+i,slot,x,y,shape,size});
      });
    });
    setHoles(p=>[...p,...newHoles]);
  }

  function exportImg(){
    const tC=topCvs.current,bC=botCvs.current;
    const tE=topSlot.current,bE=botSlot.current;
    if(!tE||!bE) return;
    const W=tE.clientWidth,tH=tE.clientHeight,bH=bE.clientHeight;
    const SC=4;
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

  const hasAnyImg = !!(imgs.top||imgs.bot);

  // ── Shared control panels ─────────────────────────────────
  const ShapeGrid = ()=>(
    <div>
      <Lbl>Punch Shape</Lbl>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,marginTop:8}}>
        {SHAPES.map(s=>{
          const active=shape===s.id;
          return(
            <button key={s.id} onClick={()=>setShape(s.id)} style={{
              ...sbtn(active),aspectRatio:"1",
              display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",gap:4,padding:"6px 2px",
            }}>
              <ShapeIcon shape={s.id} active={active}/>
              <span style={{fontSize:7,fontFamily:"'Jost',sans-serif",letterSpacing:0.8,color:active?C.accent:C.muted}}>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const SizeSlider = ()=>(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
        <Lbl style={{marginBottom:0}}>Size</Lbl>
        <span style={{fontFamily:"'Jost',sans-serif",fontSize:11,color:C.accent}}>{size}px</span>
      </div>
      <input type="range" min="1" max="50" value={size} onChange={e=>setSize(+e.target.value)}/>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
        <span style={{fontFamily:"'Jost',sans-serif",fontSize:9,color:C.muted}}>small</span>
        <span style={{fontFamily:"'Jost',sans-serif",fontSize:9,color:C.muted}}>large</span>
      </div>
    </div>
  );

  const ActionButtons = ()=>(
    <div style={{display:"flex",flexDirection:"column",gap:7}}>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>setHoles(p=>p.slice(0,-1))} style={{
          flex:1,padding:"9px 0",
          background:C.white,border:`1px solid ${C.border}`,
          borderRadius:8,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:5,
          fontFamily:"'Jost',sans-serif",fontSize:9,color:C.muted,letterSpacing:1,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
      <button onClick={sprinkle} style={{
        width:"100%",padding:"9px 0",
        background:hasAnyImg?"rgba(196,160,144,0.1)":"transparent",
        border:`1.5px solid ${hasAnyImg?C.accent:C.border}`,
        borderRadius:8,cursor:hasAnyImg?"pointer":"default",
        fontFamily:"'Jost',sans-serif",fontSize:9,
        color:hasAnyImg?C.accent:C.muted,letterSpacing:1.5,
        display:"flex",alignItems:"center",justifyContent:"center",gap:6,
        opacity:hasAnyImg?1:0.5,transition:"all 0.15s",
      }}>
        <span style={{fontSize:11}}>✦</span> Sprinkle
      </button>
    </div>
  );

  return(
    <div style={{
      display:"flex",
      flexDirection:isMobile?"column":"row",
      height:"100dvh",background:C.bg,overflow:"hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400&display=swap');
        @keyframes rpl{from{opacity:.7;transform:scale(.2)}to{opacity:0;transform:scale(2.2)}}
        input[type=range]{-webkit-appearance:none;width:100%;height:1px;background:${C.border};border-radius:1px;outline:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:${C.accent};cursor:pointer;border:2px solid ${C.white};box-shadow:0 1px 4px rgba(0,0,0,.12)}
        *{box-sizing:border-box}
      `}</style>

      {/* ── DESKTOP SIDEBAR ── */}
      {!isMobile&&(
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
            <ShapeGrid/>
            <Sep/>
            <SizeSlider/>
            <Sep/>
            <ActionButtons/>
          </div>

          {!open&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:50,gap:10}}>
              {[C.accent,C.border,C.border].map((c,i)=>(
                <div key={i} style={{width:6,height:6,borderRadius:"50%",background:c}}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MAIN CANVAS ── */}
      <div style={{
        flex:1,display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:isMobile?"flex-start":"center",
        padding:isMobile?"16px 12px 10px":24,
        overflow:"auto",background:C.bg,
        backgroundImage:"radial-gradient(circle at 65% 25%,#f4ece6 0%,transparent 50%),radial-gradient(circle at 20% 80%,#edf0f5 0%,transparent 50%)",
      }}>
        <div style={{
          width:300,overflow:"visible",
          boxShadow:"0 20px 60px rgba(180,155,145,.2),0 4px 16px rgba(180,155,145,.1)",
          border:`1px solid ${C.border}`,position:"relative",
        }}>
          <Slot slot="top" slotRef={topSlot} cvsRef={topCvs} img={imgs.top}
            ripples={ripples} onPunch={punch} onLoad={loadImg} onLoadUrl={loadImgFromUrl}
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
            ripples={ripples} onPunch={punch} onLoad={loadImg} onLoadUrl={loadImgFromUrl}
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

        {!isMobile&&hasAnyImg&&!cropMode&&(
          <button onClick={exportImg} style={{
            marginTop:16,background:C.accent,border:"none",color:"#fff",
            padding:"12px 40px",borderRadius:50,
            fontFamily:"'Jost',sans-serif",fontSize:10,letterSpacing:3,
            textTransform:"uppercase",cursor:"pointer",
            boxShadow:"0 6px 20px rgba(196,160,144,.4)",
          }}>↓ Save</button>
        )}
      </div>

      {/* ── MOBILE BOTTOM PANEL ── */}
      {isMobile&&(
        <div style={{
          background:C.panel,
          borderTop:`1px solid ${C.border}`,
          height:mobileOpen?330:54,
          minHeight:mobileOpen?330:54,
          transition:"height 0.3s cubic-bezier(.4,0,.2,1),min-height 0.3s cubic-bezier(.4,0,.2,1)",
          overflow:"hidden",
          flexShrink:0,
          position:"relative",
        }}>
          {/* Handle / header row */}
          <div
            onClick={()=>setMobileOpen(o=>!o)}
            style={{
              height:54,display:"flex",
              alignItems:"center",justifyContent:"space-between",
              padding:"0 16px",cursor:"pointer",userSelect:"none",
            }}
          >
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:16,color:C.dark,letterSpacing:2}}>
              Punch Cut
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {/* Active shape preview */}
              <div style={{
                width:28,height:28,borderRadius:6,
                background:C.faint,border:`1px solid ${C.border}`,
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>
                <ShapeIcon shape={shape} active={true}/>
              </div>
              <div style={{
                width:18,height:18,display:"flex",flexDirection:"column",
                alignItems:"center",justifyContent:"center",gap:3,
              }}>
                <div style={{width:18,height:2,background:C.muted,borderRadius:1,transition:"transform 0.3s",transform:mobileOpen?"rotate(-45deg) translate(-1px,2px)":"none"}}/>
                <div style={{width:18,height:2,background:C.muted,borderRadius:1,transition:"opacity 0.3s",opacity:mobileOpen?0:1}}/>
                <div style={{width:18,height:2,background:C.muted,borderRadius:1,transition:"transform 0.3s",transform:mobileOpen?"rotate(45deg) translate(-1px,-2px)":"none"}}/>
              </div>
            </div>
          </div>

          {/* Scrollable panel content */}
          <div style={{
            padding:"0 14px 16px",
            overflowY:"auto",
            height:276,
            display:"flex",flexDirection:"column",gap:12,
          }}>
            <ShapeGrid/>
            <Sep/>
            <SizeSlider/>
            <Sep/>
            <ActionButtons/>
            {hasAnyImg&&!cropMode&&(
              <>
                <Sep/>
                <button onClick={exportImg} style={{
                  background:C.accent,border:"none",color:"#fff",
                  padding:"12px 0",borderRadius:50,
                  fontFamily:"'Jost',sans-serif",fontSize:10,letterSpacing:3,
                  textTransform:"uppercase",cursor:"pointer",
                  boxShadow:"0 6px 20px rgba(196,160,144,.4)",
                }}>↓ Save</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── PREVIEW MODAL ── */}
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
function Slot({slot,slotRef,cvsRef,img,ripples,onPunch,onLoad,onLoadUrl,isCropping,onApplyCrop,onCancelCrop}){
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

      {!hasImg&&<UploadZone slot={slot} onFile={f=>onLoad(f,slot)} onUrl={url=>onLoadUrl(url,slot)}/>}

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

// ── CropOverlay ───────────────────────────────────────────
// Global window listeners allow dragging outside the slot boundary
function CropOverlay({img,slotW,slotH,onApply,onCancel}){
  const [rect,setRect]=useState({x:0,y:0,w:slotW,h:slotH});
  const dragRef=useRef(null);

  const HANDLE=18;
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

  // Attach move/up on window so dragging works outside slot bounds
  useEffect(()=>{
    function globalMove(e){
      if(!dragRef.current) return;
      if(e.cancelable) e.preventDefault();
      const {edge,startX,startY,startRect}=dragRef.current;
      const src=e.touches?e.touches[0]:e;
      const cx=src.clientX, cy=src.clientY;
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
    function globalUp(){
      dragRef.current=null;
    }
    window.addEventListener("mousemove",globalMove);
    window.addEventListener("mouseup",globalUp);
    window.addEventListener("touchmove",globalMove,{passive:false});
    window.addEventListener("touchend",globalUp);
    return ()=>{
      window.removeEventListener("mousemove",globalMove);
      window.removeEventListener("mouseup",globalUp);
      window.removeEventListener("touchmove",globalMove);
      window.removeEventListener("touchend",globalUp);
    };
  },[slotW,slotH]);

  function onDown(e){
    e.stopPropagation(); e.preventDefault();
    const el=e.currentTarget;
    const elRect=el.getBoundingClientRect();
    const src=e.touches?e.touches[0]:e;
    const cx=src.clientX, cy=src.clientY;
    const lx=cx-elRect.left, ly=cy-elRect.top;
    const edge=getEdge(lx,ly,rect);
    if(!edge) return;
    dragRef.current={edge,startX:cx,startY:cy,startRect:{...rect}};
  }

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

  return(
    <div
      style={{position:"absolute",inset:0,zIndex:20,touchAction:"none"}}
      onMouseDown={onDown}
      onTouchStart={onDown}
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

      {/* Cancel / Done buttons */}
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
function UploadZone({slot,onFile,onUrl}){
  const inputRef=useRef(null);
  const [tab,setTab]=useState("upload");

  return(
    <div style={{position:"absolute",inset:0,zIndex:5,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10}}>

      {/* Tab switcher — always visible so users know wallpapers exist */}
      <div style={{display:"flex",gap:0,background:C.faint,borderRadius:20,padding:2}}>
        {["upload","wallpapers"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:"4px 12px",borderRadius:18,border:"none",cursor:"pointer",
            fontFamily:"'Jost',sans-serif",fontSize:8,letterSpacing:1.5,
            textTransform:"uppercase",transition:"all 0.15s",
            background:tab===t?C.white:"transparent",
            color:tab===t?C.accent:C.muted,
            boxShadow:tab===t?"0 1px 4px rgba(0,0,0,0.08)":"none",
          }}>{t}</button>
        ))}
      </div>

      {tab==="upload"&&(
        <>
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
        </>
      )}

      {tab==="wallpapers"&&(
        <div style={{width:"100%",padding:"0 16px",textAlign:"center"}}>
          {WALLPAPERS.length===0?(
            <div style={{
              fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",
              fontSize:12,color:C.muted,letterSpacing:0.5,lineHeight:1.6,
            }}>
              Wallpapers coming soon ✦
            </div>
          ):(
            <div style={{
              display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,
              overflowY:"auto",maxHeight:160,
            }}>
              {WALLPAPERS.map(w=>(
                <div key={w.id} onClick={()=>onUrl(w.src)} style={{
                  aspectRatio:"1",borderRadius:6,overflow:"hidden",cursor:"pointer",
                  border:`1.5px solid ${C.border}`,transition:"border-color 0.15s",
                }}>
                  <img src={w.src} alt={w.label} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Sep(){return <div style={{height:1,background:"#e6ddd6"}}/>;}
function Lbl({children,style}){
  return <div style={{fontFamily:"'Jost',sans-serif",fontSize:9,letterSpacing:3,
    color:"#b5aca5",textTransform:"uppercase",marginBottom:2,...style}}>{children}</div>;
}
