import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'

// ── Constants ──────────────────────────────────────────────────────────────
const COLORS = ['Rot','Gelb','Orange','Rosa','Lila','Grün','Schwarz','Braun','Weiß','Gestreift']
const TYPES  = ['Fleischtomate','Cocktailtomate','Rundtomate','Kirschtomate','Datteltomate','Strauchtom.','Andere']
const SIZES  = ['Klein','Mittel','Groß','Sehr groß']
const LOCS   = ['Gewächshaus','Garten (Freiland)','Balkon','Topf']

const EMPTY_FORM = {
  name:'', year: new Date().getFullYear(), source:'', color:'Rot', size:'Mittel',
  type:'Rundtomate', taste:3, taste_notes:'', harvest_rating:3, care_notes:'',
  germination_days:'', harvest_days:'', diseases:'', location:'Garten (Freiland)',
  tags:[], image_url:'',
}

// ── Tiny helpers ───────────────────────────────────────────────────────────
function Stars({ value, onChange, readonly }) {
  return (
    <div style={{ display:'flex', gap:2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} onClick={() => !readonly && onChange?.(i)}
          style={{ fontSize:22, cursor:readonly?'default':'pointer',
            color: i<=value ? '#e8520a' : '#c9b99a', transition:'color .15s' }}>★</span>
      ))}
    </div>
  )
}

function Tag({ label, onRemove }) {
  return (
    <span style={{ background:'#e8f5e9', color:'#2e6b3e', borderRadius:20,
      padding:'2px 10px', fontSize:12, display:'inline-flex', alignItems:'center', gap:4 }}>
      {label}
      {onRemove && <span onClick={onRemove} style={{ cursor:'pointer', fontWeight:700, opacity:.6 }}>×</span>}
    </span>
  )
}

function TomatoPlaceholder({ size=80 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="44" r="28" fill="#e8520a" opacity=".12"/>
      <circle cx="40" cy="44" r="22" fill="#e8520a" opacity=".2"/>
      <path d="M40 22 Q44 14 52 16 Q44 18 40 22Z" fill="#2e6b3e" opacity=".4"/>
      <path d="M40 22 Q36 14 28 16 Q36 18 40 22Z" fill="#2e6b3e" opacity=".4"/>
      <path d="M40 22 Q40 12 40 10" stroke="#2e6b3e" strokeWidth="1.5" strokeLinecap="round" opacity=".4"/>
    </svg>
  )
}

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:999,
      background: toast.type==='err' ? '#c0392b' : '#2e6b3e',
      color:'#fff', padding:'12px 22px', borderRadius:10,
      boxShadow:'0 4px 20px #0004', fontSize:15, animation:'fadeIn .2s' }}>
      {toast.msg}
    </div>
  )
}

const inputStyle = {
  width:'100%', padding:'10px 13px', borderRadius:9, border:'1.5px solid #ddd',
  fontSize:15, background:'#fff', outline:'none', display:'block', fontFamily:'inherit',
}
const selStyle = {
  padding:'9px 12px', borderRadius:9, border:'1.5px solid #ddd',
  background:'#faf6f0', fontSize:14, fontFamily:'inherit', cursor:'pointer',
}

// ══════════════════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [session,  setSession]  = useState(null)
  const [profile,  setProfile]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [view,     setView]     = useState('gallery')
  const [tomatoes, setTomatoes] = useState([])
  const [selected, setSelected] = useState(null)
  const [editing,  setEditing]  = useState(null)
  const [search,   setSearch]   = useState('')
  const [fColor,   setFColor]   = useState('')
  const [fType,    setFType]    = useState('')
  const [fLoc,     setFLoc]     = useState('')
  const [toast,    setToast]    = useState(null)

  const showToast = useCallback((msg, type='ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Auth listener ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (uid) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data)
    setLoading(false)
  }

  // ── Load tomatoes ──────────────────────────────────────────────────────
  const loadTomatoes = useCallback(async () => {
    const { data: tomatoData, error } = await supabase
      .from('tomatoes')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { showToast('Fehler beim Laden: ' + error.message, 'err'); return }

    // Profile separat laden und zusammenführen
    const userIds = [...new Set((tomatoData||[]).map(t => t.user_id).filter(Boolean))]
    let profileMap = {}
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles').select('id, name').in('id', userIds)
      ;(profileData||[]).forEach(p => { profileMap[p.id] = p })
    }
    const data = (tomatoData||[]).map(t => ({ ...t, profiles: profileMap[t.user_id] || null }))
    setTomatoes(data)
  }, [showToast])

  useEffect(() => { if (session) loadTomatoes() }, [session, loadTomatoes])

  // ── Actions ────────────────────────────────────────────────────────────
  const logout = async () => {
    await supabase.auth.signOut()
    setView('gallery')
  }

  const saveTomato = async (formData, imageFile) => {
    let image_url = formData.image_url || ''

    // Upload image if new file selected
    if (imageFile) {
      const ext  = imageFile.name.split('.').pop()
      const path = `${session.user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('tomato-images').upload(path, imageFile, { upsert: true })
      if (upErr) { showToast('Bild-Upload fehlgeschlagen: ' + upErr.message, 'err'); return }
      const { data: urlData } = supabase.storage.from('tomato-images').getPublicUrl(path)
      image_url = urlData.publicUrl
    }

    const payload = {
      ...formData,
      image_url,
      user_id: session.user.id,
      tags: formData.tags || [],
    }
    delete payload.profiles

    let error
    if (formData.id) {
      ;({ error } = await supabase.from('tomatoes').update(payload).eq('id', formData.id))
    } else {
      ;({ error } = await supabase.from('tomatoes').insert(payload))
    }

    if (error) { showToast('Fehler: ' + error.message, 'err'); return }
    showToast(formData.id ? 'Sorte aktualisiert ✓' : 'Neue Sorte gespeichert ✓')
    await loadTomatoes()
    setEditing(null)
    setView('gallery')
  }

  const deleteTomato = async (id) => {
    const { error } = await supabase.from('tomatoes').delete().eq('id', id)
    if (error) { showToast('Fehler beim Löschen', 'err'); return }
    showToast('Sorte gelöscht', 'warn')
    await loadTomatoes()
    setView('gallery')
    setSelected(null)
  }

  // ── Filtering ──────────────────────────────────────────────────────────
  const filtered = tomatoes.filter(t => {
    const q = search.toLowerCase()
    return (!q || t.name?.toLowerCase().includes(q) ||
      (t.taste_notes||'').toLowerCase().includes(q) ||
      (t.source||'').toLowerCase().includes(q) ||
      (t.tags||[]).some(g => g.toLowerCase().includes(q))) &&
      (!fColor || t.color === fColor) &&
      (!fType  || t.type  === fType)  &&
      (!fLoc   || t.location === fLoc)
  })

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) return <Splash text="Lade…" />
  if (!session) return <AuthPage showToast={showToast} />

  return (
    <div style={{ minHeight:'100vh', background:'#faf6f0', fontFamily:"'Crimson Pro', Georgia, serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

      {/* HEADER */}
      <header style={{ background:'#1a3a24', color:'#faf6f0', padding:'0 24px',
        display:'flex', alignItems:'center', gap:16, height:60,
        boxShadow:'0 2px 12px #0003', position:'sticky', top:0, zIndex:100 }}>
        <span style={{ fontSize:28 }}>🍅</span>
        <span style={{ fontSize:22, fontWeight:600, flex:1 }}>Tomaten-Archiv</span>
        <nav style={{ display:'flex', gap:4 }}>
          {[['gallery','Galerie'],['form','+ Sorte']].map(([v,l]) => (
            <button key={v} onClick={() => { setView(v); if(v==='form') setEditing(null) }}
              style={{ background:view===v?'#e8520a':'transparent', color:'#faf6f0',
                border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer',
                fontSize:14, fontFamily:'inherit' }}>{l}</button>
          ))}
          {profile?.role === 'admin' && (
            <button onClick={() => setView('admin')}
              style={{ background:view==='admin'?'#e8520a':'transparent', color:'#faf6f0',
                border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer',
                fontSize:14, fontFamily:'inherit' }}>Nutzer</button>
          )}
        </nav>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginLeft:8 }}>
          <span style={{ fontSize:13, opacity:.75 }}>{profile?.name || session.user.email}</span>
          <button onClick={logout} style={{ background:'#ffffff22', border:'none', borderRadius:6,
            color:'#faf6f0', padding:'4px 10px', cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>
            Abmelden
          </button>
        </div>
      </header>

      <Toast toast={toast} />

      <main style={{ maxWidth:1200, margin:'0 auto', padding:'24px 16px' }}>
        {view === 'gallery' && (
          <GalleryView tomatoes={filtered}
            search={search} setSearch={setSearch}
            fColor={fColor} setFColor={setFColor}
            fType={fType}   setFType={setFType}
            fLoc={fLoc}     setFLoc={setFLoc}
            onSelect={t => { setSelected(t); setView('detail') }} />
        )}
        {view === 'detail' && selected && (
          <DetailView
            tomato={tomatoes.find(t => t.id === selected.id) || selected}
            session={session} profile={profile}
            onBack={() => setView('gallery')}
            onEdit={t => { setEditing(t); setView('form') }}
            onDelete={deleteTomato} />
        )}
        {view === 'form' && (
          <FormView initial={editing} onSave={saveTomato}
            onCancel={() => setView('gallery')} />
        )}
        {view === 'admin' && profile?.role === 'admin' && (
          <AdminView showToast={showToast} />
        )}
      </main>

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        * { box-sizing: border-box; }
        input, select, textarea { font-family: inherit; }
      `}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// SPLASH
// ══════════════════════════════════════════════════════════════════════════
function Splash({ text }) {
  return (
    <div style={{ minHeight:'100vh', background:'#1a3a24', display:'flex',
      flexDirection:'column', alignItems:'center', justifyContent:'center',
      fontFamily:"'Crimson Pro', Georgia, serif", color:'#faf6f0', gap:16 }}>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet"/>
      <div style={{ fontSize:60 }}>🍅</div>
      <p style={{ fontSize:18, opacity:.7 }}>{text}</p>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// AUTH PAGE  (Login + Registrierung)
// ══════════════════════════════════════════════════════════════════════════
function AuthPage({ showToast }) {
  const [mode,     setMode]     = useState('login')   // login | register
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [err,      setErr]      = useState('')

  const submit = async () => {
    setErr(''); setLoading(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setErr('Falsche E-Mail oder Passwort.')
    } else {
      if (!name.trim()) { setErr('Bitte einen Namen eingeben.'); setLoading(false); return }
      const { data, error } = await supabase.auth.signUp({ email, password,
        options: { data: { name } } })
      if (error) { setErr(error.message); setLoading(false); return }
      // create profile row
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id, email, name, role: 'user'
        })
      }
      showToast('Registrierung erfolgreich! Bitte E-Mail bestätigen.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#1a3a24',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:"'Crimson Pro', Georgia, serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet"/>
      <div style={{ background:'#faf6f0', borderRadius:18, padding:'48px 40px',
        width:400, boxShadow:'0 20px 60px #0006' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:52, marginBottom:8 }}>🍅</div>
          <h1 style={{ margin:0, fontSize:28, fontWeight:600, color:'#1a3a24' }}>Tomaten-Archiv</h1>
          <div style={{ display:'flex', gap:0, marginTop:20, borderRadius:10, overflow:'hidden',
            border:'1.5px solid #ddd' }}>
            {[['login','Anmelden'],['register','Registrieren']].map(([m,l]) => (
              <button key={m} onClick={() => { setMode(m); setErr('') }}
                style={{ flex:1, padding:'10px', border:'none', fontFamily:'inherit',
                  background:mode===m?'#1a3a24':'#fff', color:mode===m?'#fff':'#333',
                  cursor:'pointer', fontSize:14, fontWeight:mode===m?600:400 }}>{l}</button>
            ))}
          </div>
        </div>
        {mode === 'register' && (
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Dein Name"
            style={{ ...inputStyle, marginBottom:10 }} />
        )}
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-Mail"
          type="email" style={{ ...inputStyle, marginBottom:10 }}
          onKeyDown={e=>e.key==='Enter'&&submit()} />
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Passwort"
          type="password" style={inputStyle} onKeyDown={e=>e.key==='Enter'&&submit()} />
        {err && <p style={{ color:'#c0392b', fontSize:13, margin:'8px 0 0' }}>{err}</p>}
        <button onClick={submit} disabled={loading} style={{ width:'100%', marginTop:20,
          background:'#e8520a', color:'#fff', border:'none', borderRadius:10,
          padding:'13px', fontSize:17, fontFamily:'inherit', fontWeight:600,
          cursor:loading?'wait':'pointer', opacity:loading?.7:1 }}>
          {loading ? 'Bitte warten…' : mode==='login' ? 'Anmelden' : 'Konto erstellen'}
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// GALLERY VIEW
// ══════════════════════════════════════════════════════════════════════════
function GalleryView({ tomatoes, search, setSearch, fColor, setFColor, fType, setFType, fLoc, setFLoc, onSelect }) {
  const hasFilter = search || fColor || fType || fLoc
  return (
    <div>
      <div style={{ background:'#fff', borderRadius:14, padding:'16px 20px', marginBottom:24,
        boxShadow:'0 2px 10px #0001', display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍  Name, Geschmack, Quelle, Tag…"
          style={{ ...inputStyle, flex:'1 1 200px', background:'#faf6f0' }} />
        <select value={fColor} onChange={e=>setFColor(e.target.value)} style={selStyle}>
          <option value="">Alle Farben</option>
          {COLORS.map(c=><option key={c}>{c}</option>)}
        </select>
        <select value={fType} onChange={e=>setFType(e.target.value)} style={selStyle}>
          <option value="">Alle Typen</option>
          {TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
        <select value={fLoc} onChange={e=>setFLoc(e.target.value)} style={selStyle}>
          <option value="">Alle Standorte</option>
          {LOCS.map(l=><option key={l}>{l}</option>)}
        </select>
        {hasFilter && (
          <button onClick={()=>{setSearch('');setFColor('');setFType('');setFLoc('')}}
            style={{ background:'#eee', border:'none', borderRadius:8, padding:'8px 14px',
              cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>Filter löschen ×</button>
        )}
      </div>
      <p style={{ marginBottom:20, color:'#666', fontSize:14 }}>
        <strong style={{ color:'#1a3a24' }}>{tomatoes.length}</strong> Sorten gefunden
      </p>
      {tomatoes.length === 0 ? (
        <div style={{ textAlign:'center', padding:'80px 0', color:'#aaa' }}>
          <TomatoPlaceholder size={60}/>
          <p style={{ marginTop:16 }}>Noch keine Sorten eingetragen – leg los!</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:20 }}>
          {tomatoes.map(t => <TomatoCard key={t.id} tomato={t} onClick={()=>onSelect(t)}/>)}
        </div>
      )}
    </div>
  )
}

function TomatoCard({ tomato: t, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'#fff', borderRadius:16, overflow:'hidden',
      boxShadow:'0 2px 12px #0001', cursor:'pointer', border:'1.5px solid #f0ebe3',
      transition:'transform .18s, box-shadow .18s' }}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow='0 8px 28px #0002'}}
      onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='0 2px 12px #0001'}}>
      <div style={{ height:160, background:'linear-gradient(135deg,#fff5f0,#fef9f4)',
        display:'flex', alignItems:'center', justifyContent:'center',
        borderBottom:'1px solid #f0ebe3', overflow:'hidden', position:'relative' }}>
        {t.image_url
          ? <img src={t.image_url} alt={t.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          : <TomatoPlaceholder size={80}/>}
        <span style={{ position:'absolute', top:10, right:10, background:'#1a3a24', color:'#fff',
          fontSize:11, padding:'3px 9px', borderRadius:20, fontFamily:"'DM Mono', monospace" }}>
          {t.year}
        </span>
      </div>
      <div style={{ padding:'14px 16px' }}>
        <h3 style={{ margin:'0 0 4px', fontSize:19, fontWeight:600, color:'#1a3a24' }}>{t.name}</h3>
        <p style={{ margin:'0 0 8px', fontSize:13, color:'#888' }}>{t.type} · {t.color} · {t.size}</p>
        <Stars value={t.taste} readonly/>
        <p style={{ margin:'8px 0 10px', fontSize:13, color:'#555', lineHeight:1.5,
          overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
          {t.taste_notes}
        </p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {(t.tags||[]).slice(0,3).map(g=><Tag key={g} label={g}/>)}
        </div>
        <p style={{ margin:'10px 0 0', fontSize:12, color:'#aaa' }}>
          📍 {t.location} · von {t.profiles?.name || '–'}
        </p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// DETAIL VIEW
// ══════════════════════════════════════════════════════════════════════════
function DetailView({ tomato: t, session, profile, onBack, onEdit, onDelete }) {
  const [delConfirm, setDelConfirm] = useState(false)
  const canEdit = profile?.role === 'admin' || t.user_id === session?.user?.id

  return (
    <div>
      <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer',
        color:'#1a3a24', fontSize:15, fontFamily:'inherit', marginBottom:16,
        padding:0, display:'flex', alignItems:'center', gap:6 }}>← Zurück zur Galerie</button>
      <div style={{ background:'#fff', borderRadius:18, overflow:'hidden',
        boxShadow:'0 4px 20px #0001', border:'1.5px solid #f0ebe3' }}>
        {/* Hero */}
        <div style={{ height:280, background:'linear-gradient(135deg,#fff5f0,#fef9f4)',
          display:'flex', alignItems:'center', justifyContent:'center',
          position:'relative', overflow:'hidden' }}>
          {t.image_url
            ? <img src={t.image_url} alt={t.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            : <div style={{ textAlign:'center', opacity:.4 }}><TomatoPlaceholder size={120}/>
                <p style={{ margin:'8px 0 0', fontSize:13 }}>Kein Bild vorhanden</p></div>}
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,#0007 0%,transparent 50%)' }}/>
          <div style={{ position:'absolute', bottom:20, left:28, color:'#fff' }}>
            <h1 style={{ margin:0, fontSize:36, fontWeight:600, textShadow:'0 2px 8px #0005' }}>{t.name}</h1>
            <p style={{ margin:'4px 0 0', opacity:.85, fontSize:15 }}>{t.type} · {t.color} · {t.year}</p>
          </div>
          {canEdit && (
            <div style={{ position:'absolute', top:16, right:16, display:'flex', gap:8 }}>
              <button onClick={()=>onEdit(t)} style={actionBtn('#1a3a24')}>✏️ Bearbeiten</button>
              {!delConfirm
                ? <button onClick={()=>setDelConfirm(true)} style={actionBtn('#c0392b')}>🗑 Löschen</button>
                : <>
                    <button onClick={()=>onDelete(t.id)} style={actionBtn('#c0392b')}>Ja, löschen</button>
                    <button onClick={()=>setDelConfirm(false)} style={actionBtn('#555')}>Abbrechen</button>
                  </>}
            </div>
          )}
        </div>
        {/* Body */}
        <div style={{ padding:'32px 36px', display:'grid',
          gridTemplateColumns:'1fr 1fr', gap:'28px 48px' }}>
          <Sec title="Geschmack">
            <Stars value={t.taste} readonly/>
            <p style={desc}>{t.taste_notes}</p>
          </Sec>
          <Sec title="Herkunft">
            <p style={desc}>Quelle: {t.source||'–'}</p>
            <p style={desc}>Eingetragen von: <strong>{t.profiles?.name||'–'}</strong></p>
            <p style={desc}>Datum: {t.created_at?.slice(0,10)||'–'}</p>
          </Sec>
          <Sec title="Eigenschaften">
            <InfoRow l="Größe"    v={t.size}/>
            <InfoRow l="Farbe"    v={t.color}/>
            <InfoRow l="Typ"      v={t.type}/>
            <InfoRow l="Ertrag"   v={'★'.repeat(t.harvest_rating||0)+'☆'.repeat(5-(t.harvest_rating||0))}/>
            <InfoRow l="Standort" v={t.location}/>
          </Sec>
          <Sec title="Kultivierung">
            <InfoRow l="Keimung"  v={t.germination_days ? `${t.germination_days} Tage` : '–'}/>
            <InfoRow l="Reife"    v={t.harvest_days     ? `${t.harvest_days} Tage`     : '–'}/>
            <InfoRow l="Krankheiten" v={t.diseases||'–'}/>
          </Sec>
          <Sec title="Pflegehinweise" full>
            <p style={{ ...desc, background:'#faf6f0', borderRadius:10, padding:'12px 16px', lineHeight:1.7 }}>
              {t.care_notes||'Keine Hinweise eingetragen.'}
            </p>
          </Sec>
          <Sec title="Tags" full>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {(t.tags||[]).length ? (t.tags||[]).map(g=><Tag key={g} label={g}/>)
                : <span style={{ color:'#aaa', fontSize:13 }}>Keine Tags</span>}
            </div>
          </Sec>
        </div>
      </div>
    </div>
  )
}

const actionBtn = bg => ({
  background:bg+'cc', color:'#fff', border:'none', borderRadius:8,
  padding:'7px 14px', cursor:'pointer', fontSize:13, fontFamily:'inherit',
  backdropFilter:'blur(4px)',
})
const desc = { margin:'6px 0 0', color:'#444', lineHeight:1.65, fontSize:15 }

function Sec({ title, children, full }) {
  return (
    <div style={full?{gridColumn:'1/-1'}:{}}>
      <h3 style={{ margin:'0 0 10px', fontSize:13, letterSpacing:'1.5px', textTransform:'uppercase',
        color:'#e8520a', fontFamily:"'DM Mono', monospace", fontWeight:500 }}>{title}</h3>
      {children}
    </div>
  )
}

function InfoRow({ l, v }) {
  return (
    <div style={{ display:'flex', gap:8, marginBottom:4, fontSize:14 }}>
      <span style={{ color:'#888', minWidth:100 }}>{l}:</span>
      <span style={{ color:'#222' }}>{v}</span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// FORM VIEW
// ══════════════════════════════════════════════════════════════════════════
function FormView({ initial, onSave, onCancel }) {
  const [form,      setForm]      = useState(initial ? { ...initial } : { ...EMPTY_FORM })
  const [tagInput,  setTagInput]  = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [preview,   setPreview]   = useState(initial?.image_url || null)
  const fileRef = useRef()

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !(form.tags||[]).includes(t)) set('tags', [...(form.tags||[]), t])
    setTagInput('')
  }

  const handleImage = e => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const submit = () => {
    if (!form.name.trim()) { alert('Bitte einen Namen eingeben.'); return }
    onSave(form, imageFile)
  }

  return (
    <div style={{ maxWidth:760, margin:'0 auto' }}>
      <h2 style={{ margin:'0 0 24px', color:'#1a3a24', fontSize:26 }}>
        {form.id ? `✏️ ${form.name} bearbeiten` : '🌱 Neue Sorte eintragen'}
      </h2>
      <div style={{ background:'#fff', borderRadius:18, padding:'32px 36px',
        boxShadow:'0 4px 20px #0001', border:'1.5px solid #f0ebe3',
        display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px 32px' }}>

        <FF label="Sortenname *"><input value={form.name} onChange={e=>set('name',e.target.value)} style={inputStyle} placeholder="z.B. Ochsenherz"/></FF>
        <FF label="Erntejahr"><input type="number" value={form.year} onChange={e=>set('year',+e.target.value)} style={inputStyle}/></FF>
        <FF label="Quelle / Herkunft" full><input value={form.source} onChange={e=>set('source',e.target.value)} style={inputStyle} placeholder="Nachbar, Markt, Samentausch…"/></FF>
        <FF label="Typ"><select value={form.type} onChange={e=>set('type',e.target.value)} style={{...inputStyle,background:'#faf6f0'}}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></FF>
        <FF label="Farbe"><select value={form.color} onChange={e=>set('color',e.target.value)} style={{...inputStyle,background:'#faf6f0'}}>{COLORS.map(c=><option key={c}>{c}</option>)}</select></FF>
        <FF label="Größe"><select value={form.size} onChange={e=>set('size',e.target.value)} style={{...inputStyle,background:'#faf6f0'}}>{SIZES.map(s=><option key={s}>{s}</option>)}</select></FF>
        <FF label="Standort"><select value={form.location} onChange={e=>set('location',e.target.value)} style={{...inputStyle,background:'#faf6f0'}}>{LOCS.map(l=><option key={l}>{l}</option>)}</select></FF>
        <FF label={`Geschmack (${form.taste}/5)`}><Stars value={form.taste} onChange={v=>set('taste',v)}/></FF>
        <FF label="Geschmacksbeschreibung" full><textarea value={form.taste_notes} onChange={e=>set('taste_notes',e.target.value)} rows={3} style={{...inputStyle,resize:'vertical'}} placeholder="Aromatisch, süßlich, wenig Säure…"/></FF>
        <FF label={`Ertrag (${form.harvest_rating}/5)`}><Stars value={form.harvest_rating} onChange={v=>set('harvest_rating',v)}/></FF>
        <FF label="Keimung (Tage)"><input type="number" value={form.germination_days} onChange={e=>set('germination_days',+e.target.value)} style={inputStyle}/></FF>
        <FF label="Reife ab Pflanzung (Tage)"><input type="number" value={form.harvest_days} onChange={e=>set('harvest_days',+e.target.value)} style={inputStyle}/></FF>
        <FF label="Pflegehinweise" full><textarea value={form.care_notes} onChange={e=>set('care_notes',e.target.value)} rows={4} style={{...inputStyle,resize:'vertical'}} placeholder="Ausgeizen, Bewässerung, Düngung…"/></FF>
        <FF label="Krankheiten / Resistenzen" full><input value={form.diseases} onChange={e=>set('diseases',e.target.value)} style={inputStyle} placeholder="z.B. Krautfäuleresistent…"/></FF>

        <FF label="Tags" full>
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <input value={tagInput} onChange={e=>setTagInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&addTag()}
              style={{...inputStyle,flex:1}} placeholder="Tag tippen + Enter"/>
            <button onClick={addTag} style={{ background:'#1a3a24', color:'#fff', border:'none',
              borderRadius:9, padding:'0 16px', cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>
              + Tag
            </button>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {(form.tags||[]).map(g=><Tag key={g} label={g} onRemove={()=>set('tags',(form.tags||[]).filter(t=>t!==g))}/>)}
          </div>
        </FF>

        <FF label="Foto hochladen" full>
          <div style={{ border:'2px dashed #ddd', borderRadius:12, padding:'20px',
            textAlign:'center', cursor:'pointer', background:'#faf6f0' }}
            onClick={()=>fileRef.current.click()}>
            {preview
              ? <img src={preview} alt="Vorschau" style={{ maxHeight:180, borderRadius:8, objectFit:'cover' }}/>
              : <div style={{ color:'#aaa' }}>
                  <div style={{ fontSize:32 }}>📷</div>
                  <p style={{ margin:'8px 0 0', fontSize:14 }}>Klicken zum Hochladen (JPG, PNG)</p>
                </div>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display:'none' }}/>
        </FF>

        <div style={{ gridColumn:'1/-1', display:'flex', gap:12, justifyContent:'flex-end', paddingTop:8 }}>
          <button onClick={onCancel} style={{ background:'#eee', border:'none', borderRadius:10,
            padding:'11px 24px', cursor:'pointer', fontFamily:'inherit', fontSize:15 }}>Abbrechen</button>
          <button onClick={submit} style={{ background:'#e8520a', color:'#fff', border:'none',
            borderRadius:10, padding:'11px 28px', cursor:'pointer', fontFamily:'inherit',
            fontSize:15, fontWeight:600 }}>💾 Speichern</button>
        </div>
      </div>
    </div>
  )
}

function FF({ label, children, full }) {
  return (
    <div style={full?{gridColumn:'1/-1'}:{}}>
      <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#555',
        marginBottom:6 }}>{label}</label>
      {children}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// ADMIN VIEW  - Nutzer einsehen, Rollen ändern, User bestätigen
// ══════════════════════════════════════════════════════════════════════════
function AdminView({ showToast }) {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)

  const loadUsers = async () => {
    const { data: profiles } = await supabase
      .from('profiles').select('*').order('created_at', { ascending: true })
    const { data: authInfo } = await supabase.rpc('get_users_confirmed_status')
    const confirmedMap = {}
    ;(authInfo||[]).forEach(u => { confirmedMap[u.id] = u.confirmed })
    setUsers((profiles||[]).map(u => ({ ...u, confirmed: confirmedMap[u.id] ?? true })))
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const toggleRole = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)
    if (error) { showToast('Fehler: ' + error.message, 'err'); return }
    setUsers(prev => prev.map(u => u.id===user.id ? {...u, role:newRole} : u))
    showToast(`${user.name} ist jetzt ${newRole}`)
  }

  const confirmUser = async (user) => {
    const { error } = await supabase.rpc('confirm_user_by_id', { target_user_id: user.id })
    if (error) { showToast('Fehler: ' + error.message, 'err'); return }
    setUsers(prev => prev.map(u => u.id===user.id ? {...u, confirmed:true} : u))
    showToast(`${user.name||user.email} wurde bestätigt ✓`)
  }

  return (
    <div style={{ maxWidth:700, margin:'0 auto' }}>
      <h2 style={{ color:'#1a3a24', marginBottom:24 }}>👥 Nutzerverwaltung</h2>
      <div style={{ background:'#fff', borderRadius:16, padding:'24px 28px',
        boxShadow:'0 2px 12px #0001', border:'1.5px solid #f0ebe3' }}>
        {loading ? <p style={{ color:'#aaa' }}>Lade…</p> : users.map(u => (
          <div key={u.id} style={{ display:'flex', alignItems:'center', padding:'14px 0',
            borderBottom:'1px solid #f0ebe3', gap:8, flexWrap:'wrap' }}>
            <div style={{ width:38, height:38, borderRadius:'50%',
              background: u.confirmed ? '#1a3a24' : '#aaa',
              color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
              fontWeight:600, marginRight:6, fontSize:16, flexShrink:0 }}>
              {(u.name||u.email)[0].toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:120 }}>
              <div style={{ fontWeight:600 }}>{u.name||'–'}</div>
              <div style={{ fontSize:13, color:'#888' }}>{u.email}</div>
            </div>
            <span style={{ fontSize:11, borderRadius:20, padding:'3px 10px',
              background: u.confirmed ? '#e8f5e9' : '#fff3e0',
              color: u.confirmed ? '#2e6b3e' : '#e65100' }}>
              {u.confirmed ? '✓ bestätigt' : '⏳ unbestätigt'}
            </span>
            <span style={{ fontSize:11, background: u.role==='admin'?'#1a3a24':'#eee',
              color: u.role==='admin'?'#fff':'#555', borderRadius:20,
              padding:'3px 10px' }}>{u.role}</span>
            {!u.confirmed && (
              <button onClick={()=>confirmUser(u)} style={{ background:'#e8520a', color:'#fff',
                border:'none', borderRadius:7, padding:'5px 12px',
                cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>
                ✓ Bestätigen
              </button>
            )}
            <button onClick={()=>toggleRole(u)} style={{ background:'none',
              border:'1px solid #e0d6cc', borderRadius:7, padding:'5px 12px',
              cursor:'pointer', fontSize:12, fontFamily:'inherit', color:'#555' }}>
              {u.role==='admin' ? 'zu Nutzer' : 'zu Admin'}
            </button>
          </div>
        ))}
      </div>
      <p style={{ marginTop:16, fontSize:13, color:'#aaa', lineHeight:1.6 }}>
        Unbestätigte Nutzer können sich nicht anmelden. Klicke "Bestätigen" um sie freizuschalten.
      </p>
    </div>
  )
}
