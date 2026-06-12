# Minimal static file server for previewing the app (no Node/Python on this machine)
# ASCII-only on purpose: Windows PowerShell 5.1 misreads BOM-less UTF-8 scripts.
param([int]$Port = 8123)
$root = $PSScriptRoot
Add-Type -AssemblyName System.Web
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/"
$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.jpg'='image/jpeg'; '.png'='image/png'; '.svg'='image/svg+xml'; '.json'='application/json' }
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Web.HttpUtility]::UrlDecode($ctx.Request.Url.AbsolutePath).TrimStart('/')
    $path = if ($rel -eq '') {
      # default document: the single-file app (Thai filename, resolved at runtime)
      (Get-ChildItem -Path $root -Filter '*.html' | Sort-Object Length -Descending | Select-Object -First 1).FullName
    } else {
      Join-Path $root $rel
    }
    if ($path -and (Test-Path $path -PathType Leaf) -and ($path -like "$root*")) {
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $ctx.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.OutputStream.Close()
  } catch { }
}
