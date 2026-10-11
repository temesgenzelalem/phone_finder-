<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Device;
use App\Models\DeviceCommand;
use App\Models\DeviceToken;
use App\Models\EmergencyCredential;
use App\Models\Location;
use App\Services\SecurityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DeviceController extends Controller
{
    public function __construct(
        protected SecurityService $securityService
    ) {}

    /**
     * Enroll a new physical Android device.
     */
    public function enroll(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_name' => ['required', 'string', 'max:100'],
            'device_instance_id' => ['required', 'uuid'],
            'recovery_key' => ['required', 'string', 'min:8', 'max:50'],
            'fcm_token' => ['nullable', 'string', 'max:500'],
        ]);

        return DB::transaction(function () use ($validated, $request) {
            // If device_instance_id already exists, remove stale enrollment
            $existing = Device::where('device_instance_id', $validated['device_instance_id'])->first();
            if ($existing) {
                $existing->delete();
            }

            $phoneTag = $this->securityService->generateUniquePhoneTag();
            $recoveryKeyHash = $this->securityService->hashRecoveryKey($validated['recovery_key']);

            $device = Device::create([
                'phone_tag' => $phoneTag,
                'device_name' => $validated['device_name'],
                'device_instance_id' => $validated['device_instance_id'],
                'fcm_token' => $validated['fcm_token'] ?? null,
                'is_protection_active' => true,
                'last_seen_at' => now(),
            ]);

            EmergencyCredential::create([
                'device_id' => $device->id,
                'recovery_key_hash' => $recoveryKeyHash,
                'failed_attempts' => 0,
            ]);

            $plainDeviceToken = $this->securityService->generateBearerToken('dev_sec');
            DeviceToken::create([
                'device_id' => $device->id,
                'token_hash' => hash('sha256', $plainDeviceToken),
                'name' => 'primary_app',
                'expires_at' => now()->addYear(),
            ]);

            AuditLog::create([
                'device_id' => $device->id,
                'event_type' => 'ENROLL',
                'ip_address' => $request->ip() ?: '127.0.0.1',
                'details' => [
                    'device_name' => $validated['device_name'],
                    'phone_tag' => $phoneTag,
                ],
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Device enrolled successfully.',
                'data' => [
                    'device_id' => $device->id,
                    'phone_tag' => $phoneTag,
                    'device_token' => $plainDeviceToken,
                    'device_name' => $device->device_name,
                ],
            ], 201);
        });
    }

    /**
     * Report location and telemetry from the device.
     */
    public function telemetry(Request $request): JsonResponse
    {
        /** @var Device $device */
        $device = $request->attributes->get('device');

        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy_meters' => ['required', 'numeric', 'min:0'],
            'altitude' => ['nullable', 'numeric'],
            'battery_level' => ['nullable', 'integer', 'between:0,100'],
            'is_battery_charging' => ['nullable', 'boolean'],
            'trigger_type' => ['required', Rule::in(['HEARTBEAT', 'ON_DEMAND', 'LOW_BATTERY'])],
            'recorded_at' => ['required', 'date'],
        ]);

        $location = Location::create([
            'device_id' => $device->id,
            'latitude' => $validated['latitude'],
            'longitude' => $validated['longitude'],
            'accuracy_meters' => $validated['accuracy_meters'],
            'altitude' => $validated['altitude'] ?? null,
            'battery_level' => $validated['battery_level'] ?? null,
            'trigger_type' => $validated['trigger_type'],
            'recorded_at' => $validated['recorded_at'],
        ]);

        $deviceUpdates = ['last_seen_at' => now()];
        if (isset($validated['battery_level'])) {
            $deviceUpdates['battery_level'] = $validated['battery_level'];
        }
        if (isset($validated['is_battery_charging'])) {
            $deviceUpdates['is_battery_charging'] = $validated['is_battery_charging'];
        }

        $device->update($deviceUpdates);

        return response()->json([
            'status' => 'success',
            'message' => 'Telemetry recorded successfully.',
            'data' => [
                'location_id' => $location->id,
                'recorded_at' => $location->recorded_at,
            ],
        ]);
    }

    /**
     * Update the FCM push token when rotated on the device.
     */
    public function updateFcmToken(Request $request): JsonResponse
    {
        /** @var Device $device */
        $device = $request->attributes->get('device');

        $validated = $request->validate([
            'fcm_token' => ['required', 'string', 'max:500'],
        ]);

        $device->update([
            'fcm_token' => $validated['fcm_token'],
            'last_seen_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'FCM push token updated successfully.',
        ]);
    }

    /**
     * Acknowledge command receipt, progress, or execution.
     */
    public function ackCommand(Request $request): JsonResponse
    {
        /** @var Device $device */
        $device = $request->attributes->get('device');

        $validated = $request->validate([
            'command_id' => ['required', 'uuid'],
            'status' => ['required', Rule::in(['DELIVERED', 'EXECUTING', 'EXECUTED', 'FAILED', 'EXPIRED'])],
            'executed_at' => ['nullable', 'date'],
            'error_message' => ['nullable', 'string', 'max:500'],
        ]);

        $command = DeviceCommand::where('id', $validated['command_id'])
            ->where('device_id', $device->id)
            ->first();

        if (! $command) {
            return response()->json([
                'status' => 'error',
                'code' => 'COMMAND_NOT_FOUND',
                'message' => 'Command not found for this device.',
            ], 404);
        }

        $updates = [
            'status' => $validated['status'],
            'error_message' => $validated['error_message'] ?? null,
        ];

        if ($validated['status'] === 'DELIVERED' && ! $command->delivered_at) {
            $updates['delivered_at'] = now();
        }

        if ($validated['status'] === 'EXECUTED') {
            $updates['executed_at'] = $validated['executed_at'] ?? now();
        }

        $command->update($updates);

        AuditLog::create([
            'device_id' => $device->id,
            'event_type' => 'CMD_ACK',
            'ip_address' => $request->ip() ?: '127.0.0.1',
            'details' => [
                'command_id' => $command->id,
                'command_type' => $command->command_type,
                'status' => $validated['status'],
                'error_message' => $validated['error_message'] ?? null,
            ],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Command acknowledgment recorded.',
            'data' => [
                'command_id' => $command->id,
                'status' => $command->status,
            ],
        ]);
    }

    /**
     * Fetch security audit logs for the device owner.
     */
    public function auditLogs(Request $request): JsonResponse
    {
        /** @var Device $device */
        $device = $request->attributes->get('device');

        $logs = AuditLog::where('device_id', $device->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $logs,
        ]);
    }

    /**
     * Unenroll/revoke a device, deleting credentials and active sessions.
     */
    public function revoke(Request $request): JsonResponse
    {
        /** @var Device $device */
        $device = $request->attributes->get('device');

        AuditLog::create([
            'device_id' => $device->id,
            'event_type' => 'REVOKE',
            'ip_address' => $request->ip() ?: '127.0.0.1',
            'details' => [
                'device_name' => $device->device_name,
                'phone_tag' => $device->phone_tag,
            ],
        ]);

        // Cascading deletion cleans up all related tokens, credentials, sessions, commands, and locations
        $device->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Device successfully unenrolled. All credentials and active sessions revoked.',
        ]);
    }
}
