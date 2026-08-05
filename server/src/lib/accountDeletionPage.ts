export function accountDeletionPage(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Delete Account – TrackMyRMC / Concrete King</title>
<meta name="description" content="Delete your TrackMyRMC or Concrete King account and associated personal data. Learn what data is deleted, what is retained, and the retention period.">
<style>
:root{color-scheme:light;--ink:#172033;--muted:#526078;--brand:#08785f;--line:#dce4e8;--bg:#f4f8f7;--danger:#b42318}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}.wrap{width:min(880px,calc(100% - 32px));margin:auto;padding:28px 0 64px}.brand{font-weight:900;letter-spacing:.04em;color:var(--brand)}main{background:#fff;border:1px solid var(--line);border-radius:18px;padding:clamp(22px,5vw,46px);box-shadow:0 18px 50px rgba(23,32,51,.08)}h1{font-size:clamp(24px,5vw,38px);line-height:1.14;margin:8px 0 16px}h2{font-size:20px;margin:32px 0 10px;color:var(--brand)}.identity{background:#eef8f5;border-left:4px solid var(--brand);padding:16px 18px;border-radius:8px;margin-bottom:20px}.identity strong{display:block;margin-bottom:2px}.muted{color:var(--muted)}label{display:block;font-weight:700;margin:16px 0 6px}input,textarea{width:100%;font:inherit;padding:12px;border:1px solid #aebbc5;border-radius:8px}textarea{min-height:100px;resize:vertical}.check{display:flex;gap:10px;align-items:flex-start;font-weight:600}.check input{width:20px;height:20px;margin-top:3px;flex-shrink:0}button{width:100%;min-height:50px;border:0;border-radius:9px;background:var(--brand);color:#fff;font-weight:900;font-size:15px;margin-top:20px;cursor:pointer}button:disabled{opacity:.6;cursor:wait}.notice{margin-top:18px;padding:15px;border-radius:8px;display:none}.ok{display:block;background:#eaf8ef;color:#176b36}.error{display:block;background:#fff0ee;color:var(--danger)}a{color:var(--brand)}.steps{margin:0 0 8px;padding-left:20px;color:var(--muted)}.steps li{margin-bottom:6px}.retention-table{width:100%;border-collapse:collapse;font-size:14px;margin:10px 0}.retention-table th{background:#eef8f5;text-align:left;padding:10px 12px;font-weight:700;color:var(--brand);border:1px solid var(--line)}.retention-table td{padding:10px 12px;border:1px solid var(--line);vertical-align:top}footer{text-align:center;color:var(--muted);margin-top:20px;font-size:14px}@media(max-width:520px){.wrap{padding-top:10px}main{border-radius:12px;padding:20px}}
</style></head><body><div class="wrap"><main>
<div class="brand">TRACKMYRMC · CONCRETE KING</div>
<h1>Delete Account &amp; Data</h1>
<div class="identity">
  <strong>Google Play application: Concrete King | Ready-Mix Concrete Tracking &amp; RMC Plant Discovery</strong>
  Package: com.trackmyrmc.concreteking<br>
  <strong style="margin-top:6px">Web application: TrackMyRMC</strong>
  Domain: trackmyrmc.com
</div>

<p>Registered users can request deletion of their account and personal data using this form. No sign-in is required. We may contact you to verify account ownership before processing your request.</p>

<h2>Steps to Delete Your Account</h2>
<ol class="steps">
  <li>Fill in your registered name and mobile number in the form below.</li>
  <li>Optionally enter your email address and reason for deletion.</li>
  <li>Check the confirmation checkbox and click <strong>Request Account Deletion</strong>.</li>
  <li>You will receive a confirmation message on this page once your request is registered.</li>
  <li>Our team will verify your identity and process the deletion within <strong>7 working days</strong>.</li>
  <li>You will be notified by email or SMS once deletion is complete.</li>
</ol>
<p class="muted" style="font-size:14px">Alternatively, signed-in users can delete their account from the <strong>Profile → Delete Account</strong> section inside the app, which uses OTP verification for immediate processing.</p>

<h2>Data That Will Be Deleted</h2>
<p class="muted">The following personal data will be permanently deleted or anonymised upon successful processing of your request:</p>
<ul class="steps">
  <li>Full name, registered mobile number, and email address</li>
  <li>Saved delivery addresses and site information</li>
  <li>Profile image and personal preferences</li>
  <li>Authentication credentials, active sessions, and device tokens</li>
  <li>Non-essential location information</li>
  <li>All other account-linked personal information</li>
</ul>

<h2>Data That May Be Retained</h2>
<p class="muted">Certain records may be retained as required by applicable law. Personal identifiers are removed or anonymised from retained records, and access is strictly restricted.</p>

<h2>Data Retention Period</h2>
<table class="retention-table">
  <tr><th>Record type</th><th>Retention period</th><th>Reason</th></tr>
  <tr><td>Orders, delivery challans, invoices</td><td>7 years</td><td>GST / income-tax compliance (India)</td></tr>
  <tr><td>Financial transaction records</td><td>7 years</td><td>Accounting and audit requirements</td></tr>
  <tr><td>Security and fraud-prevention logs</td><td>3 years</td><td>Fraud prevention and legal disputes</td></tr>
  <tr><td>Regulatory records</td><td>As required by law</td><td>Applicable Indian laws and regulations</td></tr>
</table>
<p class="muted" style="font-size:14px;margin-top:8px">All other personal data not covered by a legal retention obligation is deleted within 7 working days of a confirmed request.</p>

<h2>Request Account Deletion</h2>
<form id="deletion-form" novalidate>
<label for="fullName">Full name</label><input id="fullName" name="fullName" maxlength="120" autocomplete="name" required placeholder="As registered in the app">
<label for="mobile">Registered mobile number</label><input id="mobile" name="mobile" maxlength="30" inputmode="tel" autocomplete="tel" required placeholder="+91 XXXXX XXXXX">
<label for="email">Registered email address <span class="muted">(optional)</span></label><input id="email" name="email" maxlength="254" type="email" autocomplete="email" placeholder="you@example.com">
<label for="reason">Reason for deletion <span class="muted">(optional)</span></label><textarea id="reason" name="reason" maxlength="1000" placeholder="Help us improve — tell us why you are leaving (optional)"></textarea>
<label class="check"><input id="confirmed" name="confirmed" type="checkbox" required><span>I confirm that I want to permanently delete my TrackMyRMC / Concrete King account and associated personal data.</span></label>
<button type="submit">REQUEST ACCOUNT DELETION</button><div id="notice" class="notice" role="status" aria-live="polite"></div>
</form>

<h2>Contact Us</h2>
<p class="muted">For questions about your data or this deletion request, please contact us:</p>
<p>Email: <a href="mailto:support@goldetech.com">support@goldetech.com</a></p>
<p>Read our <a href="/privacy">Privacy Policy</a> to learn how we collect, use, and protect your personal data.</p>

</main><footer>TrackMyRMC · Concrete King · com.trackmyrmc.concreteking · &copy; Golde Technologies</footer></div>
<script>document.getElementById('deletion-form').addEventListener('submit',async function(e){e.preventDefault();const f=e.currentTarget,n=document.getElementById('notice'),b=f.querySelector('button');n.className='notice';n.textContent='';if(!f.reportValidity())return;b.disabled=true;try{const r=await fetch('/api/account-deletion-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fullName:f.fullName.value,mobile:f.mobile.value,email:f.email.value,reason:f.reason.value,confirmed:f.confirmed.checked})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to register the request.');n.className='notice ok';n.textContent='Deletion request received. Your request has been registered successfully. We may contact you to verify account ownership. Eligible account and personal data will be deleted within 7 working days. Records required for legal, tax, transaction, fraud-prevention or regulatory purposes may be retained for the legally required period.';f.reset()}catch(x){n.className='notice error';n.textContent=x.message||'Unable to register the request.'}finally{b.disabled=false}});</script>
</body></html>`;
}
