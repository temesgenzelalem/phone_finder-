<?php

namespace Tests\Feature;

use App\Jobs\DispatchDeviceCommandJob;
use App\Models\Device;
use App\Models\DeviceCommand;
use App\Services\FcmService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

class FcmCommandDispatchTest extends TestCase
{
    use RefreshDatabase;

    private const SAMPLE_RECOVERY_KEY = 'PF-K7W2-9M4X-3Q8J';

    public function test_job_dispatches_command_and_updates_status(): void
    {
        $device = Device::create([
            'phone_tag' => 'PF-TEST-DISP',
            'device_name' => 'FCM Test Device',
            'device_instance_id' => Str::uuid()->toString(),
            'fcm_token' => 'fcm_sample_device_push_token_999',
            'is_protection_active' => true,
        ]);

        $command = DeviceCommand::create([
            'device_id' => $device->id,
            'command_type' => 'RING',
            'status' => 'PENDING',
            'payload' => ['duration_seconds' => 120],
            'expires_at' => now()->addMinutes(5),
        ]);

        $fcmService = new FcmService;
        $job = new DispatchDeviceCommandJob($command);
        $job->handle($fcmService);

        $command->refresh();
        $this->assertEquals('DISPATCHED', $command->status);
        $this->assertNotNull($command->dispatched_at);

        $this->assertDatabaseHas('audit_logs', [
            'device_id' => $device->id,
            'event_type' => 'CMD_DISPATCHED',
        ]);
    }

    public function test_job_marks_expired_if_ttl_elapsed(): void
    {
        $device = Device::create([
            'phone_tag' => 'PF-TEST-EXPR',
            'device_name' => 'Expired Test Device',
            'device_instance_id' => Str::uuid()->toString(),
            'fcm_token' => 'fcm_token_123',
            'is_protection_active' => true,
        ]);

        $command = DeviceCommand::create([
            'device_id' => $device->id,
            'command_type' => 'LOCK',
            'status' => 'PENDING',
            'expires_at' => now()->subMinute(), // Expired
        ]);

        $fcmService = new FcmService;
        $job = new DispatchDeviceCommandJob($command);
        $job->handle($fcmService);

        $command->refresh();
        $this->assertEquals('EXPIRED', $command->status);
    }

    public function test_job_fails_if_device_has_no_fcm_token(): void
    {
        $device = Device::create([
            'phone_tag' => 'PF-TEST-NOTOK',
            'device_name' => 'No Token Device',
            'device_instance_id' => Str::uuid()->toString(),
            'fcm_token' => null, // No push token
            'is_protection_active' => true,
        ]);

        $command = DeviceCommand::create([
            'device_id' => $device->id,
            'command_type' => 'LOCATE',
            'status' => 'PENDING',
            'expires_at' => now()->addMinutes(5),
        ]);

        $fcmService = new FcmService;
        $job = new DispatchDeviceCommandJob($command);
        $job->handle($fcmService);

        $command->refresh();
        $this->assertEquals('FAILED', $command->status);
        $this->assertStringContainsString('FCM push token', $command->error_message);
    }

    public function test_emergency_command_creation_enqueues_dispatch_job(): void
    {
        Queue::fake();

        $enrollResponse = $this->postJson('/api/v1/device/enroll', [
            'device_name' => 'Queue Test Phone',
            'device_instance_id' => Str::uuid()->toString(),
            'recovery_key' => self::SAMPLE_RECOVERY_KEY,
            'fcm_token' => 'fcm_target_push_token_456',
        ]);

        $phoneTag = $enrollResponse->json('data.phone_tag');

        $loginResponse = $this->postJson('/api/v1/emergency/login', [
            'phone_tag' => $phoneTag,
            'recovery_key' => self::SAMPLE_RECOVERY_KEY,
        ]);

        $emergencyToken = $loginResponse->json('data.emergency_token');

        $cmdResponse = $this->withHeader('Authorization', 'Bearer '.$emergencyToken)
            ->postJson('/api/v1/emergency/commands/ring', [
                'duration_seconds' => 60,
            ]);

        $cmdResponse->assertStatus(202);
        $commandId = $cmdResponse->json('data.command_id');

        Queue::assertPushed(DispatchDeviceCommandJob::class, function ($job) use ($commandId) {
            return $job->command->id === $commandId;
        });
    }
}
