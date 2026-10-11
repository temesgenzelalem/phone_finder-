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
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->uuid('device_id')->nullable();
            $table->string('event_type', 50); // 'ENROLL', 'AUTH_SUCCESS', 'AUTH_FAIL', 'CMD_DISPATCH', 'CMD_ACK', 'REVOKE'
            $table->string('ip_address', 45);
            $table->json('details')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('device_id')
                ->references('id')
                ->on('devices')
                ->onDelete('set null');

            $table->index(['device_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
