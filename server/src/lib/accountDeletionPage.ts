export function accountDeletionPage(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Concrete King – Account and Data Deletion</title>
<meta name="description" content="Request deletion of your Concrete King account and associated personal data.">
<style>
:root{color-scheme:light;--ink:#172033;--muted:#526078;--brand:#08785f;--danger:#b42318;--line:#dce4e8;--bg:#f4f8f7}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}
.wrap{width:min(880px,calc(100% - 32px));margin:auto;padding:28px 0 64px}
.brand{font-weight:900;letter-spacing:.04em;color:var(--brand)}
main{background:#fff;border:1px solid var(--line);border-radius:18px;padding:clamp(22px,5vw,46px);box-shadow:0 18px 50px rgba(23,32,51,.08)}
h1{font-size:clamp(24px,5vw,38px);line-height:1.14;margin:8px 0 16px}
h2{font-size:20px;margin:32px 0 10px}
.identity{background:#eef8f5;border-left:4px solid var(--brand);padding:16px 18px;border-radius:8px}
.identity strong{display:block}
.muted{color:var(--muted)}
label{display:block;font-weight:700;margin:16px 0 6px}
input,textarea{width:100%;font:inherit;padding:12px;border:1px solid #aebbc5;border-radius:8px}
textarea{min-height:100px;resize:vertical}
.check{display:flex;gap:10px;align-items:flex-start;font-weight:600}
.check input{width:20px;height:20px;margin-top:3px;flex-shrink:0}
button{width:100%;min-height:50px;border:0;border-radius:9px;font-weight:900;font-size:15px;margin-top:12px;cursor:pointer;transition:opacity .15s}
button:disabled{opacity:.5;cursor:wait}
.btn-brand{background:var(--brand);color:#fff}
.btn-danger{background:var(--danger);color:#fff}
.btn-outline{background:#fff;color:var(--ink);border:1.5px solid var(--line);min-height:44px;font-size:14px}
.notice{margin-top:14px;padding:14px 16px;border-radius:8px;display:none;font-size:14px;line-height:1.5}
.ok{display:block;background:#eaf8ef;color:#176b36}
.error{display:block;background:#fff0ee;color:var(--danger)}
.info{display:block;background:#eff6ff;color:#1e40af}
a{color:var(--brand)}
footer{text-align:center;color:var(--muted);margin-top:20px;font-size:14px}
.section{margin-top:28px;padding-top:24px;border-top:1px solid var(--line)}
.self-delete-box{border:2px solid rgba(180,35,24,.25);border-radius:14px;padding:22px;background:#fff8f8;margin-bottom:24px}
.self-delete-box h2{color:var(--danger);margin-top:0}
.user-badge{display:inline-flex;align-items:center;gap:8px;background:#eef8f5;border:1px solid var(--brand);border-radius:8px;padding:8px 14px;font-weight:700;font-size:14px;color:var(--brand);margin-bottom:16px}
.step{display:flex;align-items:flex-start;gap:10px;margin:14px 0}
.step-num{width:26px;height:26px;border-radius:50%;background:var(--danger);color:#fff;font-weight:900;font-size:13px;display:grid;place-items:center;flex-shrink:0;margin-top:3px}
.otp-row{display:flex;gap:8px}
.otp-row input{letter-spacing:4px;font-size:20px;text-align:center;font-weight:700}
.otp-row button{width:auto;padding:0 16px;min-height:50px;font-size:13px;white-space:nowrap;flex-shrink:0}
#logged-in-section{display:none}
#request-section{display:none}
@media(max-width:520px){.wrap{padding-top:10px}main{border-radius:12px;padding:20px}}
</style>
</head>
<body>
<div class="wrap"><main>
<div class="brand">CONCRETE KING · Powered by TrackMyRMC</div>
<h1>Account &amp; Data Deletion</h1>
<div class="identity">
  <strong>Google Play application:</strong>Concrete King | Ready-Mix Concrete Tracking &amp; RMC Plant Discovery<br><br>
  <strong>Package name:</strong>com.trackmyrmc.concreteking<br><br>
  <strong>Powered by TrackMyRMC</strong>
</div>
<p>Registered customers can delete their Concrete King account and personal data directly on this page — either while signed in (instant OTP-verified deletion) or without signing in (reviewed within 7 working days).</p>

<!-- ── SECTION A: Logged-in self-deletion ─────────────────────── -->
<div id="logged-in-section">
  <div class="self-delete-box">
    <h2>⚠ Delete My Account</h2>
    <div id="user-badge" class="user-badge"></div>
    <p class="muted" style="margin-top:0;font-size:14px">This will permanently delete your Concrete King customer account and all personal data. Orders, invoices, and transaction records required by law may be retained. <strong>This cannot be undone.</strong></p>

    <div class="step">
      <span class="step-num">1</span>
      <div style="flex:1">
        <strong>Verify your identity</strong>
        <p class="muted" style="font-size:13px;margin:4px 0 8px">We'll send a 6-digit code to your registered mobile number.</p>
        <button type="button" id="send-otp-btn" class="btn-outline" onclick="sendDeletionOtp()">Send verification code</button>
        <div id="otp-notice" class="notice"></div>
      </div>
    </div>

    <div class="step" id="otp-step" style="display:none">
      <span class="step-num">2</span>
      <div style="flex:1">
        <strong>Enter 6-digit code</strong>
        <div class="otp-row" style="margin-top:8px">
          <input id="otp-input" type="text" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code">
          <button type="button" class="btn-outline" onclick="sendDeletionOtp()">Resend</button>
        </div>
      </div>
    </div>

    <div class="step" id="confirm-step" style="display:none">
      <span class="step-num">3</span>
      <div style="flex:1">
        <strong>Confirm deletion</strong>
        <p class="muted" style="font-size:13px;margin:4px 0 8px">Type <strong>DELETE</strong> to confirm you want your account permanently removed.</p>
        <input id="confirm-input" type="text" placeholder="DELETE" autocomplete="off" oninput="updateDeleteBtn()">
      </div>
    </div>

    <button type="button" id="delete-btn" class="btn-danger" style="display:none;margin-top:20px" disabled onclick="confirmDeletion()">DELETE MY ACCOUNT PERMANENTLY</button>
    <div id="delete-notice" class="notice"></div>
  </div>
</div>

<!-- ── SECTION B: Not logged in — request form ──────────────────── -->
<div id="request-section">
  <h2 class="section" style="padding-top:28px;border-top:none">Request Account Deletion</h2>
  <p class="muted" style="margin-top:0;font-size:14px">Not signed in? Fill this form and our team will verify ownership and delete your account within 7 working days.</p>
  <form id="deletion-form" novalidate>
    <label for="fullName">Full name</label>
    <input id="fullName" name="fullName" maxlength="120" autocomplete="name" required>
    <label for="mobile">Registered mobile number</label>
    <input id="mobile" name="mobile" maxlength="30" inputmode="tel" autocomplete="tel">
    <label for="email">Registered email address <span class="muted">(optional)</span></label>
    <input id="email" name="email" maxlength="254" type="email" autocomplete="email">
    <label for="reason">Reason for deletion <span class="muted">(optional)</span></label>
    <textarea id="reason" name="reason" maxlength="1000"></textarea>
    <label class="check">
      <input id="confirmed" name="confirmed" type="checkbox" required>
      <span>I confirm that I want to delete my Concrete King account and associated personal data.</span>
    </label>
    <button type="submit" class="btn-brand">REQUEST ACCOUNT DELETION</button>
    <div id="req-notice" class="notice" role="status" aria-live="polite"></div>
  </form>
</div>

<!-- ── What gets deleted / retained (always visible) ─────────── -->
<div class="section">
  <h2 style="margin-top:0">What will be deleted</h2>
  <p class="muted">Profile information, registered mobile number and email address, saved delivery addresses, profile image, authentication credentials, active sessions, device tokens, and other account-linked personal data will be deleted or anonymised.</p>
  <h2>Records we may retain</h2>
  <p class="muted">Orders, invoices, delivery challans, payments, tax records, security logs, and fraud-prevention or regulatory records may be retained for the period required by applicable law. Unnecessary personal data is removed from retained business records and deleted or anonymised when the retention period ends.</p>
</div>

<p class="muted" style="margin-top:28px;font-size:14px">Need help? Email <a href="mailto:support@goldetech.com">support@goldetech.com</a>. Read our <a href="/privacy">Privacy Policy</a>.</p>
</main>
<footer>Concrete King · com.trackmyrmc.concreteking · Powered by TrackMyRMC</footer>
</div>

<script>
(function() {
  var token = localStorage.getItem('rmc_token');

  function showSection(loggedIn) {
    document.getElementById('logged-in-section').style.display = loggedIn ? 'block' : 'none';
    document.getElementById('request-section').style.display = loggedIn ? 'none' : 'block';
  }

  if (!token) { showSection(false); return; }

  // Verify token + check role
  fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(user) {
      if (!user) { showSection(false); return; }
      if (user.role !== 'client') {
        // Staff/driver/owner — show request form with a note
        showSection(false);
        var note = document.createElement('p');
        note.style.cssText = 'background:#eff6ff;color:#1e40af;padding:12px 16px;border-radius:8px;font-size:14px;margin-bottom:16px';
        note.textContent = 'Signed in as ' + user.name + ' (' + user.role + '). Staff and driver accounts use the admin offboarding process. The form below is for customer accounts only.';
        document.getElementById('request-section').insertBefore(note, document.getElementById('request-section').firstChild);
        return;
      }
      // Customer — show self-delete section
      showSection(true);
      var badge = document.getElementById('user-badge');
      badge.textContent = '✓ Signed in as ' + user.name + (user.phone ? ' · ' + user.phone : '');
    })
    .catch(function() { showSection(false); });
})();

function setNotice(id, cls, msg) {
  var el = document.getElementById(id);
  el.className = 'notice ' + cls;
  el.textContent = msg;
}

function sendDeletionOtp() {
  var btn = document.getElementById('send-otp-btn');
  btn.disabled = true;
  setNotice('otp-notice', '', '');
  var token = localStorage.getItem('rmc_token');
  fetch('/api/account-deletion-requests/otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  })
  .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
  .then(function(res) {
    btn.disabled = false;
    if (!res.ok) { setNotice('otp-notice', 'error', res.d.error || 'Could not send verification code.'); return; }
    setNotice('otp-notice', 'ok', 'Verification code sent to your registered mobile number.');
    document.getElementById('otp-step').style.display = 'flex';
    document.getElementById('confirm-step').style.display = 'flex';
    document.getElementById('delete-btn').style.display = 'block';
    if (res.d.devCode) document.getElementById('otp-input').value = res.d.devCode;
    updateDeleteBtn();
    btn.textContent = 'Resend code';
  })
  .catch(function() { btn.disabled = false; setNotice('otp-notice', 'error', 'Network error. Please try again.'); });
}

function updateDeleteBtn() {
  var otp = (document.getElementById('otp-input').value || '').trim();
  var confirm = (document.getElementById('confirm-input').value || '').trim();
  document.getElementById('delete-btn').disabled = !(otp.length === 6 && /^\\d{6}$/.test(otp) && confirm === 'DELETE');
}

// Also update button when OTP input changes
document.addEventListener('DOMContentLoaded', function() {
  var otpInput = document.getElementById('otp-input');
  if (otpInput) otpInput.addEventListener('input', updateDeleteBtn);
});

function confirmDeletion() {
  var otp = (document.getElementById('otp-input').value || '').trim();
  var confirm = (document.getElementById('confirm-input').value || '').trim();
  if (otp.length !== 6 || confirm !== 'DELETE') return;
  var btn = document.getElementById('delete-btn');
  btn.disabled = true;
  btn.textContent = 'Deleting…';
  setNotice('delete-notice', '', '');
  var token = localStorage.getItem('rmc_token');
  fetch('/api/account-deletion-requests/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ otp: otp, confirmed: true })
  })
  .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
  .then(function(res) {
    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = 'DELETE MY ACCOUNT PERMANENTLY';
      setNotice('delete-notice', 'error', res.d.error || 'Deletion failed. Please try again.');
      return;
    }
    // Success — clear all local storage and sign out
    localStorage.clear();
    document.getElementById('logged-in-section').innerHTML =
      '<div style="background:#eaf8ef;color:#176b36;padding:22px;border-radius:14px;text-align:center">' +
      '<div style="font-size:32px;margin-bottom:10px">✓</div>' +
      '<strong>Account deleted.</strong>' +
      '<p style="margin:8px 0 0;font-size:14px">Your Concrete King account and eligible personal data have been permanently removed. You will be redirected shortly.</p>' +
      '</div>';
    setTimeout(function() { window.location.href = '/'; }, 4000);
  })
  .catch(function() {
    btn.disabled = false;
    btn.textContent = 'DELETE MY ACCOUNT PERMANENTLY';
    setNotice('delete-notice', 'error', 'Network error. Please check your connection and try again.');
  });
}

// Request form (unauthenticated path)
var reqForm = document.getElementById('deletion-form');
if (reqForm) {
  reqForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var f = e.currentTarget;
    var n = document.getElementById('req-notice');
    var b = f.querySelector('button[type=submit]');
    n.className = 'notice';
    n.textContent = '';
    var mobile = f.mobile.value.trim();
    var email = f.email.value.trim();
    if (!mobile && !email) { setNotice('req-notice', 'error', 'Enter your registered mobile number or email address.'); return; }
    if (!f.confirmed.checked) { setNotice('req-notice', 'error', 'Please check the confirmation box.'); return; }
    b.disabled = true;
    fetch('/api/account-deletion-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: f.fullName.value, mobile: mobile, email: email, reason: f.reason.value, confirmed: true })
    })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
    .then(function(res) {
      b.disabled = false;
      if (!res.ok) { setNotice('req-notice', 'error', res.d.error || 'Unable to register the request.'); return; }
      setNotice('req-notice', 'ok', 'Request received. We may contact you to verify account ownership. Eligible account and personal data will be deleted within 7 working days. Records required for legal, tax, transaction, or regulatory purposes may be retained for the legally required period.');
      f.reset();
    })
    .catch(function() { b.disabled = false; setNotice('req-notice', 'error', 'Network error. Please try again.'); });
  });
}
</script>
</body></html>`;
}
