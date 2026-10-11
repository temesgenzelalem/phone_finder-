<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('devices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('phone_tag', 16)->unique();
            $table->string('device_name', 100);
            $table->uuid('device_instance_id')->unique();
            $table->text('fcm_token')->nullable();
            $table->unsignedSmallInteger('battery_level')->nullable();
            $table->boolean('is_battery_charging')->default(false);
            $table->boolean('is_protection_active')->default(true);
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->index('phone_tag');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('devices');
    }
};
