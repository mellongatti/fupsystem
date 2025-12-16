(function(){
  const STORAGE_KEY = 'followup_clients_v1';

  // State
  let clients = [];
  let selectedId = null;
  let currentFilter = 'all';
  let currentQuery = '';

  // Elements
  const el = {
    form: null,
    name: null,
    followup: null,
    agendaList: null,
    search: null,
    filters: null,
    details: null,
    exportBtn: null,
    importBtn: null,
    importFile: null,
  };

  document.addEventListener('DOMContentLoaded', init);

  function init(){
    // Bind elements
    el.form = document.getElementById('client-form');
    el.name = document.getElementById('company-name');
    el.followup = document.getElementById('next-followup');
    el.agendaList = document.getElementById('agenda-list');
    el.search = document.getElementById('search');
    el.filters = document.querySelectorAll('.btn.filter');
    el.details = document.getElementById('details');
    el.exportBtn = document.getElementById('export-btn');
    el.importBtn = document.getElementById('import-btn');
    el.importFile = document.getElementById('import-file');

    // Events
    el.form.addEventListener('submit', onAddClient);
    el.search.addEventListener('input', onSearch);
    el.filters.forEach(btn => btn.addEventListener('click', () => onFilter(btn)));
    if(el.exportBtn) el.exportBtn.addEventListener('click', exportData);
    if(el.importBtn) el.importBtn.addEventListener('click', () => el.importFile && el.importFile.click());
    if(el.importFile) el.importFile.addEventListener('change', () => {
      const f = el.importFile.files && el.importFile.files[0];
      if(!f) return;
      importFromFile(f);
      el.importFile.value = '';
    });

    // Load and render
    initSupabase();
  }

  // Persistence
  function load(){
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if(!s) return [];
      const data = JSON.parse(s);
      return Array.isArray(data) ? data : [];
    } catch(e){
      console.error('Erro ao carregar dados', e);
      return [];
    }
  }
  function save(){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    } catch(e){
      console.error('Erro ao salvar dados', e);
    }
  }

  // Supabase client (somente gravação silenciosa)
  const SUPABASE_URL = 'https://puvhtrotldejdcjpplzm.supabase.co';
  const SUPABASE_ANON_KEY = '';// TODO: cole aqui sua Anon public key
  let supabase = null;
  async function initSupabase(){
    if(window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY){
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      supabase = null;
    }
    // Não carregamos dados do Supabase; apenas gravamos silenciosamente
    clients = load();
    renderFilters();
    renderAgenda();
    renderDetails();
  }

  function exportData(){
    try {
      const data = JSON.stringify(clients, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `followup_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch(e){
      alert('Falha ao exportar dados.');
      console.error(e);
    }
  }

  function importFromFile(file){
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result || '[]'));
        const sanitized = sanitizeData(json);
        if(!Array.isArray(sanitized)) throw new Error('Formato inválido');
        const ok = confirm('Isso vai substituir os dados atuais. Deseja continuar?');
        if(!ok) return;
        clients = sanitized;
        save();
        renderAgenda();
        renderDetails();
      } catch(e){
        alert('Arquivo inválido. Certifique-se de usar um backup exportado deste app.');
        console.error(e);
      }
    };
    reader.onerror = () => {
      alert('Não foi possível ler o arquivo para importação.');
    };
    reader.readAsText(file);
  }

  function sanitizeData(data){
    if(!Array.isArray(data)) return [];
    return data.map(c => {
      const id = typeof c.id === 'string' ? c.id : uid();
      const name = typeof c.name === 'string' ? c.name : '';
      const nf = c.nextFollowUp == null ? null : Number(c.nextFollowUp);
      const nextFollowUp = Number.isFinite(nf) ? nf : null;
      const notes = Array.isArray(c.notes) ? c.notes.map(n => ({
        id: typeof n.id === 'string' ? n.id : uid(),
        text: typeof n.text === 'string' ? n.text : '',
        at: Number.isFinite(Number(n.at)) ? Number(n.at) : Date.now(),
      })) : [];
      return { id, name, nextFollowUp, notes };
    });
  }

  // Helpers
  function uid(){
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function parseDateTimeLocal(val){
    if(!val) return null;
    const t = Date.parse(val);
    return Number.isNaN(t) ? null : t;
  }
  function formatDateTime(ts){
    if(ts == null) return 'Sem data';
    const d = new Date(ts);
    try {
      return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
    } catch(e){
      return d.toLocaleString('pt-BR');
    }
  }
  function daysDiffFromNow(ts){
    const now = Date.now();
    const msDay = 24*60*60*1000;
    // Round both to local day
    const start = new Date(now);
    start.setHours(0,0,0,0);
    const target = new Date(ts);
    target.setHours(0,0,0,0);
    const diff = Math.round((target.getTime() - start.getTime())/msDay);
    return diff; // negative = past
  }
  function statusFor(client){
    if(client.nextFollowUp == null) return 'nodate';
    const d = daysDiffFromNow(client.nextFollowUp);
    if(d < 0) return 'overdue';
    if(d === 0) return 'today';
    return 'upcoming';
  }
  function statusLabel(st, ts){
    switch(st){
      case 'overdue': {
        const d = Math.abs(daysDiffFromNow(ts));
        return d === 1 ? 'Atrasado 1 dia' : `Atrasado ${d} dias`;
      }
      case 'today': return 'Hoje';
      case 'upcoming': {
        const d = daysDiffFromNow(ts);
        return d === 1 ? 'Amanhã' : `Em ${d} dias`;
      }
      case 'nodate': return 'Sem data';
    }
    return '';
  }

  // Actions
  async function onAddClient(e){
    e.preventDefault();
    const name = el.name.value.trim();
    const next = parseDateTimeLocal(el.followup.value);
    if(!name){
      el.name.focus();
      return;
    }
    const c = { id: uid(), name, nextFollowUp: next, notes: [] };
    clients.push(c);
    save();
    // Supabase sync
    try { await supabaseUpsertClient(c); } catch(e){ console.warn('Supabase upsert falhou', e); }
    el.form.reset();
    currentQuery = '';
    selectedId = c.id;
    renderAgenda();
    renderDetails();
  }
  function onSearch(e){
    currentQuery = (e.target.value || '').trim().toLowerCase();
    renderAgenda();
  }
  function onFilter(btn){
    el.filters.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter || 'all';
    renderAgenda();
  }
  function setSelected(id){
    selectedId = id;
    renderAgenda();
    renderDetails();
  }

  // Rendering
  function renderFilters(){
    // default to 'all'
    const def = Array.from(el.filters).find(b => b.dataset.filter === 'all');
    if(def) def.classList.add('active');
  }

  function renderAgenda(){
    const container = el.agendaList;
    container.innerHTML = '';

    let list = [...clients];
    // Filter by search
    if(currentQuery){
      list = list.filter(c => c.name.toLowerCase().includes(currentQuery));
    }
    // Filter by status
    list = list.filter(c => {
      const st = statusFor(c);
      if(currentFilter === 'all') return true;
      if(currentFilter === 'today') return st === 'today';
      if(currentFilter === 'week'){
        if(c.nextFollowUp == null) return false;
        const d = daysDiffFromNow(c.nextFollowUp);
        return d >= 0 && d <= 7; // next 7 days including today
      }
      if(currentFilter === 'overdue') return st === 'overdue';
      if(currentFilter === 'nodate') return st === 'nodate';
      return true;
    });

    // Sort: by nextFollowUp asc, nulls last, then by name
    list.sort((a,b) => {
      const an = a.nextFollowUp ?? Infinity;
      const bn = b.nextFollowUp ?? Infinity;
      if(an !== bn) return an - bn;
      return a.name.localeCompare(b.name);
    });

    if(list.length === 0){
      const empty = document.createElement('div');
      empty.className = 'placeholder';
      empty.textContent = 'Nenhum cliente encontrado.';
      container.appendChild(empty);
      return;
    }

    list.forEach(c => {
      const st = statusFor(c);
      const item = document.createElement('div');
      item.className = 'agenda-item';
      item.setAttribute('role','button');
      item.setAttribute('tabindex','0');
      item.addEventListener('click', () => setSelected(c.id));
      item.addEventListener('keydown', (ev) => { if(ev.key === 'Enter') setSelected(c.id); });

      const left = document.createElement('div');
      left.className = 'left';
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = c.name;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = c.nextFollowUp != null ? `Próximo: ${formatDateTime(c.nextFollowUp)}` : 'Sem próximo follow-up';
      left.appendChild(title);
      left.appendChild(meta);

      const right = document.createElement('div');
      const badge = document.createElement('span');
      badge.className = `badge ${st}`;
      badge.textContent = statusLabel(st, c.nextFollowUp);
      right.appendChild(badge);

      item.appendChild(left);
      item.appendChild(right);

      if(c.id === selectedId){
        item.style.borderColor = 'var(--primary)';
      }

      container.appendChild(item);
    });
  }

  function renderDetails(){
    const container = el.details;
    container.innerHTML = '';
    const client = clients.find(c => c.id === selectedId);
    if(!client){
      const placeholder = document.createElement('div');
      placeholder.className = 'placeholder';
      placeholder.textContent = 'Selecione um cliente na agenda para ver detalhes.';
      container.appendChild(placeholder);
      return;
    }

    const header = document.createElement('div');
    header.className = 'header';

    // Editable name
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = client.name;
    nameInput.placeholder = 'Nome da empresa';
    nameInput.addEventListener('change', () => {
      client.name = nameInput.value.trim() || client.name;
      save();
      renderAgenda();
    });

    // Editable next follow-up
    const nextInput = document.createElement('input');
    nextInput.type = 'datetime-local';
    nextInput.value = client.nextFollowUp ? toDateTimeLocalValue(client.nextFollowUp) : '';
    const saveNextBtn = document.createElement('button');
    saveNextBtn.className = 'btn';
    saveNextBtn.textContent = 'Salvar follow-up';
    saveNextBtn.addEventListener('click', () => {
      const parsed = parseDateTimeLocal(nextInput.value);
      client.nextFollowUp = parsed;
      save();
      renderAgenda();
      renderDetails();
    });

    header.appendChild(nameInput);
    const actions = document.createElement('div');

    const markDoneBtn = document.createElement('button');
    markDoneBtn.className = 'btn';
    markDoneBtn.textContent = 'Marcar como feito';

    const deleteClientBtn = document.createElement('button');
    deleteClientBtn.className = 'btn small danger';
    deleteClientBtn.textContent = '🗑';
    deleteClientBtn.setAttribute('title', 'Excluir cliente');
    deleteClientBtn.setAttribute('aria-label', 'Excluir cliente');

    actions.className = 'actions';
    actions.appendChild(nextInput);
    actions.appendChild(saveNextBtn);
    actions.appendChild(markDoneBtn);
    actions.appendChild(deleteClientBtn);
    header.appendChild(actions);

    saveNextBtn.addEventListener('click', async () => {
      const parsed = parseDateTimeLocal(nextInput.value);
      client.nextFollowUp = parsed;
      save();
      try { await supabaseUpdateClient(client); } catch(e){ console.warn('Supabase update falhou', e); }
      renderAgenda();
      renderDetails();
    });

    markDoneBtn.addEventListener('click', async () => {
      const defaultDays = 7;
      const input = prompt('Em quantos dias deseja agendar o próximo follow-up? (padrão: 7)', String(defaultDays));
      const days = Math.max(1, parseInt(input || String(defaultDays), 10) || defaultDays);
      const msDay = 24*60*60*1000;
      const base = client.nextFollowUp || Date.now();
      client.nextFollowUp = base + days*msDay;
      const noteText = `Follow-up concluído. Próximo em ${days} dia(s) — ${formatDateTime(client.nextFollowUp)}`;
      client.notes = client.notes || [];
      const note = { id: uid(), text: noteText, at: Date.now() };
      client.notes.push(note);
      save();
      try {
        await supabaseUpdateClient(client);
        await supabaseInsertNote(client.id, note);
      } catch(e){ console.warn('Supabase mark done falhou', e); }
      renderAgenda();
      renderDetails();
    });

    deleteClientBtn.addEventListener('click', async () => {
      const ok = confirm(`Excluir o cliente "${client.name}" e todo o histórico?`);
      if(!ok) return;
      try { await supabaseDeleteClient(client.id); } catch(e){ console.warn('Supabase delete cliente falhou', e); }
      clients = clients.filter(c => c.id !== client.id);
      save();
      if(selectedId === client.id) selectedId = null;
      renderAgenda();
      renderDetails();
    });

    container.appendChild(header);

    // Notes
    const notes = document.createElement('div');
    notes.className = 'notes';
    const h3 = document.createElement('h3');
    h3.textContent = 'Histórico de notas';
    notes.appendChild(h3);

    const list = document.createElement('div');
    (client.notes || []).slice().sort((a,b) => b.at - a.at).forEach(n => {
      const ni = document.createElement('div');
      ni.className = 'note-item';
      const when = document.createElement('div');
      when.className = 'when';
      when.textContent = formatDateTime(n.at);
      const text = document.createElement('div');
      text.textContent = n.text;
      const del = document.createElement('button');
      del.className = 'btn small danger';
      del.textContent = 'Excluir';
      del.addEventListener('click', async () => {
        const ok = confirm('Excluir esta nota?');
        if(!ok) return;
        client.notes = (client.notes || []).filter(nn => nn.id !== n.id);
        save();
        try { await supabaseDeleteNote(n.id); } catch(e){ console.warn('Supabase delete nota falhou', e); }
        renderDetails();
      });
      ni.appendChild(when);
      ni.appendChild(text);
      ni.appendChild(del);
      list.appendChild(ni);
    });
    notes.appendChild(list);

    const newNote = document.createElement('div');
    newNote.className = 'note-new';
    const ta = document.createElement('textarea');
    ta.placeholder = 'Escreva uma nova nota (ex.: resumo da ligação, próximos passos, etc.)';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn primary';
    addBtn.textContent = 'Adicionar Nota';
    addBtn.addEventListener('click', async () => {
      const text = (ta.value || '').trim();
      if(!text) { ta.focus(); return; }
      client.notes = client.notes || [];
      const note = { id: uid(), text, at: Date.now() };
      client.notes.push(note);
      ta.value = '';
      save();
      try { await supabaseInsertNote(client.id, note); } catch(e){ console.warn('Supabase insert note falhou', e); }
      renderDetails();
    });
    newNote.appendChild(ta);
    newNote.appendChild(addBtn);

    notes.appendChild(newNote);
    container.appendChild(notes);
  }

  function toDateTimeLocalValue(ts){
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth()+1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  // Supabase data ops
  async function loadFromSupabase(){
    if(!supabase) { clients = load(); return; }
    const { data: clientsData, error: cErr } = await supabase.from('clients').select('*');
    if(cErr) throw cErr;
    const { data: notesData, error: nErr } = await supabase.from('notes').select('*');
    if(nErr) throw nErr;
    const map = new Map();
    (clientsData || []).forEach(c => {
      map.set(c.id, { id: c.id, name: c.name, nextFollowUp: c.next_follow_up ?? null, notes: [] });
    });
    (notesData || []).forEach(n => {
      const arr = map.get(n.client_id);
      if(arr){
        arr.notes.push({ id: n.id, text: n.text, at: n.at });
      }
    });
    clients = Array.from(map.values());
    save(); // cache local
  }
  async function supabaseUpsertClient(c){
    if(!supabase) return;
    await supabase.from('clients').upsert({ id: c.id, name: c.name, next_follow_up: c.nextFollowUp });
  }
  async function supabaseUpdateClient(c){
    if(!supabase) return;
    await supabase.from('clients').update({ name: c.name, next_follow_up: c.nextFollowUp }).eq('id', c.id);
  }
  async function supabaseInsertNote(clientId, note){
    if(!supabase) return;
    await supabase.from('notes').insert({ id: note.id, client_id: clientId, text: note.text, at: note.at });
  }
  async function supabaseDeleteClient(clientId){
    if(!supabase) return;
    await supabase.from('clients').delete().eq('id', clientId);
  }
  async function supabaseDeleteNote(noteId){
    if(!supabase) return;
    await supabase.from('notes').delete().eq('id', noteId);
  }
})();