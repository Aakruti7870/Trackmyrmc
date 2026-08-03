export function accountDeletionPage(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Concrete King – Account Deletion</title>
<meta name="description" content="Delete your Concrete King account and personal data.">
<style>
:root{color-scheme:light;--ink:#172033;--muted:#526078;--brand:#08785f;--danger:#b42318;--line:#dce4e8;--bg:#f0f6f4}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;min-height:100vh}
.wrap{width:min(680px,calc(100%-32px));margin:auto;padding:32px 0 80px}
.logo{font-weight:900;letter-spacing:.08em;font-size:18px}
.logo span{color:var(--brand)}
.card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:clamp(24px,5vw,44px);box-shadow:0 20px 60px rgba(23,32,51,.07);margin-top:28px}
h1{font-size:clamp(22px,5vw,32px);font-weight:800;line-height:1.2;margin-bottom:16px}
h2{font-size:18px;font-weight:700;margin:0 0 10px}
p{color:var(--muted);font-size:15px;line-height:1.7}
label{display:block;font-weight:700;font-size:14px;margin-bottom:6px;color:var(--ink)}
input[type=text],input[type=tel]{width:100%;padding:14px 16px;border:1.5px solid var(--line);border-radius:10px;font:inherit;font-size:16px;color:var(--ink);background:#fafcfb;transition:border .15s}
input[type=text]:focus,input[type=tel]:focus{outline:none;border-color:var(--brand)}
.btn{display:block;width:100%;min-height:52px;border:0;border-radius:12px;font:inherit;font-weight:800;font-size:15px;cursor:pointer;transition:opacity .15s,background .15s}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-brand{background:var(--brand);color:#fff}
.btn-danger{background:var(--danger);color:#fff}
.btn-ghost{background:#fff;color:var(--ink);border:1.5px solid var(--line);font-size:14px;min-height:42px}
.step{display:flex;gap:14px;align-items:flex-start;margin:20px 0}
.step-num{width:30px;height:30px;border-radius:50%;background:var(--danger);color:#fff;font-weight:800;font-size:13px;display:grid;place-items:center;flex-shrink:0;margin-top:2px}
.step-body{flex:1;min-width:0}
.notice{margin-top:10px;padding:12px 14px;border-radius:9px;font-size:14px;display:none}
.notice.show{display:block}
.ok{background:#eaf8ef;color:#176b36}
.err{background:#fff0ee;color:var(--danger)}
.info{background:#eff6ff;color:#1e40af}
.otp-input{font-size:28px;font-weight:800;letter-spacing:8px;text-align:center;max-width:180px}
.confirm-input{font-size:16px;font-weight:800;letter-spacing:3px;max-width:200px}
.success-box{text-align:center;padding:32px 20px}
.success-box .icon{font-size:48px;margin-bottom:12px}
.divider{border:0;border-top:1px solid var(--line);margin:28px 0}
.detail-section{margin-top:24px}
.detail-section h2{color:var(--muted);font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
.detail-section p{font-size:14px}
a{color:var(--brand)}
footer{text-align:center;color:var(--muted);margin-top:24px;font-size:13px}
@media(max-width:480px){.wrap{padding-top:16px}.card{border-radius:14px;padding:20px}}
</style>
</head>
<body>
<div class="wrap">

  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
    <div class="logo">CONCRETE <span>KING</span></div>
    <a href="/" style="font-size:14px;color:var(--muted);text-decoration:none">← Back to home</a>
  </div>

  <div class="card">
    <h1>Delete Your Account</h1>
    <p>Enter the mobile number registered to your Concrete King account. We'll send a one-time code to verify it's you, then permanently delete your account and personal data.</p>

    <!-- ── Main flow ───────────────────────────────────── -->
    <div id="flow">

      <!-- Step 1: Phone input -->
      <div class="step" id="s1">
        <div class="step-num">1</div>
        <div class="step-body">
          <label for="phone-input">Registered mobile number</label>
          <input id="phone-input" type="tel" placeholder="+91 98765 43210" autocomplete="tel"
            oninput="clearNotice('s1-notice')" style="margin-bottom:10px">
          <div id="s1-notice" class="notice"></div>
          <button class="btn btn-brand" style="margin-top:4px" onclick="sendOtp()" id="send-btn">Send verification code</button>
        </div>
      </div>

      <!-- Step 2: OTP (hidden until step 1 done) -->
      <div class="step" id="s2" style="display:none">
        <div class="step-num">2</div>
        <div class="step-body">
          <label for="otp-input">6-digit verification code</label>
          <p style="font-size:13px;margin-bottom:10px">Sent to the number you entered. Check WhatsApp or SMS.</p>
          <input id="otp-input" type="text" class="otp-input" inputmode="numeric" maxlength="6"
            placeholder="——————" autocomplete="one-time-code" oninput="updateDeleteBtn()">
          <button class="btn btn-ghost" style="margin-top:10px;width:auto;padding:0 16px" onclick="sendOtp()">Resend code</button>
          <div id="s2-notice" class="notice"></div>
        </div>
      </div>

      <!-- Step 3: Confirm (hidden until step 1 done) -->
      <div class="step" id="s3" style="display:none">
        <div class="step-num">3</div>
        <div class="step-body">
          <label for="confirm-input">Type <strong>DELETE</strong> to confirm</label>
          <p style="font-size:13px;margin-bottom:10px">This action is permanent and cannot be undone.</p>
          <input id="confirm-input" type="text" class="confirm-input" placeholder="DELETE"
            autocomplete="off" oninput="updateDeleteBtn()">
        </div>
      </div>

      <!-- Delete button (hidden until step 1 done) -->
      <div id="delete-row" style="display:none;margin-top:20px">
        <button class="btn btn-danger" id="delete-btn" disabled onclick="doDelete()">DELETE MY ACCOUNT PERMANENTLY</button>
        <div id="delete-notice" class="notice"></div>
      </div>

    </div><!-- /flow -->

    <!-- ── Success state (replaces flow) ──────────────── -->
    <div id="success" style="display:none" class="success-box">
      <div class="icon">✓</div>
      <h2 style="font-size:22px;margin-bottom:8px">Account deleted</h2>
      <p>Your Concrete King account and eligible personal data have been permanently removed. You'll be redirected shortly.</p>
    </div>

    <hr class="divider">

    <!-- Info sections (always visible) -->
    <div class="detail-section">
      <h2>What gets deleted</h2>
      <p>Profile, mobile number, email, saved addresses, authentication credentials, active sessions, push subscriptions, and all other personal data linked to your account.</p>
    </div>
    <div class="detail-section">
      <h2>What may be retained</h2>
      <p>Delivery records, challans, invoices, tax and payment records, and security/audit logs may be retained where required by law. Personal data is removed from those records and deleted or anonymised once the retention period ends. See the <a href="/privacy">Privacy Policy</a>.</p>
    </div>
    <div class="detail-section">
      <h2>Can't access your number?</h2>
      <p>Email <a href="mailto:support@goldetech.com">support@goldetech.com</a> with your registered details and we'll process the request within 7 working days after verifying ownership.</p>
    </div>

  </div><!-- /card -->

  <footer>Concrete King · com.trackmyrmc.concreteking · Powered by TrackMyRMC</footer>
</div>

<script>
var phoneUsed = '';

function setNotice(id, cls, msg) {
  var el = document.getElementById(id);
  el.className = 'notice show ' + cls;
  el.textContent = msg;
}
function clearNotice(id) {
  var el = document.getElementById(id);
  el.className = 'notice';
  el.textContent = '';
}

function sendOtp() {
  var phone = document.getElementById('phone-input').value.trim();
  if (!phone) { setNotice('s1-notice', 'err', 'Enter your registered mobile number.'); return; }
  var btn = document.getElementById('send-btn');
  btn.disabled = true;
  btn.textContent = 'Sending…';
  clearNotice('s1-notice');
  clearNotice('s2-notice');
  fetch('/api/account-deletion-requests/phone-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phone })
  })
  .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, d: d }; }); })
  .then(function(res){
    btn.disabled = false;
    btn.textContent = 'Resend code';
    if (!res.ok) { setNotice('s1-notice', 'err', res.d.error || 'Could not send code. Check your number and try again.'); return; }
    phoneUsed = phone;
    // show steps 2 & 3
    document.getElementById('s2').style.display = 'flex';
    document.getElementById('s3').style.display = 'flex';
    document.getElementById('delete-row').style.display = 'block';
    setNotice('s2-notice', 'info', 'Code sent! Check WhatsApp or SMS.');
    if (res.d.devCode) { document.getElementById('otp-input').value = res.d.devCode; updateDeleteBtn(); }
    document.getElementById('otp-input').focus();
  })
  .catch(function(){ btn.disabled = false; btn.textContent = 'Resend code'; setNotice('s1-notice', 'err', 'Network error. Please try again.'); });
}

function updateDeleteBtn() {
  var otp = (document.getElementById('otp-input').value || '').trim();
  var conf = (document.getElementById('confirm-input').value || '').trim();
  document.getElementById('delete-btn').disabled = !(otp.length === 6 && /^\\d{6}$/.test(otp) && conf === 'DELETE');
}

function doDelete() {
  var otp = (document.getElementById('otp-input').value || '').trim();
  var conf = (document.getElementById('confirm-input').value || '').trim();
  if (!phoneUsed || otp.length !== 6 || conf !== 'DELETE') return;
  var btn = document.getElementById('delete-btn');
  btn.disabled = true;
  btn.textContent = 'Deleting…';
  clearNotice('delete-notice');
  fetch('/api/account-deletion-requests/phone-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phoneUsed, otp: otp, confirmed: true })
  })
  .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, d: d }; }); })
  .then(function(res){
    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = 'DELETE MY ACCOUNT PERMANENTLY';
      setNotice('delete-notice', 'err', res.d.error || 'Deletion failed. Please try again.');
      return;
    }
    // Clear any local session and show success
    try { localStorage.clear(); } catch(e) {}
    document.getElementById('flow').style.display = 'none';
    document.getElementById('success').style.display = 'block';
    setTimeout(function(){ window.location.href = '/'; }, 5000);
  })
  .catch(function(){
    btn.disabled = false;
    btn.textContent = 'DELETE MY ACCOUNT PERMANENTLY';
    setNotice('delete-notice', 'err', 'Network error. Please check your connection and try again.');
  });
}
</script>
</body></html>`;
}
