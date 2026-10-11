<?php

namespace App\Http\Middleware;

use App\Models\DeviceToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyDeviceToken
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $authHeader = $request->header('Authorization');

        if (! $authHeader || ! str_starts_with($authHeader, 'Bearer ')) {
            return response()->json([
                'status' => 'error',
                'code' => 'UNAUTHORIZED',
                'message' => 'Missing or invalid Authorization header.',
            ], 401);
        }

        $plainToken = substr($authHeader, 7);
        $tokenHash = hash('sha256', $plainToken);

        $deviceToken = DeviceToken::with('device')
            ->where('token_hash', $tokenHash)
            ->first();

        if (! $deviceToken) {
            return response()->json([
                'status' => 'error',
                'code' => 'INVALID_TOKEN',
                'message' => 'Invalid or unrecognized device token.',
            ], 401);
        }

        if ($deviceToken->expires_at && $deviceToken->expires_at->isPast()) {
            return response()->json([
                'status' => 'error',
                'code' => 'TOKEN_EXPIRED',
                'message' => 'Device authentication token has expired.',
            ], 401);
        }

        if (! $deviceToken->device || ! $deviceToken->device->is_protection_active) {
            return response()->json([
                'status' => 'error',
                'code' => 'DEVICE_INACTIVE',
                'message' => 'Device enrollment is inactive or revoked.',
            ], 403);
        }

        // Update last used timestamp
        $deviceToken->update(['last_used_at' => now()]);

        // Attach device and token to request attributes
        $request->attributes->set('device', $deviceToken->device);
        $request->attributes->set('device_token', $deviceToken);

        return $next($request);
    }
}
