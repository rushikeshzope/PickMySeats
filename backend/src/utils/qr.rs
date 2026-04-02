use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use hmac::{Hmac, Mac};
use image::Luma;
use qrcode::QrCode;
use sha2::Sha256;
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

/// Generate a signed QR payload for a ticket.
/// Format: "SCANTIX:ticket_id:event_id:user_id:signature"
pub fn generate_qr_payload(ticket_id: Uuid, event_id: Uuid, user_id: Uuid, secret: &str) -> String {
    let data = format!("{}:{}:{}", ticket_id, event_id, user_id);
    let signature = sign_data(&data, secret);
    format!("SCANTIX:{}:{}", data, signature)
}

/// Verify and parse a QR payload. Returns (ticket_id, event_id, user_id) if valid.
pub fn verify_qr_payload(payload: &str, secret: &str) -> Option<(Uuid, Uuid, Uuid)> {
    let parts: Vec<&str> = payload.split(':').collect();
    if parts.len() != 5 || parts[0] != "SCANTIX" {
        return None;
    }

    let ticket_id = Uuid::parse_str(parts[1]).ok()?;
    let event_id = Uuid::parse_str(parts[2]).ok()?;
    let user_id = Uuid::parse_str(parts[3]).ok()?;
    let signature = parts[4];

    let data = format!("{}:{}:{}", ticket_id, event_id, user_id);
    let expected_signature = sign_data(&data, secret);

    if signature == expected_signature {
        Some((ticket_id, event_id, user_id))
    } else {
        None
    }
}

/// Generate QR code as a base64-encoded PNG image.
pub fn generate_qr_image_base64(data: &str) -> Result<String, String> {
    let code = QrCode::new(data.as_bytes()).map_err(|e| format!("QR generation error: {}", e))?;
    let image = code.render::<Luma<u8>>().quiet_zone(true).min_dimensions(250, 250).build();

    let mut png_bytes: Vec<u8> = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
    image::ImageEncoder::write_image(
        encoder,
        image.as_raw(),
        image.width(),
        image.height(),
        image::ExtendedColorType::L8,
    )
    .map_err(|e| format!("PNG encoding error: {}", e))?;

    Ok(STANDARD.encode(&png_bytes))
}

fn sign_data(data: &str, secret: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(data.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_qr_payload_roundtrip() {
        let ticket_id = Uuid::new_v4();
        let event_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let secret = "test_secret";

        let payload = generate_qr_payload(ticket_id, event_id, user_id, secret);
        let result = verify_qr_payload(&payload, secret);

        assert!(result.is_some());
        let (t, e, u) = result.unwrap();
        assert_eq!(t, ticket_id);
        assert_eq!(e, event_id);
        assert_eq!(u, user_id);
    }

    #[test]
    fn test_qr_payload_tampered() {
        let ticket_id = Uuid::new_v4();
        let event_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let secret = "test_secret";

        let payload = generate_qr_payload(ticket_id, event_id, user_id, secret);
        // Tamper with the payload
        let result = verify_qr_payload(&payload, "wrong_secret");
        assert!(result.is_none());
    }

    #[test]
    fn test_qr_image_generation() {
        let result = generate_qr_image_base64("test_data");
        assert!(result.is_ok());
        assert!(!result.unwrap().is_empty());
    }
}
