<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Device;
use App\Models\DeviceCommand;
use App\Models\EmergencyCredential;
use App\Models\EmergencySession;
use App\Services\SecurityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmergencyController extends Controller
{
    public function __construct(
        protected SecurityService $securityService
    ) {}

    /**
     * Authenticate emergency recovery access using Phone Tag and Recovery Key.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone_tag' => ['required', 'string', 'max:20'],
            'recovery_key' => ['required', 'string', 'max:50'],
        ]);

        $normalizedTag = strtoupper(trim($validated['phone_tag']));
        $device = Device::where('phone_tag', $normalizedTag)->first();

        // 1. Anti-Enumeration: If device doesn't exist, run dummy verification to maintain uniform timing
        if (! $device || ! $device->emergencyCredential) {
            $this->securityService->runDummyVerification($validated['recovery_key']);

            return response()->json([
                'status' => 'error',
                'code' => 'AUTH_FAILED',
                'message' => 'Invalid Phone Tag or Recovery Key.',
            ], 401);
        }

        /** @var EmergencyCredential $credential */
        $credential = $device->emergencyCredential;

        // 2. Progressive Throttling: If failed attempts >= 3, add progressive delay
        if ($credential->failed_attempts >= 3) {
            usleep(1000000); // 1 second artificial backoff
        }

        // 3. Verify Argon2id hash
        $isValid = $this->securityService->verifyRecoveryKey(
            $validated['recovery_key'],
            $credential->recovery_key_hash
        );

        if (! $isValid) {
            $credential->increment('failed_attempts');

            AuditLog::create([
                'device_id' => $device->id,
                'event_type' => 'AUTH_FAIL',
                'ip_address' => $request->ip() ?: '127.0.0.1',
                'details' => [
                    'failed_attempts' => $credential->failed_attempts,
                ],
            ]);

            return response()->json([
                'status' => 'error',
                'code' => 'AUTH_FAILED',
                'message' => 'Invalid Phone Tag or Recovery Key.',
            ], 401);
        }

        // 4. Successful Authentication: Reset failures & issue 15-minute token
        $credential->update([
            'failed_attempts' => 0,
            'locked_until' => null,
        ]);

        $plainEmergencyToken = $this->securityService->generateBearerToken('emg_sec');
        $expiresAt = now()->addMinutes(15);

        EmergencySession::create([
            'device_id' => $device->id,
            'token_hash' => hash('sha256', $plainEmergencyToken),
            'ip_address' => $request->ip() ?: '127.0.0.1',
            'user_agent' => $request->userAgent() ?: 'Emergency Web Client',
            'expires_at' => $expiresAt,
        ]);

        AuditLog::create([
            'device_id' => $device->id,
            'event_type' => 'AUTH_SUCCESS',
            'ip_address' => $request->ip() ?: '127.0.0.1',
            'details' => [
                'session_expires_at' => $expiresAt->toIso8601String(),
            ],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Emergency access granted.',
            'emergency_token' => $plainEmergencyToken,
            'expires_at' => $expiresAt->toIso8601String(),
            'device' => [
                'phone_tag' => $device->phone_tag,
                'device_name' => $device->device_name,
                'device_model' => $device->device_name,
                'battery_level' => $device->battery_level,
                'is_battery_charging' => $device->is_battery_charging,
                'last_seen_at' => $device->last_seen_at?->toIso8601String(),
            ],
            'data' => [
                'emergency_token' => $plainEmergencyToken,
                'expires_at' => $expiresAt->toIso8601String(),
                'device' => [
                    'phone_tag' => $device->phone_tag,
                    'device_name' => $device->device_name,
                    'device_model' => $device->device_name,
                    'battery_level' => $device->battery_level,
                    'is_battery_charging' => $device->is_battery_charging,
                    'last_seen_at' => $device->last_seen_at?->toIso8601String(),
                ],
            ],
        ]);
    }

    /**
     * Retrieve recovery device status, latest location, and command history.
     */
    public function deviceStatus(Request $request): JsonResponse
    {
        /** @var Device $device */
        $device = $request->attributes->get('device');

        $latestLocation = $device->latestLocation;
        $activeCommands = $device->commands()
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        $payload = [
            'device' => [
                'phone_tag' => $device->phone_tag,
                'device_name' => $device->device_name,
                'device_model' => $device->device_name,
                'battery_level' => $device->battery_level,
                'is_battery_charging' => $device->is_battery_charging,
                'is_charging' => $device->is_battery_charging,
                'is_protection_active' => $device->is_protection_active,
                'is_online_heuristic' => $device->last_seen_at ? $device->last_seen_at->diffInMinutes(now()) <= 5 : false,
                'last_seen_at' => $device->last_seen_at?->toIso8601String(),
                'last_telemetry_at' => $device->last_seen_at?->toIso8601String(),
            ],
            'latest_location' => $latestLocation,
            'recent_commands' => $activeCommands,
            'active_commands' => $activeCommands,
        ];

        return response()->json([
            'status' => 'success',
            ...$payload,
            'data' => $payload,
        ]);
    }

    /**
     * Generic command dispatcher mapping command_type to specific action.
     */
    public function command(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'command_type' => ['required', 'string', 'in:ring,lock,locate,RING,LOCK,LOCATE'],
        ]);

        $type = strtoupper($validated['command_type']);
        return match ($type) {
            'RING' => $this->ring($request),
            'LOCK' => $this->lock($request),
            'LOCATE' => $this->locate($request),
        };
    }

    /**
     * Dispatch remote siren ring command.
     */
    public function ring(Request $request): JsonResponse
    {
        return $this->createCommand($request, 'RING', [
            'duration_seconds' => $request->input('duration_seconds', 120),
        ]);
    }

    /**
     * Dispatch remote lock command.
     */
    public function lock(Request $request): JsonResponse
    {
        return $this->createCommand($request, 'LOCK');
    }

    /**
     * Dispatch on-demand GPS location refresh command.
     */
    public function locate(Request $request): JsonResponse
    {
        return $this->createCommand($request, 'LOCATE');
    }

    /**
     * Terminate and revoke the emergency session.
     */
    public function logout(Request $request): JsonResponse
    {
        /** @var EmergencySession $session */
        $session = $request->attributes->get('emergency_session');

        $session->update([
            'revoked_at' => now(),
        ]);

        AuditLog::create([
            'device_id' => $session->device_id,
            'event_type' => 'LOGOUT',
            'ip_address' => $request->ip() ?: '127.0.0.1',
            'details' => [
                'session_id' => $session->id,
            ],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Emergency session successfully terminated.',
        ]);
    }

    /**
     * Helper to create a command and audit entry with idempotency protection.
     */
    private function createCommand(Request $request, string $type, array $payload = []): JsonResponse
    {
        /** @var Device $device */
        $device = $request->attributes->get('device');

        // Check if an identical command is already pending/dispatched in the last 30s
        $existingRecentCommand = DeviceCommand::where('device_id', $device->id)
            ->where('command_type', $type)
            ->whereIn('status', ['PENDING', 'DISPATCHED'])
            ->where('created_at', '>=', now()->subSeconds(30))
            ->first();

        if ($existingRecentCommand) {
            return response()->json([
                'status' => 'accepted',
                'message' => 'Command already in progress.',
                'command' => [
                    'id' => $existingRecentCommand->id,
                    'command_type' => strtolower($existingRecentCommand->command_type),
                    'status' => $existingRecentCommand->status,
                    'expires_at' => $existingRecentCommand->expires_at->toIso8601String(),
                ],
                'data' => [
                    'command_id' => $existingRecentCommand->id,
                    'command_type' => $existingRecentCommand->command_type,
                    'status' => $existingRecentCommand->status,
                    'expires_at' => $existingRecentCommand->expires_at->toIso8601String(),
                ],
            ], 202);
        }

        $expiresAt = now()->addMinutes(5);

        $command = DeviceCommand::create([
            'device_id' => $device->id,
            'command_type' => $type,
            'status' => 'PENDING',
            'payload' => $payload,
            'expires_at' => $expiresAt,
        ]);

        AuditLog::create([
            'device_id' => $device->id,
            'event_type' => 'CMD_DISPATCH',
            'ip_address' => $request->ip() ?: '127.0.0.1',
            'details' => [
                'command_id' => $command->id,
                'command_type' => $type,
            ],
        ]);

        // Dispatch asynchronous high-priority push delivery job if FCM token is registered
        if (! empty($device->fcm_token)) {
            \App\Jobs\DispatchDeviceCommandJob::dispatch($command);
        }

        return response()->json([
            'status' => 'accepted',
            'message' => "Command '{$type}' created successfully.",
            'command' => [
                'id' => $command->id,
                'command_type' => strtolower($command->command_type),
                'status' => $command->status,
                'expires_at' => $expiresAt->toIso8601String(),
            ],
            'data' => [
                'command_id' => $command->id,
                'command_type' => $command->command_type,
                'status' => $command->status,
                'expires_at' => $expiresAt->toIso8601String(),
            ],
        ], 202);
    }
}
