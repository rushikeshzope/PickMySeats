use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Venue {
    pub id: Uuid,
    pub name: String,
    pub address: Option<String>,
    pub total_capacity: i32,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVenue {
    pub name: String,
    pub address: Option<String>,
    pub total_capacity: i32,
    pub sections: Option<Vec<SectionInput>>,
}

#[derive(Debug, Deserialize)]
pub struct SectionInput {
    pub name: String,
    pub rows: i32,
    pub seats_per_row: i32,
    pub seat_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Seat {
    pub id: Uuid,
    pub venue_id: Uuid,
    pub section: String,
    pub row_label: String,
    pub seat_number: i32,
    pub seat_type: String,
}
