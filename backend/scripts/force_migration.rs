use sqlx::postgres::PgPoolOptions;
use dotenvy::dotenv;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    println!("Attempting to add 'order_status' column to 'orders' table...");

    sqlx::query(
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status TEXT NOT NULL DEFAULT 'paid' 
         CHECK (order_status IN ('pending_payment', 'paid', 'failed'))"
    )
    .execute(&pool)
    .await?;

    println!("Database column 'order_status' added successfully!");

    Ok(())
}
