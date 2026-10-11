<?php

namespace Tests\Feature;

use App\Models\Device;
use App\Models\DeviceCommand;
use App\Models\DeviceToken;
use App\Models\EmergencyCredential;
use App\Models\EmergencySession;
use App\Models\Location;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuthenticationAndDeviceLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private const SAMPLE_RECOVERY_KEY = 'PF-K7W2-9M4X-3Q8J';

    public function test_device_enrollment_succeeds_and_hashes_key(): void
    {
        $instanceId = Str::uuid()->toString();

        $response = $this->postJson('/api/v1/device/enroll', [
            'device_name' => "Temesgen's Android 14",
            'device_instance_id' => $instanceId,
            'recovery_key' => self::SAMPLE_RECOVERY_KEY,
            'fcm_token' => 'fcm_test_token_abc_123',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'status',
                'message',
                'data' => [
                    'device_id',
                    'phone_tag',
                    'device_token',
                    'device_name',
                ],
            ]);

        $data = $response->json('data');
        $this->assertStringStartsWith('PF-', $data['phone_tag']);
        $this->assertStringStartsWith('dev_sec_', $data['device_token']);

        // Verify database records
        $this->assertDatabaseHas('devices', [
            'id' => $data['device_id'],
            'device_instance_id' => $instanceId,
            'fcm_token' => 'fcm_test_token_abc_123',
        ]);

        $credential = EmergencyCredential::where('device_id', $data['device_id'])->first();
        $this->assertNotNull($credential);
        $this->assertTrue(password_verify(self::SAMPLE_RECOVERY_KEY, $credential->recovery_key_hash));
    }

    public function test_device_telemetry_requires_token_and_persists_location(): void
    {
        // 1. Unauthenticated request must fail with 401
        $this->postJson('/api/v1/device/telemetry', [
            'latitude' => 11.5972,
            'longitude' => 37.3884,
            'accuracy_meters' => 12.0,
            'trigger_type' => 'HEARTBEAT',
            'recorded_at' => now()->toIso8601String(),
        ])->assertStatus(401);

        // 2. Enroll a device to get a valid token
        $enrollResponse = $this->postJson('/api/v1/device/enroll', [
            'device_name' => 'Test Phone',
            'device_instance_id' => Str::uuid()->toString(),
            'recovery_key' => self::SAMPLE_RECOVERY_KEY,
        ]);

        $deviceToken = $enrollResponse->json('data.device_token');
        $deviceId = $enrollResponse->json('data.device_id');

        // 3. Authenticated telemetry upload
        $telemetryResponse = $this->withHeader('Authorization', 'Bearer '.$deviceToken)
            ->postJson('/api/v1/device/telemetry', [
                'latitude' => 11.5972301,
                'longitude' => 37.3884218,
                'accuracy_meters' => 15.5,
                'altitude' => 1800.0,
                'battery_level' => 74,
                'is_battery_charging' => false,
                'trigger_type' => 'HEARTBEAT',
                'recorded_at' => now()->toIso8601String(),
            ]);

        $telemetryResponse->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseHas('locations', [
            'device_id' => $deviceId,
            'battery_level' => 74,
            'trigger_type' => 'HEARTBEAT',
        ]);

        $this->assertDatabaseHas('devices', [
            'id' => $deviceId,
            'battery_level' => 74,
        ]);
    }

    public function test_device_fcm_token_update(): void
    {
        $enrollResponse = $this->postJson('/api/v1/device/enroll', [
            'device_name' => 'FCM Update Device',
            'device_instance_id' => Str::uuid()->toString(),
            'recovery_key' => self::SAMPLE_RECOVERY_KEY,
        ]);

        $deviceToken = $enrollResponse->json('data.device_token');
        $deviceId = $enrollResponse->json('data.device_id');

        $response = $this->withHeader('Authorization', 'Bearer '.$deviceToken)
            ->postJson('/api/v1/device/fcm-token', [
                'fcm_token' => 'newly_rotated_fcm_token_xyz_789',
            ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('devices', [
            'id' => $deviceId,
            'fcm_token' => 'newly_rotated_fcm_token_xyz_789',
        ]);
    }

    public function test_command_acknowledgment_updates_state(): void
    {
        $enrollResponse = $this->postJson('/api/v1/device/enroll', [
            'device_name' => 'ACK Device',
            'device_instance_id' => Str::uuid()->toString(),
            'recovery_key' => self::SAMPLE_RECOVERY_KEY,
        ]);

        $deviceToken = $enrollResponse->json('data.device_token');
        $deviceId = $enrollResponse->json('data.device_id');

        $command = DeviceCommand::create([
            'device_id' => $deviceId,
            'command_type' => 'RING',
            'status' => 'DISPATCHED',
            'expires_at' => now()->addMinutes(5),
        ]);

        // Acknowledge as DELIVERED
        $this->withHeader('Authorization', 'Bearer '.$deviceToken)
            ->postJson('/api/v1/device/commands/ack', [
                'command_id' => $command->id,
                'status' => 'DELIVERED',
            ])->assertStatus(200);

        $command->refresh();
        $this->assertEquals('DELIVERED', $command->status);
        $this->assertNotNull($command->delivered_at);

        // Acknowledge as EXECUTED
        $this->withHeader('Authorization', 'Bearer '.$deviceToken)
            ->postJson('/api/v1/device/commands/ack', [
                'command_id' => $command->id,
                'status' => 'EXECUTED',
                'executed_at' => now()->toIso8601String(),
            ])->assertStatus(200);

        $command->refresh();
        $this->assertEquals('EXECUTED', $command->status);
        $this->assertNotNull($command->executed_at);
    }

    public function test_emergency_login_succeeds_and_issues_scoped_token(): void
    {
        $enrollResponse = $this->postJson('/api/v1/device/enroll', [
            'device_name' => 'Emergency Test Phone',
            'device_instance_id' => Str::uuid()->toString(),
            'recovery_key' => self::SAMPLE_RECOVERY_KEY,
        ]);

        $phoneTag = $enrollResponse->json('data.phone_tag');

        $loginResponse = $this->postJson('/api/v1/emergency/login', [
            'phone_tag' => $phoneTag,
            'recovery_key' => self::SAMPLE_RECOVERY_KEY,
        ]);

        $loginResponse->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'message',
                'data' => [
                    'emergency_token',
                    'expires_at',
                    'device' => [
                        'phone_tag',
                        'device_name',
                    ],
                ],
            ]);

        $emergencyToken = $loginResponse->json('data.emergency_token');
        $this->assertStringStartsWith('emg_sec_', $emergencyToken);
    }

    public function test_emergency_login_fails_without_leaking_enumeration(): void
    {
        // 1. Existing Phone Tag with wrong recovery key
        $enrollResponse = $this->postJson('/api/v1/device/enroll', [
            'device_name' => 'Enum Target Phone',
            'device_instance_id' => Str::uuid()->toString(),
            'recovery_key' => self::SAMPLE_RECOVERY_KEY,
        ]);
        $phoneTag = $enrollResponse->json('data.phone_tag');

        $wrongKeyResponse = $this->postJson('/api/v1/emergency/login', [
            'phone_tag' => $phoneTag,
            'recovery_key' => 'WRONG-KEY-1234',
        ]);

        // 2. Non-existent Phone Tag
        $nonExistentTagResponse = $this->postJson('/api/v1/emergency/login', [
            'phone_tag' => 'PF-NONEXIST-TAG',
            'recovery_key' => 'WRONG-KEY-1234',
        ]);

        // Both must return identical HTTP status, error code, and error message
        $wrongKeyResponse->assertStatus(401);
        $nonExistentTagResponse->assertStatus(401);

        $this->assertEquals(
            $wrongKeyResponse->json('message'),
            $nonExistentTagResponse->json('message')
        );
        $this->assertEquals(
            $wrongKeyResponse->json('code'),
            $nonExistentTagResponse->json('code')
        );
    }

    public function test_emergency_session_expiration_and_logout_revocation(): void
    {
        $enrollResponse = $this->postJson('/api/v1/device/enroll', [
            'device_name' => 'Revoke Test Phone',
            'device_instance_id' => Str::uuid()->toString(),
            'recovery_key' => self::SAMPLE_RECOVERY_KEY,
        ]);

        $phoneTag = $enrollResponse->json('data.phone_tag');

        $loginResponse = $this->postJson('/api/v1/emergency/login', [
            'phone_tag' => $phoneTag,
            'recovery_key' => self::SAMPLE_RECOVERY_KEY,
        ]);

        $emergencyToken = $loginResponse->json('data.emergency_token');

        // Can access device status
        $this->withHeader('Authorization', 'Bearer '.$emergencyToken)
            ->getJson('/api/v1/emergency/device/status')
            ->assertStatus(200);

        // Logout revokes session
        $this->withHeader('Authorization', 'Bearer '.$emergencyToken)
            ->postJson('/api/v1/emergency/logout')
            ->assertStatus(200);

        // Subsequent requests must be rejected
        $this->withHeader('Authorization', 'Bearer '.$emergencyToken)
            ->getJson('/api/v1/emergency/device/status')
            ->assertStatus(401)
            ->assertJsonPath('code', 'SESSION_REVOKED');
    }

    public function test_emergency_commands_and_deduplication(): void
    {
        $enrollResponse = $this->postJson('/api/v1/device/enroll', [
            'device_name' => 'Command Test Phone',
            'device_instance_id' => Str::uuid()->toString(),
            'recovery_key' => self::SAMPLE_RECOVERY_KEY,
        ]);

        $phoneTag = $enrollResponse->json('data.phone_tag');

        $loginResponse = $this->postJson('/api/v1/emergency/login', [
            'phone_tag' => $phoneTag,
            'recovery_key' => self::SAMPLE_RECOVERY_KEY,
        ]);

        $emergencyToken = $loginResponse->json('data.emergency_token');

        // Dispatch RING command
        $cmdResponse = $this->withHeader('Authorization', 'Bearer '.$emergencyToken)
            ->postJson('/api/v1/emergency/commands/ring', [
                'duration_seconds' => 120,
            ]);

        $cmdResponse->assertStatus(202)
            ->assertJsonPath('status', 'accepted')
            ->assertJsonPath('data.command_type', 'RING');

        $commandId = $cmdResponse->json('data.command_id');

        // Rapid duplicate dispatch should return existing in-progress command (idempotent)
        $dupResponse = $this->withHeader('Authorization', 'Bearer '.$emergencyToken)
            ->postJson('/api/v1/emergency/commands/ring');

        $dupResponse->assertStatus(202)
            ->assertJsonPath('data.command_id', $commandId);

        // Dispatch LOCK command
        $lockResponse = $this->withHeader('Authorization', 'Bearer '.$emergencyToken)
            ->postJson('/api/v1/emergency/commands/lock');

        $lockResponse->assertStatus(202)
            ->assertJsonPath('data.command_type', 'LOCK');
    }

    public function test_device_revocation_unenrolls_and_invalidates_all_tokens(): void
    {
        $enrollResponse = $this->postJson('/api/v1/device/enroll', [
            'device_name' => 'Device To Revoke',
            'device_instance_id' => Str::uuid()->toString(),
            'recovery_key' => self::SAMPLE_RECOVERY_KEY,
        ]);

        $deviceToken = $enrollResponse->json('data.device_token');
        $phoneTag = $enrollResponse->json('data.phone_tag');

        // Create an emergency session too
        $loginResponse = $this->postJson('/api/v1/emergency/login', [
            'phone_tag' => $phoneTag,
            'recovery_key' => self::SAMPLE_RECOVERY_KEY,
        ]);
        $emergencyToken = $loginResponse->json('data.emergency_token');

        // Revoke from physical device
        $revokeResponse = $this->withHeader('Authorization', 'Bearer '.$deviceToken)
            ->postJson('/api/v1/device/revoke');

        $revokeResponse->assertStatus(200);

        // Device token is now rejected
        $this->withHeader('Authorization', 'Bearer '.$deviceToken)
            ->postJson('/api/v1/device/telemetry', [
                'latitude' => 11.59,
                'longitude' => 37.38,
                'accuracy_meters' => 10,
                'trigger_type' => 'HEARTBEAT',
                'recorded_at' => now()->toIso8601String(),
            ])->assertStatus(401);

        // Emergency token is also rejected
        $this->withHeader('Authorization', 'Bearer '.$emergencyToken)
            ->getJson('/api/v1/emergency/device/status')
            ->assertStatus(401);
    }
}
