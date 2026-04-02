use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// One row in event_seats, representing a single seat in the seat map.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EventSeat {
    pub id: Uuid,
    pub event_id: Uuid,
    pub row_label: String,
    pub seat_number: i32,
    pub status: String, // "available" | "locked" | "booked"
    pub locked_by: Option<Uuid>,
    pub locked_until: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Request body for locking a seat
#[derive(Debug, Deserialize)]
pub struct LockSeatRequest {
    // seat_id comes via path param, so nothing additional needed
}

/// Response after successfully acquiring a seat lock
#[derive(Debug, Serialize)]
pub struct LockSeatResponse {
    pub seat: EventSeat,
    pub locked_until: DateTime<Utc>,
}
