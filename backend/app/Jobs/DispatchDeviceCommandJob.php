<?php

namespace App\Jobs;

use App\Models\AuditLog;
use App\Models\DeviceCommand;
use App\Services\FcmService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class DispatchDeviceCommandJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public array $backoff = [5, 15];

    public function __construct(
        public DeviceCommand $command
    ) {}

    /**
     * Execute the job.
     */
    public function handle(FcmService $fcmService): void
    {
        $command = $this->command->fresh(['device']);

        if (! $command || $command->status !== 'PENDING') {
            return;
        }

        // 1. Check if command expired before dispatch
        if ($command->expires_at->isPast()) {
            $command->update(['status' => 'EXPIRED']);

            return;
        }

        // 2. Check if device has an FCM token
        if (! $command->device || empty($command->device->fcm_token)) {
            $command->update([
                'status' => 'FAILED',
                'error_message' => 'Device does not have a registered FCM push token.',
            ]);

            return;
        }

        // 3. Dispatch via FCM v1
        $result = $fcmService->sendDeviceCommand($command);

        if ($result['success']) {
            $command->update([
                'status' => 'DISPATCHED',
                'dispatched_at' => now(),
            ]);

            AuditLog::create([
                'device_id' => $command->device_id,
                'event_type' => 'CMD_DISPATCHED',
                'ip_address' => '127.0.0.1',
                'details' => [
                    'command_id' => $command->id,
                    'command_type' => $command->command_type,
                    'simulated' => $result['simulated'] ?? false,
                    'message_name' => $result['name'] ?? null,
                ],
            ]);
        } else {
            if ($this->attempts() >= $this->tries) {
                $command->update([
                    'status' => 'FAILED',
                    'error_message' => $result['error'] ?? 'FCM dispatch failed after retries.',
                ]);
            } else {
                $this->release(10);
            }
        }
    }
}
