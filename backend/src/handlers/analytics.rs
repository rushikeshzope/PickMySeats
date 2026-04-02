use axum::{
    extract::{Path, State},
    response::sse::{Event as SseEvent, KeepAlive, Sse},
};
use futures::stream::{self, Stream};
use serde::Serialize;
use std::convert::Infallible;
use std::time::Duration;
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Serialize)]
pub struct SalesData {
    pub event_id: Uuid,
    pub event_title: String,
    pub tickets_sold: i32,
    pub max_tickets: i32,
    pub revenue: String,
    pub recent_sales: Vec<RecentSale>,
}

#[derive(Debug, Serialize)]
pub struct RecentSale {
    pub ticket_id: Uuid,
    pub buyer_name: String,
    pub purchased_at: String,
}

/// GET /api/analytics/sales/:event_id — SSE stream of live sales data
pub async fn sales_stream(
    State(state): State<AppState>,
    Path(event_id): Path<Uuid>,
) -> Sse<impl Stream<Item = Result<SseEvent, Infallible>>> {
    let stream = stream::unfold(
        (state, event_id),
        |(state, event_id)| async move {
            tokio::time::sleep(Duration::from_secs(2)).await;

            // Fetch current sales data
            let sales_data = fetch_sales_data(&state, event_id).await;

            let event = match sales_data {
                Ok(data) => {
                    let json = serde_json::to_string(&data).unwrap_or_default();
                    SseEvent::default().data(json)
                }
                Err(_) => SseEvent::default().data("{\"error\": \"Failed to fetch sales data\"}"),
            };

            Some((Ok(event), (state, event_id)))
        },
    );

    Sse::new(stream).keep_alive(KeepAlive::default())
}

async fn fetch_sales_data(
    state: &AppState,
    event_id: Uuid,
) -> Result<SalesData, sqlx::Error> {
    // Fetch event info
    let event = sqlx::query_as::<_, (Uuid, String, i32, i32)>(
        "SELECT id, title, tickets_sold, max_tickets FROM events WHERE id = $1"
    )
    .bind(event_id)
    .fetch_one(&state.db)
    .await?;

    // Calculate revenue
    let revenue = sqlx::query_scalar::<_, rust_decimal::Decimal>(
        "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE event_id = $1 AND status = 'confirmed'"
    )
    .bind(event_id)
    .fetch_one(&state.db)
    .await?;

    // Fetch recent sales (last 10)
    let recent = sqlx::query_as::<_, (Uuid, String, String)>(
        r#"SELECT t.id, u.full_name, t.created_at::text
           FROM tickets t
           JOIN users u ON t.user_id = u.id
           WHERE t.event_id = $1
           ORDER BY t.created_at DESC
           LIMIT 10"#
    )
    .bind(event_id)
    .fetch_all(&state.db)
    .await?;

    let recent_sales: Vec<RecentSale> = recent
        .into_iter()
        .map(|(ticket_id, buyer_name, purchased_at)| RecentSale {
            ticket_id,
            buyer_name,
            purchased_at,
        })
        .collect();

    Ok(SalesData {
        event_id: event.0,
        event_title: event.1,
        tickets_sold: event.2,
        max_tickets: event.3,
        revenue: revenue.to_string(),
        recent_sales,
    })
}
