<?php

namespace App\Http\Middleware;

use App\Models\EmergencySession;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyEmergencyToken
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

        $session = EmergencySession::with('device')
            ->where('token_hash', $tokenHash)
            ->first();

        if (! $session) {
            return response()->json([
                'status' => 'error',
                'code' => 'INVALID_SESSION',
                'message' => 'Invalid or unrecognized emergency session token.',
            ], 401);
        }

        if ($session->revoked_at !== null) {
            return response()->json([
                'status' => 'error',
                'code' => 'SESSION_REVOKED',
                'message' => 'Emergency session has been terminated.',
            ], 401);
        }

        if ($session->expires_at->isPast()) {
            return response()->json([
                'status' => 'error',
                'code' => 'SESSION_EXPIRED',
                'message' => 'Emergency session has expired. Please re-authenticate.',
            ], 401);
        }

        if (! $session->device) {
            return response()->json([
                'status' => 'error',
                'code' => 'DEVICE_NOT_FOUND',
                'message' => 'Associated device record not found.',
            ], 404);
        }

        // Attach device and emergency session to request attributes
        $request->attributes->set('device', $session->device);
        $request->attributes->set('emergency_session', $session);

        return $next($request);
    }
}
