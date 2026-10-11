FROM php:8.3-fpm-alpine

# Set working directory
WORKDIR /var/www/html

# Install system dependencies (Nginx, Supervisor, bash, curl)
RUN apk add --no-cache \
    nginx \
    supervisor \
    bash \
    curl

# Use the official Docker PHP extension installer for guaranteed compatibility on Alpine
ADD --chmod=0755 https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/

# Install PHP extensions required by Laravel 13, Neon PostgreSQL, and Argon2id
RUN install-php-extensions \
    pdo_pgsql \
    pgsql \
    sodium \
    bcmath \
    zip \
    opcache \
    pcntl

# Install Composer
COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

# Copy application files
COPY . /var/www/html

# Copy Docker configurations
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/php.ini $PHP_INI_DIR/conf.d/99-app.ini
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# Ensure executable permissions on entrypoint
RUN chmod +x /usr/local/bin/entrypoint.sh

# Install production dependencies
ENV COMPOSER_ALLOW_SUPERUSER=1
RUN composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction --no-progress

# Set permissions for www-data
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache \
    && chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Render injects $PORT dynamically, default fallback to 8080
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
