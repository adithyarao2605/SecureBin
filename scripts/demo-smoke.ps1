$ErrorActionPreference = 'Stop'

# Safe, read-only smoke check. It never creates a share or handles secrets.
$appUrl = if ($env:APP_URL) { $env:APP_URL.TrimEnd('/') } else { 'http://localhost:3000' }
$healthUrl = "$appUrl/api/health"

Write-Host "Checking $healthUrl"
$response = Invoke-WebRequest -Uri $healthUrl -Method Get -Headers @{ Accept = 'application/json' } -TimeoutSec 10
if ([string]::IsNullOrWhiteSpace($response.Content)) {
    throw 'Health endpoint returned an empty response'
}

Write-Host 'Health check passed'
