use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use crate::AppState;

/// Redis-based sliding window rate limiter.
/// Limits to 10 requests per minute per user for purchase endpoints.
pub async fn rate_limit_middleware(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract user identifier from claims (set by auth middleware)
    let user_id = req
        .extensions()
        .get::<crate::utils::jwt::Claims>()
        .map(|c| c.sub.to_string())
        .unwrap_or_else(|| {
            // Fallback to IP-based rate limiting
            "anonymous".to_string()
        });

    let key = format!("rate_limit:{}", user_id);
    let max_requests: i64 = 10;
    let window_seconds: i64 = 60;

    // Try Redis rate limiting, fall through if Redis unavailable
    if let Some(ref redis_pool) = state.redis_pool {
        let mut conn = redis_pool.clone();
        let result: Result<i64, _> = redis::cmd("INCR")
            .arg(&key)
            .query_async(&mut conn)
            .await;

        match result {
            Ok(count) => {
                if count == 1 {
                    // First request — set expiry
                    let _: Result<(), _> = redis::cmd("EXPIRE")
                        .arg(&key)
                        .arg(window_seconds)
                        .query_async(&mut conn)
                        .await;
                }
                if count > max_requests {
                    tracing::warn!("Rate limit exceeded for user: {}", user_id);
                    return Err(StatusCode::TOO_MANY_REQUESTS);
                }
            }
            Err(e) => {
                tracing::warn!("Redis rate limit check failed: {}, allowing request", e);
            }
        }
    }

    Ok(next.run(req).await)
}
