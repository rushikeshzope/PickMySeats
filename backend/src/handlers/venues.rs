use axum::{
    extract::{Path, State},
    Extension, Json,
};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::venue::{CreateVenue, Seat, Venue};
use crate::utils::jwt::Claims;
use crate::AppState;

/// GET /api/venues — list all venues
pub async fn list_venues(
    State(state): State<AppState>,
) -> Result<Json<Vec<Venue>>, AppError> {
    let venues = sqlx::query_as::<_, Venue>(
        "SELECT * FROM venues ORDER BY name ASC"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(venues))
}

/// GET /api/venues/:id/seats — list seats for a venue
pub async fn get_venue_seats(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Seat>>, AppError> {
    let seats = sqlx::query_as::<_, Seat>(
        "SELECT * FROM seats WHERE venue_id = $1 ORDER BY section, row_label, seat_number"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(seats))
}

/// POST /api/venues — create venue with seats
pub async fn create_venue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<CreateVenue>,
) -> Result<Json<Venue>, AppError> {
    if input.name.is_empty() {
        return Err(AppError::BadRequest("Venue name is required".to_string()));
    }

    // Insert venue
    let venue = sqlx::query_as::<_, Venue>(
        "INSERT INTO venues (name, address, total_capacity, created_by) VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(&input.name)
    .bind(&input.address)
    .bind(input.total_capacity)
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;

    // Generate seats from sections if provided
    if let Some(sections) = &input.sections {
        for section in sections {
            let seat_type = section.seat_type.as_deref().unwrap_or("standard");
            for row in 0..section.rows {
                let row_label = (b'A' + row as u8) as char;
                for seat_num in 1..=section.seats_per_row {
                    sqlx::query(
                        "INSERT INTO seats (venue_id, section, row_label, seat_number, seat_type)
                         VALUES ($1, $2, $3, $4, $5)"
                    )
                    .bind(venue.id)
                    .bind(&section.name)
                    .bind(row_label.to_string())
                    .bind(seat_num)
                    .bind(seat_type)
                    .execute(&state.db)
                    .await?;
                }
            }
        }
    }

    Ok(Json(venue))
}
