s/linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01))/var(--surface)/g
s/linear-gradient(135deg,rgba(17,30,55,.85),rgba(10,20,40,.9))/var(--surface)/g
s/1px solid rgba(255,255,255,[.0-9]*)/1px solid var(--line)/g
s/background: 'rgba(0,0,0,.6)'/background: 'var(--overlay)'/g
s/background: 'rgba(0,0,0,.85)'/background: 'var(--overlay)'/g
s/background: 'rgba(5,9,20,.75)'/background: 'var(--overlay)'/g
s/background: 'rgba(0,0,0,.15)'/background: 'var(--chip-bg)'/g
s/rgba(0,0,0,\(\.[0-9]*\))/rgba(var(--shadow-rgb),\1)/g
s/: 'rgba(255,255,255,[.0-9]*)'/: 'var(--chip-bg)'/g
s/'#9fb0c7'/'var(--muted)'/g
s/'#eef5ff'/'var(--text)'/g
s/var(--card, #0d1726)/var(--panel)/g
s/'#0e1a2e'/'var(--menu-bg)'/g
