$inputJson = $input | Out-String | ConvertFrom-Json

$ESC     = [char]27
$RESET   = "$ESC[0m"
$BOLD    = "$ESC[1m"
$GRAY    = "$ESC[90m"
$RED     = "$ESC[91m"
$GREEN   = "$ESC[92m"
$YELLOW  = "$ESC[93m"
$BLUE    = "$ESC[94m"
$CYAN    = "$ESC[96m"

$cwd = $inputJson.cwd
$folderName = if ($cwd) { Split-Path $cwd -Leaf } else { (Get-Location).Path | Split-Path -Leaf }

$modelName = $inputJson.model.display_name
if (-not $modelName) { $modelName = $inputJson.model }

$effort = $inputJson.effort.level

$contextPercent = $null
if ($null -ne $inputJson.context_window.used_percentage) {
    $contextPercent = [math]::Round($inputJson.context_window.used_percentage)
}

$fiveHourPercent = $null
if ($null -ne $inputJson.rate_limits.five_hour.used_percentage) {
    $fiveHourPercent = [math]::Round($inputJson.rate_limits.five_hour.used_percentage)
}

$resetText = ""
$resetAt = $inputJson.rate_limits.five_hour.resets_at
if ($resetAt) {
    try {
        $resetTime = [DateTimeOffset]::FromUnixTimeSeconds([int64]$resetAt).LocalDateTime
        $remaining = $resetTime - (Get-Date)
        if ($remaining.TotalMinutes -gt 0) {
            $hours   = [math]::Floor($remaining.TotalHours)
            $minutes = [math]::Floor($remaining.TotalMinutes % 60)
            $resetText = " ${BLUE}reset:${hours}h ${minutes}m${RESET}"
        }
    } catch {}
}

$branchName = ""
try {
    git rev-parse --is-inside-work-tree 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $branch = (git branch --show-current).Trim()
        if ($branch) { $branchName = " ${CYAN}[$branch]${RESET}" }
    }
} catch { $branchName = "" }

function Get-PctColor($pct) {
    if ($pct -lt 50) { return $GREEN }
    if ($pct -lt 80) { return $YELLOW }
    return $RED
}

$output = "${BOLD}${GRAY}$folderName${RESET}$branchName"

if ($modelName) {
    $output += " [$modelName]${RESET}"
}

if ($effort) {
    $output += " ${YELLOW}effort:$effort${RESET}"
}

if ($null -ne $contextPercent) {
    $color = Get-PctColor $contextPercent
    $output += " ${color}ctx:${contextPercent}%${RESET}"
}

if ($null -ne $fiveHourPercent) {
    $color = Get-PctColor $fiveHourPercent
    $output += " ${color}5h:${fiveHourPercent}%${RESET}"
}

if ($resetText) {
    $output += $resetText
}

Write-Output $output
