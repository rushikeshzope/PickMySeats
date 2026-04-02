use axum::{extract::State, Extension, Json};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

use crate::error::AppError;
use crate::models::user::{AuthResponse, CreateUser, LoginUser, UserPublic};
use crate::utils::jwt::{self, Claims};
use crate::AppState;

/// POST /api/auth/register
pub async fn register(
    State(state): State<AppState>,
    Json(input): Json<CreateUser>,
) -> Result<Json<AuthResponse>, AppError> {
    if input.email.is_empty() || input.password.is_empty() || input.full_name.is_empty() {
        return Err(AppError::BadRequest("All fields are required".to_string()));
    }
    if input.password.len() < 6 {
        return Err(AppError::BadRequest("Password must be at least 6 characters".to_string()));
    }

    let role = input.role.as_deref()
        .unwrap_or("attendee")
        .to_lowercase();

    if role != "attendee" && role != "organizer" && role != "admin" {
        return Err(AppError::BadRequest("Role must be 'attendee' or 'organizer'".to_string()));
    }

    let existing = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE email = $1")
        .bind(&input.email)
        .fetch_one(&state.db)
        .await?;

    if existing > 0 {
        return Err(AppError::Conflict("Email already registered".to_string()));
    }

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(input.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("Password hashing failed: {}", e)))?
        .to_string();

    let user = sqlx::query_as::<_, crate::models::user::User>(
        "INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(&input.email)
    .bind(&password_hash)
    .bind(&input.full_name)
    .bind(&role)
    .fetch_one(&state.db)
    .await?;

    let token = jwt::create_token(user.id, &user.email, &user.role, &state.config.jwt_secret)
        .map_err(|e| AppError::Internal(format!("Token generation failed: {}", e)))?;

    // Link any pending ticket transfers sent to this email before account creation
    let pending_ticket_ids: Vec<uuid::Uuid> = sqlx::query_scalar(
        "SELECT ticket_id FROM pending_ticket_transfers WHERE recipient_email = $1"
    )
    .bind(&input.email.to_lowercase())
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    if !pending_ticket_ids.is_empty() {
        for ticket_id in &pending_ticket_ids {
            let _ = sqlx::query(
                "UPDATE tickets SET user_id = $1 WHERE id = $2 AND transfer_status = 'transferred'"
            )
            .bind(user.id)
            .bind(ticket_id)
            .execute(&state.db)
            .await;
        }
        let _ = sqlx::query(
            "DELETE FROM pending_ticket_transfers WHERE recipient_email = $1"
        )
        .bind(&input.email.to_lowercase())
        .execute(&state.db)
        .await;
    }

    Ok(Json(AuthResponse {
        token,
        user: UserPublic::from(user),
    }))
}

/// POST /api/auth/login
pub async fn login(
    State(state): State<AppState>,
    Json(input): Json<LoginUser>,
) -> Result<Json<AuthResponse>, AppError> {
    let user = sqlx::query_as::<_, crate::models::user::User>(
        "SELECT * FROM users WHERE email = $1"
    )
    .bind(&input.email)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Unauthorized("Invalid email or password".to_string()))?;

    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|e| AppError::Internal(format!("Hash parse error: {}", e)))?;
    Argon2::default()
        .verify_password(input.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::Unauthorized("Invalid email or password".to_string()))?;

    let token = jwt::create_token(user.id, &user.email, &user.role, &state.config.jwt_secret)
        .map_err(|e| AppError::Internal(format!("Token generation failed: {}", e)))?;

    Ok(Json(AuthResponse {
        token,
        user: UserPublic::from(user),
    }))
}

/// GET /api/auth/me — return authenticated user profile
pub async fn me(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<UserPublic>, AppError> {
    let user = sqlx::query_as::<_, crate::models::user::User>(
        "SELECT * FROM users WHERE id = $1"
    )
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    Ok(Json(UserPublic::from(user)))
}
