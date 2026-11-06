(() => {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
};
const PRICES = { '3d': { name: '3D nail art', one: 249, both: 449 }, custom: { name: '3D custom nail art', one: 299, both: 549 } };
const SLOTS = ['10:00 AM','11:00 AM','12:00 PM','01:00 PM','02:00 PM','03:00 PM','04:00 PM','05:00 PM','06:00 PM','07:00 PM'];
let session = store.get('session', null), loc = store.get('loc', null), b = {};

// SHA-256 so plain passwords are never stored (demo only; use a real server in production)
async function hash(t) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
  $('#userbar').hidden = !session;
}
function route() {
  if (!session) return show('auth');
  $('#who').textContent = session.name;
  if (!loc) return show('loc');
  openHome();
}

// Auth tabs
$$('.tab').forEach(t => t.onclick = () => {
  $$('.tab').forEach(x => x.classList.toggle('on', x === t));
  $('#loginForm').hidden = t.dataset.tab !== 'login';
  $('#signupForm').hidden = t.dataset.tab !== 'signup';
});
$('#signupForm').onsubmit = async e => {
  e.preventDefault();
  const email = $('#sEmail').value.trim().toLowerCase(), users = store.get('users', {});
  if ($('#sPass').value !== $('#sPass2').value) return $('#sErr').textContent = 'Passwords do not match.';
  if (users[email]) return $('#sErr').textContent = 'This email already has an account. Log in instead.';
  users[email] = { name: $('#sName').value.trim(), phone: $('#sPhone').value, email, pass: await hash($('#sPass').value) };
  store.set('users', users);
  session = { name: users[email].name, email, phone: users[email].phone };
  store.set('session', session); $('#sErr').textContent = ''; route();
};
$('#loginForm').onsubmit = async e => {
  e.preventDefault();
  const email = $('#lEmail').value.trim().toLowerCase(), u = store.get('users', {})[email];
  if (!u || u.pass !== await hash($('#lPass').value)) return $('#lErr').textContent = 'Email or password is incorrect.';
  session = { name: u.name, email, phone: u.phone };
  store.set('session', session); $('#lErr').textContent = ''; route();
};
$('#logout').onclick = () => { session = null; loc = null; localStorage.removeItem('session'); localStorage.removeItem('loc'); show('auth'); };

// Location
$('#locBtn').onclick = () => {
  const err = $('#locErr'); err.textContent = '';
  if (!navigator.geolocation) return err.textContent = 'Your browser does not support location.';
  $('#locBtn').textContent = 'Detecting…';
  navigator.geolocation.getCurrentPosition(async p => {
    const { latitude: lat, longitude: lng } = p.coords;
    let label = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    try { // optional: place name (needs internet)
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const j = await r.json(); const a = j.address || {};
      label = [a.suburb || a.neighbourhood || a.village, a.city || a.town || a.state_district, a.state].filter(Boolean).join(', ') || label;
    } catch {}
    loc = { lat, lng, label }; store.set('loc', loc);
    $('#locOk').hidden = false; $('#locOk').textContent = '✓ Location detected: ' + label;
    setTimeout(route, 900);
  }, e => {
    $('#locBtn').textContent = 'Turn on location';
    err.textContent = e.code === 1 ? 'Location is blocked. Allow it in your browser settings, then tap again.' : 'Could not detect your location. Please try again.';
  }, { enableHighAccuracy: true, timeout: 12000 });
};

// Home
function openHome() {
  $('#hi').textContent = 'Hi, ' + session.name.split(' ')[0];
  $('#where').textContent = '📍 ' + loc.label;
  const list = store.get('bookings', []).filter(x => x.email === session.email).reverse();
  $('#myBookings').innerHTML = list.length ? list.map(x =>
    `<div class="row"><span><b>${x.service}</b> · ${x.hands}</span><span>${x.when}</span><b>₹${x.total}</b></div>`).join('')
    : '<p class="empty">No bookings yet. Choose a design above to start.</p>';
  show('home');
}
$$('.svc').forEach(c => {
  c.onclick = () => openBook(c.dataset.svc);
  c.onmousemove = e => { const r = c.getBoundingClientRect();
    c.style.transform = `rotateY(${((e.clientX - r.left) / r.width - .5) * 14}deg) rotateX(${-((e.clientY - r.top) / r.height - .5) * 14}deg)`; };
  c.onmouseleave = () => c.style.transform = '';
});

// Booking
function openBook(svc) {
  b = { svc, hands: null, when: null, date: '', time: '' };
  const p = PRICES[svc];
  $('#bTitle').textContent = p.name;
  $('#handOpts').innerHTML = `<button class="opt" data-h="one"><b>Per hand</b><small>₹${p.one}</small></button><button class="opt" data-h="both"><b>Both hands</b><small>₹${p.both}</small></button>`;
  $('#uploadStep').hidden = svc !== 'custom';
  $('#preview').hidden = true; $('#photo').value = ''; $('#dropTxt').textContent = 'Tap to choose a photo';
  $('#schedStep').hidden = true; $('#bErr').textContent = '';
  $$('#whenOpts .opt').forEach(o => o.classList.remove('on'));
  const d = $('#date'), t = new Date(); d.min = t.toISOString().slice(0, 10); d.value = '';
  $('#slots').innerHTML = ''; updateTotal(); show('book');
}
$('#handOpts').onclick = e => { const o = e.target.closest('.opt'); if (!o) return;
  b.hands = o.dataset.h; $$('#handOpts .opt').forEach(x => x.classList.toggle('on', x === o)); updateTotal(); };
$('#whenOpts').onclick = e => { const o = e.target.closest('.opt'); if (!o) return;
  b.when = o.dataset.when; $$('#whenOpts .opt').forEach(x => x.classList.toggle('on', x === o));
  $('#schedStep').hidden = b.when !== 'schedule'; };
$('#date').onchange = e => {
  b.date = e.target.value; b.time = '';
  const taken = store.get('bookings', []).filter(x => x.date === b.date).map(x => x.time);
  const today = b.date === new Date().toISOString().slice(0, 10), now = new Date();
  $('#slots').innerHTML = SLOTS.map(s => {
    const [h, m, ap] = s.match(/(\d+):(\d+) (AM|PM)/).slice(1); let hr = +h % 12 + (ap === 'PM' ? 12 : 0);
    const past = today && (hr < now.getHours() + 1);
    return `<button class="slot" data-t="${s}" ${taken.includes(s) || past ? 'disabled' : ''}>${s}</button>`; }).join('');
};
$('#slots').onclick = e => { const s = e.target.closest('.slot'); if (!s || s.disabled) return;
  b.time = s.dataset.t; $$('.slot').forEach(x => x.classList.toggle('on', x === s)); };
$('#photo').onchange = e => { const f = e.target.files[0]; if (!f) return;
  b.photo = f.name; $('#dropTxt').textContent = f.name;
  const img = $('#preview'); img.src = URL.createObjectURL(f); img.hidden = false; };
const price = () => b.hands ? PRICES[b.svc][b.hands] : 0;
function updateTotal() { $('#total').textContent = '₹' + price(); }
$('#back').onclick = () => openHome();
$('#confirm').onclick = () => {
  const err = $('#bErr');
  if (!b.hands) return err.textContent = 'Choose one hand or both hands.';
  if (b.svc === 'custom' && !$('#photo').files[0]) return err.textContent = 'Upload the photo you want on your nails.';
  if (!b.when) return err.textContent = 'Choose Instant or Schedule.';
  if (b.when === 'schedule' && (!b.date || !b.time)) return err.textContent = 'Pick a date and a time slot.';
  const when = b.when === 'instant' ? 'Instant' : `${b.date} · ${b.time}`;
  const rec = { email: session.email, service: PRICES[b.svc].name, hands: b.hands === 'one' ? 'Per hand' : 'Both hands',
    when, date: b.when === 'schedule' ? b.date : '', time: b.when === 'schedule' ? b.time : '', total: price(), location: loc.label, photo: b.photo || '' };
  const all = store.get('bookings', []); all.push(rec); store.set('bookings', all);
  $('#doneTxt').textContent = `${rec.service} · ${rec.hands} · ${when} · ₹${rec.total}. Our artist will visit ${loc.label}.`;
  show('done');
};
$('#toHome').onclick = openHome;
route();
})();
