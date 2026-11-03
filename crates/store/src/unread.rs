//! Comparaison des snowflakes (u64 en chaînes) et règle de non-lu.

/// Valeur numérique d'un snowflake ; `0` si la chaîne est invalide.
pub fn snowflake_value(id: &str) -> u64 {
    id.parse().unwrap_or(0)
}

pub fn is_newer(candidate: &str, reference: &str) -> bool {
    snowflake_value(candidate) > snowflake_value(reference)
}

/// Non-lu : le dernier message est plus récent que le dernier message lu.
/// Sans message, rien à lire ; sans lecture connue, tout message est non lu.
pub fn is_unread(last_message: Option<&str>, last_read: Option<&str>) -> bool {
    match (last_message, last_read) {
        (None, _) => false,
        (Some(_), None) => true,
        (Some(last), Some(read)) => is_newer(last, read),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_numerically_not_lexically() {
        assert!(is_newer("10", "9"));
        assert!(!is_newer("9", "10"));
    }

    #[test]
    fn unread_rules() {
        assert!(!is_unread(None, Some("5")));
        assert!(is_unread(Some("6"), Some("5")));
        assert!(!is_unread(Some("5"), Some("5")));
        assert!(is_unread(Some("5"), None));
    }
}
