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
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->uuid('device_id');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('accuracy_meters', 6, 2);
            $table->decimal('altitude', 7, 2)->nullable();
            $table->unsignedSmallInteger('battery_level')->nullable();
            $table->string('trigger_type', 20); // 'HEARTBEAT', 'ON_DEMAND', 'LOW_BATTERY'
            $table->timestamp('recorded_at');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('device_id')
                ->references('id')
                ->on('devices')
                ->onDelete('cascade');

            $table->index(['device_id', 'recorded_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('locations');
    }
};
