import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Activity, Award, CalendarCheck, Camera, CircleDollarSign, ClipboardList, Dumbbell, Image, LogIn, LogOut, MapPin, Menu, Phone, Plus, ShieldCheck, Trophy, Users, Video, X } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const academyDefaults = {
  name: 'Prayagam Basketball Academy',
  location: '53 Anukool Chandra, Collenganj Intermediate College, Opposite Phoenix Hospital, Colonelganj, Prayagraj, Uttar Pradesh - 211002.',
  coach: 'Saurabh Kumar',
  phone: '+91 63078 25498',
  timings: 'Add training days and timings from the coach portal.',
  logo_url: ''
};

const sections = [
  ['overview', 'Overview', Activity], ['players', 'Players', Users], ['attendance', 'Attendance', CalendarCheck],
  ['tournaments', 'Tournaments', Trophy], ['stats', 'Player stats', ClipboardList],
  ['fees', 'Fees', CircleDollarSign], ['seniors', 'Hall of fame', Award], ['gallery', 'Gallery', Camera]
];

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [academy, setAcademy] = useState(academyDefaults);
  const [active, setActive] = useState('overview');
  const [players, setPlayers] = useState([]);
  const [records, setRecords] = useState({attendance: [], tournaments: [], fees: [], gallery: [], seniors: []});
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const isCoach = profile?.role === 'coach';
  const isPlayer = profile?.role === 'player';

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    loadPublicData();
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const {data: listener} = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) { setProfile(null); setLoading(false); return; }
    loadAll();
  }, [session]);

  async function loadPublicData() {
    const [a, pl, at, ga, se, to] = await Promise.all([
      supabase.from('academy_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('public_player_directory').select('id,name,photo_url').order('name'),
      supabase.from('public_attendance_directory').select('*').order('session_date', {ascending:false}).limit(100),
      supabase.from('gallery').select('*').order('created_at', {ascending:false}),
      supabase.from('seniors').select('*').order('sort_order'),
      supabase.from('tournaments').select('*').order('event_date', {ascending:false})
    ]);
    if (a.data) setAcademy({...academyDefaults, ...a.data});
    const publicPlayers = pl.data || [];
    setPlayers(publicPlayers);
    const attendanceWithNames = (at.data || []).map(row => ({...row, players:{name:row.player_name || 'Player'}}));
    setRecords(prev => ({...prev, attendance:attendanceWithNames, gallery:ga.data||[], seniors:se.data||[], tournaments:to.data||[]}));
  }

  async function loadAll() {
    setLoading(true);
    const uid = session.user.id;
    const [p, a, pl, at, to, fe, ga, se] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('academy_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('players').select('*').order('name'),
      supabase.from('attendance').select('*, players(name)').order('session_date', {ascending:false}).limit(250),
      supabase.from('tournaments').select('*').order('event_date', {ascending:false}),
      supabase.from('fees').select('*, players(name)').order('month', {ascending:false}).limit(250),
      supabase.from('gallery').select('*').order('created_at', {ascending:false}),
      supabase.from('seniors').select('*').order('sort_order')
    ]);
    if (p.data) setProfile(p.data);
    if (a.data) setAcademy({...academyDefaults, ...a.data});
    setPlayers(pl.data || []);
    setRecords({attendance:at.data||[], tournaments:to.data||[], fees:fe.data||[], gallery:ga.data||[], seniors:se.data||[]});
    setLoading(false);
  }

  async function signIn(email, password) {
    setBusy(true); setNotice('');
    const {error} = await supabase.auth.signInWithPassword({email, password});
    setBusy(false);
    if (error) setNotice(error.message);
    else setLoginOpen(false);
  }
  async function signOut() { await supabase.auth.signOut(); setProfile(null); setActive('overview'); }

  async function saveAcademy(e) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries());
    const {error} = await supabase.from('academy_settings').upsert({id:1, ...data});
    setNotice(error ? error.message : 'Academy information updated.');
    if (!error) setAcademy({...academy, ...data});
  }

  async function addRow(table, payload) {
    const {error} = await supabase.from(table).insert(payload);
    setNotice(error ? error.message : 'Saved successfully.');
    if (!error) loadAll();
  }
  async function deleteRow(table, id) {
    if (!confirm('Delete this record?')) return;
    const {error} = await supabase.from(table).delete().eq('id', id);
    setNotice(error ? error.message : 'Record deleted.');
    if (!error) loadAll();
  }
  async function uploadFile(file, bucket='academy-media') {
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const {error} = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  const ownPlayer = useMemo(() => players.find(p => p.id === profile?.player_id), [players, profile]);
  const visibleAttendance = isPlayer ? records.attendance.filter(r => r.player_id === profile?.player_id) : records.attendance;
  const visibleFees = isPlayer ? records.fees.filter(r => r.player_id === profile?.player_id) : records.fees;

  if (!supabase) return <SetupScreen />;
  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={()=>setActive('overview')}>
        <div className="brand-mark">{academy.logo_url ? <img src={academy.logo_url} /> : <Dumbbell size={25}/>}</div>
        <span><b>PRAYAGAM</b><small>BASKETBALL ACADEMY</small></span>
      </a>
      <button className="mobile-menu" onClick={()=>setMobileNav(!mobileNav)}><Menu/></button>
      <nav className={mobileNav?'nav open':'nav'}>
        <button onClick={()=>{setActive('overview');setMobileNav(false)}}>Home</button>
        <button onClick={()=>{setActive('players');setMobileNav(false)}}>Players</button>
        <button onClick={()=>{setActive('tournaments');setMobileNav(false)}}>Tournaments</button>
        <a href="#players-public">Players</a>
        <a href="#senior-public">Seniors</a>
        <a href="#gallery-public">Gallery</a>
        <a href="#players-public">Attendance</a>
        <button className="login-btn" onClick={()=>session?signOut():setLoginOpen(true)}>{session?<><LogOut size={16}/> Sign out</>:<><LogIn size={16}/> Portal login</>}</button>
      </nav>
    </header>

    {!session ? <PublicHome academy={academy} players={players} records={records} onLogin={()=>setLoginOpen(true)} active={active} setActive={setActive}/> :
      <div className="portal-layout">
        <aside className={mobileNav?'sidebar show':'sidebar'}>
          <div className="portal-label"><ShieldCheck size={16}/> {isCoach?'COACH ADMIN':'PLAYER PORTAL'}</div>
          <div className="user-mini"><div className="avatar">{(profile?.display_name||session.user.email||'P')[0].toUpperCase()}</div><div><b>{profile?.display_name||'Academy member'}</b><small>{isCoach?'Administrator':'Player'}</small></div></div>
          {sections.map(([id,label,Icon])=><button key={id} className={active===id?'side-link selected':'side-link'} onClick={()=>{setActive(id);setMobileNav(false)}}><Icon size={18}/>{label}</button>)}
          {isCoach&&<button className={active==='settings'?'side-link selected':'side-link'} onClick={()=>setActive('settings')}><ShieldCheck size={18}/> Academy settings</button>}
          <button className="side-link signout" onClick={signOut}><LogOut size={18}/> Sign out</button>
        </aside>
        <main className="portal-main">
          <div className="page-heading"><div><span className="eyebrow">PRAYAGAM / {isCoach?'ADMINISTRATION':'PLAYER SPACE'}</span><h1>{sections.find(s=>s[0]===active)?.[1] || 'Academy settings'}</h1></div><span className="role-pill">{isCoach?'COACH ADMIN':'PLAYER'}</span></div>
          {notice&&<div className="notice" onClick={()=>setNotice('')}>{notice}<X size={15}/></div>}
          {loading?<div className="empty">Loading academy records…</div>:<PortalContent {...{active,isCoach,players,records,academy,ownPlayer,visibleAttendance,visibleFees,addRow,deleteRow,saveAcademy,uploadFile,loadAll,profile}}/>}
        </main>
      </div>}
    <footer className="footer"><div><b>PRAYAGAM BASKETBALL ACADEMY</b><p>Train hard. Play smart. Rise together.</p></div><span>© {new Date().getFullYear()} Prayagam Basketball Academy</span></footer>
    {loginOpen&&<LoginModal onClose={()=>setLoginOpen(false)} onLogin={signIn} busy={busy} notice={notice}/>}
  </div>;
}

function SetupScreen(){return <div className="setup"><div className="brand-mark"><Dumbbell/></div><h1>Connect your academy database</h1><p>Add your Supabase project URL and anon key to a <code>.env</code> file. Follow the README included with this project, then restart the development server.</p><code>VITE_SUPABASE_URL=…<br/>VITE_SUPABASE_ANON_KEY=…</code></div>}

function LoginModal({onClose,onLogin,busy,notice}) {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
  return <div className="modal-backdrop"><form className="login-modal" onSubmit={e=>{e.preventDefault();onLogin(email,password)}}><button type="button" className="close" onClick={onClose}><X/></button><span className="eyebrow">MEMBERS ONLY</span><h2>Academy portal</h2><p>Sign in with the account provided by your coach.</p><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>{notice&&<p className="error">{notice}</p>}<button className="primary wide" disabled={busy}>{busy?'Signing in…':'Sign in securely'}</button><small>Players and coaches use the same secure sign-in page. Your account role determines your access.</small></form></div>
}

function PublicHome({academy,players,records,onLogin,active,setActive}) {
  return <main>
    <section className="hero"><div className="hero-copy"><span className="eyebrow">PRAYAGRAJ • UTTAR PRADESH</span><h1>BUILT ON<br/><em>HARD WORK.</em><br/>UNITED BY<br/>BASKETBALL.</h1><p>Developing skill, discipline and confidence — one practice, one player, one game at a time.</p><div className="hero-actions"><button className="primary" onClick={onLogin}>Member portal <LogIn size={17}/></button><a className="outline-btn" href="#academy">Explore academy</a></div></div><div className="hero-art"><div className="court-circle"></div><div className="ball">🏀</div><div className="hero-stamp">PLAY<br/>WITH<br/>PURPOSE</div><div className="hero-number">01</div></div><div className="hero-bottom">DISCIPLINE <b>×</b> TEAMWORK <b>×</b> EXCELLENCE</div></section>
    <section className="stats-strip"><div><strong>{players.length||'70+'}</strong><span>PLAYER ROSTER</span></div><div><strong>{records.tournaments.length}</strong><span>TOURNAMENTS</span></div><div><strong>01</strong><span>TEAM • ONE FAMILY</span></div><div><strong>100%</strong><span>COMMITMENT</span></div></section>
    <section className="section" id="academy"><div className="section-intro"><span className="eyebrow">WHO WE ARE</span><h2>MORE THAN<br/><em>A GAME.</em></h2></div><div className="academy-copy"><p className="lead">At Prayagam Basketball Academy, we believe basketball builds more than athletes. It builds character, resilience and a team-first mindset.</p><p>Our academy is a place to learn the fundamentals, sharpen competitive skills and grow together on and off the court.</p><div className="info-grid"><Info icon={<MapPin/>} title="Find us" value={academy.location}/><Info icon={<Phone/>} title="Contact" value={`${academy.coach} · ${academy.phone}`}/><Info icon={<CalendarCheck/>} title="Training schedule" value={academy.timings}/></div></div></section>
    <section className="dark-band"><span className="eyebrow">THE ACADEMY STANDARD</span><h2>SHOW UP. PUT IN THE WORK.<br/><em>GET BETTER EVERY DAY.</em></h2><button className="primary" onClick={onLogin}>Player & coach login <LogIn size={16}/></button></section>
    <section className="section compact" id="players-public"><div><span className="eyebrow">MEET THE TEAM</span><h2>PLAYER <em>DIRECTORY</em></h2><p className="public-note">Public directory shows player names and photos only. Personal details remain inside the member portal.</p></div><div className="public-player-grid">{players.map(p=><div className="public-player" key={p.id}>{p.photo_url?<img src={p.photo_url}/>:<div className="public-player-placeholder"><Users/></div>}<b>{p.name}</b></div>)}</div></section>
    <section className="section compact public-attendance"><div><span className="eyebrow">SHOWING UP TOGETHER</span><h2>DAILY <em>ATTENDANCE</em></h2><p className="public-note">Attendance records are publicly visible as requested by the academy.</p></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Player</th><th>Status</th></tr></thead><tbody>{records.attendance.slice(0,30).map(r=><tr key={r.id}><td>{r.session_date}</td><td>{r.players?.name||'Player'}</td><td><span className={`status ${r.status?.toLowerCase()}`}>{r.status}</span></td></tr>)}</tbody></table></div></section>
    <section className="section compact" id="senior-public"><div><span className="eyebrow">RESPECT THE LEGACY</span><h2>HALL OF <em>FAME</em></h2></div><div className="senior-grid">{records.seniors.map(r=><div className="senior-card" key={r.id}>{r.photo_url?<img src={r.photo_url}/>:<div className="senior-placeholder"><Award/></div>}<div><span className="eyebrow">ACADEMY LEGACY</span><h3>{r.name}</h3><p>{r.batch||''}</p><p>{r.achievement||''}</p></div></div>)}</div></section>
    <section className="section compact" id="gallery-public"><div><span className="eyebrow">ACADEMY MOMENTS</span><h2>PHOTO & <em>VIDEO GALLERY</em></h2></div><div className="gallery-grid">{records.gallery.map(r=><div className="gallery-item" key={r.id}>{r.media_type==='video'?<video src={r.media_url} controls/>:<img src={r.media_url}/>}<div><span>{r.title}</span></div></div>)}</div></section>
    <section className="section compact"><div><span className="eyebrow">ON THE COURT</span><h2>OUR <em>COMMUNITY</em></h2></div><div className="public-cards"><div><Users/><b>Player development</b><p>Track player profiles, progress and team records.</p></div><div><Trophy/><b>Competition</b><p>Follow tournaments, results and academy milestones.</p></div><div><Award/><b>Legacy</b><p>Recognising the senior players who lead by example.</p></div></div></section>
  </main>
}
function Info({icon,title,value}){return <div className="info-item"><span>{icon}</span><div><b>{title}</b><p>{value||'To be updated by academy coach.'}</p></div></div>}

function PortalContent({active,isCoach,players,records,academy,ownPlayer,visibleAttendance,visibleFees,addRow,deleteRow,saveAcademy,uploadFile,loadAll,profile}) {
  if(active==='overview') return <><div className="welcome-card"><span className="eyebrow">WELCOME TO THE TEAM</span><h2>{isCoach?'Manage the academy.':'Keep pushing forward.'}</h2><p>{isCoach?'Your central space for player records, training, finance and academy updates.':'Your academy information and player records are available here.'}</p></div><div className="metric-grid"><Metric label="Registered players" value={players.length}/><Metric label="Attendance records" value={records.attendance.length}/><Metric label="Tournaments" value={records.tournaments.length}/><Metric label="Gallery uploads" value={records.gallery.length}/></div>{!isCoach&&ownPlayer&&<PlayerCard player={ownPlayer}/>}<h3 className="subheading">Academy information</h3><div className="panel"><Info icon={<MapPin/>} title="Location" value={academy.location}/><Info icon={<Phone/>} title="Head coach" value={`${academy.coach} · ${academy.phone}`}/><Info icon={<CalendarCheck/>} title="Timings" value={academy.timings}/></div></>;
  if(active==='players') return <><SectionHeader title="Player directory" desc="Official academy roster. Only coaches can change player records."/><PlayerManager {...{players,isCoach,addRow,deleteRow,uploadFile}}/></>;
  if(active==='stats') return <><SectionHeader title="Player statistics" desc="Player profile, height, date of birth and basketball details."/><div className="table-wrap"><table><thead><tr><th>Player</th><th>DOB</th><th>Height</th><th>Position</th><th>Jersey</th></tr></thead><tbody>{players.map(p=><tr key={p.id}><td><b>{p.name}</b></td><td>{p.dob||'—'}</td><td>{p.height||'—'}</td><td>{p.position||'—'}</td><td>{p.jersey_number||'—'}</td></tr>)}</tbody></table></div></>;
  if(active==='attendance') return <><SectionHeader title="Daily attendance" desc="Attendance register for academy training sessions."/><AttendanceManager {...{players,records:visibleAttendance,isCoach,addRow,deleteRow,profile}}/></>;
  if(active==='tournaments') return <><SectionHeader title="Tournament tracker" desc="Upcoming fixtures, participation and results."/><TournamentManager {...{records:records.tournaments,isCoach,addRow,deleteRow}}/></>;
  if(active==='fees') return <><SectionHeader title="Monthly fee records" desc="Monthly fee submissions and payment status."/><FeesManager {...{players,records:visibleFees,isCoach,addRow,deleteRow,profile}}/></>;
  if(active==='seniors') return <><SectionHeader title="Hall of fame" desc="Honouring the senior players who helped shape our academy."/><SeniorManager {...{records:records.seniors,isCoach,addRow,deleteRow,uploadFile}}/></>;
  if(active==='gallery') return <><SectionHeader title="Academy gallery" desc="Moments from training sessions, matches and team life."/><GalleryManager {...{records:records.gallery,isCoach,addRow,deleteRow,uploadFile}}/></>;
  if(active==='settings'&&isCoach) return <><SectionHeader title="Academy settings" desc="Update the public academy details and branding."/><form className="panel form-grid" onSubmit={saveAcademy}><Field label="Academy name" name="name" value={academy.name}/><Field label="Head coach" name="coach" value={academy.coach}/><Field label="Phone number" name="phone" value={academy.phone}/><Field label="Training timings" name="timings" value={academy.timings}/><label className="full">Full location<textarea name="location" defaultValue={academy.location}/></label><label className="full">Academy logo URL<input name="logo_url" defaultValue={academy.logo_url}/></label><button className="primary">Save academy details</button></form><UploadControl label="Upload a new academy logo or photo" accept="image/*" onUpload={async file=>{const url=await uploadFile(file);const {error}=await window.__supabase.from('academy_settings').upsert({id:1,logo_url:url});if(error)throw error;alert('Logo uploaded. Refresh the page to see it.')}}/></>;
  return <div className="empty">Choose a section from the menu.</div>;
}
function SectionHeader({title,desc}){return <div className="section-header"><p>{desc}</p></div>}
function Metric({label,value}){return <div className="metric"><span>{label}</span><b>{value}</b></div>}
function PlayerCard({player}){return <div className="panel own-card"><div className="avatar big">{player.name?.[0]}</div><div><span className="eyebrow">YOUR PLAYER PROFILE</span><h3>{player.name}</h3><p>{player.position||'Player'} · {player.height||'Height not added'} · #{player.jersey_number||'—'}</p></div></div>}
function Field({label,name,value}){return <label>{label}<input name={name} defaultValue={value||''}/></label>}
function PlayerManager({ players, isCoach, addRow, deleteRow, uploadFile }) {
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const emptyForm = {
    name: '',
    dob: '',
    height: '',
    position: '',
    jersey_number: '',
    phone: '',
    photo_url: ''
  };

  const [data, setData] = useState(emptyForm);

  function updateField(e) {
    setData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  }

  function startAdd() {
    setEditing(null);
    setData(emptyForm);
    setError('');
    setForm(true);
  }

  function startEdit(player) {
    setEditing(player);
    setData({
      name: player.name || '',
      dob: player.dob || '',
      height: player.height || '',
      position: player.position || '',
      jersey_number: player.jersey_number || '',
      phone: player.phone || '',
      photo_url: player.photo_url || ''
    });
    setError('');
    setForm(true);
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be smaller than 5 MB.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const url = await uploadFile(file);
      setData(prev => ({ ...prev, photo_url: url }));
    } catch (err) {
      setError(err.message || 'Photo upload failed.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function savePlayer(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const payload = {
        ...data,
        name: data.name.trim(),
        dob: data.dob || null,
        height: data.height.trim() || null,
        position: data.position.trim() || null,
        jersey_number: data.jersey_number.trim() || null,
        phone: data.phone.trim() || null,
        photo_url: data.photo_url || null
      };

      if (!payload.name) {
        throw new Error('Player name is required.');
      }

      if (editing) {
        const { error } = await window.__supabase
          .from('players')
          .update(payload)
          .eq('id', editing.id);

        if (error) throw error;
      } else {
        const { error } = await window.__supabase
          .from('players')
          .insert(payload);

        if (error) throw error;
      }

      setForm(false);
      setEditing(null);
      setData(emptyForm);

      await window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not save player.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="toolbar">
        <span>{players.length} registered players</span>

        {isCoach && (
          <button className="primary small" onClick={startAdd}>
            <Plus size={16} /> Add player
          </button>
        )}
      </div>

      {form && isCoach && (
        <form className="panel form-grid" onSubmit={savePlayer}>
          <h3 className="full">
            {editing ? 'Edit player details' : 'Register a new player'}
          </h3>

          <label>
            Full name
            <input
              name="name"
              value={data.name}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Date of birth
            <input
              name="dob"
              type="date"
              value={data.dob}
              onChange={updateField}
            />
          </label>

          <label>
            Height
            <input
              name="height"
              placeholder="e.g. 182 cm"
              value={data.height}
              onChange={updateField}
            />
          </label>

          <label>
            Position
            <select
              name="position"
              value={data.position}
              onChange={updateField}
            >
              <option value="">Select position</option>
              <option value="Point Guard">Point Guard</option>
              <option value="Shooting Guard">Shooting Guard</option>
              <option value="Small Forward">Small Forward</option>
              <option value="Power Forward">Power Forward</option>
              <option value="Center">Center</option>
              <option value="Guard">Guard</option>
              <option value="Forward">Forward</option>
            </select>
          </label>

          <label>
            Jersey number
            <input
              name="jersey_number"
              value={data.jersey_number}
              onChange={updateField}
            />
          </label>

          <label>
            Phone number
            <input
              name="phone"
              type="tel"
              value={data.phone}
              onChange={updateField}
            />
          </label>

          <div className="full">
            <label>
              Player photo
              <input
                type="file"
                accept="image/*"
                onChange={handlePhoto}
                disabled={busy}
              />
            </label>

            {data.photo_url && (
              <div style={{ marginTop: 12 }}>
                <img
                  src={data.photo_url}
                  alt="Player preview"
                  style={{
                    width: 110,
                    height: 110,
                    objectFit: 'cover',
                    borderRadius: 8
                  }}
                />
              </div>
            )}
          </div>

          {error && <p className="error full">{error}</p>}

          <div className="full" style={{ display: 'flex', gap: 10 }}>
            <button className="primary" disabled={busy}>
              {busy
                ? 'Saving...'
                : editing
                  ? 'Update player'
                  : 'Save player'}
            </button>

            <button
              type="button"
              className="outline-btn"
              onClick={() => setForm(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="player-grid">
        {players.map(player => (
          <div className="player-tile" key={player.id}>
            <div className="player-photo">
              {player.photo_url ? (
                <img src={player.photo_url} alt={player.name} />
              ) : (
                <Users />
              )}
            </div>

            <div>
              <b>{player.name}</b>
              <small>
                {player.position || 'Player'} · {player.height || 'Height —'}
              </small>
              <small>
                DOB: {player.dob || '—'} · #{player.jersey_number || '—'}
              </small>
            </div>

            {isCoach && (
              <div style={{ display: 'flex', gap: 5 }}>
                <button
                  className="icon-btn"
                  title="Edit player"
                  onClick={() => startEdit(player)}
                >
                  Edit
                </button>

                <button
                  className="icon-btn"
                  title="Delete player"
                  onClick={() => deleteRow('players', player.id)}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
      }
          
