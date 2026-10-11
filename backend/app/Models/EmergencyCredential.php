<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmergencyCredential extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'device_id',
        'recovery_key_hash',
        'failed_attempts',
        'locked_until',
    ];

    protected $hidden = [
        'recovery_key_hash',
    ];

    protected $casts = [
        'failed_attempts' => 'integer',
        'locked_until' => 'datetime',
    ];

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }
}
