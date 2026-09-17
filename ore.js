"use strict";
/* Ore planetarie - Lexicon Symbolorum
   Sole: algoritmo NOAA, zenit 90.833 gradi (lembo superiore + rifrazione).
   Pianeti e Luna: astronomy-engine 2.1.19 (MIT), longitudini eclittiche apparenti
   riferite all'equinozio della data (zodiaco tropico). */

/* ---------- memoria locale, tollerante ai contesti che la vietano ---------- */
const Mem = {
  get(k){ try { return window.localStorage.getItem(k); } catch(e){ return null; } },
  set(k,v){ try { window.localStorage.setItem(k,v); } catch(e){} }
};

/* ---------- Sole: alba e tramonto ---------- */
const RAD = Math.PI/180;
function julianDay0h(y,m,d){
  if(m<=2){ y-=1; m+=12; }
  const A=Math.floor(y/100), B=2-A+Math.floor(A/4);
  return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+d+B-1524.5;
}
function parametriSolari(jd){
  const T=(jd-2451545)/36525;
  const L0=((280.46646+T*(36000.76983+T*0.0003032))%360+360)%360;
  const M=357.52911+T*(35999.05029-0.0001537*T);
  const e=0.016708634-T*(0.000042037+0.0000001267*T);
  const C=Math.sin(M*RAD)*(1.914602-T*(0.004817+0.000014*T))
        +Math.sin(2*M*RAD)*(0.019993-0.000101*T)
        +Math.sin(3*M*RAD)*0.000289;
  const omega=125.04-1934.136*T;
  const lambda=L0+C-0.00569-0.00478*Math.sin(omega*RAD);
  const eps0=23+(26+(21.448-T*(46.815+T*(0.00059-T*0.001813)))/60)/60;
  const eps=eps0+0.00256*Math.cos(omega*RAD);
  const decl=Math.asin(Math.sin(eps*RAD)*Math.sin(lambda*RAD))/RAD;
  const y=Math.pow(Math.tan(eps/2*RAD),2);
  const eq=4*( y*Math.sin(2*L0*RAD)
             -2*e*Math.sin(M*RAD)
             +4*e*y*Math.sin(M*RAD)*Math.cos(2*L0*RAD)
             -0.5*y*y*Math.sin(4*L0*RAD)
             -1.25*e*e*Math.sin(2*M*RAD))/RAD;
  return {decl:decl, eq:eq};
}
function eventiSolari(y,m,d,lat,lon){
  const jd0=julianDay0h(y,m,d);
  const base=Date.UTC(y,m-1,d,0,0,0);
  function passo(min,segno){
    const p=parametriSolari(jd0+min/1440);
    const cosH=Math.cos(90.833*RAD)/(Math.cos(lat*RAD)*Math.cos(p.decl*RAD))
             -Math.tan(lat*RAD)*Math.tan(p.decl*RAD);
    if(cosH>1) return {stato:"notte-continua"};
    if(cosH<-1) return {stato:"giorno-continuo"};
    const H=Math.acos(cosH)/RAD;
    return {stato:"ok", min:720-4*lon-p.eq+segno*4*H};
  }
  const out={}, coppie=[["alba",-1],["tramonto",1]];
  for(let i=0;i<coppie.length;i++){
    let r=passo(720,coppie[i][1]);
    if(r.stato!=="ok") return {alba:null,tramonto:null,stato:r.stato};
    r=passo(r.min,coppie[i][1]);
    if(r.stato!=="ok") return {alba:null,tramonto:null,stato:r.stato};
    out[coppie[i][0]]=new Date(base+Math.round(r.min*60000));
  }
  return {alba:out.alba, tramonto:out.tramonto, stato:"ok"};
}

/* ---------- catena caldea, segni, dignita ---------- */
const CALDEA=[
  {nome:"Saturno", glifo:"\u2644", di:"di Saturno",  dom:[9,10], esa:6},
  {nome:"Giove",   glifo:"\u2643", di:"di Giove",    dom:[8,11], esa:3},
  {nome:"Marte",   glifo:"\u2642", di:"di Marte",    dom:[0,7],  esa:9},
  {nome:"Sole",    glifo:"\u2609", di:"del Sole",    dom:[4],    esa:0},
  {nome:"Venere",  glifo:"\u2640", di:"di Venere",   dom:[1,6],  esa:11},
  {nome:"Mercurio",glifo:"\u263F", di:"di Mercurio", dom:[2,5],  esa:5},
  {nome:"Luna",    glifo:"\u263D", di:"della Luna",  dom:[3],    esa:1}
];
const SEGNI=[
  ["Ariete","\u2648"],["Toro","\u2649"],["Gemelli","\u264A"],["Cancro","\u264B"],
  ["Leone","\u264C"],["Vergine","\u264D"],["Bilancia","\u264E"],["Scorpione","\u264F"],
  ["Sagittario","\u2650"],["Capricorno","\u2651"],["Acquario","\u2652"],["Pesci","\u2653"]
];
const REGGENTE_DEL_GIORNO=[3,6,2,5,1,4,0];
const NOMI_GIORNO=["domenica","lunedì","martedì","mercoledì","giovedì","venerdì","sabato"];

function dignita(pianeta, segno){
  if(pianeta.dom.indexOf(segno)>=0) return "domicilio";
  if(pianeta.esa===segno) return "esaltazione";
  for(let i=0;i<pianeta.dom.length;i++) if((pianeta.dom[i]+6)%12===segno) return "detrimento";
  if((pianeta.esa+6)%12===segno) return "caduta";
  return "";
}

/* ---------- cielo ---------- */
const CORPO={Sole:"Sun",Luna:"Moon",Mercurio:"Mercury",Venere:"Venus",
             Marte:"Mars",Giove:"Jupiter",Saturno:"Saturn"};
function longitudine(nome, d){
  if(nome==="Luna") return Astronomy.EclipticGeoMoon(d).lon;
  return Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body[CORPO[nome]], d, true)).elon;
}
function posizione(nome, d){
  const lon=((longitudine(nome,d)%360)+360)%360;
  const seg=Math.floor(lon/30);
  const p=CALDEA.filter(function(x){ return x.nome===nome; })[0];
  let retro=false;
  if(nome!=="Sole" && nome!=="Luna"){
    let v=longitudine(nome,new Date(d.getTime()+3600000))-lon;
    if(v>180)v-=360; if(v<-180)v+=360;
    retro = v<0;
  }
  let elong=lon-((longitudine("Sole",d)%360)+360)%360;
  while(elong>180)elong-=360; while(elong<-180)elong+=360;
  return {
    lon:lon, segno:seg, grado:lon-seg*30, retro:retro,
    elongazione:Math.abs(elong),
    dignita: p ? dignita(p,seg) : ""
  };
}
function luna(d, luogo){
  const pos=posizione("Luna",d);
  const ill=Astronomy.Illumination(Astronomy.Body.Moon, d);
  const fase=Astronomy.MoonPhase(d);           /* 0 novilunio, 180 plenilunio */
  let novilunio=null, eta=null;
  try{
    let t=Astronomy.SearchMoonPhase(0, new Date(d.getTime()-31*86400000), 32);
    while(t){
      const s=Astronomy.SearchMoonPhase(0, new Date(t.date.getTime()+86400000), 32);
      if(s && s.date<=d) t=s; else break;
    }
    if(t && t.date<=d){ novilunio=t.date; eta=(d-t.date)/86400000; }
  }catch(e){}
  const quarti=[];
  try{
    let q=Astronomy.SearchMoonQuarter(d);
    for(let i=0;i<4 && q;i++){ quarti.push({q:q.quarter, t:q.time.date}); q=Astronomy.NextMoonQuarter(q); }
  }catch(e){}
  let sorge=null, tramonta=null;
  try{
    const obs=new Astronomy.Observer(luogo.lat, luogo.lon, 0);
    const a=Astronomy.SearchRiseSet(Astronomy.Body.Moon, obs, +1, d, 2);
    const b=Astronomy.SearchRiseSet(Astronomy.Body.Moon, obs, -1, d, 2);
    if(a) sorge=a.date; if(b) tramonta=b.date;
  }catch(e){}
  return {pos:pos, frazione:ill.phase_fraction, fase:fase, eta:eta,
          quarti:quarti, sorge:sorge, tramonta:tramonta};
}

/* ---------- stato ---------- */
let luogo={nome:"Torino", lat:45.0792, lon:7.6761};
let scarto=0;
const salvato=Mem.get("ore-luogo");
if(salvato){ try{ const o=JSON.parse(salvato); if(typeof o.lat==="number"&&typeof o.lon==="number") luogo=o; }catch(e){} }

/* ---------- utilita ---------- */
function orario(d){ return d.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"}); }
function dataBreve(d){ return d.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"}); }
function dataSenzaGiorno(d){ return d.toLocaleDateString("it-IT",{day:"numeric",month:"long"}); }
function durata(ms){
  const min=Math.max(0,Math.round(ms/60000)), h=Math.floor(min/60), m=min%60;
  return h===0 ? min+" min" : h+" h "+(m<10?"0":"")+m;
}
function gradi(x){ return Math.floor(x)+"\u00B0"+(Math.floor((x%1)*60)<10?"0":"")+Math.floor((x%1)*60)+"\u2032"; }
function senzaAccenti(x){
  return x.toLowerCase()
    .replace(/[àáâä]/g,"a").replace(/[èéêë]/g,"e").replace(/[ììíîï]/g,"i")
    .replace(/[òóôö]/g,"o").replace(/[ùúûü]/g,"u").replace(/['’\-]/g," ")
    .replace(/\s+/g," ").trim();
}
function distanzaKm(la1,lo1,la2,lo2){
  const dy=(la2-la1)*110.574;
  const dx=(lo2-lo1)*111.320*Math.cos((la1+la2)/2*RAD);
  return Math.sqrt(dx*dx+dy*dy);
}
function comunePiuVicino(la,lo){
  let best=null, bestD=Infinity;
  for(let i=0;i<LUOGHI.length;i++){
    const l=LUOGHI[i];
    const d=distanzaKm(la,lo,l[2],l[3]);
    if(d<bestD){ bestD=d; best=l; }
  }
  return best ? {luogo:best, km:bestD} : null;
}
function descriviPosizione(la,lo){
  const v=comunePiuVicino(la,lo);
  if(!v) return "la tua posizione";
  if(v.km<0.8) return "la tua posizione, a "+v.luogo[0]+" ("+v.luogo[1]+")";
  const km = v.km<10 ? v.km.toFixed(1).replace(".",",") : Math.round(v.km);
  return "la tua posizione, a "+km+" km da "+v.luogo[0]+" ("+v.luogo[1]+")";
}
function eventiPerData(d){ return eventiSolari(d.getFullYear(), d.getMonth()+1, d.getDate(), luogo.lat, luogo.lon); }
function giornoSpostato(n){ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return d; }

/* ---------- giorno planetario ---------- */
function costruisci(alba,tramonto,albaSeguente,riferimento){
  const partenza=REGGENTE_DEL_GIORNO[riferimento.getDay()];
  const durDi=(tramonto-alba)/12, durNo=(albaSeguente-tramonto)/12;
  const ore=[];
  for(let i=0;i<24;i++){
    const notturna=i>=12;
    const inizio=notturna ? tramonto.getTime()+(i-12)*durNo : alba.getTime()+i*durDi;
    ore.push({indice:i+1, notturna:notturna, posizione:(i%12)+1,
              inizio:new Date(inizio), fine:new Date(inizio+(notturna?durNo:durDi)),
              pianeta:CALDEA[(partenza+i)%7]});
  }
  return {stato:"ok", ore:ore, alba:alba, tramonto:tramonto, albaSeguente:albaSeguente,
          nomeGiorno:NOMI_GIORNO[riferimento.getDay()], reggenteGiorno:CALDEA[partenza],
          durDi:durDi, durNo:durNo};
}
function giornoPlanetario(istante){
  const oggi=new Date(istante); oggi.setHours(12,0,0,0);
  const ieri=new Date(oggi); ieri.setDate(ieri.getDate()-1);
  const domani=new Date(oggi); domani.setDate(domani.getDate()+1);
  const eOggi=eventiPerData(oggi);
  if(eOggi.stato!=="ok") return {stato:eOggi.stato};
  if(istante<eOggi.alba.getTime()){
    const eIeri=eventiPerData(ieri);
    if(eIeri.stato!=="ok") return {stato:eIeri.stato};
    return costruisci(eIeri.alba, eIeri.tramonto, eOggi.alba, ieri);
  }
  const eDomani=eventiPerData(domani);
  if(eDomani.stato!=="ok") return {stato:eDomani.stato};
  return costruisci(eOggi.alba, eOggi.tramonto, eDomani.alba, oggi);
}
function giornoPlanetarioDellaData(data){
  const oggi=new Date(data); oggi.setHours(12,0,0,0);
  const domani=new Date(oggi); domani.setDate(domani.getDate()+1);
  const e=eventiPerData(oggi);
  if(e.stato!=="ok") return {stato:e.stato};
  const e2=eventiPerData(domani);
  if(e2.stato!=="ok") return {stato:e2.stato};
  return costruisci(e.alba, e.tramonto, e2.alba, oggi);
}

/* ---------- quadrante ---------- */
function disegnaQuadrante(g, attiva, frazioneOra){
  const R=150, r=104, cx=170, cy=170;
  const totale=g.albaSeguente-g.alba;
  const angoloDi=360*(g.tramonto-g.alba)/totale;
  const passoDi=angoloDi/12, passoNo=(360-angoloDi)/12;
  function punto(raggio,ang){ const a=(ang-90)*RAD; return [cx+raggio*Math.cos(a), cy+raggio*Math.sin(a)]; }
  function settore(a1,a2,classe){
    const grande=(a2-a1)>180?1:0;
    const p1=punto(R,a1), p2=punto(R,a2), p3=punto(r,a2), p4=punto(r,a1);
    return '<path class="'+classe+'" d="M'+p1[0].toFixed(2)+' '+p1[1].toFixed(2)+
      ' A'+R+' '+R+' 0 '+grande+' 1 '+p2[0].toFixed(2)+' '+p2[1].toFixed(2)+
      ' L'+p3[0].toFixed(2)+' '+p3[1].toFixed(2)+
      ' A'+r+' '+r+' 0 '+grande+' 0 '+p4[0].toFixed(2)+' '+p4[1].toFixed(2)+' Z"/>';
  }
  let s='<svg viewBox="-8 -20 356 380" role="img" aria-label="Quadrante delle ventiquattro ore planetarie">';
  let ang=0;
  for(let i=0;i<24;i++){
    const passo=i<12?passoDi:passoNo, attivo=(attiva!==null&&attiva===i);
    s+=settore(ang,ang+passo, attivo?"seg-attivo":(i<12?"seg-giorno":"seg-notte"));
    const c=punto((R+r)/2, ang+passo/2);
    s+='<text class="glifo-arco'+(attivo?" attiva":"")+'" x="'+c[0].toFixed(2)+'" y="'+c[1].toFixed(2)+'">'+g.ore[i].pianeta.glifo+'</text>';
    ang+=passo;
  }
  s+='<circle class="bordo" cx="'+cx+'" cy="'+cy+'" r="'+R+'"/><circle class="bordo" cx="'+cx+'" cy="'+cy+'" r="'+r+'"/>';
  [[0,"alba"],[angoloDi,"tramonto"]].forEach(function(v){
    const t1=punto(r-4,v[0]), t2=punto(R+8,v[0]), lab=punto(R+22,v[0]);
    s+='<line class="tacca" x1="'+t1[0].toFixed(2)+'" y1="'+t1[1].toFixed(2)+'" x2="'+t2[0].toFixed(2)+'" y2="'+t2[1].toFixed(2)+'"/>';
    const dy = lab[1] < cy ? -2 : 11;
    s+='<text class="marca" x="'+lab[0].toFixed(2)+'" y="'+(lab[1]+dy).toFixed(2)+'">'+v[1]+'</text>';
  });
  if(attiva!==null){
    let a=0;
    for(let i=0;i<attiva;i++) a+=(i<12?passoDi:passoNo);
    a+=(attiva<12?passoDi:passoNo)*frazioneOra;
    const q1=punto(r-6,a), q2=punto(R+6,a);
    s+='<line class="lancetta" x1="'+q1[0].toFixed(2)+'" y1="'+q1[1].toFixed(2)+'" x2="'+q2[0].toFixed(2)+'" y2="'+q2[1].toFixed(2)+'"/>';
  }
  return s+'</svg>';
}

/* ---------- disco lunare ---------- */
function discoLunare(fase, lato){
  const R=26, cx=30, cy=30;
  const k=Math.cos(fase*RAD);           /* +1 novilunio, -1 plenilunio */
  const crescente = fase<180;
  const rx=Math.abs(k)*R;
  const spazzata = crescente ? 1 : 0;
  const interna = ((k<0) === crescente) ? 1 : 0;
  let s='<svg viewBox="0 0 60 60" class="disco" role="img" aria-label="Fase lunare">';
  s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+R+'" class="luna-ombra"/>';
  s+='<path class="luna-luce" d="M'+cx+' '+(cy-R)+
      ' A'+R+' '+R+' 0 0 '+spazzata+' '+cx+' '+(cy+R)+
      ' A'+rx.toFixed(2)+' '+R+' 0 0 '+interna+' '+cx+' '+(cy-R)+' Z"/>';
  s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+R+'" class="luna-bordo"/></svg>';
  return s;
}

/* ---------- resa ---------- */
const NOMI_QUARTO=["novilunio","primo quarto","plenilunio","ultimo quarto"];

function resa(){
  const corpo=document.getElementById("corpo");
  const adesso=Date.now(), oggi=(scarto===0);
  const g = oggi ? giornoPlanetario(adesso) : giornoPlanetarioDellaData(giornoSpostato(scarto));
  document.getElementById("etichetta-data").textContent=dataBreve(giornoSpostato(scarto));
  document.getElementById("etichetta-luogo").textContent=luogo.nome;

  if(g.stato!=="ok"){
    corpo.innerHTML='<div class="avviso">A '+luogo.nome+', in questa data, il Sole non sorge e non tramonta: '+
      (g.stato==="giorno-continuo"?"il giorno dura senza interruzione":"la notte dura senza interruzione")+
      '. Le ore diseguali non sono definite, perché manca il confine che le genera. Scegli un\'altra data o un altro luogo.</div>';
    return;
  }

  let attiva=null, frazione=0;
  if(oggi){
    for(let i=0;i<24;i++){
      if(adesso>=g.ore[i].inizio.getTime() && adesso<g.ore[i].fine.getTime()){
        attiva=i; frazione=(adesso-g.ore[i].inizio)/(g.ore[i].fine-g.ore[i].inizio); break;
      }
    }
  }
  const o = attiva!==null ? g.ore[attiva] : null;
  const istante = oggi ? new Date() : new Date(g.ore[0].inizio.getTime()+ (g.tramonto-g.alba)/2);

  let html='<div class="quadrante">'+disegnaQuadrante(g,attiva,frazione)+'<div class="centro">';
  if(o){
    html+='<div class="glifo">'+o.pianeta.glifo+'</div>'
       +'<div class="reggente">'+o.pianeta.nome+'</div>'
       +'<div class="posizione">'+o.posizione+'ª ora '+(o.notturna?"della notte":"del giorno")+'</div>'
       +'<div class="residuo">ancora '+durata(o.fine-adesso)+'</div>';
  } else {
    html+='<div class="glifo">'+g.reggenteGiorno.glifo+'</div>'
       +'<div class="reggente">'+g.nomeGiorno+'</div>'
       +'<div class="posizione">giorno '+g.reggenteGiorno.di+'</div>';
  }
  html+='</div></div>';

  html+='<div class="efemeridi"><span>alba <b>'+orario(g.alba)+'</b></span>'
      +'<span>tramonto <b>'+orario(g.tramonto)+'</b></span>'
      +'<span>ora diurna <b>'+durata(g.durDi)+'</b></span>'
      +'<span>ora notturna <b>'+durata(g.durNo)+'</b></span></div>';
  html+='<p class="giorno-planetario">Giorno planetario '+g.reggenteGiorno.di+' '+g.reggenteGiorno.glifo
      +', cominciato all\'alba di '+g.nomeGiorno+'</p>';

  /* il cielo dell'ora */
  if(o){
    const p=posizione(o.pianeta.nome, istante);
    html+='<section class="cielo"><h2>Il reggente dell\'ora</h2><p class="riga-cielo">'
      +o.pianeta.glifo+' '+o.pianeta.nome+' in '+SEGNI[p.segno][1]+' '+SEGNI[p.segno][0]+', '+gradi(p.grado)
      +(p.dignita ? ' <span class="dignita">'+p.dignita+'</span>' : ' <span class="tenue">senza dignità fra le quattro</span>')
      +(p.retro ? ' <span class="dignita">retrogrado</span>' : '')
      +'</p><p class="tenue">'
      +(o.pianeta.nome==="Sole" ? "È il Sole stesso." : "Distanza dal Sole "+p.elongazione.toFixed(1)+"\u00B0.")
      +'</p></section>';
  }

  /* Luna */
  const L=luna(istante, luogo);
  html+='<section class="cielo luna-blocco"><h2>La Luna</h2><div class="luna-riga">'
     +discoLunare(L.fase)
     +'<div><p class="riga-cielo">'+SEGNI[L.pos.segno][1]+' in '+SEGNI[L.pos.segno][0]+', '+gradi(L.pos.grado)
     +(L.pos.dignita ? ' <span class="dignita">'+L.pos.dignita+'</span>' : '')+'</p>'
     +'<p class="tenue">illuminata al '+Math.round(L.frazione*100)+' per cento'
     +(L.eta!==null ? ', '+L.eta.toFixed(1)+' giorni dal novilunio' : '')+'</p>'
     +'<p class="tenue">'
     +(L.sorge ? 'sorge '+orario(L.sorge) : 'non sorge')+' \u00B7 '
     +(L.tramonta ? 'tramonta '+orario(L.tramonta) : 'non tramonta')+'</p></div></div>';
  if(L.quarti.length){
    html+='<p class="tenue quarti">';
    html+=L.quarti.map(function(q){ return NOMI_QUARTO[q.q]+' '+dataSenzaGiorno(q.t)+' '+orario(q.t); }).join(' \u00B7 ');
    html+='</p>';
  }
  html+='</section>';

  /* tavola */
  html+='<table><caption>Le ventiquattro ore, dall\'alba all\'alba</caption>'
      +'<thead><tr><th>n.</th><th></th><th>reggente</th><th style="text-align:right">inizio</th></tr></thead><tbody>';
  for(let i=0;i<24;i++){
    const x=g.ore[i];
    if(i>0){
      const prima=-g.ore[i-1].inizio.getTimezoneOffset(), dopo=-x.inizio.getTimezoneOffset();
      if(prima!==dopo){
        const avanti=dopo>prima, salto=Math.abs(dopo-prima);
        html+='<tr class="transizione"><td colspan="4">l\'orologio va '
          +(avanti?"avanti":"indietro")+' di '+(salto===60?"un\'ora":salto+" minuti")
          +'; la durata dell\'ora planetaria non cambia</td></tr>';
      }
    }
    html+='<tr class="'+(i===attiva?"ora-attiva ":"")+(i===11?"sep":"")+'">'
       +'<td class="n">'+x.posizione+'</td><td class="g">'+x.pianeta.glifo+'</td>'
       +'<td>'+x.pianeta.nome+'<span class="tenue piccolo"> · '+(x.notturna?"notte":"giorno")+'</span></td>'
       +'<td class="o">'+orario(x.inizio)+'</td></tr>';
  }
  corpo.innerHTML=html+'</tbody></table>';
}

/* ---------- ricerca di un pianeta ---------- */
function trovaPianeta(nome){
  const esiti=[], adesso=Date.now();
  let cursore=new Date(); cursore.setHours(12,0,0,0);
  for(let k=0;k<14 && esiti.length<4;k++){
    const g=giornoPlanetarioDellaData(cursore);
    if(g.stato==="ok"){
      for(let i=0;i<24 && esiti.length<4;i++){
        const x=g.ore[i];
        if(x.pianeta.nome===nome && x.fine.getTime()>adesso) esiti.push(x);
      }
    }
    cursore=new Date(cursore.getTime()+86400000);
  }
  const box=document.getElementById("esiti");
  if(!esiti.length){ box.textContent="Nessuna ora calcolabile nei prossimi giorni in questo luogo."; return; }
  box.innerHTML=esiti.map(function(x){
    const p=posizione(x.pianeta.nome, x.inizio);
    return '<div>'+x.pianeta.glifo+' '+dataBreve(x.inizio)+', dalle '+orario(x.inizio)+' alle '+orario(x.fine)
      +' <span class="tenue">('+x.posizione+'ª ora '+(x.notturna?"della notte":"del giorno")
      +(p.dignita ? ', in '+p.dignita : '')+(p.retro ? ', retrogrado' : '')+')</span></div>';
  }).join("");
}

/* ---------- interfaccia ---------- */
function avvio(){
  const campo=document.getElementById("citta");
  const proposte=document.getElementById("proposte");
  const esito=document.getElementById("esito-luogo");
  campo.value = /posizione|^-?\d+[.,]\d+,/.test(luogo.nome) ? "" : luogo.nome;

  document.getElementById("pianeta").innerHTML=CALDEA.map(function(p){ return '<option>'+p.nome+'</option>'; }).join("");

  let correnti=[];
  function chiudiProposte(){ proposte.innerHTML=""; proposte.classList.remove("aperte"); correnti=[]; }
  function scegli(l){
    chiudiProposte();
    esito.textContent="";
    campo.value=l[0];
    campo.blur();
    luogo={nome:l[0]+" ("+l[1]+")", lat:l[2], lon:l[3]};
    Mem.set("ore-luogo",JSON.stringify(luogo));
    resa();
  }
  function cerca(testo, quanti){
    const v=senzaAccenti(testo);
    if(v.length<2) return [];
    const inizia=[], dentro=[];
    for(let i=0;i<LUOGHI.length && inizia.length<60;i++){
      const n=senzaAccenti(LUOGHI[i][0]);
      if(n===v) inizia.unshift(LUOGHI[i]);
      else if(n.indexOf(v)===0) inizia.push(LUOGHI[i]);
      else if(dentro.length<20 && n.indexOf(v)>0) dentro.push(LUOGHI[i]);
    }
    inizia.sort(function(a,b){
      const na=senzaAccenti(a[0]), nb=senzaAccenti(b[0]);
      if((na===v)!==(nb===v)) return na===v ? -1 : 1;
      if(na.length!==nb.length) return na.length-nb.length;
      return na<nb ? -1 : 1;
    });
    return inizia.concat(dentro).slice(0,quanti);
  }
  function mostraProposte(){
    const t=campo.value.trim();
    if(t.length<2){ chiudiProposte(); return; }
    correnti=cerca(t,8);
    if(!correnti.length){ chiudiProposte(); return; }
    proposte.innerHTML=correnti.map(function(l,i){
      return '<li role="option" data-i="'+i+'">'+l[0]+' <span class="tenue">('+l[1]+')</span></li>';
    }).join("");
    proposte.classList.add("aperte");
  }
  campo.addEventListener("input", function(){ esito.textContent=""; mostraProposte(); });
  campo.addEventListener("focus", mostraProposte);
  proposte.addEventListener("mousedown", function(e){
    const li=e.target.closest("li"); if(!li) return;
    e.preventDefault(); scegli(correnti[Number(li.dataset.i)]);
  });
  campo.addEventListener("keydown", function(e){
    if(e.key==="Enter"){
      e.preventDefault();
      const t=campo.value.trim();
      if(t.length<2) return;
      const r=correnti.length?correnti:cerca(t,1);
      if(r.length) scegli(r[0]);
      else esito.textContent="Nessun comune con questo nome. Controlla la grafia, oppure usa le coordinate.";
    } else if(e.key==="Escape"){ chiudiProposte(); }
  });
  campo.addEventListener("blur", function(){ setTimeout(chiudiProposte,120); });

  document.getElementById("coordinate-apri").addEventListener("click",function(){
    document.getElementById("coord").classList.toggle("visibile");
  });
  document.getElementById("applica").addEventListener("click",function(){
    const la=parseFloat(document.getElementById("lat").value), lo=parseFloat(document.getElementById("lon").value);
    if(isNaN(la)||isNaN(lo)||Math.abs(la)>90||Math.abs(lo)>180){
      esito.textContent="Latitudine fra -90 e 90, longitudine fra -180 e 180."; return;
    }
    esito.textContent="";
    luogo={nome:la.toFixed(3)+", "+lo.toFixed(3), lat:la, lon:lo};
    campo.value="";
    Mem.set("ore-luogo",JSON.stringify(luogo));
    resa();
  });
  document.getElementById("geo").addEventListener("click",function(){
    const b=this;
    if(!navigator.geolocation){ esito.textContent="Questo dispositivo non fornisce la posizione."; return; }
    b.textContent="Cerco…"; b.disabled=true;
    navigator.geolocation.getCurrentPosition(function(pos){
      const la=pos.coords.latitude, lo=pos.coords.longitude;
      luogo={nome:descriviPosizione(la,lo), lat:la, lon:lo};
      Mem.set("ore-luogo",JSON.stringify(luogo));
      b.textContent="Dove sono"; b.disabled=false;
      campo.value=""; esito.textContent=""; chiudiProposte();
      resa();
    },function(){
      b.textContent="Dove sono"; b.disabled=false;
      esito.textContent="Posizione non disponibile. Scrivi il nome di un comune o inserisci le coordinate.";
    },{timeout:10000,maximumAge:600000,enableHighAccuracy:false});
  });
  document.getElementById("prec").addEventListener("click",function(){ scarto--; resa(); });
  document.getElementById("succ").addEventListener("click",function(){ scarto++; resa(); });
  document.getElementById("oggi").addEventListener("click",function(){ scarto=0; resa(); });
  document.getElementById("trova").addEventListener("click",function(){ trovaPianeta(document.getElementById("pianeta").value); });

  const fuso=(Intl.DateTimeFormat().resolvedOptions().timeZone)||"locale";
  document.getElementById("nota-fuso").textContent=
    "Gli orari sono espressi nel fuso del dispositivo ("+fuso+"). Se scegli un luogo in un fuso diverso dal tuo, l'ora indicata resta quella del tuo orologio, non quella dell'orologio di quel luogo.";

  resa();
  setInterval(function(){ if(scarto===0) resa(); },30000);
  if("serviceWorker" in navigator && location.protocol.indexOf("http")===0){
    try{ navigator.serviceWorker.register("sw.js"); }catch(e){}
  }
}
if(typeof document!=="undefined" && document.getElementById("corpo")){
  try{ avvio(); }
  catch(errore){
    document.getElementById("corpo").innerHTML=
      '<div class="avviso">Questa pagina e il programma che la anima non appartengono alla stessa versione, '
      +'di solito perch\u00e9 il browser conserva una copia vecchia. Ricarica la pagina tenendo premuto il tasto '
      +'delle maiuscole; se non basta, chiudi del tutto l\'applicazione e riaprila.</div>';
    if(window.console) console.error(errore);
  }
}
