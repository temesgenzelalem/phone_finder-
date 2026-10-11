<?php

namespace App\Services;

use App\Models\DeviceCommand;
use Exception;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FcmService
{
    protected string $credentialsPath;
    protected ?string $projectId;

    public function __construct()
    {
        $this->credentialsPath = config('services.fcm.credentials_path', storage_path('app/firebase-service-account.json'));
        $this->projectId = config('services.fcm.project_id');
    }

    /**
     * Send a device command as a high-priority FCM v1 data push message.
     *
     * @return array{success: bool, simulated?: bool, name?: string, error?: string}
     */
    public function sendDeviceCommand(DeviceCommand $command): array
    {
        $device = $command->device;

        if (! $device || empty($device->fcm_token)) {
            return [
                'success' => false,
                'error' => 'Device does not have a registered FCM push token.',
            ];
        }

        // 1. Simulation / Local Mock Mode if credentials are not configured
        if (! file_exists($this->credentialsPath) || env('FCM_SIMULATION_MODE', false)) {
            Log::info("FCM [Simulation]: Dispatching high-priority command {$command->command_type} to device {$device->phone_tag}", [
                'command_id' => $command->id,
                'fcm_token_snippet' => substr($device->fcm_token, 0, 15).'...',
            ]);

            return [
                'success' => true,
                'simulated' => true,
                'name' => 'projects/simulated/messages/sim_'.uniqid(),
            ];
        }

        // 2. Production FCM v1 HTTP Dispatch
        try {
            $serviceAccount = json_decode(file_get_contents($this->credentialsPath), true);
            $projectId = $this->projectId ?: ($serviceAccount['project_id'] ?? null);

            if (! $projectId) {
                throw new Exception('Firebase project_id not configured.');
            }

            $accessToken = $this->getOAuth2AccessToken($serviceAccount);

            // Construct strictly high-priority DATA payload (No notification block!)
            $fcmPayload = [
                'message' => [
                    'token' => $device->fcm_token,
                    'data' => [
                        'command_id' => (string) $command->id,
                        'command_type' => (string) $command->command_type,
                        'expires_at' => (string) $command->expires_at->toIso8601String(),
                        'payload' => json_encode($command->payload ?? []),
                    ],
                    'android' => [
                        'priority' => 'high',
                        'ttl' => '300s',
                    ],
                ],
            ];

            $response = Http::withToken($accessToken)
                ->timeout(10)
                ->post("https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send", $fcmPayload);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'name' => $response->json('name'),
                ];
            }

            Log::error('FCM HTTP v1 Error', [
                'status' => $response->status(),
                'body' => $response->json(),
            ]);

            return [
                'success' => false,
                'error' => $response->json('error.message', 'FCM API rejected dispatch request.'),
            ];
        } catch (Exception $e) {
            Log::error('FCM Service Exception: '.$e->getMessage());

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Generate or retrieve cached OAuth2 access token for FCM HTTP v1.
     */
    protected function getOAuth2AccessToken(array $serviceAccount): string
    {
        return Cache::remember('fcm_v1_access_token', 3300, function () use ($serviceAccount) {
            $now = time();
            $clientEmail = $serviceAccount['client_email'] ?? '';
            $privateKey = $serviceAccount['private_key'] ?? '';

            $header = $this->base64UrlEncode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
            $claimSet = $this->base64UrlEncode(json_encode([
                'iss' => $clientEmail,
                'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
                'aud' => 'https://oauth2.googleapis.com/token',
                'exp' => $now + 3600,
                'iat' => $now,
            ]));

            $unsignedToken = "{$header}.{$claimSet}";
            $signature = '';

            if (! openssl_sign($unsignedToken, $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
                throw new Exception('Failed to sign Google OAuth2 JWT assertion.');
            }

            $signedJwt = "{$unsignedToken}.".$this->base64UrlEncode($signature);

            $response = Http::asForm()->post('https://oauth2.googleapis.com/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $signedJwt,
            ]);

            if (! $response->successful()) {
                throw new Exception('Failed to exchange Google OAuth2 token: '.$response->body());
            }

            return $response->json('access_token');
        });
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
