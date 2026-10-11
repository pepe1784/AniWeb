# server/setup-fork.ps1
# Prepara el motor "AniWeb Server": fork controlado de Suwayomi-Server + capa de anime (ADR-010).
# Uso:
#   powershell -ExecutionPolicy Bypass -File server/setup-fork.ps1
#   powershell -ExecutionPolicy Bypass -File server/setup-fork.ps1 -ForkUrl https://github.com/USUARIO/AniWeb-Server.git
# Requiere git. Para construir, JDK 21+ y Gradle 8.x.
# NOTA (memoria del daemon de Kotlin): `:server:compileKotlin` puede fallar con
# "OutOfMemoryError: GC overhead limit exceeded" en el backend de bytecode (p.ej.
# BackupServerSettings$$serializer) si el daemon de Kotlin no tiene suficiente heap.
# Añade `-Pkotlin.daemon.jvmargs=-Xmx6g` al comando de Gradle (ver "Construir" abajo).

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
Write-Host "Construir (requiere JDK 21; el daemon de Kotlin necesita ~6G de heap):"
Write-Host "  cd $Dir"
Write-Host "  # compilar solo (marca: sin -Pkotlin.daemon.jvmargs da OOM en el backend de bytecode)"
Write-Host "  .\gradlew.bat -Pkotlin.daemon.jvmargs=-Xmx6g :server:compileKotlin"
Write-Host "  # compilar y arrancar el servidor"
Write-Host "  .\gradlew.bat -Pkotlin.daemon.jvmargs=-Xmx6g :server:run"