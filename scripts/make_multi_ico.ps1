Add-Type -AssemblyName System.Drawing

$pngPath = "d:\NexAllince\Nirman-Architects\nexalliance-attendance-agent\assets\logo.png"
$icoPath = "d:\NexAllince\Nirman-Architects\nexalliance-attendance-agent\assets\icon.ico"

$srcBmp = [System.Drawing.Bitmap]::FromFile($pngPath)
$sizes = @(256, 64, 48, 32, 16)

$pngBuffers = @()

foreach ($s in $sizes) {
    $resized = New-Object System.Drawing.Bitmap($s, $s)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($srcBmp, 0, 0, $s, $s)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $resized.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBuffers += ,@($s, $ms.ToArray())
    $ms.Dispose()
    $resized.Dispose()
}

$srcBmp.Dispose()

# Build ICO Binary Header & Entries
$outStream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($outStream)

# ICONDIR
$writer.Write([UInt16]0) # Reserved
$writer.Write([UInt16]1) # Type (1 = ICO)
$writer.Write([UInt16]$pngBuffers.Count) # Count

$dataOffset = 6 + (16 * $pngBuffers.Count)

foreach ($item in $pngBuffers) {
    $s = $item[0]
    $bytes = $item[1]
    
    $w = if ($s -eq 256) { [byte]0 } else { [byte]$s }
    $h = if ($s -eq 256) { [byte]0 } else { [byte]$s }

    $writer.Write([byte]$w)
    $writer.Write([byte]$h)
    $writer.Write([byte]0) # Color palette
    $writer.Write([byte]0) # Reserved
    $writer.Write([UInt16]1) # Color planes
    $writer.Write([UInt16]32) # Bits per pixel
    $writer.Write([UInt32]$bytes.Length) # Size
    $writer.Write([UInt32]$dataOffset) # Offset

    $dataOffset += $bytes.Length
}

foreach ($item in $pngBuffers) {
    $bytes = $item[1]
    $writer.Write($bytes, 0, $bytes.Length)
}

[System.IO.File]::WriteAllBytes($icoPath, $outStream.ToArray())
$writer.Close()
$outStream.Dispose()

Write-Host "✅ Multi-resolution icon.ico created successfully at $icoPath (" (Get-Item $icoPath).Length "bytes)"
