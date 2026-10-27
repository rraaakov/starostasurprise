const routes = {
  dashboard:{title:'Главная',idx:0}, students:{title:'Студенты',idx:1}, schedule:{title:'Расписание',idx:2}, calendar:{title:'Календарь',idx:3}, more:{title:'Ещё',idx:4},
  tasks:{title:'Задачи',idx:-1}, funds:{title:'Взносы',idx:-1}, settings:{title:'Настройки',idx:-1}, notes:{title:'Заметки',idx:-1}, stats:{title:'Статистика',idx:-1},
};
const STATUS_LABELS={ACTIVE:'Активен',ACADEMIC:'Академический',EXPELLED:'Отчислен'};
const EVENT_TYPE_LABELS={EXAM:'Экзамен',CREDIT:'Зачёт',DEADLINE:'Дедлайн',MEETING:'Собрание',OTHER:'Другое'};
const PRIORITY_LABELS={HIGH:'Высокий',NORMAL:'Обычный',LOW:'Низкий'};
const ROLE_LABELS={none:'',starosta:'Староста',deputy:'Зам',brigadier:'Бригадир'};
const DAYS=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
const ACHIEVEMENTS = [
  {id:'first_student',name:'Первый пошёл',desc:'Добавил первого студента',icon:'🎓'},
  {id:'ten_students',name:'Группа в сборе',desc:'10 студентов',icon:'👥'},
  {id:'first_event',name:'Планировщик',desc:'Первое событие',icon:'📅'},
  {id:'first_task',name:'Дедлайн-киллер',desc:'Первая задача',icon:'✅'},
  {id:'task_master',name:'Мастер задач',desc:'10 задач выполнено',icon:'🏆'},
  {id:'backup',name:'Архивариус',desc:'Первый бэкап',icon:'💾'},
  {id:'night_owl',name:'Ночной староста',desc:'Зашёл после 2:00',icon:'🌙'},
  {id:'streak_7',name:'Неделя подряд',desc:'7 дней подряд',icon:'🔥'},
];

let db = null;
let lastIdx = 0;

function $(s){return document.querySelector(s);}
function $all(s){return document.querySelectorAll(s);}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmtDate(ms){return new Date(ms).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});}
function todayISO(){return new Date().toISOString().slice(0,10);}
function isoToMs(i){return new Date(i+'T00:00:00').getTime();}
function uid(){return crypto.randomUUID();}
function fmtBytes(b){if(b<1024)return b+' Б';if(b<1048576)return (b/1024).toFixed(1)+' КБ';return (b/1048576).toFixed(1)+' МБ';}

function avatarColor(n){const p=['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f59e0b','#10b981','#0ea5e9','#14b8a6','#d946ef','#ef4444'];let h=0;for(let i=0;i<n.length;i++)h=(h*31+n.charCodeAt(i))>>>0;return p[h%p.length];}
function initials(n){const p=n.trim().split(/\s+/);if(!p.length)return'?';if(p.length===1)return p[0].slice(0,2).toUpperCase();return (p[0][0]+p[1][0]).toUpperCase();}
function avatarHtml(n,photo){if(photo)return `<div class="avatar"><img src="${photo}" alt=""></div>`;return `<div class="avatar" style="background:linear-gradient(135deg, ${avatarColor(n)}, ${avatarColor(n)}dd)">${escapeHtml(initials(n))}</div>`;}

function show(e){e.classList.remove('hidden');}
function hide(e){e.classList.add('hidden');}
function showAuth(){hide($('#app'));if(!Auth.getAuth()){show($('#onboarding'));hide($('#login'));}else{hide($('#onboarding'));show($('#login'));}}
function showApp(){hide($('#onboarding'));hide($('#login'));show($('#app'));}
function openModal(h){$('#modal-content').innerHTML=h;show($('#modal'));}
function closeModal(){hide($('#modal'));$('#modal-content').innerHTML='';}

/* ============ TOAST & CONFETTI ============ */
function showToast(msg, type='info', duration=2500) {
  const c = $('#toast-container');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(-20px)'; t.style.transition = 'all .3s'; setTimeout(() => t.remove(), 300); }, duration);
}
window.showToast = showToast;

function confetti() {
  const c = $('#confetti-container');
  const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#0ea5e9'];
  for (let i = 0; i < 30; i++) {
    const d = document.createElement('div');
    d.className = 'confetti';
    d.style.left = Math.random() * 100 + '%';
    d.style.background = colors[Math.floor(Math.random() * colors.length)];
    d.style.animationDelay = Math.random() * 0.3 + 's';
    d.style.animationDuration = (1.5 + Math.random()) + 's';
    c.appendChild(d);
    setTimeout(() => d.remove(), 2500);
  }
}

/* ============ XP & ACHIEVEMENTS ============ */
function addXP(amount, reason) {
  db.stats.xp = (db.stats.xp || 0) + amount;
  const newLevel = Math.floor(db.stats.xp / 100) + 1;
  if (newLevel > db.stats.level) {
    db.stats.level = newLevel;
    showToast(`🎉 Уровень ${newLevel}!`, 'success');
    confetti();
  }
  Store.saveDB(db);
}
function unlockAchievement(id) {
  if (!db.stats.achievements.includes(id)) {
    db.stats.achievements.push(id);
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (a) { showToast(`${a.icon} ${a.name}!`, 'success', 3500); confetti(); }
    Store.saveDB(db);
  }
}
function updateStreak() {
  const today = todayISO();
  if (db.stats.lastActiveDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (db.stats.lastActiveDate === yesterday) db.stats.streak = (db.stats.streak || 0) + 1;
  else db.stats.streak = 1;
  db.stats.lastActiveDate = today;
  if (db.stats.streak >= 7) unlockAchievement('streak_7');
  const h = new Date().getHours();
  if (h >= 2 && h < 5) unlockAchievement('night_owl');
  Store.saveDB(db);
}

/* ============ РОУТИНГ ============ */
function currentRoute(){const h=location.hash.replace(/^#\/?/,'');return h.split('/')[0]||'dashboard';}

function render() {
  if (!Auth.getSession()) { showAuth(); return; }
  showApp();
  const route = currentRoute();
  const meta = routes[route] || routes.dashboard;
  $('#app-title').textContent = meta.title;
  $all('.bottom-nav a').forEach(a => a.classList.toggle('active', a.dataset.route === route));

  db = Store.loadDB();
  const open = db.tasks.filter(t=>!t.done).length;
  const b = $('#tasks-badge');
  if (b) { b.textContent = open; b.classList.toggle('hidden', open === 0); }

  const view = $('#view');
  view.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';

  setTimeout(() => {
    view.innerHTML = '';
    const idx = meta.idx;
    view.classList.remove('screen-enter-right','screen-enter-left');
    if (idx >= 0) { void view.offsetWidth; view.classList.add(idx >= lastIdx ? 'screen-enter-right' : 'screen-enter-left'); lastIdx = idx; }
    if (route === 'students') renderStudents(view);
    else if (route === 'calendar') renderCalendar(view);
    else if (route === 'tasks') renderTasks(view);
    else if (route === 'more') renderMore(view);
    else if (route === 'funds') renderFunds(view);
    else if (route === 'schedule') renderSchedule(view);
    else if (route === 'settings') renderSettings(view);
    else if (route === 'notes') renderNotes(view);
    else if (route === 'stats') renderStats(view);
    else renderDashboard(view);
  }, 30);
}

/* ============ ДАШБОРД ============ */
function renderDashboard(view) {
  const now = new Date(), today = todayISO();
  const hour = now.getHours();
  const greet = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const activeStudents = db.students.filter(s=>s.status==='ACTIVE').length;
  const bdays = [];
  db.students.forEach(s => {
    if (!s.birthDate) return;
    const bd = new Date(s.birthDate+'T00:00:00');
    const next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
    if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next.setFullYear(now.getFullYear()+1);
    const days = Math.ceil((next - now)/86400000);
    if (days <= 30) bdays.push({ name: s.fullName, days, age: next.getFullYear() - bd.getFullYear() });
  });
  bdays.sort((a,b)=>a.days-b.days);

  const upcoming = db.events.filter(e=>e.date>=today).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);

  const dow = (now.getDay()+6)%7;
  const nowTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const todayLessons = db.schedule.filter(x=>(x.date===today)||(!x.date&&x.day===dow));
  const nextLesson = todayLessons.filter(x=>(x.time||'')>=nowTime).sort((a,b)=>a.time.localeCompare(b.time))[0];

  // Deadline radar
  const deadlines = [];
  db.events.filter(e=>e.date>=today && (e.type==='DEADLINE'||e.type==='EXAM'||e.type==='CREDIT')).forEach(e => {
    const days = Math.ceil((isoToMs(e.date) - isoToMs(today)) / 86400000);
    if (days <= 7) deadlines.push({ title: e.title, date: e.date, days });
  });
  db.tasks.filter(t=>!t.done && t.deadline && t.deadline >= today).forEach(t => {
    const days = Math.ceil((isoToMs(t.deadline) - isoToMs(today)) / 86400000);
    if (days <= 7) deadlines.push({ title: t.title, date: t.deadline, days });
  });
  deadlines.sort((a,b)=>a.days-b.days);

  const bdaysHtml = bdays.length ? bdays.slice(0,5).map(b=>`<div class="glass bday-item">${avatarHtml(b.name)}<div class="bday-info"><div class="bday-name">${escapeHtml(b.name)}</div><div class="bday-when">${b.days===0?'🎉 Сегодня!':'через '+b.days+' дн.'} · исполнится ${b.age}</div></div><div class="bday-emoji">🎂</div></div>`).join('') : '<div class="empty" style="padding:20px"><span class="empty-emoji">🎈</span>Нет ближайших ДР</div>';

  const eventsHtml = upcoming.length ? upcoming.map(e=>`<div class="glass event-item" data-event-id="${e.id}"><div style="flex:1;min-width:0"><div class="event-title">${escapeHtml(e.title)}</div><div class="event-meta">${fmtDate(isoToMs(e.date))}${e.time?', '+e.time:''}${e.place?' · '+escapeHtml(e.place):''}</div></div><span class="event-type-badge ${e.type}">${EVENT_TYPE_LABELS[e.type]}</span></div>`).join('') : '<div class="empty" style="padding:20px"><span class="empty-emoji">📅</span>Событий нет</div>';

  const lessonHtml = nextLesson ? `<div class="glass sched-item"><div class="sched-time">${nextLesson.time}</div><div class="sched-body"><div class="sched-subject">${escapeHtml(nextLesson.subject)}</div><div class="sched-teacher">${escapeHtml(nextLesson.teacher||'')}</div></div></div>` : '<div class="empty" style="padding:12px;font-size:13px">На сегодня пар больше нет</div>';

  const deadlineHtml = deadlines.length ? deadlines.slice(0,3).map(d=>`<div class="insight-card">⏰ ${escapeHtml(d.title)} — <b>${d.days===0?'сегодня':'через '+d.days+' дн.'}</b></div>`).join('') : '';

  const fundPct = db.funds.totalAmount > 0 ? Math.round((db.funds.payments.filter(p=>p.paid).reduce((s,p)=>s+p.amount,0)/db.funds.totalAmount)*100) : 0;
  const xpBar = (db.stats.xp % 100);

  view.innerHTML = `
    <div class="dash-hero"><h1>${greet} 👋</h1><p>Уровень ${db.stats.level} · XP ${db.stats.xp} · Стрик 🔥 ${db.stats.streak}</p></div>
    <div class="dash-grid">
      <div class="stat-card accent"><div class="num">${activeStudents}</div><div class="label">Активных</div></div>
      <div class="glass stat-card"><div class="num">${db.tasks.filter(t=>!t.done).length}</div><div class="label">Задач</div></div>
      <div class="glass stat-card"><div class="num">${db.events.filter(e=>e.date>=today).length}</div><div class="label">Событий</div></div>
      <div class="glass stat-card"><div class="num">${fundPct}%</div><div class="label">Взносы</div></div>
    </div>
    ${deadlineHtml ? '<div class="section-title">Дедлайн-радар</div>' + deadlineHtml : ''}
    <div class="section-title">Ближайшие пары</div>
    ${lessonHtml}
    <div class="section-title">Дни рождения</div>
    ${bdaysHtml}
    <div class="section-title">События</div>
    ${eventsHtml}
  `;

  $all('[data-event-id]').forEach(el => el.addEventListener('click', () => { const e=db.events.find(x=>x.id===el.dataset.eventId); if(e) openEventForm(e,e.date); }));
}

/* ============ СТУДЕНТЫ ============ */
let studentFilters = { q:'', status:'' };

function renderStudents(view) {
  const { q, status } = studentFilters;
  let list = [...db.students];
  if (q.trim()) { const n=q.trim().toLowerCase(); list = list.filter(s=>s.fullName.toLowerCase().includes(n)); }
  if (status) list = list.filter(s=>s.status===status);
  const rO = {starosta:0,deputy:1,brigadier:2,none:3};
  list.sort((a,b)=>{const ra=rO[a.role||'none'],rb=rO[b.role||'none'];if(ra!==rb)return ra-rb;return a.fullName.localeCompare(b.fullName,'ru');});

  const groups = {};
  list.forEach(s => { const l=(s.fullName[0]||'?').toUpperCase(); if(!groups[l])groups[l]=[]; groups[l].push(s); });

  const groupsHtml = Object.keys(groups).sort((a,b)=>a.localeCompare(b,'ru')).map(l => {
    const rows = groups[l].map(s => {
      const roleBadge = s.role && s.role !== 'none' ? `<span class="role-badge ${s.role}">${ROLE_LABELS[s.role]}</span>` : '';
      const tags = (s.tags || []).map(t => `<span class="chip">${escapeHtml(t)}</span>`).join('');
      return `<div class="glass card student-card" data-open-student="${s.id}">${avatarHtml(s.fullName, s.photo)}<div class="student-info"><div class="student-name">${escapeHtml(s.fullName)} ${roleBadge}</div><div class="student-meta">№${s.listNumber??'—'} · <span class="badge ${s.status}">${STATUS_LABELS[s.status]}</span>${s.birthDate?' · 🎂 '+fmtDate(isoToMs(s.birthDate)):''}</div>${tags?'<div style="margin-top:4px">'+tags+'</div>':''}</div><button class="icon-btn" data-edit="${s.id}">✏️</button></div>`;
    }).join('');
    return `<div class="letter-group"><div class="letter-header">${l}</div>${rows}</div>`;
  }).join('');

  view.innerHTML = `
    <div class="toolbar">
      <input type="text" id="st-q" placeholder="Поиск по ФИО" value="${escapeHtml(q)}" />
      <select id="st-status"><option value="">Все</option><option value="ACTIVE" ${status==='ACTIVE'?'selected':''}>Активные</option><option value="ACADEMIC" ${status==='ACADEMIC'?'selected':''}>Академические</option><option value="EXPELLED" ${status==='EXPELLED'?'selected':''}>Отчисленные</option></select>
    </div>
    <div class="toolbar" style="margin-top:-4px"><button class="btn-secondary" id="st-export" style="flex:1">📥 Экспорт CSV</button><button class="btn-secondary" id="st-vcard" style="flex:1">📇 vCard</button></div>
    ${groupsHtml || '<div class="empty"><span class="empty-emoji">👥</span>Студентов нет. Нажмите «+» или импортируйте TXT в «Ещё».</div>'}
    <button class="fab" id="st-add">+</button>
  `;

  $('#st-q').addEventListener('input', e => { studentFilters.q = e.target.value; renderStudents(view); });
  $('#st-status').addEventListener('change', e => { studentFilters.status = e.target.value; renderStudents(view); });
  $('#st-add').addEventListener('click', () => openStudentForm(null));
  $('#st-export').addEventListener('click', exportStudentsCsv);
  $('#st-vcard').addEventListener('click', exportVCard);
  $all('[data-edit]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const s=db.students.find(x=>x.id===b.dataset.edit); if(s) openStudentForm(s); }));
  $all('[data-open-student]').forEach(el => el.addEventListener('click', () => { const s=db.students.find(x=>x.id===el.dataset.openStudent); if(s) openStudentCard(s); }));
}

function openStudentCard(s) {
  const tags = (s.tags || []).map(t => `<span class="chip">${escapeHtml(t)}</span>`).join('');
  openModal(`
    <h3>${escapeHtml(s.fullName)}</h3>
    <div style="text-align:center;margin-bottom:16px">${avatarHtml(s.fullName, s.photo)}</div>
    ${s.role && s.role!=='none'?`<div style="text-align:center;margin-bottom:12px"><span class="role-badge ${s.role}">${ROLE_LABELS[s.role]}</span></div>`:''}
    <div class="glass" style="padding:14px;border-radius:14px;margin-bottom:12px">
      <div style="font-size:13px;margin-bottom:6px"><b>Статус:</b> <span class="badge ${s.status}">${STATUS_LABELS[s.status]}</span></div>
      ${s.phone?`<div style="font-size:13px;margin-bottom:6px"><b>Телефон:</b> <a href="tel:${escapeHtml(s.phone)}" style="color:var(--accent)">${escapeHtml(s.phone)}</a></div>`:''}
      ${s.email?`<div style="font-size:13px;margin-bottom:6px"><b>Email:</b> ${escapeHtml(s.email)}</div>`:''}
      ${s.telegram?`<div style="font-size:13px;margin-bottom:6px"><b>Telegram:</b> ${escapeHtml(s.telegram)}</div>`:''}
      ${s.birthDate?`<div style="font-size:13px;margin-bottom:6px"><b>ДР:</b> ${fmtDate(isoToMs(s.birthDate))}</div>`:''}
      ${s.note?`<div style="font-size:13px"><b>Заметка:</b> ${escapeHtml(s.note)}</div>`:''}
    </div>
    ${tags?`<div style="margin-bottom:12px">${tags}</div>`:''}
    <div class="modal-actions"><button type="button" class="btn-secondary" data-close-modal>Закрыть</button><button type="button" class="btn-primary compact" id="sc-edit">Редактировать</button></div>
  `);
  $('#sc-edit').addEventListener('click', () => { closeModal(); setTimeout(()=>openStudentForm(s),100); });
}

function openStudentForm(student) {
  const isEdit = !!student;
  const s = student || { id:uid(), fullName:'', phone:'', email:'', telegram:'', listNumber:'', status:'ACTIVE', birthDate:'', note:'', role:'none', tags:[], photo:'' };
  openModal(`
    <h3>${isEdit?'Редактировать':'Новый студент'}</h3>
    <form id="st-form">
      <div class="form-row"><label>ФИО *</label><input type="text" id="f-fullName" required value="${escapeHtml(s.fullName)}" /></div>
      <div class="form-row"><label>Роль</label><select id="f-role"><option value="none" ${s.role==='none'?'selected':''}>— нет —</option><option value="starosta" ${s.role==='starosta'?'selected':''}>Староста</option><option value="deputy" ${s.role==='deputy'?'selected':''}>Зам старосты</option><option value="brigadier" ${s.role==='brigadier'?'selected':''}>Бригадир</option></select></div>
      <div class="form-row"><label>Номер по списку</label><input type="number" id="f-listNumber" value="${s.listNumber??''}" /></div>
      <div class="form-row"><label>Статус</label><select id="f-status"><option value="ACTIVE" ${s.status==='ACTIVE'?'selected':''}>Активен</option><option value="ACADEMIC" ${s.status==='ACADEMIC'?'selected':''}>Академический отпуск</option><option value="EXPELLED" ${s.status==='EXPELLED'?'selected':''}>Отчислен</option></select></div>
      <div class="form-row"><label>Телефон</label><input type="tel" id="f-phone" value="${escapeHtml(s.phone)}" /></div>
      <div class="form-row"><label>Email</label><input type="email" id="f-email" value="${escapeHtml(s.email)}" /></div>
      <div class="form-row"><label>Telegram</label><input type="text" id="f-telegram" value="${escapeHtml(s.telegram)}" /></div>
      <div class="form-row"><label>Дата рождения</label><input type="date" id="f-birthDate" value="${s.birthDate||''}" /></div>
      <div class="form-row"><label>Заметка</label><textarea id="f-note">${escapeHtml(s.note)}</textarea></div>
      <div class="form-row"><label>Теги (через запятую)</label><input type="text" id="f-tags" value="${escapeHtml((s.tags||[]).join(', '))}" /></div>
      <div class="form-row"><label>Фото (URL или оставьте пустым)</label><input type="text" id="f-photo" value="${escapeHtml(s.photo||'')}" placeholder="https://..." /></div>
      <div class="modal-actions"><button type="button" class="btn-secondary" data-close-modal>Отмена</button>${isEdit?'<button type="button" class="btn-danger" id="f-delete">Удалить</button>':''}<button type="submit" class="btn-primary compact">Сохранить</button></div>
    </form>`);

  $('#st-form').addEventListener('submit', e => {
    e.preventDefault();
    const fullName = $('#f-fullName').value.trim(); if (!fullName) return;
    const data = {
      id:s.id, fullName, role:$('#f-role').value,
      listNumber:$('#f-listNumber').value?Number($('#f-listNumber').value):null,
      status:$('#f-status').value, phone:$('#f-phone').value.trim(),
      email:$('#f-email').value.trim(), telegram:$('#f-telegram').value.trim(),
      birthDate:$('#f-birthDate').value, note:$('#f-note').value.trim(),
      tags: $('#f-tags').value.split(',').map(x=>x.trim()).filter(Boolean),
      photo: $('#f-photo').value.trim(),
    };
    if (isEdit) { const i=db.students.findIndex(x=>x.id===s.id); db.students[i]=data; addXP(5,'edit'); }
    else { db.students.push(data); addXP(10,'add'); unlockAchievement('first_student'); if(db.students.length>=10)unlockAchievement('ten_students'); }
    syncPayments(); Store.saveDB(db); closeModal(); showToast('Сохранено','success'); render();
  });

  if (isEdit) $('#f-delete').addEventListener('click', () => {
    if (!confirm(`Удалить «${s.fullName}»?`)) return;
    db.students = db.students.filter(x=>x.id!==s.id);
    db.funds.payments = db.funds.payments.filter(p=>p.studentId!==s.id);
    Store.saveDB(db); closeModal(); showToast('Удалено','info'); render();
  });
}

function syncPayments() {
  const ex = new Set(db.funds.payments.map(p=>p.studentId));
  db.students.forEach(s => { if (!ex.has(s.id)) db.funds.payments.push({ id:uid(), studentId:s.id, paid:false, amount:0, date:null }); });
  const ids = new Set(db.students.map(s=>s.id));
  db.funds.payments = db.funds.payments.filter(p=>ids.has(p.studentId));
}

function exportStudentsCsv() {
  const header = ['ФИО','Роль','№','Статус','Телефон','Email','Telegram','ДР','Заметка','Теги'];
  const rows = db.students.slice().sort((a,b)=>a.fullName.localeCompare(b.fullName,'ru')).map(s=>[s.fullName,ROLE_LABELS[s.role]||'',s.listNumber??'',STATUS_LABELS[s.status]||'',s.phone||'',s.email||'',s.telegram||'',s.birthDate||'',s.note||'',(s.tags||[]).join(', ')]);
  const csv = [header,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`students-${todayISO()}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  showToast('CSV скачан','success');
}

function exportVCard() {
  let out = '';
  db.students.filter(s=>s.status==='ACTIVE').forEach(s => {
    out += 'BEGIN:VCARD\r\nVERSION:3.0\r\n';
    out += `FN:${s.fullName}\r\n`;
    if (s.phone) out += `TEL;TYPE=CELL:${s.phone}\r\n`;
    if (s.email) out += `EMAIL:${s.email}\r\n`;
    if (s.birthDate) out += `BDAY:${s.birthDate.replace(/-/g,'')}\r\n`;
    if (s.note) out += `NOTE:${s.note.replace(/\n/g,'\\n')}\r\n`;
    out += 'END:VCARD\r\n';
  });
  const blob = new Blob([out], {type:'text/vcard;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='contacts.vcf';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  showToast('vCard скачан','success');
}

function parseBirthDate(raw) {
  const s = raw.trim();
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) { const d=+m[1],mo=+m[2],y=+m[3]; if(d>=1&&d<=31&&mo>=1&&mo<=12&&y>=1900&&y<=2100) return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`; return null; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m?s:null;
}

function importStudentsFromTxt(text) {
  const lines = text.split(/\r?\n/);
  let added=0, skipped=0, errors=0;
  const nn = s => s.trim().replace(/\s+/g,' ').toLowerCase();
  const ex = new Set(db.students.map(s=>nn(s.fullName)));
  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    const parts = line.split(/\s*[;|\t]\s*/);
    if (parts.length < 2) { errors++; return; }
    const fullName = parts[0].trim().replace(/\s+/g,' ');
    const birthDate = parseBirthDate(parts[1].trim());
    if (!fullName || !birthDate) { errors++; return; }
    const key = nn(fullName);
    if (ex.has(key)) { skipped++; return; }
    db.students.push({ id:uid(), fullName, phone:'', email:'', telegram:'', listNumber:null, status:'ACTIVE', birthDate, note:'', role:'none', tags:[], photo:'' });
    ex.add(key); added++;
  });
  db.students.forEach((s,i) => { if (s.listNumber==null) s.listNumber = i+1; });
  syncPayments(); Store.saveDB(db);
  return { added, skipped, errors };
}

/* ============ КАЛЕНДАРЬ ============ */
let calState = { year:new Date().getFullYear(), month:new Date().getMonth(), selectedDate:todayISO(), filterType:'' };

function renderCalendar(view) {
  const { year, month, selectedDate, filterType } = calState;
  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay()+6)%7;
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const dows = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

  let cells = '';
  dows.forEach(d => cells += `<div class="cal-dow">${d}</div>`);
  for (let i = startDow-1; i >= 0; i--) cells += `<div class="cal-cell other">${prevDays-i}</div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = iso === todayISO();
    const isSel = iso === selectedDate;
    const events = db.events.filter(e => e.date === iso && (!filterType || e.type === filterType));
    const dots = events.slice(0,3).map(e => `<div class="cal-dot ${e.type}"></div>`).join('');
    cells += `<div class="cal-cell ${isToday?'today':''} ${isSel?'selected':''}" data-date="${iso}">${d}${dots?'<div style="display:flex;gap:2px;margin-top:2px">'+dots+'</div>':''}</div>`;
  }
  const total = startDow + daysInMonth;
  const tail = (7-(total%7))%7;
  for (let d = 1; d <= tail; d++) cells += `<div class="cal-cell other">${d}</div>`;

  const dayEvents = db.events.filter(e => e.date === selectedDate && (!filterType || e.type === filterType)).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  const eventsHtml = dayEvents.length ? dayEvents.map(e => `<div class="glass event-item" data-event-id="${e.id}"><div style="flex:1;min-width:0"><div class="event-title">${escapeHtml(e.title)}</div><div class="event-meta">${e.time||'весь день'}${e.place?' · '+escapeHtml(e.place):''}</div></div><span class="event-type-badge ${e.type}">${EVENT_TYPE_LABELS[e.type]}</span></div>`).join('') : '<div class="empty" style="padding:20px">Нет событий</div>';

  view.innerHTML = `
    <div class="cal-header"><button id="cal-prev">←</button><div class="cal-title">${monthNames[month]} ${year}</div><button id="cal-next">→</button></div>
    <div class="toolbar"><select id="cal-filter"><option value="">Все типы</option>${Object.entries(EVENT_TYPE_LABELS).map(([k,v])=>`<option value="${k}" ${filterType===k?'selected':''}>${v}</option>`).join('')}</select></div>
    <div class="cal-grid">${cells}</div>
    <div class="section-title">${fmtDate(isoToMs(selectedDate))}</div>
    ${eventsHtml}
    <button class="fab" id="cal-add">+</button>
  `;

  $('#cal-prev').addEventListener('click', () => { calState.month--; if(calState.month<0){calState.month=11;calState.year--;} renderCalendar(view); });
  $('#cal-next').addEventListener('click', () => { calState.month++; if(calState.month>11){calState.month=0;calState.year++;} renderCalendar(view); });
  $('#cal-filter').addEventListener('change', e => { calState.filterType = e.target.value; renderCalendar(view); });
  $('#cal-add').addEventListener('click', () => openEventForm(null, selectedDate));
  $all('[data-date]').forEach(c => c.addEventListener('click', () => { calState.selectedDate = c.dataset.date; renderCalendar(view); }));
  $all('[data-event-id]').forEach(el => el.addEventListener('click', () => { const e=db.events.find(x=>x.id===el.dataset.eventId); if(e) openEventForm(e,e.date); }));
}

function openEventForm(event, defaultDate) {
  const isEdit = !!event;
  const e = event || { id:uid(), title:'', type:'OTHER', date:defaultDate||todayISO(), time:'', place:'', description:'' };
  openModal(`
    <h3>${isEdit?'Редактировать':'Новое событие'}</h3>
    <form id="ev-form">
      <div class="form-row"><label>Название *</label><input type="text" id="ef-title" required value="${escapeHtml(e.title)}" /></div>
      <div class="form-row"><label>Тип</label><select id="ef-type">${Object.entries(EVENT_TYPE_LABELS).map(([k,v])=>`<option value="${k}" ${e.type===k?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="form-row"><label>Дата</label><input type="date" id="ef-date" required value="${e.date}" /></div>
      <div class="form-row"><label>Время</label><input type="time" id="ef-time" value="${e.time||''}" /></div>
      <div class="form-row"><label>Место</label><input type="text" id="ef-place" value="${escapeHtml(e.place)}" /></div>
      <div class="form-row"><label>Описание</label><textarea id="ef-desc">${escapeHtml(e.description)}</textarea></div>
      <div class="modal-actions"><button type="button" class="btn-secondary" data-close-modal>Отмена</button>${isEdit?'<button type="button" class="btn-danger" id="ef-delete">Удалить</button>':''}<button type="submit" class="btn-primary compact">Сохранить</button></div>
    </form>`);

  $('#ev-form').addEventListener('submit', ev => {
    ev.preventDefault();
    const title = $('#ef-title').value.trim(); if (!title) return;
    const data = { id:e.id, title, type:$('#ef-type').value, date:$('#ef-date').value, time:$('#ef-time').value, place:$('#ef-place').value.trim(), description:$('#ef-desc').value.trim() };
    if (isEdit) { const i=db.events.findIndex(x=>x.id===e.id); db.events[i]=data; } else { db.events.push(data); unlockAchievement('first_event'); }
    addXP(5,'event'); Store.saveDB(db); closeModal(); showToast('Сохранено','success'); render();
  });

  if (isEdit) $('#ef-delete').addEventListener('click', () => {
    if (!confirm('Удалить событие?')) return;
    db.events = db.events.filter(x=>x.id!==e.id);
    Store.saveDB(db); closeModal(); render();
  });
}

/* ============ ЗАДАЧИ ============ */
let taskFilter = 'active';

function renderTasks(view) {
  let list = [...db.tasks];
  if (taskFilter === 'active') list = list.filter(t=>!t.done);
  else if (taskFilter === 'done') list = list.filter(t=>t.done);
  list.sort((a,b) => { if (a.done!==b.done) return a.done?1:-1; return (a.deadline||'9999').localeCompare(b.deadline||'9999'); });

  const rows = list.map(t => `<div class="glass task-item ${t.done?'done':''}"><input type="checkbox" data-toggle="${t.id}" ${t.done?'checked':''} /><div class="task-body" data-edit="${t.id}"><div class="task-title">${escapeHtml(t.title)}</div><div class="task-meta"><span class="priority-${t.priority}">${PRIORITY_LABELS[t.priority]}</span>${t.deadline?' · до '+fmtDate(isoToMs(t.deadline)):''}</div></div></div>`).join('');

  view.innerHTML = `
    <div class="toolbar"><select id="tk-filter"><option value="active" ${taskFilter==='active'?'selected':''}>Активные</option><option value="done" ${taskFilter==='done'?'selected':''}>Выполненные</option><option value="all" ${taskFilter==='all'?'selected':''}>Все</option></select></div>
    ${rows || '<div class="empty"><span class="empty-emoji">✅</span>Задач нет.</div>'}
    <button class="fab" id="tk-add">+</button>
  `;

  $('#tk-filter').addEventListener('change', e => { taskFilter = e.target.value; renderTasks(view); });
  $('#tk-add').addEventListener('click', () => openTaskForm(null));
  $all('[data-toggle]').forEach(cb => cb.addEventListener('change', () => {
    const t = db.tasks.find(x=>x.id===cb.dataset.toggle);
    if (t) {
      t.done = cb.checked;
      if (t.done) { addXP(15,'task'); confetti(); unlockAchievement('task_master'); const done = db.tasks.filter(x=>x.done).length; if(done>=10)unlockAchievement('task_master'); }
      Store.saveDB(db); renderTasks(view);
      const open=db.tasks.filter(t=>!t.done).length; const b=$('#tasks-badge'); if(b){b.textContent=open;b.classList.toggle('hidden',open===0);}
    }
  }));
  $all('[data-edit]').forEach(el => el.addEventListener('click', () => { const t=db.tasks.find(x=>x.id===el.dataset.edit); if(t) openTaskForm(t); }));
}

function openTaskForm(task) {
  const isEdit = !!task;
  const t = task || { id:uid(), title:'', deadline:'', priority:'NORMAL', done:false };
  openModal(`
    <h3>${isEdit?'Редактировать':'Новая задача'}</h3>
    <form id="tk-form">
      <div class="form-row"><label>Название *</label><input type="text" id="tf-title" required value="${escapeHtml(t.title)}" /></div>
      <div class="form-row"><label>Дедлайн</label><input type="date" id="tf-deadline" value="${t.deadline||''}" /></div>
      <div class="form-row"><label>Приоритет</label><select id="tf-priority">${Object.entries(PRIORITY_LABELS).map(([k,v])=>`<option value="${k}" ${t.priority===k?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="modal-actions"><button type="button" class="btn-secondary" data-close-modal>Отмена</button>${isEdit?'<button type="button" class="btn-danger" id="tf-delete">Удалить</button>':''}<button type="submit" class="btn-primary compact">Сохранить</button></div>
    </form>`);

  $('#tk-form').addEventListener('submit', e => {
    e.preventDefault();
    const title = $('#tf-title').value.trim(); if (!title) return;
    const data = { id:t.id, title, deadline:$('#tf-deadline').value, priority:$('#tf-priority').value, done:t.done };
    if (isEdit) { const i=db.tasks.findIndex(x=>x.id===t.id); db.tasks[i]=data; } else { db.tasks.push(data); unlockAchievement('first_task'); }
    addXP(5,'task'); Store.saveDB(db); closeModal(); showToast('Сохранено','success'); render();
  });

  if (isEdit) $('#tf-delete').addEventListener('click', () => {
    if (!confirm('Удалить задачу?')) return;
    db.tasks = db.tasks.filter(x=>x.id!==t.id);
    Store.saveDB(db); closeModal(); render();
  });
}

/* ============ РАСПИСАНИЕ ============ */
function renderSchedule(view) {
  const todayIso = todayISO();
  const todayDow = (new Date().getDay()+6)%7;
  const groups = {};
  db.schedule.forEach(x => {
    const key = x.date ? 'd:'+x.date : 'w:'+x.day;
    if (!groups[key]) groups[key] = { date:x.date||null, day:x.day, pairs:{} };
    const pk = x.pair ?? 0;
    if (!groups[key].pairs[pk]) groups[key].pairs[pk] = { time:x.time, timeEnd:x.timeEnd, items:[] };
    groups[key].pairs[pk].items.push(x);
  });
  const sorted = Object.values(groups).sort((a,b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.day - b.day;
  });

  const html = sorted.map(g => {
    const label = g.date ? g.date.split('-').reverse().join('.') : DAYS[g.day];
    const isToday = g.date === todayIso || (!g.date && g.day === todayDow);
    const pairs = Object.keys(g.pairs).map(Number).sort((a,b)=>a-b);
    const items = pairs.map(pk => {
      const p = g.pairs[pk];
      const subItems = p.items.sort((a,b)=>(a.subgroup??0)-(b.subgroup??0)).map(it => `
        <div style="display:flex;gap:8px;padding:6px 0;font-size:13px;border-top:1px dashed var(--border)">
          ${it.subgroup?`<b style="color:var(--accent);min-width:22px">(${it.subgroup})</b>`:'<span style="min-width:22px"></span>'}
          <div style="flex:1;min-width:0"><div style="font-weight:600">${escapeHtml(it.subject||'—')}</div><div style="color:var(--muted);font-size:12px">${escapeHtml(it.teacher||'')}${it.room?' · '+escapeHtml(it.room):''}</div></div>
          <button class="icon-btn" data-edit-sched="${it.id}" style="width:30px;height:30px;font-size:13px">✏️</button>
        </div>`).join('');
      return `<div class="glass" style="margin-bottom:8px;padding:10px 12px;border-radius:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><b style="font-size:13px">${pk} пара</b><span style="color:var(--accent);font-weight:700;font-size:13px">${p.time||''}${p.timeEnd?'–'+p.timeEnd:''}</span></div>${subItems}</div>`;
    }).join('');
    return `<div class="sched-day ${isToday?'today':''}"><div class="sched-day-title">${label}${isToday?' · сегодня':''}</div>${items}</div>`;
  }).join('');

  view.innerHTML = `
    <div class="toolbar" style="margin-bottom:12px"><button class="btn-secondary" id="sched-import" style="flex:1">📥 Импорт расписания</button><button class="btn-secondary" id="sched-ics" style="flex:1">📅 .ics</button></div>
    ${html || '<div class="empty"><span class="empty-emoji">📚</span>Расписание пустое. Нажмите «Импорт» или «+».</div>'}
    <button class="fab" id="sched-add">+</button>
  `;

  $('#sched-import').addEventListener('click', () => { if (window.ScheduleImport) window.ScheduleImport.openScheduleImportDialog(); else alert('Модуль импорта не загружен'); });
  $('#sched-ics').addEventListener('click', exportScheduleIcs);
  $('#sched-add').addEventListener('click', () => openSchedForm(null));
  $all('[data-edit-sched]').forEach(el => el.addEventListener('click', () => { const s=db.schedule.find(x=>x.id===el.dataset.editSched); if(s) openSchedForm(s); }));
}

function exportScheduleIcs() {
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Starosta//RU'];
  db.schedule.forEach(s => {
    if (!s.date) return;
    const d = s.date.replace(/-/g,'');
    const dt = (s.time||'09:00').replace(':','') + '00';
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${s.id}@starosta`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').slice(0,15)}Z`);
    lines.push(`DTSTART:${d}T${dt}`);
    lines.push(`SUMMARY:${s.subject}`);
    if (s.teacher) lines.push(`DESCRIPTION:${s.teacher}`);
    if (s.room) lines.push(`LOCATION:${s.room}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')],{type:'text/calendar;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='schedule.ics';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  showToast('.ics скачан','success');
}

function openSchedForm(item) {
  const isEdit = !!item;
  const s = item || { id:uid(), date:'', day:0, pair:1, time:'09:00', timeEnd:'10:30', subject:'', teacher:'', room:'', subgroup:null };
  openModal(`
    <h3>${isEdit?'Редактировать пару':'Новая пара'}</h3>
    <form id="sched-form">
      <div class="form-row"><label>Дата (необязательно)</label><input type="date" id="sf-date" value="${s.date||''}" /></div>
      <div class="form-row"><label>День недели</label><select id="sf-day">${DAYS.map((d,i)=>`<option value="${i}" ${s.day===i?'selected':''}>${d}</option>`).join('')}</select></div>
      <div class="form-row"><label>Номер пары</label><input type="number" id="sf-pair" min="1" max="10" value="${s.pair||1}" /></div>
      <div class="form-row"><label>Время начала</label><input type="time" id="sf-time" required value="${s.time||'09:00'}" /></div>
      <div class="form-row"><label>Время конца</label><input type="time" id="sf-timeEnd" value="${s.timeEnd||''}" /></div>
      <div class="form-row"><label>Подгруппа</label><select id="sf-subgroup"><option value="" ${!s.subgroup?'selected':''}>— общая —</option><option value="1" ${s.subgroup===1?'selected':''}>(1)</option><option value="2" ${s.subgroup===2?'selected':''}>(2)</option></select></div>
      <div class="form-row"><label>Предмет *</label><input type="text" id="sf-subject" required value="${escapeHtml(s.subject)}" /></div>
      <div class="form-row"><label>Преподаватель</label><input type="text" id="sf-teacher" value="${escapeHtml(s.teacher)}" /></div>
      <div class="form-row"><label>Аудитория</label><input type="text" id="sf-room" value="${escapeHtml(s.room)}" /></div>
      <div class="modal-actions"><button type="button" class="btn-secondary" data-close-modal>Отмена</button>${isEdit?'<button type="button" class="btn-danger" id="sf-delete">Удалить</button>':''}<button type="submit" class="btn-primary compact">Сохранить</button></div>
    </form>`);

  $('#sched-form').addEventListener('submit', e => {
    e.preventDefault();
    const subject = $('#sf-subject').value.trim(); if (!subject) return;
    const data = { id:s.id, date:$('#sf-date').value||null, day:+$('#sf-day').value, pair:+$('#sf-pair').value||1, time:$('#sf-time').value, timeEnd:$('#sf-timeEnd').value, subgroup:$('#sf-subgroup').value?+$('#sf-subgroup').value:null, subject, teacher:$('#sf-teacher').value.trim(), room:$('#sf-room').value.trim() };
    if (isEdit) { const i=db.schedule.findIndex(x=>x.id===s.id); db.schedule[i]=data; } else db.schedule.push(data);
    Store.saveDB(db); closeModal(); showToast('Сохранено','success'); render();
  });

  if (isEdit) $('#sf-delete').addEventListener('click', () => {
    if (!confirm('Удалить пару?')) return;
    db.schedule = db.schedule.filter(x=>x.id!==s.id);
    Store.saveDB(db); closeModal(); render();
  });
}

/* ============ ВЗНОСЫ ============ */
function renderFunds(view) {
  const total = db.funds.totalAmount || 0;
  const active = db.funds.payments.filter(p => { const st = db.students.find(s=>s.id===p.studentId); return st && st.status==='ACTIVE'; });
  const collected = active.filter(p=>p.paid).reduce((s,p)=>s+(p.amount||0),0);
  const pct = total > 0 ? Math.min(100,Math.round((collected/total)*100)) : 0;
  const paidCount = active.filter(p=>p.paid).length;
  const unpaid = active.filter(p=>!p.paid);

  const rows = active.map(p => {
    const st = db.students.find(s=>s.id===p.studentId); if(!st) return '';
    return `<div class="glass pay-row"><div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">${avatarHtml(st.fullName,st.photo)}<div class="pay-name">${escapeHtml(st.fullName)}</div></div><button class="pay-status ${p.paid?'paid':'unpaid'}" data-toggle-pay="${p.id}">${p.paid?'✓ Сдал':'✗ Не сдал'}</button></div>`;
  }).join('');

  view.innerHTML = `
    <div class="fund-hero"><div class="fund-sub">Собрано взносов</div><div class="fund-amount">${collected.toLocaleString('ru-RU')} / ${total.toLocaleString('ru-RU')} ₽</div><div class="fund-sub">${paidCount} из ${active.length} сдали</div><div class="fund-progress"><div style="width:${pct}%"></div></div></div>
    <div class="toolbar"><button class="btn-secondary" id="fund-set-total" style="flex:1">💰 Сумма сбора</button><button class="btn-secondary" id="fund-copy-debtors" style="flex:1">📋 Должники</button></div>
    <div class="section-title">Кто сдал</div>
    ${rows || '<div class="empty"><span class="empty-emoji">💸</span>Добавьте студентов</div>'}
  `;

  $('#fund-set-total').addEventListener('click', () => {
    const v = prompt('Сумма сбора с каждого (₽):', db.funds.totalAmount || 0);
    if (v === null) return;
    const n = Number(v);
    if (isNaN(n) || n < 0) { showToast('Некорректная сумма','error'); return; }
    db.funds.totalAmount = n;
    db.funds.payments.forEach(p => { p.amount = n; });
    Store.saveDB(db); renderFunds(view);
  });
  $('#fund-copy-debtors').addEventListener('click', () => {
    if (!unpaid.length) { showToast('Должников нет','success'); return; }
    const names = unpaid.map(p => db.students.find(s=>s.id===p.studentId)?.fullName).filter(Boolean).join(', ');
    navigator.clipboard.writeText(names).then(()=>showToast('Скопировано','success')).catch(()=>showToast('Ошибка','error'));
  });

  $all('[data-toggle-pay]').forEach(btn => btn.addEventListener('click', () => {
    const p = db.funds.payments.find(x=>x.id===btn.dataset.togglePay);
    if (!p) return;
    p.paid = !p.paid;
    p.date = p.paid ? todayISO() : null;
    p.amount = db.funds.totalAmount || 0;
    if (p.paid) { addXP(10,'pay'); confetti(); }
    Store.saveDB(db); renderFunds(view);
  }));
}

/* ============ ЗАМЕТКИ ============ */
function renderNotes(view) {
  const notes = [...db.notes].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  view.innerHTML = `
    ${notes.length ? notes.map(n => `<div class="glass card" style="margin-bottom:8px;padding:12px 14px"><div style="font-size:12px;color:var(--muted);margin-bottom:4px">${n.date?fmtDate(isoToMs(n.date)):''}</div><div style="font-size:14px;white-space:pre-wrap">${escapeHtml(n.text)}</div></div>`).join('') : '<div class="empty"><span class="empty-emoji">📝</span>Заметок нет</div>'}
    <button class="fab" id="note-add">+</button>
  `;
  $('#note-add').addEventListener('click', () => {
    const text = prompt('Текст заметки:');
    if (!text || !text.trim()) return;
    db.notes.push({ id:uid(), text:text.trim(), date:todayISO() });
    Store.saveDB(db); renderNotes(view); showToast('Заметка добавлена','success');
  });
}

/* ============ СТАТИСТИКА ============ */
function renderStats(view) {
  const totalTasks = db.tasks.length;
  const doneTasks = db.tasks.filter(t=>t.done).length;
  const pct = totalTasks ? Math.round((doneTasks/totalTasks)*100) : 0;
  const unlocked = db.stats.achievements.length;

  view.innerHTML = `
    <div class="dash-hero"><h1>Уровень ${db.stats.level}</h1><p>XP ${db.stats.xp} · Стрик 🔥 ${db.stats.streak} дн.</p></div>
    <div class="dash-grid">
      <div class="glass stat-card"><div class="num">${db.students.length}</div><div class="label">Студентов</div></div>
      <div class="glass stat-card"><div class="num">${db.events.length}</div><div class="label">Событий</div></div>
      <div class="glass stat-card"><div class="num">${doneTasks}/${totalTasks}</div><div class="label">Задач (${pct}%)</div></div>
      <div class="glass stat-card"><div class="num">${unlocked}/${ACHIEVEMENTS.length}</div><div class="label">Достижений</div></div>
    </div>
    <div class="section-title">Достижения</div>
    ${ACHIEVEMENTS.map(a=>`<div class="glass ${db.stats.achievements.includes(a.id)?'insight-card':''}" style="display:flex;align-items:center;gap:12px;padding:12px 14px;margin-bottom:8px;opacity:${db.stats.achievements.includes(a.id)?1:.5}"><div style="font-size:24px">${a.icon}</div><div><div style="font-weight:600;font-size:14px">${a.name}</div><div style="font-size:12px;color:var(--muted)">${a.desc}</div></div><div style="margin-left:auto">${db.stats.achievements.includes(a.id)?'✅':'🔒'}</div></div>`).join('')}
  `;
}

/* ============ ПОИСК ============ */
function openSearch() {
  openModal(`
    <h3>🔍 Поиск</h3>
    <div class="form-row"><input type="text" id="sr-input" placeholder="Студент, событие, задача, пара..." autofocus /></div>
    <div id="sr-results" style="max-height:50vh;overflow-y:auto"></div>
  `);
  const input = $('#sr-input');
  input.focus();
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    const results = $('#sr-results');
    if (!q) { results.innerHTML = ''; return; }
    const items = [];
    db.students.filter(s=>s.fullName.toLowerCase().includes(q)).slice(0,5).forEach(s => items.push({ type:'Студент', title:s.fullName, sub:'№'+(s.listNumber??''), action:()=>{ closeModal(); setTimeout(()=>openStudentCard(s),100); } }));
    db.events.filter(e=>e.title.toLowerCase().includes(q)).slice(0,5).forEach(e => items.push({ type:'Событие', title:e.title, sub:fmtDate(isoToMs(e.date)), action:()=>{ closeModal(); setTimeout(()=>openEventForm(e,e.date),100); } }));
    db.tasks.filter(t=>t.title.toLowerCase().includes(q)).slice(0,5).forEach(t => items.push({ type:'Задача', title:t.title, sub:t.deadline?fmtDate(isoToMs(t.deadline)):'', action:()=>{ closeModal(); setTimeout(()=>openTaskForm(t),100); } }));
    db.schedule.filter(s=>(s.subject||'').toLowerCase().includes(q)||(s.teacher||'').toLowerCase().includes(q)).slice(0,5).forEach(s => items.push({ type:'Пара', title:s.subject, sub:(s.teacher||'')+' '+(s.time||''), action:()=>{ closeModal(); setTimeout(()=>openSchedForm(s),100); } }));
    results.innerHTML = items.length ? items.map((it,i)=>`<div class="search-result" data-sr="${i}"><div class="search-result-title">${escapeHtml(it.title)}</div><div class="search-result-sub">${it.type} · ${escapeHtml(it.sub)}</div></div>`).join('') : '<div class="empty" style="padding:16px">Ничего не найдено</div>';
    $all('[data-sr]').forEach(el => el.addEventListener('click', () => items[+el.dataset.sr].action()));
  });
}

/* ============ ПАНИКА ============ */
function openPanic() {
  const today = todayISO();
  const next3 = [];
  db.events.filter(e=>e.date>=today).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3).forEach(e=>next3.push({type:'Событие',title:e.title,date:e.date}));
  db.tasks.filter(t=>!t.done && t.deadline).sort((a,b)=>a.deadline.localeCompare(b.deadline)).slice(0,3).forEach(t=>next3.push({type:'Задача',title:t.title,date:t.deadline}));
  const debtors = db.funds.payments.filter(p=>!p.paid).map(p=>db.students.find(s=>s.id===p.studentId)?.fullName).filter(Boolean).slice(0,5);

  openModal(`
    <h3>🚨 Всё под контролем</h3>
    <div class="panic-card"><b>Ближайшие дедлайны</b><br>${next3.length ? next3.map(x=>`${escapeHtml(x.title)} — ${fmtDate(isoToMs(x.date))}`).join('<br>') : 'Нет срочного'}</div>
    <div class="panic-card" style="background:linear-gradient(135deg,var(--warning),#d97706)"><b>Должники по взносам</b><br>${debtors.length ? debtors.map(escapeHtml).join(', ') : 'Все сдали 🎉'}</div>
    <div class="panic-card" style="background:linear-gradient(135deg,var(--accent),var(--accent-dark))"><b>Сегодня</b><br>${db.schedule.filter(x=>x.date===today).length} пар · ${db.tasks.filter(t=>!t.done && t.deadline===today).length} задач · ${db.events.filter(e=>e.date===today).length} событий</div>
    <div class="modal-actions"><button type="button" class="btn-primary compact" data-close-modal>Выдохнуть</button></div>
  `);
}

/* ============ "ЕЩЁ" ============ */
function renderMore(view) {
  view.innerHTML = `
    <div class="more-grid">
      <div class="glass more-tile" data-goto="tasks"><span class="more-icon">✅</span><div class="more-label">Задачи</div></div>
      <div class="glass more-tile" data-goto="funds"><span class="more-icon">💸</span><div class="more-label">Взносы</div></div>
      <div class="glass more-tile" data-goto="notes"><span class="more-icon">📝</span><div class="more-label">Заметки</div></div>
      <div class="glass more-tile" data-goto="stats"><span class="more-icon">📊</span><div class="more-label">Статистика</div></div>
      <div class="glass more-tile" data-goto="settings"><span class="more-icon">⚙️</span><div class="more-label">Настройки</div></div>
    </div>
    <div class="section-title">Быстрые действия</div>
    <div class="glass quick-action" id="qa-announce"><span class="qa-icon">📢</span>Сгенерировать объявление</div>
    <div class="glass quick-action" id="qa-checklist"><span class="qa-icon">✅</span>Чек-лист старосты</div>
    <div class="glass quick-action" id="qa-search"><span class="qa-icon">🔍</span>Поиск везде</div>
  `;
  $all('[data-goto]').forEach(el => el.addEventListener('click', () => { location.hash = '#/'+el.dataset.goto; }));
  $('#qa-search').addEventListener('click', openSearch);
  $('#qa-announce').addEventListener('click', () => {
    if (!db.events.length) { showToast('Нет событий','error'); return; }
    const e = db.events.slice().sort((a,b)=>a.date.localeCompare(b.date)).find(x=>x.date>=todayISO()) || db.events[0];
    const text = `📌 ${e.title}\n📅 ${fmtDate(isoToMs(e.date))}${e.time?', '+e.time:''}${e.place?'\n📍 '+e.place:''}${e.description?'\n\n'+e.description:''}`;
    navigator.clipboard.writeText(text).then(()=>showToast('Скопировано в буфер','success')).catch(()=>showToast('Ошибка','error'));
  });
  $('#qa-checklist').addEventListener('click', () => {
    const items = db.checklist.length ? db.checklist : [
      { id:uid(), text:'Ведомость', done:false },
      { id:uid(), text:'Ручка', done:false },
      { id:uid(), text:'Зачётка', done:false },
    ];
    db.checklist = items; Store.saveDB(db);
    openModal(`
      <h3>Чек-лист старосты</h3>
      ${items.map(it=>`<div class="checklist-item ${it.done?'done':''}"><input type="checkbox" data-cl="${it.id}" ${it.done?'checked':''} /><span>${escapeHtml(it.text)}</span></div>`).join('')}
      <div class="modal-actions"><button type="button" class="btn-secondary" data-close-modal>Закрыть</button></div>
    `);
    $all('[data-cl]').forEach(cb => cb.addEventListener('change', () => {
      const it = db.checklist.find(x=>x.id===cb.dataset.cl);
      if (it) { it.done = cb.checked; Store.saveDB(db); }
    }));
  });
}

/* ============ НАСТРОЙКИ ============ */
function renderSettings(view) {
  const theme = localStorage.getItem('starosta_theme') || 'system';
  const accent = localStorage.getItem('starosta_accent') || 'indigo';
  const accents = ['indigo','violet','emerald','rose','amber','sky'];
  const colors = { indigo:'#6366f1', violet:'#8b5cf6', emerald:'#10b981', rose:'#f43f5e', amber:'#f59e0b', sky:'#0ea5e9' };

  view.innerHTML = `
    <div class="glass settings-section"><h4>Внешний вид</h4><div class="settings-row"><span>Тема</span><select id="set-theme"><option value="system" ${theme==='system'?'selected':''}>Системная</option><option value="light" ${theme==='light'?'selected':''}>Светлая</option><option value="dark" ${theme==='dark'?'selected':''}>Тёмная</option></select></div><div style="margin-top:12px"><div style="font-size:13px;color:var(--muted);margin-bottom:8px;font-weight:600">Акцент</div><div class="accent-picker">${accents.map(a=>`<div class="accent-dot ${accent===a?'selected':''}" data-accent="${a}" style="background:${colors[a]}"></div>`).join('')}</div></div></div>
    <div class="glass settings-section"><h4>Студенты</h4><button class="settings-btn" id="set-import-txt">Импорт студентов из TXT</button><input type="file" id="set-import-txt-file" accept=".txt,text/plain" class="hidden" /><p style="font-size:12px;color:var(--muted);margin:8px 0 0">Формат: <b>ФИО;ДД.ММ.ГГГГ</b></p></div>
    <div class="glass settings-section"><h4>Данные</h4><button class="settings-btn" id="set-export">Экспорт JSON</button><button class="settings-btn" id="set-import">Импорт JSON</button><input type="file" id="set-import-file" accept="application/json" class="hidden" /><button class="settings-btn danger" id="set-reset">Сбросить всё</button></div>
    <div class="glass settings-section"><h4>Аккаунт</h4><button class="settings-btn" id="set-logout">Выйти</button></div>
  `;

  $('#set-theme').addEventListener('change', e => { localStorage.setItem('starosta_theme', e.target.value); applyTheme(); });
  $all('[data-accent]').forEach(el => el.addEventListener('click', () => { localStorage.setItem('starosta_accent', el.dataset.accent); applyAccent(); renderSettings(view); }));
  $('#set-import-txt').addEventListener('click', () => $('#set-import-txt-file').click());
  $('#set-import-txt-file').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const text = await f.text(); const r = importStudentsFromTxt(text); showToast(`Добавлено: ${r.added}, пропущено: ${r.skipped}, ошибок: ${r.errors}`,'success',4000); e.target.value=''; render(); }
    catch (err) { showToast('Ошибка: '+err.message,'error'); }
  });
  $('#set-export').addEventListener('click', () => { Store.exportDB(); unlockAchievement('backup'); showToast('JSON скачан','success'); });
  $('#set-import').addEventListener('click', () => $('#set-import-file').click());
  $('#set-import-file').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { await Store.importDB(f); showToast('Импорт успешен','success'); render(); } catch { showToast('Ошибка импорта','error'); }
  });
  $('#set-reset').addEventListener('click', () => { if (!confirm('Удалить ВСЕ данные?')) return; Store.resetDB(); showToast('Данные удалены','info'); render(); });
  $('#set-logout').addEventListener('click', () => { Auth.endSession(); location.hash = '#/login'; render(); });
}

/* ============ ТЕМА ============ */
function applyTheme() {
  const t = localStorage.getItem('starosta_theme') || 'system';
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.classList.toggle('dark', dark);
}
function applyAccent() { document.body.dataset.accent = localStorage.getItem('starosta_accent') || 'indigo'; }

function cleanupPastSchedule() {
  const today = todayISO();
  const before = db.schedule.length;
  db.schedule = db.schedule.filter(x => !x.date || x.date >= today);
  if (db.schedule.length !== before) Store.saveDB(db);
}

/* ============ АВТОРИЗАЦИЯ ============ */
function initOnboarding() {
  $('#onboarding-form').addEventListener('submit', async e => {
    e.preventDefault();
    const u = $('#ob-username').value.trim(), p1 = $('#ob-password').value, p2 = $('#ob-password2').value;
    const err = $('#ob-error'); err.textContent = '';
    if (u.length < 3) { err.textContent = 'Логин короткий'; return; }
    if (p1.length < 6) { err.textContent = 'Пароль минимум 6 символов'; return; }
    if (p1 !== p2) { err.textContent = 'Пароли не совпадают'; return; }
    await Auth.createAccount(u, p1);
    Auth.startSession(u, true);
    location.hash = '#/dashboard'; render();
  });
}
function initLogin() {
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#login-error'); err.textContent = '';
    const lock = Auth.isLocked();
    if (lock.locked) { err.textContent = `Подождите ${lock.secondsLeft} сек.`; return; }
    const u = $('#login-username').value, p = $('#login-password').value;
    const ok = await Auth.verifyCredentials(u, p);
    if (!ok) { Auth.registerFailedAttempt(); err.textContent = 'Неверный логин или пароль'; return; }
    Auth.clearFailedAttempts();
    Auth.startSession(Auth.getAuth().username, $('#login-remember').checked);
    location.hash = '#/dashboard'; render();
  });
}

/* ============ СТАРТ ============ */
function boot() {
  initOnboarding();
  initLogin();
  applyTheme();
  applyAccent();
  window.addEventListener('hashchange', render);
  document.addEventListener('click', e => { if (e.target.matches('[data-close-modal]')) closeModal(); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => {});
  if (!location.hash) location.hash = '#/dashboard';
  db = Store.loadDB();
  cleanupPastSchedule();
  updateStreak();
  $('#btn-panic').addEventListener('click', openPanic);
  $('#btn-search').addEventListener('click', openSearch);
  render();
}
document.addEventListener('DOMContentLoaded', boot);
