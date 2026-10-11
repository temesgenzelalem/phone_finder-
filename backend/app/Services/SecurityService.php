<?php

namespace App\Services;

use App\Models\Device;

class SecurityService
{
    private const CROCKFORD_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

    /**
     * Generate a unique, readable Phone Tag in Crockford Base32 (e.g., PF-7B2A-9K4F).
     */
    public function generateUniquePhoneTag(): string
    {
        do {
            $part1 = $this->randomCrockfordString(4);
            $part2 = $this->randomCrockfordString(4);
            $tag = "PF-{$part1}-{$part2}";
        } while (Device::where('phone_tag', $tag)->exists());

        return $tag;
    }

    /**
     * Hash the recovery key using Argon2id.
     */
    public function hashRecoveryKey(string $key): string
    {
        return password_hash($key, PASSWORD_ARGON2ID, [
            'memory_cost' => 65536, // 64 MB
            'time_cost' => 3,
            'threads' => 1,
        ]);
    }

    /**
     * Verify a recovery key against an Argon2id hash.
     */
    public function verifyRecoveryKey(string $key, string $hash): bool
    {
        return password_verify($key, $hash);
    }

    /**
     * Perform a dummy Argon2id verification to equalize timing on non-existent Phone Tags.
     */
    public function runDummyVerification(string $key): void
    {
        // Standard precomputed dummy Argon2id hash for constant-time mitigation
        $dummyHash = '$argon2id$v=19$m=65536,t=3,p=1$ZHVtbXlzYWx0MTIzNDU2Nw$5b94lQ3mQ1gJ4X8p8i5M1L9O5K3N7R1P';
        password_verify($key, $dummyHash);
    }

    /**
     * Generate a cryptographically secure random bearer token.
     */
    public function generateBearerToken(string $prefix = 'sec'): string
    {
        return $prefix.'_'.bin2hex(random_bytes(24));
    }

    /**
     * Generate random Crockford Base32 characters.
     */
    private function randomCrockfordString(int $length): string
    {
        $alphabet = self::CROCKFORD_ALPHABET;
        $maxIndex = strlen($alphabet) - 1;
        $result = '';

        for ($i = 0; $i < $length; $i++) {
            $result .= $alphabet[random_int(0, $maxIndex)];
        }

        return $result;
    }
}
