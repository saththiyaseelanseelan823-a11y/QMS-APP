# PowerShell Static Web Server for QMS
$port = 8080
$root = "c:\Users\ssath\Documents\qms\frontend"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

Write-Host "Starting PowerShell Static Web Server..."
Write-Host "Serving folder: $root"
Write-Host "URL: http://localhost:$port"

try {
    $listener.Start()
    Write-Host "Server successfully started and listening on http://localhost:$port"
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath
        # Default to index.html for root path
        if ($urlPath -eq "/") {
            $urlPath = "/index.html"
        }
        
        # Build file path carefully
        $cleanPath = $urlPath.Replace('/', '\').TrimStart('\')
        $filePath = Join-Path $root $cleanPath
        
        Write-Host "[Request] $($request.HttpMethod) $($request.Url.PathAndQuery)"
        
        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = "application/octet-stream"
            switch ($ext) {
                ".html" { $contentType = "text/html; charset=utf-8" }
                ".css"  { $contentType = "text/css; charset=utf-8" }
                ".js"   { $contentType = "application/javascript; charset=utf-8" }
                ".png"  { $contentType = "image/png" }
                ".jpg"  { $contentType = "image/jpeg" }
                ".jpeg" { $contentType = "image/jpeg" }
                ".gif"  { $contentType = "image/gif" }
                ".svg"  { $contentType = "image/svg+xml" }
                ".ico"  { $contentType = "image/x-icon" }
                ".json" { $contentType = "application/json; charset=utf-8" }
            }
            
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "[Response] 200 OK ($contentType, $($bytes.Length) bytes)"
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: File not found")
            $response.ContentType = "text/plain; charset=utf-8"
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            Write-Host "[Response] 404 Not Found ($filePath)"
        }
        $response.Close()
    }
} catch {
    Write-Error $_
} finally {
    if ($listener) {
        $listener.Close()
        Write-Host "Server stopped."
    }
}
