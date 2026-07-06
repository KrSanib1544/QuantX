try {
    $h = Invoke-RestMethod 'http://localhost:8007/health'
    Write-Host "Port 8007 (Quantum Direct): status=$($h.status) service=$($h.service)"
} catch {
    Write-Host "Port 8007 DOWN: $_"
}

try {
    $r = Invoke-RestMethod -Uri 'http://localhost:8005/api/auth/login' -Method POST -ContentType 'application/json' -Body '{"username":"admin","password":"adminpass"}'
    $token = $r.access_token
    $headers = @{ Authorization = "Bearer $token" }

    Write-Host "`nChecking quantum service via /api/health gateway endpoint..."
    $health = Invoke-RestMethod 'http://localhost:8005/api/health' -Headers $headers
    Write-Host ($health | ConvertTo-Json -Depth 3)

    Write-Host "`nQuantum Experiments count:"
    $experiments = Invoke-RestMethod 'http://localhost:8005/api/quantum/experiments' -Headers $headers
    Write-Host "Count = $($experiments.Count)"

    if ($experiments.Count -gt 0) {
        $firstId = $experiments[0].id
        Write-Host "Loading results for experiment $firstId..."
        $results = Invoke-RestMethod "http://localhost:8005/api/quantum/experiments/$firstId/results" -Headers $headers
        Write-Host "Status: $($results.status)"
        Write-Host "Has portfolio_optimization: $($null -ne $results.results.portfolio_optimization)"
        Write-Host "Has feature_selection: $($null -ne $results.results.feature_selection)"
    }
} catch {
    Write-Host "Gateway ERROR: $_"
}
