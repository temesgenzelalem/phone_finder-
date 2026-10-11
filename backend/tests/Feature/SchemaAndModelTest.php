<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Device;
use App\Models\DeviceCommand;
use App\Models\DeviceToken;
use App\Models\EmergencyCredential;
use App\Models\EmergencySession;
use App\Models\Location;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class SchemaAndModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_device_and_related_entities_with_cascade_and_hidden_fields(): void
    {
        // 1. Create Device
        $device = Device::create([
            'phone_tag' => 'PF-K7W2-9M4X',
            'device_name' => "Temesgen's Test Phone",
            'device_instance_id' => Str::uuid()->toString(),
            'fcm_token' => 'fcm_fake_token_12345',
            'battery_level' => 85,
            'is_battery_charging' => false,
            'is_protection_active' => true,
            'last_seen_at' => now(),
        ]);

        $this->assertNotNull($device->id);
        $this->assertEquals('PF-K7W2-9M4X', $device->phone_tag);

        // 2. Create EmergencyCredential
        $credential = EmergencyCredential::create([
            'device_id' => $device->id,
            'recovery_key_hash' => password_hash('PF-K7W2-9M4X-3Q8J', PASSWORD_ARGON2ID),
            'failed_attempts' => 0,
        ]);

        $this->assertNotNull($credential->id);
        // Verify recovery_key_hash is hidden in JSON
        $this->assertArrayNotHasKey('recovery_key_hash', $credential->toArray());

        // 3. Create DeviceToken
        $token = DeviceToken::create([
            'device_id' => $device->id,
            'token_hash' => hash('sha256', 'dev_sec_sample_secret_token'),
            'name' => 'primary_app',
            'expires_at' => now()->addYear(),
        ]);

        $this->assertNotNull($token->id);
        $this->assertArrayNotHasKey('token_hash', $token->toArray());

        // 4. Create Location
        $location = Location::create([
            'device_id' => $device->id,
            'latitude' => 11.5972301,
            'longitude' => 37.3884218,
            'accuracy_meters' => 14.2,
            'altitude' => 1820.5,
            'battery_level' => 85,
            'trigger_type' => 'HEARTBEAT',
            'recorded_at' => now(),
        ]);

        $this->assertNotNull($location->id);
        $this->assertEquals(11.5972301, $location->latitude);

        // 5. Create DeviceCommand
        $command = DeviceCommand::create([
            'device_id' => $device->id,
            'command_type' => 'RING',
            'status' => 'PENDING',
            'payload' => ['duration_seconds' => 120],
            'expires_at' => now()->addMinutes(5),
        ]);

        $this->assertNotNull($command->id);
        $this->assertEquals('RING', $command->command_type);

        // 6. Create EmergencySession
        $session = EmergencySession::create([
            'device_id' => $device->id,
            'token_hash' => hash('sha256', 'emg_sec_sample_session_token'),
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Mozilla/5.0 PHPUnit Test',
            'expires_at' => now()->addMinutes(15),
        ]);

        $this->assertNotNull($session->id);
        $this->assertArrayNotHasKey('token_hash', $session->toArray());

        // 7. Create AuditLog
        $audit = AuditLog::create([
            'device_id' => $device->id,
            'event_type' => 'ENROLL',
            'ip_address' => '127.0.0.1',
            'details' => ['method' => 'onboarding'],
        ]);

        $this->assertNotNull($audit->id);

        // 8. Test Relationships
        $this->assertEquals($device->id, $device->emergencyCredential->device_id);
        $this->assertEquals(1, $device->deviceTokens->count());
        $this->assertEquals(1, $device->locations->count());
        $this->assertEquals(1, $device->commands->count());
        $this->assertEquals(1, $device->emergencySessions->count());
        $this->assertEquals(1, $device->auditLogs->count());

        // 9. Test Cascading Deletes
        $deviceId = $device->id;
        $device->delete();

        $this->assertDatabaseMissing('devices', ['id' => $deviceId]);
        $this->assertDatabaseMissing('emergency_credentials', ['device_id' => $deviceId]);
        $this->assertDatabaseMissing('device_tokens', ['device_id' => $deviceId]);
        $this->assertDatabaseMissing('locations', ['device_id' => $deviceId]);
        $this->assertDatabaseMissing('device_commands', ['device_id' => $deviceId]);
        $this->assertDatabaseMissing('emergency_sessions', ['device_id' => $deviceId]);

        // Audit log must NOT be deleted, but device_id must be set to null
        $this->assertDatabaseHas('audit_logs', [
            'id' => $audit->id,
            'device_id' => null,
            'event_type' => 'ENROLL',
        ]);
    }
}
