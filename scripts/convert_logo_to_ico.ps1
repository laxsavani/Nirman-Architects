Add-Type -AssemblyName System.Drawing

$pngPath = "d:\NexAllince\Nirman-Architects\nexalliance-attendance-agent\assets\logo.png"
$icoPath = "d:\NexAllince\Nirman-Architects\nexalliance-attendance-agent\assets\icon.ico"

$bmp = [System.Drawing.Bitmap]::FromFile($pngPath)
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)

$fs = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$bmp.Dispose()

Write-Host "✅ icon.ico generated successfully at $icoPath with size:" (Get-Item $icoPath).Length "bytes"

