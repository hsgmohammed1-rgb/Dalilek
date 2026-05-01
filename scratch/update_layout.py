import re

with open('bulk-admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Update CSS for light theme and sidebar layout
new_css = """
  *{box-sizing:border-box}
  :root{
    --brand:#009688;
    --brand-2:#00bfa5;
    --brand-soft:rgba(0,150,136,.12);
    --bg:#f8fafc;
    --bg-2:#f1f5f9;
    --panel:#ffffff;
    --panel-2:#f8fafc;
    --panel-3:#f1f5f9;
    --border:#e2e8f0;
    --border-strong:#cbd5e1;
    --text:#0f172a;
    --muted:#64748b;
    --muted-2:#475569;
    --warn:#f59e0b;
    --danger:#ef4444;
    --success:#10b981;
    --sidebar-w:260px;
  }
  html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:'Tajawal',sans-serif;min-height:100vh}
  a{color:var(--brand);text-decoration:none}
  
  /* App Layout */
  .app-layout {
    display: flex;
    min-height: 100vh;
  }
  
  /* Sidebar */
  .sidebar {
    width: var(--sidebar-w);
    background: var(--panel);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    height: 100vh;
    z-index: 50;
  }
  .sidebar-header {
    padding: 24px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid var(--border);
  }
  .sidebar-logo-icon {
    width: 36px;
    height: 36px;
    background: var(--brand);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }
  .sidebar-logo-text {
    font-weight: 800;
    font-size: 16px;
    line-height: 1.2;
  }
  .sidebar-logo-text span {
    font-size: 11px;
    color: var(--muted);
    font-weight: 500;
  }
  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 10px;
    color: var(--muted-2);
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s;
  }
  .nav-item:hover {
    background: var(--bg-2);
    color: var(--text);
  }
  .nav-item.active {
    background: var(--brand);
    color: white;
  }
  .nav-item.sub-active {
    background: var(--brand-soft);
    color: var(--brand);
  }
  .nav-badge {
    margin-right: auto;
    background: var(--brand-soft);
    color: var(--brand);
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 11px;
  }
  .sidebar-footer {
    padding: 16px;
    border-top: 1px solid var(--border);
  }
  
  /* Main Content Area */
  .main-area {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  /* Header inside main area */
  header{padding:18px 28px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.85);backdrop-filter:blur(12px);position:sticky;top:0;z-index:40}
  .brand-row{display:flex;align-items:center;gap:14px}
  .brand-text h1{margin:0;font-size:18px;font-weight:800;color:var(--text)}
  .brand-text .sub{font-size:12px;color:var(--muted);margin-top:2px}
  .header-right{display:flex;gap:14px;align-items:center;font-size:13px;color:var(--muted)}
  .user-chip{display:flex;align-items:center;gap:10px;background:var(--panel-2);padding:6px 14px;border-radius:99px;border:1px solid var(--border);cursor:pointer}
  .user-chip img{width:26px;height:26px;border-radius:50%}
  .user-chip .name-wrap {display:flex;flex-direction:column;line-height:1.2}
  .user-chip .name{font-size:13px;color:var(--text);font-weight:700}
  .user-chip .email{font-size:11px;color:var(--muted)}

  main{max-width:1100px;margin:0 auto;padding:32px 28px;width:100%}

  .page-title{display:flex;align-items:center;gap:16px;margin-bottom:28px}
  .page-title-icon{width:52px;height:52px;border-radius:14px;background:var(--brand-soft);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--brand)}
  .page-title h2{margin:0;font-size:24px;font-weight:800}
  .page-title p{margin:4px 0 0 0;font-size:14px;color:var(--muted)}

  .card{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:26px;margin-bottom:20px;box-shadow:0 4px 6px -1px rgba(0,0,0,.05),0 2px 4px -2px rgba(0,0,0,.05)}
  .card-head{display:flex;align-items:center;gap:12px;margin-bottom:8px}
  .card-num{background:var(--brand-soft);color:var(--brand);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0}
  .card-head h3{margin:0;font-size:18px;font-weight:800}
  .card .desc{color:var(--muted-2);font-size:13.5px;margin:0 0 20px 0;line-height:1.7}

  label{display:block;font-size:13px;color:var(--text);margin-bottom:8px;font-weight:700}
  input,select,textarea{width:100%;background:var(--panel);color:var(--text);border:1px solid var(--border-strong);border-radius:10px;padding:12px 14px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
  input:focus,select:focus,textarea:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(0,150,136,.15)}
  textarea{resize:vertical;min-height:80px}

  .row{display:grid;gap:16px}
  .row.cols-2{grid-template-columns:1fr 1fr}
  .row.cols-3{grid-template-columns:1fr 1fr 1fr}
  @media(max-width:760px){.row.cols-2,.row.cols-3{grid-template-columns:1fr}}

  button{cursor:pointer;border:none;border-radius:10px;padding:12px 20px;font-size:14px;font-weight:700;transition:transform .08s,opacity .15s,box-shadow .15s;font-family:inherit}
  button:active{transform:scale(.98)}
  button:disabled{opacity:.6;cursor:not-allowed;transform:none}
  .btn-primary{background:var(--brand);color:white;box-shadow:0 4px 12px rgba(0,150,136,.25)}
  .btn-primary:hover:not(:disabled){background:var(--brand-2);box-shadow:0 6px 16px rgba(0,191,165,.35)}
  .btn-secondary{background:var(--panel);color:var(--text);border:1px solid var(--border-strong)}
  .btn-secondary:hover:not(:disabled){border-color:var(--brand);color:var(--brand)}
  .btn-success{background:var(--success);color:white}
  .btn-danger{background:rgba(239,68,68,.1);color:var(--danger);border:1px solid rgba(239,68,68,.2)}
  .btn-ghost{background:transparent;color:var(--muted);border:1px solid transparent}
  .btn-ghost:hover{color:var(--danger);background:rgba(239,68,68,.05)}

  .badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid currentColor}
  .badge.ok{color:var(--success)}
  .badge.warn{color:var(--warn)}
  .badge.err{color:var(--danger)}
  .badge.idle{color:var(--muted)}
  .err-detail{margin-top:6px;padding:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:8px;font-size:12px;color:var(--danger);line-height:1.5;max-width:340px;word-break:break-word;cursor:pointer}
  .err-detail .why{color:var(--danger);font-weight:800;margin-bottom:3px;display:block}
  .err-detail .full{display:none;margin-top:6px;color:var(--muted-2);font-size:11px;font-family:monospace;background:rgba(0,0,0,.05);padding:8px;border-radius:6px;max-height:140px;overflow:auto}
  .err-detail.expanded .full{display:block}
  .retry-btn{margin-top:6px;background:white;color:var(--text);border:1px solid var(--border-strong);border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;font-weight:700}
  .retry-btn:hover{background:var(--bg-2);border-color:var(--brand)}

  .topic-row{display:flex;gap:14px;align-items:flex-start;padding:14px;border-radius:12px;background:var(--panel-2);margin-bottom:10px;border:1px solid var(--border);transition:border-color .15s}
  .topic-row:hover{border-color:var(--border-strong)}
  .topic-row .idx{width:32px;height:32px;border-radius:50%;background:var(--brand-soft);color:var(--brand);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;margin-top:5px}
  .topic-row .col{flex:1;min-width:0}
  .topic-row input{background:var(--panel)}
  .topic-row .status{flex-shrink:0;align-self:center;font-size:12px;min-width:100px;text-align:center}
  .topic-row button{padding:8px;font-size:16px}
  .topic-row .thumb{flex-shrink:0;width:70px;height:70px;border-radius:8px;background:var(--border);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:11px;overflow:hidden;position:relative;align-self:center;border:1px solid var(--border-strong)}
  .topic-row .thumb img{width:100%;height:100%;object-fit:cover;display:block}
  .topic-row .thumb .vbadge{position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.6);color:#fff;font-size:10px;padding:2px 5px;border-radius:4px}
  .topic-row .thumb.loading{animation:pulse 1.2s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}

  .progress-bar{height:12px;background:var(--panel-2);border-radius:99px;overflow:hidden;margin:16px 0;border:1px solid var(--border)}
  .progress-bar .fill{height:100%;background:var(--brand);transition:width .3s}

  .stats-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}
  .stat-pill{background:var(--panel-2);border:1px solid var(--border);padding:10px 18px;border-radius:12px;font-size:13px;color:var(--muted)}
  .stat-pill b{color:var(--text);font-size:16px;margin:0 6px;font-weight:800}

  .url-list{background:var(--panel-3);border:1px solid var(--border);border-radius:12px;padding:18px;max-height:380px;overflow-y:auto;font-family:monospace;font-size:13px;line-height:1.9;white-space:pre;direction:ltr;text-align:left;color:var(--text)}

  .toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:var(--text);color:white;padding:14px 24px;border-radius:12px;font-size:14px;box-shadow:0 10px 25px rgba(0,0,0,.2);z-index:100;animation:slidein .25s}
  .toast.success{background:var(--success)}
  .toast.error{background:var(--danger)}
  @keyframes slidein{from{opacity:0;transform:translate(-50%,15px)}to{opacity:1;transform:translate(-50%,0)}}

  .speed-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:10px}
  @media(max-width:760px){.speed-grid{grid-template-columns:1fr}}
  .provider-tabs{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
  .provider-tab{flex:1;min-width:120px;padding:12px 16px;background:var(--panel);border:1px solid var(--border-strong);border-radius:12px;cursor:pointer;text-align:center;font-size:14px;font-weight:700;color:var(--muted);transition:all .15s;display:flex;align-items:center;justify-content:center;gap:10px}
  .provider-tab:hover{border-color:var(--brand);color:var(--brand)}
  .provider-tab.active{background:var(--brand-soft);border-color:var(--brand);color:var(--brand)}
  .provider-tab .saved-dot{width:8px;height:8px;border-radius:50%;background:var(--brand);display:inline-block}
  
  .speed-card{background:var(--panel);border:1px solid var(--border-strong);border-radius:12px;padding:16px;cursor:pointer;transition:all .15s;text-align:center}
  .speed-card:hover{border-color:var(--brand)}
  .speed-card.active{background:var(--brand-soft);border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset}
  .speed-card .icon{font-size:26px;margin-bottom:8px}
  .speed-card .label{font-weight:800;font-size:15px;color:var(--text);margin-bottom:6px}
  .speed-card .desc{font-size:12px;color:var(--muted);line-height:1.6}

  .feature-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:16px}
  .feature{background:var(--panel-2);padding:16px;border-radius:12px;border:1px solid var(--border);font-size:13px;color:var(--muted-2);line-height:1.7}
  .feature b{display:block;color:var(--brand);font-size:14px;margin-bottom:6px;font-weight:800}

  .row-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px}
  .hidden{display:none!important}
  .small{font-size:12px;color:var(--muted)}
  .key-link{color:var(--brand);font-weight:600}
  .mini-row{display:flex;gap:10px;align-items:center;font-size:12.5px;color:var(--muted);margin-top:8px}
  .key-status{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:99px;background:var(--success);color:white;font-size:11px;font-weight:700}

  .gate{max-width:480px;margin:100px auto;padding:40px 36px;background:var(--panel);border:1px solid var(--border);border-radius:20px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.08)}
  .gate-icon{width:72px;height:72px;border-radius:18px;background:var(--brand-soft);display:inline-flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:20px}
  .gate h2{margin:0 0 10px 0;font-size:22px;color:var(--text)}
  .gate p{color:var(--muted);font-size:14.5px;margin:0 0 24px 0;line-height:1.7}
  .gate .err{color:var(--danger);font-size:13.5px;margin-top:16px;padding:12px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);border-radius:10px;text-align:right}
  .loader{display:inline-block;width:20px;height:20px;border:2px solid var(--brand);border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-left:8px}
  @keyframes spin{to{transform:rotate(360deg)}}
"""

# Extract everything between <style> and </style> and replace with new_css
html = re.sub(r'<style>.*?</style>', f'<style>\n{new_css}\n</style>', html, flags=re.DOTALL)

# HTML layout wrapper
app_start = '<div id="app" class="hidden app-layout">'
sidebar_html = """
  <aside class="sidebar">
    <div class="sidebar-header">
       <div class="sidebar-logo-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" y1="22" x2="12" y2="12"></line></svg>
       </div>
       <div class="sidebar-logo-text">دليلك<br><span>لوحة الإدارة</span></div>
    </div>
    <nav class="sidebar-nav">
       <a href="/admin" class="nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          لوحة التحكم
       </a>
       <a href="/admin" class="nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
          القوالب
          <span class="nav-badge">15</span>
       </a>
       <a href="/admin" class="nav-item sub-active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
          إنشاء مقال ذكي
       </a>
       <a href="/admin/bulk" class="nav-item active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M8 11h8"></path><path d="M8 15h5"></path></svg>
          عمل مقالات
       </a>
       <a href="/admin" class="nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          المقالات
       </a>
       <a href="/admin" class="nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
          التصنيفات
       </a>
       <a href="/admin" class="nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          المستخدمون
       </a>
       <a href="/admin" class="nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          النشرة البريدية
       </a>
       <a href="/admin" class="nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          رسائل التواصل
       </a>
       <a href="/admin" class="nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          الإحصائيات
       </a>
       <a href="/admin" class="nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          الإعدادات
       </a>
    </nav>
    <div class="sidebar-footer">
       <div class="user-chip">
         <img id="userAvatar" src="" alt="">
         <div class="name-wrap">
           <span class="name" id="userName">مسؤول</span>
           <span class="email" id="userEmail"></span>
         </div>
       </div>
    </div>
  </aside>
  <div class="main-area">
"""

# Replace the start of the app div with our new layout start
html = html.replace('<div id="app" class="hidden">', app_start + sidebar_html)

# We need to change the header inside the main area.
old_header = """<header>
  <div class="brand-row">
    <div class="brand-logo">د</div>
    <div class="brand-text">
      <h1>دليلك — لوحة الإدارة</h1>
      <div class="sub">قسم التوليد الجماعي بالذكاء الاصطناعي</div>
    </div>
  </div>
  <div class="header-right">
    <div class="user-chip">
      <img id="userAvatar" alt="" />
      <span class="name" id="userEmail"></span>
    </div>
    <button class="btn-ghost" id="logoutBtn">خروج</button>
  </div>
</header>"""

new_header = """<header>
  <div class="brand-row">
    <div class="brand-text">
      <h1>لوحة الإدارة — عمل مقالات</h1>
      <div class="sub">قسم التوليد الجماعي للمقالات بالذكاء الاصطناعي</div>
    </div>
  </div>
  <div class="header-right">
    <a href="/" target="_blank" class="btn-secondary" style="display:flex;align-items:center;gap:6px;border-radius:10px;padding:8px 14px;font-size:13px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg> الموقع</a>
    <button class="btn-ghost" id="logoutBtn" style="color:var(--danger)">خروج</button>
  </div>
</header>"""

# Since the user-chip is moved to the sidebar footer, we remove it from header but need to make sure IDs match.
# Wait, userAvatar and userEmail are duplicated in the HTML now! We should replace the old header entirely.
# Let's replace the old header
html = html.replace(old_header, new_header)

# Make sure we close the main-area div at the end of the app div.
# Find </main>\n</div>
html = html.replace('</main>\n</div>', '</main>\n  </div>\n</div>')

# In JS, user updates:
# if (user.email) $('userEmail').textContent = user.name || user.email;
# I need to handle that userEmail is no longer unique, but JS uses `$('userEmail')` which gets the first one. 
# It's fine, I'll let JS update the sidebar one.

with open('bulk-admin.html', 'w', encoding='utf-8') as f:
    f.write(html)
