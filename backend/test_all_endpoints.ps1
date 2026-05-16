# LifeLens Backend - Complete API Test Script

Write-Host "========================================"
Write-Host "LifeLens Backend - Complete Test Suite"
Write-Host "========================================"
Write-Host ""

$baseUrl = "http://127.0.0.1:5000"
$testsPassed = 0
$testsFailed = 0

# Test 1: Signup
Write-Host "Test 1: Signup" -ForegroundColor Yellow
try {
    $signupBody = @{
        name = "Test User"
        email = "testuser@example.com"
        password = "password123"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$baseUrl/signup" `
        -Method POST `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $signupBody

    $data = $response.Content | ConvertFrom-Json
    Write-Host "PASSED: Signup successful" -ForegroundColor Green
    Write-Host "Message: $($data.message)" -ForegroundColor Green
    $testsPassed++
}
catch {
    Write-Host "FAILED: Signup" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}
Write-Host ""

# Test 2: Login
Write-Host "Test 2: Login" -ForegroundColor Yellow
try {
    $loginBody = @{
        email = "testuser@example.com"
        password = "password123"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$baseUrl/login" `
        -Method POST `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $loginBody

    $data = $response.Content | ConvertFrom-Json
    $token = $data.token
    
    Write-Host "PASSED: Login successful" -ForegroundColor Green
    Write-Host "User: $($data.user.name)" -ForegroundColor Green
    $testsPassed++
}
catch {
    Write-Host "FAILED: Login" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
    $token = $null
}
Write-Host ""

# Test 3: Get Profile (Protected)
if ($token) {
    Write-Host "Test 3: Get Profile (Protected)" -ForegroundColor Yellow
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        }

        $response = Invoke-WebRequest -Uri "$baseUrl/profile" `
            -Method GET `
            -Headers $headers

        $data = $response.Content | ConvertFrom-Json
        
        Write-Host "PASSED: Get profile successful" -ForegroundColor Green
        Write-Host "Name: $($data.name)" -ForegroundColor Green
        $testsPassed++
    }
    catch {
        Write-Host "FAILED: Get Profile" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        $testsFailed++
    }
    Write-Host ""
}

# Test 4: Add Activity
Write-Host "Test 4: Add Activity" -ForegroundColor Yellow
try {
    $activityBody = @{
        name = "Running"
        hours = 2.5
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$baseUrl/activities" `
        -Method POST `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $activityBody

    $data = $response.Content | ConvertFrom-Json
    $activityId = $data.id
    
    Write-Host "PASSED: Activity added" -ForegroundColor Green
    Write-Host "Activity ID: $activityId" -ForegroundColor Green
    $testsPassed++
}
catch {
    Write-Host "FAILED: Add Activity" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
    $activityId = $null
}
Write-Host ""

# Test 5: Get All Activities
Write-Host "Test 5: Get All Activities" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/activities" `
        -Method GET

    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "PASSED: Get activities successful" -ForegroundColor Green
    Write-Host "Total activities: $($data.Count)" -ForegroundColor Green
    $testsPassed++
}
catch {
    Write-Host "FAILED: Get Activities" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}
Write-Host ""

# Test 6: Update Activity
if ($activityId) {
    Write-Host "Test 6: Update Activity" -ForegroundColor Yellow
    try {
        $updateBody = @{
            name = "Running (Updated)"
            hours = 3
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "$baseUrl/activities/$activityId" `
            -Method PUT `
            -Headers @{"Content-Type" = "application/json"} `
            -Body $updateBody

        $data = $response.Content | ConvertFrom-Json
        
        Write-Host "PASSED: Activity updated" -ForegroundColor Green
        $testsPassed++
    }
    catch {
        Write-Host "FAILED: Update Activity" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        $testsFailed++
    }
    Write-Host ""
}

# Test 7: Add Task
Write-Host "Test 7: Add Task" -ForegroundColor Yellow
try {
    $taskBody = @{
        title = "Complete project setup"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$baseUrl/tasks" `
        -Method POST `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $taskBody

    $data = $response.Content | ConvertFrom-Json
    $taskId = $data.id
    
    Write-Host "PASSED: Task added" -ForegroundColor Green
    Write-Host "Task ID: $taskId" -ForegroundColor Green
    $testsPassed++
}
catch {
    Write-Host "FAILED: Add Task" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
    $taskId = $null
}
Write-Host ""

# Test 8: Get All Tasks
Write-Host "Test 8: Get All Tasks" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/tasks" `
        -Method GET

    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "PASSED: Get tasks successful" -ForegroundColor Green
    Write-Host "Total tasks: $($data.Count)" -ForegroundColor Green
    $testsPassed++
}
catch {
    Write-Host "FAILED: Get Tasks" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}
Write-Host ""

# Test 9: Toggle Task Status
if ($taskId) {
    Write-Host "Test 9: Toggle Task Status" -ForegroundColor Yellow
    try {
        $toggleBody = @{
            completed = $true
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "$baseUrl/tasks/$taskId" `
            -Method PUT `
            -Headers @{"Content-Type" = "application/json"} `
            -Body $toggleBody

        $data = $response.Content | ConvertFrom-Json
        
        Write-Host "PASSED: Task toggled" -ForegroundColor Green
        $testsPassed++
    }
    catch {
        Write-Host "FAILED: Toggle Task" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        $testsFailed++
    }
    Write-Host ""
}

# Test 10: Delete Task
if ($taskId) {
    Write-Host "Test 10: Delete Task" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/tasks/$taskId" `
            -Method DELETE

        $data = $response.Content | ConvertFrom-Json
        
        Write-Host "PASSED: Task deleted" -ForegroundColor Green
        $testsPassed++
    }
    catch {
        Write-Host "FAILED: Delete Task" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        $testsFailed++
    }
    Write-Host ""
}

# Test 11: Delete Activity
if ($activityId) {
    Write-Host "Test 11: Delete Activity" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/activities/$activityId" `
            -Method DELETE

        $data = $response.Content | ConvertFrom-Json
        
        Write-Host "PASSED: Activity deleted" -ForegroundColor Green
        $testsPassed++
    }
    catch {
        Write-Host "FAILED: Delete Activity" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        $testsFailed++
    }
    Write-Host ""
}

# Test 12: Test Invalid Token
Write-Host "Test 12: Test Invalid Token" -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer invalid_token_12345"
        "Content-Type" = "application/json"
    }

    $response = Invoke-WebRequest -Uri "$baseUrl/profile" `
        -Method GET `
        -Headers $headers

    Write-Host "FAILED: Invalid token was accepted" -ForegroundColor Red
    $testsFailed++
}
catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "PASSED: Invalid token rejected correctly" -ForegroundColor Green
        $testsPassed++
    }
    else {
        Write-Host "FAILED: Wrong error code" -ForegroundColor Red
        $testsFailed++
    }
}
Write-Host ""

# Summary
Write-Host "========================================"
Write-Host "Test Summary"
Write-Host "========================================"
Write-Host "Tests Passed: $testsPassed" -ForegroundColor Green
Write-Host "Tests Failed: $testsFailed" -ForegroundColor Red
Write-Host "Total Tests: $($testsPassed + $testsFailed)" -ForegroundColor Cyan

if ($testsFailed -eq 0) {
    Write-Host ""
    Write-Host "ALL TESTS PASSED! Backend is ready!" -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "Some tests failed. Check the errors above." -ForegroundColor Yellow
}
Write-Host ""