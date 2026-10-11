<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Rate limiter for emergency recovery portal login
        RateLimiter::for('emergency-login', function (Request $request) {
            return Limit::perMinute(15)->by($request->ip());
        });

        // Rate limiter for physical device enrollment
        RateLimiter::for('device-enroll', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        // Rate limiter for emergency remote commands
        RateLimiter::for('emergency-commands', function (Request $request) {
            return Limit::perMinute(10)->by($request->header('Authorization') ?: $request->ip());
        });
    }
}
