export function privacyPage(): string {
  const policyUrl = 'https://trackmyrmc.com/privacy_policy';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Privacy Policy – TrackMyRMC</title>
  <meta name="description" content="Official Privacy Policy for TrackMyRMC.">
  <meta name="robots" content="noindex,follow">
  <link rel="canonical" href="${policyUrl}">
  <link rel="icon" type="image/svg+xml" href="/privacy_policy/trackmyrmc-policy-icon.svg">
  <meta http-equiv="refresh" content="0;url=${policyUrl}">
  <script>window.location.replace(${JSON.stringify(policyUrl)});</script>
  <style>
    :root{color-scheme:light}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f8f7;color:#172033;font:16px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif;text-align:center}
    main{width:min(460px,100%);padding:30px;border:1px solid #dce4e8;border-radius:18px;background:#fff;box-shadow:0 22px 60px rgba(23,32,51,.08)}
    img{width:68px;height:68px;border-radius:16px}
    h1{margin:16px 0 8px;font-size:27px}
    p{margin:0 0 18px;color:#526078}
    a{display:inline-flex;min-height:44px;align-items:center;justify-content:center;padding:10px 18px;border-radius:10px;background:#08785f;color:#fff;font-weight:800;text-decoration:none}
  </style>
</head>
<body>
  <main>
    <img src="/privacy_policy/trackmyrmc-policy-icon.svg" alt="TrackMyRMC">
    <h1>TrackMyRMC Privacy Policy</h1>
    <p>This legacy address has moved to the official TrackMyRMC Privacy Policy.</p>
    <a href="${policyUrl}">Open Privacy Policy</a>
  </main>
</body>
</html>`;
}
