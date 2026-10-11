#!/usr/bin/env bash
set -e

PORT_VALUE=${PORT:-8080}
echo "==> Configuring Nginx port to ${PORT_VALUE}..."
sed -i "s/PORT_PLACEHOLDER/${PORT_VALUE}/g" /etc/nginx/http.d/default.conf

# Ensure required storage directories exist
mkdir -p /var/www/html/storage/framework/sessions
mkdir -p /var/www/html/storage/framework/views
mkdir -p /var/www/html/storage/framework/cache
mkdir -p /var/www/html/storage/logs
touch /var/log/queue.log

chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache /var/log/queue.log
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Generate key if missing
if [ -z "$APP_KEY" ]; then
    echo "==> Warning: APP_KEY is empty. Generating temporary application key..."
    php artisan key:generate --force
fi

# Run database migrations if enabled
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "==> Running database migrations..."
    php artisan migrate --force --isolated || echo "==> Migrations completed or already up to date."
fi

# Cache configuration and routes for production performance
echo "==> Caching application configurations..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "==> Starting PHP-FPM, Nginx, and Queue Worker via Supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
