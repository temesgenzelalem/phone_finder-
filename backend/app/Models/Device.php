<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Device extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'phone_tag',
        'device_name',
        'device_instance_id',
        'fcm_token',
        'battery_level',
        'is_battery_charging',
        'is_protection_active',
        'last_seen_at',
    ];

    protected $casts = [
        'is_battery_charging' => 'boolean',
        'is_protection_active' => 'boolean',
        'battery_level' => 'integer',
        'last_seen_at' => 'datetime',
    ];

    public function emergencyCredential(): HasOne
    {
        return $this->hasOne(EmergencyCredential::class);
    }

    public function deviceTokens(): HasMany
    {
        return $this->hasMany(DeviceToken::class);
    }

    public function locations(): HasMany
    {
        return $this->hasMany(Location::class);
    }

    public function latestLocation(): HasOne
    {
        return $this->hasOne(Location::class)->latestOfMany('recorded_at');
    }

    public function commands(): HasMany
    {
        return $this->hasMany(DeviceCommand::class);
    }

    public function emergencySessions(): HasMany
    {
        return $this->hasMany(EmergencySession::class);
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
    }
}
