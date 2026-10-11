<?php

namespace Tests\Feature;

use App\Jobs\DispatchDeviceCommandJob;
use App\Models\AuditLog;
use App\Models\Device;
use App\Models\DeviceCommand;
use App\Models\DeviceToken;
use App\Models\EmergencyCredential;
use App\Models\EmergencySession;
use App\Models\Location;
use App\Services\SecurityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Tests\TestCase;

class EndToEndLifecycleAndResearchHypothesesTest extends TestCase
{
    use RefreshDatabase;

    private SecurityService $securityService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->securityService = app(SecurityService::class);
    }

    /**
     * E2E Integration: Complete device and emergency recovery lifecycle.
     */
    public function test_full_end_to_end_recovery_lifecycle(): void
    {
        // 1. Generate high-entropy recovery key
        $recoveryKey = 'PF-7K9A-B2M4-X8Q1';

        // 2. Enroll Device via /api/v1/device/enroll
        $instanceId = (string) Str::uuid();
        $enrollResponse = $this->postJson('/api/v1/device/enroll', [
            'device_name' => 'Samsung Galaxy S21 5G',
            'device_instance_id' => $instanceId,
            'recovery_key' => $recoveryKey,
            'fcm_token' => 'fcm_mock_push_token_for_device_e2e_test',
        ]);

        $enrollResponse->assertStatus(201)
            ->assertJsonPath('status', 'success');

        $phoneTag = $enrollResponse->json('data.phone_tag');
        $deviceToken = $enrollResponse->json('data.device_token');
        $this->assertNotEmpty($phoneTag);
        $this->assertNotEmpty($deviceToken);

        // 3. Upload Telemetry from Android Device
        $telemetryResponse = $this->withHeader('Authorization', "Bearer {$deviceToken}")
            ->postJson('/api/v1/device/telemetry', [
                'latitude' => 37.774929,
                'longitude' => -122.419416,
                'accuracy_meters' => 8.4,
                'battery_level' => 82,
                'is_battery_charging' => false,
                'trigger_type' => 'HEARTBEAT',
                'recorded_at' => now()->toIso8601String(),
            ]);

        $telemetryResponse->assertStatus(200)
            ->assertJsonPath('status', 'success');

        // Verify Location stored
        $this->assertDatabaseHas('locations', [
            'latitude' => 37.774929,
            'longitude' => -122.419416,
        ]);

        // 4. Emergency Mode Login using Recovery Key from browser
        $loginResponse = $this->postJson('/api/v1/emergency/login', [
            'phone_tag' => $phoneTag,
            'recovery_key' => $recoveryKey,
        ]);

        $loginResponse->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $emergencyToken = $loginResponse->json('emergency_token');
        $this->assertNotEmpty($emergencyToken);

        // 5. Query Emergency Console Status
        $statusResponse = $this->withHeader('Authorization', "Bearer {$emergencyToken}")
            ->getJson('/api/v1/emergency/status');

        $statusResponse->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('device.phone_tag', $phoneTag)
            ->assertJsonPath('device.battery_level', 82)
            ->assertJsonPath('latest_location.latitude', 37.774929);

        // 6. Dispatch Siren Command from Emergency Console
        $commandResponse = $this->withHeader('Authorization', "Bearer {$emergencyToken}")
            ->postJson('/api/v1/emergency/command', [
                'command_type' => 'ring',
            ]);

        $commandResponse->assertStatus(202)
            ->assertJsonPath('status', 'accepted')
            ->assertJsonPath('command.command_type', 'ring')
            ->assertJsonPath('command.status', 'PENDING');

        $commandId = $commandResponse->json('command.id');

        // 7. Process Queued Dispatch Job
        $command = DeviceCommand::findOrFail($commandId);
        $job = new DispatchDeviceCommandJob($command);
        $job->handle(app(\App\Services\FcmService::class));

        // When FCM accepts push, command transitions to DISPATCHED
        $command->refresh();
        $this->assertTrue(in_array($command->status, ['PENDING', 'DISPATCHED']));

        // 8. Device Acknowledges and Executes Command via /api/v1/device/commands/ack
        $ackResponse = $this->withHeader('Authorization', "Bearer {$deviceToken}")
            ->postJson('/api/v1/device/commands/ack', [
                'command_id' => $commandId,
                'status' => 'EXECUTED',
                'executed_at' => now()->toIso8601String(),
            ]);

        $ackResponse->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $command->refresh();
        $this->assertEquals('EXECUTED', $command->status);
        $this->assertNotNull($command->executed_at);

        // 9. Verify Immutable Audit Logs
        $auditLogsResponse = $this->withHeader('Authorization', "Bearer {$deviceToken}")
            ->getJson('/api/v1/device/audit-logs');

        $auditLogsResponse->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $eventTypes = collect($auditLogsResponse->json('data'))->pluck('event_type');
        $this->assertTrue($eventTypes->contains('ENROLL'));
        $this->assertTrue($eventTypes->contains('AUTH_SUCCESS'));
        $this->assertTrue($eventTypes->contains('CMD_DISPATCH'));
        $this->assertTrue($eventTypes->contains('CMD_ACK'));

        // 10. Terminate Emergency Session
        $logoutResponse = $this->withHeader('Authorization', "Bearer {$emergencyToken}")
            ->postJson('/api/v1/emergency/logout');

        $logoutResponse->assertStatus(200);

        // Subsequent call with revoked emergency token must be rejected
        $revokedAccess = $this->withHeader('Authorization', "Bearer {$emergencyToken}")
            ->getJson('/api/v1/emergency/status');
        $revokedAccess->assertStatus(401);

        // 11. Revoke Device Enrollment
        $revokeResponse = $this->withHeader('Authorization', "Bearer {$deviceToken}")
            ->postJson('/api/v1/device/revoke');

        $revokeResponse->assertStatus(200);

        // Assert device and credentials cascade deleted
        $this->assertDatabaseMissing('devices', ['phone_tag' => $phoneTag]);
    }

    /**
     * Research Hypothesis H1: Telemetry ingestion performance & battery-low behavior.
     * Evaluates that telemetry processing has minimal overhead and safely handles low-battery broadcasts.
     */
    public function test_hypothesis_h1_telemetry_low_overhead_and_battery_states(): void
    {
        $device = Device::create([
            'phone_tag' => 'PF-7K9A-B2M4-X8',
            'device_name' => 'Pixel 7a',
            'device_instance_id' => (string) Str::uuid(),
            'is_protection_active' => true,
        ]);

        $tokenStr = 'e2e_h1_token_' . bin2hex(random_bytes(16));
        DeviceToken::create([
            'device_id' => $device->id,
            'token_hash' => hash('sha256', $tokenStr),
            'name' => 'primary_app',
            'expires_at' => now()->addYear(),
        ]);

        // Measure batch ingestion latency
        $iterations = 5;
        $totalTimeMs = 0;

        for ($i = 0; $i < $iterations; $i++) {
            $isLowBattery = ($i === $iterations - 1);
            $trigger = $isLowBattery ? 'LOW_BATTERY' : 'HEARTBEAT';
            $batteryLevel = $isLowBattery ? 4 : 70 - ($i * 5);

            $start = microtime(true);
            $response = $this->withHeader('Authorization', "Bearer {$tokenStr}")
                ->postJson('/api/v1/device/telemetry', [
                    'latitude' => 37.7749 + ($i * 0.001),
                    'longitude' => -122.4194 + ($i * 0.001),
                    'accuracy_meters' => 10.0,
                    'battery_level' => $batteryLevel,
                    'is_battery_charging' => false,
                    'trigger_type' => $trigger,
                    'recorded_at' => now()->toIso8601String(),
                ]);
            $elapsedMs = (microtime(true) - $start) * 1000;
            $totalTimeMs += $elapsedMs;

            $response->assertStatus(200);
        }

        $avgLatencyMs = $totalTimeMs / $iterations;
        // Verify low overhead (average response under 200ms)
        $this->assertLessThan(200, $avgLatencyMs, "Average telemetry ingestion took {$avgLatencyMs}ms");

        // Verify device state was updated to low battery
        $device->refresh();
        $this->assertEquals(4, $device->battery_level);
    }

    /**
     * Research Hypothesis H2: Command lifecycle state transitions and idempotency.
     */
    public function test_hypothesis_h2_command_state_transitions_and_idempotency(): void
    {
        $device = Device::create([
            'phone_tag' => 'PF-7K9A-B2M4-X9',
            'device_name' => 'Pixel 7a',
            'device_instance_id' => (string) Str::uuid(),
            'is_protection_active' => true,
        ]);

        $tokenStr = 'e2e_h2_token_' . bin2hex(random_bytes(16));
        DeviceToken::create([
            'device_id' => $device->id,
            'token_hash' => hash('sha256', $tokenStr),
            'name' => 'primary_app',
            'expires_at' => now()->addYear(),
        ]);

        // Create command
        $command = DeviceCommand::create([
            'device_id' => $device->id,
            'command_type' => 'LOCK',
            'status' => 'PENDING',
            'expires_at' => Carbon::now()->addMinutes(5),
        ]);

        // Device acknowledges receipt (DELIVERED)
        $ackDelivered = $this->withHeader('Authorization', "Bearer {$tokenStr}")
            ->postJson('/api/v1/device/commands/ack', [
                'command_id' => $command->id,
                'status' => 'DELIVERED',
            ]);
        $ackDelivered->assertStatus(200);

        $command->refresh();
        $this->assertEquals('DELIVERED', $command->status);
        $this->assertNotNull($command->delivered_at);

        // Device acknowledges execution (EXECUTED)
        $ackExecuted = $this->withHeader('Authorization', "Bearer {$tokenStr}")
            ->postJson('/api/v1/device/commands/ack', [
                'command_id' => $command->id,
                'status' => 'EXECUTED',
                'executed_at' => now()->toIso8601String(),
            ]);
        $ackExecuted->assertStatus(200);

        $command->refresh();
        $this->assertEquals('EXECUTED', $command->status);
        $this->assertNotNull($command->executed_at);
    }

    /**
     * Research Hypothesis H3: Constant-time anti-enumeration verification.
     * Evaluates that nonexistent phone tags execute dummy Argon2id hash to prevent timing oracle attacks.
     */
    public function test_hypothesis_h3_constant_time_anti_enumeration(): void
    {
        $recoveryKey = 'PF-7K9A-B2M4-X8Q1';
        $realTag = 'PF-REAL-TEST-TAG';

        $device = Device::create([
            'phone_tag' => $realTag,
            'device_name' => 'Pixel 7a',
            'device_instance_id' => (string) Str::uuid(),
            'is_protection_active' => true,
        ]);

        EmergencyCredential::create([
            'device_id' => $device->id,
            'recovery_key_hash' => $this->securityService->hashRecoveryKey($recoveryKey),
            'failed_attempts' => 0,
        ]);

        // 1. Time verification with existing tag but wrong key
        $t1Start = microtime(true);
        $resWrongKey = $this->postJson('/api/v1/emergency/login', [
            'phone_tag' => $realTag,
            'recovery_key' => 'PF-WRONG-KEY-1234',
        ]);
        $t1Duration = (microtime(true) - $t1Start) * 1000;
        $resWrongKey->assertStatus(401);

        // 2. Time verification with completely NONEXISTENT tag
        $t2Start = microtime(true);
        $resNonexistentTag = $this->postJson('/api/v1/emergency/login', [
            'phone_tag' => 'PF-FAKE-NONEXIST',
            'recovery_key' => 'PF-WRONG-KEY-1234',
        ]);
        $t2Duration = (microtime(true) - $t2Start) * 1000;
        $resNonexistentTag->assertStatus(401);

        // Both responses must be identical generic error to prevent enumeration
        $this->assertEquals($resWrongKey->json('message'), $resNonexistentTag->json('message'));

        // Both must execute Argon2id derivation: verify both took non-trivial time (> 5ms)
        $this->assertGreaterThan(5, $t1Duration, "Argon2id calculation took {$t1Duration}ms");
        $this->assertGreaterThan(5, $t2Duration, "Dummy Argon2id calculation took {$t2Duration}ms");
    }
}
