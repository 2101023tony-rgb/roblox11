(() => {
  const cfg = window.ROBUX_PLAY_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const toast = (message) => { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2600); };
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !String(cfg.SUPABASE_URL).includes('YOUR_') && !String(cfg.SUPABASE_ANON_KEY).includes('YOUR_');
  let client = null, currentUser = null, currentProfile = null, isAdmin = false, campaigns = [];
  $('year').textContent = new Date().getFullYear();
  const sponsorHref = `mailto:${encodeURIComponent(cfg.SPONSOR_EMAIL || 'hello@example.com')}?subject=${encodeURIComponent('[ROBUX PLAY] 브랜드 제휴 문의')}`;
  $('sponsorLink').href = sponsorHref; $('footerContact').href = `mailto:${cfg.SPONSOR_EMAIL || 'hello@example.com'}`;

  function setConnection(ok, label) { const b = $('connectionBadge'); b.className = `status-pill ${ok ? 'connected' : 'pending'}`; b.innerHTML = `<i></i>${label}`; }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function validUrl(raw) { try { const u = new URL(raw); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } }

  async function init() {
    if (!configured || !window.supabase?.createClient) {
      setConnection(false, '서버 설정 필요');
      $('offerGrid').innerHTML = '<div class="empty-state"><b>서비스 연결 설정이 필요합니다.</b><br>관리자가 Supabase 프로젝트를 연결하면 승인된 제휴 혜택이 이곳에 표시됩니다.</div>';
      return;
    }
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    try {
      let { data: { session } } = await client.auth.getSession();
      if (!session) { const { data, error } = await client.auth.signInAnonymously(); if (error) throw error; session = data.session; }
      currentUser = session.user;
      await loadProfile(); await loadCampaigns(); await checkAdmin();
      setConnection(true, '서버 연결됨');
      client.auth.onAuthStateChange((_event, sessionNow) => { if (sessionNow?.user) { currentUser = sessionNow.user; } });
    } catch (e) {
      console.error(e); setConnection(false, '연결 오류');
      $('offerGrid').innerHTML = `<div class="empty-state">서버 연결에 실패했습니다.<br><small>${esc(e.message || 'Supabase 설정과 SQL 적용 여부를 확인하세요.')}</small></div>`;
    }
  }
  async function loadProfile() {
    const { data, error } = await client.from('profiles').select('display_name,show_on_board,referral_code').eq('id', currentUser.id).maybeSingle();
    if (error) throw error;
    currentProfile = data;
    if (data?.display_name) {
      $('welcomeTitle').textContent = `${data.display_name}님, 환영해요!`;
      $('welcomeSub').textContent = '닉네임으로 커뮤니티를 이용하고 있어요.';
      $('nicknameInput').value = data.display_name; 
      $('editProfileButton').textContent = '프로필 수정';
      $('copyInviteButton').classList.remove('hidden');
    } else {
      $('welcomeTitle').textContent = 'ROBUX PLAY에 오신 걸 환영해요';
      $('welcomeSub').textContent = '닉네임을 설정하면 커뮤니티 기능을 이용할 수 있어요.';
    }
  }
  async function copyInvite() {
    if (!currentProfile?.referral_code) return toast('먼저 닉네임을 저장해 주세요.');
    const invite = `${location.origin}${location.pathname}?ref=${encodeURIComponent(currentProfile.referral_code)}`;
    try { await navigator.clipboard.writeText(invite); toast('초대 링크를 복사했어요.'); } catch { toast(invite); }
  }
  async function saveProfile(ev) {
    ev.preventDefault();
    if (!client || !currentUser) return toast('서버 연결 후 이용할 수 있어요.');
    const name = $('nicknameInput').value.trim();
    if (!/^[가-힣a-zA-Z0-9_]{2,16}$/.test(name)) return toast('닉네임은 한글·영문·숫자·_로 2~16자 입력해 주세요.');
    const ref = new URLSearchParams(location.search).get('ref');
    const { error } = await client.rpc('save_my_profile', { p_display_name: name, p_show_on_board: false, p_referral_code: ref || null });
    if (error) return toast(error.message.includes('duplicate') ? '이미 사용 중인 닉네임입니다.' : `저장 실패: ${error.message}`);
    await loadProfile(); $('profileDialog').close(); toast('프로필을 저장했어요.');
  }
  async function loadCampaigns() {
    const { data, error } = await client.from('campaigns').select('id,partner_name,title,description,destination_url,disclosure,created_at').eq('status','published').eq('minor_approved',true).order('created_at',{ascending:false});
    if (error) throw error;
    campaigns = data || []; $('offerCount').textContent = `${campaigns.length}개`;
    if (!campaigns.length) { $('offerGrid').innerHTML = '<div class="empty-state"><span class="empty-symbol">✧</span><b>아직 공개된 제휴 혜택이 없어요.</b><br>검토와 승인을 마친 캠페인이 등록되면 여기에 표시됩니다.</div>'; return; }
    $('offerGrid').innerHTML = campaigns.map(c => `<article class="offer-card"><div class="offer-top"><span class="offer-label">PARTNER OFFER</span><span class="offer-arrow">↗</span></div><div class="partner-name">${esc(c.partner_name)}</div><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><div class="offer-disclosure">${esc(c.disclosure || '제휴 캠페인')}</div><button class="btn btn-primary offer-open" data-id="${esc(c.id)}">혜택 확인하기 <span>↗</span></button></article>`).join('');
    $('offerGrid').querySelectorAll('.offer-open').forEach(btn => btn.addEventListener('click', () => openCampaign(btn.dataset.id)));
  }
  async function openCampaign(id) {
    const c = campaigns.find(x => x.id === id); if (!c) return;
    if (!validUrl(c.destination_url)) return toast('안전한 HTTPS 제휴 링크가 아닙니다.');
    const { error } = await client.from('campaign_clicks').insert({ campaign_id: c.id });
    if (error) console.warn('Click event not recorded:', error.message);
    window.open(c.destination_url, '_blank', 'noopener,noreferrer');
  }
  async function checkAdmin() {
    const { data, error } = await client.rpc('is_my_admin');
    if (!error && data === true) { isAdmin = true; $('adminSection').classList.remove('hidden'); await loadAdminCampaigns(); }
  }
  async function loadAdminCampaigns() {
    const { data, error } = await client.from('campaigns').select('id,partner_name,title,status,minor_approved').order('created_at',{ascending:false});
    if (error) { $('adminCampaignList').textContent = error.message; return; }
    const clickResult = await client.from('campaign_clicks').select('campaign_id');
    const clickCounts = {}; (clickResult.data || []).forEach(row => clickCounts[row.campaign_id] = (clickCounts[row.campaign_id] || 0) + 1);
    $('adminCampaignList').innerHTML = (data || []).map(c => `<div class="admin-item"><div><b>${esc(c.title)}</b><small>${esc(c.partner_name)} · ${esc(c.status)} · 클릭 ${clickCounts[c.id] || 0}회 · 미성년자 승인 ${c.minor_approved?'완료':'미완료'}</small></div><button class="mini-button" data-toggle="${c.id}" data-status="${c.status}">${c.status === 'published' ? '내리기' : '게시'}</button><button class="mini-button danger" data-delete="${c.id}">삭제</button></div>`).join('') || '등록된 캠페인이 없습니다.';
    $('adminCampaignList').querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
      const row = data.find(x => x.id === b.dataset.toggle); if (!row) return;
      const next = row.status === 'published' ? 'paused' : 'published';
      const { error } = await client.from('campaigns').update({status:next}).eq('id',row.id);
      if (error) return toast(error.message); await loadAdminCampaigns(); await loadCampaigns();
    }));
    $('adminCampaignList').querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('이 캠페인을 삭제할까요?')) return;
      const { error } = await client.from('campaigns').delete().eq('id',b.dataset.delete);
      if (error) return toast(error.message); await loadAdminCampaigns(); await loadCampaigns();
    }));
  }
  async function publishCampaign() {
    if (!isAdmin) return toast('관리자 권한이 필요합니다.');
    const partner = $('partnerInput').value.trim(), title = $('titleInput').value.trim(), desc = $('descriptionInput').value.trim(), url = $('urlInput').value.trim(), disclosure = $('disclosureInput').value.trim(), minor = $('minorApprovedInput').checked;
    if (!partner || !title || !desc || !url || !disclosure) return toast('모든 항목을 입력해 주세요.');
    if (!validUrl(url)) return toast('제휴 링크는 HTTPS 주소만 등록할 수 있어요.');
    if (!minor) return toast('미성년자 이용을 서면 허용받고 검토한 캠페인만 게시할 수 있어요.');
    const { error } = await client.from('campaigns').insert({partner_name:partner,title,description:desc,destination_url:url,disclosure,minor_approved:true,status:'published'});
    if (error) return toast(`등록 실패: ${error.message}`);
    ['partnerInput','titleInput','descriptionInput','urlInput','disclosureInput'].forEach(id => $(id).value=''); $('minorApprovedInput').checked=false;
    await loadAdminCampaigns(); await loadCampaigns(); toast('캠페인을 등록했어요.');
  }
  $('copyInviteButton').addEventListener('click', copyInvite);
  $('editProfileButton').addEventListener('click', () => { if (!client) return toast('운영자가 서버 설정을 완료해야 해요.'); $('profileDialog').showModal(); });
  $('profileButton').addEventListener('click', () => $('editProfileButton').click());
  $('profileForm').addEventListener('submit', saveProfile);
  $('publishButton').addEventListener('click', publishCampaign);
  document.querySelectorAll('.mobile-nav a').forEach(a => a.addEventListener('click', () => { document.querySelectorAll('.mobile-nav a').forEach(x=>x.classList.remove('active')); a.classList.add('active'); }));
  init();
})();
