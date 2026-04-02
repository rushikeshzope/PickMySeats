mod config;
mod db;
mod error;
mod handlers;
mod middleware;
mod models;
mod routes;
mod utils;

use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tracing_subscriber::EnvFilter;

/// Shared application state accessible by all handlers via State extractor.
#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub config: config::Config,
    pub redis_pool: Option<redis::aio::ConnectionManager>,
}

#[tokio::main]
async fn main() {
    // Load .env file if present
    dotenvy::dotenv().ok();

    // Initialize tracing/logging
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    tracing::info!("🎫 Starting ScanTix API Server...");

    // Load configuration
    let config = config::Config::from_env();

    // Initialize database pool
    let pool = db::init_pool(&config.database_url).await;
    tracing::info!("✅ Database connected");

    // Run migrations
    db::run_migrations(&pool).await;
    tracing::info!("✅ Migrations applied");

    // Ensure uploads directory exists
    std::fs::create_dir_all("uploads").unwrap_or_default();
    tracing::info!("✅ Uploads directory ready");

    // Initialize Redis (optional — graceful fallback)
    let redis_pool = match redis::Client::open(config.redis_url.as_str()) {
        Ok(client) => match redis::aio::ConnectionManager::new(client).await {
            Ok(conn) => {
                tracing::info!("✅ Redis connected");
                Some(conn)
            }
            Err(e) => {
                tracing::warn!("⚠️  Redis connection failed (continuing without cache): {}", e);
                None
            }
        },
        Err(e) => {
            tracing::warn!("⚠️  Redis client creation failed: {}", e);
            None
        }
    };

    // Build application state
    let state = AppState {
        db: pool,
        config: config.clone(),
        redis_pool,
    };

    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Clone db pool for background task before state is consumed by the router
    let bg_db = state.db.clone();

    // Build router
    let app = routes::create_router(state)
        .nest_service("/uploads", ServeDir::new("uploads"))
        .layer(cors);

    // Start server
    let addr: SocketAddr = format!("{}:{}", config.server_host, config.server_port)
        .parse()
        .expect("Invalid server address");

    tracing::info!("🚀 ScanTix API listening on http://{}", addr);

    // Spawn background task: auto-expire seat locks every 30 seconds
    {
        let db = bg_db.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
            loop {
                interval.tick().await;
                match sqlx::query(
                    r#"UPDATE event_seats
                       SET status = 'available', locked_by = NULL, locked_until = NULL
                       WHERE status = 'locked' AND locked_until < NOW()"#,
                )
                .execute(&db)
                .await
                {
                    Ok(result) => {
                        let released = result.rows_affected();
                        if released > 0 {
                            tracing::info!("🔓 Released {} expired seat lock(s)", released);
                        }
                    }
                    Err(e) => {
                        tracing::error!("Failed to expire seat locks: {}", e);
                    }
                }
            }
        });
    }

    // Spawn background task: auto-expire ticket holds every 60 seconds
    {
        let db = bg_db;
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
            loop {
                interval.tick().await;
                match sqlx::query("DELETE FROM ticket_holds WHERE expires_at < NOW()")
                    .execute(&db)
                    .await
                {
                    Ok(result) => {
                        let deleted = result.rows_affected();
                        if deleted > 0 {
                            tracing::info!("🗑️ Cleaned up {} expired ticket hold(s)", deleted);
                        }
                    }
                    Err(e) => {
                        tracing::error!("Failed to clean up ticket holds: {}", e);
                    }
                }
            }
        });
    }

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => listener,
        Err(e) => {
            tracing::error!("Failed to bind to {}: {}", addr, e);
            tracing::error!("Another ScanTix backend instance may already be running on this port.");
            return;
        }
    };

    if let Err(e) = axum::serve(listener, app).await {
        tracing::error!("Server failed: {}", e);
    }
}
