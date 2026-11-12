# pulldmz.ps1
# Déploie le frontend DMZ SANS git ni code source sur la DMZ :
#   1. build local du frontend (même origine : VITE_API_URL vide)
#   2. copie en SSH (pscp) de dist/ + nginx.conf.template + Dockerfile + compose
#   3. docker compose up -d --build sur la DMZ
# Lit pulldmz.ini (ip, port, login, password, chemin). Fichier local uniquement.

[CmdletBinding()]
param(
    [string]$IniPath,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$Root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
if (-not $IniPath) { $IniPath = Join-Path $Root 'pulldmz.ini' }
if (-not (Test-Path $IniPath)) { Write-Error "Fichier introuvable : $IniPath"; exit 1 }

# --- ini (cle:valeur) ---
$cfg = @{ port = '22' }
Get-Content $IniPath -Encoding UTF8 | ForEach-Object {
    $l = $_.Trim()
    if (-not $l -or $l.StartsWith('#') -or $l.StartsWith(';')) { return }
    $i = $l.IndexOf(':')
    if ($i -lt 1) { return }
    $k = $l.Substring(0, $i).Trim().ToLower()
    if ($k -notmatch '^cmd\d+$') { $cfg[$k] = $l.Substring($i + 1).Trim() }
}
foreach ($r in 'ip', 'login', 'password', 'chemin') {
    if (-not $cfg[$r]) { Write-Error "Parametre manquant dans '$IniPath' : $r"; exit 1 }
}

# --- outils PuTTY ---
function Find-Tool($name) {
    $c = Get-Command $name -ErrorAction SilentlyContinue
    if ($c) { return $c.Path }
    foreach ($d in 'C:\Program Files\PuTTY', "$env:LOCALAPPDATA\Programs\PuTTY") {
        if (Test-Path "$d\$name") { return "$d\$name" }
    }
    Write-Error "$name introuvable (PuTTY)."; exit 1
}
$plink = Find-Tool 'plink.exe'
$pscp = Find-Tool 'pscp.exe'
$target = "$($cfg.login)@$($cfg.ip)"
$remote = $cfg.chemin

# --- 1. build local ---
$front = Join-Path $Root 'frontend'
$dist = Join-Path $front 'dist'
if (-not $SkipBuild) {
    Write-Host "=== Build du frontend ===" -ForegroundColor Cyan
    Push-Location $front
    try {
        if (-not (Test-Path 'node_modules')) { npm install --no-audit --no-fund; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
        # Même origine : nginx relaie /api vers le backend. Sous PowerShell, "$env:X = ''" supprime
        # la variable (Vite relirait .env = localhost) : on force la valeur vide via un fichier
        # .env.production.local (prioritaire sur .env, ignoré par git).
        $override = Join-Path $front '.env.production.local'
        Set-Content $override 'VITE_API_URL=' -Encoding ASCII
        try {
            npm run build
            $buildCode = $LASTEXITCODE
        } finally { Remove-Item $override -Force -ErrorAction SilentlyContinue }
        if ($buildCode) { Write-Error "Build en échec"; exit $buildCode }
    } finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $dist 'index.html'))) { Write-Error "dist/index.html absent"; exit 1 }
# Garde-fou : le bundle ne doit contenir aucune URL localhost vers le backend.
if (Select-String -Path (Join-Path $dist 'assets\*.js') -Pattern 'localhost:5310' -Quiet) {
    Write-Error "dist/ contient encore 'localhost:5310' : build non conforme pour la DMZ"; exit 1
}

# --- 2. paquet à copier ---
$stage = Join-Path $env:TEMP 'iambassadeurs-dmz-pkg'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory $stage | Out-Null
Copy-Item (Join-Path $Root 'dmz\package\*') $stage -Recurse
Copy-Item (Join-Path $Root 'dmz\nginx.conf.template') $stage
Copy-Item $dist (Join-Path $stage 'dist') -Recurse

Write-Host "=== Copie vers $target`:$remote ===" -ForegroundColor Cyan
& $plink -ssh -P $cfg.port -batch -pw $cfg.password $target "mkdir -p '$remote' && rm -rf '$remote/dist'"
if ($LASTEXITCODE) { Write-Error "Création du dossier distant en échec"; exit $LASTEXITCODE }
& $pscp -P $cfg.port -batch -pw $cfg.password -r "$stage\*" "${target}:$remote/"
if ($LASTEXITCODE) { Write-Error "Copie en échec"; exit $LASTEXITCODE }

# --- 3. (re)démarrage ---
Write-Host "=== docker compose up ===" -ForegroundColor Cyan
& $plink -ssh -P $cfg.port -batch -pw $cfg.password $target "cd '$remote' && docker compose up -d --build && docker image prune -f"
$code = $LASTEXITCODE

Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
if ($code -eq 0) { Write-Host "Termine avec succes." -ForegroundColor Green }
else { Write-Host "Echec (code $code). Si plink refuse la cle d'hote, lancez-le une fois sans -batch." -ForegroundColor Red }
exit $code
