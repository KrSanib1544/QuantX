$loginBody = '{"username":"admin","password":"adminpass"}' | ConvertFrom-Json | ConvertTo-Json
$r = Invoke-RestMethod -Uri 'http://localhost:8005/api/auth/login' -Method POST -ContentType 'application/json' -Body $loginBody
$token = $r.access_token
Write-Host "Token acquired OK (first 20 chars): $($token.Substring(0,20))..."

$headers = @{ Authorization = "Bearer $token" }

Write-Host "`n=== OPTIONS CHAIN (AAPL) ==="
$opts = Invoke-RestMethod -Uri 'http://localhost:8005/api/market-data/options-chain/AAPL' -Headers $headers
Write-Host "Symbol:          $($opts.symbol)"
Write-Host "Underlying:      $($opts.underlyingPrice)"
Write-Host "Expiry:          $($opts.expirationDates[0])"
Write-Host "Calls (first 3):"
$opts.calls | Select-Object -First 3 | Format-Table strike, lastPrice, volume, impliedVolatility
Write-Host "Puts (first 3):"
$opts.puts  | Select-Object -First 3 | Format-Table strike, lastPrice, volume, impliedVolatility

Write-Host "`n=== FOREX RATES ==="
$forex = Invoke-RestMethod -Uri 'http://localhost:8005/api/market-data/forex' -Headers $headers
$forex.rates | Get-Member -MemberType NoteProperty | ForEach-Object {
    Write-Host "$($_.Name): $($forex.rates.($_.Name))"
}
