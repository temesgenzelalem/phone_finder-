<?php

use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\EmergencyController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Phone Finder API Routes (v1)
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {

    // --- Device Routes (Physical Android Phone) ---
    Route::post('/device/enroll', [DeviceController::class, 'enroll'])
        ->middleware('throttle:device-enroll');

    Route::middleware('auth.device')->group(function () {
        Route::post('/device/telemetry', [DeviceController::class, 'telemetry']);
        Route::post('/device/fcm-token', [DeviceController::class, 'updateFcmToken']);
        Route::post('/device/commands/ack', [DeviceController::class, 'ackCommand']);
        Route::get('/device/audit-logs', [DeviceController::class, 'auditLogs']);
        Route::post('/device/revoke', [DeviceController::class, 'revoke']);
    });

    // --- Emergency Routes (Borrowed Web Browser) ---
    Route::post('/emergency/login', [EmergencyController::class, 'login'])
        ->middleware('throttle:emergency-login');

    Route::middleware('auth.emergency')->group(function () {
        Route::get('/emergency/device/status', [EmergencyController::class, 'deviceStatus']);
        Route::get('/emergency/status', [EmergencyController::class, 'deviceStatus']);
        Route::post('/emergency/command', [EmergencyController::class, 'command'])
            ->middleware('throttle:emergency-commands');
        Route::post('/emergency/commands/ring', [EmergencyController::class, 'ring'])
            ->middleware('throttle:emergency-commands');
        Route::post('/emergency/commands/lock', [EmergencyController::class, 'lock'])
            ->middleware('throttle:emergency-commands');
        Route::post('/emergency/commands/locate', [EmergencyController::class, 'locate'])
            ->middleware('throttle:emergency-commands');
        Route::post('/emergency/logout', [EmergencyController::class, 'logout']);
    });
});
