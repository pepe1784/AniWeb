# server/setup-fork.ps1
# Prepara el motor "AniWeb Server": fork controlado de Suwayomi-Server + capa de anime (ADR-010).
# Uso:
#   powershell -ExecutionPolicy Bypass -File server/setup-fork.ps1
#   powershell -ExecutionPolicy Bypass -File server/setup-fork.ps1 -ForkUrl https://github.com/USUARIO/AniWeb-Server.git
# Requiere git. Para construir, JDK 21+ y Gradle 8.x (./gradlew run).

param(
    [string]$ForkUrl = "https://github.com/pepe1784/AniWeb-Server.git",
    [string]$Dir = "$PSScriptRoot\..\..\AniWeb-Server",
    [switch]$Deep
)

$ErrorActionPreference = "Stop"

if (Test-Path "$Dir\.git") {
    Write-Host "Ya existe un repo en $Dir; actualizando desde upstream..."
    git -C $Dir fetch upstream
    git -C $Dir status -sb
    return
}

$depthArgs = @("--depth", "1")
git clone @depthArgs --branch master https://github.com/Suwayomi/Suwayomi-Server.git $Dir
git -C $Dir remote set-url origin $ForkUrl
git -C $Dir remote add upstream https://github.com/Suwayomi/Suwayomi-Server.git
git -C $Dir checkout -b aniweb/anime

Write-Host ""
Write-Host "Motor listo en $Dir"
Write-Host "  - origin  : $ForkUrl  (fork "AniWeb Server")"
Write-Host "  - upstream: https://github.com/Suwayomi/Suwayomi-Server.git (rebase)"
Write-Host "  - rama    : aniweb/anime (capa de anime; base PR #1876 + source-api Aniyomi/Nekoyomi)"
Write-Host ""
Write-Host "Siguiente: crea el repo vacio '$ForkUrl' en GitHub y haz el primer push:"
Write-Host "  cd $Dir; git push -u origin aniweb/anime; git push -u origin master"
Write-Host "Construir: cd $Dir; ./gradlew run   (requiere JDK 21)"