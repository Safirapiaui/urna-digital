import { useState, useRef, useEffect, useCallback } from "react";

/* ─── SheetJS via CDN (carregado dinamicamente) ─────────────────── */
function useXLSX() {
  const [xlsx, setXlsx] = useState(null);
  useEffect(() => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => setXlsx(window.XLSX);
    document.head.appendChild(s);
  }, []);
  return xlsx;
}

/* ─── DADOS INICIAIS ─────────────────────────────────────────────── */
const ADMIN = { cpf: "00000000000", senha: "admin123", nome: "Administradora", role: "admin" };

const INIT_CONDS = [
  { id: 1, nome: "Residencial das Flores", ativo: false },
  { id: 2, nome: "Edifício Central Park", ativo: true },
];

const INIT_ENQUETE = {
  tema: "Aprovação do fundo de reserva 2025",
  descricao: "Votação para aprovação do aumento do fundo de reserva em R$ 50,00 por unidade.",
  condominioId: 2,
  duracaoMin: 10,
};

const INIT_LISTA = [
  { unidade: "101", nome: "Carlos Silva",  cpf: "11111111111", senha: "1234", inadimplente: false },
  { unidade: "102", nome: "Maria Souza",   cpf: "22222222222", senha: "1234", inadimplente: true  },
  { unidade: "201", nome: "João Pereira",  cpf: "33333333333", senha: "1234", inadimplente: false },
  { unidade: "202", nome: "Ana Costa",     cpf: "44444444444", senha: "1234", inadimplente: false },
  { unidade: "301", nome: "Pedro Lima",    cpf: "55555555555", senha: "1234", inadimplente: false },
];

const INIT_VOT = { status: "aguardando", inicioTs: null, fimTs: null, duracaoSeg: 600 };

/* ─── HELPERS ────────────────────────────────────────────────────── */
const onlyCPF = v => v.replace(/\D/g, "").slice(0, 11);
const fmtCPF  = v => { const d = v.replace(/\D/g,"").slice(0,11); return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,"$1.$2.$3-$4").replace(/(\d{3})(\d{3})(\d{0,3})/,"$1.$2.$3").replace(/(\d{3})(\d{0,3})/,"$1.$2"); };
const fmtTime = s => { if(s<=0)return"00:00"; const m=Math.floor(s/60),sec=s%60; return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`; };
const pct     = (n,t) => t>0 ? ((n/t)*100).toFixed(1) : "0.0";

const style = {
  card:  { background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"1.25rem" },
  input: { width:"100%", padding:"8px 12px", border:"0.5px solid var(--color-border-secondary)", borderRadius:"var(--border-radius-md)", background:"var(--color-background-primary)", color:"var(--color-text-primary)", fontSize:14 },
  btn:   (bg,color="#fff") => ({ background:bg, color, border:"none", borderRadius:"var(--border-radius-md)", padding:"10px 16px", fontWeight:500, cursor:"pointer", fontSize:14, width:"100%" }),
  btnO:  { background:"transparent", border:"0.5px solid var(--color-border-secondary)", borderRadius:"var(--border-radius-md)", padding:"10px 16px", fontWeight:500, cursor:"pointer", fontSize:14, color:"var(--color-text-primary)", width:"100%" },
  label: { fontSize:13, color:"var(--color-text-secondary)", display:"block", marginBottom:4 },
  badge: (ok) => ({ display:"inline-block", padding:"2px 10px", borderRadius:99, fontSize:12, fontWeight:500, background: ok?"var(--color-background-success)":"var(--color-background-danger)", color: ok?"var(--color-text-success)":"var(--color-text-danger)" }),
};

/* ─── CRONÔMETRO ─────────────────────────────────────────────────── */
function Cronometro({ votacao, big }) {
  const [rest, setRest] = useState(0);
  useEffect(() => {
    if(votacao.status !== "aberta") { setRest(0); return; }
    const tick = () => { const e=Math.floor((Date.now()-votacao.inicioTs)/1000); setRest(Math.max(0, votacao.duracaoSeg-e)); };
    tick(); const t=setInterval(tick,500); return ()=>clearInterval(t);
  }, [votacao.status, votacao.inicioTs, votacao.duracaoSeg]);

  if(votacao.status==="aguardando") return <span style={{color:"var(--color-text-warning)",fontWeight:500,fontSize:big?28:14}}>⏳ {big?"Aguardando início":""}</span>;
  if(votacao.status==="encerrada")  return <span style={{color:"var(--color-text-danger)", fontWeight:500,fontSize:big?28:14}}>🔒 {big?"Votação encerrada":""}</span>;

  const color = rest>60?"var(--color-text-success)":rest>30?"var(--color-text-warning)":"var(--color-text-danger)";
  const bgBar = rest>60?"var(--color-background-success)":rest>30?"var(--color-background-warning)":"var(--color-background-danger)";
  const p = votacao.duracaoSeg>0 ? (rest/votacao.duracaoSeg)*100 : 0;

  if(!big) return <span style={{color,fontWeight:700,fontSize:16,fontVariantNumeric:"tabular-nums"}}>⏱ {fmtTime(rest)}</span>;
  return (
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:52,fontWeight:700,color,fontVariantNumeric:"tabular-nums",lineHeight:1}}>{fmtTime(rest)}</div>
      <div style={{background:"var(--color-background-secondary)",borderRadius:99,height:8,margin:"10px 0 4px",overflow:"hidden"}}>
        <div style={{width:`${p}%`,height:"100%",background:bgBar,transition:"width .5s",borderRadius:99}} />
      </div>
      <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>tempo restante</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   APP ROOT
═══════════════════════════════════════════════════════════════════ */
export default function App() {
  const xlsx       = useXLSX();
  const [user,     setUser]     = useState(null);
  const [conds,    setConds]    = useState(INIT_CONDS);
  const [enquete,  setEnquete]  = useState(INIT_ENQUETE);
  const [lista,    setLista]    = useState(INIT_LISTA);
  const [votos,    setVotos]    = useState([]);
  const [votacao,  setVotacao]  = useState(INIT_VOT);
  const [page,     setPage]     = useState("login");

  const cond = conds.find(c=>c.ativo);

  /* encerramento automático */
  useEffect(() => {
    if(votacao.status!=="aberta") return;
    const t = setInterval(()=>{ const e=Math.floor((Date.now()-votacao.inicioTs)/1000); if(e>=votacao.duracaoSeg) setVotacao(v=>({...v,status:"encerrada",fimTs:Date.now()})); },500);
    return ()=>clearInterval(t);
  },[votacao.status]);

  const login = (cpf,senha) => {
    if(cpf===ADMIN.cpf && senha===ADMIN.senha){ setUser(ADMIN); setPage("admin"); return null; }
    if(votacao.status==="aguardando") return "A votação ainda não foi iniciada.";
    if(votacao.status==="encerrada")  return "A votação foi encerrada.";
    const m = lista.find(x=>x.cpf===cpf && x.senha===senha);
    if(!m) return "CPF ou senha inválidos.";
    if(m.inadimplente) return "Unidade inadimplente — votação bloqueada.";
    if(votos.find(v=>v.unidade===m.unidade && !v.procurador)) return "Sua unidade já votou.";
    setUser({...m,role:"morador"}); setPage("facial"); return null;
  };

  const registrarVoto = d => { setVotos(v=>[...v,{...d,ts:new Date().toLocaleTimeString("pt-BR")}]); setUser(null); setPage("login"); };

  const props = { conds,setConds,enquete,setEnquete,lista,setLista,votos,setVotos,votacao,setVotacao,cond,xlsx };

  if(page==="login")    return <LoginPage    {...props} user={user} onLogin={login} onResultado={()=>setPage("resultado")} />;
  if(page==="admin")    return <AdminPage    {...props} onLogout={()=>{setUser(null);setPage("login");}} onResultado={()=>setPage("resultado")} />;
  if(page==="facial")   return <FacialPage   user={user} onOk={()=>setPage("votar")} onCancel={()=>{setUser(null);setPage("login");}} />;
  if(page==="votar")    return <VotarPage    user={user} enquete={enquete} cond={cond} lista={lista} votos={votos} votacao={votacao} onVotar={registrarVoto} onCancel={()=>{setUser(null);setPage("login");}} />;
  if(page==="resultado") return <ResultadoPage votos={votos} enquete={enquete} cond={cond} lista={lista} votacao={votacao} onBack={()=>setPage(user?.role==="admin"?"admin":"login")} />;
}

/* ═══════════════════════════════════════════════════════════════════
   LOGIN
═══════════════════════════════════════════════════════════════════ */
function LoginPage({onLogin,cond,votacao,onResultado}) {
  const [cpf,setCpf]=useState(""); const [senha,setSenha]=useState(""); const [erro,setErro]=useState("");
  const submit = () => { const e=onLogin(onlyCPF(cpf),senha); if(e) setErro(e); };
  const stLabel = votacao.status==="aberta"?"Aberta":votacao.status==="encerrada"?"Encerrada":"Aguardando";
  const stColor = votacao.status==="aberta"?"var(--color-text-success)":votacao.status==="encerrada"?"var(--color-text-danger)":"var(--color-text-warning)";

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"var(--color-background-tertiary)"}}>
      <div style={{...style.card,width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:40,marginBottom:4}}>🗳️</div>
          <h2 style={{margin:0,fontWeight:500,fontSize:22}}>Urna Digital</h2>
          {cond && <p style={{margin:"4px 0 0",fontSize:13,color:"var(--color-text-secondary)"}}>{cond.nome}</p>}
          <p style={{margin:"6px 0 0",fontSize:13,fontWeight:500,color:stColor}}>● Votação: {stLabel}</p>
        </div>

        {votacao.status==="aberta" && (
          <div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:12,marginBottom:16}}>
            <Cronometro votacao={votacao} big />
          </div>
        )}
        {votacao.status==="encerrada" && (
          <div style={{background:"var(--color-background-danger)",borderRadius:"var(--border-radius-md)",padding:12,marginBottom:16,textAlign:"center"}}>
            <p style={{margin:0,color:"var(--color-text-danger)",fontWeight:500,fontSize:14}}>🔒 Votação encerrada</p>
            <button onClick={onResultado} style={{...style.btn("transparent","var(--color-text-info)"),width:"auto",padding:"4px 0",marginTop:4,fontSize:13}}>Ver resultado final →</button>
          </div>
        )}

        {erro && <div style={{background:"var(--color-background-danger)",border:"0.5px solid var(--color-border-danger)",borderRadius:"var(--border-radius-md)",padding:"10px 12px",marginBottom:14,fontSize:13,color:"var(--color-text-danger)"}}>{erro}</div>}

        <div style={{marginBottom:12}}>
          <label style={style.label}>CPF</label>
          <input style={style.input} placeholder="000.000.000-00" value={fmtCPF(cpf)} onChange={e=>setCpf(onlyCPF(e.target.value))} />
        </div>
        <div style={{marginBottom:16}}>
          <label style={style.label}>Senha</label>
          <input type="password" style={style.input} placeholder="Digite sua senha" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} />
        </div>
        <button onClick={submit} style={style.btn("#185FA5")}>Entrar</button>
        <button onClick={onResultado} style={{...style.btnO,marginTop:8,fontSize:13}}>Ver resultado público</button>
        <p style={{textAlign:"center",fontSize:11,color:"var(--color-text-tertiary)",marginTop:12}}>Admin: CPF 000.000.000-00 | Senha: admin123</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FACIAL
═══════════════════════════════════════════════════════════════════ */
function FacialPage({user,onOk,onCancel}) {
  const videoRef=useRef(); const canvasRef=useRef();
  const [foto,setFoto]=useState(null); const [semCam,setSemCam]=useState(false);
  const streamRef=useRef(null);

  useEffect(()=>{
    navigator.mediaDevices?.getUserMedia({video:true}).then(s=>{
      streamRef.current=s;
      if(videoRef.current){ videoRef.current.srcObject=s; videoRef.current.play(); }
    }).catch(()=>setSemCam(true));
    return ()=>{ streamRef.current?.getTracks().forEach(t=>t.stop()); };
  },[]);

  const capturar = () => {
    const v=videoRef.current, c=canvasRef.current; if(!v||!c) return;
    c.width=v.videoWidth||320; c.height=v.videoHeight||240;
    c.getContext("2d").drawImage(v,0,0);
    setFoto(c.toDataURL("image/jpeg",.8));
    streamRef.current?.getTracks().forEach(t=>t.stop());
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"var(--color-background-tertiary)"}}>
      <div style={{...style.card,width:"100%",maxWidth:420}}>
        <h2 style={{margin:"0 0 4px",fontWeight:500,textAlign:"center",fontSize:20}}>Identificação Facial</h2>
        <p style={{textAlign:"center",color:"var(--color-text-secondary)",fontSize:13,marginBottom:16}}>Olá, <strong>{user.nome}</strong> — Unidade {user.unidade}</p>
        {semCam && <div style={{...style.badge(false),display:"block",textAlign:"center",marginBottom:12,padding:"8px"}}>Câmera não disponível. Continue sem foto.</div>}
        <div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",overflow:"hidden",marginBottom:16,aspectRatio:"4/3",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
          {!foto
            ? <video ref={videoRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover"}} />
            : <img src={foto} alt="captura" style={{width:"100%",height:"100%",objectFit:"cover"}} />}
          {!foto && !semCam && <div style={{position:"absolute",inset:20,border:"2px dashed #378ADD",borderRadius:12,pointerEvents:"none"}} />}
        </div>
        <canvas ref={canvasRef} style={{display:"none"}} />
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {!foto ? <>
            {!semCam && <button onClick={capturar} style={style.btn("#185FA5")}>📸 Capturar foto</button>}
            {semCam  && <button onClick={onOk}     style={style.btn("#185FA5")}>Continuar sem câmera</button>}
          </> : <>
            <button onClick={onOk}            style={style.btn("#0F6E56")}>✅ Confirmar e votar</button>
            <button onClick={()=>setFoto(null)} style={style.btnO}>🔄 Tirar novamente</button>
          </>}
          <button onClick={onCancel} style={{...style.btnO,color:"var(--color-text-danger)",borderColor:"var(--color-border-danger)"}}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VOTAR
═══════════════════════════════════════════════════════════════════ */
function VotarPage({user,enquete,cond,lista,votos,votacao,onVotar,onCancel}) {
  const [proc,setProc]=useState(false); const [unidRep,setUnidRep]=useState(""); const [confirmar,setConfirmar]=useState(null); const [erro,setErro]=useState("");

  useEffect(()=>{ if(votacao.status==="encerrada") onCancel(); },[votacao.status]);

  const disponiveis = lista.filter(m=>m.unidade!==user.unidade && !votos.find(v=>v.unidade===m.unidade) && !m.inadimplente);

  const votar = v => { if(proc&&!unidRep){setErro("Selecione a unidade representada.");return;} setErro(""); setConfirmar(v); };

  const vIco = { Aprovado:"✅", Reprovado:"❌", "Abstenção":"⚪" };
  const vClr = { Aprovado:"#0F6E56", Reprovado:"#A32D2D", "Abstenção":"#5F5E5A" };

  if(confirmar) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"var(--color-background-tertiary)"}}>
      <div style={{...style.card,width:"100%",maxWidth:360,textAlign:"center"}}>
        <div style={{fontSize:56,marginBottom:8}}>{vIco[confirmar]}</div>
        <h2 style={{margin:"0 0 6px",fontWeight:500}}>Confirmar voto?</h2>
        <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 12px"}}>{enquete.tema}</p>
        <p style={{fontSize:28,fontWeight:700,color:vClr[confirmar],margin:"0 0 16px"}}>{confirmar}</p>
        {proc && <p style={{fontSize:13,color:"var(--color-text-info)",marginBottom:16}}>Procurador da unidade {unidRep}</p>}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setConfirmar(null)} style={{...style.btnO,flex:1}}>Voltar</button>
          <button onClick={()=>onVotar({unidade:user.unidade,nome:user.nome,cpf:user.cpf,voto:confirmar,procurador:proc,unidadeRep:proc?unidRep:""})} style={{...style.btn("#185FA5"),flex:1}}>Confirmar</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"var(--color-background-tertiary)"}}>
      <div style={{...style.card,width:"100%",maxWidth:440}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div><h2 style={{margin:0,fontWeight:500,fontSize:18}}>Assembleia</h2><p style={{margin:0,fontSize:13,color:"var(--color-text-secondary)"}}>{cond?.nome}</p></div>
          <div style={{textAlign:"right"}}><p style={{margin:0,fontWeight:500,fontSize:14}}>{user.nome}</p><p style={{margin:0,fontSize:13,color:"var(--color-text-secondary)"}}>Unid. {user.unidade}</p></div>
        </div>
        <div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:12,textAlign:"center"}}>
          <Cronometro votacao={votacao} />
        </div>
        <div style={{background:"var(--color-background-info)",borderRadius:"var(--border-radius-md)",padding:"12px 14px",marginBottom:14}}>
          <p style={{margin:"0 0 2px",fontSize:11,fontWeight:500,color:"var(--color-text-info)",textTransform:"uppercase"}}>Pauta</p>
          <p style={{margin:0,fontWeight:500,color:"var(--color-text-primary)"}}>{enquete.tema}</p>
          {enquete.descricao && <p style={{margin:"4px 0 0",fontSize:13,color:"var(--color-text-secondary)"}}>{enquete.descricao}</p>}
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:14}}>
            <input type="checkbox" checked={proc} onChange={e=>setProc(e.target.checked)} /> Sou procurador de outra unidade
          </label>
          {proc && <select style={{...style.input,marginTop:8}} value={unidRep} onChange={e=>setUnidRep(e.target.value)}>
            <option value="">Selecione a unidade representada...</option>
            {disponiveis.map(m=><option key={m.unidade} value={m.unidade}>Unidade {m.unidade} — {m.nome}</option>)}
          </select>}
          {erro && <p style={{margin:"6px 0 0",fontSize:13,color:"var(--color-text-danger)"}}>{erro}</p>}
        </div>
        <p style={{textAlign:"center",fontSize:13,color:"var(--color-text-secondary)",marginBottom:10}}>Selecione seu voto:</p>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          {["Aprovado","Reprovado","Abstenção"].map(v=>(
            <button key={v} onClick={()=>votar(v)} style={{flex:1,padding:"14px 4px",border:"none",borderRadius:"var(--border-radius-md)",background:vClr[v],color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13}}>
              {vIco[v]}<br/>{v}
            </button>
          ))}
        </div>
        <button onClick={onCancel} style={{...style.btnO,fontSize:13}}>Cancelar</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ADMIN
═══════════════════════════════════════════════════════════════════ */
function AdminPage({conds,setConds,enquete,setEnquete,lista,setLista,votos,setVotos,votacao,setVotacao,cond,xlsx,onLogout,onResultado}) {
  const [tab,setTab]=useState("dashboard");
  const tabs=[["dashboard","📊 Dashboard"],["enquete","📋 Enquete"],["lista","👥 Lista"],["condominios","🏢 Condomínios"],["votos","🗳️ Votos"]];
  return (
    <div style={{minHeight:"100vh",background:"var(--color-background-tertiary)"}}>
      <header style={{background:"#0C447C",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:24}}>🗳️</span>
          <div><p style={{margin:0,fontWeight:700,fontSize:16,color:"#fff"}}>Urna Digital</p><p style={{margin:0,fontSize:11,color:"#B5D4F4"}}>Painel Administrativo</p></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Cronometro votacao={votacao} />
          <button onClick={onResultado} style={{...style.btn("#185FA5"),width:"auto",padding:"8px 14px",fontSize:13}}>Ver Resultado</button>
          <button onClick={onLogout}    style={{...style.btn("#A32D2D"),width:"auto",padding:"8px 14px",fontSize:13}}>Sair</button>
        </div>
      </header>
      <nav style={{background:"var(--color-background-primary)",borderBottom:"0.5px solid var(--color-border-tertiary)",display:"flex",overflowX:"auto"}}>
        {tabs.map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:"12px 16px",border:"none",borderBottom:tab===k?"2px solid #185FA5":"2px solid transparent",background:"transparent",cursor:"pointer",whiteSpace:"nowrap",fontSize:13,fontWeight:tab===k?500:400,color:tab===k?"#185FA5":"var(--color-text-secondary)"}}>
            {l}
          </button>
        ))}
      </nav>
      <div style={{padding:16,maxWidth:800,margin:"0 auto"}}>
        {tab==="dashboard"   && <TabDash    cond={cond} lista={lista} votos={votos} enquete={enquete} votacao={votacao} setVotacao={setVotacao} onResultado={onResultado} />}
        {tab==="enquete"     && <TabEnquete enquete={enquete} setEnquete={setEnquete} conds={conds} votacao={votacao} />}
        {tab==="lista"       && <TabLista   lista={lista} setLista={setLista} xlsx={xlsx} />}
        {tab==="condominios" && <TabConds   conds={conds} setConds={setConds} />}
        {tab==="votos"       && <TabVotos   votos={votos} setVotos={setVotos} />}
      </div>
    </div>
  );
}

/* ── DASHBOARD ── */
function TabDash({cond,lista,votos,enquete,votacao,setVotacao,onResultado}) {
  const aptos   = lista.filter(m=>!m.inadimplente).length;
  const votaram = new Set(votos.map(v=>v.unidade)).size;
  const ap=votos.filter(v=>v.voto==="Aprovado").length, rp=votos.filter(v=>v.voto==="Reprovado").length, ab=votos.filter(v=>v.voto==="Abstenção").length;
  const quorum  = pct(votaram,aptos);

  const iniciar   = () => setVotacao({status:"aberta",  inicioTs:Date.now(),fimTs:null,duracaoSeg:enquete.duracaoMin*60});
  const encerrar  = () => setVotacao(v=>({...v,status:"encerrada",fimTs:Date.now()}));
  const reiniciar = () => setVotacao(INIT_VOT);

  const metrics=[["Aptos a votar",aptos],["Votaram",votaram],["Aprovados",ap],["Reprovados",rp],["Abstenções",ab],["Quórum",quorum+"%"]];
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={style.card}>
        <p style={{...style.label,marginBottom:2}}>Assembleia ativa</p>
        <p style={{margin:"0 0 4px",fontWeight:500,fontSize:16}}>{cond?.nome||"Nenhuma ativa"}</p>
        <p style={{margin:"0 0 4px",fontSize:13,color:"var(--color-text-secondary)"}}>{enquete.tema}</p>
        <p style={{margin:"0 0 14px",fontSize:12,color:"var(--color-text-tertiary)"}}>Duração configurada: {enquete.duracaoMin} min</p>
        <Cronometro votacao={votacao} big />
        <div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}>
          {votacao.status==="aguardando" && <button onClick={iniciar}   style={{...style.btn("#0F6E56"),flex:1}}>▶ Iniciar Votação</button>}
          {votacao.status==="aberta"     && <button onClick={encerrar}  style={{...style.btn("#A32D2D"),flex:1}}>🔒 Encerrar agora</button>}
          {votacao.status==="encerrada"  && <>
            <button onClick={onResultado} style={{...style.btn("#185FA5"),flex:1}}>📊 Ver resultado final</button>
            <button onClick={reiniciar}   style={{...style.btnO,flex:1}}>🔄 Nova votação</button>
          </>}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {metrics.map(([l,v])=>(
          <div key={l} style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"12px 10px",textAlign:"center"}}>
            <p style={{margin:"0 0 2px",fontSize:22,fontWeight:500}}>{v}</p>
            <p style={{margin:0,fontSize:11,color:"var(--color-text-secondary)"}}>{l}</p>
          </div>
        ))}
      </div>
      <div style={style.card}>
        <p style={{...style.label,marginBottom:6}}>Progresso da votação</p>
        <div style={{background:"var(--color-background-secondary)",borderRadius:99,height:10,overflow:"hidden"}}>
          <div style={{width:`${pct(votaram,aptos)}%`,height:"100%",background:"#185FA5",borderRadius:99,transition:"width .5s"}} />
        </div>
        <p style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:4}}>{votaram} de {aptos} unidades aptas</p>
      </div>
    </div>
  );
}

/* ── ENQUETE ── */
function TabEnquete({enquete,setEnquete,conds,votacao}) {
  const [f,setF]=useState(enquete);
  const lock = votacao.status!=="aguardando";
  const salvar = () => setEnquete(f);
  return (
    <div style={style.card}>
      <h3 style={{margin:"0 0 16px",fontWeight:500}}>Configurar enquete</h3>
      {lock && <div style={{...style.badge(false),display:"block",padding:"8px 12px",marginBottom:14}}>Votação iniciada — encerre e reinicie para editar.</div>}
      {[["Condomínio","condominioId","select"],["Tema / Pauta","tema","text"],["Descrição","descricao","textarea"],["Duração (minutos)","duracaoMin","number"]].map(([lbl,key,tipo])=>(
        <div key={key} style={{marginBottom:12}}>
          <label style={style.label}>{lbl}</label>
          {tipo==="select"
            ? <select disabled={lock} style={style.input} value={f[key]} onChange={e=>setF(p=>({...p,[key]:+e.target.value}))}>{conds.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>
            : tipo==="textarea"
            ? <textarea disabled={lock} rows={3} style={{...style.input,resize:"vertical"}} value={f[key]} onChange={e=>setF(p=>({...p,[key]:e.target.value}))} />
            : <input disabled={lock} type={tipo} min={1} max={180} style={style.input} value={f[key]} onChange={e=>setF(p=>({...p,[key]:tipo==="number"?+e.target.value:e.target.value}))} />}
        </div>
      ))}
      <button disabled={lock} onClick={salvar} style={style.btn(lock?"#B4B2A9":"#185FA5")}>Salvar enquete</button>
    </div>
  );
}

/* ── LISTA ── */
function TabLista({lista,setLista,xlsx}) {
  const [editI,setEditI]=useState(null); const [form,setForm]=useState({}); const fileRef=useRef();

  const importar = async e => {
    if(!xlsx){ alert("Aguarde o carregamento do leitor de Excel..."); return; }
    const file=e.target.files[0]; if(!file) return;
    const buf=await file.arrayBuffer();
    const wb=xlsx.read(buf);
    const rows=xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
    setLista(rows.map(r=>({
      unidade:String(r.unidade||r.Unidade||""),
      nome:String(r.nome||r.Nome||""),
      cpf:onlyCPF(String(r.cpf||r.CPF||"")),
      senha:String(r.senha||r.Senha||"1234"),
      inadimplente:String(r.inadimplente||r.Inadimplente||"").toLowerCase()==="sim"
    })));
    e.target.value="";
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={style.card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <h3 style={{margin:0,fontWeight:500}}>Lista de Chamada</h3>
          <button onClick={()=>fileRef.current.click()} style={{...style.btn("#185FA5"),width:"auto",padding:"8px 14px",fontSize:13}}>📂 Importar Excel</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={importar} />
        </div>
        <p style={{fontSize:12,color:"var(--color-text-tertiary)",marginBottom:12}}>Colunas esperadas: unidade · nome · cpf · senha · inadimplente (sim/não)</p>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"var(--color-background-secondary)"}}>
              {["Unidade","Nome","CPF","Status",""].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",fontWeight:500,fontSize:12,color:"var(--color-text-secondary)"}}>{h}</th>)}
            </tr></thead>
            <tbody>{lista.map((m,i)=>(
              <tr key={i} style={{borderTop:"0.5px solid var(--color-border-tertiary)"}}>
                <td style={{padding:"8px 10px",fontWeight:500}}>{m.unidade}</td>
                <td style={{padding:"8px 10px"}}>{m.nome}</td>
                <td style={{padding:"8px 10px",color:"var(--color-text-secondary)",fontSize:12}}>{fmtCPF(m.cpf)}</td>
                <td style={{padding:"8px 10px"}}>
                  <button onClick={()=>setLista(l=>l.map((x,j)=>j===i?{...x,inadimplente:!x.inadimplente}:x))} style={{...style.badge(!m.inadimplente),cursor:"pointer",border:"none"}}>{m.inadimplente?"Inadimplente":"Regular"}</button>
                </td>
                <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                  <button onClick={()=>{setEditI(i);setForm(m);}} style={{background:"none",border:"none",color:"var(--color-text-info)",cursor:"pointer",fontSize:13,marginRight:8}}>Editar</button>
                  <button onClick={()=>setLista(l=>l.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"var(--color-text-danger)",cursor:"pointer",fontSize:13}}>Remover</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {editI!==null && (
        <div style={style.card}>
          <h4 style={{margin:"0 0 12px",fontWeight:500}}>Editar morador</h4>
          {["unidade","nome","cpf","senha"].map(k=>(
            <div key={k} style={{marginBottom:10}}>
              <label style={style.label}>{k.charAt(0).toUpperCase()+k.slice(1)}</label>
              <input style={style.input} value={form[k]||""} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} />
            </div>
          ))}
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:14,marginBottom:12,cursor:"pointer"}}>
            <input type="checkbox" checked={form.inadimplente} onChange={e=>setForm(p=>({...p,inadimplente:e.target.checked}))} /> Inadimplente
          </label>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setLista(l=>l.map((m,j)=>j===editI?form:m));setEditI(null);}} style={{...style.btn("#185FA5"),flex:1}}>Salvar</button>
            <button onClick={()=>setEditI(null)} style={{...style.btnO,flex:1}}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── CONDOMÍNIOS ── */
function TabConds({conds,setConds}) {
  const [novo,setNovo]=useState("");
  return (
    <div style={style.card}>
      <h3 style={{margin:"0 0 14px",fontWeight:500}}>Condomínios</h3>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <input style={{...style.input,flex:1}} placeholder="Nome do condomínio..." value={novo} onChange={e=>setNovo(e.target.value)} />
        <button onClick={()=>{if(!novo.trim())return;setConds(l=>[...l,{id:Date.now(),nome:novo.trim(),ativo:false}]);setNovo("");}} style={{...style.btn("#185FA5"),width:"auto",padding:"8px 16px"}}>Adicionar</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {conds.map(c=>(
          <div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"10px 14px"}}>
            <div><p style={{margin:0,fontWeight:500}}>{c.nome}</p>{c.ativo&&<span style={{...style.badge(true),marginTop:2}}>Ativo hoje</span>}</div>
            <div style={{display:"flex",gap:6}}>
              {!c.ativo&&<button onClick={()=>setConds(l=>l.map(x=>({...x,ativo:x.id===c.id})))} style={{...style.btn("#0F6E56"),width:"auto",padding:"6px 12px",fontSize:13}}>Ativar</button>}
              <button onClick={()=>setConds(l=>l.filter(x=>x.id!==c.id))} style={{...style.btn("#A32D2D"),width:"auto",padding:"6px 12px",fontSize:13}}>Remover</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── VOTOS ── */
function TabVotos({votos,setVotos}) {
  return (
    <div style={style.card}>
      <h3 style={{margin:"0 0 12px",fontWeight:500}}>Votos registrados</h3>
      {votos.length===0 && <p style={{color:"var(--color-text-tertiary)",textAlign:"center",padding:24}}>Nenhum voto registrado ainda.</p>}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {votos.map((v,i)=>(
          <div key={i} style={{border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div>
              <p style={{margin:0,fontWeight:500,fontSize:14}}>{v.nome} — Unid. {v.unidade}</p>
              {v.procurador&&<p style={{margin:"2px 0 0",fontSize:12,color:"var(--color-text-info)"}}>Procurador de {v.unidadeRep}</p>}
              <p style={{margin:"2px 0 0",fontSize:12,color:"var(--color-text-tertiary)"}}>{v.ts}</p>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <select value={v.voto} onChange={e=>setVotos(vs=>vs.map((x,j)=>j===i?{...x,voto:e.target.value}:x))} style={{...style.input,width:"auto",fontSize:13}}>
                <option>Aprovado</option><option>Reprovado</option><option>Abstenção</option>
              </select>
              <button onClick={()=>setVotos(vs=>vs.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"var(--color-text-danger)",cursor:"pointer",fontSize:13}}>Remover</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   RESULTADO
═══════════════════════════════════════════════════════════════════ */
function ResultadoPage({votos,enquete,cond,lista,votacao,onBack}) {
  const ap=votos.filter(v=>v.voto==="Aprovado").length;
  const rp=votos.filter(v=>v.voto==="Reprovado").length;
  const ab=votos.filter(v=>v.voto==="Abstenção").length;
  const total=votos.length;
  const aptos=lista.filter(m=>!m.inadimplente).length;
  const votaram=new Set(votos.map(v=>v.unidade)).size;
  const ausentes=aptos-votaram;
  const quorum=pct(votaram,aptos);
  const vencedor=ap>rp?"APROVADO":rp>ap?"REPROVADO":"EMPATE";
  const vClrBg=vencedor==="APROVADO"?"var(--color-background-success)":vencedor==="REPROVADO"?"var(--color-background-danger)":"var(--color-background-secondary)";
  const vClrTx=vencedor==="APROVADO"?"var(--color-text-success)":vencedor==="REPROVADO"?"var(--color-text-danger)":"var(--color-text-primary)";
  const vIco=vencedor==="APROVADO"?"✅":vencedor==="REPROVADO"?"❌":"⚖️";
  const duracaoSeg = votacao.inicioTs&&votacao.fimTs ? Math.round((votacao.fimTs-votacao.inicioTs)/1000) : null;

  const barData=[
    {label:"Aprovado",   val:ap, bg:"#0F6E56"},
    {label:"Reprovado",  val:rp, bg:"#A32D2D"},
    {label:"Abstenção",  val:ab, bg:"#5F5E5A"},
  ];

  const summary=[
    ["Total de votos",    total],
    ["Quórum",            quorum+"%"],
    ["Unidades aptas",    aptos],
    ["Ausentes",          ausentes],
    ["Aprovados",         ap],
    ["Reprovados",        rp],
    ["Abstenções",        ab],
    ["Maioria",           ap>rp?"Sim ✅":"Não ❌"],
  ];

  return (
    <div style={{minHeight:"100vh",background:"var(--color-background-tertiary)",padding:16}}>
      <div style={{maxWidth:560,margin:"0 auto",display:"flex",flexDirection:"column",gap:14}}>

        {/* cabeçalho */}
        <div style={{...style.card,textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:4}}>📊</div>
          <h2 style={{margin:"0 0 4px",fontWeight:500,fontSize:22}}>Resultado Final</h2>
          {cond && <p style={{margin:0,fontSize:13,color:"var(--color-text-secondary)"}}>{cond.nome}</p>}
          <p style={{margin:"4px 0 0",fontWeight:500}}>{enquete.tema}</p>
          {duracaoSeg&&<p style={{margin:"4px 0 0",fontSize:12,color:"var(--color-text-tertiary)"}}>Duração: {fmtTime(duracaoSeg)}</p>}
          {votacao.status==="aberta"&&<p style={{margin:"6px 0 0",fontSize:13,color:"var(--color-text-warning)"}}>⚠️ Votação em andamento</p>}
        </div>

        {/* veredicto */}
        <div style={{background:vClrBg,border:`0.5px solid ${vClrTx}`,borderRadius:"var(--border-radius-lg)",padding:"20px 16px",textAlign:"center"}}>
          <p style={{margin:"0 0 4px",fontSize:12,color:vClrTx,fontWeight:500,textTransform:"uppercase"}}>Resultado</p>
          <p style={{margin:0,fontSize:36,fontWeight:700,color:vClrTx}}>{vIco} {vencedor}</p>
        </div>

        {/* barras */}
        <div style={style.card}>
          <h3 style={{margin:"0 0 16px",fontWeight:500,textAlign:"center"}}>Apuração dos votos</h3>
          {barData.map(({label,val,bg})=>(
            <div key={label} style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:14,fontWeight:500}}>{label}</span>
                <span style={{fontSize:14,fontWeight:700,color:bg}}>{val} votos · {pct(val,total)}%</span>
              </div>
              <div style={{background:"var(--color-background-secondary)",borderRadius:99,height:18,overflow:"hidden",position:"relative"}}>
                <div style={{width:`${pct(val,total)}%`,height:"100%",background:bg,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:val>0?8:0,transition:"width .7s"}}>
                  {val>0&&<span style={{color:"#fff",fontSize:11,fontWeight:700}}>{pct(val,total)}%</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* resumo geral */}
        <div style={style.card}>
          <h3 style={{margin:"0 0 14px",fontWeight:500,textAlign:"center"}}>Resumo geral</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
            {summary.map(([l,v])=>(
              <div key={l} style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"12px 10px",textAlign:"center"}}>
                <p style={{margin:"0 0 2px",fontSize:20,fontWeight:700}}>{v}</p>
                <p style={{margin:0,fontSize:11,color:"var(--color-text-secondary)"}}>{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* detalhamento */}
        {votos.length>0&&(
          <div style={style.card}>
            <h3 style={{margin:"0 0 12px",fontWeight:500}}>Detalhamento por unidade</h3>
            {votos.map((v,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderTop:i>0?"0.5px solid var(--color-border-tertiary)":"none"}}>
                <div>
                  <p style={{margin:0,fontSize:14,fontWeight:500}}>Unid. {v.unidade} — {v.nome}</p>
                  {v.procurador&&<p style={{margin:"2px 0 0",fontSize:12,color:"var(--color-text-info)"}}>Procurador de {v.unidadeRep}</p>}
                  <p style={{margin:"2px 0 0",fontSize:11,color:"var(--color-text-tertiary)"}}>{v.ts}</p>
                </div>
                <span style={style.badge(v.voto==="Aprovado")}>{v.voto}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={onBack} style={style.btnO}>← Voltar</button>
      </div>
    </div>
  );
}
